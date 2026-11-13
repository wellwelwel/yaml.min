/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { assertParsesTo, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

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
  const ceiling = 256;
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
    'flow mappings as keys': (levels) =>
      `${'{'.repeat(levels)}a: 1}${': 1}'.repeat(levels - 1)}`,
    'implicit pairs in a flow sequence': (levels) =>
      `[${'a: '.repeat(levels - 1)}x]`,
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
    '100,000 compact dashes': '- '.repeat(100_000),
  };

  const describeOutcome = (input: string): string => {
    try {
      parse(input);

      return 'returned';
    } catch (error) {
      if (!(error instanceof Error)) return typeof error;

      return `${error.name} caused by ${error.cause instanceof Error ? error.cause.name : 'nothing'}`;
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
    it(`accepts ${shape} nested ${ceiling} levels deep`, () =>
      strict.doesNotThrow(() => parse(nest(ceiling))));

    it(`rejects ${shape} nested one level past the limit`, () =>
      strict.throws(() => parse(nest(ceiling + 1)), SyntaxError));
  }

  for (const [name, document] of Object.entries(pathologicalDocuments)) {
    it(`rejects ${name} with a syntax error`, () =>
      strict.throws(() => parse(document), SyntaxError));
  }

  it('rejects nesting the remaining call stack cannot hold with a syntax error', () =>
    strict.equal(
      parseNearStackLimit(
        nestingShapes['block mappings on separate lines'](ceiling)
      ),
      'SyntaxError caused by RangeError'
    ));
});
