import type { YamlError } from '../error.js';
import type {
  FlowCollection,
  NodeProperties,
  NodeTag,
  ParserState,
} from '../types.js';
import { parseAlias, withAnchor } from './anchors.js';
import {
  CHAR_COLON,
  CHAR_COMMA,
  CHAR_DOUBLE_QUOTE,
  CHAR_HASH,
  CHAR_LEFT_BRACE,
  CHAR_LEFT_BRACKET,
  CHAR_QUESTION,
  CHAR_RIGHT_BRACE,
  CHAR_RIGHT_BRACKET,
  CHAR_SINGLE_QUOTE,
  CHAR_STAR,
  isBlank,
  isContentIndicator,
  isFlowEntryEnd,
  isLineBreak,
  isSpaceOrTab,
} from './chars.js';
import { enterCollection, leaveCollection } from './depth.js';
import { characterAt, quote, yamlError } from './errors.js';
import { checkImplicitKey, isQuotedStrKey, setMapKey } from './keys.js';
import {
  countIndentSpaces,
  isDocumentBoundary,
  isValueIndicator,
  skipComment,
  skipSpaces,
} from './navigation.js';
import { parsePlainScalar, unindentedFlowLineError } from './plain-scalars.js';
import { mergeNodeProperties, readNodeProperties } from './properties.js';
import { parseDoubleQuoted, parseSingleQuoted } from './quoted-scalars.js';
import {
  checkCollectionTag,
  resolveEmptyNode,
  resolvePlainScalar,
  resolveTextScalar,
} from './tags.js';

const FLOW_SEQUENCE: FlowCollection = {
  name: 'flow sequence',
  open: '[',
  close: ']',
  closeCode: CHAR_RIGHT_BRACKET,
  foreignCloseCode: CHAR_RIGHT_BRACE,
};

const FLOW_MAPPING: FlowCollection = {
  name: 'flow mapping',
  open: '{',
  close: '}',
  closeCode: CHAR_RIGHT_BRACE,
  foreignCloseCode: CHAR_RIGHT_BRACKET,
};

const checkFlowLine = (state: ParserState, ownerIndent: number): void => {
  const lineStart = state.position;
  const indent = countIndentSpaces(state, lineStart);
  let cursor = lineStart + indent;

  while (isSpaceOrTab(state.source.charCodeAt(cursor))) cursor++;

  if (cursor >= state.sourceLength) return;

  const code = state.source.charCodeAt(cursor);

  if (
    isLineBreak(code) ||
    code === CHAR_HASH ||
    code === CHAR_RIGHT_BRACKET ||
    code === CHAR_RIGHT_BRACE
  )
    return;

  if (isDocumentBoundary(state, lineStart))
    throw yamlError(
      state,
      'UNEXPECTED_DOCUMENT_MARKER',
      'A document boundary interrupts a flow collection: expected the collection to close before the line that starts with "---", "...", or a byte order mark',
      lineStart
    );

  if (indent <= ownerIndent)
    throw unindentedFlowLineError(state, ownerIndent, cursor);
};

const skipFlowSeparation = (state: ParserState, ownerIndent: number): void => {
  while (state.position < state.sourceLength) {
    const code = state.source.charCodeAt(state.position);

    if (isSpaceOrTab(code)) {
      state.position++;
      continue;
    }

    if (code === CHAR_HASH) {
      skipComment(state);
      continue;
    }

    if (!isLineBreak(code)) return;

    state.position++;
    checkFlowLine(state, ownerIndent);
  }
};

const skipFlowIndicator = (state: ParserState, ownerIndent: number): void => {
  state.position++;
  skipFlowSeparation(state, ownerIndent);
};

const readFlowNodeProperties = (
  state: ParserState,
  ownerIndent: number
): NodeProperties | undefined => {
  let properties: NodeProperties | undefined;
  let lineProperties = readNodeProperties(state, true);

  while (lineProperties !== undefined) {
    properties = mergeNodeProperties(state, properties, lineProperties);
    skipFlowSeparation(state, ownerIndent);
    lineProperties = readNodeProperties(state, true);
  }

  return properties;
};

