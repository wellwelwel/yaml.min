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
  FLOAT_NUMERAL,
  hexadecimalDigitValue,
  INFINITY_NUMERAL,
} from './chars.js';

const RADIX_PREFIX_LENGTH = 2;

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

const resolveNumeral = (raw: string): number | undefined => {
  const integer = resolveInteger(raw);

  if (integer !== undefined) return integer;

  if (FLOAT_NUMERAL.test(raw)) return Number.parseFloat(raw);

  return undefined;
};

export const resolveScalar = (raw: string): unknown => {
  if (raw === '') return null;

  const firstCharCode = raw.charCodeAt(0);

  if (firstCharCode === CHAR_TILDE && raw.length === 1) return null;

  if (
    (firstCharCode === CHAR_LOWER_N || firstCharCode === CHAR_UPPER_N) &&
    (raw === 'null' || raw === 'Null' || raw === 'NULL')
  )
    return null;

  if (
    (firstCharCode === CHAR_LOWER_T || firstCharCode === CHAR_UPPER_T) &&
    (raw === 'true' || raw === 'True' || raw === 'TRUE')
  )
    return true;

  if (
    (firstCharCode === CHAR_LOWER_F || firstCharCode === CHAR_UPPER_F) &&
    (raw === 'false' || raw === 'False' || raw === 'FALSE')
  )
    return false;

  if (
    (firstCharCode >= CHAR_0 && firstCharCode <= CHAR_9) ||
    firstCharCode === CHAR_PLUS ||
    firstCharCode === CHAR_MINUS ||
    firstCharCode === CHAR_DOT
  ) {
    const numeral = resolveNumeral(raw);

    if (Number.isFinite(numeral)) return numeral;

    if (INFINITY_NUMERAL.test(raw))
      return firstCharCode === CHAR_MINUS
        ? Number.NEGATIVE_INFINITY
        : Number.POSITIVE_INFINITY;

    if (raw === '.nan' || raw === '.NaN' || raw === '.NAN') return Number.NaN;
  }

  return raw;
};
