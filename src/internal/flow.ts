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
  CHAR_SPACE,
  CHAR_STAR,
  isBlank,
  isLineBreak,
  isSpaceOrTab,
} from './chars.js';
import { enterCollection, leaveCollection } from './depth.js';
import { syntaxError } from './errors.js';
import { setMapKey } from './keys.js';
import {
  countIndentSpaces,
  isDocumentMarker,
  skipComment,
  skipSpaces,
} from './navigation.js';
import { mergeNodeProperties, readNodeProperties } from './properties.js';
import {
  parseDoubleQuoted,
  parsePlainScalar,
  parseSingleQuoted,
} from './strings.js';
import {
  checkCollectionTag,
  resolveEmptyNode,
  resolvePlainScalar,
  resolveTextScalar,
} from './tags.js';

const FLOW_SEQUENCE: FlowCollection = {
  name: 'flow sequence',
  open: '[',
  closeCode: CHAR_RIGHT_BRACKET,
  foreignCloseCode: CHAR_RIGHT_BRACE,
};

const FLOW_MAPPING: FlowCollection = {
  name: 'flow mapping',
  open: '{',
  closeCode: CHAR_RIGHT_BRACE,
  foreignCloseCode: CHAR_RIGHT_BRACKET,
};

const checkFlowLine = (state: ParserState, ownerIndent: number): void => {
  const lineStart = state.pos;
  const indent = countIndentSpaces(state, lineStart);
  let cursor = lineStart + indent;

  while (isSpaceOrTab(state.src.charCodeAt(cursor))) cursor++;

  if (cursor >= state.len) return;

  const code = state.src.charCodeAt(cursor);

  if (
    isLineBreak(code) ||
    code === CHAR_HASH ||
    code === CHAR_RIGHT_BRACKET ||
    code === CHAR_RIGHT_BRACE
  )
    return;

  if (isDocumentMarker(state, lineStart))
    throw syntaxError(
      state,
      'A document marker interrupts a flow collection: expected the collection to close before the "---" or "..." line',
      lineStart
    );

  if (indent <= ownerIndent)
    throw syntaxError(
      state,
      `A flow collection line is not indented past its block collection: expected more than ${ownerIndent} leading spaces`,
      cursor
    );
};

const skipFlowSeparation = (state: ParserState, ownerIndent: number): void => {
  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (isSpaceOrTab(code)) {
      state.pos++;
      continue;
    }

    if (code === CHAR_HASH) {
      skipComment(state);
      continue;
    }

    if (!isLineBreak(code)) return;

    state.pos++;
    checkFlowLine(state, ownerIndent);
  }
};

