# yaml.min Defense Plan

- **Scope:** All detect findings. Every one of the 7 findings in the detect map is planned here, all of them in the parser source under `./src`. Each fix is checked against how **js-yaml** and **yaml** handle the same situation, citing the digests under `draft/` as `nodeca-js-yaml/...` and `eemeli-yaml/...`, and settles every choice inside the parser, with nothing left to the caller.
- **Planned:** 2026-11-13

## Fixes

### Prototype-chain gadget keys survive into the parsed result

- **Category:** Prototype pollution (CWE-1321)
- **CVSS:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N/SC:H/SI:H/SA:N (9.3, Critical)
- **Priority:** Critical
- **Why this priority:** Nothing stands in front of this: the document is the whole attack, and detect records this library sitting inside other people's servers, build pipelines and CI, parsing files an outside party can influence, so the reach stays fully networked. The stakes are as high as this project has, because the damage does not stop at the parsed value: it lands on the application that embedded the parser, through the recursive merge detect confirmed is the ordinary next step rather than an exotic gadget, and one published parser carries that into every application that installed it. Charter principle II names this exact outcome, so a wide blast radius plus a High integrity requirement keeps it at the top of the band with no downward move.
- **Upholds:** II. Parsed data never reaches the prototype chain
- **Fix:** Make the shared guarded key-assignment helper refuse every prototype-reaching name. When a key's final property name is `__proto__`, `constructor` or `prototype`, reject the document with the parser's `SyntaxError`. The check reads the name the helper receives, after unescaping, tag resolution and alias resolution, so `"__pro\x74o__"`, `!!str constructor` and an alias whose anchored value is `prototype` are caught exactly like the plain spelling. All five call sites (the ordinary mapping entry, the explicit key with a value, the explicit key without one, the flow mapping reader and the inline-pair reader) already route through that helper, so one rule covers every path, as the charter's governance clause requires.

  Neither reference closes this, and following them would leave the gap with the caller. **js-yaml** guards `__proto__` alone and **yaml** guards `__proto__` and `constructor`, both by keeping the name as an own data property on an ordinary object (`nodeca-js-yaml/src/tag/mapping/map.ts:35-50`, `eemeli-yaml/src/nodes/addPairToJSMap.ts:20-37`). That stops pollution during the parse and nothing more: **js-yaml** tells callers to read results with `Object.hasOwn()` (`nodeca-js-yaml/src/tag/mapping/map.ts:4-24`), and the recursive merge detect confirmed stays open. A null-prototype result does not help either, since the caller's merge target is still an ordinary object. Rejection is the only control that holds entirely inside the parser.

  Replace the single flow-mapping test with cases that drive each of the three names through all five paths, in plain, quoted, escaped, tagged and aliased spellings, and assert every one is rejected with `SyntaxError`. Add one case showing the same three words parse normally as values, so the rule stays on keys.

