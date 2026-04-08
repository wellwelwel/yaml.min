/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { createRequire } from 'node:module';
import { describe, it, strict } from 'poku';
import { parse, read } from '../__helpers__/index.mts';

const require = createRequire(import.meta.url);
const { parse: parseYaml } = require('../../src/index.ts');

describe('CRLF handling', () => {
  it('doc-start marker with CRLF', () =>
    strict.deepEqual(parseYaml('---\r\na: 1\r\n'), { a: 1 }));

  it('block scalar with CRLF', () =>
    strict.equal(parseYaml('|\r\n  hello\r\n  world\r\n'), 'hello\nworld\n'));
});

describe('Document edge cases', () => {
  it('only doc-start marker', () =>
    parse(read('edge-cases--doc-start-only.yaml'), null));

  it('only doc-start with trailing newline', () =>
    parse(read('edge-cases--doc-start-trailing-newline.yaml'), null));

  it('doc-end without content', () =>
    parse(read('edge-cases--doc-end-no-content.yaml'), null));
});

describe('Unclosed quoted strings', () => {
  it('unclosed single-quote', () =>
    parse(read('edge-cases--unclosed-single-quote.yaml'), 'hello'));

  it('unclosed double-quote', () =>
    parse(read('edge-cases--unclosed-double-quote.yaml'), 'hello'));
});

describe('Unknown escape sequences', () => {
  it('unknown escape is kept as-is', () =>
    parse(read('edge-cases--unknown-escape.yaml'), 'q'));

  it('multiple unknown escapes', () =>
    parse(read('edge-cases--unknown-escape-multiple.yaml'), 'qw'));
});

describe('Block scalar edge cases', () => {
  it('empty block with keep chomp |+', () =>
    parse(read('edge-cases--block-empty-keep.yaml'), '\n'));

  it('empty block with keep chomp >+', () =>
    parse(read('edge-cases--block-empty-keep-folded.yaml'), '\n'));

  it('block scalar with trailing empty lines and clip', () =>
    parse(read('edge-cases--block-trailing-empty-clip.yaml'), 'text\n'));

  it('block scalar with trailing empty lines and keep', () =>
    parse(read('edge-cases--block-trailing-empty-keep.yaml'), 'text\n\n\n'));

  it('block scalar with trailing empty lines and strip', () =>
    parse(read('edge-cases--block-trailing-empty-strip.yaml'), 'text'));

  it('block literal with more-indented lines', () =>
    parse(
      read('edge-cases--block-literal-more-indented.yaml'),
      'normal\n  indented\nback\n'
    ));

  it('block scalar with leading empty lines', () =>
    parse(read('edge-cases--block-leading-empty.yaml'), '\n\ntext\n'));

  it('block scalar with explicit indent indicator', () =>
    parse(read('edge-cases--block-explicit-indent.yaml'), 'text\n'));

  it('block scalar with comment after header', () =>
    parse(read('edge-cases--block-comment-after-header.yaml'), 'text\n'));
});

describe('Alias for nonexistent anchor', () => {
  it('returns undefined', () =>
    parse(read('edge-cases--alias-nonexistent.yaml'), undefined));
});

describe('Anchors in flow sequences', () => {
  it('anchor on flow seq item', () =>
    parse(read('edge-cases--anchor-flow-seq.yaml'), [1, 1]));

  it('anchor on flow seq string', () =>
    parse(read('edge-cases--anchor-flow-seq-string.yaml'), ['hello', 'hello']));
});

describe('Anchors in flow mappings', () => {
  it('anchor on flow map key', () =>
    parse(read('edge-cases--anchor-flow-map-key.yaml'), {
      foo: 1,
      bar: 'foo',
    }));
});

describe('Anchors in block sequences', () => {
  it('anchor on block seq item', () =>
    parse(read('edge-cases--anchor-block-seq.yaml'), [1, 1]));
});

describe('Anchors in block map keys', () => {
  it('anchor on block map key', () =>
    parse(read('edge-cases--anchor-block-map-key.yaml'), {
      mykey: 'val',
      other: 'mykey',
    }));
});

