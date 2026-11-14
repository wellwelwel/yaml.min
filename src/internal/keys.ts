import type { YamlError } from '../error.js';
import type { NodeTag, ParserState } from '../types.js';
import { isLineBreak, isQuote } from './chars.js';
import { quote, yamlError } from './errors.js';

const MAX_IMPLICIT_KEY_LENGTH = 1024;
const MERGE_KEY = '<<';

const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'toLocaleString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

const PROTOTYPE_KEY_LENGTHS: ReadonlySet<number> = new Set(
  Array.from(PROTOTYPE_KEYS, (key) => key.length)
);

const IS_PROTOTYPE_KEY_LENGTH: readonly boolean[] = Array.from(
  { length: Math.max(...PROTOTYPE_KEY_LENGTHS) + 1 },
  (_, length) => PROTOTYPE_KEY_LENGTHS.has(length)
);

const isPrototypeKey = (name: string): boolean =>
  IS_PROTOTYPE_KEY_LENGTH[name.length] === true && PROTOTYPE_KEYS.has(name);

const isMapping = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const protoKeyError = (state: ParserState, keyStart: number): YamlError =>
  yamlError(
    state,
    'UNSAFE_KEY',
    'The mapping key "__proto__" would change the prototype of any object the result is copied or merged into: expected another key',
    keyStart
  );

const prototypeKeyError = (
  state: ParserState,
  name: string,
  keyStart: number
): YamlError =>
  yamlError(
    state,
    'UNSAFE_KEY',
    `The mapping key ${quote(name)} holds a mapping, which a deep merge of the result could turn into a change to a prototype or built-in the whole program shares: expected a value that is not a mapping, or another key`,
    keyStart
  );

export const collectionKeyError = (
  state: ParserState,
  keyStart: number
): YamlError =>
  yamlError(
    state,
    'COLLECTION_KEY',
    'A mapping key is a sequence or a mapping: expected a scalar key, such as text, a number, a boolean, or null',
    keyStart
  );

const mergeKeyError = (state: ParserState, keyStart: number): YamlError =>
  yamlError(
    state,
    'MERGE_KEY',
    'The mapping key "<<" asks parsers that support merge keys to merge mappings, which yaml.min never does: expected another key, or !!str "<<" for a literal "<<" key',
    keyStart
  );

const duplicateKeyError = (
  state: ParserState,
  name: string,
  keyStart: number
): YamlError =>
  yamlError(
    state,
    'DUPLICATE_KEY',
    `The mapping key ${quote(name)} appears more than once in the same mapping: expected every key of a mapping to be unique`,
    keyStart
  );

const spansLines = (
  state: ParserState,
  start: number,
  end: number
): boolean => {
  for (let cursor = start; cursor < end; cursor++)
    if (isLineBreak(state.src.charCodeAt(cursor))) return true;

  return false;
};

export const checkImplicitKey = (
  state: ParserState,
  keyStart: number
): void => {
  const colonOffset = state.pos - keyStart;

  if (colonOffset > MAX_IMPLICIT_KEY_LENGTH)
    throw yamlError(
      state,
      'EXPECTED_MAPPING_ENTRY',
      `An implicit key puts its ":" ${colonOffset} characters after its start: expected at most ${MAX_IMPLICIT_KEY_LENGTH}, or "?" before a longer key`,
      keyStart
    );

  if (spansLines(state, keyStart, state.pos))
    throw yamlError(
      state,
      'EXPECTED_MAPPING_ENTRY',
      'An implicit key spans more than one line: expected the key and its ":" on one line, or "?" before a key that spans lines',
      keyStart
    );
};

const stringifyKey = (
  state: ParserState,
  key: unknown,
  keyStart: number
): string => {
  if (typeof key === 'object' && key !== null)
    throw collectionKeyError(state, keyStart);

  return key == null ? '' : String(key);
};

const refuseUnsafeKey = (
  state: ParserState,
  name: string,
  keyStart: number,
  value: unknown
): void => {
  if (name === '__proto__') throw protoKeyError(state, keyStart);
  if (isMapping(value)) throw prototypeKeyError(state, name, keyStart);
};

const definePrototypeKey = (
  state: ParserState,
  target: Record<string, unknown>,
  name: string,
  keyStart: number,
  value: unknown
): void => {
  if (!state.allowUnsafeKeys) refuseUnsafeKey(state, name, keyStart, value);

  Object.defineProperty(target, name, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
};

export const isQuotedStrKey = (
  state: ParserState,
  tag: NodeTag | undefined
): boolean => tag?.name === 'str' && isQuote(state.src.charCodeAt(state.pos));

export const setMapKey = (
  state: ParserState,
  target: Record<string, unknown>,
  key: unknown,
  isQuotedStr: boolean,
  keyStart: number,
  value: unknown
): void => {
  const name = stringifyKey(state, key, keyStart);

  if (name === MERGE_KEY && !isQuotedStr) throw mergeKeyError(state, keyStart);
  if (Object.hasOwn(target, name))
    throw duplicateKeyError(state, name, keyStart);
  if (isPrototypeKey(name))
    definePrototypeKey(state, target, name, keyStart, value);
  else target[name] = value;
};
