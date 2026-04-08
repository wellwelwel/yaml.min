import type { ParserState } from '../types.js';
import {
  CHAR_AMP,
  CHAR_BACKSLASH,
  CHAR_COLON,
  CHAR_CR,
  CHAR_DOT,
  CHAR_DQUOTE,
  CHAR_GT,
  CHAR_HASH,
  CHAR_LBRACE,
  CHAR_LBRACKET,
  CHAR_LF,
  CHAR_MINUS,
  CHAR_PIPE,
  CHAR_QUESTION,
  CHAR_SPACE,
  CHAR_SQUOTE,
  CHAR_STAR,
  CHAR_TAB,
} from './chars.js';
import { parseFlowMap, parseFlowSeq } from './flow.js';
import {
  parseAlias,
  readAnchorOrTag,
  skipComment,
  skipNewlinesAndComments,
  skipSpaces,
  withAnchor,
} from './navigation.js';
import { resolveScalar, setMapKey, stringifyKey, trimEnd } from './scalars.js';
import {
  parseBlockScalar,
  parseDoubleQuoted,
  parsePlainScalar,
  parseSingleQuoted,
} from './strings.js';

const MAX_DEPTH = 1000;

export const parseBlockSeq = (
  state: ParserState,
  indent: number
): unknown[] => {
  const result: unknown[] = [];

  while (state.pos < state.len) {
    const lineIndent = skipNewlinesAndComments(state);

    if (state.pos >= state.len) break;

    if (lineIndent !== indent) {
      state.pos -= lineIndent;
      break;
    }

    const dashNext =
      state.pos + 1 < state.len ? state.src.charCodeAt(state.pos + 1) : -1;

    if (
      state.src.charCodeAt(state.pos) !== CHAR_MINUS ||
      (dashNext !== -1 &&
        dashNext !== CHAR_SPACE &&
        dashNext !== CHAR_LF &&
        dashNext !== CHAR_CR)
    ) {
      state.pos -= lineIndent;
      break;
    }

    state.pos++;

    if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_SPACE)
      state.pos++;

    readAnchorOrTag(state);

    const anchor = state.lastAnchor;

    skipSpaces(state);
    skipComment(state);

    const currentCode =
      state.pos < state.len ? state.src.charCodeAt(state.pos) : -1;

    let value: unknown;

    if (
      currentCode !== -1 &&
      currentCode !== CHAR_LF &&
      currentCode !== CHAR_CR
    ) {
      value = parseInlineValue(state, indent + 2);
    } else {
      if (currentCode === CHAR_CR) state.pos++;

      if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_LF)
        state.pos++;

      const nextIndent = skipNewlinesAndComments(state);

      value =
        state.pos < state.len && nextIndent > indent
          ? parseValue(state, nextIndent, nextIndent)
          : null;
    }

    result.push(withAnchor(state, anchor, value));
  }

  return result;
};

export const parseBlockMap = (
  state: ParserState,
  indent: number
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  parseBlockMapEntries(state, result, indent, false);

  return result;
};

const parseMapValue = (state: ParserState, indent: number): unknown => {
  readAnchorOrTag(state);

  const valAnchor = state.lastAnchor;

  skipSpaces(state);
  skipComment(state);

  const valueCode =
    state.pos < state.len ? state.src.charCodeAt(state.pos) : -1;

  if (valueCode === -1 || valueCode === CHAR_LF || valueCode === CHAR_CR) {
    if (valueCode === CHAR_CR) state.pos++;

    if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_LF)
      state.pos++;

    const nextIndent = skipNewlinesAndComments(state);

    if (state.pos < state.len && nextIndent > indent)
      return withAnchor(
        state,
        valAnchor,
        parseValue(state, nextIndent, nextIndent)
      );

    return withAnchor(state, valAnchor, null);
  }

  if (valueCode === CHAR_SQUOTE)
    return withAnchor(state, valAnchor, parseSingleQuoted(state));

  if (valueCode === CHAR_DQUOTE)
    return withAnchor(state, valAnchor, parseDoubleQuoted(state));

  if (valueCode === CHAR_LBRACKET)
    return withAnchor(state, valAnchor, parseFlowSeq(state));

  if (valueCode === CHAR_LBRACE)
    return withAnchor(state, valAnchor, parseFlowMap(state));

  if (valueCode === CHAR_PIPE || valueCode === CHAR_GT)
    return withAnchor(state, valAnchor, parseBlockScalar(state, indent));

  if (valueCode === CHAR_STAR)
    return withAnchor(state, valAnchor, parseAlias(state));

  if (valueCode === CHAR_AMP) {
    readAnchorOrTag(state);

    const inlineAnchor = state.lastAnchor;

    skipSpaces(state);

    const value = parseValue(state, indent + 1);

    if (inlineAnchor) state.anchors.set(inlineAnchor, value);

    return withAnchor(state, valAnchor, value);
  }

  return withAnchor(
    state,
    valAnchor,
    resolveScalar(parsePlainScalar(state, indent, false) as string)
  );
};

