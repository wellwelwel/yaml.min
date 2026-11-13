/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, strict } from 'poku';
import ts from 'typescript';
import { assertParsesTo, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

const TEST_TSCONFIG = fileURLToPath(
  new URL('../tsconfig.json', import.meta.url)
);
const RESULT_TYPE_FIXTURE = fileURLToPath(
  new URL('../__fixtures__/parse-result-type.mts', import.meta.url)
);

const typeErrorsIn = (file: string): string[] => {
  const { config } = ts.readConfigFile(TEST_TSCONFIG, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    dirname(TEST_TSCONFIG)
  );
  const program = ts.createProgram([file], options);

  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    );
};

describe('parse only reads a string', () => {
  const nonStrings = {
    'a number': 42,
    null: null,
  };

  for (const [name, input] of Object.entries(nonStrings)) {
    it(`rejects ${name} as a type error`, () =>
      strict.throws(() => parse(input), TypeError));
  }
});

describe('Input validation', () => {
  it('rejects null bytes', () =>
    strict.throws(
      () => parse(read('parse--input-null-byte.yaml')),
      SyntaxError
    ));

  it('rejects non-printable characters', () =>
    strict.throws(
      () => parse(read('parse--input-non-printable.yaml')),
      SyntaxError
    ));

  it('strips BOM from input', () =>
    assertParsesTo(read('parse--input-bom.yaml'), { a: 1 }));
});

describe('Result type', () => {
  it('leaves the caller to validate the shape of parsed data', () => {
    const typeErrors = typeErrorsIn(RESULT_TYPE_FIXTURE);

    strict.deepEqual(typeErrors, []);
  });
});
