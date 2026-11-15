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
const NOT_DIGITS = -1;

export const MAX_BIG_INTEGER_DIGITS = 1000;

const FLOAT_NUMERAL = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/;
const INFINITY_NUMERAL = /^[+-]?\.(inf|Inf|INF)$/;

const digitsValue = (raw: string, start: number, radix: number): number => {
  if (start >= raw.length) return NOT_DIGITS;

  let value = 0;

  for (let index = start; index < raw.length; index++) {
    const digit = hexadecimalDigitValue(raw.charCodeAt(index));

    if (digit === -1 || digit >= radix) return NOT_DIGITS;

    value = value * radix + digit;
  }

  return value;
};

const signLengthOf = (raw: string): number =>
  raw.charCodeAt(0) === CHAR_MINUS || raw.charCodeAt(0) === CHAR_PLUS ? 1 : 0;

const integerRadix = (raw: string): number => {
  if (raw.length <= RADIX_PREFIX_LENGTH || raw.charCodeAt(0) !== CHAR_0)
    return 10;

  const prefix = raw.charCodeAt(1);

  if (prefix === CHAR_LOWER_O) return 8;

  return prefix === CHAR_LOWER_X ? 16 : 10;
};

const digitsStartOf = (raw: string, radix: number): number =>
  radix === 10 ? signLengthOf(raw) : RADIX_PREFIX_LENGTH;

const integerMagnitude = (raw: string, radix: number): number =>
  digitsValue(raw, digitsStartOf(raw, radix), radix);

const toSafeInteger = (raw: string, magnitude: number): number | undefined => {
  const integer = raw.charCodeAt(0) === CHAR_MINUS ? -magnitude : magnitude;

  return Number.isSafeInteger(integer) ? integer : undefined;
};

const toBigInteger = (raw: string, radix: number): bigint | undefined =>
  raw.length - digitsStartOf(raw, radix) > MAX_BIG_INTEGER_DIGITS
    ? undefined
    : BigInt(raw);

const convertInteger = (
  raw: string,
  radix: number,
  magnitude: number,
  bigint: boolean
): number | bigint | undefined =>
  bigint ? toBigInteger(raw, radix) : toSafeInteger(raw, magnitude);

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
  const magnitude = integerMagnitude(raw, radix);

  return magnitude === NOT_DIGITS
    ? undefined
    : convertInteger(raw, radix, magnitude, bigint);
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
  const magnitude = integerMagnitude(raw, radix);

  return magnitude === NOT_DIGITS
    ? resolveFloat(raw)
    : convertInteger(raw, radix, magnitude, bigint);
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