const parseMapKey = (state: ParserState): unknown => {
  const keyCode = state.src.charCodeAt(state.pos);

  if (keyCode === CHAR_SQUOTE) return parseSingleQuoted(state);
  if (keyCode === CHAR_DQUOTE) return parseDoubleQuoted(state);
  if (keyCode === CHAR_LBRACKET) return parseFlowSeq(state);
  if (keyCode === CHAR_LBRACE) return parseFlowMap(state);
  if (keyCode === CHAR_STAR) return parseAlias(state);

  const keyStart = state.pos;
  while (state.pos < state.len) {
    const charCode = state.src.charCodeAt(state.pos);

    if (charCode === CHAR_LF || charCode === CHAR_CR) break;

    if (
      charCode === CHAR_COLON &&
      (state.pos + 1 >= state.len ||
        state.src.charCodeAt(state.pos + 1) === CHAR_SPACE ||
        state.src.charCodeAt(state.pos + 1) === CHAR_TAB ||
        state.src.charCodeAt(state.pos + 1) === CHAR_LF ||
        state.src.charCodeAt(state.pos + 1) === CHAR_CR)
    )
      break;

    if (
      charCode === CHAR_HASH &&
      state.pos > 0 &&
      (state.src.charCodeAt(state.pos - 1) === CHAR_SPACE ||
        state.src.charCodeAt(state.pos - 1) === CHAR_TAB)
    )
      break;

    state.pos++;
  }

  return resolveScalar(trimEnd(state.src.slice(keyStart, state.pos)));
};

const parseMapEntry = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number
): boolean => {
  readAnchorOrTag(state);

  const keyAnchor = state.lastAnchor;

  skipSpaces(state);

  const key = parseMapKey(state);

  if (keyAnchor) state.anchors.set(keyAnchor, key);

  skipSpaces(state);

  if (state.pos >= state.len || state.src.charCodeAt(state.pos) !== CHAR_COLON)
    return false;

  state.pos++;

  if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_SPACE)
    state.pos++;

  setMapKey(result, stringifyKey(key), parseMapValue(state, indent));

  return true;
};

const parseExplicitKey = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number
): void => {
  state.pos++;

  if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_SPACE)
    state.pos++;

  readAnchorOrTag(state);

  const keyAnchor = state.lastAnchor;

  skipSpaces(state);

  const keyStartCode =
    state.pos < state.len ? state.src.charCodeAt(state.pos) : -1;

  const key =
    keyStartCode === -1 || keyStartCode === CHAR_LF || keyStartCode === CHAR_CR
      ? null
      : parseMapKey(state);

  if (keyAnchor) state.anchors.set(keyAnchor, key);

  skipSpaces(state);

  const nextIndent = skipNewlinesAndComments(state);
  const savedPos = state.pos - nextIndent;

  if (nextIndent === indent) {
    const colonCode = state.src.charCodeAt(state.pos);
    const colonNextCode =
      state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

    if (
      colonCode === CHAR_COLON &&
      (colonNextCode === -1 ||
        colonNextCode === CHAR_SPACE ||
        colonNextCode === CHAR_LF ||
        colonNextCode === CHAR_CR)
    ) {
      state.pos++;

      if (
        state.pos < state.len &&
        state.src.charCodeAt(state.pos) === CHAR_SPACE
      )
        state.pos++;

      setMapKey(result, stringifyKey(key), parseMapValue(state, indent));

      return;
    }
  }

  setMapKey(result, stringifyKey(key), null);

  state.pos = savedPos;
};

