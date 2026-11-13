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

describe('Collections and aliases as mapping keys', () => {
  it('flow seq as block map key', () =>
    assertParsesTo(read('mapping-keys--collection-as-map-key.yaml'), {
      '["a","b"]': 'value',
    }));

  it('flow map as explicit block map key', () =>
    assertParsesTo(read('mapping-keys--flow-map-explicit-key.yaml'), {
      '{"a":1}': 'val',
    }));

  it('alias as block map key', () => {
    const result: Record<string, unknown> = parse(
      read('mapping-keys--alias-block-map-key.yaml')
    );

    strict.equal(result.mykey, 'other');
  });

  it('flow seq as flow map key', () =>
    assertParsesTo(read('mapping-keys--flow-map-seq-key.yaml'), {
      '1': 'val',
    }));

  it('flow map as flow map key', () => {
    const result: Record<string, unknown> = parse(
      read('mapping-keys--flow-map-map-key.yaml')
    );

    strict.equal(Object.values(result)[0], 'val');
  });

  it('alias as flow map key', () =>
    assertParsesTo(read('mapping-keys--flow-map-alias-key.yaml'), { foo: 2 }));
});

describe('Keys named after prototype properties', () => {
  const prototypeKeys = ['__proto__', 'constructor', 'prototype'];
  const mappingsHolding = {
    'a block mapping': (key: string) => parse(`${key}: [42]`),
    'an explicit key': (key: string) => parse(`? ${key}\n: [42]`),
    'a flow mapping': (key: string) => parse(`{ ${key}: [42] }`),
    'a flow pair': (key: string) => parse(`[${key}: [42]]`)[0],
  };

  for (const key of prototypeKeys) {
    for (const [form, parseMapping] of Object.entries(mappingsHolding)) {
      it(`keeps ${key} as an own key of ${form}`, () => {
        const mapping = parseMapping(key);

        strict.deepEqual(Object.keys(mapping), [key]);
        strict.deepEqual(mapping[key], [42]);
        strict.equal(Object.getPrototypeOf(mapping), Object.prototype);
      });
    }
  }
});
