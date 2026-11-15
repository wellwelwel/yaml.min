/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it, strict } from 'poku';
import {
  parse,
  parseAll,
  parseWithinTimeLimit,
} from '../__helpers__/index.mts';

describe('Every construct reads CRLF and bare CR line breaks', () => {
  const lineBreakDocuments = {
    'a block mapping split by CRLF': {
      input: 'a: 1\r\nb: 2\r\n',
      expected: { a: 1, b: 2 },
    },
    'a block mapping split by bare CR': {
      input: 'a: 1\rb: 2',
      expected: { a: 1, b: 2 },
    },
    'a nested block mapping after CRLF': {
      input: 'a: 1\r\nb:\r\n  c: 2',
      expected: { a: 1, b: { c: 2 } },
    },
    'a mapping value on the line after its key, after CRLF': {
      input: 'a:\r\n  b',
      expected: { a: 'b' },
    },
    'a nested quoted key followed by a colon and CRLF': {
      input: 'a:\n  "k":\r\n    val',
      expected: { a: { k: 'val' } },
    },
    'an explicit key and its value split by CRLF': {
      input: '? a\r\n: 1',
      expected: { a: 1 },
    },
    'an explicit key and its value split by bare CR': {
      input: '? a\r: 1',
      expected: { a: 1 },
    },
    'a nested explicit key followed by CRLF': {
      input: 'a:\n  ? k\r\n  : val',
      expected: { a: { k: 'val' } },
    },
    'a nested empty explicit key followed by CRLF': {
      input: 'a:\n  ?\r\n  : val',
      expected: { a: { '': 'val' } },
    },
    'block sequence items split by CRLF': {
      input: '- a\r\n- b',
      expected: ['a', 'b'],
    },
    'a block sequence dash followed by CRLF': {
      input: '-\r\n  a: 1',
      expected: [{ a: 1 }],
    },
    'the sibling keys after an empty nested mapping value, with CRLF': {
      input: 'a:\r\n  b:\r\n    c:\r\n    d: 1\r\n  e: 2\r\nf: 3\r\n',
      expected: { a: { b: { c: null, d: 1 }, e: 2 }, f: 3 },
    },
    'the items and keys after an empty nested sequence item, with CRLF': {
      input: 'list:\r\n  -\r\n  - b\r\nafter: 1\r\n',
      expected: { list: [null, 'b'], after: 1 },
    },
    "a block sequence at its key's indentation, with CRLF": {
      input:
        'jobs:\r\n  build:\r\n    steps:\r\n    - run: echo hi\r\n    runs-on: ubuntu-latest\r\nnext: 1\r\n',
      expected: {
        jobs: {
          build: { steps: [{ run: 'echo hi' }], 'runs-on': 'ubuntu-latest' },
        },
        next: 1,
      },
    },
    'a compact sequence item whose value follows CRLF': {
      input: '- -\r\n    val',
      expected: [['val']],
    },
    'a compact sequence item whose value follows bare CR': {
      input: '- -\r    val',
      expected: [['val']],
    },
    'a flow sequence with CRLF between items': {
      input: '[a,\r\nb]',
      expected: ['a', 'b'],
    },
    'a flow mapping whose value follows CRLF': {
      input: '{a:\r\nb}',
      expected: { a: 'b' },
    },
    'a document start marker followed by CRLF': {
      input: '---\r\na: 1\r\n',
      expected: { a: 1 },
    },
    'a literal block scalar with CRLF line ends': {
      input: '|\r\n  hello\r\n  world\r\n',
      expected: 'hello\nworld\n',
    },
    'a literal block scalar with an empty CRLF line': {
      input: '|\r\n  a\r\n\r\n  b\r\n',
      expected: 'a\n\nb\n',
    },
    'a block scalar whose indentation is detected across CRLF': {
      input: 'data: |\r\n  line1\r\n  line2',
      expected: { data: 'line1\nline2\n' },
    },
    'a block scalar with an empty CRLF line before its content': {
      input: 'data: |\r\n\r\n  line1',
      expected: { data: '\nline1\n' },
    },
    'a literal block scalar with bare CR line ends': {
      input: '|\r  hello\r  world\r',
      expected: 'hello\nworld\n',
    },
    'a literal block scalar that mixes bare CR and LF line ends': {
      input: 'text: |\r  one\n  two\rnext: 1\n',
      expected: { text: 'one\ntwo\n', next: 1 },
    },
  };

  for (const [name, { input, expected }] of Object.entries(
    lineBreakDocuments
  )) {
    it(`reads ${name}`, () => strict.deepEqual(parse(input), expected));
  }
});