describe('Anchor on top-level value', () => {
  it('anchor on top-level scalar', () =>
    parse(read('edge-cases--anchor-top-scalar.yaml'), 'hello'));

  it('anchor on top-level flow seq', () =>
    parse(read('edge-cases--anchor-top-flow-seq.yaml'), [1, 2]));
});

describe('Flow map with special keys', () => {
  it('single-quoted key', () =>
    parse(read('edge-cases--flow-map-single-quoted-key.yaml'), {
      'a b': 1,
    }));

  it('double-quoted key', () =>
    parse(read('edge-cases--flow-map-double-quoted-key.yaml'), {
      'a b': 1,
    }));

  it('alias as flow map key value', () =>
    parse(read('edge-cases--flow-map-alias-value.yaml'), { a: 1, b: 1 }));
});

describe('Collection as map key', () => {
  it('flow seq as block map key', () => {
    const result = parseYaml(
      read('edge-cases--collection-as-map-key.yaml')
    ) as Record<string, unknown>;
    strict.equal(result['["a","b"]'], 'value');
  });
});

describe('Inline quoted values after seq indicator', () => {
  it('single-quoted inline', () =>
    parse(read('edge-cases--seq-single-quoted.yaml'), ['hello']));

  it('double-quoted inline', () =>
    parse(read('edge-cases--seq-double-quoted.yaml'), ['hello']));

  it('flow seq inline', () =>
    parse(read('edge-cases--seq-flow-seq-inline.yaml'), [[1, 2]]));

  it('flow map inline', () =>
    parse(read('edge-cases--seq-flow-map-inline.yaml'), [{ a: 1 }]));
});

describe('Inline nested seq with next-line values', () => {
  it('nested seq item with value on next line', () =>
    parse(read('edge-cases--inline-nested-seq.yaml'), [['a', 'b']]));
});

describe('Explicit keys advanced', () => {
  it('explicit key with no value', () =>
    parse(read('edge-cases--explicit-key-no-value.yaml'), { a: null }));

  it('explicit key with complex key', () =>
    parse(read('edge-cases--explicit-key-complex.yaml'), { a: 1 }));

  it('explicit key null key', () =>
    parse(read('edge-cases--explicit-key-null.yaml'), { '': 'value' }));
});

describe('Block seq ending at EOF', () => {
  it('seq without trailing newline', () =>
    parse(read('edge-cases--seq-no-trailing-newline.yaml'), ['a', 'b']));

  it('single item seq at EOF', () =>
    parse(read('edge-cases--seq-single-item-eof.yaml'), ['only']));
});

describe('Plain scalar with colon in flow', () => {
  it('colon not followed by space is part of value', () =>
    parse(read('edge-cases--plain-colon-no-space.yaml'), 'http://example.com'));

  it('colon in flow map value', () =>
    parse(read('edge-cases--flow-map-colon-value.yaml'), {
      url: 'http://x.com',
    }));
});

describe('Doc-end marker before content', () => {
  it('doc-end then content', () =>
    parse(read('edge-cases--doc-end-then-content.yaml'), 'hello'));

  it('doc-end then doc-start then content', () =>
    parse(read('edge-cases--doc-end-doc-start.yaml'), { a: 1 }));
});

describe('Block scalar header edge cases', () => {
  it('explicit indent and chomp combined', () =>
    parse(read('edge-cases--block-indent-chomp-combined.yaml'), 'text'));

  it('chomp and indent reversed', () =>
    parse(read('edge-cases--block-chomp-indent-reversed.yaml'), 'text'));
});

describe('Block scalar with CRLF in empty lines', () => {
  it('literal with CRLF empty lines', () =>
    strict.equal(parseYaml('|\r\n  a\r\n\r\n  b\r\n'), 'a\n\nb\n'));
});

describe('Explicit key with anchor', () => {
  it('anchor on explicit key', () =>
    parse(read('edge-cases--explicit-key-anchor.yaml'), {
      mykey: 'val',
      ref: 'mykey',
    }));

  it('explicit key with no value at end', () =>
    parse(read('edge-cases--explicit-key-no-value-end.yaml'), {
      lonely: null,
    }));
});

