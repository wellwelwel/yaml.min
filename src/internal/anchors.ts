import type { AnchorDeclaration, ParserState } from '../types.js';
import {
  CHAR_AMPERSAND,
  CHAR_COLON,
  CHAR_COMMA,
  CHAR_EXCLAMATION,
  CHAR_RIGHT_BRACE,
  CHAR_RIGHT_BRACKET,
  isBlank,
} from './chars.js';
import { syntaxError } from './errors.js';
import { isBlankOrEnd, skipSpaces } from './navigation.js';

const MIN_ALIAS_EXPANSION_LIMIT = 1_000_000;
const ALIAS_EXPANSION_PER_INPUT_CHARACTER = 10;

const isAnchorNameEnd = (code: number): boolean =>
  isBlank(code) ||
  code === CHAR_COMMA ||
  code === CHAR_RIGHT_BRACKET ||
  code === CHAR_RIGHT_BRACE ||
  code === CHAR_COLON;

const readAnchorName = (state: ParserState): string => {
  const start = state.pos;

  while (
    state.pos < state.len &&
    !isAnchorNameEnd(state.src.charCodeAt(state.pos))
  )
    state.pos++;

  return state.src.slice(start, state.pos);
};

const skipTag = (state: ParserState): void => {
  while (!isBlankOrEnd(state, state.pos)) state.pos++;
};

const declareAnchor = (state: ParserState, name: string): AnchorDeclaration => {
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

export const readAnchorOrTag = (
  state: ParserState
): AnchorDeclaration | undefined => {
  let name: string | undefined;

  while (state.pos < state.len) {
    skipSpaces(state);

    const code = state.src.charCodeAt(state.pos);

    if (code === CHAR_EXCLAMATION) {
      skipTag(state);
      continue;
    }

    if (code !== CHAR_AMPERSAND) break;

    if (name !== undefined)
      throw syntaxError(
        state,
        `A node carries a second anchor after "&${name}": expected at most one anchor per node`
      );

    state.pos++;
    name = readAnchorName(state);
  }

  return name ? declareAnchor(state, name) : undefined;
};

export const parseAlias = (state: ParserState): unknown => {
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
