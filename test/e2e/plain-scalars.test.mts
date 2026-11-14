/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it, strict } from 'poku';
import {
  assertParsesTo,
  parse,
  parseAll,
  parseWithinTimeLimit,
  read,
} from '../__helpers__/index.mts';

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
    'a top-level scalar that ends the input': {
      input: read('plain-scalars--plain-multiline-folds.yaml'),
      expected: 'this is a multiline value',
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

describe('A plain scalar ends only where an indicator can end it', () => {
  const plainScalars = {
    'a ":" without a space after it': {
      file: 'plain-scalars--plain-colon-no-space.yaml',
      expected: 'http://example.com',
    },
    'a ":" without a space after it in a flow mapping value': {
      file: 'plain-scalars--flow-map-colon-value.yaml',
      expected: { url: 'http://x.com' },
    },
    'a ":" followed by a tab in a flow sequence': {
      file: 'plain-scalars--flow-colon-tab.yaml',
      expected: ['a:\tb'],
    },
    'a ":" without a space after it in a sequence entry': {
      file: 'plain-scalars--inline-colon-no-map.yaml',
      expected: ['a:b'],
    },
    'spaces before a "," in a flow sequence': {
      file: 'plain-scalars--flow-seq-plain-scalar.yaml',
      expected: ['hello world', 'foo'],
    },
    'the text before a "]"': {
      file: 'plain-scalars--flow-seq-plain-bracket.yaml',
      expected: ['value'],
    },
    'a "?" without whitespace after it': {
      file: 'plain-scalars--question-no-whitespace.yaml',
      expected: '?abc',
    },
  };

  for (const [name, { file, expected }] of Object.entries(plainScalars)) {
    it(`keeps ${name} in the scalar`, () =>
      assertParsesTo(read(file), expected));
  }
});

describe('A plain scalar never starts with an indicator', () => {
  const indicatorStarts = {
    'a reserved "@" as a mapping value': 'key: @foo\n',
    'a reserved backtick as a mapping value': 'key: `foo`\n',
    'a "%" as a mapping value': 'key: %x\n',
    'a "]" as a mapping value': 'key: ]x\n',
    'a "}" as a mapping value': 'key: }x\n',
    'a "," as a mapping value': 'key: ,x\n',
    'a "-" and a space as a mapping value': 'key: - a\n     - b\n',
    'a "-" at the end of a mapping value': 'key: -\n',
    'a "?" and a space as a mapping value': 'key: ? a\n',
    'a reserved "@" as a mapping key': '@key: value\n',
    'a reserved "@" as a sequence entry': '- @x\n',
    'a reserved "@" as an explicit key': '? @x\n: value\n',
    'a reserved "@" in a flow sequence': '[@x]\n',
    'a reserved "@" as a flow mapping key': '{@x: value}\n',
    'a "-" alone in a flow sequence': '[-]\n',
    'a "-" before a comma in a nested flow sequence': '---\n- [-, -]\n',
    'a "-" and a tab in a flow sequence': '[ -\ta ]\n',
    'a "?" before a flow indicator': '{ ?}\n',
    'a "%" line inside a document': '%YAML 1.2\n---\n%YAML 1.2\n---\n',
    'a "-" alone as a flow mapping value': read(
      'plain-scalars--bare-minus-flow-value.yaml'
    ),
  };
  const textAfterIndicators = {
    'a "-" before a digit': { input: 'key: -1\n', expected: { key: -1 } },
    'a "-" before a letter': { input: 'key: -x\n', expected: { key: '-x' } },
    'a ":" before a letter': { input: 'key: :x\n', expected: { key: ':x' } },
    'each indicator before a letter in a flow sequence': {
      input: '[-a, ?b, :c]\n',
      expected: ['-a', '?b', ':c'],
    },
  };

  for (const [name, input] of Object.entries(indicatorStarts)) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parseAll(input), SyntaxError));
  }

  for (const [name, { input, expected }] of Object.entries(
    textAfterIndicators
  )) {
    it(`reads ${name} as text`, () => strict.deepEqual(parse(input), expected));
  }
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