const parseBlockMapEntries = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number,
  isInline: boolean
): void => {
  // When inline, pos is already at the first key (parse it directly)
  if (isInline) {
    parseMapEntry(state, result, indent);
  }

  while (state.pos < state.len) {
    const lineIndent = skipNewlinesAndComments(state);

    if (state.pos >= state.len) break;

    if (lineIndent !== indent) {
      state.pos -= lineIndent;
      break;
    }

    const lineStartCode = state.src.charCodeAt(state.pos);

    // Explicit key (? ...)
    if (lineStartCode === CHAR_QUESTION) {
      const questionNextCode =
        state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

      if (
        questionNextCode === -1 ||
        questionNextCode === CHAR_SPACE ||
        questionNextCode === CHAR_LF ||
        questionNextCode === CHAR_CR
      ) {
        parseExplicitKey(state, result, indent);
        continue;
      }
    }

    // Sequence indicator (stop map parsing)
    if (lineStartCode === CHAR_MINUS) {
      const dashNextCode =
        state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

      if (
        dashNextCode === -1 ||
        dashNextCode === CHAR_SPACE ||
        dashNextCode === CHAR_LF ||
        dashNextCode === CHAR_CR
      ) {
        state.pos -= lineIndent;
        break;
      }
    }

    if (!parseMapEntry(state, result, indent)) break;
  }
};

export const parseInlineValue = (
  state: ParserState,
  indent: number
): unknown => {
  const charCode = state.src.charCodeAt(state.pos);

  if (charCode === CHAR_SQUOTE) return parseSingleQuoted(state);

  if (charCode === CHAR_DQUOTE) return parseDoubleQuoted(state);

  if (charCode === CHAR_LBRACKET) return parseFlowSeq(state);

  if (charCode === CHAR_LBRACE) return parseFlowMap(state);

  if (charCode === CHAR_PIPE || charCode === CHAR_GT)
    return parseBlockScalar(state, indent);

  if (charCode === CHAR_STAR) return parseAlias(state);

  if (charCode === CHAR_MINUS) {
    const dashNextCode =
      state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

    if (
      dashNextCode === -1 ||
      dashNextCode === CHAR_SPACE ||
      dashNextCode === CHAR_LF ||
      dashNextCode === CHAR_CR
    ) {
      const result: unknown[] = [];

      while (state.pos < state.len) {
        state.pos++;

        if (
          state.pos < state.len &&
          state.src.charCodeAt(state.pos) === CHAR_SPACE
        )
          state.pos++;

        readAnchorOrTag(state);

        const itemAnchor = state.lastAnchor;

        skipSpaces(state);
        skipComment(state);

        const itemCode =
          state.pos < state.len ? state.src.charCodeAt(state.pos) : -1;

        let value: unknown;

        if (itemCode !== -1 && itemCode !== CHAR_LF && itemCode !== CHAR_CR) {
          value = parseInlineValue(state, indent + 2);
        } else {
          if (itemCode === CHAR_CR) state.pos++;

          if (
            state.pos < state.len &&
            state.src.charCodeAt(state.pos) === CHAR_LF
          )
            state.pos++;

          const nextIndent = skipNewlinesAndComments(state);

          value =
            state.pos < state.len && nextIndent > indent
              ? parseValue(state, nextIndent, nextIndent)
              : null;
        }

        result.push(withAnchor(state, itemAnchor, value));

        const nextIndent = skipNewlinesAndComments(state);

        if (state.pos >= state.len) break;
        if (nextIndent !== indent) break;

        const savedPos = state.pos - nextIndent;

        if (state.src.charCodeAt(state.pos) !== CHAR_MINUS) {
          state.pos = savedPos;
          break;
        }

        if (state.pos + 1 < state.len) {
          const nextDashCode = state.src.charCodeAt(state.pos + 1);

          if (
            nextDashCode !== CHAR_SPACE &&
            nextDashCode !== CHAR_LF &&
            nextDashCode !== CHAR_CR
          ) {
            state.pos = savedPos;
            break;
          }
        }
      }

      return result;
    }
  }

  let lookAhead = state.pos;
  let foundColon = false;

  while (lookAhead < state.len) {
    const lookAheadCode = state.src.charCodeAt(lookAhead);

    if (lookAheadCode === CHAR_LF || lookAheadCode === CHAR_CR) break;

    if (lookAheadCode === CHAR_COLON) {
      const afterColonCode =
        lookAhead + 1 >= state.len ? -1 : state.src.charCodeAt(lookAhead + 1);

      if (
        afterColonCode === -1 ||
        afterColonCode === CHAR_SPACE ||
        afterColonCode === CHAR_TAB ||
        afterColonCode === CHAR_LF ||
        afterColonCode === CHAR_CR
      ) {
        foundColon = true;
        break;
      }
    }

    if (lookAheadCode === CHAR_HASH && lookAhead > state.pos) {
      const prev = state.src.charCodeAt(lookAhead - 1);

      if (prev === CHAR_SPACE || prev === CHAR_TAB) break;
    }

    lookAhead++;
  }

  if (foundColon) {
    const result: Record<string, unknown> = {};

    parseBlockMapEntries(state, result, indent, true);

    return result;
  }

  return resolveScalar(
    parsePlainScalar(state, indent > 0 ? indent - 1 : 0, false)
  );
};

