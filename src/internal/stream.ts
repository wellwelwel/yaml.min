import type { ParseOptions, ParserState } from '../types.js';
import { parseMapValue, parseValue } from './block.js';
import {
  CHAR_BYTE_ORDER_MARK,
  CHAR_PERCENT,
  findNonPrintable,
} from './chars.js';
import { readMaxDepth } from './depth.js';
import { codePointLabel, quote, yamlError } from './errors.js';
import {
  isAtLineBreakOrEnd,
  isBlankOrEnd,
  isByteOrderMarkAfterLineBreak,
  isDocumentBoundary,
  isDocumentEnd,
  isDocumentStart,
  skipBlanksAndComments,
  skipComment,
  skipNewlinesAndComments,
  skipSpaces,
  skipToLineEnd,
} from './navigation.js';
import {
  isTagDirective,
  readDirectiveToken,
  readTagDirective,
} from './tags.js';

const YAML_DIRECTIVE = '%YAML';
const YAML_VERSION = /^[0-9]+\.[0-9]+$/;

const rejectNonPrintable = (state: ParserState): void => {
  const position = findNonPrintable(state.source);

  if (position === -1) return;

  throw yamlError(
    state,
    'NON_PRINTABLE_CHARACTER',
    `The input holds the non-printable character ${codePointLabel(state.source.charCodeAt(position))}: expected printable characters, tabs, and line breaks only`,
    position
  );
};

// V8 reads the flat copy that a join builds faster than a slice.
const withoutByteOrderMark = (input: string): string =>
  [input.slice(1, 2), input.slice(2)].join('');

export const createParserState = (
  input: string,
  options: ParseOptions | undefined
): ParserState => {
  if (typeof input !== 'string')
    throw new TypeError(
      'The input is not a string: expected a string holding the YAML source'
    );

  const maxDepth = readMaxDepth(options);
  const source =
    input.charCodeAt(0) === CHAR_BYTE_ORDER_MARK
      ? withoutByteOrderMark(input)
      : input;
  const state: ParserState = {
    source,
    sourceLength: source.length,
    lineFeeds: { start: 0, found: -1 },
    carriageReturns: { start: 0, found: -1 },
    position: 0,
    lastPlainLineStart: -1,
    lastPlainLineEnd: -1,
    lastIndentStart: -1,
    lastIndentWidth: 0,
    depth: 0,
    maxDepth,
    bigint: options?.bigint === true,
    allowUnsafeKeys: options?.allowUnsafeKeys === true,
    anchors: { nodes: undefined, expansion: 0, pending: undefined },
    tagHandles: undefined,
  };

  rejectNonPrintable(state);

  return state;
};

const skipMarkerLine = (state: ParserState): void => {
  state.position += 3;

  skipSpaces(state);
  skipComment(state);
};

const skipDocumentEndLine = (state: ParserState): void => {
  skipMarkerLine(state);

  if (!isAtLineBreakOrEnd(state))
    throw yamlError(
      state,
      'UNEXPECTED_CONTENT',
      'Unexpected content after "...": expected a comment or the end of the line'
    );
};

const skipDocumentPrefix = (state: ParserState): number => {
  let lineIndent = skipNewlinesAndComments(state);

  while (isByteOrderMarkAfterLineBreak(state, state.position)) {
    state.position++;
    lineIndent = skipNewlinesAndComments(state);
  }

  return lineIndent;
};

const finishDocument = (state: ParserState): void => {
  skipBlanksAndComments(state);

  if (
    state.position >= state.sourceLength ||
    isDocumentBoundary(state, state.position)
  )
    return;

  throw yamlError(
    state,
    'UNEXPECTED_CONTENT',
    'Unexpected content after the end of the document: expected the end of input, "---" to start a new document, or "..." to end this one'
  );
};

const isYamlDirective = (state: ParserState): boolean =>
  state.source.startsWith(YAML_DIRECTIVE, state.position) &&
  isBlankOrEnd(state, state.position + YAML_DIRECTIVE.length);