- **References:** [CWE-1321: Improperly Controlled Modification of Object Prototype Attributes](https://cwe.mitre.org/data/definitions/1321.html), [CWE-915: Improperly Controlled Modification of Dynamically-Determined Object Attributes](https://cwe.mitre.org/data/definitions/915.html)

### The nesting depth limit does not cover every recursion path

- **Category:** Uncontrolled recursion leading to stack exhaustion (CWE-674, CWE-400)
- **CVSS:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:L (8.7, High)
- **Priority:** High
- **Why this priority:** The same unprivileged, document-borne reach as everything else on this parser surface, and the same wide blast radius across every dependent, so both the exposure and the stakes sit at the top. It settles below Critical because a stack overflow arrives as a throwable a caller can catch and survive, so the loss on the embedding application is an interruption rather than a takeover.
- **Upholds:** III. Hostile input never exhausts the host
- **Fix:** Move depth accounting onto the shared parser state as the one counter every nesting construct answers to, checked and incremented on entry and decremented on exit of each path that can nest: the block value parser that does it today, the compact same-line collection branch, the flow sequence reader, the flow mapping reader and the flow value reader. This is **js-yaml**'s model, one counter checked each time any node is entered, block or flow alike, added specifically to replace the engine's stack-overflow error (`nodeca-js-yaml/src/parser/parser.ts:1169-1181`, `nodeca-js-yaml/CHANGELOG.md:216-243`).

  Keep the ceiling at its current 1,000 levels, counted across any mix of block, compact and flow nesting. Detect measured the shallowest engine overflow at about 3,300 bracket levels on **Node.js** 26's default stack, so the parser's own error fires with under a third of that budget spent.

  Raise the depth error as the parser's `SyntaxError`, not the `RangeError` it uses today, so over-nested input is rejected as a bad document instead of sharing a class with the engine's stack overflow.

  Add **yaml**'s backstop at the public entry point for hosts that call the parser with less stack left than the default: a `RangeError` that escapes the parse is rethrown as the parser's `SyntaxError`, carrying the original as its `cause` (`eemeli-yaml/src/compose/compose-node.ts:64-75`). The counter is the control and the backstop guarantees the contract: whatever the host's stack, the caller only ever receives the error the library declares.

  Widen the maximum-nesting-depth test so each path, and one document mixing all three, parses at exactly the ceiling and fails one level past it with `SyntaxError`. Add **js-yaml**'s pathological cases, 100,000 opening brackets and 100,000 nested flow mappings, plus 100,000 compact dashes, each expecting `SyntaxError` (`nodeca-js-yaml/test/core/pathological.test.mjs:31-42`). Pin the backstop by calling the parser from deep inside a recursive helper, with too little stack left for the ceiling, and asserting `SyntaxError`.

- **References:** [CWE-674: Uncontrolled Recursion](https://cwe.mitre.org/data/definitions/674.html), [CWE-400: Uncontrolled Resource Consumption](https://cwe.mitre.org/data/definitions/400.html)

### Mapping keys are coerced to strings, so distinct keys silently collide

- **Category:** Duplicate key collision through unsafe input equivalence (CWE-1289)
- **CVSS:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N/SC:N/SI:L/SA:N (8.7, High)
- **Priority:** High
- **Why this priority:** The reach is the same as any other document this parser is handed, and the material it is aimed at, policy and configuration files, is exactly where it hurts. What holds it below Critical is where the damage stops: the attacker gets full control over which entry the consumer ends up seeing, so the parser's own integrity guarantee is completely gone, but the consequence stays inside the one document that was parsed instead of spreading through the host process the way a polluted prototype does. Charter principle IV treats the resulting disagreement between readers as a real risk, and a published parser's wide blast radius keeps the integrity requirement High, so it settles at the top of High rather than dropping to Medium.
- **Upholds:** IV. Malformed input is rejected, never guessed
- **Depends on:** Block and flow mappings stringify the same key by different rules
- **Fix:** Reject a repeated key. Inside the shared key-assignment helper, once a key has its final property name, test own-property presence on the object being built (`Object.hasOwn`, never `in`, so an inherited name such as `toString` is never mistaken for a taken key) and fail with the parser's `SyntaxError` when the name is already there. Every call site on both mapping paths goes through that helper, so the check covers them all. This is **js-yaml**'s rule: it compares final property names through `hasOwnProperty` and throws `duplicated mapping key` (`nodeca-js-yaml/src/tag/mapping/map.ts:51-55`, `nodeca-js-yaml/src/parser/constructor.ts:305-307`).

  Compare property names, not the typed values the keys resolved to. **yaml** compares resolved values, so `"16"` and `16` count as different keys, land on the same property, and the later one still wins silently (`eemeli-yaml/src/compose/resolve-block-map.ts:79-80`, `eemeli-yaml/src/compose/resolve-flow-collection.ts:196-201`). Comparing names turns every collision detect listed into an error: a plain repeated key, `0x10` and `16`, `1.0` and `"1"`, and `null`, `~` and the empty key. No canonical naming scheme is needed, because a plain object can only hold the name, and a document that maps two keys onto one name is refused instead of resolved by guessing which one the author meant. Collection keys, the source of the `[object Object]` collapse, are refused by the stringification fix, which is why this fix follows it.

  Add, in both syntaxes, a plain repeated key, each collision pair above, a repeat that arrives through an alias, a repeat through the explicit-key form, and a single `toString` key that must still parse. Neither the snapshot corpus nor the end-to-end suites feed a repeated key today.

- **References:** [CWE-1289: Improper Validation of Unsafe Equivalence in Input](https://cwe.mitre.org/data/definitions/1289.html), [CWE-694: Use of Multiple Resources with Duplicate Identifier](https://cwe.mitre.org/data/definitions/694.html)

### Alias expansion has no fan-out, depth, or size budget

- **Category:** Uncontrolled recursive entity expansion, the "billion laughs" denial of service (CWE-776, CWE-400)
- **CVSS:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:N/SC:N/SI:L/SA:H (7.8, High)
- **Priority:** High
- **Why this priority:** Reached by the same untrusted document with no privilege or interaction in front of it, and carrying the same wide blast radius across every dependent, which is what holds it high. It does not reach Critical because the parser itself stays inside its input-proportional budget, so the entire loss lands on the host that walks the result, and that host is assumed to walk it, since a caller that parses a document and then never serializes, validates, clones, or merges it is not a deployment this library is written for.
- **Upholds:** III. Hostile input never exhausts the host
- **Fix:** Count, while parsing, the size the result will have when walked, and refuse a document whose aliases inflate it past a fixed bound. Hold one node counter on the shared parser state: each key, scalar and collection the parser builds adds one, and each resolved alias adds the full size of the node its anchor labels. The anchor store records that size next to the value when the anchored node finishes, as the counter's value at the node's end minus its value at the node's start. Because an anchored node's size already includes what the aliases inside it added, chains of any depth and fan-out of any width are counted exactly, with one addition per alias and no walk.

  Bound the nodes that aliases add to the larger of 100,000 and the document's length in characters, and reject past it with the parser's `SyntaxError`. Check at every alias, so the counter fails fast and never grows large enough to lose precision. A document without aliases is never affected, small documents keep ordinary anchor reuse, and the walked result stays proportional to the input as principle III requires. Detect's 288-byte sample adds about 43 million nodes (eight layers of nine) and is refused at the bound instead of at the consumer.

  This is the walk **js-yaml** asks every caller to write, counting each element every time an alias repeats it, with 100,000 as its suggested limit (`nodeca-js-yaml/docs/safety.md:20-62`), moved inside the parser so no caller has to. **js-yaml** itself only offers a raw alias count that is off by default (`nodeca-js-yaml/src/parser/constructor.ts:440-443`). **yaml** enforces a weighted count by default, but its weight descends only into sequences and pairs, so nested anchored mappings pass (`eemeli-yaml/src/nodes/toJS.ts:42-72`). Counting every node kind exactly closes both gaps, and one size bound replaces separate caps on alias count, chain depth and anchor count, since aliases and anchors already grow only with the input and expanded size is the one thing that does not.

  An alias may only name a finished node. An alias inside the node its own anchor labels has no final size and would make the result cyclic, which no walk or serializer survives, so reject it with the same error.

  Key the anchor store by name in a `Map`, as **js-yaml** does (`nodeca-js-yaml/src/parser/constructor.ts:339-357`), so `*constructor` or `*__proto__` can only find an anchor the document declared, never an inherited value. Detect does not record how the store is keyed today, so this pins it either way.

  Keep returning the anchored value by reference, as both references do (`nodeca-js-yaml/src/parser/constructor.ts:440-455`, `eemeli-yaml/src/nodes/toJS.ts:25-52`), since copying would turn the deferred amplification into an immediate one. State in the README that aliased values are shared, so editing one edits every place that refers to it, the contract **js-yaml** documents (`nodeca-js-yaml/docs/safety.md:20-25`).

  Pin the sharing with an identity assertion, not deep equality, so a later change that copies alias values fails the suite. Add cases for detect's sample, a document exactly at the bound (accepted) and one node past it (rejected), the same attack built from nested anchored mappings, a self-referencing alias, and anchors named `constructor` and `__proto__`.

- **References:** [CWE-776: Improper Restriction of Recursive Entity References in DTDs](https://cwe.mitre.org/data/definitions/776.html), [CWE-400: Uncontrolled Resource Consumption](https://cwe.mitre.org/data/definitions/400.html), [OWASP XML External Entity Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)

### Numeric scalars are coerced with no precision or range check

- **Category:** Numeric truncation and precision loss (CWE-681)
- **CVSS:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:L/SA:N (6.9, Medium)
- **Priority:** Medium
- **Why this priority:** Reaching it needs nothing beyond the document and no unusual syntax, since any number-shaped text takes the path. The stakes are what hold it at Medium: the damage is bounded to individual values rather than the structure of the result or the host process, so a caller loses fidelity on a field instead of control of the document. The published-parser blast radius keeps it from falling to Low, since the same silent alteration reaches every dependent.
- **Upholds:** IV. Malformed input is rejected, never guessed
- **Fix:** Return a number only when it is the value the document wrote, and otherwise keep the scalar as its text, the same fallback the YAML core schema gives any plain scalar no type accepts. Three exact rules apply, with no general re-render comparison:
  - An integer, in any form the resolver accepts, is returned only when it is a safe integer (`Number.isSafeInteger`). Past ±(2^53 − 1), `12345678901234567890` and large hexadecimal values stay text. Both references round silently here (`nodeca-js-yaml/src/tag/scalar/int_core.ts:40-49`, `eemeli-yaml/src/schema/core/int.ts:9-14`), so this goes further than either, on principle IV. **yaml**'s `BigInt` option is no answer, because a `BigInt` is not the plain number charter principle I allows.
  - A float is returned when the conversion is finite, rounded to the nearest double as every float is by definition. A numeral that overflows, such as `1e999` or `-1e999`, stays text, as **js-yaml** does (`nodeca-js-yaml/src/tag/scalar/float_core.ts:20-35`). **yaml** returns `Infinity` there (`eemeli-yaml/src/schema/core/float.ts:48-59`) and is not followed.
  - Infinity and not-a-number come only from their literal spellings (`.inf`, `+.inf`, `-.inf`, `.nan` and their `Inf`, `INF`, `NaN`, `NAN` variants), which the core schema defines and both references resolve the same way.

  A leading zero stays decimal: `01234` is the integer 1234 under the YAML 1.2 core schema and in both references (`nodeca-js-yaml/test/core/tags/int.test.mjs:93-112`, `eemeli-yaml/src/schema/core/int.ts:31-41`), so it is conformance, not loss. An author who means the text quotes it or tags it `!!str`, which the type-tag fix makes work.

  Pin each rule at its edge: `9007199254740991` returns a number and `9007199254740992` returns text, `0x1FFFFFFFFFFFFF` and `0x20000000000000` likewise, `1e308` returns a number and `1e309` returns text, every literal spelling returns its value, and `01234` returns 1234.

- **References:** [CWE-681: Incorrect Conversion between Numeric Types](https://cwe.mitre.org/data/definitions/681.html), [CWE-197: Numeric Truncation Error](https://cwe.mitre.org/data/definitions/197.html), [CWE-1339: Insufficient Precision or Accuracy of a Real Number](https://cwe.mitre.org/data/definitions/1339.html)

### Block and flow mappings stringify the same key by different rules

- **Category:** Interpretation conflict, parser differential (CWE-436)
- **CVSS:** CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:L/SA:N (6.3, Medium)
- **Priority:** Medium
- **Why this priority:** The document reaches it as easily as any other, but the divergence only pays off under a condition the attacker does not control: the key has to be a collection or empty, which real configuration files rarely contain, and something has to read the same document in the other form for the two answers to disagree. That condition is what lowers it out of High. It does not fall to Low because charter principle IV treats a differential as a genuine risk rather than a cosmetic inconsistency, and detect verified the two forms producing different key names by running them side by side rather than inferring it.
- **Upholds:** IV. Malformed input is rejected, never guessed, III. Hostile input never exhausts the host
- **Fix:** Give both mapping styles one naming rule, held in the shared key-stringifier: drop the flow mapping reader's plain string conversion and route its key through that stringifier, as the indentation-style reader already does. Under that rule a scalar key becomes its text form, with `null` becoming the empty name as the shared stringifier does today and **yaml** does (`eemeli-yaml/src/nodes/addPairToJSMap.ts:42-50`), and a key that is a sequence or a mapping, written out or reached through an alias, is rejected with the parser's `SyntaxError`.

  Rejecting collection keys is **js-yaml**'s rule since v5, because an object-based map has no faithful property name for a collection (`nodeca-js-yaml/src/tag/mapping/map.ts:35-38`, `nodeca-js-yaml/CHANGELOG.md:162-168`). **yaml** re-serialises the collection into a name and only warns (`eemeli-yaml/src/nodes/addPairToJSMap.ts:50-64`), which is the same invented name detect found here as `["a","b"]` and `a,b`, so it is not followed. Refusing also means no key is ever serialised while parsing, so an alias key pointing at a large anchored collection cannot expand inside the parser.

  Pin it with a test that parses the same logical document in both syntaxes and asserts identical key sets, and with cases asserting that a sequence key, a mapping key and an alias to either are rejected in both syntaxes, including the explicit-key form and the inline pair inside a flow sequence.

- **References:** [CWE-436: Interpretation Conflict](https://cwe.mitre.org/data/definitions/436.html), [CWE-1289: Improper Validation of Unsafe Equivalence in Input](https://cwe.mitre.org/data/definitions/1289.html)

### Explicit type tags are discarded, so values keep the type the parser guesses

- **Category:** Interpretation conflict through ignored type declarations, parser differential (CWE-436, CWE-1287)
- **CVSS:** CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:L/SA:N (6.3, Medium)
- **Priority:** Medium
- **Why this priority:** The document reaches it as easily as any other, but an attacker who controls the whole file could simply write the value they want, so the payoff needs a second reader that honours the tag (a reviewer, a schema validator, or a conforming parser) while the running system uses this one, and that condition holds it below High. It stays Medium rather than Low because the most natural casualty is a switch declared off that reads as on, a fail-open on exactly the security-relevant configuration the charter says this parser is aimed at, and every dependent inherits it.
- **Upholds:** IV. Malformed input is rejected, never guessed, I. Parsing never becomes execution
- **Depends on:** Numeric scalars are coerced with no precision or range check
- **Fix:** Stop throwing tags away. Have the anchor-and-tag reader return the tag alongside the anchor and pass it to every reader that resolves a value, in both syntaxes, so no path can drop it.

  Resolve each tag to its full name before deciding anything. `!!` expands to `tag:yaml.org,2002:`, a named handle such as `!e!` expands through the `%TAG` directive that declares it for the document, and an undeclared named handle is rejected. A `%TAG` directive that redeclares `!!` takes effect, so `!!int` under it is no longer the core type. The suffix is percent-decoded, and a verbatim tag `!<...>` is taken as written once decoded. This is how both references expand tags (`nodeca-js-yaml/src/common/tagname.ts:89-99`, `nodeca-js-yaml/src/parser/parser.ts:481-483`, `nodeca-js-yaml/src/parser/parser.ts:1366-1373`, `eemeli-yaml/src/doc/directives.ts:145-159`). Without it a document could redeclare `!!` and have **yaml.min** read a core type that every conforming reader treats as foreign.

  Honour exactly the core-schema tags, `tag:yaml.org,2002:` followed by `str`, `int`, `float`, `bool`, `null`, `seq` or `map`, and the non-specific `!`, which makes a scalar a string and leaves a collection as it is:
  - A tagged scalar resolves under its declared type's own rule whatever its quoting: `!!bool "false"` is `false`, `!!str 0123` is `"0123"`, `!!int "5"` is `5`, and `!!float 1` is `1`, as **js-yaml** resolves them (`nodeca-js-yaml/src/parser/constructor.ts:176-190`, `nodeca-js-yaml/src/tag/scalar/float_core.ts:3-11`).
  - Text that does not fit its declared type is rejected with the parser's `SyntaxError`: `!!int "five"`, `!!bool "maybe"`, and any value the numeric fix keeps as text, such as `!!int 12345678901234567890` or `!!float 1e999`, since an explicit type leaves no text fallback. This is why this fix follows the numeric one.
  - An empty node takes the declared type's empty value where one exists (`!!str` the empty text, `!!null` null, `!!seq` and `!!map` an empty collection) and is rejected under `!!int`, `!!float` and `!!bool` (`nodeca-js-yaml/src/parser/constructor.ts:192-209`).
  - A collection tag on a scalar, a scalar tag on a collection, `!!seq` on a mapping and `!!map` on a sequence are rejected.

  Reject every other tag with the same error: `!!binary`, `!!timestamp`, `!!set`, `!!omap`, `!!pairs`, `!!merge`, application tags like `!custom`, and any verbatim tag outside the core schema. Never map a tag to a constructor, a function or any value that carries behaviour. This is **js-yaml**'s default schema (`nodeca-js-yaml/src/schema.ts:298-304`, `nodeca-js-yaml/src/parser/constructor.ts:176-211`). **yaml** only warns and returns the text for an unknown tag or a mismatched value (`eemeli-yaml/src/compose/compose-scalar.ts:82-88`), and by default builds byte arrays and dates from `!!binary` and `!!timestamp` (`eemeli-yaml/src/schema/tags.ts:74-90`), which principles IV and I rule out.

  Reject a node carrying two tags and a tag on an alias, as both references do (`nodeca-js-yaml/src/parser/parser.ts:430-432`, `nodeca-js-yaml/src/parser/parser.ts:508-512`, `eemeli-yaml/src/compose/resolve-props.ts:130-133`, `eemeli-yaml/src/compose/compose-node.ts:48-56`).

  Pin it with tests that drive each core tag through plain and quoted scalars in both syntaxes, cover each rejection above, a `%TAG` redeclaration of `!!`, a percent-encoded core tag and a verbatim core tag, and assert that no tag ever yields anything but plain data.

- **References:** [CWE-436: Interpretation Conflict](https://cwe.mitre.org/data/definitions/436.html), [CWE-1287: Improper Validation of Specified Type of Input](https://cwe.mitre.org/data/definitions/1287.html), [CWE-704: Incorrect Type Conversion or Cast](https://cwe.mitre.org/data/definitions/704.html)
