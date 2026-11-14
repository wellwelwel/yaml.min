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
  read,
} from '../__helpers__/index.mts';

type Settings = { host: string; origins: string[] };

type SharedConfig = { defaults: Settings; production: Settings };

const SHARED_CONFIG_DOCUMENT =
  'defaults: &defaults\n  host: localhost\n  origins: [a.example]\nproduction: *defaults\n';

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
    'an alias to an anchor in the same compact nested sequence': {
      file: 'aliases--anchor-in-compact-sequence.yaml',
      expected: [[1, 1]],
    },
    'an alias to a number in a flow sequence': {
      file: 'aliases--anchor-flow-seq.yaml',
      expected: [1, 1],
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

describe('An anchor labels the implicit key on its line, not the mapping', () => {
  const keyAnchors = {
    'a top-level mapping': {
      input: '&a key: value\nother: *a\n',
      expected: { key: 'value', other: 'key' },
    },
    'a nested mapping': {
      input: 'outer:\n  &a key: value\nnext: *a\n',
      expected: { outer: { key: 'value' }, next: 'key' },
    },
    'a mapping in a sequence entry': {
      input: '- &a key: value\n- *a\n',
      expected: [{ key: 'value' }, 'key'],
    },
    'a mapping in a nested sequence entry': {
      input: '- - &a key: value\n- *a\n',
      expected: [[{ key: 'value' }], 'key'],
    },
    'a mapping in an explicit value': {
      input: '? a\n: &a key: value\nb: *a\n',
      expected: { a: { key: 'value' }, b: 'key' },
    },
    'a single-pair mapping in a flow sequence': {
      input: '[&a key: value, *a]',
      expected: [{ key: 'value' }, 'key'],
    },
  };
  const mappingAnchors = {
    'a nested mapping': {
      input: 'outer:\n  &m\n  key: value\nnext: *m\n',
      expected: { outer: { key: 'value' }, next: { key: 'value' } },
    },
    'a mapping in a sequence entry': {
      input: '- &m\n  key: value\n- *m\n',
      expected: [{ key: 'value' }, { key: 'value' }],
    },
  };

  for (const [name, { input, expected }] of Object.entries(keyAnchors)) {
    it(`labels the first key of ${name}`, () =>
      assertParsesTo(input, expected));
  }

  for (const [name, { input, expected }] of Object.entries(mappingAnchors)) {
    it(`labels ${name} when a line break follows the anchor`, () =>
      assertParsesTo(input, expected));
  }
});

describe('An anchor labels a sequence only from the line above it', () => {
  const sameLineSequences = {
    'a sequence entry': '- &a - b\n',
    'a sequence entry whose sequence nests another': '- &a - - b\n',
    'a sequence entry whose sequence holds one empty entry': '- &a -\n',
    'a sequence entry with a tab before the sequence': '- &a\t- b\n',
    'a sequence entry a later alias refers to': '- &a - b\n- *a\n',
    'a compact nested sequence': '- - &a - b\n',
    'an indentless sequence under a key': 'k:\n- &a - b\n',
    'an explicit value': '? x\n: &a - b\n',
  };
  const sequencesBelowAnchors = {
    'a sequence entry': {
      input: '- &a\n  - b\n- *a\n',
      expected: [['b'], ['b']],
    },
    'an explicit value': {
      input: '? x\n: &a\n  - b\ny: *a\n',
      expected: { x: ['b'], y: ['b'] },
    },
  };

  for (const [name, input] of Object.entries(sameLineSequences)) {
    it(`rejects an anchor on the line where its sequence starts, in ${name}`, () =>
      strict.throws(() => parse(input), { code: 'INVALID_ANCHOR' }));
  }

  for (const [name, { input, expected }] of Object.entries(
    sequencesBelowAnchors
  )) {
    it(`labels the sequence below an anchor alone on its line, in ${name}`, () =>
      assertParsesTo(input, expected));
  }
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
  const doublyAnchoredNodes = {
    'on one line': '&a &b value\n',
    'on consecutive lines of the root node': '&a\n&b value\n',
    'on consecutive lines of a block mapping value': 'key: &a\n  &b value\n',
    'on consecutive lines of a flow sequence item': '[&a\n &b value]',
  };

  for (const [name, input] of Object.entries(doublyAnchoredNodes)) {
    it(`rejects two anchors ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }

  it('rejects an alias to the first of two anchors on one node', () =>
    strict.throws(() => parse('a: &a &b 1\nc: *a\n'), SyntaxError));
});

describe('An anchor or alias name runs until whitespace or a flow indicator', () => {
  const namesWithColons = {
    'an anchor with a colon in its name': {
      input: 'key: &an:chor value\n',
      expected: { key: 'value' },
    },
    'an anchor and an alias whose names end in a colon': {
      input: '&a: key: &a value\nfoo:\n  *a:\n',
      expected: { key: 'value', foo: 'key' },
    },
    'an anchor and an alias named with indicator characters': {
      input: 'a: &:@*!$"<foo>: scalar a\nb: *:@*!$"<foo>:\n',
      expected: { a: 'scalar a', b: 'scalar a' },
    },
  };
  const aliasKeys = {
    'a block mapping': {
      input: 'a: &k key\n*k : other\n',
      expected: { a: 'key', key: 'other' },
    },
    'a flow mapping': {
      input: '{a: &k key, *k : other}',
      expected: { a: 'key', key: 'other' },
    },
  };

  for (const [name, { input, expected }] of Object.entries(namesWithColons)) {
    it(`keeps the colon in ${name}`, () => assertParsesTo(input, expected));
  }

  it('reads a colon right after an alias as part of its name', () =>
    strict.throws(() => parse('a: &a 1\n*a: b\n'), {
      code: 'UNKNOWN_ANCHOR',
    }));

  for (const [name, { input, expected }] of Object.entries(aliasKeys)) {
    it(`reads an alias spaced from its colon as a key in ${name}`, () =>
      assertParsesTo(input, expected));
  }
});

describe('An alias carries no anchor', () => {
  const anchoredAliases = {
    'as a block mapping value': 'key1: &a value\nkey2: &b *a\n',
    'as a block mapping key': 'key1: &alias value1\n&b *alias : value2\n',
    'on the line before a block mapping value': 'a: &x 1\nb: &y\n  *x\n',
    'as a block sequence item': '- &x 1\n- &y *x\n',
    'on the line before a block sequence item': '- &x 1\n- &y\n  *x\n',
    'as an explicit key': 'a: &x 1\n? &y *x\n: v\n',
    'as a flow sequence item': '[&x 1, &y *x]',
    'on the line before a flow sequence item': '[&x 1, &y\n *x]',
    'as a flow mapping key': '{&x 1: a, &y *x : b}',
    'as a flow mapping value': '{a: &x 1, b: &y *x}',
  };
  const anchorsNextToAliases = {
    'a block mapping key whose value is an alias': {
      input: 'a: &x 1\n&k b: *x\nc: *k\n',
      expected: { a: 1, b: 1, c: 'b' },
    },
    'a block sequence that holds an alias': {
      input: 'a: &x 1\nb: &y\n  - *x\nc: *y\n',
      expected: { a: 1, b: [1], c: [1] },
    },
    'a flow sequence that holds an alias': {
      input: '- &x 1\n- &y [*x]\n- *y\n',
      expected: [1, [1], [1]],
    },
    'a flow mapping key whose value is an alias': {
      input: '{a: &x 1, &k b: *x, c: *k}',
      expected: { a: 1, b: 1, c: 'b' },
    },
  };

  for (const [name, input] of Object.entries(anchoredAliases)) {
    it(`rejects an anchored alias ${name}`, () =>
      strict.throws(() => parse(input), { code: 'INVALID_ALIAS' }));
  }

  for (const [name, { input, expected }] of Object.entries(
    anchorsNextToAliases
  )) {
    it(`keeps the anchor on ${name}`, () => assertParsesTo(input, expected));
  }
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
      const [original, copy] = Object.values(parse(input) as object);

      strict.equal(copy, original);
    });
  }
});

describe('A collection an alias refers to can no longer change', () => {
  const changes: Record<string, (config: SharedConfig) => void> = {
    'a value through an alias': (config) => {
      config.production.host = 'example.com';
    },
    'a value through the anchor': (config) => {
      config.defaults.host = 'example.com';
    },
    'a nested sequence through an alias': (config) => {
      config.production.origins.push('localhost');
    },
    'a nested sequence through the anchor': (config) => {
      config.defaults.origins[0] = 'localhost';
    },
  };

  for (const [name, change] of Object.entries(changes)) {
    it(`rejects a change to ${name}`, () => {
      const config = parse(SHARED_CONFIG_DOCUMENT) as SharedConfig;

      strict.throws(() => change(config), TypeError);
      strict.deepEqual(config, {
        defaults: { host: 'localhost', origins: ['a.example'] },
        production: { host: 'localhost', origins: ['a.example'] },
      });
    });
  }

  it('rejects a change to a collection held under a key named after a built-in member', () => {
    const config = parse(
      'defaults: &defaults\n  constructor: [a.example]\nproduction: *defaults\n',
      { allowUnsafeKeys: true }
    ) as { production: { constructor: string[] } };

    strict.throws(
      () => config.production.constructor.push('localhost'),
      TypeError
    );
    strict.deepEqual(config.production.constructor, ['a.example']);
  });
});

describe('A collection no alias refers to stays changeable', () => {
  it('lets code change an anchored collection no alias refers to', () => {
    const config = parse(
      'staging: &staging\n  host: localhost\n  origins: [a.example]\n'
    ) as { staging: Settings };

    config.staging.host = 'staging.example';
    config.staging.origins.push('localhost');

    strict.deepEqual(config, {
      staging: { host: 'staging.example', origins: ['a.example', 'localhost'] },
    });
  });

  it('lets code replace an alias in the collection that holds it', () => {
    const config = parse(SHARED_CONFIG_DOCUMENT) as SharedConfig;

    config.production = { host: 'example.com', origins: [] };

    strict.deepEqual(config, {
      defaults: { host: 'localhost', origins: ['a.example'] },
      production: { host: 'example.com', origins: [] },
    });
  });
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
