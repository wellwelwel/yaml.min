export type ParserState = {
  src: string;
  len: number;
  pos: number;
  depth: number;
  anchors: {
    nodes: Map<string, { value: unknown; size: number } | null>;
    expansion: number;
  };
  tagHandles: Map<string, string>;
};

export type AnchorDeclaration = {
  name: string;
  contentStart: number;
  expansionAtStart: number;
};

export type TagName =
  | '!'
  | 'str'
  | 'int'
  | 'float'
  | 'bool'
  | 'null'
  | 'seq'
  | 'map';

export type NodeTag = {
  name: TagName;
  source: string;
  start: number;
};

export type NodeProperties = {
  anchor: AnchorDeclaration | undefined;
  tag: NodeTag | undefined;
};

export type FlowCollection = {
  name: string;
  open: string;
  closeCode: number;
  foreignCloseCode: number;
};

export type BlockScalarHeader = {
  chomp: '' | '-' | '+';
  explicitIndent: number;
};
