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

describe('Single-quoted strings', () => {
  it('simple', () =>
    assertParsesTo(read('quoted-scalars--string-single-simple.yaml'), 'hello'));

  it('escaped quote', () =>
    assertParsesTo(read('quoted-scalars--string-single-escaped.yaml'), "he's"));

  it('complex', () =>
    assertParsesTo(
      read('quoted-scalars--string-single-complex.yaml'),
      " # Not a 'comment'."
    ));

  it('top-level quoted string not a map key', () =>
    assertParsesTo(
      read('quoted-scalars--top-level-quoted-string.yaml'),
      'hello world'
    ));
});

describe('Double-quoted strings', () => {
  it('simple', () =>
    assertParsesTo(read('quoted-scalars--string-double-simple.yaml'), 'hello'));

  it('newline', () =>
    assertParsesTo(
      read('quoted-scalars--string-double-newline.yaml'),
      'hello\nworld'
    ));

  it('tab', () =>
    assertParsesTo(read('quoted-scalars--string-double-tab.yaml'), '\t'));

  it('hex escape', () =>
    assertParsesTo(read('quoted-scalars--string-double-hex.yaml'), 'A'));

  it('unicode 4', () =>
    assertParsesTo(read('quoted-scalars--string-double-unicode4.yaml'), 'A'));

  it('unicode 8', () =>
    assertParsesTo(read('quoted-scalars--string-double-unicode8.yaml'), 'A'));

  it('unicode smiley', () =>
    assertParsesTo(
      read('quoted-scalars--string-double-smiley.yaml'),
      'Sosa did fine.\u263A'
    ));

  it('control chars', () =>
    assertParsesTo(
      read('quoted-scalars--string-double-control.yaml'),
      '\b1998\t1999\t2000\n'
    ));

  it('null escape', () =>
    assertParsesTo(read('quoted-scalars--string-double-null.yaml'), '\x00'));

  it('bell', () =>
    assertParsesTo(read('quoted-scalars--string-double-bell.yaml'), '\x07'));

  it('escape char', () =>
    assertParsesTo(read('quoted-scalars--string-double-escape.yaml'), '\x1b'));

  it('slash', () =>
    assertParsesTo(read('quoted-scalars--string-double-slash.yaml'), '/'));

  it('backslash', () =>
    assertParsesTo(read('quoted-scalars--string-double-backslash.yaml'), '\\'));
});

