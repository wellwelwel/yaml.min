# Lagune History

## Closed findings

### Mismatched flow brackets hang the process or abort it out of memory

- **Classification:** Critical
- **Category:** Loop with an unreachable exit condition, causing uncontrolled resource consumption (CWE-835, CWE-400)
- **What it is:** When a bracket-style sequence meets a closing curly brace, or a brace-style mapping meets a closing square bracket, the parser neither accepts the character nor rejects the document. It stops, tries to read a value, reads nothing, and starts the same attempt again from the same position, forever. The document `[}` is two characters long and never finishes parsing. So is `{]`.
- **Closed:** 2026-11-13

### An alias with no anchor resolves to undefined instead of failing

- **Classification:** Medium
- **Category:** Improper check for an exceptional condition, failing open (CWE-754, CWE-636)
- **What it is:** When an alias names an anchor that was never defined, or names nothing at all, the resolver returns `undefined` rather than reporting an error, and the surrounding readers store that `undefined` as if it were a parsed value. Inside a bracket collection the result is a list holding a JavaScript `undefined`. Used as a key, it becomes a key literally named `undefined` inside braces and an empty-named key in indentation style. A node that carries two anchors silently keeps only the second, so an alias to the first resolves to `undefined` the same way.
- **Closed:** 2026-11-13

### Malformed block structure is silently dropped rather than rejected

- **Classification:** Critical
- **Category:** Parser differential leading to protection mechanism bypass (CWE-436: Interpretation Conflict)
- **What it is:** When a line inside an indentation-style mapping does not parse as an entry, the entry loop stops and the collection is returned as-is, discarding everything after that line. The same happens when indentation does not match what the current collection expects. Tab-indented lines, which YAML forbids as indentation, are accepted and quietly reattached at a different level.
- **Closed:** 2026-11-13

### Multi-document streams are silently truncated to the first document

- **Classification:** Critical
- **Category:** Parser differential leading to protection mechanism bypass (CWE-436: Interpretation Conflict)
- **What it is:** YAML files may hold several documents separated by `---`, ending with `...`. The main value parser treats those markers as a stop signal and returns what it has, and the directive-and-marker skipper only runs before the first document. Everything after the first document is never parsed and never reported. A top-level plain scalar does not even stop: it reads straight across the marker line and folds the next document into its own text.
- **Closed:** 2026-11-13

### Unterminated quoted strings are completed instead of rejected

- **Classification:** High
- **Category:** Improper validation of syntactic correctness of input (CWE-1286)
- **What it is:** When a single-quoted or double-quoted string never receives its closing quote, the scanner runs to the end of the input and hands back everything it collected as if the string had ended normally. Nothing reports that the quote was missing.
- **Closed:** 2026-11-13

### Truncated flow collections parse as complete values

- **Classification:** Medium
- **Category:** Improper validation of syntactic correctness of input, creating a parser differential (CWE-1286, CWE-436)
- **What it is:** A bracket or brace collection that stops before its closing character is accepted and returned as though it had been closed properly. `[a, b` becomes a finished two-item list. `{a: 1` becomes a finished mapping. Several unclosed collections nested inside each other are all closed silently at once: `[[{a: [1` returns a complete four-level structure.
- **Closed:** 2026-11-13

### A trailing backslash writes the literal word undefined into the parsed value

- **Classification:** Medium
- **Category:** Improper handling of a truncated escape sequence, with an out-of-range read coerced into text (CWE-20, CWE-704)
- **What it is:** In the double-quoted scanner, a backslash at the very end of the input advances the cursor past the end and then reads the character there. Reading past the end of a string yields nothing at all, and that nothing is joined onto the result text, which turns it into the nine letters `undefined`.
- **Closed:** 2026-11-13

### Hexadecimal escapes consume a fixed width without validating their digits

- **Classification:** Critical
- **Category:** Parser differential through unvalidated fixed-width escape decoding, letting an escape misread the document's own structure (CWE-1286, CWE-115)
- **What it is:** The `\x`, `\u`, and `\U` escapes each take a fixed number of following characters (two, four, and eight), convert them as hexadecimal, and then move the cursor forward by that fixed number no matter what those characters actually were. The conversion accepts trailing garbage and stops at the first character it cannot read, and it produces a not-a-number result when there are no usable digits at all. Neither outcome is checked.
- **Closed:** 2026-11-13

### Unknown escape sequences are silently accepted

- **Classification:** Medium
- **Category:** Parser differential through acceptance of escape sequences outside the specification's closed set (CWE-1286, CWE-20)
- **What it is:** When a backslash is followed by a character that is not a recognized escape, the scanner drops the backslash and keeps the character as ordinary text instead of treating the sequence as invalid.
- **Closed:** 2026-11-13

### Out-of-range code point escapes throw an error type the library never declares

