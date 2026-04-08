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

describe('Comments', () => {
  it('before content', () =>
    parse(read('features--comment-before.yaml'), { a: 1 }));

  it('inline', () => parse(read('features--comment-inline.yaml'), { a: 1 }));

  it('between entries', () =>
    parse(read('features--comment-between.yaml'), { a: 1, b: 2 }));
});

describe('Anchors and aliases', () => {
  it('scalar', () =>
    parse(read('features--anchor-scalar.yaml'), { a: 42, b: 42 }));

  it('anchor on map (no merge)', () =>
    parse(read('features--anchor-map-no-merge.yaml'), {
      defaults: { a: 1, b: 2 },
      dev: { '<<': { a: 1, b: 2 }, c: 3 },
    }));
});

describe('Document markers', () => {
  it('doc start', () => parse(read('features--doc-start.yaml'), { a: 1 }));

  it('doc start and end', () =>
    parse(read('features--doc-start-end.yaml'), { a: 1 }));

  it('directive + doc start', () =>
    parse(read('features--directive-doc-start.yaml'), 'hello'));
});

describe('Explicit keys', () => {
  it('block explicit keys', () =>
    parse(read('features--explicit-keys.yaml'), { a: 1, b: 2 }));
});

describe('Empty values', () => {
  it('empty map value', () =>
    parse(read('features--empty-map-value.yaml'), { a: null, b: 2 }));

  it('empty seq item', () =>
    parse(read('features--empty-seq-item.yaml'), [null, 2]));
});

describe('CRLF line endings', () => {
  it('block map', () =>
    strict.deepEqual(parseYaml('a: 1\r\nb: 2\r\n'), { a: 1, b: 2 }));
});

describe('__proto__ safety', () => {
  it('does not pollute prototype', () => {
    const obj = parseYaml(read('features--proto-pollution.yaml')) as Record<
      string,
      unknown
    >;
    strict.ok(!Array.isArray(obj));
    strict.ok({}.hasOwnProperty.call(obj, '__proto__'));
    strict.equal(JSON.stringify(obj), '{"__proto__":[42]}');
  });
});
