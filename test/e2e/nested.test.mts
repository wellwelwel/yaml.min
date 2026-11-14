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
const {
  YamlError,
}: typeof import('../../src/index.ts') = require('../../src/index.ts');

describe('Nested structures', () => {
  it('mapping of sequences', () =>
    assertParsesTo(read('nested--map-of-sequences.yaml'), {
      american: ['Boston Red Sox', 'Detroit Tigers'],
      national: ['New York Mets', 'Chicago Cubs'],
    }));

  it('sequence of mappings', () =>
    assertParsesTo(read('nested--sequence-of-mappings.yaml'), [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ]));

  it('deeply nested mappings', () =>
    assertParsesTo(read('nested--deep-maps.yaml'), {
      a: { b: { c: 'deep' } },
    }));

  it('nested block sequences', () =>
    assertParsesTo(read('nested--block-sequences.yaml'), [
      [1, 2],
      [3, 4],
    ]));

  it('sequence as a mapping value', () =>
    assertParsesTo(read('nested--seq-as-map-value.yaml'), {
      items: ['a', 'b'],
    }));

  it('sequence between mapping keys', () =>
    assertParsesTo(read('nested--seq-between-map-keys.yaml'), {
      a: 1,
      b: ['x', 'y'],
      c: 3,
    }));

  it('mappings as sequence items', () =>
    assertParsesTo(read('nested--map-items-in-seq.yaml'), [
      { a: 1, b: 2 },
      { c: 3 },
    ]));
});

describe('Complex real-world document', () => {
  it('parses a nested configuration', () =>
    assertParsesTo(read('nested--real-world-config.yaml'), {
      name: 'my-project',
      version: '1.0.0',
      dependencies: [
        { name: 'lodash', version: '4.17.21' },
        { name: 'express', version: '4.18.2' },
      ],
      config: {
        debug: true,
        port: 3000,
        host: '0.0.0.0',
        features: ['auth', 'logging'],
        database: { host: 'localhost', port: 5432, name: 'mydb' },
      },
    }));
});

