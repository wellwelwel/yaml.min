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

describe('Null values', () => {
  it('empty string', () =>
    assertParsesTo(read('scalar-types--null-empty.yaml'), null));

  it('tilde', () =>
    assertParsesTo(read('scalar-types--null-tilde.yaml'), null));

  it('null', () =>
    assertParsesTo(read('scalar-types--null-lowercase.yaml'), null));

  it('Null', () =>
    assertParsesTo(read('scalar-types--null-capitalized.yaml'), null));

  it('NULL', () =>
    assertParsesTo(read('scalar-types--null-uppercase.yaml'), null));
});

describe('Booleans', () => {
  it('true', () => assertParsesTo(read('scalar-types--bool-true.yaml'), true));

  it('True', () =>
    assertParsesTo(read('scalar-types--bool-true-cap.yaml'), true));

  it('TRUE', () =>
    assertParsesTo(read('scalar-types--bool-true-upper.yaml'), true));

  it('false', () =>
    assertParsesTo(read('scalar-types--bool-false.yaml'), false));

  it('False', () =>
    assertParsesTo(read('scalar-types--bool-false-cap.yaml'), false));

  it('FALSE', () =>
    assertParsesTo(read('scalar-types--bool-false-upper.yaml'), false));
});

describe('Integers', () => {
  it('zero', () => assertParsesTo(read('scalar-types--int-zero.yaml'), 0));

  it('positive', () =>
    assertParsesTo(read('scalar-types--int-positive.yaml'), 42));

  it('negative', () =>
    assertParsesTo(read('scalar-types--int-negative.yaml'), -17));

  it('signed positive', () =>
    assertParsesTo(read('scalar-types--int-signed-positive.yaml'), 99));

  it('octal', () => assertParsesTo(read('scalar-types--int-octal.yaml'), 12));

  it('hex lower', () =>
    assertParsesTo(read('scalar-types--int-hex-lower.yaml'), 12));

  it('hex upper', () =>
    assertParsesTo(read('scalar-types--int-hex-upper.yaml'), 255));

  it('hex long', () =>
    assertParsesTo(read('scalar-types--int-hex-long.yaml'), 685230));

  it('hex uppercase only', () =>
    assertParsesTo(
      read('scalar-types--int-hex-uppercase-only.yaml'),
      0xabcdef
    ));

  it('invalid octal returns string', () =>
    assertParsesTo(read('scalar-types--int-invalid-octal.yaml'), '0o89'));

  it('bare 0o returns string', () =>
    assertParsesTo(read('scalar-types--int-bare-0o.yaml'), '0o'));

  it('invalid hex returns string', () =>
    assertParsesTo(read('scalar-types--int-invalid-hex.yaml'), '0xZZ'));

  it('bare 0x returns string', () =>
    assertParsesTo(read('scalar-types--int-bare-0x.yaml'), '0x'));

  it('bare + returns string', () =>
    assertParsesTo(read('scalar-types--int-bare-plus.yaml'), '+'));

  it('rejects a bare - as a flow mapping value', () =>
    strict.throws(
      () => parse(read('scalar-types--int-bare-minus-flow.yaml')),
      SyntaxError
    ));
});

describe('Signed hexadecimal and octal numerals', () => {
  const signedPrefixedNumerals = {
    'negative hexadecimal': '-0x10',
    'positive hexadecimal': '+0x10',
    'negative octal': '-0o17',
    'positive octal': '+0o17',
  };

  for (const [name, input] of Object.entries(signedPrefixedNumerals)) {
    it(`keeps a ${name} numeral as text`, () =>
      strict.equal(parse(input), input));
  }

  it('keeps signed prefixed numerals as text inside collections', () =>
    strict.deepEqual(parse('offset: -0x10\nmask: [-0o17, +0x10]\n'), {
      offset: '-0x10',
      mask: ['-0o17', '+0x10'],
    }));
});

describe('Numerals too large for a number', () => {
  const overflowingNumerals = {
    'positive float': '1e999',
    'negative float': '-1e999',
    'decimal integer': '1'.padEnd(400, '0'),
    'hexadecimal integer': `0x${'f'.repeat(300)}`,
    'octal integer': `0o${'7'.repeat(400)}`,
  };

  for (const [name, input] of Object.entries(overflowingNumerals)) {
    it(`keeps an overflowing ${name} as text`, () =>
      strict.equal(parse(input), input));
  }

  it('keeps overflowing numerals as text inside collections', () =>
    strict.deepEqual(parse('limit: 1e999\nbounds: [-1e999]\n'), {
      limit: '1e999',
      bounds: ['-1e999'],
    }));
});

describe('Numerals keep the exact value the document wrote', () => {
  const exactNumerals = {
    'the largest safe decimal integer': ['9007199254740991', 9007199254740991],
    'the smallest safe decimal integer': [
      '-9007199254740991',
      -9007199254740991,
    ],
    'the largest safe hexadecimal integer': [
      '0x1FFFFFFFFFFFFF',
      9007199254740991,
    ],
    'the largest safe octal integer': [
      '0o377777777777777777',
      9007199254740991,
    ],
    'a decimal integer with a leading zero': ['01234', 1234],
    'the largest finite exponent': ['1e308', 1e308],
  };
  const inexactNumerals = {
    'one past the largest safe decimal integer': '9007199254740992',
    'one past the smallest safe decimal integer': '-9007199254740992',
    'a twenty-digit identifier': '12345678901234567890',
    'one past the largest safe hexadecimal integer': '0x20000000000000',
    'one past the largest safe octal integer': '0o400000000000000000',
    'the first exponent past the largest finite number': '1e309',
  };

  for (const [name, [input, expected]] of Object.entries(exactNumerals)) {
    it(`returns ${name} as a number`, () =>
      strict.equal(parse(input), expected));
  }

  for (const [name, input] of Object.entries(inexactNumerals)) {
    it(`keeps ${name} as text`, () => strict.equal(parse(input), input));
  }

  it('keeps unsafe integers as text inside collections', () =>
    strict.deepEqual(
      parse('id: 12345678901234567890\nids: [9007199254740992, 7]\n'),
      { id: '12345678901234567890', ids: ['9007199254740992', 7] }
    ));
});

