import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { strict } from 'poku';

const require = createRequire(import.meta.url);
export const {
  parse,
  parseAll,
  YamlError,
}: typeof import('../../src/index.ts') = require('../../src/index.ts');

const __dirname = dirname(fileURLToPath(import.meta.url));

const MINIMUM_TIME_LIMIT_IN_MILLISECONDS = 500;
// The parser runs several times slower while coverage is collected, and slower still on a shared CI runner.
const TIME_LIMIT_IN_REFERENCE_PARSES = 5;
const ISOLATED_PARSER_SCRIPT = new URL('./isolated-parse.mts', import.meta.url);

export const read = (name: string): string =>
  readFileSync(join(__dirname, '..', '__snapshots__', name), 'utf8');

export const assertParsesTo = (input: string, expected: unknown): void => {
  const actual = parse(input);

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
    worker.once('message', (referenceMillisecondsPerCharacter: number) => {
      worker.once('message', settle);
      deadline = setTimeout(
        () => settle('timed out'),
        Math.max(
          MINIMUM_TIME_LIMIT_IN_MILLISECONDS,
          TIME_LIMIT_IN_REFERENCE_PARSES *
            referenceMillisecondsPerCharacter *
            input.length
        )
      );
      worker.postMessage(input);
    });
  });
