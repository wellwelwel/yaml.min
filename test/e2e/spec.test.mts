/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it } from 'poku';
import { assertParsesTo, read } from '../__helpers__/index.mts';

describe('YAML 1.2 spec examples', () => {
  it('2.1 - Sequence of Scalars', () =>
    assertParsesTo(read('spec--2.1-sequence-of-scalars.yaml'), [
      'Mark McGwire',
      'Sammy Sosa',
      'Ken Griffey',
    ]));

  it('2.2 - Mapping Scalars to Scalars', () =>
    assertParsesTo(read('spec--2.2-mapping-scalars.yaml'), {
      hr: 65,
      avg: 0.278,
      rbi: 147,
    }));

  it('2.4 - Sequence of Mappings', () =>
    assertParsesTo(read('spec--2.4-sequence-of-mappings.yaml'), [
      { name: 'Mark McGwire', hr: 65 },
      { name: 'Sammy Sosa', hr: 63 },
    ]));

  it('2.5 - Sequence of Sequences', () =>
    assertParsesTo(read('spec--2.5-sequence-of-sequences.yaml'), [
      ['name', 'hr', 'avg'],
      ['Mark McGwire', 65, 0.278],
    ]));

  it('2.6 - Mapping of Mappings', () =>
    assertParsesTo(read('spec--2.6-mapping-of-mappings.yaml'), {
      'Mark McGwire': { hr: 65, avg: 0.278 },
      'Sammy Sosa': { hr: 63, avg: 0.288 },
    }));

  it('2.19 - Integers', () =>
    assertParsesTo(read('spec--2.19-integers.yaml'), {
      canonical: 12345,
      octal: 12,
      hexadecimal: 12,
    }));

  it('2.20 - Floating Point', () =>
    assertParsesTo(read('spec--2.20-floating-point.yaml'), {
      canonical: 1230.15,
      fixed: 1230.15,
      'negative infinity': Number.NEGATIVE_INFINITY,
      'not a number': Number.NaN,
    }));

  it('2.21 - Miscellaneous', () =>
    assertParsesTo(read('spec--2.21-miscellaneous.yaml'), {
      booleans: [true, false],
      string: '012345',
    }));

  it('Compact nested mapping', () =>
    assertParsesTo(read('spec--compact-nested-mapping.yaml'), [
      { item: 'Super Hoop', quantity: 1 },
      { item: 'Basketball', quantity: 4 },
    ]));
});
