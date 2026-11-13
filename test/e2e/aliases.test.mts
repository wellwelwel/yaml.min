/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { assertParsesTo, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse, parseAll } = require('../../src/index.ts');

describe('An alias resolves to the value its anchor labels', () => {
  const resolvedAliases = {
    'an alias to a block mapping value': {
      file: 'aliases--anchor-scalar.yaml',
      expected: { a: 42, b: 42 },
    },
    'an alias to a block mapping key': {
      file: 'aliases--anchor-block-map-key.yaml',
      expected: { mykey: 'val', other: 'mykey' },
    },
    'an alias to an explicit key': {
      file: 'aliases--explicit-key-anchor.yaml',
      expected: { mykey: 'val', ref: 'mykey' },
    },
    'an alias to a block sequence item': {
      file: 'aliases--anchor-block-seq.yaml',
      expected: [1, 1],
    },
    'an alias inside a compact nested sequence': {
      file: 'aliases--inline-alias-after-dash.yaml',
      expected: [10, [10]],
    },
    'an alias to a number in a flow sequence': {
      file: 'aliases--anchor-flow-seq.yaml',
      expected: [1, 1],
    },
    'an alias to a string in a flow sequence': {
      file: 'aliases--anchor-flow-seq-string.yaml',
      expected: ['hello', 'hello'],
    },
    'an alias to a flow mapping key': {
      file: 'aliases--anchor-flow-map-key.yaml',
      expected: { foo: 1, bar: 'foo' },
    },
    'an alias to a flow mapping value': {
      file: 'aliases--flow-map-alias-value.yaml',
      expected: { a: 1, b: 1 },
    },
  };

  for (const [name, { file, expected }] of Object.entries(resolvedAliases)) {
    it(`resolves ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('An anchor leaves the value it labels unchanged', () => {
  const anchoredDocuments = {
    'top-level scalar': {
      file: 'aliases--anchor-top-scalar.yaml',
      expected: 'hello',
    },
    'top-level flow sequence': {
      file: 'aliases--anchor-top-flow-seq.yaml',
      expected: [1, 2],
    },
  };

  for (const [name, { file, expected }] of Object.entries(anchoredDocuments)) {
    it(`keeps the value of an anchored ${name}`, () =>
      assertParsesTo(read(file), expected));
  }
});

describe('A merge key is an ordinary key', () => {
  it('keeps "<<" as a key holding the aliased mapping', () =>
    assertParsesTo(read('aliases--anchor-map-no-merge.yaml'), {
      defaults: { a: 1, b: 2 },
      dev: { '<<': { a: 1, b: 2 }, c: 3 },
    }));
});

describe('An alias must name a node completed before it', () => {
  const unresolvableAliases = {
    'to an undefined anchor as a block mapping value':
      'tls: *undefined_anchor\n',
    'to an undefined anchor as the whole document': '*missing',
    'to an undefined anchor as a block mapping key': '*nope : v\n',
    'to an undefined anchor as an explicit key': '? *nope\n: v\n',
    'to an undefined anchor as a block sequence item': '- *nope\n',
    'to an undefined anchor as a flow sequence item': '[*nope]',
    'to an undefined anchor as a flow mapping value': '{a: *nope}',
    'to an undefined anchor as a flow mapping key next to a real key':
      '{undefined: real, *nope : forged}',
    'to an anchor defined only after it': 'a: *x\nb: &x 1\n',
    'inside the node its own anchor labels': 'a: &x [1, *x]\n',
    'inside a node that reuses the name of a finished anchor':
      'a: &x 1\nb: &x [*x]\n',
    'with an empty name as a block mapping value': 'a: *\n',
    'with an empty name as a flow sequence item': '[*]',
  };

  for (const [name, input] of Object.entries(unresolvableAliases)) {
    it(`rejects an alias ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }
});

describe('A node carries at most one anchor', () => {
  it('rejects a scalar with two anchors', () =>
    strict.throws(() => parse('&a &b value\n'), SyntaxError));

  it('rejects an alias to the first of two anchors on one node', () =>
    strict.throws(() => parse('a: &a &b 1\nc: *a\n'), SyntaxError));
});

describe('An alias returns the anchored value itself, not a copy', () => {
  const sharedValues = {
    'a sequence between block mapping values':
      'original: &shared [1, 2]\ncopy: *shared\n',
    'a mapping between block sequence items': '- &shared {a: 1}\n- *shared\n',
    'a sequence between flow sequence items': '[&shared [1], *shared]',
  };

  for (const [name, input] of Object.entries(sharedValues)) {
    it(`shares ${name}`, () => {
      const [original, copy] = Object.values(parse(input));

      strict.equal(copy, original);
    });
  }
});

describe('Anchor names never reach the prototype chain', () => {
  it('resolves anchors named after prototype properties like any other name', () =>
    assertParsesTo(
      'a: &constructor 1\nb: *constructor\nc: &__proto__ two\nd: *__proto__\n',
      { a: 1, b: 1, c: 'two', d: 'two' }
    ));

  for (const name of ['__proto__', 'constructor', 'toString']) {
    it(`rejects an alias named ${name} without an anchor`, () =>
      strict.throws(() => parse(`a: *${name}\n`), SyntaxError));
  }
});

describe('Aliases repeat a bounded amount of anchored content', () => {
  const layers = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  const repeatedText = (length: number, aliases: number): string =>
    `anchored: &text ${'x'.repeat(length)}\naliases: [${Array.from({ length: aliases }, () => '*text').join(', ')}]\n`;
  const nestedLayers = (
    firstLayer: string,
    layer: (previous: string) => string
  ): string =>
    [
      `a: &a ${firstLayer}`,
      ...layers.map(
        (name, index) =>
          `${name}: &${name} ${layer(index === 0 ? 'a' : layers[index - 1])}`
      ),
    ].join('\n');

  it('accepts aliases that repeat exactly 1,000,000 characters', () => {
    const text = 'x'.repeat(50_000);

    assertParsesTo(repeatedText(50_000, 20), {
      anchored: text,
      aliases: Array.from({ length: 20 }, () => text),
    });
  });

  it('rejects aliases that repeat one anchored text past 1,000,000 characters', () =>
    strict.throws(() => parse(repeatedText(50_000, 21)), SyntaxError));

  it('rejects eight layers of sequences that each alias the layer before nine times', () =>
    strict.throws(
      () =>
        parse(
          nestedLayers(
            `[${Array.from({ length: 9 }, () => 'lol').join(', ')}]`,
            (previous) =>
              `[${Array.from({ length: 9 }, () => `*${previous}`).join(', ')}]`
          )
        ),
      SyntaxError
    ));

  it('rejects eight layers of mappings that each alias the layer before nine times', () =>
    strict.throws(
      () =>
        parse(
          nestedLayers(
            `{${Array.from({ length: 9 }, (_, key) => `k${key}: lol`).join(', ')}}`,
            (previous) =>
              `{${Array.from({ length: 9 }, (_, key) => `k${key}: *${previous}`).join(', ')}}`
          )
        ),
      SyntaxError
    ));

  it('counts repeated content across the documents of a stream', () => {
    const document = repeatedText(10_000, 40);
    const stream = [document, document, document].join('---\n');

    strict.doesNotThrow(() => parseAll(document));
    strict.throws(() => parseAll(stream), SyntaxError);
  });
});
