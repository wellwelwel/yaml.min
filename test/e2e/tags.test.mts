import { describe, it, strict } from 'poku';
import { assertParsesTo, parse, parseAll } from '../__helpers__/index.mts';

type ScalarForm = {
  document: (tag: string, text: string) => string;
  parsed: (value: unknown) => unknown;
};

describe('A core tag resolves a scalar by its own rule', () => {
  const taggedScalars: [string, string, unknown][] = [
    ['!!str', '0123', '0123'],
    ['!!str', '1.10', '1.10'],
    ['!!str', 'true', 'true'],
    ['!!str', '~', '~'],
    ['!!int', '5', 5],
    ['!!int', '0x2A', 42],
    ['!!int', '-17', -17],
    ['!!float', '1', 1],
    ['!!float', '1.5', 1.5],
    ['!!float', '-.inf', Number.NEGATIVE_INFINITY],
    ['!!bool', 'false', false],
    ['!!bool', 'True', true],
    ['!!null', '~', null],
    ['!!null', 'null', null],
    ['!', '5', '5'],
    ['!', 'true', 'true'],
  ];
  const scalarForms: Record<string, ScalarForm> = {
    'a plain block mapping value': {
      document: (tag, text) => `value: ${tag} ${text}\n`,
      parsed: (value) => ({ value }),
    },
    'a double-quoted block mapping value': {
      document: (tag, text) => `value: ${tag} "${text}"\n`,
      parsed: (value) => ({ value }),
    },
    'a single-quoted block sequence entry': {
      document: (tag, text) => `- ${tag} '${text}'\n`,
      parsed: (value) => [value],
    },
    'a block scalar': {
      document: (tag, text) => `value: ${tag} |-\n  ${text}\n`,
      parsed: (value) => ({ value }),
    },
    'a plain flow sequence item': {
      document: (tag, text) => `[${tag} ${text}]`,
      parsed: (value) => [value],
    },
    'a double-quoted flow mapping value': {
      document: (tag, text) => `{value: ${tag} "${text}"}`,
      parsed: (value) => ({ value }),
    },
    'the value of a pair in a flow sequence': {
      document: (tag, text) => `[pair: ${tag} ${text}]`,
      parsed: (value) => [{ pair: value }],
    },
  };

  for (const [form, { document, parsed }] of Object.entries(scalarForms)) {
    for (const [tag, text, expected] of taggedScalars) {
      it(`resolves ${tag} ${text} as ${form}`, () =>
        assertParsesTo(document(tag, text), parsed(expected)));
    }
  }
});

describe('A core tag labels a collection or an empty node', () => {
  const taggedNodes: Record<string, [string, unknown]> = {
    'a block sequence under !!seq': ['value: !!seq\n  - a\n', { value: ['a'] }],
    'a block mapping under !!map': [
      'value: !!map\n  a: 1\n',
      { value: { a: 1 } },
    ],
    'a flow sequence under !!seq': ['value: !!seq [a]\n', { value: ['a'] }],
    'a flow mapping under !!map': [
      'value: !!map {a: 1}\n',
      { value: { a: 1 } },
    ],
    'a sequence under the non-specific tag': [
      'value: ! [a]\n',
      { value: ['a'] },
    ],
    'an empty node under !!str': [
      'value: !!str\nnext: 1\n',
      { value: '', next: 1 },
    ],
    'an empty node under !!null': ['value: !!null\n', { value: null }],
    'an empty node under !!seq': ['value: !!seq\n', { value: [] }],
    'an empty node under !!map': ['value: !!map\n', { value: {} }],
    'an empty flow sequence item under !!str': ['[!!str , x]', ['', 'x']],
    'an empty flow sequence item whose tag touches the comma': [
      '[!!str,x]',
      ['', 'x'],
    ],
    'an empty flow mapping value under !!str': ['{a: !!str}', { a: '' }],
  };

  for (const [name, [input, expected]] of Object.entries(taggedNodes)) {
    it(`resolves ${name}`, () => assertParsesTo(input, expected));
  }
});

describe('A tag labels its node across line breaks', () => {
  const taggedAcrossLines: Record<string, [string, unknown]> = {
    'a scalar below the block mapping key holding its tag': [
      'value: !!str\n  0123\n',
      { value: '0123' },
    ],
    'the root scalar below the document marker holding its tag': [
      '--- !!str\n0123\n',
      '0123',
    ],
    'the root scalar below a tag on a line of its own': ['!!int\n42\n', 42],
    'the root scalar below a tag followed by a comment': [
      '--- !!str # zip code\n0123\n',
      '0123',
    ],
    'the root scalar whose anchor stands on the line above its tag': [
      '--- &flag\n!!bool "false"\n',
      false,
    ],
    'the root mapping below its tag': ['--- !!map\nkey: v\n', { key: 'v' }],
    'the root sequence below its tag': ['--- !!seq\n- x\n', ['x']],
    'a block mapping value whose anchor stands on the line above its tag': [
      'enabled:\n  &flag\n  !!bool "false"\n',
      { enabled: false },
    ],
    'a block sequence entry whose anchor and tag each stand on a line of their own':
      ['- &zip\n  !!str\n  0123\n', ['0123']],
    'an indentless sequence below a tag on a line of its own': [
      'value:\n  !!seq\n- x\n',
      { value: ['x'] },
    ],
    'a flow sequence item whose anchor stands on the line above its tag': [
      '[&flag\n !!bool "false"]',
      [false],
    ],
    'a flow mapping key whose anchor stands on the line above its tag': [
      '{&key\n !!int 0x10: x}',
      { '16': 'x' },
    ],
  };

  for (const [name, [input, expected]] of Object.entries(taggedAcrossLines)) {
    it(`resolves ${name}`, () => assertParsesTo(input, expected));
  }
});

