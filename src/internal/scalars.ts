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

const resolvePrefixedInteger = (
  raw: string,
  radix: number
): number | undefined =>
  isDigitRun(raw, RADIX_PREFIX_LENGTH, radix)
    ? Number.parseInt(raw.slice(RADIX_PREFIX_LENGTH), radix)
    : undefined;

const resolveInteger = (raw: string): number | undefined => {
  const signLength =
    raw.charCodeAt(0) === CHAR_MINUS || raw.charCodeAt(0) === CHAR_PLUS ? 1 : 0;

  if (raw.charCodeAt(signLength) === CHAR_0) {
    const prefix = raw.charCodeAt(signLength + 1);
    const isPrefixed = prefix === CHAR_LOWER_O || prefix === CHAR_LOWER_X;

    if (isPrefixed && signLength > 0) return undefined;
    if (prefix === CHAR_LOWER_O) return resolvePrefixedInteger(raw, 8);
    if (prefix === CHAR_LOWER_X) return resolvePrefixedInteger(raw, 16);
  }

  return isDigitRun(raw, signLength, 10) ? Number.parseInt(raw, 10) : undefined;
};

const toSafeInteger = (integer: number): number | undefined =>
  Number.isSafeInteger(integer) ? integer : undefined;

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

export const resolveSafeInteger = (raw: string): number | undefined => {
  const integer = resolveInteger(raw);

  return integer === undefined ? undefined : toSafeInteger(integer);
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

const resolveNumeral = (raw: string): number | undefined => {
  const integer = resolveInteger(raw);

  return integer === undefined ? resolveFloat(raw) : toSafeInteger(integer);
};

export const resolveScalar = (raw: string): unknown => {
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
    const numeral = resolveNumeral(raw);

    if (numeral !== undefined) return numeral;
  }

  return raw;
};