describe('Inline nested seq with next-line value', () => {
  it('inline seq items with next-line values', () =>
    parse(read('edge-cases--inline-seq-anchor.yaml'), [[1, 1]]));

  it('inline seq dash then newline with indented value', () =>
    parse(read('edge-cases--inline-seq-dash-newline.yaml'), [['val']]));
});

describe('Block scalar header with invalid char', () => {
  it('treats invalid header char as end of header', () =>
    parse(read('edge-cases--block-invalid-header-char.yaml'), ''));
});

describe('Plain scalar in flow context', () => {
  it('plain scalar value ending at comma in flow seq', () =>
    parse(read('edge-cases--flow-seq-plain-scalar.yaml'), [
      'hello world',
      'foo',
    ]));

  it('plain scalar value ending at bracket', () =>
    parse(read('edge-cases--flow-seq-plain-bracket.yaml'), ['value']));
});

describe('Block seq ending at EOF after comments', () => {
  it('seq ending with trailing comment', () =>
    parse(read('edge-cases--seq-trailing-comment.yaml'), ['a', 'b']));

  it('seq with no trailing newline', () =>
    parse(read('edge-cases--seq-no-trailing-newline-single.yaml'), ['x']));
});

describe('Explicit key edge cases', () => {
  it('explicit key then value', () =>
    parse(read('edge-cases--explicit-key-complex.yaml'), { a: 1 }));

  it('explicit key as last entry in document', () =>
    parse(read('edge-cases--explicit-key-last-entry.yaml'), {
      a: 1,
      b: null,
    }));

  it('explicit key at end of indented block', () =>
    parse(read('edge-cases--explicit-key-indented.yaml'), {
      outer: { inner: null },
    }));
});

describe('Newline CR only', () => {
  it('block map with bare CR', () =>
    strict.deepEqual(parseYaml('a: 1\rb: 2'), { a: 1, b: 2 }));
});

describe('Plain scalar colon in flow edge cases', () => {
  it('colon followed by tab in flow is part of scalar', () =>
    parse(read('edge-cases--flow-colon-tab.yaml'), ['a:\tb']));
});

describe('Inline seq dash-newline with indented value', () => {
  it('dash newline then indented map', () =>
    parse(read('edge-cases--dash-newline-map.yaml'), [[{ a: 1 }]]));

  it('dash newline with no indented continuation', () =>
    parse(read('edge-cases--dash-newline-no-continuation.yaml'), [
      [null],
      'b',
    ]));
});

describe('parseValue at EOF', () => {
  it('trailing whitespace only', () =>
    parse(read('edge-cases--trailing-whitespace.yaml'), null));

  it('value after key with only comments remaining', () =>
    parse(read('edge-cases--value-after-key-comment.yaml'), { a: null }));

  it('key at end with empty value', () =>
    parse(read('edge-cases--key-end-empty-value.yaml'), { a: 1, b: null }));
});

