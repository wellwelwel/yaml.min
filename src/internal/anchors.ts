import type { AnchorDeclaration, NodeTag, ParserState } from '../types.js';
import {
  CHAR_COLON,
  CHAR_COMMA,
  CHAR_RIGHT_BRACE,
  CHAR_RIGHT_BRACKET,
  isBlank,
} from './chars.js';
import { syntaxError } from './errors.js';

const MIN_ALIAS_EXPANSION_LIMIT = 1_000_000;
const ALIAS_EXPANSION_PER_INPUT_CHARACTER = 10;

const isAnchorNameEnd = (code: number): boolean =>
  isBlank(code) ||
  code === CHAR_COMMA ||
  code === CHAR_RIGHT_BRACKET ||
  code === CHAR_RIGHT_BRACE ||
  code === CHAR_COLON;

export const readAnchorName = (state: ParserState): string => {
  const start = state.pos;

  while (
    state.pos < state.len &&
    !isAnchorNameEnd(state.src.charCodeAt(state.pos))
  )
    state.pos++;

  return state.src.slice(start, state.pos);
};

export const declareAnchor = (
  state: ParserState,
  name: string
): AnchorDeclaration => {
  state.anchors.nodes.set(name, null);

  return {
    name,
    contentStart: state.pos,
    expansionAtStart: state.anchors.expansion,
  };
};

const aliasExpansionLimit = (state: ParserState): number =>
  Math.max(
    MIN_ALIAS_EXPANSION_LIMIT,
    ALIAS_EXPANSION_PER_INPUT_CHARACTER * state.len
  );

const aliasExpansionError = (
  state: ParserState,
  name: string,
  aliasStart: number
): SyntaxError =>
  syntaxError(
    state,
    `The alias "*${name}" makes aliases repeat more than ${aliasExpansionLimit(state)} characters of the document: expected aliases to repeat at most the larger of ${MIN_ALIAS_EXPANSION_LIMIT} characters and ${ALIAS_EXPANSION_PER_INPUT_CHARACTER} times the input length`,
    aliasStart
  );

export const parseAlias = (
  state: ParserState,
  tag: NodeTag | undefined
): unknown => {
  if (tag !== undefined)
    throw syntaxError(
      state,
      `The tag ${tag.source} labels an alias: expected an alias without a tag`,
      tag.start
    );

  const aliasStart = state.pos;

  state.pos++;

  const name = readAnchorName(state);

  if (name === '')
    throw syntaxError(
      state,
      'An alias has no name: expected an anchor name right after "*"',
      aliasStart
    );

  const node = state.anchors.nodes.get(name);

  if (node === undefined)
    throw syntaxError(
      state,
      `The alias "*${name}" names no anchor: expected "&${name}" to be defined earlier in the same document`,
      aliasStart
    );

  if (node === null)
    throw syntaxError(
      state,
      `The alias "*${name}" refers to the node its own anchor labels, which is not finished yet: expected an alias to a node completed before it`,
      aliasStart
    );

  state.anchors.expansion += node.size;

  if (state.anchors.expansion > aliasExpansionLimit(state))
    throw aliasExpansionError(state, name, aliasStart);

  return node.value;
};

export const withAnchor = (
  state: ParserState,
  anchor: AnchorDeclaration | undefined,
  value: unknown
): unknown => {
  if (anchor === undefined) return value;

  state.anchors.nodes.set(anchor.name, {
    value,
    size:
      state.pos -
      anchor.contentStart +
      state.anchors.expansion -
      anchor.expansionAtStart,
  });

  return value;
};
