import type { ParserState } from '../types.js';
import { parseAlias, readAnchorOrTag, withAnchor } from './anchors.js';
import {
  CHAR_BACKSLASH,
  CHAR_COLON,
  CHAR_DQUOTE,
  CHAR_GT,
  CHAR_LBRACE,
  CHAR_LBRACKET,
  CHAR_MINUS,
  CHAR_PIPE,
  CHAR_QUESTION,
  CHAR_SPACE,
  CHAR_SQUOTE,
  CHAR_STAR,
  CHAR_TAB,
  isLineBreak,
  isSpaceOrTab,
} from './chars.js';
import { rangeError, syntaxError } from './errors.js';
import { parseFlowMap, parseFlowSeq } from './flow.js';
import { setMapKey, stringifyKey } from './keys.js';
import {
  isAtLineBreakOrEnd,
  isBlankOrEnd,
  isDocumentMarker,
  isLineStart,
  skipComment,
  skipNewlinesAndComments,
  skipSpaces,
} from './navigation.js';
import { resolveScalar } from './scalars.js';
import {
  findPlainLineEnd,
  parseBlockScalar,
  parseDoubleQuoted,
  parsePlainKey,
  parsePlainScalar,
  parseSingleQuoted,
} from './strings.js';

const MAX_DEPTH = 1000;

const isIndicatorAt = (state: ParserState, indicatorCode: number): boolean => {
  if (state.src.charCodeAt(state.pos) !== indicatorCode) return false;
  if (state.pos + 1 >= state.len) return true;

  const nextCode = state.src.charCodeAt(state.pos + 1);

  return nextCode === CHAR_SPACE || isLineBreak(nextCode);
};

const isSequenceEntry = (state: ParserState): boolean =>
  isIndicatorAt(state, CHAR_MINUS);

const isExplicitKey = (state: ParserState): boolean =>
  isIndicatorAt(state, CHAR_QUESTION);

const isMappingValue = (state: ParserState): boolean =>
  isIndicatorAt(state, CHAR_COLON);

const skipIndicator = (state: ParserState): void => {
  state.pos++;

  if (state.src.charCodeAt(state.pos) === CHAR_SPACE) state.pos++;
};

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

  while (isSpaceOrTab(state.src.charCodeAt(lookAhead))) lookAhead++;

  if (lookAhead >= state.len || state.src.charCodeAt(lookAhead) !== CHAR_COLON)
    return false;

  return isBlankOrEnd(state, lookAhead + 1);
};

const hasMappingIndicatorInLine = (state: ParserState): boolean =>
  state.src.charCodeAt(findPlainLineEnd(state, state.pos, false)) ===
  CHAR_COLON;

const finishLine = (state: ParserState): void => {
  if (isAtLineBreakOrEnd(state) || isLineStart(state, state.pos)) return;

  skipSpaces(state);
  skipComment(state);

  if (!isAtLineBreakOrEnd(state))
    throw syntaxError(
      state,
      'Unexpected content after a value: expected a comment or the end of the line'
    );
};

const enterBlockLine = (state: ParserState, indent: number): boolean => {
  const lineIndent = skipNewlinesAndComments(state);

  if (state.pos >= state.len) return false;

  if (lineIndent < indent || isDocumentMarker(state, state.pos)) {
    state.pos -= lineIndent;
    return false;
  }

  if (lineIndent > indent)
    throw syntaxError(
      state,
      `A line is indented by ${lineIndent} spaces, which matches no open block collection: expected ${indent} spaces to continue the collection, or fewer to close it`
    );

  if (state.src.charCodeAt(state.pos) === CHAR_TAB)
    throw syntaxError(
      state,
      'A tab indents a block collection line: expected spaces, since YAML forbids tabs as indentation'
    );

  return true;
};