describe('Whitespace variant branches', () => {
  it('bare CR in block map value', () =>
    strict.deepEqual(parseYaml('a: 1\r\nb:\r\n  c: 2'), {
      a: 1,
      b: { c: 2 },
    }));

  it('colon-tab splits as key-value', () =>
    parse(read('edge-cases--colon-tab-splits.yaml'), { a: 'b', '': 'c' }));

  it('colon at end of line creates empty value', () =>
    parse(read('edge-cases--colon-end-of-line.yaml'), {
      a: 'b',
      '': null,
      b: 2,
    }));

  it('colon-CR creates empty value', () =>
    strict.deepEqual(parseYaml('a: b:\r\nb: 2'), {
      a: 'b',
      '': null,
      b: 2,
    }));

  it('seq item with CR line ending', () =>
    strict.deepEqual(parseYaml('- a\r\n- b'), ['a', 'b']));

  it('plain scalar stops at dash indicator', () =>
    parse(read('edge-cases--plain-stops-at-dash.yaml'), ['val', 'other']));

  it('plain scalar stops at colon with space', () =>
    parse(read('edge-cases--plain-stops-at-colon-space.yaml'), {
      key: 'val',
    }));

  it('plain scalar stops at question indicator', () =>
    parse(read('edge-cases--plain-stops-at-question.yaml'), { key: 'val' }));

  it('flow map key with no value before brace', () =>
    parse(read('edge-cases--flow-map-key-no-value.yaml'), {
      a: 1,
      b: null,
    }));

  it('inline seq item dash-newline value', () =>
    parse(read('edge-cases--inline-seq-dash-newline-value.yaml'), [
      ['x', 'y'],
    ]));

  it('seq items ending exactly at EOF', () =>
    parse(read('edge-cases--seq-items-eof.yaml'), [1, 2, 3]));

  it('explicit key alone at EOF', () =>
    parse(read('edge-cases--explicit-key-alone-eof.yaml'), { only: null }));

  it('quoted key with tab before colon', () =>
    parse(read('edge-cases--quoted-key-tab-colon.yaml'), { key: 'val' }));

  it('plain key colon at end of line', () =>
    parse(read('edge-cases--key-colon-newline-val.yaml'), { key: 'val' }));

  it('plain key colon-tab value', () =>
    parse(read('edge-cases--key-colon-tab-val.yaml'), { key: 'val' }));

  it('flow seq with CR between items', () =>
    strict.deepEqual(parseYaml('[a,\r\nb]'), ['a', 'b']));

  it('map value after CR newline', () =>
    strict.deepEqual(parseYaml('a:\r\n  b'), { a: 'b' }));

  it('multiline plain scalar stops at ? indicator', () =>
    parse(read('edge-cases--multiline-stops-at-question.yaml'), {
      key1: 'val1',
      key2: 'val2',
    }));

  it('inline comment after tab', () =>
    parse(read('edge-cases--inline-comment-after-tab.yaml'), { a: 1 }));

  it('plain scalar ending with colon at EOF', () =>
    parse(read('edge-cases--plain-ending-colon-eof.yaml'), {
      a: 'b',
      '': null,
    }));

  it('inline seq with two items same line', () =>
    parse(read('edge-cases--inline-seq-two-items.yaml'), [['a', 'b']]));

  it('inline seq item at EOF', () =>
    parse(read('edge-cases--inline-seq-item-eof.yaml'), [['end']]));

  it('explicit key with CRLF', () =>
    strict.deepEqual(parseYaml('? a\r\n: 1'), { a: 1 }));

  it('look-ahead key colon-CR', () =>
    strict.deepEqual(parseYaml('key:\r\n  val'), { key: 'val' }));

  it('seq dash-newline then map at deeper indent', () =>
    parse(read('edge-cases--seq-dash-newline-map.yaml'), [{ a: 1 }, { b: 2 }]));
});

describe('Branch coverage: doc-end at EOF', () => {
  it('doc-end then doc-start before content', () =>
    parse(read('edge-cases--branch-doc-end-start.yaml'), 'hello'));
});

describe('Branch coverage: block scalar empty line at EOF', () => {
  it('block scalar ending with empty line at EOF', () =>
    parse(read('edge-cases--block-scalar-empty-line-eof.yaml'), 'text\n'));
});

describe('Branch coverage: flow map special keys', () => {
  it('flow seq as flow map key', () =>
    parse(read('edge-cases--flow-map-seq-key.yaml'), { '1': 'val' }));

  it('flow map as flow map key', () => {
    const result = parseYaml(
      read('edge-cases--flow-map-map-key.yaml')
    ) as Record<string, unknown>;
    strict.equal(Object.values(result)[0], 'val');
  });

  it('alias as flow map key', () =>
    parse(read('edge-cases--flow-map-alias-key.yaml'), { foo: 2 }));
});

describe('Branch coverage: flow value colon variants', () => {
  it('key: , in flow seq', () =>
    parse(read('edge-cases--flow-key-comma.yaml'), [{ a: null }, 'b']));

  it('key: at end of flow seq', () =>
    parse(read('edge-cases--flow-key-end.yaml'), [{ a: 1 }]));
});

describe('Branch coverage: block seq indent mismatch', () => {
  it('seq items stop when indent increases', () =>
    parse(read('edge-cases--seq-indent-mismatch.yaml'), ['a']));
});

describe('Branch coverage: map key with comment', () => {
  it('map key with comment in value', () =>
    parse(read('edge-cases--map-key-comment.yaml'), { key: 'val' }));
});

