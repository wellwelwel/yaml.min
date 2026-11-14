import type { BlockScalarHeader, ParserState } from '../types.js';
import {
  CHAR_0,
  CHAR_1,
  CHAR_9,
  CHAR_MINUS,
  CHAR_PIPE,
  CHAR_PLUS,
  CHAR_TAB,
  isLineBreak,
  isSpaceOrTab,
} from './chars.js';
import { yamlError } from './errors.js';
import {
  countIndentSpaces,
  isAtLineBreakOrEnd,
  isDocumentBoundary,
  lineBreakWidth,
  skipComment,
  skipSpaces,
  skipToLineEnd,
} from './navigation.js';

const foldBlockLines = (contentLines: string[]): string => {
  let result = '';
  let emptyLineCount = 0;
  let hasText = false;
  let previousLineMoreIndented = false;

  for (const line of contentLines) {
    if (line === '') {
      emptyLineCount++;
      continue;
    }

    const isMoreIndented = isSpaceOrTab(line.charCodeAt(0));

    if (isMoreIndented || previousLineMoreIndented)
      result += '\n'.repeat(hasText ? emptyLineCount + 1 : emptyLineCount);
    else if (emptyLineCount > 0) result += '\n'.repeat(emptyLineCount);
    else if (hasText) result += ' ';

    result += line;
    emptyLineCount = 0;
    hasText = true;
    previousLineMoreIndented = isMoreIndented;
  }

  return result;
};

const detectContentIndent = (
  state: ParserState,
  parentIndent: number
): number => {
  let cursor = state.position;
  let widestBlankLineStart = cursor;
  let widestBlankLineIndent = 0;

  while (cursor < state.sourceLength) {
    const lineStart = cursor;
    const indent = countIndentSpaces(state, lineStart);

    cursor += indent;

    if (cursor >= state.sourceLength) return -1;

    const code = state.source.charCodeAt(cursor);

    if (isLineBreak(code)) {
      if (indent > widestBlankLineIndent) {
        widestBlankLineIndent = indent;
        widestBlankLineStart = lineStart;
      }

      cursor += lineBreakWidth(state, cursor);
      continue;
    }

    if (isDocumentBoundary(state, lineStart)) return -1;

    if (indent <= parentIndent) {
      if (code === CHAR_TAB)
        throw yamlError(
          state,
          'INVALID_INDENTATION',
          'A tab indents a block scalar line: expected spaces, since YAML forbids tabs as indentation',
          cursor
        );

      return -1;
    }

    if (indent < widestBlankLineIndent)
      throw yamlError(
        state,
        'INVALID_INDENTATION',
        `A leading empty line of a block scalar holds ${widestBlankLineIndent} spaces, more than the ${indent} that indent its first content line: expected at most ${indent} spaces, or an indentation indicator in the header`,
        widestBlankLineStart
      );

    return indent;
  }

  return -1;
};

const countBlankBlockLines = (state: ParserState): number => {
  let cursor = state.position;
  let blankLineCount = 0;

  while (cursor < state.sourceLength) {
    cursor += countIndentSpaces(state, cursor);

    if (cursor >= state.sourceLength) return blankLineCount + 1;
    if (!isLineBreak(state.source.charCodeAt(cursor))) break;

    cursor += lineBreakWidth(state, cursor);
    blankLineCount++;
  }

  return blankLineCount;
};

const readBlockScalarHeader = (state: ParserState): BlockScalarHeader => {
  let chomp: BlockScalarHeader['chomp'] = '';
  let explicitIndent = 0;

  while (state.position < state.sourceLength) {
    const headerCode = state.source.charCodeAt(state.position);
    const isChomp = headerCode === CHAR_MINUS || headerCode === CHAR_PLUS;
    const isIndent = headerCode >= CHAR_1 && headerCode <= CHAR_9;

    if (!(isChomp || isIndent)) break;

    if ((isChomp && chomp !== '') || (isIndent && explicitIndent !== 0))
      throw yamlError(
        state,
        'INVALID_BLOCK_SCALAR_HEADER',
        'A block scalar header repeats an indicator: expected at most one chomping indicator ("+" or "-") and one indentation digit from 1 to 9'
      );

    if (isChomp) chomp = headerCode === CHAR_MINUS ? '-' : '+';
    else explicitIndent = headerCode - CHAR_0;

    state.position++;
  }

  const indicatorsEnd = state.position;

  skipSpaces(state);

  if (state.position > indicatorsEnd) skipComment(state);

  if (!isAtLineBreakOrEnd(state))
    throw yamlError(
      state,
      'INVALID_BLOCK_SCALAR_HEADER',
      'A block scalar header holds an unexpected character: expected only a chomping indicator ("+" or "-"), an indentation digit from 1 to 9, and an optional comment'
    );

  if (state.position < state.sourceLength)
    state.position += lineBreakWidth(state, state.position);

  return { chomp, explicitIndent };
};

const readBlockScalarLines = (
  state: ParserState,
  contentIndent: number
): string[] => {
  const lines: string[] = [];

  while (state.position < state.sourceLength) {
    const lineStart = state.position;
    const spaces = countIndentSpaces(state, lineStart);

    state.position += spaces;

    if (state.position >= state.sourceLength) {
      if (spaces > contentIndent)
        lines.push(state.source.slice(lineStart + contentIndent));
      break;
    }

    if (isAtLineBreakOrEnd(state)) {
      lines.push(
        spaces > contentIndent
          ? state.source.slice(lineStart + contentIndent, state.position)
          : ''
      );
      state.position += lineBreakWidth(state, state.position);
      continue;
    }

    if (spaces < contentIndent || isDocumentBoundary(state, lineStart)) {
      state.position = lineStart;
      break;
    }

    skipToLineEnd(state);

    lines.push(state.source.slice(lineStart + contentIndent, state.position));

    if (state.position < state.sourceLength)
      state.position += lineBreakWidth(state, state.position);
  }

  return lines;
};

export const parseBlockScalar = (
  state: ParserState,
  parentIndent: number
): string => {
  const isLiteral = state.source.charCodeAt(state.position) === CHAR_PIPE;

  state.position++;

  const { chomp, explicitIndent } = readBlockScalarHeader(state);
  const contentIndent =
    explicitIndent > 0
      ? Math.max(parentIndent, 0) + explicitIndent
      : detectContentIndent(state, parentIndent);

  if (contentIndent <= parentIndent)
    return chomp === '+' ? '\n'.repeat(countBlankBlockLines(state)) : '';

  const lines = readBlockScalarLines(state, contentIndent);
  let trailingEmptyLines = 0;

  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    if (lines[lineIndex] === '') trailingEmptyLines++;
    else break;
  }

  const contentLines =
    trailingEmptyLines > 0
      ? lines.slice(0, lines.length - trailingEmptyLines)
      : lines;

  if (contentLines.length === 0)
    return chomp === '+' ? '\n'.repeat(trailingEmptyLines) : '';

  const content = isLiteral
    ? contentLines.join('\n')
    : foldBlockLines(contentLines);

  if (chomp === '-') return content;
  if (chomp === '+') return `${content}\n${'\n'.repeat(trailingEmptyLines)}`;

  return `${content}\n`;
};
