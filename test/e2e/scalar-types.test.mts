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

  it('bare - in flow returns string', () =>
    assertParsesTo(read('scalar-types--int-bare-minus-flow.yaml'), { a: '-' }));
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

describe('Floats', () => {
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
