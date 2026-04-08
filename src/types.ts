export type ParserState = {
  src: string;
  len: number;
  pos: number;
  depth: number;
  lastAnchor: string | undefined;
  anchors: Map<string, unknown>;
};
