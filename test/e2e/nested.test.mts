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
  it('map of sequences', () =>
    assertParsesTo(read('nested--map-of-sequences.yaml'), {
      american: ['Boston Red Sox', 'Detroit Tigers'],
      national: ['New York Mets', 'Chicago Cubs'],
    }));

  it('sequence of mappings', () =>
    assertParsesTo(read('nested--sequence-of-mappings.yaml'), [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ]));

  it('deep nested maps', () =>
    assertParsesTo(read('nested--deep-maps.yaml'), {
      a: { b: { c: 'deep' } },
    }));

  it('nested block sequences', () =>
    assertParsesTo(read('nested--block-sequences.yaml'), [
      [1, 2],
      [3, 4],
    ]));

  it('seq as map value', () =>
    assertParsesTo(read('nested--seq-as-map-value.yaml'), {
      items: ['a', 'b'],
    }));

  it('seq between map keys', () =>
    assertParsesTo(read('nested--seq-between-map-keys.yaml'), {
      a: 1,
      b: ['x', 'y'],
      c: 3,
    }));

  it('map items in seq', () =>
    assertParsesTo(read('nested--map-items-in-seq.yaml'), [
      { a: 1, b: 2 },
      { c: 3 },
    ]));
});

describe('Complex real-world document', () => {
  it('parses nested config', () =>
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
  it('rejects deeply nested structures', () => {
    const deep = Array.from(
      { length: 1002 },
      (_, depth) => `${' '.repeat(depth)}- `
    ).join('\n');

    strict.throws(() => parse(deep), RangeError);
  });
});
