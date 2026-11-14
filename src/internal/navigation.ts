import type { ParserState } from '../types.js';
import {
  CHAR_CARRIAGE_RETURN,
  CHAR_DOT,
  CHAR_HASH,
  CHAR_LINE_FEED,
  CHAR_MINUS,
  CHAR_SPACE,
  CHAR_TAB,
  isBlank,
  isLineBreak,
  isSpaceOrTab,
} from './chars.js';
import { yamlError } from './errors.js';

export const isBlankOrEnd = (state: ParserState, position: number): boolean =>
  position >= state.len || isBlank(state.src.charCodeAt(position));

export const isAtLineBreakOrEnd = (state: ParserState): boolean =>
  state.pos >= state.len || isLineBreak(state.src.charCodeAt(state.pos));

export const lineBreakWidth = (state: ParserState, position: number): number =>
  state.src.charCodeAt(position) === CHAR_CARRIAGE_RETURN &&
  state.src.charCodeAt(position + 1) === CHAR_LINE_FEED
    ? 2
    : 1;

export const countIndentSpaces = (
  state: ParserState,
  lineStart: number
): number => {
  let cursor = lineStart;

  while (state.src.charCodeAt(cursor) === CHAR_SPACE) cursor++;

  return cursor - lineStart;
};

export const isLineStart = (state: ParserState, position: number): boolean =>
  position === 0 || isLineBreak(state.src.charCodeAt(position - 1));

const isMarkerOf = (
  state: ParserState,
  position: number,
  markerCode: number
): boolean =>
  state.src.charCodeAt(position) === markerCode &&
  state.src.charCodeAt(position + 1) === markerCode &&
  state.src.charCodeAt(position + 2) === markerCode &&
  isBlankOrEnd(state, position + 3) &&
  isLineStart(state, position);

export const isDocumentStart = (
  state: ParserState,
  position: number
): boolean => isMarkerOf(state, position, CHAR_MINUS);

export const isDocumentEnd = (state: ParserState, position: number): boolean =>
  isMarkerOf(state, position, CHAR_DOT);

export const isDocumentMarker = (
  state: ParserState,
  position: number
): boolean =>
  isDocumentStart(state, position) || isDocumentEnd(state, position);

export const skipSpaces = (state: ParserState): void => {
  while (isSpaceOrTab(state.src.charCodeAt(state.pos))) state.pos++;
};

export const skipToLineEnd = (state: ParserState): void => {
  while (!isAtLineBreakOrEnd(state)) state.pos++;
};

export const skipComment = (state: ParserState): void => {
  if (state.src.charCodeAt(state.pos) !== CHAR_HASH) return;

  if (state.pos > 0 && !isBlank(state.src.charCodeAt(state.pos - 1)))
    throw yamlError(
      state,
      'UNEXPECTED_CHARACTER',
      'A comment touches the content before it: expected a space or a tab before the "#"'
    );

  skipToLineEnd(state);
};

export const skipBlanksAndComments = (state: ParserState): void => {
  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (code === CHAR_HASH) {
      skipComment(state);
      continue;
    }

    if (!isBlank(code)) return;

    state.pos++;
  }
};

const skipTabbedBlankLine = (state: ParserState): boolean => {
  let cursor = state.pos;

  while (isSpaceOrTab(state.src.charCodeAt(cursor))) cursor++;

  if (cursor < state.len) {
    const code = state.src.charCodeAt(cursor);

    if (code !== CHAR_HASH && !isLineBreak(code)) return false;
  }

  state.pos = cursor;
  skipComment(state);

  return true;
};

export const skipNewlinesAndComments = (state: ParserState): number => {
  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (isLineBreak(code)) {
      state.pos++;
      continue;
    }

    const lineStart = state.pos;

    state.pos += countIndentSpaces(state, lineStart);

    if (state.pos >= state.len) return 0;

    const contentCode = state.src.charCodeAt(state.pos);

    if (isLineBreak(contentCode)) continue;

    if (contentCode === CHAR_HASH) {
      skipComment(state);
      continue;
    }

    if (contentCode === CHAR_TAB && skipTabbedBlankLine(state)) continue;

    return state.pos - lineStart;
  }

  return 0;
};
