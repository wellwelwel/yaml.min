import type { ParserState, SourceLocation, YamlErrorCode } from '../types.js';
import { YamlError } from '../error.js';
import { CHAR_LINE_FEED } from './chars.js';

const QUOTE_LIMIT = 40;

const HIDDEN_CHARACTER =
  /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/u;

export const codePointLabel = (codePoint: number): string =>
  `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

const showCharacter = (character: string): string => {
  if (HIDDEN_CHARACTER.test(character))
    return `[${codePointLabel(character.codePointAt(0)!)}]`;
  if (character === '"' || character === '\\') return `\\${character}`;

  return character;
};

export const quote = (text: string): string => {
  let shown = '';

  for (const character of text) {
    const visible = showCharacter(character);

    if (shown.length + visible.length > QUOTE_LIMIT) return `"${shown}…"`;

    shown += visible;
  }

  return `"${shown}"`;
};

export const characterAt = (state: ParserState, position: number): string =>
  String.fromCodePoint(state.src.codePointAt(position)!);

const locate = (state: ParserState, position: number): SourceLocation => {
  const end = Math.min(position, state.len);
  let line = 1;
  let lineStart = 0;

  for (let index = 0; index < end; index++) {
    if (state.src.charCodeAt(index) !== CHAR_LINE_FEED) continue;

    line++;
    lineStart = index + 1;
  }

  return { line, column: end - lineStart + 1 };
};

export const yamlError = (
  state: ParserState,
  code: YamlErrorCode,
  message: string,
  position: number = state.pos,
  cause?: RangeError
): YamlError => {
  const { line, column } = locate(state, position);

  return new YamlError(code, message, line, column, cause);
};

export const engineLimitError = (
  state: ParserState,
  cause: RangeError
): YamlError =>
  yamlError(
    state,
    'ENGINE_LIMIT',
    'The input exhausted an engine limit, such as the call stack: expected a smaller or less deeply nested document',
    state.pos,
    cause
  );
