import type { ParserState } from '../types.js';
import {
  CHAR_0,
  CHAR_1,
  CHAR_9,
  CHAR_BACKSLASH,
  CHAR_COLON,
  CHAR_COMMA,
  CHAR_CR,
  CHAR_DQUOTE,
  CHAR_HASH,
  CHAR_LBRACE,
  CHAR_LBRACKET,
  CHAR_LF,
  CHAR_LOWER_U,
  CHAR_LOWER_X,
  CHAR_MINUS,
  CHAR_PIPE,
  CHAR_PLUS,
  CHAR_QUESTION,
  CHAR_RBRACE,
  CHAR_RBRACKET,
  CHAR_SPACE,
  CHAR_SQUOTE,
  CHAR_TAB,
  CHAR_UPPER_U,
  SIMPLE_ESCAPE_MAP,
} from './chars.js';
import { peekLineIndent, skipComment, skipSpaces } from './navigation.js';
import { trimEnd } from './scalars.js';

export const parseSingleQuoted = (state: ParserState): string => {
  state.pos++;

  let result = '';
  let captureStart = state.pos;

  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (code !== CHAR_SQUOTE && code !== CHAR_LF && code !== CHAR_CR) {
      state.pos++;
      continue;
    }

    if (code === CHAR_SQUOTE) {
      result += state.src.slice(captureStart, state.pos);

      if (state.src.charCodeAt(state.pos + 1) === CHAR_SQUOTE) {
        result += "'";
        state.pos += 2;
        captureStart = state.pos;
        continue;
      }

      state.pos++;
      return result;
    }

    // CHAR_LF or CHAR_CR (fold newline)
    result += state.src.slice(captureStart, state.pos);
    if (code === CHAR_CR) state.pos++;
    if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_LF)
      state.pos++;

    let emptyLineCount = 0;

    while (state.pos < state.len) {
      const whitespaceCode = state.src.charCodeAt(state.pos);

      if (whitespaceCode === CHAR_LF) emptyLineCount++;
      else if (whitespaceCode === CHAR_CR) {
        emptyLineCount++;
        if (state.src.charCodeAt(state.pos + 1) === CHAR_LF) state.pos++;
      } else if (whitespaceCode !== CHAR_SPACE && whitespaceCode !== CHAR_TAB)
        break;

      state.pos++;
    }

    result += emptyLineCount > 0 ? '\n'.repeat(emptyLineCount) : ' ';
    captureStart = state.pos;
  }

  return result + state.src.slice(captureStart, state.pos);
};

export const parseDoubleQuoted = (state: ParserState): string => {
  state.pos++;

  let result = '';
  let captureStart = state.pos;

  while (state.pos < state.len) {
    const code = state.src.charCodeAt(state.pos);

    if (
      code !== CHAR_DQUOTE &&
      code !== CHAR_BACKSLASH &&
      code !== CHAR_LF &&
      code !== CHAR_CR
    ) {
      state.pos++;
      continue;
    }

    if (code === CHAR_DQUOTE) {
      result += state.src.slice(captureStart, state.pos);
      state.pos++;
      return result;
    }

    if (code === CHAR_BACKSLASH) {
      result += state.src.slice(captureStart, state.pos);
      state.pos++;

      const escapeCode = state.src.charCodeAt(state.pos);

      if (escapeCode === CHAR_LF || escapeCode === CHAR_CR) {
        if (escapeCode === CHAR_CR) state.pos++;

        if (
          state.pos < state.len &&
          state.src.charCodeAt(state.pos) === CHAR_LF
        )
          state.pos++;

        while (
          state.pos < state.len &&
          (state.src.charCodeAt(state.pos) === CHAR_SPACE ||
            state.src.charCodeAt(state.pos) === CHAR_TAB)
        )
          state.pos++;

        captureStart = state.pos;
        continue;
      }

      const mapped =
        escapeCode < 128 ? SIMPLE_ESCAPE_MAP[escapeCode] : undefined;

      if (mapped !== undefined) {
        result += mapped;
        state.pos++;
      } else if (escapeCode === CHAR_LOWER_X) {
        state.pos++;
        result += String.fromCharCode(
          Number.parseInt(state.src.slice(state.pos, state.pos + 2), 16)
        );
        state.pos += 2;
      } else if (escapeCode === CHAR_LOWER_U) {
        state.pos++;
        result += String.fromCharCode(
          Number.parseInt(state.src.slice(state.pos, state.pos + 4), 16)
        );
        state.pos += 4;
      } else if (escapeCode === CHAR_UPPER_U) {
        state.pos++;
        result += String.fromCodePoint(
          Number.parseInt(state.src.slice(state.pos, state.pos + 8), 16)
        );
        state.pos += 8;
      } else {
        result += state.src[state.pos];
        state.pos++;
      }

      captureStart = state.pos;
      continue;
    }

    // CHAR_LF or CHAR_CR (fold newline)
    result += state.src.slice(captureStart, state.pos);

    if (code === CHAR_CR) state.pos++;
    if (state.pos < state.len && state.src.charCodeAt(state.pos) === CHAR_LF)
      state.pos++;

    let emptyLineCount = 0;

    while (state.pos < state.len) {
      const whitespaceCode = state.src.charCodeAt(state.pos);

      if (whitespaceCode === CHAR_LF) emptyLineCount++;
      else if (whitespaceCode === CHAR_CR) {
        emptyLineCount++;
        if (state.src.charCodeAt(state.pos + 1) === CHAR_LF) state.pos++;
      } else if (whitespaceCode !== CHAR_SPACE && whitespaceCode !== CHAR_TAB)
        break;

      state.pos++;
    }

    result += emptyLineCount > 0 ? '\n'.repeat(emptyLineCount) : ' ';
    captureStart = state.pos;
  }

  return result + state.src.slice(captureStart, state.pos);
};

