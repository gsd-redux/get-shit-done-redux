'use strict';

/**
 * filename-classification.test.cjs
 *
 * Unit tests for hooks/lib/filename-classification.js (does not exist yet —
 * #4580). Exports two pure, inert helpers used to classify `.env.<suffix>`
 * basenames without conflating "the whole tail after the first dot" with
 * "the final extension":
 *
 *   finalExtension(name) -> segment after the LAST dot; the whole string
 *                           when there is no dot; '' for empty/non-string.
 *   fullSuffix(name)     -> everything after the FIRST dot; '' when there
 *                           is no dot / empty / non-string.
 *
 * The two must disagree on multi-segment names (e.g. `local.example`) —
 * that disagreement is the entire reason the helper exists.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('./helpers/fast-check-setup.cjs');
const { finalExtension, fullSuffix } = require('../hooks/lib/filename-classification.js');

test('finalExtension: a dotless string is its own final extension', () => {
  assert.equal(finalExtension('example'), 'example');
});

test('finalExtension: single dot returns the segment after it', () => {
  assert.equal(finalExtension('local.example'), 'example');
});

test('finalExtension: multi-segment returns only the LAST segment', () => {
  assert.equal(finalExtension('a.b.c.d'), 'd');
});

test('finalExtension: empty string returns empty string', () => {
  assert.equal(finalExtension(''), '');
});

test('finalExtension: a trailing dot yields an empty final extension', () => {
  assert.equal(finalExtension('example.'), '');
});

test('finalExtension: a leading dot yields the segment after it', () => {
  assert.equal(finalExtension('.example'), 'example');
});

test('finalExtension: non-string / nullish inputs are inert, never throw', () => {
  assert.equal(finalExtension(null), '');
  assert.equal(finalExtension(undefined), '');
  assert.equal(finalExtension(42), '');
});

test('fullSuffix and finalExtension DIFFER on a multi-segment name — the reason this helper exists', () => {
  assert.equal(fullSuffix('local.example'), 'local.example');
  assert.equal(finalExtension('local.example'), 'example');
  assert.notEqual(fullSuffix('local.example'), finalExtension('local.example'));
});

test('fc: finalExtension never contains a dot and is always a suffix of the input', () => {
  fc.assert(
    fc.property(
      fc.string(),
      (s) => {
        const ext = finalExtension(s);
        assert.equal(ext.includes('.'), false);
        assert.equal(s.endsWith(ext), true);
      },
    ),
    { seed: 42, numRuns: 200 },
  );
});
