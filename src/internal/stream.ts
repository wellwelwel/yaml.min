import type { ParseOptions, ParserState } from '../types.js';
import { parseMapValue, parseValue } from './block.js';
import { CHAR_BYTE_ORDER_MARK, CHAR_PERCENT, NON_PRINTABLE } from './chars.js';
import { readMaxDepth } from './depth.js';
import { codePointLabel, quote, yamlError } from './errors.js';
import {
  isAtLineBreakOrEnd,
  isBlankOrEnd,
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
  const match = NON_PRINTABLE.exec(state.src);

  if (match === null) return;

  const position = match.index + match[0].length - 1;

  throw yamlError(
    state,
    'NON_PRINTABLE_CHARACTER',
    `The input holds the non-printable character ${codePointLabel(state.src.charCodeAt(position))}: expected printable characters, tabs, and line breaks only`,
    position
  );
};

export const createParserState = (
  input: string,
  options: ParseOptions | undefined
): ParserState => {
  if (typeof input !== 'string')
    throw new TypeError(
      'The input is not a string: expected a string holding the YAML source'
    );

  const maxDepth = readMaxDepth(options);
  const src =
    input.charCodeAt(0) === CHAR_BYTE_ORDER_MARK ? input.slice(1) : input;
  const state: ParserState = {
    src,
    len: src.length,
    pos: 0,
    depth: 0,
    maxDepth,
    bigint: options?.bigint === true,
    allowUnsafeKeys: options?.allowUnsafeKeys === true,
    anchors: { nodes: new Map(), expansion: 0, pending: undefined },
    tagHandles: new Map(),
  };

  rejectNonPrintable(state);

  return state;
};

const skipMarkerLine = (state: ParserState): void => {
  state.pos += 3;

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

const closeDocument = (state: ParserState): void => {
  skipBlanksAndComments(state);

  if (state.pos >= state.len || isDocumentStart(state, state.pos)) return;

  if (!isDocumentEnd(state, state.pos))
    throw yamlError(
      state,
      'UNEXPECTED_CONTENT',
      'Unexpected content after the end of the document: expected the end of input, "---" to start a new document, or "..." to end this one'
    );

  skipDocumentEndLine(state);
};

const isYamlDirective = (state: ParserState): boolean =>
  state.src.startsWith(YAML_DIRECTIVE, state.pos) &&
  isBlankOrEnd(state, state.pos + YAML_DIRECTIVE.length);

const isWellFormedYamlDirective = (
  state: ParserState,
  version: string
): boolean => isAtLineBreakOrEnd(state) && YAML_VERSION.test(version);

const readYamlDirective = (state: ParserState, isRepeated: boolean): void => {
  const directiveStart = state.pos;

  if (isRepeated)
    throw yamlError(
      state,
      'INVALID_DIRECTIVE',
      'A %YAML directive appears twice for the same document: expected at most one %YAML directive per document'
    );

  state.pos += YAML_DIRECTIVE.length;
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
  lineIndent === 0 && state.src.charCodeAt(state.pos) === CHAR_PERCENT;

const readDirectives = (state: ParserState): void => {
  let hasYamlDirective = false;
  let lineIndent: number;

  do {
    hasYamlDirective = readDirective(state, hasYamlDirective);
    lineIndent = skipNewlinesAndComments(state);
  } while (isDirectiveLine(state, lineIndent));

  if (!isDocumentStart(state, state.pos))
    throw yamlError(
      state,
      'INVALID_DIRECTIVE',
      'Directives are not followed by "---": expected a "---" line to start the document they apply to'
    );
};

export const skipToDocument = (state: ParserState): boolean => {
  state.tagHandles.clear();

  let lineIndent = skipNewlinesAndComments(state);

  while (isDocumentEnd(state, state.pos)) {
    skipDocumentEndLine(state);
    lineIndent = skipNewlinesAndComments(state);
  }

  if (state.pos >= state.len) return false;

  if (isDirectiveLine(state, lineIndent)) readDirectives(state);
  else state.pos -= lineIndent;

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
  state.anchors.nodes.clear();

  const value = isDocumentStart(state, state.pos)
    ? readMarkedDocumentRoot(state)
    : readBareDocumentRoot(state);

  closeDocument(state);

  return value;
};