describe('Maximum nesting depth', () => {
  const defaultLimit = 256;
  const highestLimit = 400;
  const stackHeadroomInFrames = 300;
  const nestingShapes: Record<string, (levels: number) => string> = {
    'block sequences on separate lines': (levels) =>
      `${Array.from({ length: levels }, (_, level) => `${' '.repeat(level)}-`).join('\n')} x\n`,
    'block mappings on separate lines': (levels) =>
      `${Array.from({ length: levels }, (_, level) => `${' '.repeat(level)}a:`).join('\n')} x\n`,
    'compact sequences on one line': (levels) => `${'- '.repeat(levels)}x\n`,
    'flow sequences': (levels) => `${'['.repeat(levels)}x${']'.repeat(levels)}`,
    'flow mappings as values': (levels) =>
      `${'{a: '.repeat(levels)}x${'}'.repeat(levels)}`,
    'implicit pairs in a flow sequence': (levels) => {
      const pairs = Math.floor(levels / 2);
      const innermost = levels % 2 === 0 ? 'x' : '[x]';

      return `${'[a: '.repeat(pairs)}${innermost}${']'.repeat(pairs)}`;
    },
    'sequences of mappings sharing their indentation': (levels) => {
      const lastLine = Math.ceil(levels / 2) - 1;
      const innermost = levels % 2 === 0 ? 'a: x' : 'x';

      return Array.from(
        { length: lastLine + 1 },
        (_, line) =>
          `${'  '.repeat(line)}- ${line === lastLine ? innermost : 'a:'}`
      ).join('\n');
    },
    'block mappings, compact sequences, and flow sequences mixed': (levels) => {
      const blockLevels = Math.floor(levels / 3);
      const compactLevels = Math.floor(levels / 3);
      const flowLevels = levels - blockLevels - compactLevels;
      const blockLines = Array.from(
        { length: blockLevels },
        (_, level) => `${' '.repeat(level)}a:`
      ).join('\n');

      return `${blockLines}\n${' '.repeat(blockLevels)}${'- '.repeat(compactLevels)}${'['.repeat(flowLevels)}x${']'.repeat(flowLevels)}\n`;
    },
  };
  const pathologicalDocuments = {
    '100,000 opening brackets': '['.repeat(100_000),
    '100,000 nested flow mappings': '{a: '.repeat(100_000),
    '100,000 flow mappings nested as keys': `${'{'.repeat(100_000)}a: 1}${': 1}'.repeat(99_999)}`,
    '100,000 compact dashes': '- '.repeat(100_000),
  };

  const describeOutcome = (input: string): string => {
    try {
      parse(input);

      return 'returned';
    } catch (error) {
      if (!(error instanceof YamlError)) return typeof error;

      return `${error.code} caused by ${error.cause instanceof Error ? error.cause.name : 'nothing'}`;
    }
  };

  const parseNearStackLimit = (input: string): string | number => {
    let below: string | number;

    try {
      below = parseNearStackLimit(input);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;

      return stackHeadroomInFrames;
    }

    if (typeof below === 'string') return below;
    if (below > 0) return below - 1;

    return describeOutcome(input);
  };

  for (const [shape, nest] of Object.entries(nestingShapes)) {
    it(`accepts ${shape} nested ${defaultLimit} levels deep by default`, () =>
      strict.doesNotThrow(() => parse(nest(defaultLimit))));

    it(`rejects ${shape} nested one level past the default limit`, () =>
      strict.throws(() => parse(nest(defaultLimit + 1)), {
        code: 'NESTING_TOO_DEEP',
      }));

    it(`accepts ${shape} nested ${highestLimit} levels deep at the highest limit allowed`, () =>
      strict.doesNotThrow(() =>
        parse(nest(highestLimit), { maxDepth: highestLimit })
      ));

    it(`rejects ${shape} nested one level past the highest limit allowed`, () =>
      strict.throws(
        () => parse(nest(highestLimit + 1), { maxDepth: highestLimit }),
        { code: 'NESTING_TOO_DEEP' }
      ));
  }

  for (const [name, document] of Object.entries(pathologicalDocuments)) {
    it(`rejects ${name} as nested too deep`, () =>
      strict.throws(() => parse(document), { code: 'NESTING_TOO_DEEP' }));
  }

  it('rejects nesting the remaining call stack cannot hold with an engine limit error', () =>
    strict.equal(
      parseNearStackLimit(
        nestingShapes['block mappings on separate lines'](defaultLimit)
      ),
      'ENGINE_LIMIT caused by RangeError'
    ));
});

describe('The maxDepth option sets the nesting limit', () => {
  const collectionDocuments = {
    'a flow sequence': '[]',
    'a flow mapping': '{}',
    'a block mapping': 'a: 1\n',
    'a block sequence': '- a\n',
    'an empty tagged sequence': '!!seq\n',
    'an empty tagged mapping': '!!map\n',
  };
  const emptyTaggedCollections = {
    'an empty tagged sequence as a mapping value': {
      document: 'a: !!seq\n',
      parsed: { a: [] },
    },
    'an empty tagged mapping as a sequence entry': {
      document: '- !!map\n',
      parsed: [{}],
    },
  };
  const invalidLimits: unknown[] = [
    -1,
    1.5,
    401,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    '10',
    10n,
  ];

  it('accepts nesting up to a lowered limit', () =>
    strict.deepEqual(parse('[[x]]', { maxDepth: 2 }), [['x']]));

  it('rejects nesting one level past a lowered limit', () =>
    strict.throws(() => parse('[[[x]]]', { maxDepth: 2 }), {
      code: 'NESTING_TOO_DEEP',
    }));

  it('accepts a scalar document at a limit of 0', () =>
    strict.equal(parse('x', { maxDepth: 0 }), 'x'));

  for (const [name, document] of Object.entries(collectionDocuments)) {
    it(`rejects ${name} at a limit of 0`, () =>
      strict.throws(() => parse(document, { maxDepth: 0 }), {
        code: 'NESTING_TOO_DEEP',
      }));
  }

  for (const [name, { document, parsed }] of Object.entries(
    emptyTaggedCollections
  )) {
    it(`accepts ${name} at a limit of 2`, () =>
      strict.deepEqual(parse(document, { maxDepth: 2 }), parsed));

    it(`rejects ${name} at a limit of 1`, () =>
      strict.throws(() => parse(document, { maxDepth: 1 }), {
        code: 'NESTING_TOO_DEEP',
      }));
  }

  it('applies the limit to every document of a stream', () =>
    strict.throws(() => parseAll('[x]\n---\n[[x]]\n', { maxDepth: 1 }), {
      code: 'NESTING_TOO_DEEP',
    }));

  it('accepts a stream whose documents all fit the limit', () =>
    strict.deepEqual(parseAll('[x]\n---\n[y]\n', { maxDepth: 1 }), [
      ['x'],
      ['y'],
    ]));

  for (const limit of invalidLimits) {
    it(`refuses the ${typeof limit} ${String(limit)} as a limit for parse`, () =>
      strict.throws(() => parse('x', { maxDepth: limit }), TypeError));

    it(`refuses the ${typeof limit} ${String(limit)} as a limit for parseAll`, () =>
      strict.throws(() => parseAll('x', { maxDepth: limit }), TypeError));
  }
});

