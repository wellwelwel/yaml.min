import type { BlockScalarHeader, ParserState } from '../types.js';
import {
  CHAR_0,
  CHAR_1,
  CHAR_9,
  CHAR_BACKSLASH,
  CHAR_COLON,
  CHAR_COMMA,
  CHAR_DOUBLE_QUOTE,
  CHAR_HASH,
  CHAR_LEFT_BRACE,
  CHAR_LEFT_BRACKET,
  CHAR_LOWER_U,
  CHAR_LOWER_X,
  CHAR_MINUS,
  CHAR_PIPE,
  CHAR_PLUS,
  CHAR_RIGHT_BRACE,
  CHAR_RIGHT_BRACKET,
  CHAR_SINGLE_QUOTE,
  CHAR_SPACE,
  CHAR_TAB,
  CHAR_UPPER_U,
  hexadecimalDigitValue,
  isBlank,
  isLineBreak,
  isSpaceOrTab,
  LONE_SURROGATE,
  MAX_CODE_POINT,
  SIMPLE_ESCAPE_MAP,
} from './chars.js';
import { syntaxError } from './errors.js';
import {
  countIndentSpaces,
  isAtLineBreakOrEnd,
  isBlankOrEnd,
  isDocumentMarker,
  lineBreakWidth,
  skipComment,
  skipSpaces,
} from './navigation.js';

const trimEnd = (text: string): string => {
  let cursor = text.length;

  while (cursor > 0 && isBlank(text.charCodeAt(cursor - 1))) cursor--;

  return cursor < text.length ? text.slice(0, cursor) : text;
};

const rejectDocumentMarker = (state: ParserState): void => {
  if (isDocumentMarker(state, state.pos))
    throw syntaxError(
      state,
      'A document marker interrupts a quoted scalar: expected the closing quote before the "---" or "..." line'
    );
};

const foldQuotedLineBreaks = (state: ParserState): string => {
  let emptyLineCount = -1;

  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (isLineBreak(code)) {
      state.pos += lineBreakWidth(state, state.pos);
      emptyLineCount++;
      rejectDocumentMarker(state);
      continue;
    }

    if (!isSpaceOrTab(code)) break;

    state.pos++;
  }

  return emptyLineCount > 0 ? '\n'.repeat(emptyLineCount) : ' ';
};

const requireEscapeWidth = (
  state: ParserState,
  escapeStart: number,
  width: number
): void => {
  if (state.pos + width <= state.len) return;

  throw syntaxError(
    state,
    `The input ends inside the escape sequence "${state.src.slice(escapeStart, state.pos)}": expected ${width} more character${width === 1 ? '' : 's'}`,
    escapeStart
  );
};

const readHexEscape = (
  state: ParserState,
  escapeStart: number,
  width: number
): number => {
  requireEscapeWidth(state, escapeStart, width);

  const digitsEnd = state.pos + width;
  let value = 0;

  for (let index = state.pos; index < digitsEnd; index++) {
    const digit = hexadecimalDigitValue(state.src.charCodeAt(index));

    if (digit === -1)
      throw syntaxError(
        state,
        `The escape sequence "${state.src.slice(escapeStart, state.pos)}" is malformed: expected exactly ${width} hexadecimal digits after it`,
        escapeStart
      );

    value = value * 16 + digit;
  }

  state.pos = digitsEnd;

  return value;
};

const readUtf16Escapes = (state: ParserState, escapeStart: number): string => {
  let decoded = String.fromCharCode(readHexEscape(state, escapeStart, 4));

  while (
    state.src.charCodeAt(state.pos) === CHAR_BACKSLASH &&
    state.src.charCodeAt(state.pos + 1) === CHAR_LOWER_U
  ) {
    const nextEscapeStart = state.pos;

    state.pos += 2;
    decoded += String.fromCharCode(readHexEscape(state, nextEscapeStart, 4));
  }

  if (LONE_SURROGATE.test(decoded))
    throw syntaxError(
      state,
      'A "\\u" escape decodes to half of a surrogate pair: expected a high surrogate escape followed directly by a low surrogate escape',
      escapeStart
    );

  return decoded;
};

