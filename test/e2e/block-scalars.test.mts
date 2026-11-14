/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import {
  assertParsesTo,
  parseWithinTimeLimit,
  read,
} from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

describe('Block scalars', () => {
  it('literal', () =>
    assertParsesTo(
      read('block-scalars--block-literal.yaml'),
      'hello\nworld\n'
    ));

  it('folded', () =>
    assertParsesTo(read('block-scalars--block-folded.yaml'), 'hello world\n'));

  it('literal strip', () =>
    assertParsesTo(read('block-scalars--block-literal-strip.yaml'), 'text'));

  it('literal keep', () =>
    assertParsesTo(read('block-scalars--block-literal-keep.yaml'), 'text\n'));

  it('empty', () =>
    assertParsesTo(read('block-scalars--block-empty.yaml'), ''));
});

describe('Block scalars inside collections', () => {
  it('literal', () =>
    assertParsesTo(read('block-scalars--block-scalar-literal-in-map.yaml'), {
      data: 'line 1\nline 2\n',
      other: 'value',
    }));

  it('folded', () =>
    assertParsesTo(read('block-scalars--block-scalar-folded-in-map.yaml'), {
      data: 'line 1 line 2\n',
      other: 'value',
    }));

  it('folded block scalar as seq inline value', () =>
    assertParsesTo(read('block-scalars--folded-block-seq-inline.yaml'), [
      'hello world\n',
    ]));
});

describe('Top-level block scalars', () => {
  it('top-level literal block scalar', () =>
    assertParsesTo(read('block-scalars--top-level-literal.yaml'), 'hello\n'));

  it('top-level folded block scalar', () =>
    assertParsesTo(read('block-scalars--top-level-folded.yaml'), 'hello\n'));
});

describe('Block scalar edge cases', () => {
  it('empty block with keep chomp |+', () =>
    assertParsesTo(read('block-scalars--block-empty-keep.yaml'), '\n'));

  it('empty block with keep chomp >+', () =>
    assertParsesTo(read('block-scalars--block-empty-keep-folded.yaml'), '\n'));

  it('block scalar with trailing empty lines and clip', () =>
    assertParsesTo(
      read('block-scalars--block-trailing-empty-clip.yaml'),
      'text\n'
    ));

  it('block scalar with trailing empty lines and keep', () =>
    assertParsesTo(
      read('block-scalars--block-trailing-empty-keep.yaml'),
      'text\n\n\n'
    ));

  it('block scalar with trailing empty lines and strip', () =>
    assertParsesTo(
      read('block-scalars--block-trailing-empty-strip.yaml'),
      'text'
    ));

  it('block scalar ending with empty line at EOF', () =>
    assertParsesTo(
      read('block-scalars--block-scalar-empty-line-eof.yaml'),
      'text\n'
    ));

  it('block literal with more-indented lines', () =>
    assertParsesTo(
      read('block-scalars--block-literal-more-indented.yaml'),
      'normal\n  indented\nback\n'
    ));

  it('block scalar with leading empty lines', () =>
    assertParsesTo(
      read('block-scalars--block-leading-empty.yaml'),
      '\n\ntext\n'
    ));
});

describe('Block scalar headers', () => {
  it('block scalar with explicit indent indicator', () =>
    assertParsesTo(
      read('block-scalars--block-explicit-indent.yaml'),
      'text\n'
    ));

  it('block scalar with comment after header', () =>
    assertParsesTo(
      read('block-scalars--block-comment-after-header.yaml'),
      'text\n'
    ));

  it('explicit indent and chomp combined', () =>
    assertParsesTo(
      read('block-scalars--block-indent-chomp-combined.yaml'),
      'text'
    ));

  it('chomp and indent reversed', () =>
    assertParsesTo(
      read('block-scalars--block-chomp-indent-reversed.yaml'),
      'text'
    ));
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

await describe('A folded block scalar folds in time proportional to its length', async () => {
  await it('folds 150,000 lines with more-indented lines among them within the time limit', async () => {
    const input = `text: >\n${'  line\n    more indented\n  line\n'.repeat(50_000)}`;
    const outcome = await parseWithinTimeLimit(input);

    strict.equal(outcome, 'returned');
  });
});