const isWellFormedYamlDirective = (
  state: ParserState,
  version: string
): boolean => isAtLineBreakOrEnd(state) && YAML_VERSION.test(version);

const readYamlDirective = (state: ParserState, isRepeated: boolean): void => {
  if (isRepeated)
    throw yamlError(
      state,
      'INVALID_DIRECTIVE',
      'A %YAML directive appears twice for the same document: expected at most one %YAML directive per document'
    );

  const directiveStart = state.position;

  state.position += YAML_DIRECTIVE.length;
  skipSpaces(state);

  const version = readDirectiveToken(state);

  skipSpaces(state);
  skipComment(state);

  if (!isWellFormedYamlDirective(state, version))
    throw yamlError(
      state,
      'INVALID_DIRECTIVE',
      'A %YAML directive is not well formed: expected "%YAML" and a single version such as "1.2"',
      directiveStart
    );

  if (Number.parseInt(version, 10) !== 1)
    throw yamlError(
      state,
      'INVALID_DIRECTIVE',
      `The %YAML directive asks for version ${quote(version)}: expected a YAML 1 version such as "1.2"`,
      directiveStart
    );
};

const readDirective = (
  state: ParserState,
  hasYamlDirective: boolean
): boolean => {
  if (isTagDirective(state)) {
    readTagDirective(state);
    return hasYamlDirective;
  }

  if (isYamlDirective(state)) {
    readYamlDirective(state, hasYamlDirective);
    return true;
  }

  skipToLineEnd(state);

  return hasYamlDirective;
};

const isDirectiveLine = (state: ParserState, lineIndent: number): boolean =>
  lineIndent === 0 && state.source.charCodeAt(state.position) === CHAR_PERCENT;

const readDirectives = (state: ParserState): void => {
  let hasYamlDirective = false;
  let lineIndent: number;

  do {
    hasYamlDirective = readDirective(state, hasYamlDirective);
    lineIndent = skipNewlinesAndComments(state);
  } while (isDirectiveLine(state, lineIndent));

  if (!isDocumentStart(state, state.position))
    throw yamlError(
      state,
      'INVALID_DIRECTIVE',
      'Directives are not followed by "---": expected a "---" line to start the document they apply to'
    );
};

const skipToDocumentStartAfterByteOrderMark = (state: ParserState): void => {
  const byteOrderMarkPosition = state.position;

  state.position++;
  skipNewlinesAndComments(state);

  if (!isDocumentStart(state, state.position))
    throw yamlError(
      state,
      'UNEXPECTED_DOCUMENT_MARKER',
      'A byte order mark starts a line inside a document: expected a "---" line after it to start the next document, or a "..." line before it to end this one',
      byteOrderMarkPosition
    );
};

export const skipToDocument = (state: ParserState): boolean => {
  state.tagHandles = undefined;

  if (state.position >= state.sourceLength) return false;

  if (isByteOrderMarkAfterLineBreak(state, state.position)) {
    skipToDocumentStartAfterByteOrderMark(state);
    return true;
  }

  let lineIndent = skipDocumentPrefix(state);

  while (isDocumentEnd(state, state.position)) {
    skipDocumentEndLine(state);
    lineIndent = skipDocumentPrefix(state);
  }

  if (state.position >= state.sourceLength) return false;

  if (isDirectiveLine(state, lineIndent)) readDirectives(state);
  else state.position -= lineIndent;

  return true;
};

const readMarkedDocumentRoot = (state: ParserState): unknown => {
  skipMarkerLine(state);

  return parseMapValue(state, -1);
};

const readBareDocumentRoot = (state: ParserState): unknown => {
  const lineIndent = skipNewlinesAndComments(state);

  return parseValue(state, -1, lineIndent, false, undefined);
};

export const readDocument = (state: ParserState): unknown => {
  state.anchors.nodes = undefined;

  const value = isDocumentStart(state, state.position)
    ? readMarkedDocumentRoot(state)
    : readBareDocumentRoot(state);

  finishDocument(state);

  return value;
};
