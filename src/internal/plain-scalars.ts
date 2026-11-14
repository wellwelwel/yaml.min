import type { YamlError } from '../error.js';
import type { ParserState } from '../types.js';
import {
  CHAR_COLON,
  CHAR_HASH,
  CHAR_MINUS,
  CHAR_QUESTION,
  CHAR_SPACE,
  CHAR_TAB,
  isBlank,
  isFlowEntryEnd,
  isFlowIndicator,
  isIndicator,
  isLineBreak,
  isSpaceOrTab,
} from './chars.js';
import { characterAt, quote, yamlError } from './errors.js';
import {
  countIndentSpaces,
  isBlankOrEnd,
  isDocumentMarker,
  lineBreakWidth,
} from './navigation.js';

const trimEnd = (text: string): string => {
  let cursor = text.length;

  while (cursor > 0 && isBlank(text.charCodeAt(cursor - 1))) cursor--;

  return cursor < text.length ? text.slice(0, cursor) : text;
};

const endsPlainScalarAtColon = (
  state: ParserState,
  colonPosition: number,
  inFlow: boolean
): boolean => {
  if (!inFlow) return isBlankOrEnd(state, colonPosition + 1);
  if (colonPosition + 1 >= state.sourceLength) return true;

  const afterColon = state.source.charCodeAt(colonPosition + 1);

  return afterColon === CHAR_SPACE || isFlowEntryEnd(afterColon);
};

export const findPlainLineEnd = (
  state: ParserState,
  start: number,
  inFlow: boolean
): number => {
  let cursor = start;

  while (cursor < state.sourceLength) {
    const code = state.source.charCodeAt(cursor);

    if (isLineBreak(code)) break;

    if (code === CHAR_HASH && isSpaceOrTab(state.source.charCodeAt(cursor - 1)))
      break;

    if (code === CHAR_COLON && endsPlainScalarAtColon(state, cursor, inFlow))
      break;

    if (inFlow && isFlowIndicator(code)) break;

    cursor++;
  }

  return cursor;
};

const capturePlainLine = (state: ParserState, inFlow: boolean): string => {
  const captureStart = state.position;

  state.position = findPlainLineEnd(state, captureStart, inFlow);

  return state.source.slice(captureStart, state.position);
};

const isIndicatorSeparatorAt = (
  state: ParserState,
  position: number,
  inFlow: boolean
): boolean =>
  isBlankOrEnd(state, position) ||
  (inFlow && isFlowIndicator(state.source.charCodeAt(position)));

const isSeparableIndicator = (code: number): boolean =>
  code === CHAR_MINUS || code === CHAR_QUESTION || code === CHAR_COLON;

const capturePlainStart = (state: ParserState, inFlow: boolean): string => {
  const code = state.source.charCodeAt(state.position);

  if (!isIndicator(code)) return capturePlainLine(state, inFlow);
  if (
    isSeparableIndicator(code) &&
    !isIndicatorSeparatorAt(state, state.position + 1, inFlow)
  )
    return capturePlainLine(state, inFlow);
  if (code === CHAR_COLON || code === CHAR_HASH) return '';

  throw yamlError(
    state,
    'UNEXPECTED_CHARACTER',
    `A plain scalar starts with the indicator ${quote(characterAt(state, state.position))}: expected the scalar quoted, or text that does not start with an indicator`
  );
};

export const unindentedFlowLineError = (
  state: ParserState,
  ownerIndent: number,
  position: number
): YamlError =>
  yamlError(
    state,
    'INVALID_INDENTATION',
    `A flow collection line is not indented past its block collection: expected more than ${ownerIndent} leading spaces`,
    position
  );

const isPlainContinuation = (
  state: ParserState,
  lineStart: number,
  contentStart: number,
  ownerIndent: number,
  inFlow: boolean
): boolean => {
  if (contentStart >= state.sourceLength) return false;

  const code = state.source.charCodeAt(contentStart);

  if (code === CHAR_HASH || isDocumentMarker(state, lineStart)) return false;

  if (code === CHAR_COLON && isBlankOrEnd(state, contentStart + 1))
    return false;

  if (inFlow && isFlowEntryEnd(code)) return false;

  const indent = countIndentSpaces(state, lineStart);

  if (indent > ownerIndent) return true;

  if (inFlow) throw unindentedFlowLineError(state, ownerIndent, contentStart);

  if (state.source.charCodeAt(lineStart + indent) === CHAR_TAB)
    throw yamlError(
      state,
      'INVALID_INDENTATION',
      'A tab indents a plain scalar line: expected spaces, since YAML forbids tabs as indentation',
      lineStart + indent
    );

  return false;
};

export const parsePlainKey = (state: ParserState): string =>
  trimEnd(capturePlainStart(state, false));

export const parsePlainScalar = (
  state: ParserState,
  ownerIndent: number,
  inFlow: boolean
): string => {
  let result = trimEnd(capturePlainStart(state, inFlow));

  while (state.position < state.sourceLength) {
    if (!isLineBreak(state.source.charCodeAt(state.position))) break;

    let cursor = state.position;
    let lineStart = cursor;
    let emptyLineCount = -1;

    do {
      cursor += lineBreakWidth(state, cursor);
      emptyLineCount++;
      lineStart = cursor;

      while (isSpaceOrTab(state.source.charCodeAt(cursor))) cursor++;
    } while (isLineBreak(state.source.charCodeAt(cursor)));

    if (!isPlainContinuation(state, lineStart, cursor, ownerIndent, inFlow))
      break;

    state.position = cursor;

    const line = trimEnd(capturePlainLine(state, inFlow));

    if (line === '') break;

    result += `${emptyLineCount > 0 ? '\n'.repeat(emptyLineCount) : ' '}${line}`;
  }

  return result;
};
