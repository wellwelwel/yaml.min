import type { ParserState } from '../types.js';
import { syntaxError } from './errors.js';

const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const PROTOTYPE_KEY_LENGTHS = Array.from(PROTOTYPE_KEYS, (key) => key.length);
const SHORTEST_PROTOTYPE_KEY_LENGTH = Math.min(...PROTOTYPE_KEY_LENGTHS);
const LONGEST_PROTOTYPE_KEY_LENGTH = Math.max(...PROTOTYPE_KEY_LENGTHS);

const isPrototypeKey = (key: string): boolean =>
  key.length >= SHORTEST_PROTOTYPE_KEY_LENGTH &&
  key.length <= LONGEST_PROTOTYPE_KEY_LENGTH &&
  PROTOTYPE_KEYS.has(key);

const prototypeKeyError = (
  state: ParserState,
  key: string,
  keyStart: number
): SyntaxError =>
  syntaxError(
    state,
    `The mapping key "${key}" can reach an object's prototype: expected a key other than "__proto__", "constructor", or "prototype"`,
    keyStart
  );

export const setMapKey = (
  state: ParserState,
  target: Record<string, unknown>,
  key: string,
  keyStart: number,
  value: unknown
): void => {
  if (isPrototypeKey(key)) throw prototypeKeyError(state, key, keyStart);

  target[key] = value;
};

export const stringifyKey = (key: unknown): string => {
  if (typeof key === 'object' && key !== null) return JSON.stringify(key);

  return String(key == null ? '' : key);
};
