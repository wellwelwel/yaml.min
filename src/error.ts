import type { YamlErrorCode } from './types.js';

export class YamlError extends SyntaxError {
  readonly code: YamlErrorCode;
  readonly line: number;
  readonly column: number;

  constructor(
    code: YamlErrorCode,
    message: string,
    line: number,
    column: number,
    cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'YamlError';
    this.code = code;
    this.line = line;
    this.column = column;
  }
}