export const parseValue = (
  state: ParserState,
  indent: number,
  precomputedIndent?: number
): unknown => {
  if (++state.depth > MAX_DEPTH)
    throw new RangeError('maximum nesting depth exceeded');

  const lineIndent = precomputedIndent ?? skipNewlinesAndComments(state);
  const lineStart = state.pos - lineIndent;

  const firstCharCode = state.src.charCodeAt(state.pos);

  if (
    (firstCharCode === CHAR_MINUS || firstCharCode === CHAR_DOT) &&
    state.src.charCodeAt(state.pos + 1) === firstCharCode &&
    state.src.charCodeAt(state.pos + 2) === firstCharCode
  ) {
    const after =
      state.pos + 3 < state.len ? state.src.charCodeAt(state.pos + 3) : -1;

    if (
      after === -1 ||
      after === CHAR_SPACE ||
      after === CHAR_LF ||
      after === CHAR_CR ||
      after === CHAR_TAB
    ) {
      state.pos = lineStart;
      state.depth--;

      return null;
    }
  }

  readAnchorOrTag(state);

  const anchor = state.lastAnchor;

  skipSpaces(state);

  const valueCharCode = state.src.charCodeAt(state.pos);
  const effectiveIndent = lineIndent >= indent ? lineIndent : indent;

  const done = (value: unknown): unknown => {
    if (anchor) state.anchors.set(anchor, value);

    state.depth--;
    return value;
  };

  if (valueCharCode === CHAR_SQUOTE || valueCharCode === CHAR_DQUOTE) {
    if (isQuotedMapKey(state, valueCharCode)) {
      state.pos = lineStart;
      return done(parseBlockMap(state, effectiveIndent));
    }

    return done(
      valueCharCode === CHAR_SQUOTE
        ? parseSingleQuoted(state)
        : parseDoubleQuoted(state)
    );
  }

  if (valueCharCode === CHAR_LBRACKET) return done(parseFlowSeq(state));

  if (valueCharCode === CHAR_LBRACE) return done(parseFlowMap(state));

  if (valueCharCode === CHAR_PIPE || valueCharCode === CHAR_GT)
    return done(parseBlockScalar(state, effectiveIndent));

  if (valueCharCode === CHAR_STAR) return done(parseAlias(state));

  if (valueCharCode === CHAR_MINUS) {
    const dashNextCode =
      state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

    if (
      dashNextCode === -1 ||
      dashNextCode === CHAR_SPACE ||
      dashNextCode === CHAR_LF ||
      dashNextCode === CHAR_CR
    ) {
      state.pos = lineStart;

      return done(parseBlockSeq(state, effectiveIndent));
    }

    return done(
      resolveScalar(
        parsePlainScalar(state, indent > 0 ? indent - 1 : -1, false)
      )
    );
  }

  if (valueCharCode === CHAR_QUESTION) {
    const questionNextCode =
      state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

    if (
      questionNextCode === -1 ||
      questionNextCode === CHAR_SPACE ||
      questionNextCode === CHAR_LF ||
      questionNextCode === CHAR_CR
    ) {
      state.pos = lineStart;
      return done(parseBlockMap(state, effectiveIndent));
    }

    return done(
      resolveScalar(
        parsePlainScalar(state, indent > 0 ? indent - 1 : -1, false)
      )
    );
  }

  // Lookahead for colon to decide block map vs plain scalar
  if (hasColonInLine(state)) {
    state.pos = lineStart;

    return done(parseBlockMap(state, effectiveIndent));
  }

  return done(
    resolveScalar(parsePlainScalar(state, indent > 0 ? indent - 1 : -1, false))
  );
};

