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

type KeyCase = {
  rejected: string;
  accepted: string;
  parsed: unknown;
};

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

describe('Mapping keys follow one naming rule in both syntaxes', () => {
  const parsedKeys = {
    text: 1,
    quoted: 2,
    '16': 3,
    '17': 4,
    '1.5': 5,
    true: 6,
    '': 7,
  };

  it('names block mapping keys by the text form of their scalar', () =>
    assertParsesTo(
      'text: 1\n"quoted": 2\n16: 3\n0x11: 4\n1.5: 5\ntrue: 6\n~: 7\n',
      parsedKeys
    ));

  it('names flow mapping keys by the same rule', () =>
    assertParsesTo(
      '{text: 1, "quoted": 2, 16: 3, 0x11: 4, 1.5: 5, true: 6, ~: 7}',
      parsedKeys
    ));
});

describe('A sequence or a mapping is never a mapping key', () => {
  const collectionKeys: Record<string, KeyCase> = {
    'a flow sequence as an explicit block key': {
      rejected: read('mapping-keys--collection-as-map-key.yaml'),
      accepted: '? a\n: value\n',
      parsed: { a: 'value' },
    },
    'a flow mapping as an explicit block key': {
      rejected: read('mapping-keys--flow-map-explicit-key.yaml'),
      accepted: '? a\n: val\n',
      parsed: { a: 'val' },
    },
    'a block sequence as an explicit block key': {
      rejected: '? - a\n: value\n',
      accepted: '? -a\n: value\n',
      parsed: { '-a': 'value' },
    },
    'a block sequence after a tab as an explicit block key': {
      rejected: '? -\ta\n: value\n',
      accepted: '? -a\n: value\n',
      parsed: { '-a': 'value' },
    },
    'a block mapping as an explicit block key': {
      rejected: '? ? a\n: value\n',
      accepted: '? ?a\n: value\n',
      parsed: { '?a': 'value' },
    },
    'a block mapping as an explicit key in a sequence entry': {
      rejected: '- ? a: value\n',
      accepted: '- ?a: value\n',
      parsed: [{ '?a': 'value' }],
    },
    'a flow sequence as a block key': {
      rejected: 'first: 1\n[a, b]: value\n',
      accepted: 'first: 1\na: value\n',
      parsed: { first: 1, a: 'value' },
    },
    'a flow mapping as a block key': {
      rejected: 'first: 1\n{a: 1}: value\n',
      accepted: 'first: 1\na: value\n',
      parsed: { first: 1, a: 'value' },
    },
    'an alias to a sequence as a block key': {
      rejected: 'anchored: &node [a, b]\n*node : value\n',
      accepted: 'anchored: &node a\n*node : value\n',
      parsed: { anchored: 'a', a: 'value' },
    },
    'an alias to a mapping as a block key': {
      rejected: 'anchored: &node {a: 1}\n*node : value\n',
      accepted: 'anchored: &node a\n*node : value\n',
      parsed: { anchored: 'a', a: 'value' },
    },
    'a flow sequence as a flow key': {
      rejected: read('mapping-keys--flow-map-seq-key.yaml'),
      accepted: '{a: val}',
      parsed: { a: 'val' },
    },
    'a flow mapping as a flow key': {
      rejected: read('mapping-keys--flow-map-map-key.yaml'),
      accepted: '{a: val}',
      parsed: { a: 'val' },
    },
    'an alias to a sequence as a flow key': {
      rejected: '{anchored: &node [a, b], *node : value}',
      accepted: '{anchored: &node a, *node : value}',
      parsed: { anchored: 'a', a: 'value' },
    },
    'a flow sequence as an explicit flow key': {
      rejected: '{? [a, b] : value}',
      accepted: '{? a : value}',
      parsed: { a: 'value' },
    },
    'a flow sequence as a pair key in a flow sequence': {
      rejected: '[[a]: value]',
      accepted: '[a: value]',
      parsed: [{ a: 'value' }],
    },
  };

  for (const [name, { rejected, accepted, parsed }] of Object.entries(
    collectionKeys
  )) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parse(rejected), SyntaxError));

    it(`accepts a scalar in place of ${name}`, () =>
      assertParsesTo(accepted, parsed));
  }
});