- **Classification:** Medium
- **Category:** Uncaught exception escaping the library's declared error contract (CWE-248, CWE-755)
- **What it is:** The eight-digit `\U` escape passes its converted number straight to the routine that builds a character from a code point. That routine refuses any value above the highest legal code point, and also refuses a not-a-number result, and the way it refuses is by throwing. Nothing catches it.
- **Closed:** 2026-11-13

### Escape decoding bypasses the document's character screening

- **Classification:** High
- **Category:** Protection-mechanism bypass through validate-before-decode ordering, delivering ill-formed Unicode to the caller (CWE-180, CWE-176)
- **What it is:** Before parsing begins, the whole document is screened against a pattern that rejects control characters and unpaired halves of surrogate pairs, and separately against a check that rejects a raw null byte. That screening runs over the raw source text only. Escape sequences are decoded afterwards, and they can reintroduce precisely the characters the screening exists to keep out.
- **Closed:** 2026-11-13

### Multi-line plain scalars silently drop their continuation lines

- **Classification:** Medium
- **Category:** Parser differential with silent value truncation (CWE-436: Interpretation Conflict)
- **What it is:** An unquoted value may continue onto following lines, and whether it does is supposed to depend on how far those lines are indented. The routine measures that indentation only after it has already consumed the whitespace at the start of the line, so by the time it measures there is no leading whitespace left to count and the measurement is always zero. The comparison that follows is therefore decided in advance rather than by the document.
- **Closed:** 2026-11-13

### Malformed block scalar headers are guessed instead of rejected

- **Classification:** Medium
- **Category:** Improper validation of syntactic correctness of input (CWE-1286)
- **What it is:** The header that introduces a literal or folded block accepts an indentation digit and a chomping indicator. The reader loops over the header characters and overwrites its decision each time it sees another one, so a header carrying two digits or two conflicting chomping indicators is accepted with the last one winning. A zero indentation digit, which is not legal, is also accepted and results in the block's content being returned as empty.
- **Closed:** 2026-11-13

### Signed hexadecimal and octal scalars lose their sign

- **Classification:** Medium
- **Category:** Incorrect numeric conversion (CWE-681)
- **What it is:** The integer resolver reads and steps past a leading plus or minus, then detects the hexadecimal or octal prefix, then converts only the digits that follow the prefix. The sign it stepped past is never reapplied. A document containing `-0x10` yields positive sixteen. `-0o17` yields positive fifteen.
- **Closed:** 2026-11-13

### The public parse entry point casts its result to a caller-chosen type

- **Classification:** Medium
- **Category:** Improper validation of specified type of input (CWE-1287)
- **What it is:** The public parse function lets the caller name the type they expect and then asserts the parsed value into that type before returning it. Nothing is checked at run time. Whatever the document produced is handed back wearing the caller's chosen shape.
- **Closed:** 2026-11-13

### Prototype-chain gadget keys survive into the parsed result

- **Classification:** Critical
- **Category:** Prototype pollution (CWE-1321)
- **What it is:** Every mapping key from the document is written onto a plain object literal through one shared guarded assignment helper. That helper singles out `__proto__` and defines it as an own property instead of letting the assignment walk the prototype chain, which is the correct technique and does stop pollution while parsing. Nothing else is treated specially: `constructor` and `prototype` are assigned with no guard at all, and the guarded `__proto__` key is left visible and enumerable on the object handed back to the caller.
- **Closed:** 2026-11-13

### The nesting depth limit does not cover every recursion path

- **Classification:** High
- **Category:** Uncontrolled recursion leading to stack exhaustion (CWE-674, CWE-400)
- **What it is:** The parser sets itself a maximum nesting depth of one thousand levels and raises a clear error past it. That counter is incremented in exactly one function, the indentation-style value parser. Two other recursion paths never touch it: the branch that handles collections written compactly on a single line (`- - - - x`), which calls itself once per level, and the bracket-and-brace readers, which recurse into one another through the flow value reader with nothing counting the levels. Nesting that arrives on separate lines is counted and rejected correctly. Nesting that arrives on one line, or inside brackets, is not counted at all.
- **Closed:** 2026-11-13

### Alias expansion has no fan-out, depth, or size budget

- **Classification:** High
- **Category:** Uncontrolled recursive entity expansion, the "billion laughs" denial of service (CWE-776, CWE-400)
- **What it is:** An anchor stores a value under a name and an alias hands the stored value straight back, by reference rather than by copy. The resolver keeps no count of how many times an anchor is referenced, how deeply aliases chain into each other, or how large the referenced value is, and anchors accumulate for the whole document with no cap. Both the indentation-style and the bracket-and-brace readers store whatever the lookup returns without any budget on the path.
- **Closed:** 2026-11-13

