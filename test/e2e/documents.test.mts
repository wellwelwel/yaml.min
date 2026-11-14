/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it, strict } from 'poku';
import {
  assertParsesTo,
  parse,
  parseAll,
  read,
} from '../__helpers__/index.mts';

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
    'an empty input': 'documents--empty-input.yaml',
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
      () => parse(read('documents--doc-end-trailing-text.yaml')),
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

describe('An end marker closes a document and never starts one', () => {
  const streams = {
    'a lone end marker': { input: '...\n', expected: [] },
    'a comment and an end marker': { input: '# comment\n...\n', expected: [] },
    'content after a leading end marker': {
      input: read('documents--doc-end-then-content.yaml'),
      expected: ['hello'],
    },
    'a separator after a leading end marker': {
      input: read('documents--doc-end-doc-start.yaml'),
      expected: [{ a: 1 }],
    },
    'a comment between two end markers': {
      input:
        'Bare\ndocument\n...\n# No document\n...\n|\n%!PS-Adobe-2.0 # Not the first line\n',
      expected: ['Bare document', '%!PS-Adobe-2.0 # Not the first line\n'],
    },
  };

  for (const [name, { input, expected }] of Object.entries(streams)) {
    it(`adds no document for the end markers in ${name}`, () =>
      strict.deepEqual(parseAll(input), expected));
  }

  it('parse reads the single document after a leading end marker', () =>
    assertParsesTo(read('documents--doc-end-then-content.yaml'), 'hello'));
});

describe('A block collection never starts on the "---" line', () => {
  const markerLineCollections = {
    'a block mapping': '--- a: b\n',
    'an anchored block mapping': '--- &anchor a: b\n',
    'a block mapping with a quoted key': '--- "a": b\n',
    'a block sequence': '--- - a\n',
    'an explicit key': '--- ? a\n',
  };
  const markerLineNodes = {
    'a plain scalar': { input: '--- text\n', expected: 'text' },
    'a flow sequence': { input: '--- [a, b]\n', expected: ['a', 'b'] },
    'a flow mapping': { input: '--- {a: b}\n', expected: { a: 'b' } },
    'a block scalar': { input: '--- |\n  text\n', expected: 'text\n' },
  };

  for (const [name, input] of Object.entries(markerLineCollections)) {
    it(`rejects ${name} on the marker line`, () =>
      strict.throws(() => parseAll(input), SyntaxError));
  }

  for (const [name, { input, expected }] of Object.entries(markerLineNodes)) {
    it(`reads ${name} on the marker line`, () =>
      strict.deepEqual(parse(input), expected));
  }
});

describe('Directives sit at the start of a line before a "---"', () => {
  const misplacedDirectives = {
    'a directive followed directly by content': '%YAML 1.2\nfoo: 1\n',
    'a directive with no document after it': '%YAML 1.2\n',
    'a directive followed by an end marker': '%YAML 1.2\n...\n',
    'an indented directive before content':
      '  %TAG !e! tag:x,2000:\nfoo: bar\n',
  };

  for (const [name, input] of Object.entries(misplacedDirectives)) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parseAll(input), SyntaxError));
  }
});

describe('A %YAML directive names one YAML 1 version', () => {
  const malformedDirectives = {
    'an extra word after the version': '%YAML 1.2 foo\n---\n',
    'a comment touching the version': '%YAML 1.1#...\n---\n',
    'a second %YAML directive for the same document':
      '%YAML 1.2\n%YAML 1.2\n---\n',
    'a version other than 1': '%YAML 2.0\n---\n',
    'no version': '%YAML\n---\n',
  };
  const acceptedDirectives = {
    'two spaces before the version': '%YAML  1.1\n---\na: 1\n',
    'a tab before the version': '%YAML \t1.1\n---\na: 1\n',
    'a comment after whitespace': '%YAML 1.1  # comment\n---\na: 1\n',
    'a reserved directive with a shorter name': '%YAM 1.1\n---\na: 1\n',
    'a reserved directive with a longer name': '%YAMLL 1.1\n---\na: 1\n',
  };

  for (const [name, input] of Object.entries(malformedDirectives)) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parseAll(input), SyntaxError));
  }

  for (const [name, input] of Object.entries(acceptedDirectives)) {
    it(`reads the document after ${name}`, () =>
      strict.deepEqual(parse(input), { a: 1 }));
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
