import type { NodeProperties, NodeTag, ParserState } from '../types.js';
import { parseAlias, withAnchor } from './anchors.js';
import { parseBlockScalar } from './block-scalars.js';
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
  isContentIndicator,
  isQuote,
  isSpaceOrTab,
} from './chars.js';
import { enterCollection, leaveCollection } from './depth.js';
import { quote, yamlError } from './errors.js';
import { parseFlowMap, parseFlowSequence } from './flow.js';
import {
  checkImplicitKey,
  collectionKeyError,
  isQuotedStrKey,
  setMapKey,
} from './keys.js';
import {
  countIndentSpaces,
  isAtLineBreakOrEnd,
  isBlankOrEnd,
  isDocumentBoundary,
  isLineStart,
  skipComment,
  skipNewlinesAndComments,
  skipSpaces,
} from './navigation.js';
import {
  findPlainLineEnd,
  parsePlainKey,
  parsePlainScalar,
} from './plain-scalars.js';
import { mergeNodeProperties, readNodeProperties } from './properties.js';
import { parseDoubleQuoted, parseSingleQuoted } from './quoted-scalars.js';
import {
  checkCollectionTag,
  resolveEmptyNode,
  resolvePlainScalar,
  resolveTextScalar,
} from './tags.js';

const isIndicatorAt = (state: ParserState, indicatorCode: number): boolean =>
  state.source.charCodeAt(state.position) === indicatorCode &&
  isBlankOrEnd(state, state.position + 1);

const isSequenceEntry = (state: ParserState): boolean =>
  isIndicatorAt(state, CHAR_MINUS);

const isExplicitKey = (state: ParserState): boolean =>
  isIndicatorAt(state, CHAR_QUESTION);

const isMappingValue = (state: ParserState): boolean =>
  isIndicatorAt(state, CHAR_COLON);

const opensBlockCollection = (state: ParserState): boolean =>
  isSequenceEntry(state) || isExplicitKey(state);

const skipIndicator = (state: ParserState): void => {
  state.position++;

  if (state.source.charCodeAt(state.position) === CHAR_SPACE) state.position++;
};

const isQuotedMapKey = (state: ParserState, quoteCharCode: number): boolean => {
  let lookAhead = state.position + 1;

  while (
    lookAhead < state.sourceLength &&
    state.source.charCodeAt(lookAhead) !== quoteCharCode
  ) {
    if (
      quoteCharCode === CHAR_DOUBLE_QUOTE &&
      state.source.charCodeAt(lookAhead) === CHAR_BACKSLASH
    )
      lookAhead++;

    lookAhead++;
  }

  if (lookAhead < state.sourceLength) lookAhead++;

  while (isSpaceOrTab(state.source.charCodeAt(lookAhead))) lookAhead++;

  if (
    lookAhead >= state.sourceLength ||
    state.source.charCodeAt(lookAhead) !== CHAR_COLON
  )
    return false;

  return isBlankOrEnd(state, lookAhead + 1);
};

const hasMappingIndicatorInLine = (state: ParserState): boolean =>
  state.source.charCodeAt(findPlainLineEnd(state, state.position, false)) ===
  CHAR_COLON;

const opensImplicitKey = (state: ParserState): boolean => {
  const code = state.source.charCodeAt(state.position);

  if (isQuote(code)) return isQuotedMapKey(state, code);

  return !isContentIndicator(code) && hasMappingIndicatorInLine(state);
};

const finishLine = (state: ParserState): void => {
  if (isAtLineBreakOrEnd(state) || isLineStart(state, state.position)) return;

  skipSpaces(state);
  skipComment(state);

  if (!isAtLineBreakOrEnd(state))
    throw yamlError(
      state,
      'UNEXPECTED_CONTENT',
      'Unexpected content after a value: expected a comment or the end of the line'
    );
};

