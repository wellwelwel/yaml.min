export type ParserState = {
  src: string;
  len: number;
  pos: number;
  depth: number;
  anchors: {
    nodes: Map<string, { value: unknown; size: number } | null>;
    expansion: number;
  };
};

export type AnchorDeclaration = {
  name: string;
  contentStart: number;
  expansionAtStart: number;
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
