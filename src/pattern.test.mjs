import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepeat, parsePatternTotal, progressSections } from './pattern.js';

test('each repeat fills from its own output stitches, including partial sections', () => {
  assert.deepEqual(parseRepeat('[2 sc, inc] x 6'), { repeats: 6, stitchesPerRepeat: 4, total: 24 });
  assert.deepEqual(progressSections('[2 sc, inc] x 6', 24, 0), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(progressSections('[2 sc, inc] x 6', 24, 4), [1, 0, 0, 0, 0, 0]);
  assert.deepEqual(progressSections('[2 sc, inc] x 6', 24, 6), [1, 0.5, 0, 0, 0, 0]);
  assert.deepEqual(progressSections('[2 sc, inc] x 6', 24, 24), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(progressSections('[2 sc, inc] x 6', 24, 3), [0.75, 0, 0, 0, 0, 0]);
});

test('understands spacing, multiplication symbols, explicit totals, and decreases', () => {
  assert.equal(parsePatternTotal(' [ 2 SC, INC ] × 6 (24) '), 24);
  assert.equal(parsePatternTotal('[2 sc, dec] X 6'), 18);
  assert.equal(parsePatternTotal('[6 inc] x 1'), 12);
  assert.equal(parsePatternTotal('Work around (24)'), 24);
  assert.deepEqual(progressSections('[2 sc, inc] × 6 (24)', 24, 6), [1, 0.5, 0, 0, 0, 0]);
});

test('does not invent sections for unknown patterns or inconsistent targets', () => {
  for (const note of ['', 'sc around', '[bobble, inc] x 6', '[2 sc, inc] x 0', '[2 sc, inc] x 6 then 2 sc']) {
    assert.equal(parseRepeat(note), null);
    assert.deepEqual(progressSections(note, 24, 6), [0.25]);
  }
  assert.deepEqual(progressSections('[2 sc, inc] x 6', 30, 6), [0.2]);
  assert.deepEqual(progressSections('[2 sc, inc] x 6 (30)', 24, 6), [0.25]);
  assert.deepEqual(progressSections('[sc] x 100000', 100000, 50000), [0.5]);
  assert.equal(parseRepeat('[0 sc, inc] x 6'), null);
  assert.equal(parseRepeat('[sc] x 9999999999999999999'), null);
});
