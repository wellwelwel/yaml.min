export type ParseOptions = {
  /** How many levels collections can nest, however they are written, aliases included: an integer from `0` to `400`, `256` by default. */
  maxDepth?: number;
  /** Returns integers of up to 1,000 digits as `BigInt`, exactly. */
  bigint?: boolean;
  /** Accepts keys named `__proto__`, `prototype`, or after another `Object.prototype` member as ordinary own keys. */
  allowUnsafeKeys?: boolean;
};

export type YamlErrorCode =
  | 'ALIAS_EXPANSION_TOO_LARGE'
  | 'COLLECTION_KEY'
  | 'DUPLICATE_ANCHOR'
  | 'DUPLICATE_KEY'
  | 'DUPLICATE_TAG'
  | 'DUPLICATE_TAG_HANDLE'
  | 'ENGINE_LIMIT'
  | 'EXPECTED_MAPPING_ENTRY'
  | 'INVALID_ALIAS'
  | 'INVALID_ANCHOR'
  | 'INVALID_BLOCK_SCALAR_HEADER'
  | 'INVALID_DIRECTIVE'
  | 'INVALID_ESCAPE'
  | 'INVALID_INDENTATION'
  | 'INVALID_TAG'
  | 'MERGE_KEY'
  | 'MULTIPLE_DOCUMENTS'
  | 'NESTING_TOO_DEEP'
  | 'NON_PRINTABLE_CHARACTER'
  | 'TAG_MISMATCH'
  | 'UNDECLARED_TAG_HANDLE'
  | 'UNEXPECTED_CHARACTER'
  | 'UNEXPECTED_CONTENT'
  | 'UNEXPECTED_DOCUMENT_MARKER'
  | 'UNKNOWN_ANCHOR'
  | 'UNKNOWN_TAG'
  | 'UNSAFE_KEY'
  | 'UNTERMINATED_FLOW_COLLECTION'
  | 'UNTERMINATED_STRING';

export type SourceLocation = {
  line: number;
  column: number;
};

export type CharacterSearch = {
  start: number;
  found: number;
};

type AnchoredNode = {
  value: unknown;
  size: number;
  height: number | undefined;
};

export type ParserState = {
  source: string;
  sourceLength: number;
  lineFeeds: CharacterSearch;
  carriageReturns: CharacterSearch;
  position: number;
  lastPlainLineStart: number;
  lastPlainLineEnd: number;
  lastIndentStart: number;
  lastIndentWidth: number;
  depth: number;
  maxDepth: number;
  bigint: boolean;
  allowUnsafeKeys: boolean;
  anchors: {
    nodes: Map<string, AnchoredNode | null> | undefined;
    expansion: number;
    pending: AnchorDeclaration | undefined;
  };
  tagHandles: Map<string, string> | undefined;
};

export type AnchorDeclaration = {
  name: string;
  depth: number;
  contentStart: number;
  expansionAtStart: number;
};

export type TagName =
  '!' | 'str' | 'int' | 'float' | 'bool' | 'null' | 'seq' | 'map';

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
  close: string;
  closeCode: number;
  foreignCloseCode: number;
};

export type BlockScalarHeader = {
  chomp: '' | '-' | '+';
  explicitIndent: number;
};
