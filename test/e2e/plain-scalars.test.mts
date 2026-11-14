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

describe('Multiline plain scalars', () => {
  it('folds newlines', () =>
    assertParsesTo(
      read('plain-scalars--plain-multiline-folds.yaml'),
      'this is a multiline value'
    ));

  it('multiline ending at EOF', () =>
    assertParsesTo(read('plain-scalars--plain-multiline-eof.yaml'), 'a b'));

  it('multiline plain scalar ending at EOF after newline', () =>
    assertParsesTo(
      read('plain-scalars--plain-multiline-eof-newline.yaml'),
      'hello world'
    ));
});

describe('A multi-line plain scalar keeps its continuation lines', () => {
  const continuations = {
    'a mapping value': {
      input: 'k: first\n  second\n',
      expected: { k: 'first second' },
    },
    'a mapping value followed by another entry': {
      input: 'k: first\n  second\n  third\nother: 1\n',
      expected: { k: 'first second third', other: 1 },
    },
    'a mapping value starting on its own line': {
      input: 'k:\n  first\n  second\n',
      expected: { k: 'first second' },
    },
    'a mapping value nested inside a mapping': {
      input: 'outer:\n  k: first\n    second\n',
      expected: { outer: { k: 'first second' } },
    },
    'an explicit key value': {
      input: '? a\n: 1\n  extra\nb: 2\n',
      expected: { a: '1 extra', b: 2 },
    },
    'a sequence entry followed by another entry': {
      input: '- first\n  second\n- next\n',
      expected: ['first second', 'next'],
    },
    'a sequence entry continued one column deeper': {
      input: '- a\n - b\n',
      expected: ['a - b'],
    },
    'a nested sequence entry': {
      input: '- - a\n    b\n',
      expected: [['a b']],
    },
    'a sequence entry nested inside a mapping': {
      input: 'a:\n  - first\n    second\n',
      expected: { a: ['first second'] },
    },
    'a top-level scalar': {
      input: 'first\n  second\nthird\n',
      expected: 'first second third',
    },
    'a flow sequence item': {
      input: 'k: [a\n  b]',
      expected: { k: ['a b'] },
    },
    'a flow mapping value': {
      input: 'k: {a: x\n  y}',
      expected: { k: { a: 'x y' } },
    },
    'a top-level flow sequence item': {
      input: '[a\nb]',
      expected: ['a b'],
    },
    'a mapping value with a blank line folded into a line break': {
      input: 'k: first\n\n  second\n',
      expected: { k: 'first\nsecond' },
    },
    'a mapping value with a tab after its indentation': {
      input: 'k: first\n \tsecond\n',
      expected: { k: 'first second' },
    },
  };

  for (const [name, { input, expected }] of Object.entries(continuations)) {
    it(`folds the continuation of ${name}`, () =>
      strict.deepEqual(parse(input), expected));
  }
});

describe('A continuation line must be indented with spaces past its owner', () => {
  it('rejects a continuation line indented with a tab', () =>
    strict.throws(() => parse('k: first\n\tsecond\n'), SyntaxError));

  it('rejects a flow line indented at its owning block collection', () =>
    strict.throws(() => parse('key: [a,\nb]\n'), SyntaxError));
});

describe('Where a plain scalar ends', () => {
  it('colon not followed by space is part of value', () =>
    assertParsesTo(
      read('plain-scalars--plain-colon-no-space.yaml'),
      'http://example.com'
    ));

  it('colon in flow map value', () =>
    assertParsesTo(read('plain-scalars--flow-map-colon-value.yaml'), {
      url: 'http://x.com',
    }));

  it('colon followed by tab in flow is part of scalar', () =>
    assertParsesTo(read('plain-scalars--flow-colon-tab.yaml'), ['a:\tb']));

  it('inline value with colon-like content but no map value', () =>
    assertParsesTo(read('plain-scalars--inline-colon-no-map.yaml'), ['a:b']));

  it('plain scalar stops at colon with space', () =>
    assertParsesTo(read('plain-scalars--plain-stops-at-colon-space.yaml'), {
      key: 'val',
    }));

  it('plain scalar value ending at comma in flow seq', () =>
    assertParsesTo(read('plain-scalars--flow-seq-plain-scalar.yaml'), [
      'hello world',
      'foo',
    ]));

  it('plain scalar value ending at bracket', () =>
    assertParsesTo(read('plain-scalars--flow-seq-plain-bracket.yaml'), [
      'value',
    ]));

  it('multiline plain scalar stops at ? indicator', () =>
    assertParsesTo(read('plain-scalars--multiline-stops-at-question.yaml'), {
      key1: 'val1',
      key2: 'val2',
    }));

  it('question mark not followed by whitespace is plain scalar', () =>
    assertParsesTo(read('plain-scalars--question-no-whitespace.yaml'), '?abc'));
});

await describe('A multi-line plain scalar folds in time proportional to its length', async () => {
  const longScalars = {
    'as a block mapping value': `text:\n${'  word word word\n'.repeat(80_000)}`,
    'with trailing spaces on every line': `text:\n${'  word word word   \n'.repeat(80_000)}`,
    'inside a flow sequence': `[${' word word word\n'.repeat(80_000)}]`,
  };

  for (const [name, input] of Object.entries(longScalars)) {
    await it(`folds 80,000 lines ${name} within the time limit`, async () => {
      const outcome = await parseWithinTimeLimit(input);

      strict.equal(outcome, 'returned');
    });
  }
});