describe('A bare CR ends every comment and directive line', () => {
  const documentsWithCommentsAndDirectives = {
    'a trailing comment': {
      input: 'enabled: false # reviewed\rpolicy: strict\r',
      expected: { enabled: false, policy: 'strict' },
    },
    'a comment line': {
      input: '# settings\rname: app\r',
      expected: { name: 'app' },
    },
    'a comment line indented by a tab': {
      input: 'a: 1\r\t# note\rb: 2\r',
      expected: { a: 1, b: 2 },
    },
    'an empty mapping value with a comment': {
      input: 'a: # note\r  b: 1\rc: 2\r',
      expected: { a: { b: 1 }, c: 2 },
    },
    'a sequence dash with a comment': {
      input: '- # note\r  a: 1\r- b\r',
      expected: [{ a: 1 }, 'b'],
    },
    'a block scalar header with a comment': {
      input: 'text: | # note\r  hello\rnext: 1\r',
      expected: { text: 'hello\n', next: 1 },
    },
    'a comment inside a flow collection': {
      input: '[a, # note\r b]\r',
      expected: ['a', 'b'],
    },
    'a document start marker with a comment': {
      input: '--- # note\rname: app\r',
      expected: { name: 'app' },
    },
    'a %YAML directive': {
      input: '%YAML 1.2\r---\rname: app\r',
      expected: { name: 'app' },
    },
    'a reserved directive': {
      input: '%FOO bar\r---\rname: app\r',
      expected: { name: 'app' },
    },
    'a %TAG directive with a comment': {
      input: '%TAG !e! tag:example.com,2000: # note\r---\rname: app\r',
      expected: { name: 'app' },
    },
    'a trailing comment in a document whose other lines end with LF': {
      input: 'a: 1 # note\rhidden: 2\nb: 3\n',
      expected: { a: 1, hidden: 2, b: 3 },
    },
    'a trailing comment that follows a comment ended by LF': {
      input: 'a: 1 # one\nb: 2 # two\rhidden: 3\n',
      expected: { a: 1, b: 2, hidden: 3 },
    },
  };

  for (const [name, { input, expected }] of Object.entries(
    documentsWithCommentsAndDirectives
  )) {
    it(`reads the lines after ${name}`, () =>
      strict.deepEqual(parse(input), expected));
  }

  it('reads every document after a document end marker with a comment', () =>
    strict.deepEqual(parseAll('a: 1\r... # note\r---\rb: 2\r'), [
      { a: 1 },
      { b: 2 },
    ]));
});

describe('A comment that ends with a bare CR hides no line from the checks', () => {
  const invalidDocuments = {
    'a repeated key': {
      input: 'admin: false # note\radmin: true\r',
      code: 'DUPLICATE_KEY',
    },
    'a second document': {
      input: 'a: 1 # note\r---\rb: 2\r',
      code: 'MULTIPLE_DOCUMENTS',
    },
    'an unterminated flow collection': {
      input: 'a: 1 # note\rb: [1, 2\r',
      code: 'UNTERMINATED_FLOW_COLLECTION',
    },
    'a repeated key below a comment line ended by LF': {
      input: '# header\nadmin: false # note\radmin: true\n',
      code: 'DUPLICATE_KEY',
    },
  };

  for (const [name, { input, code }] of Object.entries(invalidDocuments)) {
    it(`rejects ${name} after the comment`, () =>
      strict.throws(() => parse(input), { code }));
  }
});

await describe('Lines that end with a bare CR are read in time proportional to their number', async () => {
  const bareCarriageReturnDocuments = {
    'comment lines': `${'# comment\r'.repeat(200_000)}a: 1\r`,
    'block scalar lines': `text: |\r${'  line\r'.repeat(200_000)}`,
  };

  for (const [name, input] of Object.entries(bareCarriageReturnDocuments)) {
    await it(`reads 200,000 ${name} within the time limit`, async () => {
      const outcome = await parseWithinTimeLimit(input);

      strict.equal(outcome, 'returned');
    });
  }
});
