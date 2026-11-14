/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

describe('Every construct reads CRLF and bare CR line breaks', () => {
  const lineBreakDocuments = {
    'block map with CRLF line endings': {
      input: 'a: 1\r\nb: 2\r\n',
      expected: { a: 1, b: 2 },
    },
    'block map with bare CR': {
      input: 'a: 1\rb: 2',
      expected: { a: 1, b: 2 },
    },
    'nested block map value after CRLF': {
      input: 'a: 1\r\nb:\r\n  c: 2',
      expected: { a: 1, b: { c: 2 } },
    },
    'map value after CR newline': {
      input: 'a:\r\n  b',
      expected: { a: 'b' },
    },
    'key followed by a colon and CR': {
      input: 'key:\r\n  val',
      expected: { key: 'val' },
    },
    'nested quoted key followed by a colon and CR': {
      input: 'a:\n  "k":\r\n    val',
      expected: { a: { k: 'val' } },
    },
    'explicit key with CRLF': {
      input: '? a\r\n: 1',
      expected: { a: 1 },
    },
    'explicit key with bare CR in block map': {
      input: '? a\r: 1',
      expected: { a: 1 },
    },
    'nested explicit key followed by CR': {
      input: 'a:\n  ? k\r\n  : val',
      expected: { a: { k: 'val' } },
    },
    'nested empty explicit key followed by CR': {
      input: 'a:\n  ?\r\n  : val',
      expected: { a: { '': 'val' } },
    },
    'seq item with CR line ending': {
      input: '- a\r\n- b',
      expected: ['a', 'b'],
    },
    'block seq dash followed by CRLF': {
      input: '-\r\n  a: 1',
      expected: [{ a: 1 }],
    },
    'nested empty map value followed by sibling keys with CRLF': {
      input: 'a:\r\n  b:\r\n    c:\r\n    d: 1\r\n  e: 2\r\nf: 3\r\n',
      expected: { a: { b: { c: null, d: 1 }, e: 2 }, f: 3 },
    },
    'nested empty seq item followed by items and keys with CRLF': {
      input: 'list:\r\n  -\r\n  - b\r\nafter: 1\r\n',
      expected: { list: [null, 'b'], after: 1 },
    },
    "block seq at its key's indentation with CRLF": {
      input:
        'jobs:\r\n  build:\r\n    steps:\r\n    - run: echo hi\r\n    runs-on: ubuntu-latest\r\nnext: 1\r\n',
      expected: {
        jobs: {
          build: { steps: [{ run: 'echo hi' }], 'runs-on': 'ubuntu-latest' },
        },
        next: 1,
      },
    },
    'inline seq item with CRLF after dash': {
      input: '- -\r\n    val',
      expected: [['val']],
    },
    'inline seq item with bare CR after dash': {
      input: '- -\r    val',
      expected: [['val']],
    },
    'flow seq with CR between items': {
      input: '[a,\r\nb]',
      expected: ['a', 'b'],
    },
    'doc-start marker with CRLF': {
      input: '---\r\na: 1\r\n',
      expected: { a: 1 },
    },
    'block scalar with CRLF': {
      input: '|\r\n  hello\r\n  world\r\n',
      expected: 'hello\nworld\n',
    },
    'literal with CRLF empty lines': {
      input: '|\r\n  a\r\n\r\n  b\r\n',
      expected: 'a\n\nb\n',
    },
    'block scalar indent detection with CRLF': {
      input: 'data: |\r\n  line1\r\n  line2',
      expected: { data: 'line1\nline2\n' },
    },
    'block scalar CRLF blank line before content': {
      input: 'data: |\r\n\r\n  line1',
      expected: { data: '\nline1\n' },
    },
  };

  for (const [name, { input, expected }] of Object.entries(
    lineBreakDocuments
  )) {
    it(name, () => strict.deepEqual(parse(input), expected));
  }
});