const isFlowTerminator = (state: ParserState): boolean =>
  state.position >= state.sourceLength ||
  isFlowEntryEnd(state.source.charCodeAt(state.position));

const unclosedCollectionError = (
  state: ParserState,
  collection: FlowCollection,
  openedAt: number
): YamlError =>
  yamlError(
    state,
    'UNTERMINATED_FLOW_COLLECTION',
    `Unclosed ${collection.name}: expected "${collection.close}" to close the "${collection.open}" before the end of input`,
    openedAt
  );

const unexpectedCharacterError = (
  state: ParserState,
  collection: FlowCollection,
  expected: string
): YamlError =>
  yamlError(
    state,
    'UNEXPECTED_CHARACTER',
    `Unexpected ${quote(characterAt(state, state.position))} in a ${collection.name}: expected ${expected}`
  );

const skipToFlowBoundary = (
  state: ParserState,
  collection: FlowCollection,
  openedAt: number,
  ownerIndent: number
): number => {
  skipFlowSeparation(state, ownerIndent);

  if (state.position >= state.sourceLength)
    throw unclosedCollectionError(state, collection, openedAt);

  return state.source.charCodeAt(state.position);
};

const openFlowEntry = (
  state: ParserState,
  collection: FlowCollection,
  openedAt: number,
  ownerIndent: number
): boolean => {
  const code = skipToFlowBoundary(state, collection, openedAt, ownerIndent);

  if (code === collection.closeCode) {
    state.position++;
    return false;
  }

  if (code === collection.foreignCloseCode || code === CHAR_COMMA)
    throw unexpectedCharacterError(
      state,
      collection,
      `an entry or "${collection.close}"`
    );

  return true;
};

const closeFlowEntry = (
  state: ParserState,
  collection: FlowCollection,
  openedAt: number,
  ownerIndent: number
): boolean => {
  const code = skipToFlowBoundary(state, collection, openedAt, ownerIndent);

  if (code !== CHAR_COMMA && code !== collection.closeCode)
    throw unexpectedCharacterError(
      state,
      collection,
      `"," or "${collection.close}"`
    );

  state.position++;

  return code === CHAR_COMMA;
};

const isImplicitPairColon = (state: ParserState): boolean =>
  state.source.charCodeAt(state.position) === CHAR_COLON &&
  isValueIndicator(state, state.position, true);

const completeImplicitPair = (
  state: ParserState,
  ownerIndent: number,
  key: unknown,
  keyStart: number
): unknown => {
  skipSpaces(state);

  if (!isImplicitPairColon(state)) return key;

  checkImplicitKey(state, keyStart);
  enterCollection(state);

  const pair: Record<string, unknown> = {};

  skipFlowIndicator(state, ownerIndent);
  setMapKey(
    state,
    pair,
    key,
    false,
    keyStart,
    parseFlowValue(state, ownerIndent)
  );
  leaveCollection(state);

  return pair;
};

const parseFlowNode = (
  state: ParserState,
  ownerIndent: number,
  tag: NodeTag | undefined
): unknown => {
  const code = state.source.charCodeAt(state.position);

  if (code === CHAR_SINGLE_QUOTE)
    return resolveTextScalar(state, tag, parseSingleQuoted(state, ownerIndent));
  if (code === CHAR_DOUBLE_QUOTE)
    return resolveTextScalar(state, tag, parseDoubleQuoted(state, ownerIndent));
  if (code === CHAR_LEFT_BRACKET)
    return parseFlowSequence(state, ownerIndent, tag);
  if (code === CHAR_LEFT_BRACE) return parseFlowMap(state, ownerIndent, tag);
  if (code === CHAR_STAR) return parseAlias(state, tag);
  if (isFlowTerminator(state)) return resolveEmptyNode(state, tag);

  return resolvePlainScalar(
    state,
    tag,
    parsePlainScalar(state, ownerIndent, true)
  );
};

