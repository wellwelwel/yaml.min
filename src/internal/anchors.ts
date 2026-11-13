import type { ParserState } from '../types.js';
import {
  CHAR_AMP,
  CHAR_COLON,
  CHAR_COMMA,
  CHAR_EXCL,
  CHAR_RBRACE,
  CHAR_RBRACKET,
  isBlank,
} from './chars.js';
import { syntaxError } from './errors.js';
import { isBlankOrEnd, skipSpaces } from './navigation.js';

const isAnchorNameEnd = (code: number): boolean =>
  isBlank(code) ||
  code === CHAR_COMMA ||
  code === CHAR_RBRACKET ||
  code === CHAR_RBRACE ||
  code === CHAR_COLON;

const readAnchorName = (state: ParserState): string => {
  const start = state.pos;

  while (
    state.pos < state.len &&
    !isAnchorNameEnd(state.src.charCodeAt(state.pos))
  )
    state.pos++;

  return state.src.slice(start, state.pos);
};

const skipTag = (state: ParserState): void => {
  while (!isBlankOrEnd(state, state.pos)) state.pos++;
};

export const readAnchorOrTag = (state: ParserState): string | undefined => {
  let anchor: string | undefined;

  while (state.pos < state.len) {
    skipSpaces(state);

    const code = state.src.charCodeAt(state.pos);

    if (code === CHAR_EXCL) {
      skipTag(state);
      continue;
    }

    if (code !== CHAR_AMP) break;

    if (anchor !== undefined)
      throw syntaxError(
        state,
        `A node carries a second anchor after "&${anchor}": expected at most one anchor per node`
      );

    state.pos++;
    anchor = readAnchorName(state);
  }

  return anchor;
};

export const parseAlias = (state: ParserState): unknown => {
  const aliasStart = state.pos;

  state.pos++;

  const name = readAnchorName(state);

  if (name === '')
    throw syntaxError(
      state,
      'An alias has no name: expected an anchor name right after "*"',
      aliasStart
    );

  const value = state.anchors.get(name);

  if (value === undefined)
    throw syntaxError(
      state,
      `The alias "*${name}" names no anchor: expected "&${name}" to be defined earlier in the same document`,
      aliasStart
    );

  return value;
};

export const withAnchor = (
  state: ParserState,
  anchor: string | undefined,
  value: unknown
): unknown => {
  if (anchor) state.anchors.set(anchor, value);

  return value;
};
