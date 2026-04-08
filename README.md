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

```ts
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

### Floats

```yaml
pi: 3.14159
scientific: 6.626e-34
positive_inf: .inf
negative_inf: -.inf
not_a_number: .nan
```

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
  <<: *defaults

production:
  database: prod_db
  <<: *defaults
```

### Explicit Keys

```yaml
complex key: value
```

### Document Markers

```yaml
---
first: document
...
---
second: document
```

---

## TypeScript

The `parse` function accepts a generic type parameter:

```ts
import { parse } from 'yaml.min';

type Config = {
  database: {
    host: string;
    port: number;
  };
};

const config = parse<Config>(`
  database:
    host: localhost
    port: 5432
`);

config.database.host; // string
config.database.port; // number
```

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
