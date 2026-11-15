/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it, strict } from 'poku';
import {
  assertParsesTo,
  parse,
  parseWithinTimeLimit,
  read,
} from '../__helpers__/index.mts';

describe('A literal block scalar keeps its line breaks and a folded one joins its lines', () => {
  const blockScalars = {
    'a literal scalar': {
      file: 'block-scalars--block-literal.yaml',
      expected: 'hello\nworld\n',
    },
    'a folded scalar': {
      file: 'block-scalars--block-folded.yaml',
      expected: 'hello world\n',
    },
    'a literal scalar as a mapping value': {
      file: 'block-scalars--block-scalar-literal-in-map.yaml',
      expected: { data: 'line 1\nline 2\n', other: 'value' },
    },
    'a folded scalar as a mapping value': {
      file: 'block-scalars--block-scalar-folded-in-map.yaml',
      expected: { data: 'line 1 line 2\n', other: 'value' },
    },
    'a folded scalar as a sequence entry': {
      file: 'block-scalars--folded-block-seq-inline.yaml',
      expected: ['hello world\n'],
    },
    'a literal scalar with more-indented lines': {
      file: 'block-scalars--block-literal-more-indented.yaml',
      expected: 'normal\n  indented\nback\n',
    },
    'a literal scalar with leading empty lines': {
      file: 'block-scalars--block-leading-empty.yaml',
      expected: '\n\ntext\n',
    },
  };

  for (const [name, { file, expected }] of Object.entries(blockScalars)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('Chomping strips, clips, or keeps the final line breaks of a block scalar', () => {
  const chompedScalars = {
    'strip on a literal scalar': {
      file: 'block-scalars--block-literal-strip.yaml',
      expected: 'text',
    },
    'keep on a literal scalar': {
      file: 'block-scalars--block-literal-keep.yaml',
      expected: 'text\n',
    },
    'clip on a scalar followed by empty lines': {
      file: 'block-scalars--block-trailing-empty-clip.yaml',
      expected: 'text\n',
    },
    'keep on a scalar followed by empty lines': {
      file: 'block-scalars--block-trailing-empty-keep.yaml',
      expected: 'text\n\n\n',
    },
    'strip on a scalar followed by empty lines': {
      file: 'block-scalars--block-trailing-empty-strip.yaml',
      expected: 'text',
    },
    'clip on a scalar whose last line break ends the input': {
      file: 'block-scalars--block-scalar-empty-line-eof.yaml',
      expected: 'text\n',
    },
    'clip on an empty literal scalar': {
      file: 'block-scalars--block-empty.yaml',
      expected: '',
    },
    'keep on an empty literal scalar': {
      file: 'block-scalars--block-empty-keep.yaml',
      expected: '',
    },
    'keep on an empty folded scalar': {
      file: 'block-scalars--block-empty-keep-folded.yaml',
      expected: '',
    },
  };

  for (const [name, { file, expected }] of Object.entries(chompedScalars)) {
    it(`applies ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('A block scalar header takes an indentation digit, a chomping indicator, and a comment', () => {
  const headers = {
    'an indentation digit': {
      file: 'block-scalars--block-explicit-indent.yaml',
      expected: 'text\n',
    },
    'a comment': {
      file: 'block-scalars--block-comment-after-header.yaml',
      expected: 'text\n',
    },
    'an indentation digit before a chomping indicator': {
      file: 'block-scalars--block-indent-chomp-combined.yaml',
      expected: 'text',
    },
    'a chomping indicator before an indentation digit': {
      file: 'block-scalars--block-chomp-indent-reversed.yaml',
      expected: 'text',
    },
  };

  for (const [name, { file, expected }] of Object.entries(headers)) {
    it(`reads a header with ${name}`, () =>
      assertParsesTo(read(file), expected));
  }
});

describe('A block scalar header is validated as a whole', () => {
  const malformedHeaders = {
    'two indentation digits': 'k: |12\n  text\n',
    'a repeated indentation digit': 'k: |22\n  text\n',
    'an indentation digit on both sides of a chomping indicator':
      'k: |2+2\n  text\n',
    'a keep indicator followed by strip': 'k: |+-\n  text\n',
    'a strip indicator followed by keep': 'k: |-+\n  text\n',
    'a repeated keep indicator': 'k: |++\n  text\n',
    'a zero indentation digit on a literal block':
      'cert: |0\n  -----BEGIN CERTIFICATE-----\n  MIIB\n',
    'a zero indentation digit on a folded block': 'k: >0\n  text\n',
    'a character that is neither indicator': 'k: |x\n  text\n',
    'a character that is neither indicator on a top-level block': read(
      'block-scalars--block-invalid-header-char.yaml'
    ),
    'a stray character after an indentation digit': 'k: |2x\n  text\n',
    'a stray character after a chomping indicator': 'k: >-x\n  text\n',
  };

  for (const [name, input] of Object.entries(malformedHeaders)) {
    it(`rejects a header with ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }

  it('accepts the highest indentation digit', () =>
    strict.deepEqual(parse('k: |9\n           text\n'), { k: '  text\n' }));
});

describe('A block scalar keeps the spaces beyond its indentation on lines that hold only spaces', () => {
  const spaceOnlyLines: Record<string, [string, unknown]> = {
    'a literal line between content lines': [
      'text: |\n  a\n    \n  b\n',
      { text: 'a\n  \nb\n' },
    ],
    'a literal line before the next entry': [
      'foo: |\n  x\n   \nbar: 1\n',
      { foo: 'x\n \n', bar: 1 },
    ],
    'a literal line at the end of input': [
      'foo: |\n  x\n   ',
      { foo: 'x\n \n' },
    ],
    'a keep line before a document end marker': [
      '--- |+\n ab\n \n  \n...\n',
      'ab\n\n \n',
    ],
  };

  for (const [name, [input, expected]] of Object.entries(spaceOnlyLines)) {
    it(`keeps them on ${name}`, () => assertParsesTo(input, expected));
  }

  it('reads lines no deeper than the indentation as empty lines', () =>
    assertParsesTo('text: |\n  a\n  \n \n  b\n', { text: 'a\n\n\nb\n' }));
});

describe('A folded block scalar keeps more-indented lines apart from their neighbors', () => {
  const foldedScalars: Record<string, [string, string]> = {
    'a more-indented line between text lines': [
      '>\n a\n  b\n c\n',
      'a\n b\nc\n',
    ],
    'an empty line before a more-indented line': [
      '>\n a\n\n  b\n',
      'a\n\n b\n',
    ],
    'an empty line after a more-indented line': [
      '>\n a\n  b\n\n c\n',
      'a\n b\n\nc\n',
    ],
    'a more-indented line that starts with a tab': [
      '>\n  foo \n \n  \t bar\n\n  baz\n',
      'foo \n\n\t bar\n\nbaz\n',
    ],
    'leading more-indented lines under an indentation indicator': [
      '>2\n\n\n   more indented\n  regular\n',
      '\n\n more indented\nregular\n',
    ],
    'the specification example of a folded scalar with more-indented lines': [
      '>\n Sammy Sosa completed another\n fine season with great stats.\n\n   63 Home Runs\n   0.288 Batting Average\n\n What a year!\n',
      'Sammy Sosa completed another fine season with great stats.\n\n  63 Home Runs\n  0.288 Batting Average\n\nWhat a year!\n',
    ],
  };

  for (const [name, [input, expected]] of Object.entries(foldedScalars)) {
    it(`folds ${name}`, () => assertParsesTo(input, expected));
  }
});

describe('Chomping counts the line breaks a block scalar really ends with', () => {
  const chompedScalars: Record<string, [string, unknown]> = {
    'keep on an empty block followed by two empty lines': [
      '- |+\n\n\n',
      ['\n\n'],
    ],
    'keep on an empty block with an indentation indicator': [
      'a: |2+\n\n\nb: 1\n',
      { a: '\n\n', b: 1 },
    ],
    'keep on an empty block with an indentation indicator at the end of input':
      ['--- |1+', ''],
    'keep on a block whose last line holds only its indentation': [
      'a: |+\n  x\n\n  ',
      { a: 'x\n\n' },
    ],
    'clip on an empty block with an indentation indicator': [
      'a: |2\n\nb: 1\n',
      { a: '', b: 1 },
    ],
  };

  for (const [name, [input, expected]] of Object.entries(chompedScalars)) {
    it(`applies ${name}`, () => assertParsesTo(input, expected));
  }
});

describe('A block scalar rejects indentation it cannot tell apart from its content', () => {
  const ambiguousIndentation: Record<string, [string, number]> = {
    'a leading empty line deeper than the first content line': [
      'block scalar: |\n     \n  more spaces at the beginning\n',
      2,
    ],
    'leading empty lines deeper than a first content line that looks like a comment':
      ['empty block scalar: >\n \n  \n   \n # comment\n', 4],
    'a tab where the indentation of its first line is expected': [
      'foo: |\n\t\nbar: 1\n',
      2,
    ],
  };

  const unambiguousIndentation: Record<string, [string, unknown]> = {
    'leading empty lines no deeper than the first content line': [
      '- >\n \n  \n  # detected\n',
      ['\n\n# detected\n'],
    ],
    'a leading line deeper than the content under an indentation indicator': [
      'a: |2\n     \n  x\n',
      { a: '   \nx\n' },
    ],
    'a tab after the indentation of the first line': [
      'foo: |\n \t\nbar: 1\n',
      { foo: '\t\n', bar: 1 },
    ],
  };

  for (const [name, [input, line]] of Object.entries(ambiguousIndentation)) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parse(input), {
        code: 'INVALID_INDENTATION',
        line,
      }));
  }

  for (const [name, [input, expected]] of Object.entries(
    unambiguousIndentation
  )) {
    it(`accepts ${name}`, () => assertParsesTo(input, expected));
  }
});

await describe('A folded block scalar folds in time proportional to its length', async () => {
  await it('folds 150,000 lines with more-indented lines among them within the time limit', async () => {
    const input = `text: >\n${'  line\n    more indented\n  line\n'.repeat(50_000)}`;
    const outcome = await parseWithinTimeLimit(input);

    strict.equal(outcome, 'returned');
  });
});
