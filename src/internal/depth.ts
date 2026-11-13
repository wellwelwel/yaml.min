import type { ParserState } from '../types.js';
import { syntaxError } from './errors.js';

const MAX_DEPTH = 256;

export const enterCollection = (state: ParserState): void => {
  if (++state.depth > MAX_DEPTH)
    throw syntaxError(
      state,
      `The input nests collections more than ${MAX_DEPTH} levels deep: expected at most ${MAX_DEPTH} levels of nesting`
    );
};

export const leaveCollection = (state: ParserState): void => {
  state.depth--;
};
