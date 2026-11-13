import type { ParserState } from '../types.js';
import { syntaxError } from './errors.js';

const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const PROTOTYPE_KEY_LENGTHS = Array.from(PROTOTYPE_KEYS, (key) => key.length);
const SHORTEST_PROTOTYPE_KEY_LENGTH = Math.min(...PROTOTYPE_KEY_LENGTHS);
const LONGEST_PROTOTYPE_KEY_LENGTH = Math.max(...PROTOTYPE_KEY_LENGTHS);

const isPrototypeKey = (name: string): boolean =>
  name.length >= SHORTEST_PROTOTYPE_KEY_LENGTH &&
  name.length <= LONGEST_PROTOTYPE_KEY_LENGTH &&
  PROTOTYPE_KEYS.has(name);

const prototypeKeyError = (
  state: ParserState,
  name: string,
  keyStart: number
): SyntaxError =>
  syntaxError(
    state,
    `The mapping key "${name}" can reach an object's prototype: expected a key other than "__proto__", "constructor", or "prototype"`,
    keyStart
  );

export const collectionKeyError = (
  state: ParserState,
  keyStart: number
): SyntaxError =>
  syntaxError(
    state,
    'A mapping key is a sequence or a mapping: expected a scalar key, such as text, a number, a boolean, or null',
    keyStart
  );

const duplicateKeyError = (
  state: ParserState,
  name: string,
  keyStart: number
): SyntaxError =>
  syntaxError(
    state,
    `The mapping key ${JSON.stringify(name)} appears more than once in the same mapping: expected every key of a mapping to be unique`,
    keyStart
  );

const stringifyKey = (
  state: ParserState,
  key: unknown,
  keyStart: number
): string => {
  if (typeof key === 'object' && key !== null)
    throw collectionKeyError(state, keyStart);

  return key == null ? '' : String(key);
};

export const setMapKey = (
  state: ParserState,
  target: Record<string, unknown>,
  key: unknown,
  keyStart: number,
  value: unknown
): void => {
  const name = stringifyKey(state, key, keyStart);

  if (isPrototypeKey(name)) throw prototypeKeyError(state, name, keyStart);
  if (Object.hasOwn(target, name))
    throw duplicateKeyError(state, name, keyStart);

  target[name] = value;
};