const readCodePointEscape = (
  state: ParserState,
  escapeStart: number
): string => {
  const codePoint = readHexEscape(state, escapeStart, 8);

  if (codePoint > MAX_CODE_POINT)
    throw syntaxError(
      state,
      `The "\\U" escape names 0x${codePoint.toString(16).toUpperCase()}: expected a code point no higher than 0x10FFFF`,
      escapeStart
    );

  const decoded = String.fromCodePoint(codePoint);

  if (LONE_SURROGATE.test(decoded))
    throw syntaxError(
      state,
      'The "\\U" escape names half of a surrogate pair: expected a code point outside 0xD800 to 0xDFFF',
      escapeStart
    );

  return decoded;
};

const readEscapedLineBreak = (state: ParserState): string => {
  state.pos += lineBreakWidth(state, state.pos);

  rejectDocumentMarker(state);
  skipSpaces(state);

  return '';
};

const readEscape = (state: ParserState): string => {
  const escapeStart = state.pos;

  state.pos++;
  requireEscapeWidth(state, escapeStart, 1);

  const code = state.src.charCodeAt(state.pos);

  if (isLineBreak(code)) return readEscapedLineBreak(state);

  const simpleEscape = code < 128 ? SIMPLE_ESCAPE_MAP[code] : undefined;

  state.pos++;

  if (simpleEscape !== undefined) return simpleEscape;

  if (code === CHAR_LOWER_X)
    return String.fromCharCode(readHexEscape(state, escapeStart, 2));

  if (code === CHAR_LOWER_U) return readUtf16Escapes(state, escapeStart);

  if (code === CHAR_UPPER_U) return readCodePointEscape(state, escapeStart);

  throw syntaxError(
    state,
    `Unknown escape sequence "\\${state.src.charAt(escapeStart + 1)}": expected one of \\0 \\a \\b \\t \\n \\v \\f \\r \\e \\" \\/ \\\\ \\N \\_ \\L \\P, an escaped space, tab, or line break, or a \\x, \\u, or \\U hexadecimal escape`,
    escapeStart
  );
};

export const parseSingleQuoted = (state: ParserState): string => {
  const openingQuote = state.pos;

  state.pos++;

  let result = '';
  let captureStart = state.pos;

  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (code !== CHAR_SINGLE_QUOTE && !isLineBreak(code)) {
      state.pos++;
      continue;
    }

    result += state.src.slice(captureStart, state.pos);

    if (code !== CHAR_SINGLE_QUOTE) {
      result += foldQuotedLineBreaks(state);
      captureStart = state.pos;
      continue;
    }

    if (state.src.charCodeAt(state.pos + 1) !== CHAR_SINGLE_QUOTE) {
      state.pos++;
      return result;
    }

    result += "'";
    state.pos += 2;
    captureStart = state.pos;
  }

  throw syntaxError(
    state,
    `Unterminated single-quoted scalar: expected a closing "'" before the end of input`,
    openingQuote
  );
};

export const parseDoubleQuoted = (state: ParserState): string => {
  const openingQuote = state.pos;

  state.pos++;

  let result = '';
  let captureStart = state.pos;

  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (
      code !== CHAR_DOUBLE_QUOTE &&
      code !== CHAR_BACKSLASH &&
      !isLineBreak(code)
    ) {
      state.pos++;
      continue;
    }

    result += state.src.slice(captureStart, state.pos);

    if (code === CHAR_DOUBLE_QUOTE) {
      state.pos++;
      return result;
    }

    result +=
      code === CHAR_BACKSLASH ? readEscape(state) : foldQuotedLineBreaks(state);
    captureStart = state.pos;
  }

  throw syntaxError(
    state,
    `Unterminated double-quoted scalar: expected a closing '"' before the end of input`,
    openingQuote
  );
};