const parseNextLineValue = (
  state: ParserState,
  ownerIndent: number,
  allowsIndentlessSequence: boolean
): unknown => {
  const nextIndent = skipNewlinesAndComments(state);

  if (state.pos >= state.len) return null;

  if (nextIndent > ownerIndent)
    return parseValue(state, ownerIndent, nextIndent);

  const opensIndentlessSequence =
    allowsIndentlessSequence &&
    nextIndent === ownerIndent &&
    isSequenceEntry(state);

  state.pos -= nextIndent;

  return opensIndentlessSequence ? parseBlockSeq(state, ownerIndent) : null;
};

const parseSeqEntry = (state: ParserState, indent: number): unknown => {
  const dashStart = state.pos;

  state.pos++;
  skipSpaces(state);

  const contentColumn = indent + state.pos - dashStart;
  const anchor = readAnchorOrTag(state);

  skipComment(state);

  if (isAtLineBreakOrEnd(state))
    return withAnchor(state, anchor, parseNextLineValue(state, indent, false));

  const value = parseInlineValue(state, indent, contentColumn);

  finishLine(state);

  return withAnchor(state, anchor, value);
};

const parseBlockSeq = (
  state: ParserState,
  indent: number,
  isInline = false
): unknown[] => {
  const result: unknown[] = [];

  if (isInline) result.push(parseSeqEntry(state, indent));

  while (enterBlockLine(state, indent)) {
    if (!isSequenceEntry(state)) {
      state.pos -= indent;
      break;
    }

    result.push(parseSeqEntry(state, indent));
  }

  return result;
};

const parseMapValueContent = (state: ParserState, indent: number): unknown => {
  if (isAtLineBreakOrEnd(state)) return parseNextLineValue(state, indent, true);

  const valueCode = state.src.charCodeAt(state.pos);

  if (valueCode === CHAR_SQUOTE) return parseSingleQuoted(state);

  if (valueCode === CHAR_DQUOTE) return parseDoubleQuoted(state);

  if (valueCode === CHAR_LBRACKET) return parseFlowSeq(state, indent);

  if (valueCode === CHAR_LBRACE) return parseFlowMap(state, indent);

  if (valueCode === CHAR_PIPE || valueCode === CHAR_GT)
    return parseBlockScalar(state, indent);

  if (valueCode === CHAR_STAR) return parseAlias(state);

  return resolveScalar(parsePlainScalar(state, indent, false));
};

const parseMapValue = (state: ParserState, indent: number): unknown => {
  const valueAnchor = readAnchorOrTag(state);

  skipComment(state);

  return withAnchor(state, valueAnchor, parseMapValueContent(state, indent));
};

const parseMapKey = (state: ParserState, indent: number): unknown => {
  const keyCode = state.src.charCodeAt(state.pos);

  if (keyCode === CHAR_SQUOTE) return parseSingleQuoted(state);
  if (keyCode === CHAR_DQUOTE) return parseDoubleQuoted(state);
  if (keyCode === CHAR_LBRACKET) return parseFlowSeq(state, indent);
  if (keyCode === CHAR_LBRACE) return parseFlowMap(state, indent);
  if (keyCode === CHAR_STAR) return parseAlias(state);

  return resolveScalar(parsePlainKey(state));
};

const parseMapEntry = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number
): void => {
  const entryStart = state.pos;
  const keyAnchor = readAnchorOrTag(state);
  const key = withAnchor(state, keyAnchor, parseMapKey(state, indent));

  skipSpaces(state);

  if (state.src.charCodeAt(state.pos) !== CHAR_COLON)
    throw syntaxError(
      state,
      'A line in a block mapping is not an entry: expected "key: value"',
      entryStart
    );

  skipIndicator(state);
  setMapKey(result, stringifyKey(key), parseMapValue(state, indent));
  finishLine(state);
};

const parseExplicitKey = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number
): void => {
  skipIndicator(state);

  const keyAnchor = readAnchorOrTag(state);
  const key = withAnchor(
    state,
    keyAnchor,
    isAtLineBreakOrEnd(state) ? null : parseMapKey(state, indent)
  );

  finishLine(state);

  const nextIndent = skipNewlinesAndComments(state);

  if (nextIndent === indent && isMappingValue(state)) {
    skipIndicator(state);
    setMapKey(result, stringifyKey(key), parseMapValue(state, indent));
    finishLine(state);

    return;
  }

  if (state.pos < state.len && nextIndent > indent)
    throw syntaxError(
      state,
      `An explicit key is followed by an unexpected line: expected ":" at ${indent} spaces of indentation, or the next entry`
    );

  setMapKey(result, stringifyKey(key), null);

  state.pos -= nextIndent;
};

