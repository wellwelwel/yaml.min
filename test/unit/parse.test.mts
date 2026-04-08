import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { parse as parsesYaml } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse } = require('../../src/index.ts');

describe('Plain scalars', () => {
  it('parses inline scalar', () => {
    parsesYaml('hello world', 'hello world');
  });
});

describe('TypeError on non-string', () => {
  it('number', () =>
    strict.throws(() => (parse as (x: unknown) => unknown)(42), TypeError));

  it('null', () =>
    strict.throws(() => (parse as (x: unknown) => unknown)(null), TypeError));
});
