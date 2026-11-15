import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const {
  parse,
}: typeof import('../../src/index.ts') = require('../../src/index.ts');

const REFERENCE_DOCUMENT = '- item\n'.repeat(30_000);

const referenceMillisecondsPerCharacter = (): number => {
  const start = performance.now();

  parse(REFERENCE_DOCUMENT);

  return (performance.now() - start) / REFERENCE_DOCUMENT.length;
};

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

parentPort?.postMessage(referenceMillisecondsPerCharacter());
