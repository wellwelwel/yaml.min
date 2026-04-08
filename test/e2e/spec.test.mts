/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { parse, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse: parseYaml } = require('../../src/index.ts') as {
  parse: <T = unknown>(input: string) => T;
};

describe('YAML 1.2 spec examples', () => {
  it('2.1 - Sequence of Scalars', () =>
    parse(read('spec--2.1-sequence-of-scalars.yaml'), [
      'Mark McGwire',
      'Sammy Sosa',
      'Ken Griffey',
    ]));

  it('2.2 - Mapping Scalars to Scalars', () =>
    parse(read('spec--2.2-mapping-scalars.yaml'), {
      hr: 65,
      avg: 0.278,
      rbi: 147,
    }));

  it('2.4 - Sequence of Mappings', () =>
    parse(read('spec--2.4-sequence-of-mappings.yaml'), [
      { name: 'Mark McGwire', hr: 65 },
      { name: 'Sammy Sosa', hr: 63 },
    ]));

  it('2.5 - Sequence of Sequences', () =>
    parse(read('spec--2.5-sequence-of-sequences.yaml'), [
      ['name', 'hr', 'avg'],
      ['Mark McGwire', 65, 0.278],
    ]));

  it('2.6 - Mapping of Mappings', () =>
    parse(read('spec--2.6-mapping-of-mappings.yaml'), {
      'Mark McGwire': { hr: 65, avg: 0.278 },
      'Sammy Sosa': { hr: 63, avg: 0.288 },
    }));

  it('2.19 - Integers', () =>
    parse(read('spec--2.19-integers.yaml'), {
      canonical: 12345,
      octal: 12,
      hexadecimal: 12,
    }));

  it('2.20 - Floating Point', () => {
    const floats = parseYaml<Record<string, unknown>>(
      read('spec--2.20-floating-point.yaml')
    );
    strict.equal(floats.canonical, 1230.15);
    strict.equal(floats.fixed, 1230.15);
    strict.equal(floats['negative infinity'], Number.NEGATIVE_INFINITY);
    strict.ok(Number.isNaN(floats['not a number'] as number));
  });

  it('2.21 - Miscellaneous', () =>
    parse(read('spec--2.21-miscellaneous.yaml'), {
      booleans: [true, false],
      string: '012345',
    }));

  it('Compact nested mapping', () =>
    parse(read('spec--compact-nested-mapping.yaml'), [
      { item: 'Super Hoop', quantity: 1 },
      { item: 'Basketball', quantity: 4 },
    ]));
});
