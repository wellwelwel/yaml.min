/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { parse, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse: parseYaml } = require('../../src/index.ts');

describe('Nested structures', () => {
  it('map of sequences', () =>
    parse(read('nested--map-of-sequences.yaml'), {
      american: ['Boston Red Sox', 'Detroit Tigers'],
      national: ['New York Mets', 'Chicago Cubs'],
    }));

  it('sequence of mappings', () =>
    parse(read('nested--sequence-of-mappings.yaml'), [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ]));

  it('deep nested maps', () =>
    parse(read('nested--deep-maps.yaml'), {
      a: { b: { c: 'deep' } },
    }));

  it('nested block sequences', () =>
    parse(read('nested--block-sequences.yaml'), [
      [1, 2],
      [3, 4],
    ]));

  it('seq as map value', () =>
    parse(read('nested--seq-as-map-value.yaml'), { items: ['a', 'b'] }));

  it('seq between map keys', () =>
    parse(read('nested--seq-between-map-keys.yaml'), {
      a: 1,
      b: ['x', 'y'],
      c: 3,
    }));

  it('map items in seq', () =>
    parse(read('nested--map-items-in-seq.yaml'), [{ a: 1, b: 2 }, { c: 3 }]));
});

describe('Complex real-world document', () => {
  it('parses nested config', () => {
    const result = parseYaml(read('nested--real-world-config.yaml')) as Record<
      string,
      unknown
    >;
    strict.equal(result.name, 'my-project');
    strict.equal(result.version, '1.0.0');

    const deps = result.dependencies as Record<string, unknown>[];
    strict.equal(deps.length, 2);
    strict.equal(deps[0].name, 'lodash');
    strict.equal(deps[0].version, '4.17.21');

    const config = result.config as Record<string, unknown>;
    strict.equal(config.debug, true);
    strict.equal(config.port, 3000);
    strict.deepEqual(config.features, ['auth', 'logging']);

    const db = config.database as Record<string, unknown>;
    strict.equal(db.host, 'localhost');
    strict.equal(db.port, 5432);
  });
});
