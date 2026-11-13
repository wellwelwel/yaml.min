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
