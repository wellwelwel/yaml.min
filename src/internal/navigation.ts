import type { ParserState } from '../types.js';
import {
  CHAR_AMP,
  CHAR_COLON,
  CHAR_COMMA,
  CHAR_CR,
  CHAR_DOT,
  CHAR_EXCL,
  CHAR_HASH,
  CHAR_LF,
  CHAR_MINUS,
  CHAR_PERCENT,
  CHAR_RBRACE,
  CHAR_RBRACKET,
  CHAR_SPACE,
  CHAR_TAB,
} from './chars.js';

export const skipSpaces = (state: ParserState): void => {
  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (code !== CHAR_SPACE && code !== CHAR_TAB) break;
    state.pos++;
  }
};

export const skipComment = (state: ParserState): void => {
  if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_HASH) {
    while (state.pos < state.len && state.src.charCodeAt(state.pos) !== CHAR_LF)
      state.pos++;
  }
};

export const skipBlanksAndComments = (state: ParserState): void => {
  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (
      code === CHAR_SPACE ||
      code === CHAR_TAB ||
      code === CHAR_CR ||
      code === CHAR_LF
    ) {
      state.pos++;
    } else if (code === CHAR_HASH) {
      while (
        state.pos < state.len &&
        state.src.charCodeAt(state.pos) !== CHAR_LF
      )
        state.pos++;
    } else {
      break;
    }
  }
};

export const skipNewlinesAndComments = (state: ParserState): number => {
  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (code === CHAR_LF) {
      state.pos++;
    } else if (code === CHAR_CR) {
      state.pos++;

      if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_LF)
        state.pos++;
    } else {
      const lineStart = state.pos;

      while (
        state.pos < state.len &&
        state.src.charCodeAt(state.pos) === CHAR_SPACE
      )
        state.pos++;

      if (
        state.pos < state.len &&
        state.src.charCodeAt(state.pos) === CHAR_HASH
      ) {
        while (
          state.pos < state.len &&
          state.src.charCodeAt(state.pos) !== CHAR_LF
        )
          state.pos++;
      } else {
        return state.pos - lineStart;
      }
    }
  }

  return 0;
};

export const peekLineIndent = (state: ParserState): number => {
  let cursor = state.pos;

  while (cursor < state.len) {
    if (state.src.charCodeAt(cursor) !== CHAR_SPACE) break;
    cursor++;
  }

  return cursor - state.pos;
};

export const skipDirectivesAndMarkers = (state: ParserState): void => {
  while (state.pos < state.len) {
    skipBlanksAndComments(state);

    if (state.pos >= state.len) break;

    if (state.src.charCodeAt(state.pos) === CHAR_PERCENT) {
      while (
        state.pos < state.len &&
        state.src.charCodeAt(state.pos) !== CHAR_LF
      )
        state.pos++;

      continue;
    }

    if (
      state.src.charCodeAt(state.pos) === CHAR_MINUS &&
      state.src.charCodeAt(state.pos + 1) === CHAR_MINUS &&
      state.src.charCodeAt(state.pos + 2) === CHAR_MINUS
    ) {
      state.pos += 3;

      if (state.pos < state.len) {
        const afterMarker = state.src.charCodeAt(state.pos);

        if (
          afterMarker !== CHAR_SPACE &&
          afterMarker !== CHAR_LF &&
          afterMarker !== CHAR_CR &&
          afterMarker !== CHAR_TAB
        ) {
          state.pos -= 3;
          break;
        }
      }

      skipSpaces(state);
      skipComment(state);

      if (state.pos < state.len) {
        const newlineCode = state.src.charCodeAt(state.pos);

        if (newlineCode === CHAR_CR) {
          state.pos++;

          if (
            state.pos < state.len &&
            state.src.charCodeAt(state.pos) === CHAR_LF
          )
            state.pos++;
        } else if (newlineCode === CHAR_LF) {
          state.pos++;
        }
      }

      continue;
    }

    if (
      state.src.charCodeAt(state.pos) === CHAR_DOT &&
      state.src.charCodeAt(state.pos + 1) === CHAR_DOT &&
      state.src.charCodeAt(state.pos + 2) === CHAR_DOT
    ) {
      state.pos += 3;

      while (
        state.pos < state.len &&
        state.src.charCodeAt(state.pos) !== CHAR_LF
      )
        state.pos++;

      if (state.pos < state.len) state.pos++;
      continue;
    }

    break;
  }
};

export const readAnchorOrTag = (state: ParserState): void => {
  state.lastAnchor = undefined;

  while (state.pos < state.len) {
    skipSpaces(state);

    const code = state.src.charCodeAt(state.pos);

    if (code !== CHAR_AMP && code !== CHAR_EXCL) break;

    if (code === CHAR_AMP) {
      state.pos++;

      const start = state.pos;

      while (state.pos < state.len) {
        const charCode = state.src.charCodeAt(state.pos);

        if (
          charCode === CHAR_SPACE ||
          charCode === CHAR_TAB ||
          charCode === CHAR_LF ||
          charCode === CHAR_CR ||
          charCode === CHAR_COMMA ||
          charCode === CHAR_RBRACKET ||
          charCode === CHAR_RBRACE ||
          charCode === CHAR_COLON
        )
          break;

        state.pos++;
      }

      state.lastAnchor = state.src.slice(start, state.pos);
      continue;
    }

    // CHAR_EXCL (skip tag)
    while (state.pos < state.len) {
      const charCode = state.src.charCodeAt(state.pos);

      if (
        charCode === CHAR_SPACE ||
        charCode === CHAR_TAB ||
        charCode === CHAR_LF ||
        charCode === CHAR_CR
      )
        break;

      state.pos++;
    }
  }
};

export const parseAlias = (state: ParserState): unknown => {
  state.pos++;

  const start = state.pos;

  while (state.pos < state.len) {
    const charCode = state.src.charCodeAt(state.pos);

    if (
      charCode === CHAR_SPACE ||
      charCode === CHAR_TAB ||
      charCode === CHAR_LF ||
      charCode === CHAR_CR ||
      charCode === CHAR_COMMA ||
      charCode === CHAR_RBRACKET ||
      charCode === CHAR_RBRACE ||
      charCode === CHAR_COLON
    )
      break;

    state.pos++;
  }

  const name = state.src.slice(start, state.pos);

  if (state.anchors.has(name)) return state.anchors.get(name);
  return undefined;
};

export const withAnchor = (
  state: ParserState,
  anchor: string | undefined,
  value: unknown
): unknown => {
  if (anchor) state.anchors.set(anchor, value);
  return value;
};
