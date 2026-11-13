/*!
 * Scenarios derived from the https://github.com/eemeli/yaml test suite:
 *   tests/doc/parse.ts, tests/doc/errors.ts,
 *   tests/doc/anchors.ts, tests/doc/types.ts, etc.
 */

import { describe, it } from 'poku';
import { assertParsesTo, read } from '../__helpers__/index.mts';

describe('Comments', () => {
  it('before content', () =>
    assertParsesTo(read('comments--comment-before.yaml'), { a: 1 }));

  it('inline', () =>
    assertParsesTo(read('comments--comment-inline.yaml'), { a: 1 }));

  it('between entries', () =>
    assertParsesTo(read('comments--comment-between.yaml'), { a: 1, b: 2 }));

  it('seq ending with trailing comment', () =>
    assertParsesTo(read('comments--seq-trailing-comment.yaml'), ['a', 'b']));

  it('map key with comment in value', () =>
    assertParsesTo(read('comments--map-key-comment.yaml'), { key: 'val' }));

  it('keeps only the text before the comment', () =>
    assertParsesTo(read('comments--plain-value-comment.yaml'), 'hello'));

  it('inline value with comment', () =>
    assertParsesTo(read('comments--inline-value-comment.yaml'), ['val']));

  it('explicit key with comment after key', () =>
    assertParsesTo(read('comments--explicit-key-comment.yaml'), {
      k: 'val',
    }));
});

describe('A comment after a tab', () => {
  it('inline comment after tab', () =>
    assertParsesTo(read('comments--inline-comment-after-tab.yaml'), {
      a: 1,
    }));

  it('sequence entry with a tab before its comment', () =>
    assertParsesTo(read('comments--plain-tab-comment.yaml'), ['val']));

  it('nested plain key with a tab before its comment', () =>
    assertParsesTo(read('comments--plain-key-tab-comment-nested.yaml'), {
      a: { k: 'val' },
    }));

  it('nested plain value with a tab before its comment', () =>
    assertParsesTo(read('comments--unquoted-tab-comment-nested.yaml'), {
      a: 'hello',
    }));

  it('explicit key with tab before comment in map key', () =>
    assertParsesTo(read('comments--explicit-key-tab-comment.yaml'), {
      key: 'val',
    }));
});
