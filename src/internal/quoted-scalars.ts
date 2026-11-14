import type { YamlError } from '../error.js';
import type { ParserState } from '../types.js';
import {
  CHAR_BACKSLASH,
  CHAR_DOUBLE_QUOTE,
  CHAR_LOWER_U,
  CHAR_LOWER_X,
  CHAR_SINGLE_QUOTE,
  CHAR_UPPER_U,
  hexadecimalDigitValue,
  isLineBreak,
  isSpaceOrTab,
  LONE_SURROGATE,
  MAX_CODE_POINT,
} from './chars.js';
import { characterAt, quote, yamlError } from './errors.js';
import {
  countIndentSpaces,
  isAtLineBreakOrEnd,
  isDocumentMarker,
  lineBreakWidth,
  skipSpaces,
} from './navigation.js';

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  '0': '\x00',
  a: '\x07',
  b: '\b',
  t: '\t',
  '\t': '\t',
  n: '\n',
  v: '\v',
  f: '\f',
  r: '\r',
  e: '\x1b',
  ' ': ' ',
  '"': '"',
  '/': '/',
  '\\': '\\',
  N: '\u0085',
  _: '\u00a0',
  L: '\u2028',
  P: '\u2029',
};

const SIMPLE_ESCAPES_BY_CODE: (string | undefined)[] = Array.from(
  { length: 128 },
  (_, code) => SIMPLE_ESCAPES[String.fromCharCode(code)]
);

const rejectDocumentMarker = (state: ParserState): void => {
  if (isDocumentMarker(state, state.position))
    throw yamlError(
      state,
      'UNEXPECTED_DOCUMENT_MARKER',
      'A document marker interrupts a quoted scalar: expected the closing quote before the "---" or "..." line'
    );
};

const requireQuotedLineIndent = (
  state: ParserState,
  lineStart: number,
  ownerIndent: number
): void => {
  if (
    isAtLineBreakOrEnd(state) ||
    countIndentSpaces(state, lineStart) > ownerIndent
  )
    return;

  throw yamlError(
    state,
    'INVALID_INDENTATION',
    `A quoted scalar line is not indented past its block collection: expected more than ${ownerIndent} leading spaces`
  );
};

const foldQuotedLineBreaks = (
  state: ParserState,
  ownerIndent: number
): string => {
  let emptyLineCount = -1;
  let lineStart = state.position;

  while (state.position < state.sourceLength) {
    const code = state.source.charCodeAt(state.position);

    if (isLineBreak(code)) {
      state.position += lineBreakWidth(state, state.position);
      emptyLineCount++;
      lineStart = state.position;
      rejectDocumentMarker(state);
      continue;
    }

    if (!isSpaceOrTab(code)) break;

    state.position++;
  }

  requireQuotedLineIndent(state, lineStart, ownerIndent);

  return emptyLineCount > 0 ? '\n'.repeat(emptyLineCount) : ' ';
};

const foldQuotedLine = (
  state: ParserState,
  captureStart: number,
  ownerIndent: number
): string => {
  let captureEnd = state.position;

  while (
    captureEnd > captureStart &&
    isSpaceOrTab(state.source.charCodeAt(captureEnd - 1))
  )
    captureEnd--;

  return (
    state.source.slice(captureStart, captureEnd) +
    foldQuotedLineBreaks(state, ownerIndent)
  );
};

const truncatedEscapeError = (
  state: ParserState,
  escapeStart: number,
  width: number
): YamlError =>
  yamlError(
    state,
    'INVALID_ESCAPE',
    `The input ends inside the escape sequence ${quote(state.source.slice(escapeStart, state.position))}: expected ${width} more character${width === 1 ? '' : 's'}`,
    escapeStart
  );

const malformedEscapeError = (
  state: ParserState,
  escapeStart: number,
  width: number
): YamlError =>
  yamlError(
    state,
    'INVALID_ESCAPE',
    `The escape sequence ${quote(state.source.slice(escapeStart, state.position))} is malformed: expected exactly ${width} hexadecimal digits after it`,
    escapeStart
  );

const unknownEscapeError = (
  state: ParserState,
  escapeStart: number
): YamlError =>
  yamlError(
    state,
    'INVALID_ESCAPE',
    `Unknown escape sequence ${quote(`\\${characterAt(state, escapeStart + 1)}`)}: expected one of \\0 \\a \\b \\t \\n \\v \\f \\r \\e \\" \\/ \\\\ \\N \\_ \\L \\P, an escaped space, tab, or line break, or a \\x, \\u, or \\U hexadecimal escape`,
    escapeStart
  );

const requireEscapeWidth = (
  state: ParserState,
  escapeStart: number,
  width: number
): void => {
  if (state.position + width > state.sourceLength)
    throw truncatedEscapeError(state, escapeStart, width);
};

const readHexadecimalEscape = (
  state: ParserState,
  escapeStart: number,
  width: number
): number => {
  requireEscapeWidth(state, escapeStart, width);

  const digitsEnd = state.position + width;
  let value = 0;

  for (let index = state.position; index < digitsEnd; index++) {
    const digit = hexadecimalDigitValue(state.source.charCodeAt(index));

    if (digit === -1) throw malformedEscapeError(state, escapeStart, width);

    value = value * 16 + digit;
  }

  state.position = digitsEnd;

  return value;
};

