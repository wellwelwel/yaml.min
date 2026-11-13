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

describe('Anchors and aliases', () => {
  it('scalar', () =>
    assertParsesTo(read('aliases--anchor-scalar.yaml'), { a: 42, b: 42 }));

  it('anchor on map (no merge)', () =>
    assertParsesTo(read('aliases--anchor-map-no-merge.yaml'), {
      defaults: { a: 1, b: 2 },
      dev: { '<<': { a: 1, b: 2 }, c: 3 },
    }));
});

describe('Anchors in flow sequences', () => {
  it('anchor on flow seq item', () =>
    assertParsesTo(read('aliases--anchor-flow-seq.yaml'), [1, 1]));

  it('anchor on flow seq string', () =>
    assertParsesTo(read('aliases--anchor-flow-seq-string.yaml'), [
      'hello',
      'hello',
    ]));
});

describe('Anchors in flow mappings', () => {
  it('anchor on flow map key', () =>
    assertParsesTo(read('aliases--anchor-flow-map-key.yaml'), {
      foo: 1,
      bar: 'foo',
    }));

  it('alias as flow map key value', () =>
    assertParsesTo(read('aliases--flow-map-alias-value.yaml'), {
      a: 1,
      b: 1,
    }));
});

describe('Anchors in block sequences', () => {
  it('anchor on block seq item', () =>
    assertParsesTo(read('aliases--anchor-block-seq.yaml'), [1, 1]));

  it('inline alias after seq dash', () =>
    assertParsesTo(read('aliases--inline-alias-after-dash.yaml'), [10, [10]]));
});

describe('Anchors in block map keys', () => {
  it('anchor on block map key', () =>
    assertParsesTo(read('aliases--anchor-block-map-key.yaml'), {
      mykey: 'val',
      other: 'mykey',
    }));

  it('anchor on explicit key', () =>
    assertParsesTo(read('aliases--explicit-key-anchor.yaml'), {
      mykey: 'val',
      ref: 'mykey',
    }));
});

describe('Anchor on top-level value', () => {
  it('anchor on top-level scalar', () =>
    assertParsesTo(read('aliases--anchor-top-scalar.yaml'), 'hello'));

  it('anchor on top-level flow seq', () =>
    assertParsesTo(read('aliases--anchor-top-flow-seq.yaml'), [1, 2]));
});

describe('An alias must name an anchor defined before it', () => {
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
