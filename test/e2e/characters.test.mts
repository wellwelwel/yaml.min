import { describe, it, strict } from 'poku';
import { parse, YamlError } from '../__helpers__/index.mts';

type CodeRange = [first: number, last: number];

type UnpairedSurrogate = { input: string; column: number };

// YAML 1.2.2, production [1] c-printable, up to U+FFFF.
const PRINTABLE_RANGES: CodeRange[] = [
  [0x09, 0x0a],
  [0x0d, 0x0d],
  [0x20, 0x7e],
  [0x85, 0x85],
  [0xa0, 0xd7ff],
  [0xe000, 0xfffd],
];
const SURROGATES: CodeRange = [0xd800, 0xdfff];
const CODE_UNIT_COUNT = 0x10000;

const isWithin = (code: number, [first, last]: CodeRange): boolean =>
  code >= first && code <= last;

const isPrintable = (code: number): boolean =>
  PRINTABLE_RANGES.some((range) => isWithin(code, range));

const codePointLabel = (code: number): string =>
  `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;

const isRejectedAsNonPrintable = (input: string): boolean => {
  try {
    parse(input);
  } catch (error) {
    if (error instanceof YamlError && error.code === 'NON_PRINTABLE_CHARACTER')
      return true;

    throw error;
  }

  return false;
};

describe('The input holds only the characters YAML calls printable', () => {
  const surroundingTexts = {
    'ASCII text': 'note',
    'Latin-1 text': 'café',
    'text beyond Latin-1': 'заметка',
  };
  const codeUnitsOutsideSurrogates = Array.from(
    { length: CODE_UNIT_COUNT },
    (_, code) => code
  ).filter((code) => !isWithin(code, SURROGATES));

  for (const [name, text] of Object.entries(surroundingTexts)) {
    it(`accepts every printable character and rejects every other one next to ${name}`, () => {
      const misjudged = codeUnitsOutsideSurrogates
        .filter(
          (code) =>
            isRejectedAsNonPrintable(
              `# ${text} ${String.fromCharCode(code)}\n`
            ) === isPrintable(code)
        )
        .map(codePointLabel);

      strict.deepEqual(misjudged, []);
    });
  }
});

describe('A surrogate is read only as half of a pair', () => {
  const unpairedSurrogates: Record<string, UnpairedSurrogate> = {
    'a high surrogate at the end of the input': {
      input: 'a: \uD83D',
      column: 4,
    },
    'a high surrogate before text': { input: 'a: \uD83Dx', column: 4 },
    'a low surrogate at the start of the input': {
      input: '\uDE42',
      column: 1,
    },
    'a low surrogate after text': { input: 'a: x\uDE42', column: 5 },
    'a low surrogate before a high surrogate': {
      input: 'a: \uDE42\uD83D',
      column: 4,
    },
    'a second high surrogate before a pair': {
      input: 'a: \uD83D🙂',
      column: 4,
    },
    'a second low surrogate after a pair': {
      input: 'a: 🙂\uDE42',
      column: 6,
    },
    'the first of two low surrogates at the start of the input': {
      input: '\uDE42\uDE42',
      column: 1,
    },
  };

  for (const [name, { input, column }] of Object.entries(unpairedSurrogates)) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parse(input), {
        code: 'NON_PRINTABLE_CHARACTER',
        line: 1,
        column,
      }));
  }

  it('reads a surrogate pair as one character', () =>
    strict.deepEqual(parse('a: 🙂'), { a: '\u{1F642}' }));
});
