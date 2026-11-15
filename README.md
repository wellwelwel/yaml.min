<h1 align="center">yaml.min</h1>
<div align="center">

[![NPM Version](https://img.shields.io/npm/v/yaml.min.svg?label=&color=70a1ff&logo=npm&logoColor=white)](https://www.npmjs.com/package/yaml.min)
[![Coverage](https://img.shields.io/codecov/c/github/wellwelwel/yaml.min?label=&logo=codecov&logoColor=white&color=98cc00)](https://app.codecov.io/gh/wellwelwel/yaml.min)<br />
[![GitHub Workflow Status (Node.js)](https://img.shields.io/github/actions/workflow/status/wellwelwel/yaml.min/ci_node.yml?event=push&label=&branch=main&logo=nodedotjs&logoColor=535c68&color=badc58)](https://github.com/wellwelwel/yaml.min/actions/workflows/ci_node.yml?query=branch%3Amain)
[![GitHub Workflow Status (Bun)](https://img.shields.io/github/actions/workflow/status/wellwelwel/yaml.min/ci_bun.yml?event=push&label=&branch=main&logo=bun&logoColor=ffffff&color=f368e0)](https://github.com/wellwelwel/yaml.min/actions/workflows/ci_bun.yml?query=branch%3Amain)
[![GitHub Workflow Status (Deno)](https://img.shields.io/github/actions/workflow/status/wellwelwel/yaml.min/ci_deno.yml?event=push&label=&branch=main&logo=deno&logoColor=ffffff&color=079992)](https://github.com/wellwelwel/yaml.min/actions/workflows/ci_deno.yml?query=branch%3Amain)

🔧 [**Faster**](#benchmark) and lightweight [**YAML**](https://yaml.org/) **v1.2** parser for **JavaScript** and **TypeScript**.

</div>

- Zero runtime dependencies
- Compatible with **Node.js** _(18+)_, **Bun**, and **Deno**

---

## Install

```bash
# Node.js
npm i yaml.min
```

```bash
# Bun
bun add yaml.min
```

```bash
# Deno
deno add npm:yaml.min
```

---

## Usage

### Import

#### ES Modules

```ts
import { parse } from 'yaml.min';
```

#### CommonJS

```js
const { parse } = require('yaml.min');
```

### Quickstart

```js
import { parse } from 'yaml.min';

const data = parse(`
  server:
    host: localhost
    port: 8080
    tags: [web, production]

  database:
    enabled: true
    ports:
      - 8001
      - 8002
      - 8003
`);

data.server.host; // "localhost"
data.server.port; // 8080
data.server.tags; // ["web", "production"]
data.database.enabled; // true
data.database.ports; // [8001, 8002, 8003]
```

### Options

`parse` and `parseAll` take an optional second argument:

```ts
parse(source, { maxDepth: 256, bigint: false, allowUnsafeKeys: false });
```

| Option            | Default | Description                                                                                                                               |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `maxDepth`        | `256`   | How deep collections can nest, counting the levels aliases repeat. An integer from `0` to `400`. See [Untrusted Input](#untrusted-input). |
| `bigint`          | `false` | Returns integers as `BigInt`. See [Integers](#integers).                                                                                  |
| `allowUnsafeKeys` | `false` | Accepts unsafe keys, such as `__proto__`. See [Untrusted Input](#untrusted-input).                                                        |

---

## Supported Types

### Strings

Plain, single-quoted, and double-quoted:

```yaml
plain: Hello, World!
single_quoted: 'no \escapes here'
double_quoted: "hello\nworld"
```

Escape sequences: `\0`, `\a`, `\b`, `\t`, `\n`, `\v`, `\f`, `\r`, `\e`, `\\`, `\"`, `\/`, `\N`, `\_`, `\L`, `\P`, `\xHH`, `\uHHHH`, `\UHHHHHHHH`.

### Block Scalars

Literal (`|`) and folded (`>`) block scalars with chomp indicators:

```yaml
literal: |
  first line
  second line
  third line

folded: >
  This long text
  will be folded
  into a single line.

strip: |-
  no trailing newline

keep: |+
  trailing newlines
  are preserved

indent: |2
    explicit indent
    level
```

### Integers

```yaml
decimal: 42
positive: +99
negative: -17
hex: 0xDEADBEEF
octal: 0o755
```

An integer beyond the range **JavaScript** holds exactly (±9,007,199,254,740,991), such as a 20-digit identifier, stays a string instead of being rounded.

With `bigint: true`, integers of up to 1,000 digits are returned as exact `BigInt` values, and longer ones stay strings. Floats stay numbers.

### Floats

```yaml
pi: 3.14159
scientific: 6.626e-34
positive_inf: .inf
negative_inf: -.inf
not_a_number: .nan
```

A number too large for **JavaScript**, such as `1e999`, stays a string instead of becoming `Infinity`.

### Booleans

```yaml
enabled: true
disabled: false
```

Also accepts `True`/`False` and `TRUE`/`FALSE`.

### Null

```yaml
tilde: ~
word: null
empty:
```

Also accepts `Null` and `NULL`.

---

## Collections

### Block Mappings

```yaml
server:
  host: localhost
  port: 8080
  tls:
    enabled: true
```

### Block Sequences

```yaml
fruits:
  - apple
  - banana
  - cherry
```

### Flow Collections

```yaml
sequence: [1, 2, 3]
mapping: { name: Tom, age: 30 }
nested: { tags: [a, b, c] }
```

### Anchors and Aliases

```yaml
defaults: &defaults
  adapter: postgres
  host: localhost

development:
  database: dev_db
  connection: *defaults

production:
  database: prod_db
  connection: *defaults
```

An alias returns the anchored value itself, not a copy, so every mapping or sequence an alias refers to is deeply frozen. To change one, change a copy, such as one made with `structuredClone`.

**YAML** 1.2 has no merge keys, so instead of reading `<<: *defaults` differently from parsers that still merge it, **yaml.min** rejects any key that reads as `<<` with `MERGE_KEY`. For a literal `<<` key, write `!!str "<<"`.

### Explicit Keys

```yaml
complex key: value
```

### Tags

A core schema tag sets a value's type, whatever its quoting:

```yaml
enabled: !!bool 'false' # false
zip: !!str 01234 # "01234"
limit: !!int '5' # 5
```

`!!str`, `!!int`, `!!float`, `!!bool`, `!!null`, `!!seq`, `!!map`, and the non-specific `!` are supported, including through `%TAG` handles and verbatim tags such as `!<tag:yaml.org,2002:str>`. Any other tag, such as `!!binary` or `!custom`, is rejected.

### Document Markers

`parse` reads a single document. Use `parseAll` for a stream of documents:

```ts
import { parseAll } from 'yaml.min';

parseAll(`---
first: document
...
---
second: document
`); // [{ first: 'document' }, { second: 'document' }]
```

---

## Error Handling

`parse` and `parseAll` throw a `YamlError`, a `SyntaxError` with a stable `code` and the 1-based `line` and `column` of the problem:

```ts
import { parse, YamlError } from 'yaml.min';

try {
  parse('key: "unterminated');
} catch (error) {
  if (error instanceof YamlError)
    console.error(
      `${error.code} on line ${error.line}, column ${error.column}: ${error.message}`
    );
}
```

- Match on `code`, not `message`, which can change in any release.
- Messages are short and safe to display: they never quote scalar values, and they show control, invisible, and bidirectional characters as code points, such as `[U+202E]`.
- A source that is not a string, or an invalid option, throws a `TypeError` instead.

### Error Codes

| Code                           | Meaning                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALIAS_EXPANSION_TOO_LARGE`    | Aliases repeat more content than the input allows. See [Untrusted Input](#untrusted-input).                                                 |
| `COLLECTION_KEY`               | A mapping key is a sequence or a mapping.                                                                                                   |
| `DUPLICATE_ANCHOR`             | A node carries more than one anchor.                                                                                                        |
| `DUPLICATE_KEY`                | A key appears more than once in a mapping, including keys that become the same property, such as `0x10` and `16`.                           |
| `DUPLICATE_TAG`                | A node carries more than one tag.                                                                                                           |
| `DUPLICATE_TAG_HANDLE`         | A `%TAG` directive declares a handle the document already declared.                                                                         |
| `ENGINE_LIMIT`                 | Parsing exhausted an engine limit, such as the call stack.                                                                                  |
| `EXPECTED_MAPPING_ENTRY`       | A line in a block mapping is not a `key: value` entry, or an implicit key spans lines or runs over 1,024 characters.                        |
| `INVALID_ALIAS`                | An alias has no anchor name after `*`, or carries an anchor.                                                                                |
| `INVALID_ANCHOR`               | An anchor labels a sequence that starts on its line.                                                                                        |
| `INVALID_BLOCK_SCALAR_HEADER`  | A block scalar header repeats an indicator or holds an unexpected character.                                                                |
| `INVALID_DIRECTIVE`            | A `%YAML` or `%TAG` directive is malformed, a document has two `%YAML` directives, or directives are not followed by `---`.                 |
| `INVALID_ESCAPE`               | An escape sequence is unknown, incomplete, or names an invalid code point.                                                                  |
| `INVALID_INDENTATION`          | A line is indented with a tab, or by an amount no open collection expects.                                                                  |
| `INVALID_TAG`                  | A tag is malformed, runs into its node, or labels an alias or a sequence that starts on its line.                                           |
| `MERGE_KEY`                    | A key reads as the merge key `<<` and is not a quoted scalar tagged `!!str`. See [Anchors and Aliases](#anchors-and-aliases).               |
| `MULTIPLE_DOCUMENTS`           | `parse` received more than one document. Use `parseAll` for a stream.                                                                       |
| `NESTING_TOO_DEEP`             | Collections nest deeper than `maxDepth`.                                                                                                    |
| `NON_PRINTABLE_CHARACTER`      | The input holds a control character, a lone surrogate, or another non-printable character.                                                  |
| `TAG_MISMATCH`                 | A tag labels a value that does not fit it, such as `!!int five`.                                                                            |
| `UNDECLARED_TAG_HANDLE`        | A tag uses a handle no `%TAG` directive declares.                                                                                           |
| `UNEXPECTED_CHARACTER`         | A plain scalar starts with an indicator, a `#` touches the content before it, or a flow collection holds an unexpected character.           |
| `UNEXPECTED_CONTENT`           | Content appears after a complete value, after the end of a document, or after `...`.                                                        |
| `UNEXPECTED_DOCUMENT_MARKER`   | A `---` or `...` line interrupts a quoted scalar or a flow collection, or a byte order mark outside quotes starts a line inside a document. |
| `UNKNOWN_ANCHOR`               | An alias names no anchor completed earlier in the same document.                                                                            |
| `UNKNOWN_TAG`                  | A tag is not a core schema tag, such as `!!binary`.                                                                                         |
| `UNSAFE_KEY`                   | A key is named `__proto__`, `prototype`, or after another `Object.prototype` member. See [Untrusted Input](#untrusted-input).               |
| `UNTERMINATED_FLOW_COLLECTION` | A flow sequence or mapping is never closed.                                                                                                 |
| `UNTERMINATED_STRING`          | A quoted scalar is never closed.                                                                                                            |

---

## Untrusted Input

- `maxDepth` keeps a hostile document from exhausting the call stack, in the parser or in your code that walks the result.
- In total, aliases repeat at most the larger of 1,000,000 characters and 10 times the input length, so a few nested aliases can't expand into gigabytes.
- Input size is not limited, and parsing time grows linearly with it, so cap the size of untrusted input before parsing.
- Every key lands as an own property, so parsing never changes a prototype. Keys named `__proto__`, `prototype`, or after another `Object.prototype` member, such as `constructor` or `toString`, are rejected, since they shadow built-in members and copying the result with `Object.assign` or a deep merge can turn them into prototype pollution. With `allowUnsafeKeys`, copy results with spread (`{ ...result }`) and merge them only with code that skips these keys.
- Merge results only with code that never descends into functions or inherited properties, or keys such as `call` and `slice` can overwrite built-ins in the target.
- Check for a key with `Object.hasOwn`, not `in`, which also finds inherited members.
- Values can hold control characters through escapes such as `\e` and `\0` (NUL), and bidirectional marks such as U+202E. Escape or strip them before writing values to a terminal or log or passing them as command arguments, and reject NUL where code treats it as the end of a string.
- Keys are not Unicode-normalized, so lookalike keys, such as one with a zero-width space or a decomposed accent, stay distinct. Flag them when reviewing files from untrusted authors.

---

## TypeScript

`parse` returns `unknown` and `parseAll` returns `unknown[]`, since a document can hold any shape. Check the shape before using it:

```ts
import { parse } from 'yaml.min';

type Config = {
  database: {
    host: string;
    port: number;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isConfig = (value: unknown): value is Config =>
  isRecord(value) &&
  isRecord(value.database) &&
  typeof value.database.host === 'string' &&
  typeof value.database.port === 'number';

const config = parse(`
  database:
    host: localhost
    port: 5432
`);

if (!isConfig(config)) throw new TypeError('Invalid configuration');

config.database.host; // string
config.database.port; // number
```

`ParseOptions` and `YamlErrorCode` are also exported.

---

## Benchmark

Parsing the same **YAML** snapshot 5,000 times per run, with 5 warmup runs and 10 measured runs via [**hyperfine**](https://github.com/sharkdp/hyperfine):

| Parser                                       | Times slower than **yaml.min** | Package Size                                           |
| -------------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| ✨ **yaml.min**                              | **1.00x** _(baseline)_         | <img src="https://pkg-size.dev/badge/install/47651" >  |
| [js-yaml](https://github.com/nodeca/js-yaml) | 2.05x ↓                        | <img src="https://pkg-size.dev/badge/install/103432">  |
| [yaml](https://github.com/eemeli/yaml)       | 19.82x ↓                       | <img src="https://pkg-size.dev/badge/install/557819" > |

See the [**benchmark**](https://github.com/wellwelwel/yaml.min/tree/main/benchmark) directory for details.

---

## Security Policy

[![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/wellwelwel/yaml.min/ci_codeql.yml?event=push&label=&branch=main&logo=github&logoColor=white&color=f368e0)](https://github.com/wellwelwel/yaml.min/actions/workflows/ci_codeql.yml?query=branch%3Amain)

Please check the [**SECURITY.md**](https://github.com/wellwelwel/yaml.min/blob/main/SECURITY.md).

---

## Contributing

See the [**Contributing Guide**](https://github.com/wellwelwel/yaml.min/blob/main/CONTRIBUTING.md) and please follow our [**Code of Conduct**](https://github.com/wellwelwel/yaml.min/blob/main/CODE_OF_CONDUCT.md).

---

## Acknowledgements

- [![Contributors](https://img.shields.io/github/contributors/wellwelwel/yaml.min?label=Contributors)](https://github.com/wellwelwel/yaml.min/graphs/contributors)
- **yaml.min** is inspired by [**js-yaml**](https://github.com/nodeca/js-yaml).

---

## License

**yaml.min** is under the [**MIT License**](https://github.com/wellwelwel/yaml.min/blob/main/LICENSE).<br />
Copyright &copy; 2026-present [**Weslley Araújo**](https://github.com/wellwelwel) and **yaml.min** [**contributors**](https://github.com/wellwelwel/yaml.min/graphs/contributors).
