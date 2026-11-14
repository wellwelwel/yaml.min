/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 * and from the https://github.com/yaml/yaml-test-suite cases 9JBA, CVW2, and SU5Z (MIT).
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { assertParsesTo, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

describe('Comments', () => {
  it('before content', () =>
    assertParsesTo(read('comments--comment-before.yaml'), { a: 1 }));

  it('inline', () =>
    assertParsesTo(read('comments--comment-inline.yaml'), { a: 1 }));

  it('between entries', () =>
    assertParsesTo(read('comments--comment-between.yaml'), { a: 1, b: 2 }));

  it('seq ending with trailing comment', () =>
    assertParsesTo(read('comments--seq-trailing-comment.yaml'), ['a', 'b']));

  it('map key with comment in value', () =>
    assertParsesTo(read('comments--map-key-comment.yaml'), { key: 'val' }));

  it('keeps only the text before the comment', () =>
    assertParsesTo(read('comments--plain-value-comment.yaml'), 'hello'));

  it('inline value with comment', () =>
    assertParsesTo(read('comments--inline-value-comment.yaml'), ['val']));

  it('explicit key with comment after key', () =>
    assertParsesTo(read('comments--explicit-key-comment.yaml'), {
      k: 'val',
    }));
});

describe('A comment line never moves the lines after it to another level', () => {
  const documentsWithCommentLines = {
    'an empty nested mapping value': {
      input: 'a:\n  b:\n    c:\n# note\n    # note\n    d: 1\n  e: 2\nf: 3\n',
      expected: { a: { b: { c: null, d: 1 }, e: 2 }, f: 3 },
    },
    'an empty nested sequence item': {
      input: 'list:\n  -\n      # note\n  - b\nafter: 1\n',
      expected: { list: [null, 'b'], after: 1 },
    },
    "a key and its block sequence at the key's indentation": {
      input:
        'steps: # note\n# note\n- run: echo hi\n  # note\n- uses: actions/checkout@v4\nafter: kept\n',
      expected: {
        steps: [{ run: 'echo hi' }, { uses: 'actions/checkout@v4' }],
        after: 'kept',
      },
    },
  };

  for (const [name, { input, expected }] of Object.entries(
    documentsWithCommentLines
  )) {
    it(`after ${name}`, () => assertParsesTo(input, expected));
  }
});

describe('A comment after a tab', () => {
  it('inline comment after tab', () =>
    assertParsesTo(read('comments--inline-comment-after-tab.yaml'), {
      a: 1,
    }));

  it('sequence entry with a tab before its comment', () =>
    assertParsesTo(read('comments--plain-tab-comment.yaml'), ['val']));

  it('nested plain key with a tab before its comment', () =>
    assertParsesTo(read('comments--plain-key-tab-comment-nested.yaml'), {
      a: { k: 'val' },
    }));

  it('nested plain value with a tab before its comment', () =>
    assertParsesTo(read('comments--unquoted-tab-comment-nested.yaml'), {
      a: 'hello',
    }));

  it('explicit key with tab before comment in map key', () =>
    assertParsesTo(read('comments--explicit-key-tab-comment.yaml'), {
      key: 'val',
    }));
});

describe('A comment needs a space or a tab before its "#"', () => {
  const touchingComments = {
    'a closing double quote': 'key: "value"# invalid comment\n',
    'a closing single quote': "key: 'value'# note\n",
    'a closing flow sequence bracket': '---\n[ a, b, c, ]#invalid\n',
    'a closing flow mapping brace in a block mapping': 'key: { a: 1 }# note\n',
    'a comma between flow entries': '---\n[ a, b, c,#invalid\n]\n',
    'an opening flow sequence bracket': '[# note\n a ]\n',
  };
  const separatedComments = {
    'a space after a plain value': {
      input: 'key: value # note\n',
      expected: { key: 'value' },
    },
    'a space after a flow sequence': {
      input: '[a, b] # note\n',
      expected: ['a', 'b'],
    },
    'a tab after a double quote': {
      input: 'key: "value"\t# note\n',
      expected: { key: 'value' },
    },
    'a space after a comma between flow entries': {
      input: '[ a, # note\n b ]\n',
      expected: ['a', 'b'],
    },
  };

  for (const [name, input] of Object.entries(touchingComments)) {
    it(`rejects a "#" touching ${name}`, () =>
      strict.throws(() => parse(input), { code: 'UNEXPECTED_CHARACTER' }));
  }

  for (const [name, { input, expected }] of Object.entries(separatedComments)) {
    it(`reads a comment after ${name}`, () => assertParsesTo(input, expected));
  }

  it('keeps a "#" inside plain text as part of the text', () =>
    assertParsesTo('a#b: c#d\n', { 'a#b': 'c#d' }));
});
