import type { FlowCollection, ParserState } from '../types.js';
import { parseAlias, readAnchorOrTag, withAnchor } from './anchors.js';
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
import { syntaxError } from './errors.js';
import { setMapKey } from './keys.js';
import {
  countIndentSpaces,
  isDocumentMarker,
  skipComment,
  skipSpaces,
} from './navigation.js';
import { resolveScalar } from './scalars.js';
import {
  parseDoubleQuoted,
  parsePlainScalar,
  parseSingleQuoted,
} from './strings.js';

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

const openFlowEntry = (
  state: ParserState,
  collection: FlowCollection,
  openedAt: number,
  ownerIndent: number
): boolean => {
  skipFlowSeparation(state, ownerIndent);

  if (state.pos >= state.len) throw unclosedError(state, collection, openedAt);

  const code = state.src.charCodeAt(state.pos);

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
  skipFlowSeparation(state, ownerIndent);

  if (state.pos >= state.len) throw unclosedError(state, collection, openedAt);

  const code = state.src.charCodeAt(state.pos);

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

  const pair: Record<string, unknown> = {};

  state.pos++;
  skipFlowSeparation(state, ownerIndent);
  setMapKey(
    state,
    pair,
    String(key),
    keyStart,
    parseFlowValue(state, ownerIndent)
  );

  return pair;
};

const parseFlowNode = (
  state: ParserState,
  ownerIndent: number,
  allowsImplicitPair: boolean
): unknown => {
  const code = state.src.charCodeAt(state.pos);

  if (code === CHAR_SINGLE_QUOTE) return parseSingleQuoted(state);
  if (code === CHAR_DOUBLE_QUOTE) return parseDoubleQuoted(state);
  if (code === CHAR_LEFT_BRACKET) return parseFlowSequence(state, ownerIndent);
  if (code === CHAR_LEFT_BRACE) return parseFlowMap(state, ownerIndent);
  if (code === CHAR_STAR) return parseAlias(state);
  if (isFlowTerminator(state)) return null;

  const scalarStart = state.pos;
  const scalar = resolveScalar(parsePlainScalar(state, ownerIndent, true));

  return allowsImplicitPair
    ? completeImplicitPair(state, ownerIndent, scalar, scalarStart)
    : scalar;
};

const parseFlowValue = (state: ParserState, ownerIndent: number): unknown => {
  skipFlowSeparation(state, ownerIndent);

  return parseFlowNode(state, ownerIndent, true);
};

const skipExplicitKeyIndicator = (
  state: ParserState,
  ownerIndent: number
): void => {
  if (state.src.charCodeAt(state.pos) !== CHAR_QUESTION) return;
  if (!isBlank(state.src.charCodeAt(state.pos + 1))) return;

  state.pos++;
  skipFlowSeparation(state, ownerIndent);
};

const parseFlowMapValue = (
  state: ParserState,
  ownerIndent: number
): unknown => {
  if (state.src.charCodeAt(state.pos) !== CHAR_COLON) return null;

  state.pos++;
  skipFlowSeparation(state, ownerIndent);

  const code = state.src.charCodeAt(state.pos);

  if (
    state.pos >= state.len ||
    code === CHAR_COMMA ||
    code === CHAR_RIGHT_BRACE
  )
    return null;

  const valueAnchor = readAnchorOrTag(state);

  return withAnchor(state, valueAnchor, parseFlowValue(state, ownerIndent));
};

export const parseFlowSequence = (
  state: ParserState,
  ownerIndent: number
): unknown[] => {
  const openedAt = state.pos;
  const result: unknown[] = [];

  state.pos++;

  while (openFlowEntry(state, FLOW_SEQUENCE, openedAt, ownerIndent)) {
    const anchor = readAnchorOrTag(state);

    result.push(withAnchor(state, anchor, parseFlowValue(state, ownerIndent)));

    if (!closeFlowEntry(state, FLOW_SEQUENCE, openedAt, ownerIndent)) break;
  }

  return result;
};

export const parseFlowMap = (
  state: ParserState,
  ownerIndent: number
): Record<string, unknown> => {
  const openedAt = state.pos;
  const result: Record<string, unknown> = {};

  state.pos++;

  while (openFlowEntry(state, FLOW_MAPPING, openedAt, ownerIndent)) {
    skipExplicitKeyIndicator(state, ownerIndent);

    const keyStart = state.pos;
    const keyAnchor = readAnchorOrTag(state);
    const key = withAnchor(
      state,
      keyAnchor,
      parseFlowNode(state, ownerIndent, false)
    );

    skipFlowSeparation(state, ownerIndent);
    setMapKey(
      state,
      result,
      String(key),
      keyStart,
      parseFlowMapValue(state, ownerIndent)
    );

    if (!closeFlowEntry(state, FLOW_MAPPING, openedAt, ownerIndent)) break;
  }

  return result;
};
