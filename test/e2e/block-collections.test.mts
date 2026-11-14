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

describe('Block sequences', () => {
  it('integers', () =>
    assertParsesTo(
      read('block-collections--block-seq-integers.yaml'),
      [1, 2, 3]
    ));

  it('strings', () =>
    assertParsesTo(read('block-collections--block-seq-strings.yaml'), [
      'a',
      'b',
      'c',
    ]));

  it('plain', () =>
    assertParsesTo(read('block-collections--block-seq-plain.yaml'), [
      'one',
      'two',
    ]));

  it('single item sequence at the end of input', () =>
    assertParsesTo(read('block-collections--seq-single-item-eof.yaml'), [
      'only',
    ]));
});

describe('Block mappings', () => {
  it('simple', () =>
    assertParsesTo(read('block-collections--block-map-simple.yaml'), {
      a: 1,
      b: 2,
    }));

  it('mixed types', () =>
    assertParsesTo(read('block-collections--block-map-mixed.yaml'), {
      name: 'Mark McGwire',
      hr: 65,
      avg: 0.278,
    }));

  it('plain key colon at end of line', () =>
    assertParsesTo(read('block-collections--key-colon-newline-val.yaml'), {
      key: 'val',
    }));

  it('plain key colon-tab value', () =>
    assertParsesTo(read('block-collections--key-colon-tab-val.yaml'), {
      key: 'val',
    }));
});

describe('Quoted keys', () => {
  it('double-quoted', () =>
    assertParsesTo(read('block-collections--quoted-key-double.yaml'), {
      'quoted key': 'value',
    }));

  it('single-quoted', () =>
    assertParsesTo(read('block-collections--quoted-key-single.yaml'), {
      'single key': 'value',
    }));

  it('quoted key with tab before colon', () =>
    assertParsesTo(read('block-collections--quoted-key-tab-colon.yaml'), {
      key: 'val',
    }));

  it('quoted key with colon at the end of input', () =>
    assertParsesTo(read('block-collections--quoted-key-colon-eof.yaml'), {
      k: null,
    }));

  it('nested quoted key followed by a colon and a tab', () =>
    assertParsesTo(
      read('block-collections--quoted-key-colon-tab-nested.yaml'),
      {
        a: { k: 'val' },
      }
    ));

  it('quoted key as top-level map entry', () =>
    assertParsesTo(read('block-collections--quoted-key-top-level.yaml'), {
      name: 'John',
    }));

  it('quoted key in a nested mapping', () =>
    assertParsesTo(read('block-collections--quoted-key-nested-map.yaml'), {
      outer: { inner: 'val' },
    }));
});

describe('Explicit keys', () => {
  it('block explicit keys', () =>
    assertParsesTo(read('block-collections--explicit-keys.yaml'), {
      a: 1,
      b: 2,
    }));

  it('explicit key with no value', () =>
    assertParsesTo(read('block-collections--explicit-key-no-value.yaml'), {
      a: null,
    }));

  it('explicit key null key', () =>
    assertParsesTo(read('block-collections--explicit-key-null.yaml'), {
      '': 'value',
    }));

  it('explicit key as last entry in document', () =>
    assertParsesTo(read('block-collections--explicit-key-last-entry.yaml'), {
      a: 1,
      b: null,
    }));

  it('explicit key at end of indented block', () =>
    assertParsesTo(read('block-collections--explicit-key-indented.yaml'), {
      outer: { inner: null },
    }));

  it('explicit key with colon-newline value', () =>
    assertParsesTo(read('block-collections--explicit-key-colon-newline.yaml'), {
      a: 'val',
    }));

  it('explicit key ? at very end of input', () =>
    assertParsesTo(read('block-collections--explicit-key-bare-question.yaml'), {
      '': null,
    }));

  it('nested explicit key at the end of input', () =>
    assertParsesTo(read('block-collections--explicit-key-eof-nested.yaml'), {
      a: { '': null },
    }));
});

describe('Empty values', () => {
  it('empty map value', () =>
    assertParsesTo(read('block-collections--empty-map-value.yaml'), {
      a: null,
      b: 2,
    }));

  it('empty sequence item', () =>
    assertParsesTo(read('block-collections--empty-seq-item.yaml'), [null, 2]));

  it('value after key with only comments remaining', () =>
    assertParsesTo(read('block-collections--value-after-key-comment.yaml'), {
      a: null,
    }));

  it('key at end with empty value', () =>
    assertParsesTo(read('block-collections--key-end-empty-value.yaml'), {
      a: 1,
      b: null,
    }));

  it('sequence dash at the end of input without value', () =>
    assertParsesTo(read('block-collections--seq-dash-eof.yaml'), [null]));

  it('inline sequence dash at very end', () =>
    assertParsesTo(read('block-collections--inline-seq-dash-eof.yaml'), [
      [null],
    ]));
});

describe('An empty nested value leaves the lines after it at their own level', () => {
  const documentsWithEmptyNestedValues = {
    'the sibling keys after an empty mapping value': {
      input:
        'on:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  build: ok\n',
      expected: {
        on: { pull_request: null, push: { branches: ['main'] } },
        jobs: { build: 'ok' },
      },
    },
    'the keys of every enclosing mapping after an empty mapping value': {
      input: 'a:\n  b:\n    c:\n    d: 1\n  e: 2\nf: 3\n',
      expected: { a: { b: { c: null, d: 1 }, e: 2 }, f: 3 },
    },
    'the items and keys after an empty sequence item': {
      input: 'list:\n  -\n  - b\nafter: 1\n',
      expected: { list: [null, 'b'], after: 1 },
    },
  };

  for (const [name, { input, expected }] of Object.entries(
    documentsWithEmptyNestedValues
  )) {
    it(`keeps ${name}`, () => assertParsesTo(input, expected));
  }
});

