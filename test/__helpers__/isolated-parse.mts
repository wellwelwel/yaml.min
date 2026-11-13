import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

const describeOutcome = (input: string): string => {
  try {
    parse(input);

    return 'returned';
  } catch (error) {
    if (error instanceof SyntaxError) return 'rejected';

    return `threw ${error instanceof Error ? error.name : typeof error}`;
  }
};

parentPort?.on('message', (input: string) => {
  parentPort?.postMessage(describeOutcome(input));
});

parentPort?.postMessage('ready');
