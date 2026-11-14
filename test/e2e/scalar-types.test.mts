/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it, strict } from 'poku';
import { assertParsesTo, parse, read } from '../__helpers__/index.mts';

describe('Null has four spellings', () => {
  const nullSpellings = {
    '~': 'scalar-types--null-tilde.yaml',
    null: 'scalar-types--null-lowercase.yaml',
    Null: 'scalar-types--null-capitalized.yaml',
    NULL: 'scalar-types--null-uppercase.yaml',
  };

  for (const [spelling, file] of Object.entries(nullSpellings)) {
    it(`reads ${spelling} as null`, () => assertParsesTo(read(file), null));
  }
});

describe('A boolean is true or false in three letter cases', () => {
  const booleanSpellings = {
    true: { file: 'scalar-types--bool-true.yaml', expected: true },
    True: { file: 'scalar-types--bool-true-cap.yaml', expected: true },
    TRUE: { file: 'scalar-types--bool-true-upper.yaml', expected: true },
    false: { file: 'scalar-types--bool-false.yaml', expected: false },
    False: { file: 'scalar-types--bool-false-cap.yaml', expected: false },
    FALSE: { file: 'scalar-types--bool-false-upper.yaml', expected: false },
  };

  for (const [spelling, { file, expected }] of Object.entries(
    booleanSpellings
  )) {
    it(`reads ${spelling} as ${expected}`, () =>
      assertParsesTo(read(file), expected));
  }
});

describe('An integer is decimal, or hexadecimal or octal behind its prefix', () => {
  const integers = {
    zero: { file: 'scalar-types--int-zero.yaml', expected: 0 },
    'a positive decimal integer': {
      file: 'scalar-types--int-positive.yaml',
      expected: 42,
    },
    'a negative decimal integer': {
      file: 'scalar-types--int-negative.yaml',
      expected: -17,
    },
    'a decimal integer signed with "+"': {
      file: 'scalar-types--int-signed-positive.yaml',
      expected: 99,
    },
    'a hexadecimal integer with uppercase digits': {
      file: 'scalar-types--int-hex-uppercase-only.yaml',
      expected: 0xabcdef,
    },
    'a hexadecimal integer with a leading zero digit': {
      file: 'scalar-types--int-hex-long.yaml',
      expected: 685230,
    },
  };
  const textNumerals = {
    '0o89': 'scalar-types--int-invalid-octal.yaml',
    '0o': 'scalar-types--int-bare-0o.yaml',
    '0xZZ': 'scalar-types--int-invalid-hex.yaml',
    '0x': 'scalar-types--int-bare-0x.yaml',
    '+': 'scalar-types--int-bare-plus.yaml',
  };

  for (const [name, { file, expected }] of Object.entries(integers)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }

  for (const [text, file] of Object.entries(textNumerals)) {
    it(`keeps ${text}, which has no valid digits, as text`, () =>
      assertParsesTo(read(file), text));
  }
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
  const exactNumerals: Record<string, [string, number]> = {
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
  const integers: Record<string, [string, bigint]> = {
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
  const otherNumerals: Record<string, [string, number | string]> = {
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
      // @ts-expect-error
      strict.equal(parse('42', { bigint }), 42));
  }
});

describe('A float reads as a number, with .inf and .nan as special numbers', () => {
  const floats = {
    'a decimal float': {
      file: 'scalar-types--float-simple.yaml',
      expected: 3.14,
    },
    'a float with an exponent': {
      file: 'scalar-types--float-scientific.yaml',
      expected: 685230.15,
    },
    'negative zero': {
      file: 'scalar-types--float-neg-zero.yaml',
      expected: -0,
    },
  };
  const specialSpellings = {
    '.inf': Number.POSITIVE_INFINITY,
    '.Inf': Number.POSITIVE_INFINITY,
    '.INF': Number.POSITIVE_INFINITY,
    '+.inf': Number.POSITIVE_INFINITY,
    '-.inf': Number.NEGATIVE_INFINITY,
    '-.Inf': Number.NEGATIVE_INFINITY,
    '-.INF': Number.NEGATIVE_INFINITY,
    '.nan': Number.NaN,
    '.NaN': Number.NaN,
    '.NAN': Number.NaN,
  };

  for (const [name, { file, expected }] of Object.entries(floats)) {
    it(`reads ${name}`, () => assertParsesTo(read(file), expected));
  }

  for (const [input, expected] of Object.entries(specialSpellings)) {
    it(`returns ${input} as its special number`, () =>
      strict.equal(parse(input), expected));
  }
});

describe('Text that matches no other type reads as a string', () => {
  const strings = {
    'a word': {
      file: 'scalar-types--string-plain-simple.yaml',
      expected: 'hello',
    },
    'words separated by a space': {
      file: 'scalar-types--string-plain-with-space.yaml',
      expected: 'hello world',
    },
  };

  for (const [name, { file, expected }] of Object.entries(strings)) {
    it(`reads ${name} as a string`, () => assertParsesTo(read(file), expected));
  }
});