### Mapping keys are coerced to strings, so distinct keys silently collide

- **Classification:** High
- **Category:** Duplicate key collision through unsafe input equivalence (CWE-1289)
- **What it is:** Every key parsed from a mapping is resolved to a typed value and then converted to a string before it is stored, and nothing checks whether that string was already used by an earlier entry, so a later entry silently replaces an earlier one.
- **Closed:** 2026-11-13

### Block and flow mappings stringify the same key by different rules

- **Classification:** Medium
- **Category:** Interpretation conflict, parser differential (CWE-436)
- **What it is:** Both mapping styles must turn a parsed key into a property name and they do it two different ways. The indentation style uses the shared key-stringifier. The bracket-and-brace style uses a plain string conversion instead. The same key therefore lands under different names depending only on which syntax the document used: a list key becomes `a,b` in one style and `["a","b"]` in the other, and an empty key becomes `null` in one and an empty name in the other.
- **Closed:** 2026-11-13

### Numeric scalars are coerced with no precision or range check

- **Classification:** Medium
- **Category:** Numeric truncation and precision loss (CWE-681)
- **What it is:** Any text shaped like a number is handed to the platform's integer and floating-point converters and the result is returned as-is, with no check that the value survived the conversion intact. A twenty-digit integer comes back rounded to a different number. A large hexadecimal value comes back as an approximation. A leading zero is dropped. An out-of-range exponent becomes infinity, and the document can also name infinity and not-a-number directly.
- **Closed:** 2026-11-13

### Explicit type tags are discarded, so values keep the type the parser guesses

- **Classification:** Medium
- **Category:** Interpretation conflict through ignored type declarations, parser differential (CWE-436, CWE-1287)
- **What it is:** A YAML document can state a value's type outright with a tag such as `!!str`, `!!bool`, `!!int`, or `!!null`. The parser reads past every tag and throws it away without telling anyone, then decides the type from the bare text alone, exactly as if the tag had never been written. Tags it does not recognise, including application-specific ones like `!custom`, are dropped the same way instead of being refused.
- **Closed:** 2026-11-13

### Comments and directives ignore bare CR line breaks

- **Classification:** Medium
- **Category:** Interpretation conflict between parsers (CWE-436)
- **What it is:** YAML ends a line with a line feed (LF), a carriage return followed by a line feed (CRLF), or a bare carriage return (CR). The parser honors all three everywhere except in comments and directive lines, which end only at a line feed. In a document written with bare CR line breaks, everything after the first comment or directive becomes part of it, and the parser returns what came before as if it were the whole document.
- **Closed:** 2026-11-14

### Plain scalars that start with an indicator

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** YAML reserves some characters as indicators: `@` and `` ` `` are held for future use, `%` starts directives, and `,`, `]`, and `}` structure flow collections. An unquoted value must not start with any of them, nor with `-`, `?`, or `:` unless a character that can continue the value follows. This parser accepts such values as text anyway, in mapping keys and values, list entries, explicit keys, and flow collections: `key: @foo`, `key: ]x`, `key: %x`, `[@x]`, and `[-]` all parse, and `key: - a` reads as the text `- a`, where conformant parsers reject the document.
- **Closed:** 2026-11-14

### Directive lines outside their place

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** Directives are `%` lines, such as `%YAML 1.2` or `%TAG`, that belong at the start of a line before a document, and the document after them must open with `---`. This parser accepts directives with no `---` after them (`%YAML 1.2` followed directly by `foo: 1`) and directives with no document at all. It never reads a `%YAML` directive, so an extra word, a comment with no space before it, or a second `%YAML` line for the same document all pass. Before the first document, it also silently skips an indented line that starts with `%` as if it were a directive, dropping whatever it held.
- **Closed:** 2026-11-14

### Comments that touch the preceding token

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** A `#` starts a comment only when a space, a tab, or the start of a line comes right before it. After a closing quote, a closing bracket or brace, or a comma inside a flow collection, this parser starts a comment at a `#` that touches the token, so `key: "value"# note`, `[ a, b ]#note`, and `[ a,#note` / `]` all parse with the text after the `#` dropped, where conformant parsers reject the document.
- **Closed:** 2026-11-14

### Anchor names and anchors on aliases

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** An anchor name may contain `:`, so `key: &an:chor value` labels `value` with the anchor `an:chor`. This parser ends the name at the first `:` and reads the rest as the value, returning `:chor value`. It also accepts an anchor placed on an alias, such as `&b *a`, which YAML forbids, and registers the new name for the aliased value.
- **Closed:** 2026-11-14

