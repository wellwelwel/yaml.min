import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { strict } from 'poku';

const require = createRequire(import.meta.url);
const { parse: parseYaml } = require('../../src/index.ts');

const __dirname = dirname(fileURLToPath(import.meta.url));

const PARSE_TIME_LIMIT_IN_MILLISECONDS = 500;
const ISOLATED_PARSER_SCRIPT = new URL('./isolated-parse.mts', import.meta.url);

export const read = (name: string): string =>
  readFileSync(join(__dirname, '..', '__snapshots__', name), 'utf8');

export const assertParsesTo = (input: string, expected: unknown): void => {
  const actual = parseYaml(input);

  strict.deepEqual(actual, expected);
};

export const parseWithinTimeLimit = (input: string): Promise<string> =>
  new Promise((resolve) => {
    const worker = new Worker(ISOLATED_PARSER_SCRIPT, {
      resourceLimits: { maxOldGenerationSizeMb: 64 },
    });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const settle = (outcome: string): void => {
      clearTimeout(deadline);
      worker.terminate();
      resolve(outcome);
    };

    worker.once('error', (error) => settle(`crashed: ${error.message}`));
    worker.once('message', () => {
      worker.once('message', settle);
      deadline = setTimeout(
        () => settle('timed out'),
        PARSE_TIME_LIMIT_IN_MILLISECONDS
      );
      worker.postMessage(input);
    });
  });
