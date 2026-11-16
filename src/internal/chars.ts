export const CHAR_BYTE_ORDER_MARK = 0xfeff;
export const CHAR_TAB = 0x09;
export const CHAR_LINE_FEED = 0x0a;
export const CHAR_CARRIAGE_RETURN = 0x0d;
export const CHAR_SPACE = 0x20;
export const CHAR_EXCLAMATION = 0x21;
export const CHAR_DOUBLE_QUOTE = 0x22;
export const CHAR_HASH = 0x23;
export const CHAR_PERCENT = 0x25;
export const CHAR_AMPERSAND = 0x26;
export const CHAR_SINGLE_QUOTE = 0x27;
export const CHAR_STAR = 0x2a;
export const CHAR_PLUS = 0x2b;
export const CHAR_COMMA = 0x2c;
export const CHAR_MINUS = 0x2d;
export const CHAR_DOT = 0x2e;
export const CHAR_0 = 0x30;
export const CHAR_1 = 0x31;
export const CHAR_9 = 0x39;
export const CHAR_COLON = 0x3a;
export const CHAR_LESS_THAN = 0x3c;
export const CHAR_GREATER_THAN = 0x3e;
export const CHAR_QUESTION = 0x3f;
const CHAR_UPPER_A = 0x41;
export const CHAR_UPPER_F = 0x46;
export const CHAR_UPPER_N = 0x4e;
export const CHAR_UPPER_T = 0x54;
export const CHAR_UPPER_U = 0x55;
export const CHAR_LEFT_BRACKET = 0x5b;
export const CHAR_BACKSLASH = 0x5c;
export const CHAR_RIGHT_BRACKET = 0x5d;
const CHAR_LOWER_A = 0x61;
export const CHAR_LOWER_F = 0x66;
export const CHAR_LOWER_N = 0x6e;
export const CHAR_LOWER_O = 0x6f;
export const CHAR_LOWER_T = 0x74;
export const CHAR_LOWER_U = 0x75;
export const CHAR_LOWER_X = 0x78;
export const CHAR_LEFT_BRACE = 0x7b;
export const CHAR_PIPE = 0x7c;
export const CHAR_RIGHT_BRACE = 0x7d;
export const CHAR_TILDE = 0x7e;

export const MAX_CODE_POINT = 0x10_ffff;

export const LONE_SURROGATE =
  /[\uD800-\uDFFF](?<![\uD800-\uDBFF](?=[\uDC00-\uDFFF]))(?<![\uD800-\uDBFF][\uDC00-\uDFFF])/;

const NON_PRINTABLE =
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF\uD800-\uDFFF](?<![\uD800-\uDBFF](?=[\uDC00-\uDFFF]))(?<![\uD800-\uDBFF][\uDC00-\uDFFF])/;

const C1_CONTROL_OR_WIDE = /[\x80-\x84\x86-\x9F\u0100-\uFFFF]/;

// V8 only vectorizes the search for a class of at most 16 characters.
const LOW_C0_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x12]/;
const HIGH_C0_CONTROL_OR_DELETE = /[\x13-\x1F\x7F]/;

const ASCII_LENGTH = 128;

const asciiTable = (characters: string): Uint8Array => {
  const table = new Uint8Array(ASCII_LENGTH);

  for (const character of characters) table[character.charCodeAt(0)] = 1;

  return table;
};

const INDICATORS = asciiTable('-?:,[]{}#&*!|>\'"%@`');

export const PLAIN_LINE_END_CANDIDATES = asciiTable('\n\r#:,[]{}');
export const SINGLE_QUOTED_BREAKS = asciiTable("'\n\r");
export const DOUBLE_QUOTED_BREAKS = asciiTable('"\\\n\r');

export const findNonPrintable = (source: string): number =>
  C1_CONTROL_OR_WIDE.test(source) ||
  LOW_C0_CONTROL.test(source) ||
  HIGH_C0_CONTROL_OR_DELETE.test(source)
    ? source.search(NON_PRINTABLE)
    : -1;

export const isSpaceOrTab = (code: number): boolean =>
  code === CHAR_SPACE || code === CHAR_TAB;

export const isLineBreak = (code: number): boolean =>
  code === CHAR_LINE_FEED || code === CHAR_CARRIAGE_RETURN;

export const isBlank = (code: number): boolean =>
  isSpaceOrTab(code) || isLineBreak(code);

export const isFlowEntryEnd = (code: number): boolean =>
  code === CHAR_COMMA ||
  code === CHAR_RIGHT_BRACKET ||
  code === CHAR_RIGHT_BRACE;

export const isFlowIndicator = (code: number): boolean =>
  isFlowEntryEnd(code) ||
  code === CHAR_LEFT_BRACKET ||
  code === CHAR_LEFT_BRACE;

export const isQuote = (code: number): boolean =>
  code === CHAR_SINGLE_QUOTE || code === CHAR_DOUBLE_QUOTE;

export const isJsonLikeNodeStart = (code: number): boolean =>
  isQuote(code) || code === CHAR_LEFT_BRACKET || code === CHAR_LEFT_BRACE;

export const isContentIndicator = (code: number): boolean =>
  code === CHAR_SINGLE_QUOTE ||
  code === CHAR_DOUBLE_QUOTE ||
  code === CHAR_LEFT_BRACKET ||
  code === CHAR_LEFT_BRACE ||
  code === CHAR_PIPE ||
  code === CHAR_GREATER_THAN ||
  code === CHAR_STAR;

export const isListed = (table: Uint8Array, code: number): boolean =>
  code < ASCII_LENGTH && table[code] === 1;

export const isIndicator = (code: number): boolean =>
  isListed(INDICATORS, code);

export const hexadecimalDigitValue = (code: number): number => {
  if (code >= CHAR_0 && code <= CHAR_9) return code - CHAR_0;
  if (code >= CHAR_UPPER_A && code <= CHAR_UPPER_F)
    return code - CHAR_UPPER_A + 10;
  if (code >= CHAR_LOWER_A && code <= CHAR_LOWER_F)
    return code - CHAR_LOWER_A + 10;

  return -1;
};
