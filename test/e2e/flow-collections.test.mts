/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 * and from the https://github.com/yaml/yaml-test-suite cases CT4Q and T833 (MIT).
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import {
  assertParsesTo,
  parseWithinTimeLimit,
  read,
} from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

describe('Flow sequences', () => {
  it('empty', () =>
    assertParsesTo(read('flow-collections--flow-seq-empty.yaml'), []));

  it('integers', () =>
    assertParsesTo(
      read('flow-collections--flow-seq-integers.yaml'),
      [1, 2, 3]
    ));

  it('mixed types', () =>
    assertParsesTo(read('flow-collections--flow-seq-mixed.yaml'), [
      true,
      false,
      null,
    ]));

  it('strings', () =>
    assertParsesTo(read('flow-collections--flow-seq-strings.yaml'), [
      'a',
      'b',
      'c',
    ]));

  it('nested', () =>
    assertParsesTo(read('flow-collections--flow-seq-nested.yaml'), [
      1,
      [2, 3],
    ]));

  it('trailing comma', () =>
    assertParsesTo(read('flow-collections--flow-seq-trailing-comma.yaml'), [
      'one',
      'two',
    ]));
});

describe('Flow mappings', () => {
  it('empty', () =>
    assertParsesTo(read('flow-collections--flow-map-empty.yaml'), {}));

  it('simple', () =>
    assertParsesTo(read('flow-collections--flow-map-simple.yaml'), {
      a: 1,
      b: 2,
    }));

  it('nested', () =>
    assertParsesTo(read('flow-collections--flow-map-nested.yaml'), {
      a: 1,
      b: { c: 3 },
    }));

  it('with spaces', () =>
    assertParsesTo(read('flow-collections--flow-map-spaces.yaml'), {
      one: 'two',
      three: 'four',
    }));

  it('single-quoted key', () =>
    assertParsesTo(read('flow-collections--flow-map-single-quoted-key.yaml'), {
      'a b': 1,
    }));

  it('double-quoted key', () =>
    assertParsesTo(read('flow-collections--flow-map-double-quoted-key.yaml'), {
      'a b': 1,
    }));

  it('flow map key with no value before brace', () =>
    assertParsesTo(read('flow-collections--flow-map-key-no-value.yaml'), {
      a: 1,
      b: null,
    }));
});

describe('Implicit pairs in flow sequences', () => {
  it('implicit pair', () =>
    assertParsesTo(read('flow-collections--flow-seq-implicit-pair.yaml'), [
      { foo: 'bar' },
    ]));

  it('key: , in flow sequence', () =>
    assertParsesTo(read('flow-collections--flow-key-comma.yaml'), [
      { a: null },
      'b',
    ]));

  it('key: at end of flow sequence', () =>
    assertParsesTo(read('flow-collections--flow-key-end.yaml'), [{ a: 1 }]));

  it('implicit key in flow sequence colon then bracket', () =>
    assertParsesTo(read('flow-collections--flow-implicit-key-bracket.yaml'), [
      { a: null },
    ]));

  it('implicit key in flow sequence colon-comma', () =>
    assertParsesTo(read('flow-collections--flow-implicit-key-comma.yaml'), [
      { a: null },
      'b',
    ]));
});

describe('Mixed flow and block', () => {
  it('flow sequence in block map', () =>
    assertParsesTo(read('flow-collections--mixed-flow-seq-in-block.yaml'), {
      items: [1, 2, 3],
      name: 'test',
    }));

  it('flow map in block map', () =>
    assertParsesTo(read('flow-collections--mixed-flow-map-in-block.yaml'), {
      meta: { a: 1, b: 2 },
      name: 'test',
    }));
});