const foldBlockLines = (contentLines: string[]): string => {
  let result = '';
  let previousLineMoreIndented = false;

  for (let lineIndex = 0; lineIndex < contentLines.length; lineIndex++) {
    const line = contentLines[lineIndex];

    if (line === '') {
      result += '\n';
      continue;
    }

    if (isSpaceOrTab(line.charCodeAt(0))) {
      if (result.length > 0 && !result.endsWith('\n')) result += '\n';
      result += line;
      if (lineIndex < contentLines.length - 1) result += '\n';
      previousLineMoreIndented = true;
      continue;
    }

    if (previousLineMoreIndented) result += '\n';
    else if (lineIndex > 0 && contentLines[lineIndex - 1] !== '') result += ' ';

    result += line;
    previousLineMoreIndented = false;
  }

  return result;
};

const detectContentIndent = (state: ParserState): number => {
  let cursor = state.pos;

  while (cursor < state.len) {
    const lineStart = cursor;

    cursor += countIndentSpaces(state, lineStart);

    if (cursor >= state.len) return -1;

    const code = state.src.charCodeAt(cursor);

    if (!isLineBreak(code))
      return isDocumentMarker(state, lineStart) ? -1 : cursor - lineStart;

    cursor += lineBreakWidth(state, cursor);
  }

  return -1;
};

const readBlockScalarHeader = (state: ParserState): BlockScalarHeader => {
  let chomp: BlockScalarHeader['chomp'] = '';
  let explicitIndent = 0;

  while (state.pos < state.len) {
    const headerCode = state.src.charCodeAt(state.pos);
    const isChomp = headerCode === CHAR_MINUS || headerCode === CHAR_PLUS;
    const isIndent = headerCode >= CHAR_1 && headerCode <= CHAR_9;

    if (!(isChomp || isIndent)) break;

    if ((isChomp && chomp !== '') || (isIndent && explicitIndent !== 0))
      throw syntaxError(
        state,
        'A block scalar header repeats an indicator: expected at most one chomping indicator ("+" or "-") and one indentation digit from 1 to 9'
      );

    if (isChomp) chomp = headerCode === CHAR_MINUS ? '-' : '+';
    else explicitIndent = headerCode - CHAR_0;

    state.pos++;
  }

  const indicatorsEnd = state.pos;

  skipSpaces(state);

  if (state.pos > indicatorsEnd) skipComment(state);

  if (!isAtLineBreakOrEnd(state))
    throw syntaxError(
      state,
      'A block scalar header holds an unexpected character: expected only a chomping indicator ("+" or "-"), an indentation digit from 1 to 9, and an optional comment'
    );

  if (state.pos < state.len) state.pos += lineBreakWidth(state, state.pos);

  return { chomp, explicitIndent };
};

const readBlockScalarLines = (
  state: ParserState,
  contentIndent: number
): string[] => {
  const lines: string[] = [];

  while (state.pos < state.len) {
    const lineStart = state.pos;
    const spaces = countIndentSpaces(state, lineStart);

    state.pos += spaces;

    if (state.pos >= state.len) {
      lines.push('');
      break;
    }

    if (isAtLineBreakOrEnd(state)) {
      lines.push('');
      state.pos += lineBreakWidth(state, state.pos);
      continue;
    }

    if (spaces < contentIndent || isDocumentMarker(state, lineStart)) {
      state.pos = lineStart;
      break;
    }

    const prefix =
      spaces > contentIndent ? ' '.repeat(spaces - contentIndent) : '';
    const lineContentStart = state.pos;

    while (!isAtLineBreakOrEnd(state)) state.pos++;

    lines.push(prefix + state.src.slice(lineContentStart, state.pos));

    if (state.pos < state.len) state.pos += lineBreakWidth(state, state.pos);
  }

  return lines;
};

export const parseBlockScalar = (
  state: ParserState,
  parentIndent: number
): string => {
  const isLiteral = state.src.charCodeAt(state.pos) === CHAR_PIPE;

  state.pos++;

  const { chomp, explicitIndent } = readBlockScalarHeader(state);
  const contentIndent =
    explicitIndent > 0
      ? Math.max(parentIndent, 0) + explicitIndent
      : detectContentIndent(state);

  if (contentIndent <= parentIndent) return chomp === '+' ? '\n' : '';

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
  const content = isLiteral
    ? contentLines.join('\n')
    : foldBlockLines(contentLines);

  if (chomp === '-') return content;
  if (chomp === '+') return `${content}\n${'\n'.repeat(trailingEmptyLines)}`;
  return `${content}\n`;
};

