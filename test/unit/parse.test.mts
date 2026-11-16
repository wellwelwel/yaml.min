/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { execPath } from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it, strict } from 'poku';
import { parse, read } from '../__helpers__/index.mts';

const TYPESCRIPT_COMPILER = join(
  dirname(createRequire(import.meta.url).resolve('typescript/package.json')),
  'bin',
  'tsc'
);
const RESULT_TYPE_PROJECT = fileURLToPath(
  new URL('../__fixtures__/tsconfig.json', import.meta.url)
);

const execute = promisify(execFile);

const typeCheck = (project: string) =>
  execute(execPath, [TYPESCRIPT_COMPILER, '--project', project]);

describe('parse only reads a string', () => {
  const nonStrings = {
    'a number': 42,
    null: null,
  };

  for (const [name, input] of Object.entries(nonStrings)) {
    it(`rejects ${name} as a type error`, () =>
      // @ts-expect-error
      strict.throws(() => parse(input), TypeError));
  }
});

describe('Input validation', () => {
  it('rejects null bytes', () =>
    strict.throws(
      () => parse(read('parse--input-null-byte.yaml')),
      SyntaxError
    ));
});

await describe('Result type', async () => {
  await it('stays unknown until the caller names the shape of parsed data', async () => {
    const { stdout } = await typeCheck(RESULT_TYPE_PROJECT);

    strict.equal(stdout, '');
  });
});
