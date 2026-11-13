/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { assertParsesTo, read } from '../__helpers__/index.mts';

type Spellings = Record<string, (name: string) => string>;

type KeyForm = {
  spellings: Spellings;
  document: (key: string, name: string) => string;
  parsedWithOrdinaryKey: unknown;
};

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

describe('Mapping keys named after prototype properties', () => {
  const prototypeNames = ['__proto__', 'constructor', 'prototype'];
  const plainScalarSpellings: Spellings = {
    plain: (name) => name,
    'with a tag': (name) => `!!str ${name}`,
  };
  const everySpelling: Spellings = {
    ...plainScalarSpellings,
    'double-quoted': (name) => `"${name}"`,
    'single-quoted': (name) => `'${name}'`,
    'with an escape': (name) =>
      `"\\x${name.charCodeAt(0).toString(16)}${name.slice(1)}"`,
    'through an alias': () => '*name',
  };
  const keyForms: Record<string, KeyForm> = {
    'a block mapping key': {
      spellings: everySpelling,
      document: (key, name) => `anchor: &name ${name}\n${key}: [42]\n`,
      parsedWithOrdinaryKey: { anchor: 'title', title: [42] },
    },
    'an explicit key with a value': {
      spellings: everySpelling,
      document: (key, name) => `anchor: &name ${name}\n? ${key}\n: [42]\n`,
      parsedWithOrdinaryKey: { anchor: 'title', title: [42] },
    },
    'an explicit key without a value': {
      spellings: everySpelling,
      document: (key, name) => `anchor: &name ${name}\n? ${key}\n`,
      parsedWithOrdinaryKey: { anchor: 'title', title: null },
    },
    'a flow mapping key': {
      spellings: everySpelling,
      document: (key, name) => `{ anchor: &name ${name}, ${key}: [42] }`,
      parsedWithOrdinaryKey: { anchor: 'title', title: [42] },
    },
    'a flow sequence pair key': {
      spellings: plainScalarSpellings,
      document: (key, name) => `[&name ${name}, ${key}: [42]]`,
      parsedWithOrdinaryKey: ['title', { title: [42] }],
    },
  };

  for (const [
    form,
    { spellings, document, parsedWithOrdinaryKey },
  ] of Object.entries(keyForms)) {
    for (const [spelling, spell] of Object.entries(spellings)) {
      it(`accepts an ordinary key written ${spelling} as ${form}`, () =>
        assertParsesTo(
          document(spell('title'), 'title'),
          parsedWithOrdinaryKey
        ));

      for (const name of prototypeNames) {
        it(`rejects ${name} written ${spelling} as ${form}`, () =>
          strict.throws(() => parse(document(spell(name), name)), SyntaxError));
      }
    }
  }

  for (const name of prototypeNames) {
    it(`rejects a flow mapping sequence key that becomes ${name}`, () =>
      strict.throws(() => parse(`{ [${name}]: [42] }`), SyntaxError));
  }

  it('accepts the same names as values', () =>
    assertParsesTo('first: __proto__\nrest: [constructor, prototype]\n', {
      first: '__proto__',
      rest: ['constructor', 'prototype'],
    }));
});
