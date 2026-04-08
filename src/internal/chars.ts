export const CHAR_BOM = 0xfeff;
export const CHAR_TAB = 0x09;
export const CHAR_LF = 0x0a;
export const CHAR_CR = 0x0d;
export const CHAR_SPACE = 0x20;
export const CHAR_EXCL = 0x21;
export const CHAR_DQUOTE = 0x22;
export const CHAR_HASH = 0x23;
export const CHAR_PERCENT = 0x25;
export const CHAR_AMP = 0x26;
export const CHAR_SQUOTE = 0x27;
export const CHAR_STAR = 0x2a;
export const CHAR_PLUS = 0x2b;
export const CHAR_COMMA = 0x2c;
export const CHAR_MINUS = 0x2d;
export const CHAR_DOT = 0x2e;
export const CHAR_0 = 0x30;
export const CHAR_1 = 0x31;
export const CHAR_9 = 0x39;
export const CHAR_COLON = 0x3a;
export const CHAR_GT = 0x3e;
export const CHAR_QUESTION = 0x3f;
export const CHAR_UPPER_A = 0x41;
export const CHAR_UPPER_F = 0x46;
export const CHAR_UPPER_N = 0x4e;
export const CHAR_UPPER_T = 0x54;
export const CHAR_UPPER_U = 0x55;
export const CHAR_LBRACKET = 0x5b;
export const CHAR_BACKSLASH = 0x5c;
export const CHAR_RBRACKET = 0x5d;
export const CHAR_UNDERSCORE = 0x5f;
export const CHAR_LOWER_F = 0x66;
export const CHAR_LOWER_N = 0x6e;
export const CHAR_LOWER_O = 0x6f;
export const CHAR_LOWER_T = 0x74;
export const CHAR_LOWER_U = 0x75;
export const CHAR_LOWER_X = 0x78;
export const CHAR_LBRACE = 0x7b;
export const CHAR_PIPE = 0x7c;
export const CHAR_RBRACE = 0x7d;
export const CHAR_TILDE = 0x7e;

// Based on js-yaml
export const NON_PRINTABLE =
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;

export const SIMPLE_ESCAPE_MAP: (string | undefined)[] = (() => {
  const map: (string | undefined)[] = new Array(128);
  const escapes: Record<number, string> = {
    48 /* 0 */: '\x00',
    97 /* a */: '\x07',
    98 /* b */: '\b',
    101 /* e */: '\x1b',
    102 /* f */: '\f',
    110 /* n */: '\n',
    114 /* r */: '\r',
    116 /* t */: '\t',
    118 /* v */: '\v',
    78 /* N */: '\u0085',
    95 /* _ */: '\u00a0',
    76 /* L */: '\u2028',
    80 /* P */: '\u2029',
    32 /* (space) */: ' ',
    34 /* " */: '"',
    47 /* / */: '/',
    92 /* \ */: '\\',
  };

  for (const code of Object.keys(escapes))
    map[Number(code)] = escapes[Number(code)];

  return map;
})();

export const RE_FLOAT = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/;

export const RE_INFINITY = /^[+-]?\.(inf|Inf|INF)$/;

export const isDecimal = (code: number): boolean =>
  code >= CHAR_0 && code <= CHAR_9;

export const isHexChar = (code: number): boolean =>
  (code >= CHAR_0 && code <= CHAR_9) ||
  (code >= CHAR_UPPER_A && code <= CHAR_UPPER_F) ||
  (code >= 0x61 && code <= CHAR_LOWER_F);

export const isOctalChar = (code: number): boolean =>
  code >= CHAR_0 && code <= 0x37;