const readFlowNode = (
  state: ParserState,
  ownerIndent: number,
  allowsImplicitPair: boolean
): unknown => {
  const nodeStart = state.position;
  const properties = readFlowNodeProperties(state, ownerIndent);
  const canBeImplicitKey =
    allowsImplicitPair &&
    !isContentIndicator(state.source.charCodeAt(state.position));
  const node = withAnchor(
    state,
    properties?.anchor,
    parseFlowNode(state, ownerIndent, properties?.tag)
  );

  return canBeImplicitKey
    ? completeImplicitPair(state, ownerIndent, node, nodeStart)
    : node;
};

const parseFlowValue = (state: ParserState, ownerIndent: number): unknown => {
  skipFlowSeparation(state, ownerIndent);

  return readFlowNode(state, ownerIndent, false);
};

const isExplicitKeyIndicator = (state: ParserState): boolean =>
  state.source.charCodeAt(state.position) === CHAR_QUESTION &&
  isBlank(state.source.charCodeAt(state.position + 1));

const skipExplicitKeyIndicator = (
  state: ParserState,
  ownerIndent: number
): void => {
  if (isExplicitKeyIndicator(state)) skipFlowIndicator(state, ownerIndent);
};

const parseFlowMapValue = (
  state: ParserState,
  ownerIndent: number
): unknown => {
  if (state.source.charCodeAt(state.position) !== CHAR_COLON) return null;

  skipFlowIndicator(state, ownerIndent);

  return parseFlowValue(state, ownerIndent);
};

const readFlowPair = (
  state: ParserState,
  target: Record<string, unknown>,
  ownerIndent: number
): void => {
  skipExplicitKeyIndicator(state, ownerIndent);

  const keyStart = state.position;
  const properties = readFlowNodeProperties(state, ownerIndent);
  const isQuotedStr = isQuotedStrKey(state, properties?.tag);
  const key = withAnchor(
    state,
    properties?.anchor,
    parseFlowNode(state, ownerIndent, properties?.tag)
  );

  skipFlowSeparation(state, ownerIndent);
  setMapKey(
    state,
    target,
    key,
    isQuotedStr,
    keyStart,
    parseFlowMapValue(state, ownerIndent)
  );
};

const parseExplicitPair = (
  state: ParserState,
  ownerIndent: number
): Record<string, unknown> => {
  enterCollection(state);

  const pair: Record<string, unknown> = {};

  readFlowPair(state, pair, ownerIndent);
  leaveCollection(state);

  return pair;
};

const parseFlowSequenceEntry = (
  state: ParserState,
  ownerIndent: number
): unknown =>
  isExplicitKeyIndicator(state)
    ? parseExplicitPair(state, ownerIndent)
    : readFlowNode(state, ownerIndent, true);

export const parseFlowSequence = (
  state: ParserState,
  ownerIndent: number,
  tag: NodeTag | undefined
): unknown[] => {
  enterCollection(state);
  checkCollectionTag(state, tag, 'seq');

  const openedAt = state.position;
  const result: unknown[] = [];

  state.position++;

  while (openFlowEntry(state, FLOW_SEQUENCE, openedAt, ownerIndent)) {
    result.push(parseFlowSequenceEntry(state, ownerIndent));

    if (!closeFlowEntry(state, FLOW_SEQUENCE, openedAt, ownerIndent)) break;
  }

  leaveCollection(state);

  return result;
};

export const parseFlowMap = (
  state: ParserState,
  ownerIndent: number,
  tag: NodeTag | undefined
): Record<string, unknown> => {
  enterCollection(state);
  checkCollectionTag(state, tag, 'map');

  const openedAt = state.position;
  const result: Record<string, unknown> = {};

  state.position++;

  while (openFlowEntry(state, FLOW_MAPPING, openedAt, ownerIndent)) {
    readFlowPair(state, result, ownerIndent);

    if (!closeFlowEntry(state, FLOW_MAPPING, openedAt, ownerIndent)) break;
  }

  leaveCollection(state);

  return result;
};
