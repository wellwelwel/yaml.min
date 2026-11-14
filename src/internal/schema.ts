import {
  CHAR_0,
  CHAR_9,
  CHAR_DOT,
  CHAR_LOWER_F,
  CHAR_LOWER_N,
  CHAR_LOWER_O,
  CHAR_LOWER_T,
  CHAR_LOWER_X,
  CHAR_MINUS,
  CHAR_PLUS,
  CHAR_TILDE,
  CHAR_UPPER_F,
  CHAR_UPPER_N,
  CHAR_UPPER_T,
  hexadecimalDigitValue,
} from './chars.js';

const RADIX_PREFIX_LENGTH = 2;

export const MAX_BIG_INTEGER_DIGITS = 1000;

const FLOAT_NUMERAL = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/;
const INFINITY_NUMERAL = /^[+-]?\.(inf|Inf|INF)$/;

const isDigitRun = (raw: string, start: number, radix: number): boolean => {
  if (start >= raw.length) return false;

  for (let index = start; index < raw.length; index++) {
    const digit = hexadecimalDigitValue(raw.charCodeAt(index));

    if (digit === -1 || digit >= radix) return false;
  }

  return true;
};

const signLengthOf = (raw: string): number =>
  raw.charCodeAt(0) === CHAR_MINUS || raw.charCodeAt(0) === CHAR_PLUS ? 1 : 0;

const prefixedRadix = (raw: string): number => {
  const radix = raw.charCodeAt(1) === CHAR_LOWER_O ? 8 : 16;

  return isDigitRun(raw, RADIX_PREFIX_LENGTH, radix) ? radix : 0;
};

const hasRadixPrefix = (raw: string, signLength: number): boolean => {
  if (raw.charCodeAt(signLength) !== CHAR_0) return false;

  const prefix = raw.charCodeAt(signLength + 1);

  return prefix === CHAR_LOWER_O || prefix === CHAR_LOWER_X;
};

const integerRadix = (raw: string): number => {
  const signLength = signLengthOf(raw);

  if (hasRadixPrefix(raw, signLength))
    return signLength === 0 ? prefixedRadix(raw) : 0;

  return isDigitRun(raw, signLength, 10) ? 10 : 0;
};

const toSafeInteger = (raw: string, radix: number): number | undefined => {
  const integer =
    radix === 10
      ? Number.parseInt(raw, 10)
      : Number.parseInt(raw.slice(RADIX_PREFIX_LENGTH), radix);

  return Number.isSafeInteger(integer) ? integer : undefined;
};

const toBigInteger = (raw: string, radix: number): bigint | undefined => {
  const digitCount =
    raw.length - (radix === 10 ? signLengthOf(raw) : RADIX_PREFIX_LENGTH);

  return digitCount > MAX_BIG_INTEGER_DIGITS ? undefined : BigInt(raw);
};

const convertInteger = (
  raw: string,
  radix: number,
  bigint: boolean
): number | bigint | undefined =>
  bigint ? toBigInteger(raw, radix) : toSafeInteger(raw, radix);

const isNumeralStart = (code: number): boolean =>
  (code >= CHAR_0 && code <= CHAR_9) ||
  code === CHAR_PLUS ||
  code === CHAR_MINUS ||
  code === CHAR_DOT;

export const isNullText = (raw: string): boolean =>
  raw === '~' || raw === 'null' || raw === 'Null' || raw === 'NULL';

export const resolveBoolean = (raw: string): boolean | undefined => {
  if (raw === 'true' || raw === 'True' || raw === 'TRUE') return true;
  if (raw === 'false' || raw === 'False' || raw === 'FALSE') return false;

  return undefined;
};

export const resolveInteger = (
  raw: string,
  bigint: boolean
): number | bigint | undefined => {
  const radix = integerRadix(raw);

  return radix === 0 ? undefined : convertInteger(raw, radix, bigint);
};

export const resolveFloat = (raw: string): number | undefined => {
  if (FLOAT_NUMERAL.test(raw)) {
    const float = Number.parseFloat(raw);

    return Number.isFinite(float) ? float : undefined;
  }

  if (INFINITY_NUMERAL.test(raw))
    return raw.charCodeAt(0) === CHAR_MINUS
      ? Number.NEGATIVE_INFINITY
      : Number.POSITIVE_INFINITY;

  return raw === '.nan' || raw === '.NaN' || raw === '.NAN'
    ? Number.NaN
    : undefined;
};

const resolveNumeral = (
  raw: string,
  bigint: boolean
): number | bigint | undefined => {
  const radix = integerRadix(raw);

  return radix === 0 ? resolveFloat(raw) : convertInteger(raw, radix, bigint);
};

export const resolveScalar = (raw: string, bigint: boolean): unknown => {
  if (raw === '') return null;

  const firstCharCode = raw.charCodeAt(0);

  if (
    (firstCharCode === CHAR_TILDE ||
      firstCharCode === CHAR_LOWER_N ||
      firstCharCode === CHAR_UPPER_N) &&
    isNullText(raw)
  )
    return null;

  if (
    firstCharCode === CHAR_LOWER_T ||
    firstCharCode === CHAR_UPPER_T ||
    firstCharCode === CHAR_LOWER_F ||
    firstCharCode === CHAR_UPPER_F
  ) {
    const boolean = resolveBoolean(raw);

    if (boolean !== undefined) return boolean;
  }

  if (isNumeralStart(firstCharCode)) {
    const numeral = resolveNumeral(raw, bigint);

    if (numeral !== undefined) return numeral;
  }

  return raw;
};
