/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 * and from the https://github.com/yaml/yaml-test-suite cases CT4Q and T833 (MIT).
 */

import { describe, it, strict } from 'poku';
import {
  assertParsesTo,
  parse,
  parseWithinTimeLimit,
  read,
} from '../__helpers__/index.mts';

describe('A flow sequence lists its items between brackets', () => {
  const flowSequences = {
    'an empty sequence': {
      file: 'flow-collections--flow-seq-empty.yaml',
      expected: [],
    },
    'a sequence of integers': {
      file: 'flow-collections--flow-seq-integers.yaml',
      expected: [1, 2, 3],
    },
    'a sequence of booleans and null': {
      file: 'flow-collections--flow-seq-mixed.yaml',
      expected: [true, false, null],
    },
    'a sequence of quoted and plain strings': {
      file: 'flow-collections--flow-seq-strings.yaml',
      expected: ['a', 'b', 'c'],
    },
    'a nested sequence': {
      file: 'flow-collections--flow-seq-nested.yaml',
      expected: [1, [2, 3]],
    },
    'a sequence with a trailing comma': {
      file: 'flow-collections--flow-seq-trailing-comma.yaml',
      expected: ['one', 'two'],
    },
    'a sequence as a block mapping value': {
      file: 'flow-collections--mixed-flow-seq-in-block.yaml',
      expected: { items: [1, 2, 3], name: 'test' },
    },
  };

  for (const [name, { file, expected }] of Object.entries(flowSequences)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('A flow mapping lists its entries between braces', () => {
  const flowMappings = {
    'an empty mapping': {
      file: 'flow-collections--flow-map-empty.yaml',
      expected: {},
    },
    'a mapping of integers': {
      file: 'flow-collections--flow-map-simple.yaml',
      expected: { a: 1, b: 2 },
    },
    'a nested mapping': {
      file: 'flow-collections--flow-map-nested.yaml',
      expected: { a: 1, b: { c: 3 } },
    },
    'a mapping with spaces around its indicators and a trailing comma': {
      file: 'flow-collections--flow-map-spaces.yaml',
      expected: { one: 'two', three: 'four' },
    },
    'a single-quoted key': {
      file: 'flow-collections--flow-map-single-quoted-key.yaml',
      expected: { 'a b': 1 },
    },
    'a double-quoted key': {
      file: 'flow-collections--flow-map-double-quoted-key.yaml',
      expected: { 'a b': 1 },
    },
    'a key without a value as the last entry': {
      file: 'flow-collections--flow-map-key-no-value.yaml',
      expected: { a: 1, b: null },
    },
    'a mapping as a block mapping value': {
      file: 'flow-collections--mixed-flow-map-in-block.yaml',
      expected: { meta: { a: 1, b: 2 }, name: 'test' },
    },
  };

  for (const [name, { file, expected }] of Object.entries(flowMappings)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('A "key: value" item of a flow sequence is a single-pair mapping', () => {
  const implicitPairs = {
    'a key and a value': {
      file: 'flow-collections--flow-seq-implicit-pair.yaml',
      expected: [{ foo: 'bar' }],
    },
    'a key without a value before a comma and a space': {
      file: 'flow-collections--flow-key-comma.yaml',
      expected: [{ a: null }, 'b'],
    },
    'a key without a value before the closing bracket': {
      file: 'flow-collections--flow-implicit-key-bracket.yaml',
      expected: [{ a: null }],
    },
    'a key without a value right before a comma': {
      file: 'flow-collections--flow-implicit-key-comma.yaml',
      expected: [{ a: null }, 'b'],
    },
  };

  for (const [name, { file, expected }] of Object.entries(implicitPairs)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
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

    strict.deepEqual(parse(input, { maxDepth: 2 }), [{ a: 'x' }]);
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