describe('Branch coverage: block map indent mismatch', () => {
  it('map stops when indent changes', () =>
    parse(read('edge-cases--map-indent-mismatch.yaml'), { a: 1 }));
});

describe('Branch coverage: explicit key with anchor', () => {
  it('explicit key with anchor', () =>
    parse(read('edge-cases--branch-explicit-key-anchor.yaml'), {
      mykey: 'val',
    }));
});

describe('Branch coverage: explicit key colon newline', () => {
  it('explicit key with colon-newline value', () =>
    parse(read('edge-cases--explicit-key-colon-newline.yaml'), { a: 'val' }));
});

describe('Branch coverage: inline seq at EOF', () => {
  it('inline seq dash at very end', () =>
    parse(read('edge-cases--inline-seq-dash-eof.yaml'), [[null]]));
});

describe('Branch coverage: inline seq ni <= indent', () => {
  it('inline seq dash-newline no continuation', () =>
    parse(read('edge-cases--inline-seq-no-continuation.yaml'), [[null], 'x']));
});

describe('Branch coverage: inline value look-ahead', () => {
  it('inline value with comment', () =>
    parse(read('edge-cases--inline-value-comment.yaml'), ['val']));

  it('inline value with colon-tab', () =>
    parse(read('edge-cases--inline-value-colon-tab.yaml'), [{ a: 'b' }]));
});

describe('Branch coverage: top-level block scalar', () => {
  it('top-level literal block scalar', () =>
    parse(read('edge-cases--top-level-literal.yaml'), 'hello\n'));

  it('top-level folded block scalar', () =>
    parse(read('edge-cases--top-level-folded.yaml'), 'hello\n'));
});

describe('Branch coverage: ? with newline in parseValue', () => {
  it('? followed by newline', () =>
    parse(read('edge-cases--branch-question-newline.yaml'), { key: 'val' }));
});

describe('Branch coverage: look-ahead comment in plain key', () => {
  it('plain value with comment stops look-ahead', () =>
    parse(read('edge-cases--plain-value-comment.yaml'), 'hello'));
});

describe('Branch coverage: remaining partial branches', () => {
  it('explicit key with comment after key', () =>
    parse(read('edge-cases--explicit-key-comment.yaml'), { k: 'val' }));

  it('explicit key ? at very end of input', () =>
    parse(read('edge-cases--explicit-key-bare-question.yaml'), { '': null }));

  it('inline alias after seq dash', () =>
    parse(read('edge-cases--inline-alias-after-dash.yaml'), [10, [10]]));

  it('quoted key with colon at EOF', () =>
    parse(read('edge-cases--quoted-key-colon-eof.yaml'), { k: null }));
});