const parseBlockMap = (
  state: ParserState,
  indent: number,
  isInline = false
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  if (isInline) parseMapEntry(state, result, indent);

  while (enterBlockLine(state, indent)) {
    if (isExplicitKey(state)) {
      parseExplicitKey(state, result, indent);
      continue;
    }

    if (isSequenceEntry(state))
      throw syntaxError(
        state,
        'A sequence entry appears among the entries of a block mapping: expected "key: value" at this indentation'
      );

    parseMapEntry(state, result, indent);
  }

  return result;
};

const parseInlineValue = (
  state: ParserState,
  ownerIndent: number,
  column: number
): unknown => {
  const charCode = state.src.charCodeAt(state.pos);

  if (charCode === CHAR_SQUOTE || charCode === CHAR_DQUOTE) {
    if (isQuotedMapKey(state, charCode))
      return parseBlockMap(state, column, true);

    return charCode === CHAR_SQUOTE
      ? parseSingleQuoted(state)
      : parseDoubleQuoted(state);
  }

  if (charCode === CHAR_LBRACKET) return parseFlowSeq(state, ownerIndent);

  if (charCode === CHAR_LBRACE) return parseFlowMap(state, ownerIndent);

  if (charCode === CHAR_PIPE || charCode === CHAR_GT)
    return parseBlockScalar(state, ownerIndent);

  if (charCode === CHAR_STAR) return parseAlias(state);

  if (isSequenceEntry(state)) return parseBlockSeq(state, column, true);

  if (hasMappingIndicatorInLine(state))
    return parseBlockMap(state, column, true);

  return resolveScalar(parsePlainScalar(state, ownerIndent, false));
};

const parseValueContent = (
  state: ParserState,
  ownerIndent: number,
  lineStart: number,
  lineIndent: number
): unknown => {
  const valueCharCode = state.src.charCodeAt(state.pos);

  if (valueCharCode === CHAR_SQUOTE || valueCharCode === CHAR_DQUOTE) {
    if (isQuotedMapKey(state, valueCharCode)) {
      state.pos = lineStart;
      return parseBlockMap(state, lineIndent);
    }

    return valueCharCode === CHAR_SQUOTE
      ? parseSingleQuoted(state)
      : parseDoubleQuoted(state);
  }

  if (valueCharCode === CHAR_LBRACKET) return parseFlowSeq(state, ownerIndent);

  if (valueCharCode === CHAR_LBRACE) return parseFlowMap(state, ownerIndent);

  if (valueCharCode === CHAR_PIPE || valueCharCode === CHAR_GT)
    return parseBlockScalar(state, ownerIndent);

  if (valueCharCode === CHAR_STAR) return parseAlias(state);

  if (isSequenceEntry(state)) {
    state.pos = lineStart;
    return parseBlockSeq(state, lineIndent);
  }

  if (isExplicitKey(state) || hasMappingIndicatorInLine(state)) {
    state.pos = lineStart;
    return parseBlockMap(state, lineIndent);
  }

  return resolveScalar(parsePlainScalar(state, ownerIndent, false));
};

export const parseValue = (
  state: ParserState,
  ownerIndent: number,
  lineIndent: number
): unknown => {
  if (++state.depth > MAX_DEPTH)
    throw rangeError(
      state,
      `The input nests collections more than ${MAX_DEPTH} levels deep: expected at most ${MAX_DEPTH} levels of nesting`
    );

  const lineStart = state.pos - lineIndent;
  const anchor = readAnchorOrTag(state);
  const value = withAnchor(
    state,
    anchor,
    parseValueContent(state, ownerIndent, lineStart, lineIndent)
  );

  state.depth--;

  return value;
};
