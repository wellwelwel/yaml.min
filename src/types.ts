export type ParserState = {
  src: string;
  len: number;
  pos: number;
  depth: number;
  anchors: Map<string, unknown>;
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
