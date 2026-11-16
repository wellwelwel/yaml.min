import type { YamlError } from '../error.js';
import type { ParserState } from '../types.js';
import {
  CHAR_COLON,
  CHAR_HASH,
  CHAR_MINUS,
  CHAR_QUESTION,
  CHAR_TAB,
  isFlowEntryEnd,
  isFlowIndicator,
  isIndicator,
  isLineBreak,
  isListed,
  isSpaceOrTab,
  PLAIN_LINE_END_CANDIDATES,
} from './chars.js';
import { characterAt, quote, yamlError } from './errors.js';
import {
  countIndentSpaces,
  isBlankOrEnd,
  isDocumentBoundary,
  isValueIndicator,
  lineBreakWidth,
  skipSpacesFrom,
  sliceBeforeTrailingSpaces,
} from './navigation.js';

const endsPlainLine = (
  state: ParserState,
  candidate: number,
  inFlow: boolean
): boolean => {
  const code = state.source.charCodeAt(candidate);

  if (isLineBreak(code)) return true;
  if (code === CHAR_HASH)
    return isSpaceOrTab(state.source.charCodeAt(candidate - 1));
  if (code === CHAR_COLON) return isValueIndicator(state, candidate, inFlow);

  return inFlow;
};

const findPlainLineEndCandidate = (
  state: ParserState,
  from: number
): number => {
  let cursor = from;

  while (
    cursor < state.sourceLength &&
    !isListed(PLAIN_LINE_END_CANDIDATES, state.source.charCodeAt(cursor))
  )
    cursor++;

  return cursor;
};

const scanPlainLine = (
  state: ParserState,
  start: number,
  inFlow: boolean
): number => {
  let cursor = findPlainLineEndCandidate(state, start);

  while (cursor < state.sourceLength && !endsPlainLine(state, cursor, inFlow))
    cursor = findPlainLineEndCandidate(state, cursor + 1);

  return cursor;
};

const findBlockPlainLineEnd = (state: ParserState, start: number): number => {
  if (start === state.lastPlainLineStart) return state.lastPlainLineEnd;

  const end = scanPlainLine(state, start, false);

  state.lastPlainLineStart = start;
  state.lastPlainLineEnd = end;

  return end;
};

export const findPlainLineEnd = (
  state: ParserState,
  start: number,
  inFlow: boolean
): number =>
  inFlow
    ? scanPlainLine(state, start, true)
    : findBlockPlainLineEnd(state, start);

const capturePlainLine = (state: ParserState, inFlow: boolean): string => {
  const captureStart = state.position;

  state.position = findPlainLineEnd(state, captureStart, inFlow);

  return sliceBeforeTrailingSpaces(state, captureStart, state.position);
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

  if (code === CHAR_HASH || isDocumentBoundary(state, lineStart)) return false;

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
  capturePlainStart(state, false);

export const parsePlainScalar = (
  state: ParserState,
  ownerIndent: number,
  inFlow: boolean
): string => {
  let result = capturePlainStart(state, inFlow);

  while (state.position < state.sourceLength) {
    if (!isLineBreak(state.source.charCodeAt(state.position))) break;

    let cursor = state.position;
    let lineStart: number;
    let emptyLineCount = -1;

    do {
      cursor += lineBreakWidth(state, cursor);
      emptyLineCount++;
      lineStart = cursor;
      cursor = skipSpacesFrom(
        state,
        lineStart + countIndentSpaces(state, lineStart)
      );
    } while (
      cursor < state.sourceLength &&
      isLineBreak(state.source.charCodeAt(cursor))
    );

    if (!isPlainContinuation(state, lineStart, cursor, ownerIndent, inFlow))
      break;

    state.position = cursor;

    const line = capturePlainLine(state, inFlow);

    if (line === '') break;

    result += `${emptyLineCount > 0 ? '\n'.repeat(emptyLineCount) : ' '}${line}`;
  }

  return result;
};
