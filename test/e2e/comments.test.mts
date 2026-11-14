/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 * and from the https://github.com/yaml/yaml-test-suite cases 9JBA, CVW2, and SU5Z (MIT).
 */

import { describe, it, strict } from 'poku';
import { assertParsesTo, parse, read } from '../__helpers__/index.mts';

describe('A comment is left out of the value it follows', () => {
  const commentedDocuments = {
    'a comment line before the content': {
      file: 'comments--comment-before.yaml',
      expected: { a: 1 },
    },
    'a comment line between mapping entries': {
      file: 'comments--comment-between.yaml',
      expected: { a: 1, b: 2 },
    },
    'a comment line after the last sequence item': {
      file: 'comments--seq-trailing-comment.yaml',
      expected: ['a', 'b'],
    },
    'a comment after a top-level plain scalar': {
      file: 'comments--plain-value-comment.yaml',
      expected: 'hello',
    },
    'a comment after a sequence item': {
      file: 'comments--inline-value-comment.yaml',
      expected: ['val'],
    },
    'a comment after an explicit key': {
      file: 'comments--explicit-key-comment.yaml',
      expected: { k: 'val' },
    },
  };

  for (const [name, { file, expected }] of Object.entries(commentedDocuments)) {
    it(`reads the document around ${name}`, () =>
      assertParsesTo(read(file), expected));
  }
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

describe('A tab can separate a comment from the value before it', () => {
  const tabSeparatedComments = {
    'a mapping value': {
      file: 'comments--inline-comment-after-tab.yaml',
      expected: { a: 1 },
    },
    'a sequence item': {
      file: 'comments--plain-tab-comment.yaml',
      expected: ['val'],
    },
    'a nested mapping value': {
      file: 'comments--plain-key-tab-comment-nested.yaml',
      expected: { a: { k: 'val' } },
    },
    'a nested plain scalar on its own line': {
      file: 'comments--unquoted-tab-comment-nested.yaml',
      expected: { a: 'hello' },
    },
    'an explicit key': {
      file: 'comments--explicit-key-tab-comment.yaml',
      expected: { key: 'val' },
    },
  };

  for (const [name, { file, expected }] of Object.entries(
    tabSeparatedComments
  )) {
    it(`reads ${name} followed by a tab and a comment`, () =>
      assertParsesTo(read(file), expected));
  }
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