describe('Aliases count the levels they repeat toward the nesting limit', () => {
  const aliasedDocuments = {
    'an alias to a flow sequence inside a flow sequence': {
      document: 'a: &a [[x]]\nb: [*a]\n',
      levels: 4,
      parsed: { a: [['x']], b: [[['x']]] },
    },
    'an alias to a block sequence inside a block sequence': {
      document: 'a: &a\n  - - x\nb:\n  - *a\n',
      levels: 4,
      parsed: { a: [['x']], b: [[['x']]] },
    },
    'an alias to a mapping as a flow mapping value': {
      document: 'a: &a {k: {k: x}}\nb: {k: *a}\n',
      levels: 4,
      parsed: { a: { k: { k: 'x' } }, b: { k: { k: { k: 'x' } } } },
    },
    'an alias to a node that holds another alias': {
      document: 'a: &a [x]\nb: &b [*a]\nc: [*b]\n',
      levels: 4,
      parsed: { a: ['x'], b: [['x']], c: [[['x']]] },
    },
    'an alias to a sequence with an anchored item after a deeper item': {
      document: 'a: &a [[[x]], &i y]\nb: [*a]\n',
      levels: 5,
      parsed: { a: [[['x']], 'y'], b: [[[['x']], 'y']] },
    },
    'an alias to a scalar after a deeper sibling': {
      document: 'x: [[[y]]]\na: &a z\nb: [*a]\n',
      levels: 4,
      parsed: { x: [[['y']]], a: 'z', b: ['z'] },
    },
    'an alias to an empty tagged sequence': {
      document: 'a: &a !!seq\nb: [*a]\n',
      levels: 3,
      parsed: { a: [], b: [[]] },
    },
  };
  const stackedAliases = (levelsAroundAlias: number): string =>
    `a: &a ${'['.repeat(150)}x${']'.repeat(150)}\nb: ${'['.repeat(levelsAroundAlias)}*a${']'.repeat(levelsAroundAlias)}\n`;

  for (const [name, { document, levels, parsed }] of Object.entries(
    aliasedDocuments
  )) {
    it(`accepts ${name} at a limit of ${levels}`, () =>
      strict.deepEqual(parse(document, { maxDepth: levels }), parsed));

    it(`rejects ${name} at a limit of ${levels - 1}`, () =>
      strict.throws(() => parse(document, { maxDepth: levels - 1 }), {
        code: 'NESTING_TOO_DEEP',
      }));
  }

  it('accepts an alias that stacks nesting to exactly the default limit', () =>
    strict.doesNotThrow(() => parse(stackedAliases(105))));

  it('rejects an alias that stacks nesting past the default limit while each node stays under it', () =>
    strict.throws(() => parse(stackedAliases(106)), {
      code: 'NESTING_TOO_DEEP',
    }));
});
