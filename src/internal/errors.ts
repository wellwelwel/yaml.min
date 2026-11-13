import type { ParserState } from '../types.js';
import { CHAR_LINE_FEED } from './chars.js';

const describePosition = (source: string, position: number): string => {
  let line = 1;
  let lineStart = 0;

  for (let index = 0; index < position; index++) {
    if (source.charCodeAt(index) !== CHAR_LINE_FEED) continue;

    line++;
    lineStart = index + 1;
  }

  return `line ${line}, column ${position - lineStart + 1}`;
};

const locate = (
  state: ParserState,
  message: string,
  position: number
): string =>
  `${message} (${describePosition(state.src, Math.min(position, state.len))})`;

export const syntaxError = (
  state: ParserState,
  message: string,
  position: number = state.pos
): SyntaxError => new SyntaxError(locate(state, message, position));

export const engineLimitError = (
  state: ParserState,
  cause: RangeError
): SyntaxError =>
  new SyntaxError(
    locate(
      state,
      'The input exhausted an engine limit, such as the call stack: expected a smaller or less deeply nested document',
      state.pos
    ),
    { cause }
  );