describe('A tag before an implicit key labels the key', () => {
  const taggedKeys: Record<string, [string, unknown]> = {
    'a block mapping key': [
      '!!str 1: one\n!!str true: yes\n',
      { '1': 'one', true: 'yes' },
    ],
    'a compact mapping key in a sequence': [
      '- !!str 1: one\n',
      [{ '1': 'one' }],
    ],
    'an explicit key': ['? !!str 2\n: two\n', { '2': 'two' }],
    'an empty explicit key': ['? !!str\n: empty\n', { '': 'empty' }],
    'a flow mapping key': ['{!!int 0x10: x}', { '16': 'x' }],
    'a pair key in a flow sequence': ['[!!str 1: one]', [{ '1': 'one' }]],
    'a key under a tagged block mapping': [
      'outer: !!map\n  !!str 1: one\n',
      { outer: { '1': 'one' } },
    ],
  };

  for (const [name, [input, expected]] of Object.entries(taggedKeys)) {
    it(`resolves a tag on ${name}`, () => assertParsesTo(input, expected));
  }
});

describe('Tag handles and spellings', () => {
  const resolvedSpellings: Record<string, [string, unknown]> = {
    'a verbatim core tag': [
      'value: !<tag:yaml.org,2002:int> "7"\n',
      { value: 7 },
    ],
    'a percent-encoded core tag': ['value: !!in%74 "7"\n', { value: 7 }],
    'a named handle declared by %TAG': [
      '%TAG !e! tag:yaml.org,2002:\n---\nvalue: !e!int "7"\n',
      { value: 7 },
    ],
    'the primary handle redeclared by %TAG': [
      '%TAG ! tag:yaml.org,2002:\n---\nvalue: !int "7"\n',
      { value: 7 },
    ],
  };
  const rejectedHandles = {
    'the secondary handle redeclared away from the core schema':
      '%TAG !! tag:example.com,2000:\n---\nvalue: !!int 7\n',
    'an undeclared named handle': 'value: !e!int 7\n',
    'a named handle declared only for an earlier document':
      '%TAG !e! tag:yaml.org,2002:\n---\na: !e!int 1\n---\nb: !e!int 2\n',
    'a handle declared twice for one document':
      '%TAG !e! tag:yaml.org,2002:\n%TAG !e! tag:yaml.org,2002:\n---\na: 1\n',
    'a %TAG directive without a prefix': '%TAG !e!\n---\na: 1\n',
  };

  for (const [name, [input, expected]] of Object.entries(resolvedSpellings)) {
    it(`resolves ${name}`, () => assertParsesTo(input, expected));
  }

  for (const [name, input] of Object.entries(rejectedHandles)) {
    it(`rejects ${name}`, () =>
      strict.throws(() => parseAll(input), SyntaxError));
  }
});

describe('A tag outside the core schema, or a value that does not fit its tag, is rejected', () => {
  const rejectedTags = {
    '!!int on text': 'value: !!int "five"\n',
    '!!int on an integer past the safe range':
      'value: !!int 12345678901234567890\n',
    '!!int on a fraction': 'value: !!int 1.5\n',
    '!!int on a signed hexadecimal numeral': 'value: !!int -0x10\n',
    '!!float on an overflowing numeral': 'value: !!float 1e999\n',
    '!!float on a hexadecimal numeral': 'value: !!float 0x10\n',
    '!!bool on text': 'value: !!bool "maybe"\n',
    '!!null on text': 'value: !!null "secret"\n',
    '!!int on an empty node': 'value: !!int\n',
    '!!bool on an empty flow sequence item': '[!!bool ]',
    '!!str on a sequence': 'value: !!str [a]\n',
    '!!seq on a scalar': 'value: !!seq a\n',
    '!!seq on a mapping': 'value: !!seq {a: 1}\n',
    '!!map on a block sequence': 'value: !!map\n  - a\n',
    '!!map on an implicit key': '- !!map key: v\n',
    '!!binary': 'value: !!binary aGVsbG8=\n',
    '!!timestamp': 'value: !!timestamp 2001-12-14\n',
    '!!set': 'value: !!set {a: null}\n',
    '!!omap': 'value: !!omap [a: 1]\n',
    '!!pairs': 'value: !!pairs [a: 1]\n',
    '!!merge': 'value: !!merge x\n',
    'an application tag': 'value: !custom 1\n',
    'a verbatim tag outside the core schema':
      'value: !<tag:example.com,2000:x> 1\n',
    'a verbatim non-specific tag': 'value: !<!> x\n',
    'the secondary handle without a suffix': 'value: !! x\n',
    'a tag that runs into its node': 'value: !!seq[a]\n',
    'a tag directly followed by a comma outside a flow collection':
      'value: !!str,x\n',
    'a tag directly followed by "]" outside a flow collection':
      'value: !!str]\n',
    'a tag directly followed by "}" outside a flow collection':
      'value: !!str}\n',
    'an unclosed verbatim tag': 'value: !<tag:yaml.org,2002:str x\n',
    'two tags on one node': 'value: !!str !!int 1\n',
    'a tag on each line of one node': 'value: !!str\n  !!int 5\n',
    'a tag on each line of the root node': '!!str\n!!int 5\n',
    'a tag on each line of a flow sequence item': '[!!str\n !!int 5]',
    'a tag on an alias': 'anchored: &a 1\nvalue: !!str *a\n',
    'a tag on a sequence that starts on its line': '- !!seq - a\n',
  };

  for (const [name, input] of Object.entries(rejectedTags)) {
    it(`rejects ${name}`, () => strict.throws(() => parse(input), SyntaxError));
  }
});
