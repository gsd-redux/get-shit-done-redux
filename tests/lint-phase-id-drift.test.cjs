'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findNameValidityDrift,
  findBranchSlugFallbackDrift,
  findShellPhaseArithDrift,
} = require('../scripts/lint-phase-id-drift.cjs');

test('findNameValidityDrift flags a regex-literal re-derivation of the name-validity class', () => {
  const text = [
    'function isNameable(s) {',
    '  return /[\\p{L}\\p{N}]/u.test(s);',
    '}',
  ].join('\n');
  const found = findNameValidityDrift(text);
  assert.equal(found.length, 1);
  assert.equal(found[0].line, 2);
});

test('findNameValidityDrift flags the doubled-backslash template-string form', () => {
  const text = [
    'const re = new RegExp(\'[\\\\p{L}\\\\p{N}]\', "u");',
  ].join('\n');
  const found = findNameValidityDrift(text);
  assert.equal(found.length, 1);
});

test('findNameValidityDrift does NOT flag a line that calls hasNameableContent(', () => {
  const text = [
    'function wrapper(s) {',
    '  return hasNameableContent(s);',
    '}',
  ].join('\n');
  assert.deepEqual(findNameValidityDrift(text), []);
});

test('findNameValidityDrift does NOT flag a sanctioned site', () => {
  const text = [
    '// phase-id-owner: deliberate local copy for perf, tracked in #4634',
    'const re = /[\\p{L}\\p{N}]/u;',
  ].join('\n');
  assert.deepEqual(findNameValidityDrift(text), []);
});

test('findBranchSlugFallbackDrift flags the commands.cts/init.cts {slug}-fallback shape', () => {
  const text =
    "      .replace('{slug}', (phaseInfo['phase_slug'] as string) || 'phase');";
  const found = findBranchSlugFallbackDrift(text);
  assert.equal(found.length, 1);
  assert.equal(found[0].line, 1);
});

test('findBranchSlugFallbackDrift does NOT flag the milestone-branch || \'milestone\' fallback', () => {
  const text =
    "      .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone');";
  assert.deepEqual(findBranchSlugFallbackDrift(text), []);
});

test('findBranchSlugFallbackDrift does NOT flag a sanctioned site', () => {
  const text = [
    '// phase-id-owner: deliberate, tracked in #4634',
    "  .replace('{slug}', (phaseInfo['phase_slug'] as string) || 'phase');",
  ].join('\n');
  assert.deepEqual(findBranchSlugFallbackDrift(text), []);
});

test('findShellPhaseArithDrift flags $((10#...)) base-10-forced arithmetic', () => {
  const text = 'PHASE_N=$((10#$PHASE_NUM))';
  const found = findShellPhaseArithDrift(text);
  assert.equal(found.length, 1);
  assert.equal(found[0].line, 1);
});

test('findShellPhaseArithDrift does NOT flag ordinary arithmetic', () => {
  const text = 'NEXT=$((i+1))';
  assert.deepEqual(findShellPhaseArithDrift(text), []);
});

test('findShellPhaseArithDrift does NOT flag a site sanctioned with an HTML comment', () => {
  const text = [
    '<!-- phase-id-owner: deliberate, tracked in #4634 -->',
    'PHASE_N=$((10#$PHASE_NUM))',
  ].join('\n');
  assert.deepEqual(findShellPhaseArithDrift(text), []);
});

test('findShellPhaseArithDrift still flags a raw un-reduced phase variable (#4619 regression)', () => {
  const text = 'PHASE_N=$((10#$PHASE_NUMBER))';
  const found = findShellPhaseArithDrift(text);
  assert.equal(found.length, 1);
  assert.equal(found[0].line, 1);
});

test('findShellPhaseArithDrift does NOT flag arithmetic on an already-`_INT`-reduced phase variable', () => {
  const text = [
    'PHASE_INT=${PHASE_NUMBER%%.*}',
    'PHASE_N=$((10#$PHASE_INT))',
  ].join('\n');
  assert.deepEqual(findShellPhaseArithDrift(text), []);
});

test('findShellPhaseArithDrift does NOT flag arithmetic on a plan-id variable (never phase-carrying)', () => {
  const text = 'PLAN_N=$((10#${PLAN_ID}))';
  assert.deepEqual(findShellPhaseArithDrift(text), []);
});

test('findShellPhaseArithDrift skips a full-line comment merely mentioning the pattern as prose', () => {
  const text = '# Note: $((10#$PHASE_NUMBER)) is a hard shell syntax error on a decimal id.';
  assert.deepEqual(findShellPhaseArithDrift(text), []);
});
