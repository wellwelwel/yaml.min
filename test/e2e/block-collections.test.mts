/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it, strict } from 'poku';
import { assertParsesTo, parse, read } from '../__helpers__/index.mts';

describe('A block sequence holds one item per "-" line', () => {
  const sequences = {
    'a sequence of integers': {
      file: 'block-collections--block-seq-integers.yaml',
      expected: [1, 2, 3],
    },
    'a single-item sequence that ends the input': {
      file: 'block-collections--seq-single-item-eof.yaml',
      expected: ['only'],
    },
  };

  for (const [name, { file, expected }] of Object.entries(sequences)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('A block mapping holds one "key: value" entry per line', () => {
  const mappings = {
    'a mapping of mixed scalar types': {
      file: 'block-collections--block-map-mixed.yaml',
      expected: { name: 'Mark McGwire', hr: 65, avg: 0.278 },
    },
    'a value on the line after its key': {
      file: 'block-collections--key-colon-newline-val.yaml',
      expected: { key: 'val' },
    },
    'a value after a tab': {
      file: 'block-collections--key-colon-tab-val.yaml',
      expected: { key: 'val' },
    },
  };

  for (const [name, { file, expected }] of Object.entries(mappings)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('A quoted scalar can be a block mapping key', () => {
  const quotedKeys = {
    'a double-quoted key': {
      file: 'block-collections--quoted-key-double.yaml',
      expected: { 'quoted key': 'value' },
    },
    'a single-quoted key': {
      file: 'block-collections--quoted-key-single.yaml',
      expected: { 'single key': 'value' },
    },
    'a quoted key with a tab before its colon': {
      file: 'block-collections--quoted-key-tab-colon.yaml',
      expected: { key: 'val' },
    },
    'a quoted key whose colon ends the input': {
      file: 'block-collections--quoted-key-colon-eof.yaml',
      expected: { k: null },
    },
    'a nested quoted key followed by a colon and a tab': {
      file: 'block-collections--quoted-key-colon-tab-nested.yaml',
      expected: { a: { k: 'val' } },
    },
    'a quoted key in a nested mapping': {
      file: 'block-collections--quoted-key-nested-map.yaml',
      expected: { outer: { inner: 'val' } },
    },
  };

  for (const [name, { file, expected }] of Object.entries(quotedKeys)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('A single-quoted block mapping key can hold an escaped quote', () => {
  const escapedQuoteKeys = {
    'at the top level': {
      input: "'it''s': value\n",
      expected: { "it's": 'value' },
    },
    'in a nested mapping': {
      input: "outer:\n  'it''s': value\n",
      expected: { outer: { "it's": 'value' } },
    },
    'in a sequence entry': {
      input: "- 'it''s': value\n",
      expected: [{ "it's": 'value' }],
    },
    'made only of an escaped quote': {
      input: "'''': value\n",
      expected: { "'": 'value' },
    },
    'with escaped quotes in a row': {
      input: "'a''b''''c': value\n",
      expected: { "a'b''c": 'value' },
    },
  };

  for (const [name, { input, expected }] of Object.entries(escapedQuoteKeys)) {
    it(`reads the key ${name}`, () => assertParsesTo(input, expected));
  }

  it('keeps a colon that follows an escaped quote inside the scalar', () =>
    assertParsesTo("- 'a'': b'\n", ["a': b"]));
});

describe('An explicit key writes "?" before the key and ":" before its value', () => {
  const explicitKeys = {
    'keys with values': {
      file: 'block-collections--explicit-keys.yaml',
      expected: { a: 1, b: 2 },
    },
    'an empty key': {
      file: 'block-collections--explicit-key-null.yaml',
      expected: { '': 'value' },
    },
    'a key without a value as the last entry': {
      file: 'block-collections--explicit-key-last-entry.yaml',
      expected: { a: 1, b: null },
    },
    'a key without a value at the end of a nested mapping': {
      file: 'block-collections--explicit-key-indented.yaml',
      expected: { outer: { inner: null } },
    },
    'a value on the line after its ":"': {
      file: 'block-collections--explicit-key-colon-newline.yaml',
      expected: { a: 'val' },
    },
    'a lone "?" that ends the input': {
      file: 'block-collections--explicit-key-bare-question.yaml',
      expected: { '': null },
    },
    'a lone "?" that ends a nested mapping': {
      file: 'block-collections--explicit-key-eof-nested.yaml',
      expected: { a: { '': null } },
    },
  };

  for (const [name, { file, expected }] of Object.entries(explicitKeys)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
});

describe('An entry without a value holds null', () => {
  const emptyValues = {
    'a mapping value followed by another entry': {
      file: 'block-collections--empty-map-value.yaml',
      expected: { a: null, b: 2 },
    },
    'a sequence item followed by another item': {
      file: 'block-collections--empty-seq-item.yaml',
      expected: [null, 2],
    },
    'a mapping value followed only by a comment': {
      file: 'block-collections--value-after-key-comment.yaml',
      expected: { a: null },
    },
    'a mapping value that ends the input': {
      file: 'block-collections--key-end-empty-value.yaml',
      expected: { a: 1, b: null },
    },
    'a sequence item that ends the input': {
      file: 'block-collections--seq-dash-eof.yaml',
      expected: [null],
    },
    'a compact sequence item that ends the input': {
      file: 'block-collections--inline-seq-dash-eof.yaml',
      expected: [[null]],
    },
  };

  for (const [name, { file, expected }] of Object.entries(emptyValues)) {
    it(`reads ${name} as null`, () => assertParsesTo(read(file), expected));
  }
});

describe('Block collections nest by indentation', () => {
  const nestedCollections = {
    'a mapping of sequences': {
      file: 'block-collections--map-of-sequences.yaml',
      expected: {
        american: ['Boston Red Sox', 'Detroit Tigers'],
        national: ['New York Mets', 'Chicago Cubs'],
      },
    },
    'mappings nested three levels deep': {
      file: 'block-collections--deep-maps.yaml',
      expected: { a: { b: { c: 'deep' } } },
    },
    'sequences of compact sequences': {
      file: 'block-collections--block-sequences.yaml',
      expected: [
        [1, 2],
        [3, 4],
      ],
    },
    'a sequence between two mapping keys': {
      file: 'block-collections--seq-between-map-keys.yaml',
      expected: { a: 1, b: ['x', 'y'], c: 3 },
    },
    'a configuration of mappings and sequences': {
      file: 'block-collections--real-world-config.yaml',
      expected: {
        name: 'my-project',
        version: '1.0.0',
        dependencies: [
          { name: 'lodash', version: '4.17.21' },
          { name: 'express', version: '4.18.2' },
        ],
        config: {
          debug: true,
          port: 3000,
          host: '0.0.0.0',
          features: ['auth', 'logging'],
          database: { host: 'localhost', port: 5432, name: 'mydb' },
        },
      },
    },
  };

  for (const [name, { file, expected }] of Object.entries(nestedCollections)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }
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

describe('A sequence entry holds any node on its line or the lines below', () => {
  const entries = {
    'a single-quoted scalar': {
      file: 'block-collections--seq-single-quoted.yaml',
      expected: ['hello'],
    },
    'a double-quoted scalar': {
      file: 'block-collections--seq-double-quoted.yaml',
      expected: ['hello'],
    },
    'a flow sequence': {
      file: 'block-collections--seq-flow-seq-inline.yaml',
      expected: [[1, 2]],
    },
    'a flow mapping': {
      file: 'block-collections--seq-flow-map-inline.yaml',
      expected: [{ a: 1 }],
    },
    'a nested sequence whose items sit on the lines below': {
      file: 'block-collections--inline-nested-seq.yaml',
      expected: [['a', 'b']],
    },
    'a nested sequence whose item sits on the line below': {
      file: 'block-collections--inline-seq-dash-newline.yaml',
      expected: [['val']],
    },
    'a nested sequence holding a mapping on the line below': {
      file: 'block-collections--dash-newline-map.yaml',
      expected: [[{ a: 1 }]],
    },
    'a nested sequence with an empty item before the next entry': {
      file: 'block-collections--dash-newline-no-continuation.yaml',
      expected: [[null], 'b'],
    },
    'a nested sequence that ends the input': {
      file: 'block-collections--inline-seq-item-eof.yaml',
      expected: [['end']],
    },
    'a mapping whose value follows a tab': {
      file: 'block-collections--inline-value-colon-tab.yaml',
      expected: [{ a: 'b' }],
    },
  };

  for (const [name, { file, expected }] of Object.entries(entries)) {
    it(`reads ${name} as an entry`, () => assertParsesTo(read(file), expected));
  }
});

describe('A value on the line below its "-" or ":" is followed only by a comment', () => {
  const contentAfterValues = {
    'a sequence entry after a double-quoted scalar':
      'key:\n -\n  "quoted" - x\n',
    'a sequence entry after a single-quoted scalar':
      "key:\n -\n  'quoted' - x\n",
    'a sequence entry after a flow sequence': 'key:\n -\n  [a, b] - x\n',
    'a sequence entry after a flow mapping': 'key:\n -\n  {a: b} - x\n',
    'a sequence entry after an alias': 'k: &a 1\nkey:\n -\n  *a - x\n',
    'a sequence entry two spaces after a value in a sequence indented by two':
      'key:\n  -\n    "q"  - x\n',
    'a sequence entry that touches a value in a top-level sequence':
      '-\n "q"- x\n',
    'a sequence entry that touches a value in a sequence at the indentation of its key':
      'k:\n-\n "q"- x\n',
    'a sequence entry that touches a value in a nested sequence':
      '-\n  -\n    "q"- x\n',
    'an empty sequence entry that touches a value': '-\n "q"-\n',
    'a sequence entry after a value below its tag': '- !!str\n "q"- x\n',
    'a sequence entry after a value below its anchor': '- &a\n "q"- x\n',
    'a sequence entry after a quoted scalar that spans lines':
      '-\n "a\n  b"- x\n',
    'a sequence entry after a flow sequence that spans lines':
      '-\n [a,\n  b]- x\n',
    'a sequence entry after a value and a tab': '-\n "q"\t- x\n',
    'text after a value in a sequence': '-\n "quoted" junk\n',
    'a second value after a value in a sequence': '-\n [a] [b]\n',
    'a sequence entry after a value, with CRLF':
      'key:\r\n -\r\n  "quoted" - x\r\n',
    'a sequence entry after a value, with bare CR':
      'key:\r -\r  "quoted" - x\r',
    'text after a mapping value': 'a:\n  "q" junk\n',
    'a sequence entry after an explicit value': '? a\n:\n  "q" - x\n',
    'text after an explicit value': '? a\n:\n  "q" junk\n',
  };
  const valuesBelowIndicators = {
    'a comment after a double-quoted scalar': {
      input: 'key:\n -\n  "quoted" # note\n - x\n',
      expected: { key: ['quoted', 'x'] },
    },
    'spaces after a single-quoted scalar': {
      input: "-\n 'q'  \n- x\n",
      expected: ['q', 'x'],
    },
    'a tab and a comment after a flow sequence': {
      input: '-\n [a, b]\t# note\n- x\n',
      expected: [['a', 'b'], 'x'],
    },
    'a flow mapping that ends its line': {
      input: '-\n {a: b}\n- x\n',
      expected: [{ a: 'b' }, 'x'],
    },
    'a comment after an alias': {
      input: '- &a 1\n-\n *a # note\n- x\n',
      expected: [1, 1, 'x'],
    },
    'a quoted scalar that spans lines': {
      input: '-\n "a\n  b"\n- x\n',
      expected: ['a b', 'x'],
    },
    'a flow sequence that spans lines': {
      input: '-\n [a,\n  b] # note\n- x\n',
      expected: [['a', 'b'], 'x'],
    },
    'a plain scalar that holds a dash': {
      input: '-\n plain - x\n- y\n',
      expected: ['plain - x', 'y'],
    },
    'a block scalar': {
      input: '-\n |\n  text\n- x\n',
      expected: ['text\n', 'x'],
    },
    'a block sequence': {
      input: '-\n  - a\n  - b\n- x\n',
      expected: [['a', 'b'], 'x'],
    },
    'a block mapping whose first key is quoted': {
      input: '-\n "a": 1\n b: 2\n- x\n',
      expected: [{ a: 1, b: 2 }, 'x'],
    },
    'a block sequence in a nested sequence': {
      input: '-\n  -\n    - a\n  - b\n- x\n',
      expected: [[['a'], 'b'], 'x'],
    },
    'a comment after a value, with CRLF': {
      input: 'key:\r\n -\r\n  "quoted" # note\r\n - x\r\n',
      expected: { key: ['quoted', 'x'] },
    },
    'a value that ends its line, with bare CR': {
      input: 'key:\r -\r  "quoted"\r - x\r',
      expected: { key: ['quoted', 'x'] },
    },
    'a comment after an explicit value': {
      input: '? a\n:\n  "q" # note\nb: 1\n',
      expected: { a: 'q', b: 1 },
    },
    'a block sequence as an explicit value': {
      input: '? a\n:\n  - x\n  - y\nb: 1\n',
      expected: { a: ['x', 'y'], b: 1 },
    },
  };

  for (const [name, input] of Object.entries(contentAfterValues)) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parse(input), { code: 'UNEXPECTED_CONTENT' }));
  }

  it('points at the content that follows the value', () =>
    strict.throws(() => parse('key:\n -\n  "quoted" - x\n'), {
      code: 'UNEXPECTED_CONTENT',
      line: 3,
      column: 12,
    }));

  for (const [name, { input, expected }] of Object.entries(
    valuesBelowIndicators
  )) {
    it(`reads ${name}`, () => assertParsesTo(input, expected));
  }
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
    'a sequence entry among the entries of a mapping': 'a: 1\n- b\n',
    'a sequence entry among the entries of a nested mapping':
      'a:\n  b: 1\n  - c\n',
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
    'sequence item on the line of a dash': '-\t-\n',
    'sequence item on the line of a dash and a space': '- \t- a\n',
    'mapping entry on the line of a dash': '-\tkey: value\n',
    'sequence item on the line of an explicit key': '?\t- a\n',
    'sequence item on the line of an explicit value': '? a\n:\t- b\n',
  };

  for (const [name, input] of Object.entries(tabIndented)) {
    it(`rejects a tab-indented ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }
});

describe('A tab separates a block indicator from a scalar', () => {
  const tabSeparated = {
    'a sequence item': { input: '-\t-1\n', expected: [-1] },
    'nested sequence items': {
      input: 'a:\n  -\tb\n  -\t\tc\n',
      expected: { a: ['b', 'c'] },
    },
    'an explicit key and its value': {
      input: '?\ta\n:\tb\n',
      expected: { a: 'b' },
    },
  };

  for (const [name, { input, expected }] of Object.entries(tabSeparated)) {
    it(`reads ${name} after a tab`, () => assertParsesTo(input, expected));
  }
});

describe('An explicit value may start a collection on its line', () => {
  const compactValues = {
    'a sequence': {
      input: '? a\n: - b\n  - c\n',
      expected: { a: ['b', 'c'] },
    },
    'a mapping': {
      input: '? a\n: b: 1\n  c: 2\n',
      expected: { a: { b: 1, c: 2 } },
    },
    'nested sequences after tabs': {
      input: '? a\n: -\tb\n  -  -\tc\n     - d\n',
      expected: { a: ['b', ['c', 'd']] },
    },
  };

  for (const [name, { input, expected }] of Object.entries(compactValues)) {
    it(`reads ${name}`, () => assertParsesTo(input, expected));
  }
});
