import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const content = readFileSync(
  new URL('./snapshot.yaml', import.meta.url),
  'utf-8'
);

for (let i = 0; i < 5_000; i++) load(content);
