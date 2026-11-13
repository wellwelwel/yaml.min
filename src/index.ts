import type { ParserState } from './types.js';
import { engineLimitError, syntaxError } from './internal/errors.js';
import {
  createParserState,
  readDocument,
  skipToDocument,
} from './internal/stream.js';

const readWithinEngineLimits = <Result>(
  input: string,
  read: (state: ParserState) => Result
): Result => {
  const state = createParserState(input);

  try {
    return read(state);
  } catch (error) {
    if (error instanceof RangeError) throw engineLimitError(state, error);

    throw error;
  }
};

const readSingleDocument = (state: ParserState): unknown => {
  if (!skipToDocument(state)) return null;

  const document = readDocument(state);

  if (skipToDocument(state))
    throw syntaxError(
      state,
      'The input holds more than one document: expected a single document, or use parseAll to read every document in the stream'
    );

  return document;
};

const readEveryDocument = (state: ParserState): unknown[] => {
  const documents: unknown[] = [];

  while (skipToDocument(state)) documents.push(readDocument(state));

  return documents;
};

/**
 * Parses a YAML v1.2 string that holds a single document.
 *
 * - The result is `unknown` because nothing checks its shape: validate it before use.
 * - It holds only plain objects, arrays, strings, numbers, booleans, and `null`, never `undefined`.
 * - No mapping key in it is named `__proto__`, `constructor`, or `prototype`.
 * - Test for a key with `Object.hasOwn()`, not `in`.
 * - An alias returns the value its anchor labels, not a copy, so changing it in one place changes it everywhere the alias appears.
 * - Numbers are `Infinity`, `-Infinity`, or `NaN` only for YAML's `.inf`, `-.inf`, and `.nan` forms, and those values do not survive a JSON round trip.
 * - A numeral too large for a number, such as `1e999`, stays a string.
 *
 * @throws {TypeError} When `input` is not a string.
 * @throws {SyntaxError} When `input` is not valid YAML, holds more than one document (use `parseAll` for a stream), nests collections more than 256 levels deep, has aliases that repeat more than the larger of 1,000,000 characters and 10 times its length, has an alias inside the node its own anchor labels, exhausts an engine limit such as the call stack, or has a mapping key named `__proto__`, `constructor`, or `prototype`.
 */
export const parse = (input: string): unknown =>
  readWithinEngineLimits(input, readSingleDocument);

/**
 * Parses every document in a YAML v1.2 stream, in order, and returns an empty array for an empty stream.
 *
 * Each document follows the same contract as `parse`, and an anchor is only visible inside its own document.
 *
 * @throws {TypeError} When `input` is not a string.
 * @throws {SyntaxError} When any document in `input` is not valid YAML, nests collections more than 256 levels deep, has an alias inside the node its own anchor labels, exhausts an engine limit such as the call stack, or has a mapping key named `__proto__`, `constructor`, or `prototype`.
 * @throws {SyntaxError} When the aliases of all documents together repeat more than the larger of 1,000,000 characters and 10 times the length of `input`.
 */
export const parseAll = (input: string): unknown[] =>
  readWithinEngineLimits(input, readEveryDocument);