describe('A quoted scalar must reach its closing quote', () => {
  const unterminated = {
    'single-quoted mapping value': "k: 'abc",
    'double-quoted mapping value': 'k: "abc',
    'single-quoted flow sequence item': "['abc]",
    'double-quoted flow sequence item': '["abc]',
    'single-quoted value ending in an escaped quote': "k: 'it''s",
    'double-quoted value ending in an escaped quote': 'k: "abc\\"',
    'single-quoted value folded across lines': "k: 'abc\n  def",
    'single-quoted top-level scalar': read(
      'quoted-scalars--unclosed-single-quote.yaml'
    ),
    'double-quoted top-level scalar': read(
      'quoted-scalars--unclosed-double-quote.yaml'
    ),
  };

  for (const [name, input] of Object.entries(unterminated)) {
    it(`rejects an unterminated ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }
});

describe('A trailing backslash is a truncated escape', () => {
  const trailingBackslash = {
    'after text in a mapping value': 'k: "abc\\',
    'as the only content of a mapping value': 'k: "\\',
    'after text in a top-level scalar': '"abc\\',
  };

  for (const [name, input] of Object.entries(trailingBackslash)) {
    it(`rejects a trailing backslash ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }
});

describe('A hexadecimal escape holds exactly its width in hexadecimal digits', () => {
  const malformedHexEscapes = {
    'a two-digit escape that would swallow the closing quote':
      'a: "\\x2"\nb: kept\n',
    'an eight-digit escape that would swallow the next entry':
      'role: "\\U0000"\nadmin: true\n',
    'a two-digit escape with no hexadecimal digits': 'k: "\\xZZ"',
    'a four-digit escape with no hexadecimal digits': 'k: "\\uZZZZ"',
    'an eight-digit escape with no hexadecimal digits': 'k: "\\UZZZZZZZZ"',
    'a two-digit escape with a trailing non-digit': 'k: "\\x4G"',
    'a four-digit escape with an inner non-digit': 'k: "\\u00G1"',
    'an eight-digit escape with a trailing non-digit': 'k: "\\U0000004G"',
    'a two-digit escape carrying a sign': 'k: "\\x-1"',
    'a four-digit escape carrying a sign': 'k: "\\u+041"',
    'a two-digit escape carrying a space': 'k: "\\x 1"',
    'a two-digit escape with no digits': 'k: "\\x"',
    'a four-digit escape with no digits': 'k: "\\u"',
    'an eight-digit escape with no digits': 'k: "\\U"',
    'a two-digit escape cut by the end of input': 'k: "\\x4',
    'a four-digit escape cut by the end of input': 'k: "\\u00',
    'an eight-digit escape cut by the end of input': 'k: "\\U12',
  };

  for (const [name, input] of Object.entries(malformedHexEscapes)) {
    it(`rejects ${name}`, () => strict.throws(() => parse(input), SyntaxError));
  }

  it('decodes full-width escapes in any letter case, the null character included', () =>
    strict.deepEqual(parse('k: "\\x41\\u0041\\U00000041\\x4a\\x00\\u0000"'), {
      k: 'AAAJ\x00\x00',
    }));
});

describe('Escape sequences form a closed set', () => {
  const unknownEscapes = {
    'letter outside the set': 'k: "a\\qb"',
    'lowercase c': 'k: "\\c"',
    'single quote': `k: "\\'"`,
    'percent sign': 'k: "\\%"',
    'letter in a top-level scalar': read('quoted-scalars--unknown-escape.yaml'),
    'pair of letters in a top-level scalar': read(
      'quoted-scalars--unknown-escape-multiple.yaml'
    ),
  };

  for (const [name, input] of Object.entries(unknownEscapes)) {
    it(`rejects an escaped ${name}`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }

  it('decodes every escape the specification defines', () =>
    strict.deepEqual(
      parse('k: "\\0\\a\\b\\t\\\t\\n\\v\\f\\r\\e\\ \\"\\/\\\\\\N\\_\\L\\P"'),
      { k: '\x00\x07\b\t\t\n\v\f\r\x1b "/\\\u0085\u00a0\u2028\u2029' }
    ));
});

describe('A code point escape stays within Unicode', () => {
  const outOfRange = {
    'just past the highest code point': 'k: "\\U00110000"',
    'well past the highest code point': 'k: "a\\U0011FFFF"',
    'at the largest eight-digit value': 'k: "\\UFFFFFFFF"',
  };

  for (const [name, input] of Object.entries(outOfRange)) {
    it(`rejects an escape ${name} as a syntax error`, () =>
      strict.throws(() => parse(input), SyntaxError));
  }

  it('decodes the highest code point', () =>
    strict.deepEqual(parse('k: "\\U0010FFFF"'), { k: '\u{10FFFF}' }));
});

describe('Escapes never produce half of a surrogate pair', () => {
  const loneSurrogates = {
    'a lone high half': 'k: "\\uD800"',
    'a lone low half': 'k: "\\uDC00"',
    'a low half followed by a high half': 'k: "\\uDC00\\uD800"',
    'a high half followed by plain text': 'k: "\\uD800x"',
    'a high half followed by a non-surrogate escape': 'k: "\\uD800\\u0041"',
    'an eight-digit escape naming a high half': 'k: "\\U0000D800"',
    'an eight-digit escape naming a low half': 'k: "\\U0000DC00"',
  };

  for (const [name, input] of Object.entries(loneSurrogates)) {
    it(`rejects ${name}`, () => strict.throws(() => parse(input), SyntaxError));
  }

  it('decodes a high half followed by a low half as one character', () =>
    strict.deepEqual(parse('k: "\\uD83D\\uDE00"'), { k: '\u{1F600}' }));

  it('decodes an astral character from an eight-digit escape', () =>
    strict.deepEqual(parse('k: "\\U0001F600"'), { k: '\u{1F600}' }));
});
