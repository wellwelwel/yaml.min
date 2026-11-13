/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { assertParsesTo, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse, parseAll } = require('../../src/index.ts');

describe('Document markers frame a document', () => {
  const framedDocuments = {
    'a start marker': {
      file: 'documents--doc-start.yaml',
      expected: { a: 1 },
    },
    'a start and an end marker': {
      file: 'documents--doc-start-end.yaml',
      expected: { a: 1 },
    },
    'a directive and a start marker': {
      file: 'documents--directive-doc-start.yaml',
      expected: 'hello',
    },
  };

  for (const [name, { file, expected }] of Object.entries(framedDocuments)) {
    it(`reads a document framed by ${name}`, () =>
      assertParsesTo(read(file), expected));
  }
});

describe('A document without content is null', () => {
  const emptyDocuments = {
    'only a start marker': 'documents--doc-start-only.yaml',
    'a start marker and a line break':
      'documents--doc-start-trailing-newline.yaml',
    'a start and an end marker with nothing between':
      'documents--doc-end-no-content.yaml',
    'only whitespace': 'documents--trailing-whitespace.yaml',
  };

  for (const [name, file] of Object.entries(emptyDocuments)) {
    it(`reads ${name} as null`, () => assertParsesTo(read(file), null));
  }
});

describe('An end marker line holds nothing but the marker and a comment', () => {
  it('rejects text after an end marker on the same line', () =>
    strict.throws(
      () => parse(read('documents--doc-end-trailing-comment.yaml')),
      SyntaxError
    ));
});

describe('parse never returns part of a multi-document stream', () => {
  const multiDocumentStreams = {
    'a second document after a separator':
      'kind: Safe\n---\nkind: Dangerous\nprivileged: true\n',
    'a trailing separator with nothing after it': 'a: 1\n---\n',
    'a separator after an explicit document end': 'a: 1\n...\n---\nb: 2\n',
    'a separator line with trailing space': 'a: 1\n--- \nb: 2',
    'a separator below a top-level plain scalar': 'first\n---\nsecond',
    'two explicitly started documents': '---\nfirst\n---\nsecond\n',
    'a separator after a folded block scalar': '--- >\n  a\n  b\n---\nc',
    'a directive before each document':
      '%YAML 1.2\n---\na: 1\n...\n%YAML 1.2\n---\nb: 2\n',
    'content after a leading end marker': read(
      'documents--doc-end-then-content.yaml'
    ),
    'a separator after a leading end marker': read(
      'documents--doc-end-doc-start.yaml'
    ),
  };

  for (const [name, input] of Object.entries(multiDocumentStreams)) {
    it(`rejects a stream with ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }

  it('accepts a single document closed by an end marker', () =>
    strict.deepEqual(parse('a: 1\n...\n'), { a: 1 }));
});

describe('A document marker inside a quoted scalar is an error', () => {
  const quotedAcrossMarkers = {
    'a double-quoted value crossing a separator': 'k: "abc\n---\nx"',
    'a single-quoted scalar crossing a separator': "'abc\n---\nx'",
    'a double-quoted scalar crossing an end marker': '"abc\n...\nx"',
  };

  for (const [name, input] of Object.entries(quotedAcrossMarkers)) {
    it(`parse rejects ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));

    it(`parseAll rejects ${name}`, () =>
      strict.throws(() => parseAll(input), SyntaxError));
  }
});

describe('parseAll returns every document in order', () => {
  const streams = {
    'two mappings': {
      input: 'kind: Safe\n---\nkind: Dangerous\nprivileged: true\n',
      expected: [{ kind: 'Safe' }, { kind: 'Dangerous', privileged: true }],
    },
    'a trailing separator as an empty document': {
      input: 'a: 1\n---\n',
      expected: [{ a: 1 }, null],
    },
    'an end marker followed by a new document': {
      input: 'a: 1\n...\n---\nb: 2\n',
      expected: [{ a: 1 }, { b: 2 }],
    },
    'plain scalars split by a separator': {
      input: 'first\n---\nsecond',
      expected: ['first', 'second'],
    },
    'directives before each document': {
      input: '%YAML 1.2\n---\na: 1\n...\n%YAML 1.2\n---\nb: 2\n',
      expected: [{ a: 1 }, { b: 2 }],
    },
    'a leading end marker as an empty document': {
      input: '...\nhello',
      expected: [null, 'hello'],
    },
    'a single document': {
      input: 'a: 1',
      expected: [{ a: 1 }],
    },
    'an empty stream as no documents': {
      input: '',
      expected: [],
    },
  };

  for (const [name, { input, expected }] of Object.entries(streams)) {
    it(`returns ${name}`, () => strict.deepEqual(parseAll(input), expected));
  }
});

describe('A document may start indented', () => {
  const indentedDocuments = {
    'a mapping after a blank line': {
      input: '\n  a: 1\n  b:\n    c: 2\n',
      expected: { a: 1, b: { c: 2 } },
    },
    'a sequence': {
      input: '  - a\n  - b\n',
      expected: ['a', 'b'],
    },
    'a mapping after a directive and a separator': {
      input: '%YAML 1.2\n---\n  a: 1\n  b: 2\n',
      expected: { a: 1, b: 2 },
    },
  };

  for (const [name, { input, expected }] of Object.entries(indentedDocuments)) {
    it(`parse reads ${name}`, () => strict.deepEqual(parse(input), expected));

    it(`parseAll reads ${name}`, () =>
      strict.deepEqual(parseAll(input), [expected]));
  }
});

describe('parseAll guards every document on its own', () => {
  const laterDocumentFaults = {
    'an alias to an anchor from an earlier document': 'a: &x 1\n---\nb: *x\n',
    'a dangling alias in a later document': 'a: 1\n---\nb: *x\n',
    'an unterminated quote in a later document': 'a: 1\n---\nb: "open\n',
    'an unclosed flow collection in a later document': 'a: 1\n---\nb: [1, 2\n',
  };

  for (const [name, input] of Object.entries(laterDocumentFaults)) {
    it(`rejects a stream holding ${name}`, () =>
      strict.throws(() => parseAll(input), SyntaxError));
  }
});
