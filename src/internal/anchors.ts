import type { YamlError } from '../error.js';
import type { AnchorDeclaration, NodeTag, ParserState } from '../types.js';
import { isBlank, isFlowIndicator } from './chars.js';
import { quote, yamlError } from './errors.js';

const MIN_ALIAS_EXPANSION_LIMIT = 1_000_000;
const ALIAS_EXPANSION_PER_INPUT_CHARACTER = 10;

const isAnchorNameEnd = (code: number): boolean =>
  isBlank(code) || isFlowIndicator(code);

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
  const anchor: AnchorDeclaration = {
    name,
    depth: state.depth,
    contentStart: state.pos,
    expansionAtStart: state.anchors.expansion,
  };

  state.anchors.nodes.set(name, null);
  state.anchors.pending = anchor;

  return anchor;
};

const childrenOf = (collection: object): unknown[] =>
  Array.isArray(collection) ? collection : Object.values(collection);

const collectionHeight = (value: unknown): number => {
  if (typeof value !== 'object' || value === null) return 0;

  let tallest = 0;

  for (const child of childrenOf(value)) {
    const height = collectionHeight(child);

    if (height > tallest) tallest = height;
  }

  return tallest + 1;
};

const deepFreeze = (value: unknown): void => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value))
    return;

  for (const child of childrenOf(value)) deepFreeze(child);

  Object.freeze(value);
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
): YamlError =>
  yamlError(
    state,
    'ALIAS_EXPANSION_TOO_LARGE',
    `The alias ${quote(`*${name}`)} makes aliases repeat more than ${aliasExpansionLimit(state)} characters of the document: expected aliases to repeat at most the larger of ${MIN_ALIAS_EXPANSION_LIMIT} characters and ${ALIAS_EXPANSION_PER_INPUT_CHARACTER} times the input length`,
    aliasStart
  );

const aliasNestingError = (
  state: ParserState,
  name: string,
  aliasStart: number
): YamlError =>
  yamlError(
    state,
    'NESTING_TOO_DEEP',
    `The alias ${quote(`*${name}`)} nests the collections it repeats more than ${state.maxDepth} levels deep: expected at most ${state.maxDepth} levels of nesting, including the levels aliases repeat`,
    aliasStart
  );

const aliasTagError = (state: ParserState, tag: NodeTag): YamlError =>
  yamlError(
    state,
    'INVALID_TAG',
    `The tag ${quote(tag.source)} labels an alias: expected an alias without a tag`,
    tag.start
  );

const aliasAnchorError = (
  state: ParserState,
  anchor: AnchorDeclaration
): YamlError =>
  yamlError(
    state,
    'INVALID_ALIAS',
    `The anchor ${quote(`&${anchor.name}`)} labels an alias: expected an alias without an anchor`
  );

const missingAnchorError = (
  state: ParserState,
  name: string,
  aliasStart: number
): YamlError =>
  yamlError(
    state,
    'UNKNOWN_ANCHOR',
    `The alias ${quote(`*${name}`)} names no anchor: expected ${quote(`&${name}`)} to be defined earlier in the same document`,
    aliasStart
  );

const unfinishedAnchorError = (
  state: ParserState,
  name: string,
  aliasStart: number
): YamlError =>
  yamlError(
    state,
    'UNKNOWN_ANCHOR',
    `The alias ${quote(`*${name}`)} refers to the node its own anchor labels, which is not finished yet: expected an alias to a node completed before it`,
    aliasStart
  );

export const parseAlias = (
  state: ParserState,
  tag: NodeTag | undefined
): unknown => {
  if (tag !== undefined) throw aliasTagError(state, tag);

  const { pending } = state.anchors;

  if (pending?.depth === state.depth) throw aliasAnchorError(state, pending);

  const aliasStart = state.pos;

  state.pos++;

  const name = readAnchorName(state);

  if (name === '')
    throw yamlError(
      state,
      'INVALID_ALIAS',
      'An alias has no name: expected an anchor name right after "*"',
      aliasStart
    );

  const node = state.anchors.nodes.get(name);

  if (node === undefined) throw missingAnchorError(state, name, aliasStart);
  if (node === null) throw unfinishedAnchorError(state, name, aliasStart);

  state.anchors.expansion += node.size;

  if (state.anchors.expansion > aliasExpansionLimit(state))
    throw aliasExpansionError(state, name, aliasStart);

  node.height ??= collectionHeight(node.value);

  if (state.depth + node.height > state.maxDepth)
    throw aliasNestingError(state, name, aliasStart);

  deepFreeze(node.value);

  return node.value;
};

export const withAnchor = (
  state: ParserState,
  anchor: AnchorDeclaration | undefined,
  value: unknown
): unknown => {
  if (anchor === undefined) return value;

  state.anchors.pending = undefined;
  state.anchors.nodes.set(anchor.name, {
    value,
    size:
      state.pos -
      anchor.contentStart +
      state.anchors.expansion -
      anchor.expansionAtStart,
    height: undefined,
  });

  return value;
};
