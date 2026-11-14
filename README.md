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
- Single-file hand-written recursive-descent parser
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

| Option            | Default | Description                                                                                                                                                                     |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxDepth`        | `256`   | How deep collections can nest, however they are written, counting the levels each alias repeats. Must be an integer from `0` to `400`. See [Untrusted Input](#untrusted-input). |
| `bigint`          | `false` | Returns integers as `BigInt`. See [Integers](#integers).                                                                                                                        |
| `allowUnsafeKeys` | `false` | Accepts keys named `__proto__`, `prototype`, or after another `Object.prototype` member as ordinary own keys. See [Untrusted Input](#untrusted-input).                          |

---

## Supported Types

### Strings

Plain, single-quoted, double-quoted, and all escape sequences:

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

With `bigint: true`, every integer of up to 1,000 digits is returned as an exact `BigInt`, and longer ones stay strings, because converting them costs more than linear time. Floats stay numbers.

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

An alias returns the value its anchor labels, not a copy. Each mapping or sequence an alias refers to is frozen, along with everything inside it, so it can't be changed through the anchor or any alias. To change one, copy it, for example with `structuredClone`, and change the copy. A `structuredClone` of the whole result keeps its aliased parts shared but no longer frozen. An alias can only refer to a node that is already complete. See [Untrusted Input](#untrusted-input) for how much aliases can repeat.

**yaml.min** follows **YAML** 1.2, which has no merge keys, so it never copies the entries of one mapping into another. Parsers that apply the older merge key read `<<: *defaults` as those copied entries. To never read a document differently from them, **yaml.min** rejects a key that reads as `<<`, whether plain, quoted, or through an alias, with `MERGE_KEY`. For a literal `<<` key, write it as a quoted scalar tagged `!!str`, such as `!!str "<<"`, which those parsers also read as text.

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

`!!str`, `!!int`, `!!float`, `!!bool`, `!!null`, `!!seq`, `!!map`, and the non-specific `!` are honored, including through `%TAG` handles and verbatim tags such as `!<tag:yaml.org,2002:str>`. Any other tag, such as `!!binary`, `!!timestamp`, or `!custom`, is rejected with `UNKNOWN_TAG`, and a value that does not fit its tag, such as `!!int "five"`, with `TAG_MISMATCH`.

### Document Markers

`parse` reads a single document and rejects a stream that holds more than one. Use `parseAll` to read every document in order:

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

- `message` is plain language and can change in any release, so match on `code` to tell errors apart or to write your own messages.
- Messages are at most 300 characters, and any key, anchor, or tag they quote is cut to 40 characters (marked with `…`). Quoted text escapes `"` and `\`, and shows control, invisible, and bidirectional characters as code points such as `[U+202E]`. Scalar values are never quoted.
- A source that is not a string, or an invalid option, throws a `TypeError` instead.

### Error Codes

