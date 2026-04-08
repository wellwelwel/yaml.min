import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict } from 'poku';

const require = createRequire(import.meta.url);
const { parse: parseYaml } = require('../../src/index.ts');

const __dirname = dirname(fileURLToPath(import.meta.url));

export const read = (name: string): string =>
  readFileSync(join(__dirname, '..', '__snapshots__', name), 'utf8');

export const parse = (yamlStr: string, expected: unknown): void => {
  const actual = parseYaml(yamlStr);

  strict.deepEqual(actual, expected);
};