// Checks if a quoted string at pos is followed by ': '
const isQuotedMapKey = (state: ParserState, quoteCharCode: number): boolean => {
  let lookAhead = state.pos + 1;

  while (
    lookAhead < state.len &&
    state.src.charCodeAt(lookAhead) !== quoteCharCode
  ) {
    if (
      quoteCharCode === CHAR_DQUOTE &&
      state.src.charCodeAt(lookAhead) === CHAR_BACKSLASH
    )
      lookAhead++;

    lookAhead++;
  }

  if (lookAhead < state.len) lookAhead++;

  while (lookAhead < state.len) {
    const code = state.src.charCodeAt(lookAhead);
    if (code !== CHAR_SPACE && code !== CHAR_TAB) break;
    lookAhead++;
  }

  if (lookAhead >= state.len || state.src.charCodeAt(lookAhead) !== CHAR_COLON)
    return false;

  const afterColon =
    lookAhead + 1 >= state.len ? -1 : state.src.charCodeAt(lookAhead + 1);

  return (
    afterColon === -1 ||
    afterColon === CHAR_SPACE ||
    afterColon === CHAR_LF ||
    afterColon === CHAR_CR ||
    afterColon === CHAR_TAB
  );
};

// Checks if the current line contains a colon that indicates a block map
const hasColonInLine = (state: ParserState): boolean => {
  const savedPos = state.pos;
  let lookAhead = state.pos;

  const quoteCode = state.src.charCodeAt(lookAhead);

  if (quoteCode === CHAR_DQUOTE || quoteCode === CHAR_SQUOTE) {
    lookAhead++;

    while (
      lookAhead < state.len &&
      state.src.charCodeAt(lookAhead) !== quoteCode
    ) {
      if (
        state.src.charCodeAt(lookAhead) === CHAR_BACKSLASH &&
        quoteCode === CHAR_DQUOTE
      )
        lookAhead++;

      lookAhead++;
    }

    if (lookAhead < state.len) lookAhead++;

    while (lookAhead < state.len) {
      const code = state.src.charCodeAt(lookAhead);

      if (code !== CHAR_SPACE && code !== CHAR_TAB) break;

      lookAhead++;
    }

    if (
      lookAhead < state.len &&
      state.src.charCodeAt(lookAhead) === CHAR_COLON
    ) {
      const afterColonCode =
        lookAhead + 1 >= state.len ? -1 : state.src.charCodeAt(lookAhead + 1);

      return (
        afterColonCode === -1 ||
        afterColonCode === CHAR_SPACE ||
        afterColonCode === CHAR_LF ||
        afterColonCode === CHAR_CR ||
        afterColonCode === CHAR_TAB
      );
    }

    state.pos = savedPos;

    return false;
  }

  while (lookAhead < state.len) {
    const code = state.src.charCodeAt(lookAhead);

    if (code === CHAR_LF || code === CHAR_CR) break;

    if (code === CHAR_COLON) {
      const afterColonCode =
        lookAhead + 1 >= state.len ? -1 : state.src.charCodeAt(lookAhead + 1);

      if (
        afterColonCode === -1 ||
        afterColonCode === CHAR_SPACE ||
        afterColonCode === CHAR_TAB ||
        afterColonCode === CHAR_LF ||
        afterColonCode === CHAR_CR
      )
        return true;
    }

    if (code === CHAR_HASH && lookAhead > 0) {
      const prev = state.src.charCodeAt(lookAhead - 1);

      if (prev === CHAR_SPACE || prev === CHAR_TAB) break;
    }

    lookAhead++;
  }

  return false;
};
