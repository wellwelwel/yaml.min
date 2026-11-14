import type { YamlError } from '../error.js';
import type { NodeTag, ParserState, TagName } from '../types.js';
import {
  CHAR_GREATER_THAN,
  CHAR_LESS_THAN,
  isBlank,
  isFlowEntryEnd,
  isFlowIndicator,
  isSpaceOrTab,
} from './chars.js';
import { enterCollection, leaveCollection } from './depth.js';
import { quote, yamlError } from './errors.js';
import { isAtLineBreakOrEnd, skipComment, skipSpaces } from './navigation.js';
import {
  isNullText,
  MAX_BIG_INTEGER_DIGITS,
  resolveBoolean,
  resolveFloat,
  resolveInteger,
  resolveScalar,
} from './scalars.js';

const CORE_TAG_PREFIX = 'tag:yaml.org,2002:';
const TAG_DIRECTIVE = '%TAG';

const NAMED_TAG_HANDLE = /^![0-9A-Za-z-]+!$/;
const TAG_SUFFIX = /^(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z#;/?:@&=+$.~*'()_-])+$/;
const VERBATIM_TAG =
  /^(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z#;/?:@&=+$,_.!~*'()[\]-])+$/;
const TAG_PREFIX =
  /^(?:!|%[0-9A-Fa-f]{2}|[0-9A-Za-z#;/?:@&=+$.~*'()_-])(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z#;/?:@&=+$,_.!~*'()[\]-])*$/;

const CORE_TAGS: readonly TagName[] = [
  'str',
  'int',
  'float',
  'bool',
  'null',
  'seq',
  'map',
];

const CORE_TAG_NAMES: ReadonlyMap<string, TagName> = new Map(
  CORE_TAGS.map((name): [string, TagName] => [
    `${CORE_TAG_PREFIX}${name}`,
    name,
  ])
);

const DEFAULT_TAG_HANDLES: ReadonlyMap<string, string> = new Map([
  ['!', '!'],
  ['!!', CORE_TAG_PREFIX],
]);

const SCALAR_RESOLVERS: Readonly<
  Record<TagName, (text: string, bigint: boolean) => unknown>
> = {
  '!': (text) => text,
  str: (text) => text,
  int: resolveInteger,
  float: resolveFloat,
  bool: resolveBoolean,
  null: (text) => (text === '' || isNullText(text) ? null : undefined),
  seq: (text) => (text === '' ? [] : undefined),
  map: (text) => (text === '' ? {} : undefined),
};

const TAG_EXPECTATIONS: Readonly<Record<TagName, string>> = {
  '!': 'a scalar',
  str: 'a scalar',
  int: 'an integer from -9007199254740991 to 9007199254740991, such as 42, 0o52, or 0x2A',
  float: 'a finite number, such as 1.5 or 6.02e23, or .inf, -.inf, or .nan',
  bool: 'true or false',
  null: 'null, ~, or no value',
  seq: 'a sequence',
  map: 'a mapping',
};

const BIG_INTEGER_EXPECTATION = `an integer of at most ${MAX_BIG_INTEGER_DIGITS} digits, such as 42, 0o52, or 0x2A`;

const invalidTagError = (
  state: ParserState,
  source: string,
  start: number
): YamlError =>
  yamlError(
    state,
    'INVALID_TAG',
    `The tag ${quote(source)} is not well formed: expected "!", "!!", or a declared handle such as "!e!", followed by tag characters, or a verbatim tag such as "!<tag:yaml.org,2002:str>"`,
    start
  );

const unknownTagError = (
  state: ParserState,
  source: string,
  start: number
): YamlError =>
  yamlError(
    state,
    'UNKNOWN_TAG',
    `The tag ${quote(source)} is not a core schema tag: expected !!str, !!int, !!float, !!bool, !!null, !!seq, !!map, or the non-specific "!"`,
    start
  );

const tagMismatchError = (
  state: ParserState,
  tag: NodeTag,
  node: string
): YamlError =>
  yamlError(
    state,
    'TAG_MISMATCH',
    `The tag ${quote(tag.source)} cannot label ${node}: expected ${tag.name === 'int' && state.bigint ? BIG_INTEGER_EXPECTATION : TAG_EXPECTATIONS[tag.name]}`,
    tag.start
  );

const isTagEnd = (code: number): boolean =>
  isBlank(code) || isFlowIndicator(code);

const isTagFollower = (code: number, inFlow: boolean): boolean =>
  isBlank(code) || (inFlow && isFlowEntryEnd(code));

const findVerbatimTagEnd = (state: ParserState, start: number): number => {
  let cursor = start + 2;

  while (
    cursor < state.len &&
    state.src.charCodeAt(cursor) !== CHAR_GREATER_THAN &&
    !isBlank(state.src.charCodeAt(cursor))
  )
    cursor++;

  if (state.src.charCodeAt(cursor) !== CHAR_GREATER_THAN)
    throw yamlError(
      state,
      'INVALID_TAG',
      'A verbatim tag is not closed: expected ">" to end the "!<" tag on the same line',
      start
    );

  return cursor + 1;
};

const findTagEnd = (state: ParserState, start: number): number => {
  if (state.src.charCodeAt(start + 1) === CHAR_LESS_THAN)
    return findVerbatimTagEnd(state, start);

  let cursor = start + 1;

  while (cursor < state.len && !isTagEnd(state.src.charCodeAt(cursor)))
    cursor++;

  return cursor;
};

const verbatimTagName = (
  state: ParserState,
  source: string,
  start: number
): string => {
  const name = source.slice(2, -1);

  if (!VERBATIM_TAG.test(name)) throw invalidTagError(state, source, start);

  return name;
};

const shorthandTagName = (
  state: ParserState,
  source: string,
  start: number
): string => {
  const handleEnd = source.indexOf('!', 1);
  const handle = handleEnd === -1 ? '!' : source.slice(0, handleEnd + 1);
  const suffix = source.slice(handle.length);

  if (
    (handle.length > 2 && !NAMED_TAG_HANDLE.test(handle)) ||
    !TAG_SUFFIX.test(suffix)
  )
    throw invalidTagError(state, source, start);

  const prefix =
    state.tagHandles.get(handle) ?? DEFAULT_TAG_HANDLES.get(handle);

  if (prefix === undefined)
    throw yamlError(
      state,
      'UNDECLARED_TAG_HANDLE',
      `The tag handle ${quote(handle)} is not declared: expected a %TAG directive declaring it before the document`,
      start
    );

  return prefix + suffix;
};

const decodeTagName = (
  state: ParserState,
  name: string,
  source: string,
  start: number
): string => {
  if (!name.includes('%')) return name;

  try {
    return decodeURIComponent(name);
  } catch {
    throw invalidTagError(state, source, start);
  }
};

const resolveTagName = (
  state: ParserState,
  source: string,
  start: number
): TagName => {
  if (source === '!') return '!';

  const name = CORE_TAG_NAMES.get(
    decodeTagName(
      state,
      source.charCodeAt(1) === CHAR_LESS_THAN
        ? verbatimTagName(state, source, start)
        : shorthandTagName(state, source, start),
      source,
      start
    )
  );

  if (name === undefined) throw unknownTagError(state, source, start);

  return name;
};

export const readTag = (state: ParserState, inFlow: boolean): NodeTag => {
  const start = state.pos;
  const end = findTagEnd(state, start);
  const source = state.src.slice(start, end);

  state.pos = end;

  if (
    state.pos < state.len &&
    !isTagFollower(state.src.charCodeAt(state.pos), inFlow)
  )
    throw yamlError(
      state,
      'INVALID_TAG',
      `The tag ${quote(source)} runs into the node it labels: expected a space between the tag and the node`,
      start
    );

  return { name: resolveTagName(state, source, start), source, start };
};

const resolveTaggedScalar = (
  state: ParserState,
  tag: NodeTag,
  text: string
): unknown => {
  const value = SCALAR_RESOLVERS[tag.name](text, state.bigint);

  if (value === undefined)
    throw tagMismatchError(
      state,
      tag,
      text === '' ? 'an empty node' : 'this scalar'
    );
  if (tag.name === 'seq' || tag.name === 'map') {
    enterCollection(state);
    leaveCollection(state);
  }

  return value;
};

export const resolvePlainScalar = (
  state: ParserState,
  tag: NodeTag | undefined,
  raw: string
): unknown =>
  tag === undefined
    ? resolveScalar(raw, state.bigint)
    : resolveTaggedScalar(state, tag, raw);

export const resolveTextScalar = (
  state: ParserState,
  tag: NodeTag | undefined,
  text: string
): unknown =>
  tag === undefined ? text : resolveTaggedScalar(state, tag, text);

export const resolveEmptyNode = (
  state: ParserState,
  tag: NodeTag | undefined
): unknown => (tag === undefined ? null : resolveTaggedScalar(state, tag, ''));

export const checkCollectionTag = (
  state: ParserState,
  tag: NodeTag | undefined,
  kind: 'seq' | 'map'
): void => {
  if (tag === undefined || tag.name === '!' || tag.name === kind) return;

  throw tagMismatchError(
    state,
    tag,
    kind === 'seq' ? 'a sequence' : 'a mapping'
  );
};

export const isTagDirective = (state: ParserState): boolean =>
  state.src.startsWith(TAG_DIRECTIVE, state.pos) &&
  isSpaceOrTab(state.src.charCodeAt(state.pos + TAG_DIRECTIVE.length));

const readDirectiveToken = (state: ParserState): string => {
  const start = state.pos;

  while (state.pos < state.len && !isBlank(state.src.charCodeAt(state.pos)))
    state.pos++;

  return state.src.slice(start, state.pos);
};

const isTagHandle = (handle: string): boolean =>
  handle === '!' || handle === '!!' || NAMED_TAG_HANDLE.test(handle);

const isWellFormedTagDirective = (
  state: ParserState,
  handle: string,
  prefix: string
): boolean =>
  isAtLineBreakOrEnd(state) && isTagHandle(handle) && TAG_PREFIX.test(prefix);

export const readTagDirective = (state: ParserState): void => {
  const directiveStart = state.pos;

  state.pos += TAG_DIRECTIVE.length;
  skipSpaces(state);

  const handle = readDirectiveToken(state);

  skipSpaces(state);

  const prefix = readDirectiveToken(state);

  skipSpaces(state);
  skipComment(state);

  if (!isWellFormedTagDirective(state, handle, prefix))
    throw yamlError(
      state,
      'INVALID_DIRECTIVE',
      'A %TAG directive is not well formed: expected "%TAG", a handle such as "!e!", and a prefix such as "tag:example.com,2000:"',
      directiveStart
    );

  if (state.tagHandles.has(handle))
    throw yamlError(
      state,
      'DUPLICATE_TAG_HANDLE',
      `The tag handle ${quote(handle)} is declared twice for the same document: expected one %TAG directive per handle`,
      directiveStart
    );

  state.tagHandles.set(handle, prefix);
};
