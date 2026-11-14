import type { ParseOptions, ParserState } from './types.js';
import { YamlError } from './error.js';
import { engineLimitError, yamlError } from './internal/errors.js';
import {
  createParserState,
  readDocument,
  skipToDocument,
} from './internal/stream.js';

export type { ParseOptions, YamlErrorCode } from './types.js';

export { YamlError };

const readWithinEngineLimits = <Result>(
  input: string,
  options: ParseOptions | undefined,
  read: (state: ParserState) => Result
): Result => {
  const state = createParserState(input, options);

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
    throw yamlError(
      state,
      'MULTIPLE_DOCUMENTS',
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
 * - The result is `unknown`: validate its shape before use.
 * - It holds only plain objects, arrays, strings, numbers, booleans, and `null`, with integers as `BigInt` when `bigint` is `true`, never `undefined`.
 * - Its collections nest at most `maxDepth` levels deep (256 by default), counting the levels each alias repeats.
 * - No mapping key in it is named `__proto__`, `prototype`, or after another `Object.prototype` member, such as `constructor` or `toString`, unless `allowUnsafeKeys` is `true`.
 * - Each mapping key is the text form of a scalar, with `null` as `''`, and appears once in its mapping.
 * - YAML 1.2 has no merge keys, so no mapping merges another, and a `<<` key appears only when written as a quoted scalar tagged `!!str`, such as `!!str "<<"`.
 * - Test for a key with `Object.hasOwn()`, not `in`.
 * - An alias returns the value its anchor labels, not a copy. Each mapping or sequence an alias refers to is frozen, along with everything inside it: copy it before changing it, for example with `structuredClone`.
 * - Numbers are `Infinity`, `-Infinity`, or `NaN` only for YAML's `.inf`, `-.inf`, and `.nan` forms, and those values do not survive a JSON round trip.
 * - An integer beyond ±9007199254740991, such as `12345678901234567890`, stays a string, unless `bigint` is `true`, which returns every integer of up to 1,000 digits as a `BigInt`. A float too large for a number, such as `1e999`, stays a string.
 * - The core schema tags `!!str`, `!!int`, `!!float`, `!!bool`, `!!null`, `!!seq`, `!!map`, and the non-specific `!` set a value's type whatever its quoting, so `!!bool "false"` is `false`.
 *
 * @throws {TypeError} When `input` is not a string, or `maxDepth` is not an integer from 0 to 400.
 * @throws {YamlError} When `input` is not valid YAML, holds more than one document (use `parseAll` for a stream), nests collections more than `maxDepth` levels deep (including the levels aliases repeat), has aliases that repeat more than the larger of 1,000,000 characters and 10 times its length, has an alias inside the node its own anchor labels, or exhausts an engine limit such as the call stack.
 * @throws {YamlError} When a mapping key is a sequence or a mapping, repeats in its mapping (including keys that only share a text form, such as `0x10` and `16`), or, unless `allowUnsafeKeys` is `true`, is named `__proto__`, `prototype`, or after another `Object.prototype` member.
 * @throws {YamlError} When a mapping key reads as `<<`, the merge key some parsers apply, whether plain, quoted, or through an alias, unless it is a quoted scalar tagged `!!str`.
 * @throws {YamlError} When a tag is not a core schema tag, uses a handle no `%TAG` directive declares, labels an alias, or labels a value that does not fit it, such as `!!int "five"`.
 */
export const parse = (input: string, options?: ParseOptions): unknown =>
  readWithinEngineLimits(input, options, readSingleDocument);

/**
 * Parses every document in a YAML v1.2 stream, in order, and returns an empty array for an empty stream.
 *
 * Each document follows the same contract as `parse`, and an anchor is only visible inside its own document.
 *
 * @throws {TypeError} When `input` is not a string, or `maxDepth` is not an integer from 0 to 400.
 * @throws {YamlError} When any document in `input` is not valid YAML, nests collections more than `maxDepth` levels deep (including the levels aliases repeat), has an alias inside the node its own anchor labels, or exhausts an engine limit such as the call stack.
 * @throws {YamlError} When a mapping key in any document is a sequence or a mapping, repeats in its mapping (including keys that only share a text form, such as `0x10` and `16`), or, unless `allowUnsafeKeys` is `true`, is named `__proto__`, `prototype`, or after another `Object.prototype` member.
 * @throws {YamlError} When a mapping key in any document reads as `<<`, the merge key some parsers apply, whether plain, quoted, or through an alias, unless it is a quoted scalar tagged `!!str`.
 * @throws {YamlError} When a tag in any document is not a core schema tag, uses a handle no `%TAG` directive of that document declares, labels an alias, or labels a value that does not fit it.
 * @throws {YamlError} When the aliases of all documents together repeat more than the larger of 1,000,000 characters and 10 times the length of `input`.
 */
export const parseAll = (input: string, options?: ParseOptions): unknown[] =>
  readWithinEngineLimits(input, options, readEveryDocument);