const enterBlockLine = (state: ParserState, indent: number): boolean => {
  const lineIndent = skipNewlinesAndComments(state);

  if (state.position >= state.sourceLength) return false;

  if (lineIndent < indent || isDocumentBoundary(state, state.position)) {
    state.position -= lineIndent;
    return false;
  }

  if (lineIndent > indent)
    throw yamlError(
      state,
      'INVALID_INDENTATION',
      `A line is indented by ${lineIndent} spaces, which matches no open block collection: expected ${indent} spaces to continue the collection, or fewer to close it`
    );

  if (state.source.charCodeAt(state.position) === CHAR_TAB)
    throw yamlError(
      state,
      'INVALID_INDENTATION',
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

  if (
    state.position >= state.sourceLength ||
    isDocumentBoundary(state, state.position)
  )
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

  state.position -= nextIndent;

  return opensIndentlessSequence
    ? parseBlockSequence(state, ownerIndent, false, properties?.tag)
    : resolveEmptyNode(state, properties?.tag);
};

const parseIndicatedNode = (
  state: ParserState,
  indent: number,
  allowsIndentlessSequence: boolean
): unknown => {
  const indicatorStart = state.position;

  state.position++;
  skipSpaces(state);

  const contentStart = state.position;
  const properties = readNodeProperties(state, false);

  skipComment(state);

  if (isAtLineBreakOrEnd(state))
    return withAnchor(
      state,
      properties?.anchor,
      parseNextLineValue(state, indent, allowsIndentlessSequence, properties)
    );

  const value = parseInlineValue(
    state,
    indent,
    indicatorStart,
    contentStart,
    properties
  );

  finishLine(state);

  return value;
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

  if (isInline) result.push(parseIndicatedNode(state, indent, false));

  while (enterBlockLine(state, indent)) {
    if (!isSequenceEntry(state)) {
      state.position -= indent;
      break;
    }

    result.push(parseIndicatedNode(state, indent, false));
  }

  leaveCollection(state);

  return result;
};

const parseScalarOrFlowNode = (
  state: ParserState,
  ownerIndent: number,
  tag: NodeTag | undefined
): unknown => {
  const code = state.source.charCodeAt(state.position);

  if (code === CHAR_SINGLE_QUOTE)
    return resolveTextScalar(state, tag, parseSingleQuoted(state, ownerIndent));
  if (code === CHAR_DOUBLE_QUOTE)
    return resolveTextScalar(state, tag, parseDoubleQuoted(state, ownerIndent));
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

export const parseMapValue = (state: ParserState, indent: number): unknown => {
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
  const keyCode = state.source.charCodeAt(state.position);

  if (keyCode === CHAR_SINGLE_QUOTE)
    return resolveTextScalar(state, tag, parseSingleQuoted(state, indent));
  if (keyCode === CHAR_DOUBLE_QUOTE)
    return resolveTextScalar(state, tag, parseDoubleQuoted(state, indent));
  if (keyCode === CHAR_LEFT_BRACKET)
    return parseFlowSequence(state, indent, tag);
  if (keyCode === CHAR_LEFT_BRACE) return parseFlowMap(state, indent, tag);
  if (keyCode === CHAR_STAR) return parseAlias(state, tag);
  if (opensBlockCollection(state))
    throw collectionKeyError(state, state.position);

  return resolvePlainScalar(state, tag, parsePlainKey(state));
};

const parseMapEntry = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number
): void => {
  const entryStart = state.position;
  const properties = readNodeProperties(state, false);
  const isQuotedStr = isQuotedStrKey(state, properties?.tag);
  const key = withAnchor(
    state,
    properties?.anchor,
    parseMapKey(state, indent, properties?.tag)
  );

  skipSpaces(state);

  if (state.source.charCodeAt(state.position) !== CHAR_COLON)
    throw yamlError(
      state,
      'EXPECTED_MAPPING_ENTRY',
      'A line in a block mapping is not an entry: expected "key: value"',
      entryStart
    );

  checkImplicitKey(state, entryStart);
  skipIndicator(state);
  setMapKey(
    state,
    result,
    key,
    isQuotedStr,
    entryStart,
    parseMapValue(state, indent)
  );
  finishLine(state);
};

const parseExplicitMapEntry = (
  state: ParserState,
  result: Record<string, unknown>,
  indent: number
): void => {
  skipIndicator(state);

  const keyStart = state.position;
  const properties = readNodeProperties(state, false);
  const isQuotedStr = isQuotedStrKey(state, properties?.tag);
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
    setMapKey(
      state,
      result,
      key,
      isQuotedStr,
      keyStart,
      parseIndicatedNode(state, indent, true)
    );
    finishLine(state);

    return;
  }

  if (state.position < state.sourceLength && nextIndent > indent)
    throw yamlError(
      state,
      'EXPECTED_MAPPING_ENTRY',
      `An explicit key is followed by an unexpected line: expected ":" at ${indent} spaces of indentation, or the next entry`
    );

  setMapKey(state, result, key, isQuotedStr, keyStart, null);

  state.position -= nextIndent;
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
      parseExplicitMapEntry(state, result, indent);
      continue;
    }

    if (isSequenceEntry(state))
      throw yamlError(
        state,
        'EXPECTED_MAPPING_ENTRY',
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
  state.position = contentStart;

  return parseBlockMap(state, column, true, undefined);
};