### Single-pair mappings in flow collections

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** Inside a flow sequence, an entry can be a mapping with a single pair, written implicitly as `[ foo: bar ]` or explicitly as `[ ? foo : bar ]`. This parser does not recognize the explicit `?` there, so `[ ? foo : bar ]` gives the key `? foo` instead of `foo`. It also accepts an implicit pair where YAML does not allow one, as the value of a flow mapping entry, so a missing comma such as `{ role: user` / `  admin: true }` parses as `{role: {"user admin": true}}` instead of failing.
- **Closed:** 2026-11-14

### Line folding in quoted scalars

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** When a quoted scalar spans lines, YAML drops the spaces and tabs at the end of each line before folding the line break into a space, and in a block collection each continuation line must be indented past its parent with spaces. This parser keeps the trailing whitespace, so `"folded ` / `to a space"` gives `folded  to a space` with two spaces, and it accepts continuation lines at any indentation, including none and a tab, as in `quoted: "a` / `b` / `c"`.
- **Closed:** 2026-11-14

### Block scalar indentation and folding

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** Literal (`|`) and folded (`>`) block scalars come back with different text than YAML specifies in several cases. A line holding only spaces loses the spaces beyond the block's indentation, a folded scalar adds or drops line breaks around more-indented and blank lines, and a keep (`+`) scalar can gain or lose trailing line breaks. Leading blank lines indented deeper than the first content line, and a tab where the block's indentation is expected, are accepted where YAML requires an error.
- **Closed:** 2026-11-14

### Tabs after block indicators

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** YAML lets a tab separate a block indicator from what follows, so a `-` followed by a tab and a value is a list entry. This parser only treats `-`, `?`, and `:` as indicators when a space or a line break follows them, so `-`, a tab, and `-1` read as text instead of the list `[-1]`. It also accepts tabs where YAML forbids them as indentation, such as before a nested entry in `- ` followed by a tab and `-`.
- **Closed:** 2026-11-14

### Document start and end markers

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** A `...` line ends a document without starting a new one, so `...` alone is an empty stream and a comment between two `...` lines adds no document. This parser reads an empty document at each such marker, so `parseAll` returns an extra `null` that shifts the position of every document after it. It also accepts a block mapping or list that starts on the `---` line itself, as in `--- a: b`, which YAML forbids.
- **Closed:** 2026-11-14

### Anchor on an implicit key relabels its collection

- **Classification:** Medium
- **Category:** Parser differential (CWE-436)
- **What it is:** When a line starts with an anchor followed by a `key: value` pair, YAML 1.2 attaches the anchor to the key. This parser does that while it reads the mapping, then attaches the same anchor to the whole finished mapping. Aliases inside the mapping get the key, but aliases after it get the mapping. At the top level nothing follows, so the difference shows when the mapping is nested or is a list entry: for `outer:` / `  &a key: value` / `next: *a`, this parser returns `{key: value}` for `next`, where the specification and conformant parsers return the text `key`.
- **Closed:** 2026-11-14

### Implicit keys across lines or over 1,024 characters

- **Classification:** Medium
- **Category:** Parser differential through improper input validation (CWE-436, CWE-20)
- **What it is:** A mapping key written without the `?` indicator must fit on one line and be at most 1,024 characters long. This parser accepts a quoted key that spans several lines (`"multi` / ` line": value`), which conformant parsers reject, and a key of any length, which the specification forbids.
- **Closed:** 2026-11-14

### Release workflow runs tag-pinned actions with publish rights

- **Classification:** Critical
- **Category:** Release pipeline compromise through code from an untrusted control sphere (CWE-829, CWE-494)
- **What it is:** The workflow that publishes the package to **npm** runs on every push to the main branch and publishes whenever **Release Please** creates a release. Its job holds write access to the repository's contents and pull requests and the right to request an identity token. That identity token is the publish credential: no **npm** token is stored anywhere, and **npm** trusted publishing accepts the token **GitHub** issues to this workflow in place of one. It runs actions referenced by version tags such as `v3` and `v4`, which their owners can point at different code at any time, rather than by fixed commit hashes. One of them, **Release Please**, comes from a third party. The same job installs the dev dependencies, builds the package, and publishes it with provenance.
- **Closed:** 2026-11-14

### Merge keys read as an ordinary key

- **Classification:** Medium
- **Category:** Interpretation conflict with tools that apply merge keys, taught by documentation the parser contradicts (CWE-436, CWE-1068)
- **What it is:** Many YAML files use the older `<<: *defaults` convention to copy the entries of a shared block into another mapping. **yaml.min** does not apply it, which matches YAML 1.2: `<<` is stored as an ordinary key holding the shared block, and the mapping gains none of its entries. The project's own README teaches the convention anyway. Its "Anchors and Aliases" example builds `development` and `production` from `<<: *defaults` and never says the defaults stay nested under a key named `<<`. Parsing that exact example returns no `adapter` and no `host` for `production`.
- **Closed:** 2026-11-14
