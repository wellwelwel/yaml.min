import type { YamlError } from '../error.js';
import type { ParseOptions, ParserState } from '../types.js';
import { yamlError } from './errors.js';

const DEFAULT_MAX_DEPTH = 256;
const MAX_DEPTH_CEILING = 400;

export const readMaxDepth = (options: ParseOptions | undefined): number => {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;

  if (
    Number.isSafeInteger(maxDepth) &&
    maxDepth >= 0 &&
    maxDepth <= MAX_DEPTH_CEILING
  )
    return maxDepth;

  throw new TypeError(
    `The maxDepth option is invalid: expected an integer from 0 to ${MAX_DEPTH_CEILING}`
  );
};

const nestingError = (state: ParserState): YamlError =>
  yamlError(
    state,
    'NESTING_TOO_DEEP',
    `The input nests collections more than ${state.maxDepth} levels deep: expected at most ${state.maxDepth} levels of nesting`
  );

export const enterCollection = (state: ParserState): void => {
  if (++state.depth > state.maxDepth) throw nestingError(state);
};

export const leaveCollection = (state: ParserState): void => {
  state.depth--;
};
