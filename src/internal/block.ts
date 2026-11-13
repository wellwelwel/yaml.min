import type { NodeProperties, NodeTag, ParserState } from '../types.js';
import { parseAlias, withAnchor } from './anchors.js';
import {
  CHAR_BACKSLASH,
  CHAR_COLON,
  CHAR_DOUBLE_QUOTE,
  CHAR_GREATER_THAN,
  CHAR_LEFT_BRACE,
  CHAR_LEFT_BRACKET,
  CHAR_MINUS,
  CHAR_PIPE,
  CHAR_QUESTION,
  CHAR_SINGLE_QUOTE,
  CHAR_SPACE,
  CHAR_STAR,
  CHAR_TAB,
  isLineBreak,
  isSpaceOrTab,
} from './chars.js';
import { enterCollection, leaveCollection } from './depth.js';
import { syntaxError } from './errors.js';
import { parseFlowMap, parseFlowSequence } from './flow.js';
import { collectionKeyError, setMapKey } from './keys.js';
import {
  isAtLineBreakOrEnd,
  isBlankOrEnd,
  isDocumentMarker,
  isLineStart,
  skipComment,
  skipNewlinesAndComments,
  skipSpaces,
} from './navigation.js';
import { mergeNodeProperties, readNodeProperties } from './properties.js';
import {
  findPlainLineEnd,
  parseBlockScalar,
  parseDoubleQuoted,
  parsePlainKey,
  parsePlainScalar,
  parseSingleQuoted,
} from './strings.js';
import {
  checkCollectionTag,
  resolveEmptyNode,
  resolvePlainScalar,
  resolveTextScalar,
} from './tags.js';

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

const opensBlockCollection = (state: ParserState, code: number): boolean =>
  (code === CHAR_MINUS || code === CHAR_QUESTION) &&
  isBlankOrEnd(state, state.pos + 1);

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
      quoteCharCode === CHAR_DOUBLE_QUOTE &&
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

const isContentIndicator = (code: number): boolean =>
  code === CHAR_SINGLE_QUOTE ||
  code === CHAR_DOUBLE_QUOTE ||
  code === CHAR_LEFT_BRACKET ||
  code === CHAR_LEFT_BRACE ||
  code === CHAR_PIPE ||
  code === CHAR_GREATER_THAN ||
  code === CHAR_STAR;

const opensImplicitKey = (state: ParserState): boolean => {
  const code = state.src.charCodeAt(state.pos);

  if (code === CHAR_SINGLE_QUOTE || code === CHAR_DOUBLE_QUOTE)
    return isQuotedMapKey(state, code);

  return !isContentIndicator(code) && hasMappingIndicatorInLine(state);
};

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
  allowsIndentlessSequence: boolean,
  properties: NodeProperties | undefined
): unknown => {
  const nextIndent = skipNewlinesAndComments(state);

  if (state.pos >= state.len || isDocumentMarker(state, state.pos))
    return resolveEmptyNode(state, properties?.tag);

  if (nextIndent > ownerIndent)
    return parseValue(
      state,
      ownerIndent,
      nextIndent,
      allowsIndentlessSequence,
      properties
    );

  const opensIndentlessSequence =
    allowsIndentlessSequence &&
    nextIndent === ownerIndent &&
    isSequenceEntry(state);

  state.pos -= nextIndent;

  return opensIndentlessSequence
    ? parseBlockSequence(state, ownerIndent, false, properties?.tag)
    : resolveEmptyNode(state, properties?.tag);
};

const parseSequenceEntry = (state: ParserState, indent: number): unknown => {
  const dashStart = state.pos;

  state.pos++;
  skipSpaces(state);

  const contentStart = state.pos;
  const contentColumn = indent + contentStart - dashStart;
  const properties = readNodeProperties(state, false);

  skipComment(state);

  if (isAtLineBreakOrEnd(state))
    return withAnchor(
      state,
      properties?.anchor,
      parseNextLineValue(state, indent, false, properties)
    );

  const value = parseInlineValue(
    state,
    indent,
    contentColumn,
    contentStart,
    properties?.tag
  );

  finishLine(state);

  return withAnchor(state, properties?.anchor, value);
};

const parseBlockSequence = (
  state: ParserState,
  indent: number,
  isInline: boolean,
  tag: NodeTag | undefined
): unknown[] => {
  enterCollection(state);
  checkCollectionTag(state, tag, 'seq');

  const result: unknown[] = [];

  if (isInline) result.push(parseSequenceEntry(state, indent));

  while (enterBlockLine(state, indent)) {
    if (!isSequenceEntry(state)) {
      state.pos -= indent;
      break;
    }

    result.push(parseSequenceEntry(state, indent));
  }

  leaveCollection(state);

  return result;
};

const parseScalarOrFlowNode = (
  state: ParserState,
  ownerIndent: number,
  tag: NodeTag | undefined
): unknown => {
  const code = state.src.charCodeAt(state.pos);

  if (code === CHAR_SINGLE_QUOTE)
    return resolveTextScalar(state, tag, parseSingleQuoted(state));
  if (code === CHAR_DOUBLE_QUOTE)
    return resolveTextScalar(state, tag, parseDoubleQuoted(state));
  if (code === CHAR_LEFT_BRACKET)
    return parseFlowSequence(state, ownerIndent, tag);
  if (code === CHAR_LEFT_BRACE) return parseFlowMap(state, ownerIndent, tag);
  if (code === CHAR_PIPE || code === CHAR_GREATER_THAN)
    return resolveTextScalar(state, tag, parseBlockScalar(state, ownerIndent));
  if (code === CHAR_STAR) return parseAlias(state, tag);

  return resolvePlainScalar(
    state,
    tag,
    parsePlainScalar(state, ownerIndent, false)
  );
};