const foldBlockLines = (contentLines: string[]): string => {
  let result = '';
  let prevMoreIndented = false;

  for (let lineIndex = 0; lineIndex < contentLines.length; lineIndex++) {
    const line = contentLines[lineIndex];

    if (line === '') {
      result += '\n';
      continue;
    }

    if (line[0] === ' ' || line[0] === '\t') {
      if (result.length > 0 && !result.endsWith('\n')) result += '\n';
      result += line;
      if (lineIndex < contentLines.length - 1) result += '\n';
      prevMoreIndented = true;
      continue;
    }

    if (
      lineIndex > 0 &&
      !prevMoreIndented &&
      contentLines[lineIndex - 1] !== ''
    ) {
      result += ' ';
    } else if (prevMoreIndented) {
      result += '\n';
    }

    result += line;
    prevMoreIndented = false;
  }

  return result;
};

export const parseBlockScalar = (
  state: ParserState,
  baseIndent: number
): string => {
  const isLiteral = state.src.charCodeAt(state.pos) === CHAR_PIPE;

  state.pos++;

  let chomp: '' | '-' | '+' = '';
  let explicitIndent = 0;

  while (state.pos < state.len) {
    const headerCode = state.src.charCodeAt(state.pos);

    if (
      headerCode === CHAR_LF ||
      headerCode === CHAR_CR ||
      headerCode === CHAR_HASH
    )
      break;

    if (headerCode === CHAR_MINUS) chomp = '-';
    else if (headerCode === CHAR_PLUS) chomp = '+';
    else if (headerCode >= CHAR_1 && headerCode <= CHAR_9)
      explicitIndent = headerCode - CHAR_0;
    else if (headerCode !== CHAR_SPACE && headerCode !== CHAR_TAB) break;

    state.pos++;
  }

  skipSpaces(state);
  skipComment(state);

  if (state.pos < state.len) {
    const newlineAfterHeader = state.src.charCodeAt(state.pos);

    if (newlineAfterHeader === CHAR_CR || newlineAfterHeader === CHAR_LF) {
      if (
        newlineAfterHeader === CHAR_CR &&
        state.src.charCodeAt(state.pos + 1) === CHAR_LF
      )
        state.pos++;

      state.pos++;
    }
  }

  let contentIndent = 0;
  if (explicitIndent > 0) {
    contentIndent = baseIndent + explicitIndent;
  } else {
    const savedPos = state.pos;

    while (state.pos < state.len) {
      let spaces = 0;

      while (
        state.pos < state.len &&
        state.src.charCodeAt(state.pos) === CHAR_SPACE
      ) {
        spaces++;
        state.pos++;
      }
      if (state.pos < state.len) {
        const indentLineCode = state.src.charCodeAt(state.pos);

        if (indentLineCode !== CHAR_LF && indentLineCode !== CHAR_CR) {
          contentIndent = spaces;
          break;
        }

        if (indentLineCode === CHAR_CR) state.pos++;

        if (
          state.pos < state.len &&
          state.src.charCodeAt(state.pos) === CHAR_LF
        )
          state.pos++;
      }
    }

    state.pos = savedPos;
  }

  if (contentIndent === 0) {
    if (chomp === '+') return '\n';
    return '';
  }

  const lines: string[] = [];

  while (state.pos < state.len) {
    const lineStart = state.pos;
    let spaces = 0;

    while (
      state.pos < state.len &&
      state.src.charCodeAt(state.pos) === CHAR_SPACE
    ) {
      spaces++;
      state.pos++;
    }

    if (state.pos >= state.len) {
      lines.push('');
      break;
    }

    const lineEndCode = state.src.charCodeAt(state.pos);

    if (lineEndCode === CHAR_LF || lineEndCode === CHAR_CR) {
      lines.push('');

      if (
        lineEndCode === CHAR_CR &&
        state.src.charCodeAt(state.pos + 1) === CHAR_LF
      )
        state.pos++;

      state.pos++;
      continue;
    }

    if (spaces < contentIndent) {
      state.pos = lineStart;
      break;
    }

    const prefix =
      spaces > contentIndent ? ' '.repeat(spaces - contentIndent) : '';

    const lineContentStart = state.pos;

    while (state.pos < state.len) {
      const contentCode = state.src.charCodeAt(state.pos);

      if (contentCode === CHAR_LF || contentCode === CHAR_CR) break;
      state.pos++;
    }

    lines.push(prefix + state.src.slice(lineContentStart, state.pos));

    if (state.pos < state.len) {
      if (
        state.src.charCodeAt(state.pos) === CHAR_CR &&
        state.src.charCodeAt(state.pos + 1) === CHAR_LF
      )
        state.pos++;

      state.pos++;
    }
  }

  let trailingEmpties = 0;

  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    if (lines[lineIndex] === '') trailingEmpties++;
    else break;
  }

  const contentLines =
    trailingEmpties > 0
      ? lines.slice(0, lines.length - trailingEmpties)
      : lines;

  const content = isLiteral
    ? contentLines.join('\n')
    : foldBlockLines(contentLines);

  if (chomp === '-') return content;
  if (chomp === '+') return `${content}\n${'\n'.repeat(trailingEmpties)}`;
  return `${content}\n`;
};

