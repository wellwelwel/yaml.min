# yaml.min Defense Plan

- **Scope:** All detect findings. Every one of the 7 findings in the detect map is planned here, all of them in the parser source under `./src`. Each fix is checked against how **js-yaml** and **yaml** handle the same situation, citing the digests under `draft/` as `nodeca-js-yaml/...` and `eemeli-yaml/...`, and settles every choice inside the parser, with nothing left to the caller.
- **Planned:** 2026-11-13

## Fixes

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