const parseCompactSequence = (
  state: ParserState,
  column: number,
  tag: NodeTag | undefined
): unknown[] => {
  if (tag !== undefined)
    throw yamlError(
      state,
      'INVALID_TAG',
      `The tag ${quote(tag.source)} labels a sequence that starts on the same line: expected the tag alone on its line, with the sequence entries below it`,
      tag.start
    );

  return parseBlockSequence(state, column, true, undefined);
};

const compactCollectionColumn = (
  state: ParserState,
  indent: number,
  indicatorStart: number,
  contentStart: number
): number => {
  const separationStart = indicatorStart + 1;
  const spacesEnd = separationStart + countIndentSpaces(state, separationStart);

  if (spacesEnd < contentStart)
    throw yamlError(
      state,
      'INVALID_INDENTATION',
      'A tab separates a block indicator from the collection that starts after it on the same line: expected spaces, since YAML forbids tabs as indentation',
      spacesEnd
    );

  return indent + contentStart - indicatorStart;
};

const parseInlineValue = (
  state: ParserState,
  ownerIndent: number,
  indicatorStart: number,
  contentStart: number,
  properties: NodeProperties | undefined
): unknown => {
  if (isSequenceEntry(state))
    return withAnchor(
      state,
      properties?.anchor,
      parseCompactSequence(
        state,
        compactCollectionColumn(
          state,
          ownerIndent,
          indicatorStart,
          contentStart
        ),
        properties?.tag
      )
    );

  if (opensImplicitKey(state))
    return parseCompactMap(
      state,
      compactCollectionColumn(state, ownerIndent, indicatorStart, contentStart),
      contentStart
    );

  return withAnchor(
    state,
    properties?.anchor,
    parseScalarOrFlowNode(state, ownerIndent, properties?.tag)
  );
};

const parseValueContent = (
  state: ParserState,
  ownerIndent: number,
  lineStart: number,
  lineIndent: number,
  ownProperties: NodeProperties | undefined,
  inheritedProperties: NodeProperties | undefined
): unknown => {
  if (isSequenceEntry(state)) {
    state.position = lineStart;
    return parseBlockSequence(
      state,
      lineIndent,
      false,
      inheritedProperties?.tag
    );
  }

  if (isExplicitKey(state) || opensImplicitKey(state)) {
    state.position = lineStart;
    return parseBlockMap(state, lineIndent, false, inheritedProperties?.tag);
  }

  return withAnchor(
    state,
    ownProperties?.anchor,
    parseScalarOrFlowNode(
      state,
      ownerIndent,
      mergeNodeProperties(state, inheritedProperties, ownProperties)?.tag
    )
  );
};

export const parseValue = (
  state: ParserState,
  ownerIndent: number,
  lineIndent: number,
  allowsIndentlessSequence: boolean,
  inheritedProperties: NodeProperties | undefined
): unknown => {
  const lineStart = state.position - lineIndent;
  const ownProperties = readNodeProperties(state, false);

  skipComment(state);

  if (!isAtLineBreakOrEnd(state))
    return parseValueContent(
      state,
      ownerIndent,
      lineStart,
      lineIndent,
      ownProperties,
      inheritedProperties
    );

  return withAnchor(
    state,
    ownProperties?.anchor,
    parseNextLineValue(
      state,
      ownerIndent,
      allowsIndentlessSequence,
      mergeNodeProperties(state, inheritedProperties, ownProperties)
    )
  );
};
