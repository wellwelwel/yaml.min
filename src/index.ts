import type { ParserState } from './types.js';
import { parseValue } from './internal/block.js';
import { CHAR_BOM, NON_PRINTABLE } from './internal/chars.js';
import { skipDirectivesAndMarkers } from './internal/navigation.js';

export const parse = <T = unknown>(input: string): T => {
  if (typeof input !== 'string') throw new TypeError('source is not a string');

  const src = input.charCodeAt(0) === CHAR_BOM ? input.slice(1) : input;

  if (src.includes('\x00')) throw new SyntaxError('null byte is not allowed');

  if (NON_PRINTABLE.test(src))
    throw new SyntaxError('non-printable characters are not allowed');

  const state: ParserState = {
    src,
    len: src.length,
    pos: 0,
    depth: 0,
    lastAnchor: undefined,
    anchors: new Map(),
  };

  skipDirectivesAndMarkers(state);

  if (state.pos >= state.len) return null as T;

  return parseValue(state, 0) as T;
};
