import { CHAR_UNDERSCORE } from './chars.js';

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