describe('A block sequence may start at the indentation of its key', () => {
  const sequencesAtKeyIndentation = {
    'a top-level key': {
      input:
        'steps:\n- run: echo hi\n- uses: actions/checkout@v4\nafter: kept\n',
      expected: {
        steps: [{ run: 'echo hi' }, { uses: 'actions/checkout@v4' }],
        after: 'kept',
      },
    },
    'a nested key': {
      input:
        'jobs:\n  build:\n    steps:\n    - run: echo hi\n    runs-on: ubuntu-latest\nnext: 1\n',
      expected: {
        jobs: {
          build: { steps: [{ run: 'echo hi' }], 'runs-on': 'ubuntu-latest' },
        },
        next: 1,
      },
    },
    'a key that follows an empty value': {
      input: 'a:\nb:\n- 1\n- 2\nc: 3\n',
      expected: { a: null, b: [1, 2], c: 3 },
    },
  };

  for (const [name, { input, expected }] of Object.entries(
    sequencesAtKeyIndentation
  )) {
    it(`reads the sequence of ${name} and the keys after it`, () =>
      assertParsesTo(input, expected));
  }
});

describe('Compact values after a sequence entry', () => {
  it('single-quoted inline', () =>
    assertParsesTo(read('block-collections--seq-single-quoted.yaml'), [
      'hello',
    ]));

  it('double-quoted inline', () =>
    assertParsesTo(read('block-collections--seq-double-quoted.yaml'), [
      'hello',
    ]));

  it('flow sequence inline', () =>
    assertParsesTo(read('block-collections--seq-flow-seq-inline.yaml'), [
      [1, 2],
    ]));

  it('flow map inline', () =>
    assertParsesTo(read('block-collections--seq-flow-map-inline.yaml'), [
      { a: 1 },
    ]));

  it('nested sequence item with value on next line', () =>
    assertParsesTo(read('block-collections--inline-nested-seq.yaml'), [
      ['a', 'b'],
    ]));

  it('inline sequence items with next-line values', () =>
    assertParsesTo(read('block-collections--inline-seq-anchor.yaml'), [
      [1, 1],
    ]));

  it('inline sequence dash then newline with indented value', () =>
    assertParsesTo(read('block-collections--inline-seq-dash-newline.yaml'), [
      ['val'],
    ]));

  it('dash newline then indented map', () =>
    assertParsesTo(read('block-collections--dash-newline-map.yaml'), [
      [{ a: 1 }],
    ]));

  it('dash newline with no indented continuation', () =>
    assertParsesTo(
      read('block-collections--dash-newline-no-continuation.yaml'),
      [[null], 'b']
    ));

  it('inline sequence with two items same line', () =>
    assertParsesTo(read('block-collections--inline-seq-two-items.yaml'), [
      ['a', 'b'],
    ]));

  it('inline sequence item at the end of input', () =>
    assertParsesTo(read('block-collections--inline-seq-item-eof.yaml'), [
      ['end'],
    ]));

  it('sequence dash-newline then map at deeper indent', () =>
    assertParsesTo(read('block-collections--seq-dash-newline-map.yaml'), [
      { a: 1 },
      { b: 2 },
    ]));

  it('inline value with colon-tab', () =>
    assertParsesTo(read('block-collections--inline-value-colon-tab.yaml'), [
      { a: 'b' },
    ]));
});

describe('Malformed block structure is rejected instead of dropped', () => {
  const malformedBlocks = {
    'a line that is not a mapping entry':
      'user: alice\nrole: viewer\nstray line\nadmin: true\naudit: enabled\n',
    'a mapping entry dedented to no open level':
      'server:\n    port: 80\n  host: x\nadmin: true\n',
    'a mapping entry dedented between two open levels':
      'a:\n  b: 1\n c: 2\nd: 3\n',
    'a sequence item dedented to no open level':
      'list:\n    - a\n  - b\nadmin: true\n',
    'a nested mapping entry indented under a scalar value':
      'outer:\n  inner: 1\n    deeper: 2\n',
    'a mapping entry indented under a top-level scalar value': read(
      'block-collections--map-indent-mismatch.yaml'
    ),
    'a line indented under a scalar value after a comment':
      'k: first\n  # comment\n  second\n',
    'an explicit key followed by an unexpected line': '? a\n   junk: 1\nb: 2\n',
    'a mapping nested inside a value by a colon and a tab': read(
      'block-collections--colon-tab-splits.yaml'
    ),
    'a mapping nested inside a value by a colon at the end of a line': read(
      'block-collections--colon-end-of-line.yaml'
    ),
    'a mapping nested inside a value by a colon before a CRLF': 'a: b:\r\nb: 2',
    'a value ending with a colon at the end of input': read(
      'block-collections--plain-ending-colon-eof.yaml'
    ),
    'a single-quoted key whose colon is not followed by whitespace': read(
      'block-collections--single-quoted-colon-no-ws.yaml'
    ),
    'a double-quoted key whose colon is not followed by whitespace': read(
      'block-collections--double-quoted-colon-no-ws.yaml'
    ),
  };

  for (const [name, input] of Object.entries(malformedBlocks)) {
    it(`rejects ${name}`, () => strict.throws(() => parse(input), SyntaxError));
  }
});

describe('A tab is never indentation', () => {
  const tabIndented = {
    'nested mapping entry': 'a:\n\tb: 1\n',
    'sibling mapping entry': 'parent:\n  child: 1\n\tsibling: 2\n',
    'mapping entry with spaces after the tab': 'a:\n  b:\n\t  c: 1\n',
    'sequence item': '- a\n\t- b\n',
  };

  for (const [name, input] of Object.entries(tabIndented)) {
    it(`rejects a tab-indented ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }
});
