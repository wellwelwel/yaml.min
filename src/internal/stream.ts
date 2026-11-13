import type { ParserState } from '../types.js';
import { parseValue } from './block.js';
import {
  CHAR_BYTE_ORDER_MARK,
  CHAR_LINE_FEED,
  CHAR_PERCENT,
  NON_PRINTABLE,
} from './chars.js';
import { syntaxError } from './errors.js';
import {
  isAtLineBreakOrEnd,
  isDocumentEnd,
  isDocumentMarker,
  isDocumentStart,
  skipBlanksAndComments,
  skipComment,
  skipNewlinesAndComments,
  skipSpaces,
} from './navigation.js';
import { isTagDirective, readTagDirective } from './tags.js';

const rejectNonPrintable = (state: ParserState): void => {
  const match = NON_PRINTABLE.exec(state.src);

  if (match === null) return;

  const position = match.index + match[0].length - 1;
  const codeUnit = state.src
    .charCodeAt(position)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');

  throw syntaxError(
    state,
    `The input holds the non-printable character U+${codeUnit}: expected printable characters, tabs, and line breaks only`,
    position
  );
};

export const createParserState = (input: string): ParserState => {
  if (typeof input !== 'string')
    throw new TypeError(
      'The input is not a string: expected a string holding the YAML source'
    );

  const src =
    input.charCodeAt(0) === CHAR_BYTE_ORDER_MARK ? input.slice(1) : input;
  const state: ParserState = {
    src,
    len: src.length,
    pos: 0,
    depth: 0,
    anchors: { nodes: new Map(), expansion: 0 },
    tagHandles: new Map(),
  };

  rejectNonPrintable(state);

  return state;
};

const skipMarkerLine = (state: ParserState): void => {
  state.pos += 3;

  skipSpaces(state);
  skipComment(state);
};

const closeDocument = (state: ParserState): void => {
  skipBlanksAndComments(state);

  if (state.pos >= state.len || isDocumentStart(state, state.pos)) return;

  if (!isDocumentEnd(state, state.pos))
    throw syntaxError(
      state,
      'Unexpected content after the end of the document: expected the end of input, "---" to start a new document, or "..." to end this one'
    );

  skipMarkerLine(state);

  if (!isAtLineBreakOrEnd(state))
    throw syntaxError(
      state,
      'Unexpected content after "...": expected a comment or the end of the line'
    );
};

export const skipToDocument = (state: ParserState): boolean => {
  state.tagHandles.clear();

  while (state.pos < state.len) {
    const lineIndent = skipNewlinesAndComments(state);

    if (state.pos >= state.len) return false;

    if (state.src.charCodeAt(state.pos) !== CHAR_PERCENT) {
      state.pos -= lineIndent;
      return true;
    }

    if (lineIndent === 0 && isTagDirective(state)) {
      readTagDirective(state);
      continue;
    }

    while (
      state.pos < state.len &&
      state.src.charCodeAt(state.pos) !== CHAR_LINE_FEED
    )
      state.pos++;
  }

  return false;
};

export const readDocument = (state: ParserState): unknown => {
  state.anchors.nodes.clear();

  if (isDocumentStart(state, state.pos)) skipMarkerLine(state);

  const lineIndent = skipNewlinesAndComments(state);
  const value =
    state.pos >= state.len || isDocumentMarker(state, state.pos)
      ? null
      : parseValue(state, -1, lineIndent, false, undefined);

  closeDocument(state);

  return value;
};