const endsPlainScalarAtColon = (
  state: ParserState,
  colonPosition: number,
  inFlow: boolean
): boolean => {
  if (!inFlow) return isBlankOrEnd(state, colonPosition + 1);
  if (colonPosition + 1 >= state.len) return true;

  const afterColon = state.src.charCodeAt(colonPosition + 1);

  return (
    afterColon === CHAR_SPACE ||
    afterColon === CHAR_COMMA ||
    afterColon === CHAR_RIGHT_BRACKET ||
    afterColon === CHAR_RIGHT_BRACE
  );
};

const isFlowIndicator = (code: number): boolean =>
  code === CHAR_COMMA ||
  code === CHAR_RIGHT_BRACKET ||
  code === CHAR_RIGHT_BRACE ||
  code === CHAR_LEFT_BRACE ||
  code === CHAR_LEFT_BRACKET;

export const findPlainLineEnd = (
  state: ParserState,
  start: number,
  inFlow: boolean
): number => {
  let cursor = start;

  while (cursor < state.len) {
    const code = state.src.charCodeAt(cursor);

    if (isLineBreak(code)) break;

    if (code === CHAR_HASH && isSpaceOrTab(state.src.charCodeAt(cursor - 1)))
      break;

    if (code === CHAR_COLON && endsPlainScalarAtColon(state, cursor, inFlow))
      break;

    if (inFlow && isFlowIndicator(code)) break;

    cursor++;
  }

  return cursor;
};

const capturePlainLine = (state: ParserState, inFlow: boolean): string => {
  const captureStart = state.pos;

  state.pos = findPlainLineEnd(state, captureStart, inFlow);

  return state.src.slice(captureStart, state.pos);
};

const isPlainContinuation = (
  state: ParserState,
  lineStart: number,
  contentStart: number,
  ownerIndent: number,
  inFlow: boolean
): boolean => {
  if (contentStart >= state.len) return false;

  const code = state.src.charCodeAt(contentStart);

  if (code === CHAR_HASH || isDocumentMarker(state, lineStart)) return false;

  if (code === CHAR_COLON && isBlankOrEnd(state, contentStart + 1))
    return false;

  if (
    inFlow &&
    (code === CHAR_COMMA ||
      code === CHAR_RIGHT_BRACKET ||
      code === CHAR_RIGHT_BRACE)
  )
    return false;

  const indent = countIndentSpaces(state, lineStart);

  if (indent > ownerIndent) return true;

  if (inFlow)
    throw syntaxError(
      state,
      `A flow collection line is not indented past its block collection: expected more than ${ownerIndent} leading spaces`,
      contentStart
    );

  if (state.src.charCodeAt(lineStart + indent) === CHAR_TAB)
    throw syntaxError(
      state,
      'A tab indents a plain scalar line: expected spaces, since YAML forbids tabs as indentation',
      lineStart + indent
    );

  return false;
};

export const parsePlainKey = (state: ParserState): string =>
  trimEnd(capturePlainLine(state, false));

export const parsePlainScalar = (
  state: ParserState,
  ownerIndent: number,
  inFlow: boolean
): string => {
  let result = capturePlainLine(state, inFlow);

  while (state.pos < state.len) {
    if (!isLineBreak(state.src.charCodeAt(state.pos))) break;

    let cursor = state.pos;
    let lineStart = cursor;
    let emptyLineCount = -1;

    do {
      cursor += lineBreakWidth(state, cursor);
      emptyLineCount++;
      lineStart = cursor;

      while (isSpaceOrTab(state.src.charCodeAt(cursor))) cursor++;
    } while (isLineBreak(state.src.charCodeAt(cursor)));

    if (!isPlainContinuation(state, lineStart, cursor, ownerIndent, inFlow))
      break;

    result = `${trimEnd(result)}${emptyLineCount > 0 ? '\n'.repeat(emptyLineCount) : ' '}`;
    state.pos = cursor;
    result += capturePlainLine(state, inFlow);
  }

  return trimEnd(result);
};