| Code                           | Meaning                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALIAS_EXPANSION_TOO_LARGE`    | Aliases repeat more content than the input allows. See [Untrusted Input](#untrusted-input).                                                  |
| `COLLECTION_KEY`               | A mapping key is a sequence or a mapping.                                                                                                    |
| `DUPLICATE_ANCHOR`             | A node carries more than one anchor.                                                                                                         |
| `DUPLICATE_KEY`                | A key appears more than once in a mapping, including keys that share a text form, such as `0x10` and `16`.                                   |
| `DUPLICATE_TAG`                | A node carries more than one tag.                                                                                                            |
| `DUPLICATE_TAG_HANDLE`         | A `%TAG` directive declares a handle the document already declared.                                                                          |
| `ENGINE_LIMIT`                 | Parsing exhausted an engine limit, such as the call stack.                                                                                   |
| `EXPECTED_MAPPING_ENTRY`       | A line in a block mapping is not a `key: value` entry, or an implicit key spans lines or puts its `:` over 1,024 characters after its start. |
| `INVALID_ALIAS`                | An alias has no anchor name after `*`, or carries an anchor.                                                                                 |
| `INVALID_BLOCK_SCALAR_HEADER`  | A block scalar header repeats an indicator or holds an unexpected character.                                                                 |
| `INVALID_DIRECTIVE`            | A `%YAML` or `%TAG` directive is malformed, a document has two `%YAML` directives, or directives are not followed by `---`.                  |
| `INVALID_ESCAPE`               | An escape sequence is unknown, incomplete, or names an invalid code point.                                                                   |
| `INVALID_INDENTATION`          | A line is indented with a tab, or by an amount no open collection expects.                                                                   |
| `INVALID_TAG`                  | A tag is malformed, runs into its node, or labels an alias or a sequence that starts on its line.                                            |
| `MERGE_KEY`                    | A key reads as the merge key `<<` and is not a quoted scalar tagged `!!str`. See [Anchors and Aliases](#anchors-and-aliases).                |
| `MULTIPLE_DOCUMENTS`           | `parse` received more than one document. Use `parseAll` for a stream.                                                                        |
| `NESTING_TOO_DEEP`             | Collections nest deeper than `maxDepth`, counting the levels aliases repeat.                                                                 |
| `NON_PRINTABLE_CHARACTER`      | The input holds a control character, a lone surrogate, or another non-printable character.                                                   |
| `TAG_MISMATCH`                 | A tag labels a value that does not fit it, such as `!!int five`.                                                                             |
| `UNDECLARED_TAG_HANDLE`        | A tag uses a handle no `%TAG` directive declares.                                                                                            |
| `UNEXPECTED_CHARACTER`         | A plain scalar starts with an indicator, a `#` touches the content before it, or a flow collection holds an unexpected character.            |
| `UNEXPECTED_CONTENT`           | Content appears after a complete value, after the end of a document, or after `...`.                                                         |
| `UNEXPECTED_DOCUMENT_MARKER`   | A `---` or `...` line interrupts a quoted scalar or a flow collection, or a byte order mark outside quotes starts a line inside a document.  |
| `UNKNOWN_ANCHOR`               | An alias names no anchor completed earlier in the same document.                                                                             |
| `UNKNOWN_TAG`                  | A tag is not a core schema tag, such as `!!binary`.                                                                                          |
| `UNSAFE_KEY`                   | A key is named `__proto__`, `prototype`, or after another `Object.prototype` member. See [Untrusted Input](#untrusted-input).                |
| `UNTERMINATED_FLOW_COLLECTION` | A flow sequence or mapping is never closed.                                                                                                  |
| `UNTERMINATED_STRING`          | A quoted scalar is never closed.                                                                                                             |

---

## Untrusted Input

- `maxDepth` stops a hostile document from exhausting the call stack, in the parser or in your code that walks the result. An alias counts the levels of the node it repeats, so the result never nests deeper than the limit, even when every node in the document stays within it. Its ceiling of `400` stays below the shallowest overflow measured (about 750 nested block mappings on **Node.js** 22).
- The content that aliases repeat adds up to at most the larger of 1,000,000 characters and 10 times the length of the input, so a handful of nested aliases can't turn into gigabytes once the result is walked or serialized.
- Neither `parse` nor `parseAll` limits input size, and their work grows linearly with it, so cap the size of untrusted input before parsing.
- Results are ordinary objects, and every key lands as an own property, so parsing never changes a prototype. Keys named `__proto__`, `prototype`, or after any other `Object.prototype` member (such as `constructor`, `toString`, or `hasOwnProperty`) are refused, because they would hide built-in members of the result, and copying it with `Object.assign` or a deep merge can turn them into prototype changes or rewrite built-ins. With `allowUnsafeKeys`, copy results with spread (`{ ...result }`) and merge them only with code that skips these keys.
- A deep merge that descends into functions or arrays already in its target can still reach built-ins through other names, such as `call` on a function or `slice` on an array. Merge results only with code that never descends into functions or inherited properties.
- Check for a key with `Object.hasOwn`, since `in` also finds the members every object inherits.
- Double-quoted scalars can hold control characters through escapes such as `\e` and `\0` (NUL), and any scalar can hold bidirectional marks such as U+202E even when written raw. Escape or strip both before writing parsed values to a terminal or log or passing them as command arguments, and reject NUL before passing a value to code that treats it as the end of a string.
- Keys are compared without Unicode normalization, so lookalike keys, such as one with a zero-width space or a decomposed accent, stay distinct. When reviewing files from untrusted authors, flag invisible or decomposed characters in keys.
- Error messages are short and safe to display. See [Error Handling](#error-handling).

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

Measured with [**hyperfine**](https://github.com/sharkdp/hyperfine) parsing the same **YAML** payload:

| Parser                                       | Times slower than **yaml.min** | Package Size                                           |
| -------------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| ✨ **yaml.min**                              | **1.00x** _(baseline)_         | <img src="https://pkg-size.dev/badge/install/47651" >  |
| [js-yaml](https://github.com/nodeca/js-yaml) | 2.05x ↓                        | <img src="https://pkg-size.dev/badge/install/103432">  |
| [yaml](https://github.com/eemeli/yaml)       | 19.82x ↓                       | <img src="https://pkg-size.dev/badge/install/557819" > |

- Each benchmark parses the same **YAML** snapshot **5,000 times** per run, with **10 measured runs** and **5 warmup runs** via [**hyperfine**](https://github.com/sharkdp/hyperfine). See the [**benchmark**](https://github.com/wellwelwel/yaml.min/tree/main/benchmark) directory for details.

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
- **yaml.min** is inspired by [**js-yaml**](https://github.com/nodeca/js-yaml), reimplemented as a hand-written recursive-descent parser for performance and zero dependencies.

---

## License

**yaml.min** is under the [**MIT License**](https://github.com/wellwelwel/yaml.min/blob/main/LICENSE).<br />
Copyright &copy; 2026-present [**Weslley Araújo**](https://github.com/wellwelwel) and **yaml.min** [**contributors**](https://github.com/wellwelwel/yaml.min/graphs/contributors).
