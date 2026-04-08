import type { ParserState } from '../types.js';
import {
  CHAR_COLON,
  CHAR_COMMA,
  CHAR_CR,
  CHAR_DQUOTE,
  CHAR_LBRACE,
  CHAR_LBRACKET,
  CHAR_LF,
  CHAR_QUESTION,
  CHAR_RBRACE,
  CHAR_RBRACKET,
  CHAR_SPACE,
  CHAR_SQUOTE,
  CHAR_STAR,
  CHAR_TAB,
} from './chars.js';
import {
  parseAlias,
  readAnchorOrTag,
  skipBlanksAndComments,
  skipSpaces,
} from './navigation.js';
import { resolveScalar, setMapKey } from './scalars.js';
import {
  parseDoubleQuoted,
  parsePlainScalar,
  parseSingleQuoted,
} from './strings.js';

export const parseFlowSeq = (state: ParserState): unknown[] => {
  state.pos++;

  const result: unknown[] = [];

  skipBlanksAndComments(state);

  while (
    state.pos < state.len &&
    state.src.charCodeAt(state.pos) !== CHAR_RBRACKET
  ) {
    readAnchorOrTag(state);

    const anchor = state.lastAnchor;

    skipSpaces(state);

    const value = parseFlowValue(state);

    if (anchor) state.anchors.set(anchor, value);

    result.push(value);

    skipBlanksAndComments(state);

    if (
      state.pos < state.len &&
      state.src.charCodeAt(state.pos) === CHAR_COMMA
    ) {
      state.pos++;
      skipBlanksAndComments(state);
    }
  }

  if (state.pos < state.len) state.pos++;

  return result;
};

export const parseFlowMap = (state: ParserState): Record<string, unknown> => {
  state.pos++;

  const result: Record<string, unknown> = {};

  skipBlanksAndComments(state);

  while (
    state.pos < state.len &&
    state.src.charCodeAt(state.pos) !== CHAR_RBRACE
  ) {
    if (state.src.charCodeAt(state.pos) === CHAR_QUESTION) {
      const questionNext = state.src.charCodeAt(state.pos + 1);

      if (
        questionNext === CHAR_SPACE ||
        questionNext === CHAR_TAB ||
        questionNext === CHAR_LF ||
        questionNext === CHAR_CR
      ) {
        state.pos++;
        skipBlanksAndComments(state);
      }
    }

    readAnchorOrTag(state);

    const keyAnchor = state.lastAnchor;

    skipSpaces(state);

    const key = parseFlowScalarKey(state);

    if (keyAnchor) state.anchors.set(keyAnchor, key);

    skipBlanksAndComments(state);

    let value: unknown = null;

    if (
      state.pos < state.len &&
      state.src.charCodeAt(state.pos) === CHAR_COLON
    ) {
      state.pos++;
      skipBlanksAndComments(state);

      if (state.pos < state.len) {
        const valueCode = state.src.charCodeAt(state.pos);

        if (valueCode !== CHAR_COMMA && valueCode !== CHAR_RBRACE) {
          readAnchorOrTag(state);

          const valAnchor = state.lastAnchor;

          skipSpaces(state);

          value = parseFlowValue(state);

          if (valAnchor) state.anchors.set(valAnchor, value);
        }
      }
    }

    setMapKey(result, String(key), value);
    skipBlanksAndComments(state);

    if (
      state.pos < state.len &&
      state.src.charCodeAt(state.pos) === CHAR_COMMA
    ) {
      state.pos++;
      skipBlanksAndComments(state);
    }
  }

  if (state.pos < state.len) state.pos++;

  return result;
};

export const parseFlowScalarKey = (state: ParserState): unknown => {
  const code = state.src.charCodeAt(state.pos);

  if (code === CHAR_SQUOTE) return parseSingleQuoted(state);
  if (code === CHAR_DQUOTE) return parseDoubleQuoted(state);
  if (code === CHAR_LBRACKET) return parseFlowSeq(state);
  if (code === CHAR_LBRACE) return parseFlowMap(state);
  if (code === CHAR_STAR) return parseAlias(state);
  return resolveScalar(parsePlainScalar(state, 0, true));
};

export const parseFlowValue = (state: ParserState): unknown => {
  skipBlanksAndComments(state);

  const code = state.src.charCodeAt(state.pos);

  if (code === CHAR_SQUOTE) return parseSingleQuoted(state);
  if (code === CHAR_DQUOTE) return parseDoubleQuoted(state);
  if (code === CHAR_LBRACKET) return parseFlowSeq(state);
  if (code === CHAR_LBRACE) return parseFlowMap(state);
  if (code === CHAR_STAR) return parseAlias(state);

  const raw = parsePlainScalar(state, 0, true);

  skipSpaces(state);

  if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_COLON) {
    const afterColon =
      state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

    if (
      afterColon === -1 ||
      afterColon === CHAR_SPACE ||
      afterColon === CHAR_COMMA ||
      afterColon === CHAR_RBRACKET
    ) {
      const key = String(resolveScalar(raw));

      state.pos++;
      skipBlanksAndComments(state);

      const pair: Record<string, unknown> = {};

      const isTerminator =
        state.pos >= state.len ||
        state.src.charCodeAt(state.pos) === CHAR_COMMA ||
        state.src.charCodeAt(state.pos) === CHAR_RBRACKET ||
        state.src.charCodeAt(state.pos) === CHAR_RBRACE;

      const value = isTerminator ? null : parseFlowValue(state);

      setMapKey(pair, key, value);

      return pair;
    }
  }

  return resolveScalar(raw);
};