await describe('A flow collection only closes with its own bracket', async () => {
  const mismatchedBrackets = {
    'a sequence closed by a brace': '[}',
    'a sequence item closed by a brace': '[a}',
    'a sequence closed by a brace after a comma': '[ 1, }',
    'a brace-closed sequence inside a mapping': '{[}',
    'a brace-closed sequence as a block mapping value': 'k: [}',
    'a brace-closed sequence inside a mapping value': '{a: [1, 2}',
    'a mapping closed by a bracket': '{]',
    'a mapping key closed by a bracket': '{a: ]',
    'a mapping entry closed by a bracket': '{ a: 1 ]',
    'a bracket-closed mapping inside a sequence': '[{]',
    'a bracket-closed mapping inside a sequence item': '[{a: 1]',
  };

  for (const [name, input] of Object.entries(mismatchedBrackets)) {
    await it(`rejects ${name} within the time limit`, async () => {
      const outcome = await parseWithinTimeLimit(input);

      strict.equal(outcome, 'rejected');
    });
  }
});

describe('A flow collection cut short by the end of input is rejected', () => {
  const truncatedCollections = {
    'a sequence missing its closing bracket': '[a, b',
    'a sequence cut after a comma': '[a, b,',
    'an empty sequence never closed': '[',
    'a mapping missing its closing brace': '{a: 1',
    'a mapping cut after a comma': '{a: 1,',
    'an empty mapping never closed': '{',
    'a sequence left open as a block mapping value': 'k: [a, b',
    'a mapping left open as a block mapping value': 'k: {a: 1',
    'a sequence left open as a block sequence item': '- [a',
    'an outer sequence left open around a closed one': '[[a]',
    'an outer mapping left open around a closed sequence': '{a: [1]',
    'a stack of collections all left open': '[[{a: [1',
    'a sequence left open after an implicit key': read(
      'flow-collections--flow-implicit-key-eof.yaml'
    ),
  };

  for (const [name, input] of Object.entries(truncatedCollections)) {
    it(`rejects ${name}`, () => strict.throws(() => parse(input), SyntaxError));
  }
});

describe('Explicit single pairs in flow sequences', () => {
  const explicitPairs = {
    'a key and a value': {
      input: '[ ? foo : bar ]',
      expected: [{ foo: 'bar' }],
    },
    'a key spread over two lines': {
      input: '[\n? foo\n bar : baz\n]\n',
      expected: [{ 'foo bar': 'baz' }],
    },
    'a key with no value': { input: '[ ? foo ]', expected: [{ foo: null }] },
    'a pair followed by another entry': {
      input: '[ ? foo : bar, baz ]',
      expected: [{ foo: 'bar' }, 'baz'],
    },
  };

  for (const [name, { input, expected }] of Object.entries(explicitPairs)) {
    it(`reads ${name} without the "?" in the key`, () =>
      assertParsesTo(input, expected));
  }

  it('guards the key like any other mapping key', () =>
    strict.throws(() => parse('[ ? __proto__ : x ]'), { code: 'UNSAFE_KEY' }));

  it('counts as a nesting level', () => {
    const input = '[ ? a : x ]';

    strict.doesNotThrow(() => parse(input, { maxDepth: 2 }));
    strict.throws(() => parse(input, { maxDepth: 1 }), {
      code: 'NESTING_TOO_DEEP',
    });
  });
});

describe('A pair never starts inside the value of another pair', () => {
  const missingCommas = {
    'a flow mapping entry on the line after a value':
      '---\n{\n foo: 1\n bar: 2 }\n',
    'a flow mapping entry continuing a value on its line':
      '{ role: user\n  admin: true }',
    'a second colon in a flow mapping entry': '{ a: b: c }',
    'a second colon in a flow sequence pair': '[ a: b: c ]',
  };

  for (const [name, input] of Object.entries(missingCommas)) {
    it(`rejects ${name}`, () => strict.throws(() => parse(input), SyntaxError));
  }

  it('still reads a pair inside a flow sequence held by a flow mapping', () =>
    assertParsesTo('{ a: [b: c] }', { a: [{ b: 'c' }] }));
});
