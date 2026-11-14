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
  position >= state.sourceLength || isBlank(state.source.charCodeAt(position));

export const isAtLineBreakOrEnd = (state: ParserState): boolean =>
  state.position >= state.sourceLength ||
  isLineBreak(state.source.charCodeAt(state.position));

export const lineBreakWidth = (state: ParserState, position: number): number =>
  state.source.charCodeAt(position) === CHAR_CARRIAGE_RETURN &&
  state.source.charCodeAt(position + 1) === CHAR_LINE_FEED
    ? 2
    : 1;

export const countIndentSpaces = (
  state: ParserState,
  lineStart: number
): number => {
  let cursor = lineStart;

  while (state.source.charCodeAt(cursor) === CHAR_SPACE) cursor++;

  return cursor - lineStart;
};

export const isLineStart = (state: ParserState, position: number): boolean =>
  position === 0 || isLineBreak(state.source.charCodeAt(position - 1));

const isMarkerOf = (
  state: ParserState,
  position: number,
  markerCode: number
): boolean =>
  state.source.charCodeAt(position) === markerCode &&
  state.source.charCodeAt(position + 1) === markerCode &&
  state.source.charCodeAt(position + 2) === markerCode &&
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
  while (isSpaceOrTab(state.source.charCodeAt(state.position)))
    state.position++;
};

export const skipToLineEnd = (state: ParserState): void => {
  while (!isAtLineBreakOrEnd(state)) state.position++;
};

export const skipComment = (state: ParserState): void => {
  if (state.source.charCodeAt(state.position) !== CHAR_HASH) return;

  if (
    state.position > 0 &&
    !isBlank(state.source.charCodeAt(state.position - 1))
  )
    throw yamlError(
      state,
      'UNEXPECTED_CHARACTER',
      'A comment touches the content before it: expected a space or a tab before the "#"'
    );

  skipToLineEnd(state);
};

export const skipBlanksAndComments = (state: ParserState): void => {
  while (state.position < state.sourceLength) {
    const code = state.source.charCodeAt(state.position);

    if (code === CHAR_HASH) {
      skipComment(state);
      continue;
    }

    if (!isBlank(code)) return;

    state.position++;
  }
};

const skipTabbedBlankLine = (state: ParserState): boolean => {
  let cursor = state.position;

  while (isSpaceOrTab(state.source.charCodeAt(cursor))) cursor++;

  if (cursor < state.sourceLength) {
    const code = state.source.charCodeAt(cursor);

    if (code !== CHAR_HASH && !isLineBreak(code)) return false;
  }

  state.position = cursor;
  skipComment(state);

  return true;
};

export const skipNewlinesAndComments = (state: ParserState): number => {
  while (state.position < state.sourceLength) {
    const code = state.source.charCodeAt(state.position);

    if (isLineBreak(code)) {
      state.position++;
      continue;
    }

    const lineStart = state.position;

    state.position += countIndentSpaces(state, lineStart);

    if (state.position >= state.sourceLength) return 0;

    const contentCode = state.source.charCodeAt(state.position);

    if (isLineBreak(contentCode)) continue;

    if (contentCode === CHAR_HASH) {
      skipComment(state);
      continue;
    }

    if (contentCode === CHAR_TAB && skipTabbedBlankLine(state)) continue;

    return state.position - lineStart;
  }

  return 0;
};
