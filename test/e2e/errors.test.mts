import type { YamlErrorCode } from '../../src/index.ts';
import { readFileSync } from 'node:fs';
import { describe, it, strict } from 'poku';
import { parse, YamlError } from '../__helpers__/index.mts';

type CodeCase = { source: string; line: number; column: number };

type HiddenCase = { escapeSequence: string; label: string };

const README = new URL('../../README.md', import.meta.url);
const MESSAGE_LIMIT = 300;
const HIDDEN_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const PAYLOAD = `${'\u202E'.repeat(5000)}${'x'.repeat(15_000)}`;
const HANDLE = `!${'h'.repeat(20_000)}!`;
const CORE_HANDLE_DIRECTIVE = `%TAG ${HANDLE} tag:yaml.org,2002:\n---\n`;
const SECRET = 'hunter2';

const messageOf = (input: string): string => {
  try {
    parse(input);
  } catch (error) {
    if (error instanceof SyntaxError) return error.message;
  }

  return strict.fail('Expected a SyntaxError');
};

const duplicated = (key: string): string => `${key}: 1\n${key}: 2\n`;

describe('Errors carry a stable code and the line and column of the problem', () => {
  const codeCases: Record<Exclude<YamlErrorCode, 'ENGINE_LIMIT'>, CodeCase> = {
    ALIAS_EXPANSION_TOO_LARGE: {
      source: `a: &x ${'x'.repeat(100_000)}\nb: [${'*x, '.repeat(10)}*x]`,
      line: 2,
      column: 45,
    },
    COLLECTION_KEY: { source: '{[a]: 1}', line: 1, column: 2 },
    DUPLICATE_ANCHOR: { source: '&a &b x', line: 1, column: 4 },
    DUPLICATE_KEY: { source: 'a: 1\na: 2', line: 2, column: 1 },
    DUPLICATE_TAG: { source: '!!str !!str x', line: 1, column: 7 },
    DUPLICATE_TAG_HANDLE: {
      source: '%TAG !e! tag:a,2000:\n%TAG !e! tag:a,2000:\n--- x',
      line: 2,
      column: 1,
    },
    EXPECTED_MAPPING_ENTRY: { source: 'a: 1\nb\n', line: 2, column: 1 },
    INVALID_ALIAS: { source: 'a: *', line: 1, column: 4 },
    INVALID_ANCHOR: { source: '- &a - b', line: 1, column: 6 },
    INVALID_BLOCK_SCALAR_HEADER: { source: 'a: |x\n  t', line: 1, column: 5 },
    INVALID_DIRECTIVE: { source: '%TAG !e!\n--- x', line: 1, column: 1 },
    INVALID_ESCAPE: { source: '"\\q"', line: 1, column: 2 },
    INVALID_INDENTATION: { source: 'a: "x"\n  b: 1', line: 2, column: 3 },
    INVALID_TAG: { source: '!<a x', line: 1, column: 1 },
    MERGE_KEY: { source: 'a:\n  <<: 1', line: 2, column: 3 },
    MULTIPLE_DOCUMENTS: { source: 'a\n---\nb', line: 2, column: 1 },
    NESTING_TOO_DEEP: { source: '['.repeat(257), line: 1, column: 257 },
    NON_PRINTABLE_CHARACTER: { source: 'a\u0001', line: 1, column: 2 },
    TAG_MISMATCH: { source: '!!int x', line: 1, column: 1 },
    UNDECLARED_TAG_HANDLE: { source: '!e!x y', line: 1, column: 1 },
    UNEXPECTED_CHARACTER: { source: '[a}', line: 1, column: 3 },
    UNEXPECTED_CONTENT: { source: '"a" b', line: 1, column: 5 },
    UNEXPECTED_DOCUMENT_MARKER: { source: '"a\n---\n"', line: 2, column: 1 },
    UNKNOWN_ANCHOR: { source: 'a: *x', line: 1, column: 4 },
    UNKNOWN_TAG: { source: '!!binary x', line: 1, column: 1 },
    UNSAFE_KEY: { source: '__proto__: 1', line: 1, column: 1 },
    UNTERMINATED_FLOW_COLLECTION: { source: '[a', line: 1, column: 1 },
    UNTERMINATED_STRING: { source: '"a', line: 1, column: 1 },
  };

  for (const [code, { source, line, column }] of Object.entries(codeCases)) {
    it(`reports ${code} with its line and column`, () =>
      strict.throws(() => parse(source), {
        name: 'YamlError',
        code,
        line,
        column,
      }));
  }

  it('reports errors that existing SyntaxError handlers still catch', () => {
    let caught: unknown;

    try {
      parse('"a');
    } catch (error) {
      caught = error;
    }

    strict.ok(caught instanceof YamlError);
    strict.ok(caught instanceof SyntaxError);
  });

  it('documents exactly the codes the parser reports', () => {
    const documented = [
      ...readFileSync(README, 'utf8').matchAll(/^\| `([A-Z_]+)` +\|/gm),
    ].map((match) => match[1]);

    strict.deepEqual(
      documented.sort(),
      [...Object.keys(codeCases), 'ENGINE_LIMIT'].sort()
    );
  });
});