describe('A mapping never repeats a key', () => {
  const repeatedKeys: Record<string, KeyCase> = {
    'a plain key twice in a block mapping': {
      rejected: 'a: 1\na: 2\n',
      accepted: 'a: 1\nb: 2\n',
      parsed: { a: 1, b: 2 },
    },
    'a plain key twice in a flow mapping': {
      rejected: '{a: 1, a: 2}',
      accepted: '{a: 1, b: 2}',
      parsed: { a: 1, b: 2 },
    },
    '0x10 and 16 in a block mapping': {
      rejected: '0x10: a\n16: b\n',
      accepted: '0x10: a\n17: b\n',
      parsed: { '16': 'a', '17': 'b' },
    },
    '0x10 and 16 in a flow mapping': {
      rejected: '{0x10: a, 16: b}',
      accepted: '{0x10: a, 17: b}',
      parsed: { '16': 'a', '17': 'b' },
    },
    '1.0 and "1" in a block mapping': {
      rejected: '1.0: a\n"1": b\n',
      accepted: '1.0: a\n"2": b\n',
      parsed: { '1': 'a', '2': 'b' },
    },
    '1.0 and "1" in a flow mapping': {
      rejected: '{1.0: a, "1": b}',
      accepted: '{1.0: a, "2": b}',
      parsed: { '1': 'a', '2': 'b' },
    },
    'null and ~ in a block mapping': {
      rejected: 'null: a\n~: b\n',
      accepted: 'null: a\nb: b\n',
      parsed: { '': 'a', b: 'b' },
    },
    'null and ~ in a flow mapping': {
      rejected: '{null: a, ~: b}',
      accepted: '{null: a, b: b}',
      parsed: { '': 'a', b: 'b' },
    },
    '~ and the empty key in a block mapping': {
      rejected: '~: a\n"": b\n',
      accepted: '~: a\n"c": b\n',
      parsed: { '': 'a', c: 'b' },
    },
    '~ and the empty key in a flow mapping': {
      rejected: '{~: a, "": b}',
      accepted: '{~: a, "c": b}',
      parsed: { '': 'a', c: 'b' },
    },
    'a key repeated through an alias in a block mapping': {
      rejected: read('mapping-keys--alias-block-map-key.yaml'),
      accepted: '&k mykey: val\nother: *k\n',
      parsed: { mykey: 'val', other: 'mykey' },
    },
    'a key repeated through an alias in a flow mapping': {
      rejected: read('mapping-keys--flow-map-alias-key.yaml'),
      accepted: '{&k foo: 1, bar: *k}',
      parsed: { foo: 1, bar: 'foo' },
    },
    'an explicit key twice in a block mapping': {
      rejected: '? a\n: 1\n? a\n: 2\n',
      accepted: '? a\n: 1\n? b\n: 2\n',
      parsed: { a: 1, b: 2 },
    },
    'an explicit key without a value twice in a block mapping': {
      rejected: '? a\n? a\n',
      accepted: '? a\n? b\n',
      parsed: { a: null, b: null },
    },
    'an explicit key twice in a flow mapping': {
      rejected: '{? a : 1, ? a : 2}',
      accepted: '{? a : 1, ? b : 2}',
      parsed: { a: 1, b: 2 },
    },
    'an inherited property name twice in a block mapping': {
      rejected: 'toString: 1\ntoString: 2\n',
      accepted: 'toString: 1\nhasOwnProperty: 2\n',
      parsed: { toString: 1, hasOwnProperty: 2 },
    },
    'an inherited property name twice in a flow mapping': {
      rejected: '{toString: 1, toString: 2}',
      accepted: '{toString: 1, valueOf: 2}',
      parsed: { toString: 1, valueOf: 2 },
    },
  };

  for (const [name, { rejected, accepted, parsed }] of Object.entries(
    repeatedKeys
  )) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parse(rejected), SyntaxError));

    it(`accepts ${name} once the second key differs`, () =>
      assertParsesTo(accepted, parsed));
  }
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
