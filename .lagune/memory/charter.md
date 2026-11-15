# yaml.min Security Charter

## Principles

### I. Parsing never becomes execution

Never let a document decide what code runs. `parse` MUST only ever produce inert data: plain objects, arrays, strings, numbers, booleans, and null. Never call `eval`, `new Function`, `require`, or a dynamic import on anything derived from the input, and never resolve a YAML tag, type, or directive into a constructed instance, a function, or any value that carries behaviour.

- Why: this is the failure that has broken YAML parsers before. The moment a document can name a type and get an object back, whoever wrote the document controls the program that read it. A config file, a CI manifest, or a user upload turns into remote code execution on the machine that parsed it.

### II. Parsed data never reaches the prototype chain

Keys from a document MUST always land as ordinary data on the object being built. Never let a key such as `__proto__`, `constructor`, or `prototype` modify a shared prototype, and never assume a key is safe because it looks ordinary. Every place that assigns a key onto a result object MUST go through the same guarded assignment, in block mappings, in flow mappings, and in implicit pairs alike.

- Why: prototype pollution lets a document change how every other object in the host application behaves, far outside the data it was supposed to describe. A single crafted key in a config file can flip an internal flag, bypass a permission check, or hand an attacker code execution in the application that trusted the file.

### III. Hostile input never exhausts the host

A document MUST never be able to hang or crash the process that parses it. Always bound recursion depth on every path that can nest, in block collections, in flow collections, and in inline values, not just on one of them. Always keep time and memory proportional to the length of the input: patterns applied to untrusted text MUST run in linear time, string building MUST not become quadratic, and an alias MUST never expand into a copy of what it points at.

- Why: a parser is handed the whole document before anyone has checked it. A few hundred bytes of nested brackets can overflow the stack, and a handful of nested aliases can multiply into gigabytes. Whatever embeds this library goes down with it, so a crash here is a denial of service in someone else's server, build, or deploy.

### IV. Malformed input is rejected, never guessed

Input that is not valid YAML v1.2 MUST fail with an error. Never return a partial, truncated, or invented value for a document that does not parse: an unterminated quote, an alias with no anchor, or a structure that ends mid-way is an error, not a best-effort result.

- Why: two parsers that read the same bytes differently is a security bug in everything built on top of them. If yaml.min quietly accepts a document another parser rejects, or reads a different value out of it, an attacker writes one file that the tool checking a policy reads one way and the system enforcing it reads another. Silent recovery also hides truncated and tampered documents, which then parse as though they were complete.

## Baseline discipline

Lagune holds this charter, every principle, every time. A principle is not suspended because a control looks small, familiar, or unlikely to be hit. This is not a judgement call.

### Only the controls the project needs

Lagune recommends and applies only the controls this project's context calls for. A control the project does not need is never added for completeness, and a generic checklist is not thoroughness. Every later phase acts on what the system actually does, never on what it might hypothetically do.

- Why: effort spent on risks the project does not have buries the risks it does have. Fewer, right-sized controls are easier to apply, prove, and keep true than a checklist no one finishes.

### Prefer the simplest vetted control

When a control is needed, reach for the safest option already proven, in order: a control this project already has, then a platform or framework built-in, then a well-maintained vetted library, and only then custom code. Never hand-roll a security primitive (cryptography, escaping, authentication, sessions) that a vetted standard already provides. A new dependency is new attack surface, justified and not assumed. Code, an endpoint, or a feature the project does not use is attack surface too, so removing it is itself a control.

- Why: hand-rolled security is where subtle, unaudited bugs live, and a second control duplicating an existing one is the one that gets forgotten and drifts. Boring, standard controls are easier to audit and harder to get wrong, and less surface is less to defend.

### When a control seems skippable

A control is held even when a reason to skip it feels reasonable:

- "Too small to need a control": small gaps are where breaches start.
- "Already handled elsewhere": assumed coverage is exactly how gaps hide.
- "Unlikely to be hit": attackers target the path no one is watching.
- "It works, ship it": working and safe are different claims, and the charter requires both.

## Governance

- This charter guides every security decision in each Lagune phase, and every change to it is reviewed and approved by the maintainer.
- It holds only what a deterministic check cannot capture, so it never repeats a control that linters or automated tools already enforces.

Version: 1.0.0 | Ratified: 2026-08-04