describe('The bigint option returns integers as BigInt', () => {
  const integers = {
    'a decimal integer': ['42', 42n],
    'a negative decimal integer': ['-17', -17n],
    'a signed positive decimal integer': ['+99', 99n],
    'a decimal integer with a leading zero': ['01234', 1234n],
    'a hexadecimal integer': ['0xDEADBEEF', 3735928559n],
    'an octal integer': ['0o755', 493n],
    'a twenty-digit identifier': [
      '12345678901234567890',
      12345678901234567890n,
    ],
    'a hexadecimal integer past 64 bits': [
      '0x1ffffffffffffffff',
      36893488147419103231n,
    ],
  };
  const otherNumerals = {
    'a float': ['1.5', 1.5],
    'a float written with an exponent': ['1e3', 1000],
    'a signed hexadecimal numeral': ['-0x10', '-0x10'],
    'a float too large for a number': ['1e999', '1e999'],
  };
  const thousandDigits = '9'.repeat(1000);
  const thousandAndOneDigits = '9'.repeat(1001);

  for (const [name, [input, expected]] of Object.entries(integers)) {
    it(`returns ${name} as a BigInt`, () =>
      strict.equal(parse(input, { bigint: true }), expected));
  }

  for (const [name, [input, expected]] of Object.entries(otherNumerals)) {
    it(`returns ${name} as it would without the option`, () =>
      strict.equal(parse(input, { bigint: true }), expected));
  }

  it('returns an integer of 1,000 digits as a BigInt', () =>
    strict.equal(parse(thousandDigits, { bigint: true }), 10n ** 1000n - 1n));

  it('keeps an integer of 1,001 digits as text', () =>
    strict.equal(
      parse(thousandAndOneDigits, { bigint: true }),
      thousandAndOneDigits
    ));

  it('returns integers inside collections as BigInt', () =>
    strict.deepEqual(
      parse('id: 12345678901234567890\nports: [80, 443]\nratio: 0.5\n', {
        bigint: true,
      }),
      { id: 12345678901234567890n, ports: [80n, 443n], ratio: 0.5 }
    ));

  it('reads a tagged integer past the safe range as a BigInt', () =>
    strict.equal(
      parse('!!int 12345678901234567890', { bigint: true }),
      12345678901234567890n
    ));

  it('rejects a tagged integer of 1,001 digits', () =>
    strict.throws(
      () => parse(`!!int ${thousandAndOneDigits}`, { bigint: true }),
      {
        code: 'TAG_MISMATCH',
      }
    ));

  it('names integer keys by their text form', () =>
    strict.throws(() => parse('0x10: a\n16: b\n', { bigint: true }), {
      code: 'DUPLICATE_KEY',
    }));

  for (const bigint of ['true', 1]) {
    it(`returns numbers when bigint is ${JSON.stringify(bigint)}`, () =>
      strict.equal(parse('42', { bigint }), 42));
  }
});

describe('Floats', () => {
  const literalSpellings = {
    '.Inf': Number.POSITIVE_INFINITY,
    '.INF': Number.POSITIVE_INFINITY,
    '-.Inf': Number.NEGATIVE_INFINITY,
    '-.INF': Number.NEGATIVE_INFINITY,
  };

  for (const [input, expected] of Object.entries(literalSpellings)) {
    it(`returns ${input} as its special number`, () =>
      strict.equal(parse(input), expected));
  }

  it('simple', () =>
    assertParsesTo(read('scalar-types--float-simple.yaml'), 3.14));

  it('scientific', () =>
    assertParsesTo(read('scalar-types--float-scientific.yaml'), 685230.15));

  it('negative infinity', () =>
    assertParsesTo(
      read('scalar-types--float-neg-inf.yaml'),
      Number.NEGATIVE_INFINITY
    ));

  it('positive infinity', () =>
    assertParsesTo(
      read('scalar-types--float-pos-inf.yaml'),
      Number.POSITIVE_INFINITY
    ));

  it('explicit positive infinity', () =>
    assertParsesTo(
      read('scalar-types--float-pos-inf-explicit.yaml'),
      Number.POSITIVE_INFINITY
    ));

  it('.nan', () =>
    assertParsesTo(read('scalar-types--float-nan.yaml'), Number.NaN));

  it('.NaN', () =>
    assertParsesTo(read('scalar-types--float-nan-cap.yaml'), Number.NaN));

  it('.NAN', () =>
    assertParsesTo(read('scalar-types--float-nan-upper.yaml'), Number.NaN));

  it('negative zero', () =>
    assertParsesTo(read('scalar-types--float-neg-zero.yaml'), -0));
});

describe('Plain strings', () => {
  it('simple', () =>
    assertParsesTo(read('scalar-types--string-plain-simple.yaml'), 'hello'));

  it('with space', () =>
    assertParsesTo(
      read('scalar-types--string-plain-with-space.yaml'),
      'hello world'
    ));
});
