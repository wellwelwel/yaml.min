import {
  CHAR_0,
  CHAR_9,
  CHAR_CR,
  CHAR_DOT,
  CHAR_LF,
  CHAR_LOWER_F,
  CHAR_LOWER_N,
  CHAR_LOWER_O,
  CHAR_LOWER_T,
  CHAR_LOWER_X,
  CHAR_MINUS,
  CHAR_PLUS,
  CHAR_SPACE,
  CHAR_TAB,
  CHAR_TILDE,
  CHAR_UNDERSCORE,
  CHAR_UPPER_F,
  CHAR_UPPER_N,
  CHAR_UPPER_T,
  isDecimal,
  isHexChar,
  isOctalChar,
  RE_FLOAT,
  RE_INFINITY,
} from './chars.js';

export const resolveInteger = (raw: string): number | undefined => {
  const length = raw.length;
  let index = 0;
  let code = raw.charCodeAt(index);

  if (code === CHAR_MINUS || code === CHAR_PLUS) {
    code = raw.charCodeAt(++index);
  }

  if (code === CHAR_0 && index + 1 < length) {
    const prefix = raw.charCodeAt(index + 1);

    if (prefix === CHAR_LOWER_O) {
      for (let charIndex = index + 2; charIndex < length; charIndex++) {
        if (!isOctalChar(raw.charCodeAt(charIndex))) return undefined;
      }

      return index + 2 < length
        ? Number.parseInt(raw.slice(index + 2), 8)
        : undefined;
    }

    if (prefix === CHAR_LOWER_X) {
      for (let charIndex = index + 2; charIndex < length; charIndex++) {
        if (!isHexChar(raw.charCodeAt(charIndex))) return undefined;
      }

      return index + 2 < length
        ? Number.parseInt(raw.slice(index + 2), 16)
        : undefined;
    }
  }

  if (index >= length) return undefined;

  for (let charIndex = index; charIndex < length; charIndex++) {
    if (!isDecimal(raw.charCodeAt(charIndex))) return undefined;
  }

  return Number.parseInt(raw, 10);
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
    const integer = resolveInteger(raw);

    if (integer !== undefined) return integer;

    if (RE_FLOAT.test(raw) && raw !== '+' && raw !== '-')
      return Number.parseFloat(raw);

    if (RE_INFINITY.test(raw))
      return raw[0] === '-'
        ? Number.NEGATIVE_INFINITY
        : Number.POSITIVE_INFINITY;

    if (raw === '.nan' || raw === '.NaN' || raw === '.NAN') return Number.NaN;
  }

  return raw;
};

export const trimEnd = (str: string): string => {
  let cursor = str.length;

  while (cursor > 0) {
    const code = str.charCodeAt(cursor - 1);

    if (
      code !== CHAR_SPACE &&
      code !== CHAR_TAB &&
      code !== CHAR_LF &&
      code !== CHAR_CR
    )
      break;

    cursor--;
  }

  return cursor < str.length ? str.slice(0, cursor) : str;
};

export const setMapKey = (
  target: Record<string, unknown>,
  key: string,
  value: unknown
): void => {
  if (key.charCodeAt(0) === CHAR_UNDERSCORE && key === '__proto__') {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
};

export const stringifyKey = (key: unknown): string => {
  if (typeof key === 'object' && key !== null) return JSON.stringify(key);
  return String(key == null ? '' : key);
};