const parseMapValue = (state: ParserState, indent: number): unknown => {
  const properties = readNodeProperties(state, false);

  skipComment(state);

  return withAnchor(
    state,
    properties?.anchor,
    isAtLineBreakOrEnd(state)
      ? parseNextLineValue(state, indent, true, properties)
      : parseScalarOrFlowNode(state, indent, properties?.tag)
  );
};

const parseMapKey = (
  state: ParserState,
  indent: number,
  tag: NodeTag | undefined
): unknown => {
  const keyCode = state.src.charCodeAt(state.pos);

  if (keyCode === CHAR_SINGLE_QUOTE)
    return resolveTextScalar(state, tag, parseSingleQuoted(state));
  if (keyCode === CHAR_DOUBLE_QUOTE)
    return resolveTextScalar(state, tag, parseDoubleQuoted(state));
  if (keyCode === CHAR_LEFT_BRACKET)
    return parseFlowSequence(state, indent, tag);
  if (keyCode === CHAR_LEFT_BRACE) return parseFlowMap(state, indent, tag);
  if (keyCode === CHAR_STAR) return parseAlias(state, tag);
  if (opensBlockCollection(state, keyCode))
    throw collectionKeyError(state, state.pos);

  return resolvePlainScalar(state, tag, parsePlainKey(state));
};

const parseMapEntry = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number
): void => {
  const entryStart = state.pos;
  const properties = readNodeProperties(state, false);
  const key = withAnchor(
    state,
    properties?.anchor,
    parseMapKey(state, indent, properties?.tag)
  );

  skipSpaces(state);

  if (state.src.charCodeAt(state.pos) !== CHAR_COLON)
    throw syntaxError(
      state,
      'A line in a block mapping is not an entry: expected "key: value"',
      entryStart
    );

  skipIndicator(state);
  setMapKey(state, result, key, entryStart, parseMapValue(state, indent));
  finishLine(state);
};

const parseExplicitKey = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number
): void => {
  skipIndicator(state);

  const keyStart = state.pos;
  const properties = readNodeProperties(state, false);
  const key = withAnchor(
    state,
    properties?.anchor,
    isAtLineBreakOrEnd(state)
      ? resolveEmptyNode(state, properties?.tag)
      : parseMapKey(state, indent, properties?.tag)
  );

  finishLine(state);

  const nextIndent = skipNewlinesAndComments(state);

  if (nextIndent === indent && isMappingValue(state)) {
    skipIndicator(state);
    setMapKey(state, result, key, keyStart, parseMapValue(state, indent));
    finishLine(state);

    return;
  }

  if (state.pos < state.len && nextIndent > indent)
    throw syntaxError(
      state,
      `An explicit key is followed by an unexpected line: expected ":" at ${indent} spaces of indentation, or the next entry`
    );

  setMapKey(state, result, key, keyStart, null);

  state.pos -= nextIndent;
};

const parseBlockMap = (
  state: ParserState,
  indent: number,
  isInline: boolean,
  tag: NodeTag | undefined
): Record<string, unknown> => {
  enterCollection(state);
  checkCollectionTag(state, tag, 'map');

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

  leaveCollection(state);

  return result;
};

const parseCompactMap = (
  state: ParserState,
  column: number,
  contentStart: number
): Record<string, unknown> => {
  state.pos = contentStart;

  return parseBlockMap(state, column, true, undefined);
};

const parseCompactSequence = (
  state: ParserState,
  column: number,
  tag: NodeTag | undefined
): unknown[] => {
  if (tag !== undefined)
    throw syntaxError(
      state,
      `The tag ${tag.source} labels a sequence that starts on the same line: expected the tag alone on its line, with the sequence entries below it`,
      tag.start
    );

  return parseBlockSequence(state, column, true, undefined);
};

const parseInlineValue = (
  state: ParserState,
  ownerIndent: number,
  column: number,
  contentStart: number,
  tag: NodeTag | undefined
): unknown => {
  if (isSequenceEntry(state)) return parseCompactSequence(state, column, tag);
  if (opensImplicitKey(state))
    return parseCompactMap(state, column, contentStart);

  return parseScalarOrFlowNode(state, ownerIndent, tag);
};

const parseValueContent = (
  state: ParserState,
  ownerIndent: number,
  lineStart: number,
  lineIndent: number,
  own: NodeProperties | undefined,
  inherited: NodeProperties | undefined
): unknown => {
  if (isSequenceEntry(state)) {
    state.pos = lineStart;
    return parseBlockSequence(state, lineIndent, false, inherited?.tag);
  }

  if (isExplicitKey(state) || opensImplicitKey(state)) {
    state.pos = lineStart;
    return parseBlockMap(state, lineIndent, false, inherited?.tag);
  }

  return parseScalarOrFlowNode(
    state,
    ownerIndent,
    mergeNodeProperties(state, inherited, own)?.tag
  );
};

export const parseValue = (
  state: ParserState,
  ownerIndent: number,
  lineIndent: number,
  allowsIndentlessSequence: boolean,
  inherited: NodeProperties | undefined
): unknown => {
  const lineStart = state.pos - lineIndent;
  const own = readNodeProperties(state, false);

  skipComment(state);

  return withAnchor(
    state,
    own?.anchor,
    isAtLineBreakOrEnd(state)
      ? parseNextLineValue(
          state,
          ownerIndent,
          allowsIndentlessSequence,
          mergeNodeProperties(state, inherited, own)
        )
      : parseValueContent(
          state,
          ownerIndent,
          lineStart,
          lineIndent,
          own,
          inherited
        )
  );
};