describe('Branch coverage: lookahead conditions', () => {
  it('plain scalar with tab before comment in parseValue', () =>
    parse(read('edge-cases--plain-tab-comment.yaml'), ['val']));

  it('quoted key with colon-tab in parseValue', () =>
    parse(read('edge-cases--quoted-key-colon-tab-nested.yaml'), {
      a: { k: 'val' },
    }));

  it('quoted key with colon-CR in parseValue', () =>
    strict.deepEqual(parseYaml('a:\n  "k":\r\n    val'), {
      a: { k: 'val' },
    }));

  it('explicit key ? with CR in parseValue', () =>
    strict.deepEqual(parseYaml('a:\n  ? k\r\n  : val'), {
      a: { k: 'val' },
    }));

  it('explicit key ? at EOF in parseValue', () =>
    parse(read('edge-cases--explicit-key-eof-nested.yaml'), {
      a: { '': null },
    }));

  it('plain key with tab before comment in parseValue lookahead', () =>
    parse(read('edge-cases--plain-key-tab-comment-nested.yaml'), {
      a: { k: 'val' },
    }));

  it('explicit key with bare CR in block map', () =>
    strict.deepEqual(parseYaml('? a\r: 1'), { a: 1 }));

  it('folded block scalar as seq inline value', () =>
    parse(read('edge-cases--folded-block-seq-inline.yaml'), ['hello world\n']));

  it('explicit key ? with CR in top-level parseValue', () =>
    strict.deepEqual(parseYaml('a:\n  ?\r\n  : val'), { a: { '': 'val' } }));

  it('unquoted key with tab before comment in parseValue', () =>
    parse(read('edge-cases--unquoted-tab-comment-nested.yaml'), {
      a: 'hello',
    }));

  it('doc-end marker at very end without newline', () =>
    parse(read('edge-cases--doc-end-no-content.yaml'), null));

  it('doc-end marker with trailing comment', () =>
    parse(read('edge-cases--doc-end-trailing-comment.yaml'), 'hello'));

  it('implicit key in flow seq colon then bracket', () =>
    parse(read('edge-cases--flow-implicit-key-bracket.yaml'), [{ a: null }]));

  it('implicit key in flow seq colon-comma', () =>
    parse(read('edge-cases--flow-implicit-key-comma.yaml'), [
      { a: null },
      'b',
    ]));

  it('implicit key in flow seq with colon at EOF', () =>
    parse(read('edge-cases--flow-implicit-key-eof.yaml'), [{ a: null }]));

  it('explicit key with tab before comment in map key', () =>
    parse(read('edge-cases--explicit-key-tab-comment.yaml'), { key: 'val' }));

  it('inline seq item with CRLF after dash', () =>
    strict.deepEqual(parseYaml('- -\r\n    val'), [['val']]));

  it('inline seq item with bare CR after dash', () =>
    strict.deepEqual(parseYaml('- -\r    val'), [['val']]));

  it('block seq dash followed by CRLF', () =>
    strict.deepEqual(parseYaml('-\r\n  a: 1'), [{ a: 1 }]));

  it('block scalar indent detection with CRLF', () =>
    strict.deepEqual(parseYaml('data: |\r\n  line1\r\n  line2'), {
      data: 'line1\nline2\n',
    }));

  it('block scalar CRLF blank line before content', () =>
    strict.deepEqual(parseYaml('data: |\r\n\r\n  line1'), {
      data: '\nline1\n',
    }));

  it('seq dash at EOF without value', () =>
    parse(read('edge-cases--seq-dash-eof.yaml'), [null]));

  it('top-level quoted string not a map key', () =>
    parse(read('edge-cases--top-level-quoted-string.yaml'), 'hello world'));

  it('question mark not followed by whitespace is plain scalar', () =>
    parse(read('edge-cases--question-no-whitespace.yaml'), '?abc'));

  it('single-quoted with colon not followed by whitespace', () =>
    parse(read('edge-cases--single-quoted-colon-no-ws.yaml'), 'key'));

  it('double-quoted with colon not followed by whitespace', () =>
    parse(read('edge-cases--double-quoted-colon-no-ws.yaml'), 'key'));

  it('quoted key as top-level map entry', () =>
    parse(read('edge-cases--quoted-key-top-level.yaml'), { name: 'John' }));

  it('quoted key in nested map via parseValue', () =>
    parse(read('edge-cases--quoted-key-nested-map.yaml'), {
      outer: { inner: 'val' },
    }));

  it('flow map as explicit block map key', () =>
    parse(read('edge-cases--flow-map-explicit-key.yaml'), {
      '{"a":1}': 'val',
    }));

  it('alias as block map key', () => {
    const result = parseYaml(
      read('edge-cases--alias-block-map-key.yaml')
    ) as Record<string, unknown>;
    strict.equal(result.mykey, 'other');
  });

  it('inline value with colon-like content but no map value', () =>
    parse(read('edge-cases--inline-colon-no-map.yaml'), ['a:b']));
});

describe('Input validation', () => {
  it('rejects null bytes', () =>
    strict.throws(
      () => parseYaml(read('edge-cases--input-null-byte.yaml')),
      SyntaxError
    ));

  it('rejects non-printable characters', () =>
    strict.throws(
      () => parseYaml(read('edge-cases--input-non-printable.yaml')),
      SyntaxError
    ));

  it('strips BOM from input', () =>
    parse(read('edge-cases--input-bom.yaml'), { a: 1 }));
});

describe('Maximum nesting depth', () => {
  it('rejects deeply nested structures', () => {
    const deep = '  '
      .repeat(1001)
      .split('  ')
      .map((_, i) => `${' '.repeat(i)}- `)
      .join('\n');
    strict.throws(() => parseYaml(deep), RangeError);
  });
});