const skipFlowIndicator = (state: ParserState, ownerIndent: number): void => {
  state.pos++;
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

const isFlowTerminator = (state: ParserState): boolean => {
  if (state.pos >= state.len) return true;

  const code = state.src.charCodeAt(state.pos);

  return (
    code === CHAR_COMMA ||
    code === CHAR_RIGHT_BRACKET ||
    code === CHAR_RIGHT_BRACE
  );
};

const unclosedError = (
  state: ParserState,
  collection: FlowCollection,
  openedAt: number
): SyntaxError =>
  syntaxError(
    state,
    `Unclosed ${collection.name}: expected "${String.fromCharCode(collection.closeCode)}" to close the "${collection.open}" before the end of input`,
    openedAt
  );

const unexpectedError = (
  state: ParserState,
  collection: FlowCollection,
  expected: string
): SyntaxError =>
  syntaxError(
    state,
    `Unexpected "${state.src.charAt(state.pos)}" in a ${collection.name}: expected ${expected}`
  );

const skipToFlowBoundary = (
  state: ParserState,
  collection: FlowCollection,
  openedAt: number,
  ownerIndent: number
): number => {
  skipFlowSeparation(state, ownerIndent);

  if (state.pos >= state.len) throw unclosedError(state, collection, openedAt);

  return state.src.charCodeAt(state.pos);
};

const openFlowEntry = (
  state: ParserState,
  collection: FlowCollection,
  openedAt: number,
  ownerIndent: number
): boolean => {
  const code = skipToFlowBoundary(state, collection, openedAt, ownerIndent);

  if (code === collection.closeCode) {
    state.pos++;
    return false;
  }

  if (code === collection.foreignCloseCode || code === CHAR_COMMA)
    throw unexpectedError(
      state,
      collection,
      `an entry or "${String.fromCharCode(collection.closeCode)}"`
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
    throw unexpectedError(
      state,
      collection,
      `"," or "${String.fromCharCode(collection.closeCode)}"`
    );

  state.pos++;

  return code === CHAR_COMMA;
};

const isImplicitPairColon = (state: ParserState): boolean => {
  if (state.src.charCodeAt(state.pos) !== CHAR_COLON) return false;
  if (state.pos + 1 >= state.len) return true;

  const afterColon = state.src.charCodeAt(state.pos + 1);

  return (
    afterColon === CHAR_SPACE ||
    afterColon === CHAR_COMMA ||
    afterColon === CHAR_RIGHT_BRACKET
  );
};

const completeImplicitPair = (
  state: ParserState,
  ownerIndent: number,
  key: unknown,
  keyStart: number
): unknown => {
  skipSpaces(state);

  if (!isImplicitPairColon(state)) return key;

  enterCollection(state);

  const pair: Record<string, unknown> = {};

  skipFlowIndicator(state, ownerIndent);
  setMapKey(state, pair, key, keyStart, parseFlowValue(state, ownerIndent));
  leaveCollection(state);

  return pair;
};

const parseFlowNode = (
  state: ParserState,
  ownerIndent: number,
  allowsImplicitPair: boolean,
  tag: NodeTag | undefined
): unknown => {
  const code = state.src.charCodeAt(state.pos);

  if (code === CHAR_SINGLE_QUOTE)
    return resolveTextScalar(state, tag, parseSingleQuoted(state));
  if (code === CHAR_DOUBLE_QUOTE)
    return resolveTextScalar(state, tag, parseDoubleQuoted(state));
  if (code === CHAR_LEFT_BRACKET)
    return parseFlowSequence(state, ownerIndent, tag);
  if (code === CHAR_LEFT_BRACE) return parseFlowMap(state, ownerIndent, tag);
  if (code === CHAR_STAR) return parseAlias(state, tag);
  if (isFlowTerminator(state)) return resolveEmptyNode(state, tag);

  const scalarStart = state.pos;
  const scalar = resolvePlainScalar(
    state,
    tag,
    parsePlainScalar(state, ownerIndent, true)
  );

  return allowsImplicitPair
    ? completeImplicitPair(state, ownerIndent, scalar, scalarStart)
    : scalar;
};

const parseFlowValue = (state: ParserState, ownerIndent: number): unknown => {
  skipFlowSeparation(state, ownerIndent);

  const properties = readFlowNodeProperties(state, ownerIndent);

  return withAnchor(
    state,
    properties?.anchor,
    parseFlowNode(state, ownerIndent, true, properties?.tag)
  );
};

const skipExplicitKeyIndicator = (
  state: ParserState,
  ownerIndent: number
): void => {
  if (state.src.charCodeAt(state.pos) !== CHAR_QUESTION) return;
  if (!isBlank(state.src.charCodeAt(state.pos + 1))) return;

  skipFlowIndicator(state, ownerIndent);
};

const parseFlowMapValue = (
  state: ParserState,
  ownerIndent: number
): unknown => {
  if (state.src.charCodeAt(state.pos) !== CHAR_COLON) return null;

  skipFlowIndicator(state, ownerIndent);

  return parseFlowValue(state, ownerIndent);
};

export const parseFlowSequence = (
  state: ParserState,
  ownerIndent: number,
  tag: NodeTag | undefined
): unknown[] => {
  enterCollection(state);
  checkCollectionTag(state, tag, 'seq');

  const openedAt = state.pos;
  const result: unknown[] = [];

  state.pos++;

  while (openFlowEntry(state, FLOW_SEQUENCE, openedAt, ownerIndent)) {
    result.push(parseFlowValue(state, ownerIndent));

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

  const openedAt = state.pos;
  const result: Record<string, unknown> = {};

  state.pos++;

  while (openFlowEntry(state, FLOW_MAPPING, openedAt, ownerIndent)) {
    skipExplicitKeyIndicator(state, ownerIndent);

    const keyStart = state.pos;
    const properties = readFlowNodeProperties(state, ownerIndent);
    const key = withAnchor(
      state,
      properties?.anchor,
      parseFlowNode(state, ownerIndent, false, properties?.tag)
    );

    skipFlowSeparation(state, ownerIndent);
    setMapKey(
      state,
      result,
      key,
      keyStart,
      parseFlowMapValue(state, ownerIndent)
    );

    if (!closeFlowEntry(state, FLOW_MAPPING, openedAt, ownerIndent)) break;
  }

  leaveCollection(state);

  return result;
};
