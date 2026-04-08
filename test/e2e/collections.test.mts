/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it } from 'poku';
import { parse, read } from '../__helpers__/index.mts';

describe('Flow sequences', () => {
  it('empty', () => parse(read('collections--flow-seq-empty.yaml'), []));

  it('integers', () =>
    parse(read('collections--flow-seq-integers.yaml'), [1, 2, 3]));

  it('mixed types', () =>
    parse(read('collections--flow-seq-mixed.yaml'), [true, false, null]));

  it('strings', () =>
    parse(read('collections--flow-seq-strings.yaml'), ['a', 'b', 'c']));

  it('nested', () =>
    parse(read('collections--flow-seq-nested.yaml'), [1, [2, 3]]));

  it('trailing comma', () =>
    parse(read('collections--flow-seq-trailing-comma.yaml'), ['one', 'two']));
});

describe('Flow mappings', () => {
  it('empty', () => parse(read('collections--flow-map-empty.yaml'), {}));

  it('simple', () =>
    parse(read('collections--flow-map-simple.yaml'), { a: 1, b: 2 }));

  it('nested', () =>
    parse(read('collections--flow-map-nested.yaml'), {
      a: 1,
      b: { c: 3 },
    }));

  it('with spaces', () =>
    parse(read('collections--flow-map-spaces.yaml'), {
      one: 'two',
      three: 'four',
    }));
});

describe('Block sequences', () => {
  it('integers', () =>
    parse(read('collections--block-seq-integers.yaml'), [1, 2, 3]));

  it('strings', () =>
    parse(read('collections--block-seq-strings.yaml'), ['a', 'b', 'c']));

  it('plain', () =>
    parse(read('collections--block-seq-plain.yaml'), ['one', 'two']));
});

describe('Block mappings', () => {
  it('simple', () =>
    parse(read('collections--block-map-simple.yaml'), { a: 1, b: 2 }));

  it('mixed types', () =>
    parse(read('collections--block-map-mixed.yaml'), {
      name: 'Mark McGwire',
      hr: 65,
      avg: 0.278,
    }));
});

describe('Flow seq with mapping pair', () => {
  it('implicit pair', () =>
    parse(read('collections--flow-seq-implicit-pair.yaml'), [{ foo: 'bar' }]));
});

describe('Mixed flow and block', () => {
  it('flow seq in block map', () =>
    parse(read('collections--mixed-flow-seq-in-block.yaml'), {
      items: [1, 2, 3],
      name: 'test',
    }));

  it('flow map in block map', () =>
    parse(read('collections--mixed-flow-map-in-block.yaml'), {
      meta: { a: 1, b: 2 },
      name: 'test',
    }));
});

describe('Block scalars in maps', () => {
  it('literal', () =>
    parse(read('collections--block-scalar-literal-in-map.yaml'), {
      data: 'line 1\nline 2\n',
      other: 'value',
    }));

  it('folded', () =>
    parse(read('collections--block-scalar-folded-in-map.yaml'), {
      data: 'line 1 line 2\n',
      other: 'value',
    }));
});

describe('Quoted keys', () => {
  it('double-quoted', () =>
    parse(read('collections--quoted-key-double.yaml'), {
      'quoted key': 'value',
    }));

  it('single-quoted', () =>
    parse(read('collections--quoted-key-single.yaml'), {
      'single key': 'value',
    }));
});
