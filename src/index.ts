import { syntaxError } from './internal/errors.js';
import {
  createParserState,
  readDocument,
  skipToDocument,
} from './internal/stream.js';

/**
 * Parses a YAML v1.2 string that holds a single document.
 *
 * The result is `unknown` because nothing checks its shape: validate it before use.
 * It holds only plain objects, arrays, strings, numbers, booleans, and `null`, never `undefined`.
 * A mapping key named `__proto__`, `constructor`, or `prototype` stays an ordinary own key and never changes a prototype.
 * Test for a key with `Object.hasOwn()`, not `in`, and skip those three names when merging the result into another object.
 * Numbers are `Infinity`, `-Infinity`, or `NaN` only for YAML's `.inf`, `-.inf`, and `.nan` forms, and those values do not survive a JSON round trip.
 * A numeral too large for a number, such as `1e999`, stays a string.
 *
 * @throws {TypeError} When `input` is not a string.
 * @throws {SyntaxError} When `input` is not valid YAML, or holds more than one document (use `parseAll` for a stream).
 * @throws {RangeError} When `input` nests collections too deeply.
 */
export const parse = (input: string): unknown => {
  const state = createParserState(input);

  if (!skipToDocument(state)) return null;

  const document = readDocument(state);

  if (skipToDocument(state))
    throw syntaxError(
      state,
      'The input holds more than one document: expected a single document, or use parseAll to read every document in the stream'
    );

  return document;
};

/**
 * Parses every document in a YAML v1.2 stream, in order, and returns an empty array for an empty stream.
 *
 * Each document follows the same contract as `parse`, and an anchor is only visible inside its own document.
 *
 * @throws {TypeError} When `input` is not a string.
 * @throws {SyntaxError} When any document in `input` is not valid YAML.
 * @throws {RangeError} When `input` nests collections too deeply.
 */
export const parseAll = (input: string): unknown[] => {
  const state = createParserState(input);
  const documents: unknown[] = [];

  while (skipToDocument(state)) documents.push(readDocument(state));

  return documents;
};