const readUtf16Escapes = (state: ParserState, escapeStart: number): string => {
  let decoded = String.fromCharCode(
    readHexadecimalEscape(state, escapeStart, 4)
  );

  while (
    state.source.charCodeAt(state.position) === CHAR_BACKSLASH &&
    state.source.charCodeAt(state.position + 1) === CHAR_LOWER_U
  ) {
    const nextEscapeStart = state.position;

    state.position += 2;
    decoded += String.fromCharCode(
      readHexadecimalEscape(state, nextEscapeStart, 4)
    );
  }

  if (LONE_SURROGATE.test(decoded))
    throw yamlError(
      state,
      'INVALID_ESCAPE',
      'A "\\u" escape decodes to half of a surrogate pair: expected a high surrogate escape followed directly by a low surrogate escape',
      escapeStart
    );

  return decoded;
};

const readCodePointEscape = (
  state: ParserState,
  escapeStart: number
): string => {
  const codePoint = readHexadecimalEscape(state, escapeStart, 8);

  if (codePoint > MAX_CODE_POINT)
    throw yamlError(
      state,
      'INVALID_ESCAPE',
      `The "\\U" escape names 0x${codePoint.toString(16).toUpperCase()}: expected a code point no higher than 0x10FFFF`,
      escapeStart
    );

  const decoded = String.fromCodePoint(codePoint);

  if (LONE_SURROGATE.test(decoded))
    throw yamlError(
      state,
      'INVALID_ESCAPE',
      'The "\\U" escape names half of a surrogate pair: expected a code point outside 0xD800 to 0xDFFF',
      escapeStart
    );

  return decoded;
};

const readEscapedLineBreak = (
  state: ParserState,
  ownerIndent: number
): string => {
  state.position += lineBreakWidth(state, state.position);

  const lineStart = state.position;

  rejectDocumentMarker(state);
  skipSpaces(state);
  requireQuotedLineIndent(state, lineStart, ownerIndent);

  return '';
};

const readEscape = (state: ParserState, ownerIndent: number): string => {
  const escapeStart = state.position;

  state.position++;
  requireEscapeWidth(state, escapeStart, 1);

  const code = state.source.charCodeAt(state.position);

  if (isLineBreak(code)) return readEscapedLineBreak(state, ownerIndent);

  const simpleEscape = code < 128 ? SIMPLE_ESCAPES_BY_CODE[code] : undefined;

  state.position++;

  if (simpleEscape !== undefined) return simpleEscape;

  if (code === CHAR_LOWER_X)
    return String.fromCharCode(readHexadecimalEscape(state, escapeStart, 2));

  if (code === CHAR_LOWER_U) return readUtf16Escapes(state, escapeStart);

  if (code === CHAR_UPPER_U) return readCodePointEscape(state, escapeStart);

  throw unknownEscapeError(state, escapeStart);
};

export const parseSingleQuoted = (
  state: ParserState,
  ownerIndent: number
): string => {
  const openingQuote = state.position;

  state.position++;

  let result = '';
  let captureStart = state.position;

  while (state.position < state.sourceLength) {
    const code = state.source.charCodeAt(state.position);

    if (code !== CHAR_SINGLE_QUOTE && !isLineBreak(code)) {
      state.position++;
      continue;
    }

    if (code !== CHAR_SINGLE_QUOTE) {
      result += foldQuotedLine(state, captureStart, ownerIndent);
      captureStart = state.position;
      continue;
    }

    result += state.source.slice(captureStart, state.position);

    if (state.source.charCodeAt(state.position + 1) !== CHAR_SINGLE_QUOTE) {
      state.position++;
      return result;
    }

    result += "'";
    state.position += 2;
    captureStart = state.position;
  }

  throw yamlError(
    state,
    'UNTERMINATED_STRING',
    `Unterminated single-quoted scalar: expected a closing "'" before the end of input`,
    openingQuote
  );
};

export const parseDoubleQuoted = (
  state: ParserState,
  ownerIndent: number
): string => {
  const openingQuote = state.position;

  state.position++;

  let result = '';
  let captureStart = state.position;

  while (state.position < state.sourceLength) {
    const code = state.source.charCodeAt(state.position);

    if (
      code !== CHAR_DOUBLE_QUOTE &&
      code !== CHAR_BACKSLASH &&
      !isLineBreak(code)
    ) {
      state.position++;
      continue;
    }

    if (isLineBreak(code)) {
      result += foldQuotedLine(state, captureStart, ownerIndent);
      captureStart = state.position;
      continue;
    }

    result += state.source.slice(captureStart, state.position);

    if (code === CHAR_DOUBLE_QUOTE) {
      state.position++;
      return result;
    }

    result += readEscape(state, ownerIndent);
    captureStart = state.position;
  }

  throw yamlError(
    state,
    'UNTERMINATED_STRING',
    `Unterminated double-quoted scalar: expected a closing '"' before the end of input`,
    openingQuote
  );
};
