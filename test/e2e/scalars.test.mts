/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { parse, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse: parseYaml } = require('../../src/index.ts');

describe('Null values', () => {
  it('empty string', () => parse(read('scalars--null-empty.yaml'), null));

  it('tilde', () => parse(read('scalars--null-tilde.yaml'), null));

  it('null', () => parse(read('scalars--null-lowercase.yaml'), null));

  it('Null', () => parse(read('scalars--null-capitalized.yaml'), null));

  it('NULL', () => parse(read('scalars--null-uppercase.yaml'), null));
});

describe('Booleans', () => {
  it('true', () => parse(read('scalars--bool-true.yaml'), true));

  it('True', () => parse(read('scalars--bool-true-cap.yaml'), true));

  it('TRUE', () => parse(read('scalars--bool-true-upper.yaml'), true));

  it('false', () => parse(read('scalars--bool-false.yaml'), false));

  it('False', () => parse(read('scalars--bool-false-cap.yaml'), false));

  it('FALSE', () => parse(read('scalars--bool-false-upper.yaml'), false));
});

describe('Integers', () => {
  it('zero', () => parse(read('scalars--int-zero.yaml'), 0));

  it('positive', () => parse(read('scalars--int-positive.yaml'), 42));

  it('negative', () => parse(read('scalars--int-negative.yaml'), -17));

  it('signed positive', () =>
    parse(read('scalars--int-signed-positive.yaml'), 99));

  it('octal', () => parse(read('scalars--int-octal.yaml'), 12));

  it('hex lower', () => parse(read('scalars--int-hex-lower.yaml'), 12));

  it('hex upper', () => parse(read('scalars--int-hex-upper.yaml'), 255));

  it('hex long', () => parse(read('scalars--int-hex-long.yaml'), 685230));

  it('hex uppercase only', () =>
    parse(read('scalars--int-hex-uppercase-only.yaml'), 0xabcdef));

  it('invalid octal returns string', () =>
    parse(read('scalars--int-invalid-octal.yaml'), '0o89'));

  it('bare 0o returns string', () =>
    parse(read('scalars--int-bare-0o.yaml'), '0o'));

  it('invalid hex returns string', () =>
    parse(read('scalars--int-invalid-hex.yaml'), '0xZZ'));

  it('bare 0x returns string', () =>
    parse(read('scalars--int-bare-0x.yaml'), '0x'));

  it('bare + returns string', () =>
    parse(read('scalars--int-bare-plus.yaml'), '+'));

  it('bare - in flow returns string', () =>
    parse(read('scalars--int-bare-minus-flow.yaml'), { a: '-' }));
});

describe('Plain scalar edge cases', () => {
  it('multiline ending at EOF', () =>
    parse(read('scalars--plain-multiline-eof.yaml'), 'a b'));

  it('multiline plain scalar ending at EOF after newline', () =>
    parse(read('scalars--plain-multiline-eof-newline.yaml'), 'hello world'));
});

describe('Floats', () => {
  it('simple', () => parse(read('scalars--float-simple.yaml'), 3.14));

  it('scientific', () =>
    parse(read('scalars--float-scientific.yaml'), 685230.15));

  it('negative infinity', () =>
    parse(read('scalars--float-neg-inf.yaml'), Number.NEGATIVE_INFINITY));

  it('positive infinity', () =>
    parse(read('scalars--float-pos-inf.yaml'), Number.POSITIVE_INFINITY));

  it('explicit positive infinity', () =>
    parse(
      read('scalars--float-pos-inf-explicit.yaml'),
      Number.POSITIVE_INFINITY
    ));

  it('.nan', () =>
    strict.ok(
      Number.isNaN(parseYaml(read('scalars--float-nan.yaml')) as number)
    ));

  it('.NaN', () =>
    strict.ok(
      Number.isNaN(parseYaml(read('scalars--float-nan-cap.yaml')) as number)
    ));

  it('.NAN', () =>
    strict.ok(
      Number.isNaN(parseYaml(read('scalars--float-nan-upper.yaml')) as number)
    ));

  it('negative zero', () =>
    strict.ok(Object.is(parseYaml(read('scalars--float-neg-zero.yaml')), -0)));
});

describe('Plain strings', () => {
  it('simple', () => parse(read('scalars--string-plain-simple.yaml'), 'hello'));

  it('with space', () =>
    parse(read('scalars--string-plain-with-space.yaml'), 'hello world'));
});

describe('Single-quoted strings', () => {
  it('simple', () =>
    parse(read('scalars--string-single-simple.yaml'), 'hello'));

  it('escaped quote', () =>
    parse(read('scalars--string-single-escaped.yaml'), "he's"));

  it('complex', () =>
    parse(read('scalars--string-single-complex.yaml'), " # Not a 'comment'."));
});

describe('Double-quoted strings', () => {
  it('simple', () =>
    parse(read('scalars--string-double-simple.yaml'), 'hello'));

  it('newline', () =>
    parse(read('scalars--string-double-newline.yaml'), 'hello\nworld'));

  it('tab', () => parse(read('scalars--string-double-tab.yaml'), '\t'));

  it('hex escape', () => parse(read('scalars--string-double-hex.yaml'), 'A'));

  it('unicode 4', () =>
    parse(read('scalars--string-double-unicode4.yaml'), 'A'));

  it('unicode 8', () =>
    parse(read('scalars--string-double-unicode8.yaml'), 'A'));

  it('unicode smiley', () =>
    parse(read('scalars--string-double-smiley.yaml'), 'Sosa did fine.\u263A'));

  it('control chars', () =>
    parse(read('scalars--string-double-control.yaml'), '\b1998\t1999\t2000\n'));

  it('null escape', () =>
    parse(read('scalars--string-double-null.yaml'), '\x00'));

  it('bell', () => parse(read('scalars--string-double-bell.yaml'), '\x07'));

  it('escape char', () =>
    parse(read('scalars--string-double-escape.yaml'), '\x1b'));

  it('slash', () => parse(read('scalars--string-double-slash.yaml'), '/'));

  it('backslash', () =>
    parse(read('scalars--string-double-backslash.yaml'), '\\'));
});

describe('Block scalars', () => {
  it('literal', () =>
    parse(read('scalars--block-literal.yaml'), 'hello\nworld\n'));

  it('folded', () =>
    parse(read('scalars--block-folded.yaml'), 'hello world\n'));

  it('literal strip', () =>
    parse(read('scalars--block-literal-strip.yaml'), 'text'));

  it('literal keep', () =>
    parse(read('scalars--block-literal-keep.yaml'), 'text\n'));

  it('empty', () => parse(read('scalars--block-empty.yaml'), ''));
});

describe('Multiline plain scalars', () => {
  it('folds newlines', () =>
    parse(
      read('scalars--plain-multiline-folds.yaml'),
      'this is a multiline value'
    ));
});