const capturePlainLine = (state: ParserState, inFlow: boolean): string => {
  const captureStart = state.pos;
  while (state.pos < state.len) {
    const charCode = state.src.charCodeAt(state.pos);

    if (charCode === CHAR_LF || charCode === CHAR_CR) break;

    if (charCode === CHAR_HASH && state.pos > 0) {
      const prevCode = state.src.charCodeAt(state.pos - 1);

      if (prevCode === CHAR_SPACE || prevCode === CHAR_TAB) break;
    }

    if (charCode === CHAR_COLON) {
      const afterColon =
        state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

      if (
        !inFlow &&
        (afterColon === -1 ||
          afterColon === CHAR_SPACE ||
          afterColon === CHAR_LF ||
          afterColon === CHAR_CR ||
          afterColon === CHAR_TAB)
      )
        break;

      if (
        inFlow &&
        (afterColon === -1 ||
          afterColon === CHAR_SPACE ||
          afterColon === CHAR_COMMA ||
          afterColon === CHAR_RBRACKET ||
          afterColon === CHAR_RBRACE)
      )
        break;
    }

    if (
      inFlow &&
      (charCode === CHAR_COMMA ||
        charCode === CHAR_RBRACKET ||
        charCode === CHAR_RBRACE ||
        charCode === CHAR_LBRACE ||
        charCode === CHAR_LBRACKET)
    )
      break;

    state.pos++;
  }

  return state.src.slice(captureStart, state.pos);
};

export const parsePlainScalar = (
  state: ParserState,
  minIndent: number,
  inFlow: boolean
): string => {
  let result = capturePlainLine(state, inFlow);

  while (state.pos < state.len) {
    const savedPos = state.pos;
    let emptyLineCount = 0;

    while (state.pos < state.len) {
      const whitespaceCode = state.src.charCodeAt(state.pos);

      if (whitespaceCode === CHAR_LF) emptyLineCount++;
      else if (whitespaceCode === CHAR_CR) {
        emptyLineCount++;
        if (state.src.charCodeAt(state.pos + 1) === CHAR_LF) state.pos++;
      } else if (whitespaceCode !== CHAR_SPACE && whitespaceCode !== CHAR_TAB)
        break;

      state.pos++;
    }

    const lineIndent = peekLineIndent(state);

    if (state.pos >= state.len || lineIndent <= minIndent) {
      state.pos = savedPos;
      break;
    }

    const peekedCode = state.src.charCodeAt(state.pos);

    if (peekedCode === CHAR_HASH) {
      state.pos = savedPos;
      break;
    }

    if (
      !inFlow &&
      (peekedCode === CHAR_MINUS ||
        peekedCode === CHAR_COLON ||
        peekedCode === CHAR_QUESTION)
    ) {
      const indicatorNext =
        state.pos + 1 >= state.len ? -1 : state.src.charCodeAt(state.pos + 1);

      if (
        indicatorNext === -1 ||
        indicatorNext === CHAR_SPACE ||
        indicatorNext === CHAR_LF ||
        indicatorNext === CHAR_CR ||
        indicatorNext === CHAR_TAB
      ) {
        state.pos = savedPos;
        break;
      }
    }

    result += emptyLineCount > 1 ? '\n'.repeat(emptyLineCount - 1) : ' ';
    result += capturePlainLine(state, inFlow);
  }

  return trimEnd(result);
};