describe('Error messages are short and safe to display', () => {
  const hostileSources = {
    'a raw key set twice': duplicated(`"${PAYLOAD}"`),
    'a flow mapping key set twice': `{${PAYLOAD}: 1, ${PAYLOAD}: 2}`,
    'an escaped key set twice': duplicated(
      `"\\e[31m\\x9B\\0\\u202E${'x'.repeat(100)}"`
    ),
    'an alias with no anchor': `a: *${PAYLOAD}\n`,
    'a second anchor': `&${PAYLOAD} &b x\n`,
    'an anchor on a compact sequence': `- &${PAYLOAD} - x\n`,
    'an alias inside its own anchor': `a: &${PAYLOAD} [*${PAYLOAD}]\n`,
    'aliases past the repetition budget': `a: &${PAYLOAD} ${'x'.repeat(1_000_000)}\nb: [${Array.from({ length: 14 }, () => `*${PAYLOAD}`).join(', ')}]\n`,
    'aliases past the nesting limit': `a: &${PAYLOAD} ${'['.repeat(200)}x${']'.repeat(200)}\nb: ${'['.repeat(100)}*${PAYLOAD}${']'.repeat(100)}\n`,
    'a malformed tag': `!${PAYLOAD} x\n`,
    'an unknown tag': `!${'x'.repeat(20_000)} x\n`,
    'an undeclared tag handle': `${HANDLE}x y\n`,
    'a tag handle declared twice': `%TAG ${HANDLE} tag:example.com,2000:\n%TAG ${HANDLE} tag:example.com,2000:\n--- x\n`,
    'a tag that runs into its node': `!<${'x'.repeat(20_000)}>x\n`,
    'a second tag': `${CORE_HANDLE_DIRECTIVE}${HANDLE}str !!str x\n`,
    'a tag on an alias': `${CORE_HANDLE_DIRECTIVE}a: &x 1\nb: ${HANDLE}str *x\n`,
    'a tag on a compact sequence': `${CORE_HANDLE_DIRECTIVE}- ${HANDLE}seq - x\n`,
    'a tag that does not fit its value': `${CORE_HANDLE_DIRECTIVE}${HANDLE}int five\n`,
    'a hidden character in a flow sequence': '["a" \u202E]',
    'an escape of a hidden character': '"\\\u202E"',
    'a non-printable character': 'a: \u0001\n',
  };
  const hiddenCases: Record<string, HiddenCase> = {
    NUL: { escapeSequence: '\\0', label: 'U+0000' },
    bell: { escapeSequence: '\\a', label: 'U+0007' },
    escape: { escapeSequence: '\\e', label: 'U+001B' },
    delete: { escapeSequence: '\\x7F', label: 'U+007F' },
    'control sequence introducer': { escapeSequence: '\\x9B', label: 'U+009B' },
    'next line': { escapeSequence: '\\N', label: 'U+0085' },
    'no-break space': { escapeSequence: '\\_', label: 'U+00A0' },
    'line separator': { escapeSequence: '\\L', label: 'U+2028' },
    'paragraph separator': { escapeSequence: '\\P', label: 'U+2029' },
    'zero width space': { escapeSequence: '\\u200B', label: 'U+200B' },
    'right-to-left override': { escapeSequence: '\\u202E', label: 'U+202E' },
    'byte order mark': { escapeSequence: '\\uFEFF', label: 'U+FEFF' },
    'tag letter': { escapeSequence: '\\U000E0041', label: 'U+E0041' },
  };
  const quotedEchoes = {
    'quote marks': { key: `'x" and "y'`, echo: '"x\\" and \\"y"' },
    'a trailing backslash': { key: "'x\\'", echo: '"x\\\\"' },
    'visible characters beyond ASCII': {
      key: '"café ☕ 🎉"',
      echo: '"café ☕ 🎉"',
    },
  };
  const secretSources = [
    `password: "${SECRET}" x\n`,
    `password: '${SECRET}' x\n`,
    `password: "${SECRET}\\q"\n`,
    `password: "${SECRET}`,
    `password: !!int ${SECRET}\n`,
    `password: ["${SECRET}" x]\n`,
  ];

  for (const [name, source] of Object.entries(hostileSources)) {
    it(`keeps the message for ${name} within ${MESSAGE_LIMIT} characters and free of hidden characters`, () => {
      const message = messageOf(source);

      strict.ok(message.length <= MESSAGE_LIMIT, message);
      strict.ok(!HIDDEN_CHARACTER.test(message), message);
    });
  }

  it('clips a 200,000-character key to 40 characters and marks the cut', () => {
    const key = 'k'.repeat(200_000);
    const message = messageOf(`? ${key}\n? ${key}\n`);

    strict.ok(message.includes(`"${'k'.repeat(40)}…"`), message);
    strict.ok(!message.includes('k'.repeat(41)), message);
  });

  for (const [name, { escapeSequence, label }] of Object.entries(hiddenCases)) {
    it(`shows the ${name} in a key as ${label}`, () => {
      const message = messageOf(duplicated(`"x${escapeSequence}y"`));

      strict.ok(message.includes(`"x[${label}]y"`), message);
    });
  }

  for (const [name, { key, echo }] of Object.entries(quotedEchoes)) {
    it(`keeps ${name} inside the quotes of the key it echoes`, () => {
      const message = messageOf(duplicated(key));

      strict.ok(message.includes(echo), message);
    });
  }

  it('keeps scalar values out of every message', () => {
    const messages = secretSources.map(messageOf);

    for (const message of messages)
      strict.ok(!message.includes(SECRET), message);
  });
});
