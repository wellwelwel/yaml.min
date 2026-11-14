import type { YamlError } from '../error.js';
import type { NodeProperties, NodeTag, ParserState } from '../types.js';
import { declareAnchor, readAnchorName } from './anchors.js';
import { CHAR_AMPERSAND, CHAR_EXCLAMATION } from './chars.js';
import { quote, yamlError } from './errors.js';
import { skipSpaces } from './navigation.js';
import { readTag } from './tags.js';

const secondAnchorError = (
  state: ParserState,
  firstAnchor: string
): YamlError =>
  yamlError(
    state,
    'DUPLICATE_ANCHOR',
    `A node carries a second anchor after ${quote(`&${firstAnchor}`)}: expected at most one anchor per node`
  );

const secondTagError = (
  state: ParserState,
  firstTag: string,
  position: number
): YamlError =>
  yamlError(
    state,
    'DUPLICATE_TAG',
    `A node carries a second tag after ${quote(firstTag)}: expected at most one tag per node`,
    position
  );

export const readNodeProperties = (
  state: ParserState,
  inFlow: boolean
): NodeProperties | undefined => {
  let name: string | undefined;
  let tag: NodeTag | undefined;

  while (state.pos < state.len) {
    skipSpaces(state);

    const code = state.src.charCodeAt(state.pos);

    if (code === CHAR_EXCLAMATION) {
      if (tag !== undefined) throw secondTagError(state, tag.source, state.pos);

      tag = readTag(state, inFlow);
      continue;
    }

    if (code !== CHAR_AMPERSAND) break;

    if (name !== undefined) throw secondAnchorError(state, name);

    state.pos++;
    name = readAnchorName(state);
  }

  if (!name && tag === undefined) return undefined;

  return {
    anchor: name ? declareAnchor(state, name) : undefined,
    tag,
  };
};

export const mergeNodeProperties = (
  state: ParserState,
  earlier: NodeProperties | undefined,
  later: NodeProperties | undefined
): NodeProperties | undefined => {
  if (earlier === undefined) return later;
  if (later === undefined) return earlier;
  if (earlier.anchor !== undefined && later.anchor !== undefined)
    throw secondAnchorError(state, earlier.anchor.name);
  if (earlier.tag !== undefined && later.tag !== undefined)
    throw secondTagError(state, earlier.tag.source, later.tag.start);

  return {
    anchor: earlier.anchor ?? later.anchor,
    tag: earlier.tag ?? later.tag,
  };
};
