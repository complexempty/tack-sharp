import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findCamera } from '../../js/data/cameras.js';
import { tierLimit } from '../../js/data/tiers.js';
import { DIFFRACTION_K } from '../../js/core/optics.js';
import { FIELDS, isDegenerate, solveFree } from '../../js/core/freecalc.js';

const a7r6 = findCamera('a7r6');
const limit = tierLimit('critical', a7r6);
const options = { limit, k: DIFFRACTION_K };

const BASE = { focalLength: 50, aperture: 2 ** (15 / 6), focus: 3000 };

function baseline() {
  const solved = solveFree(['focalLength', 'aperture', 'focus'], { ...BASE, near: 0, far: 0 }, options);
  assert.equal(solved.ok, true);
  return solved.values;
}

function combinations() {
  const sets = [];
  for (let i = 0; i < FIELDS.length; i += 1) {
    for (let j = i + 1; j < FIELDS.length; j += 1) {
      for (let l = j + 1; l < FIELDS.length; l += 1) {
        sets.push([FIELDS[i], FIELDS[j], FIELDS[l]]);
      }
    }
  }
  return sets;
}

test('there are ten three-field sets and exactly one is degenerate', () => {
  const sets = combinations();
  assert.equal(sets.length, 10);
  assert.equal(sets.filter(isDegenerate).length, 1);
});

test('all nine valid lock combinations round trip', () => {
  const truth = baseline();
  for (const locked of combinations()) {
    if (isDegenerate(locked)) continue;
    const seeded = { focalLength: 0, aperture: 0, focus: 0, near: 0, far: 0 };
    for (const field of locked) seeded[field] = truth[field];
    const solved = solveFree(locked, seeded, options);
    assert.equal(solved.ok, true, `${locked.join('|')} failed: ${solved.error}`);
    for (const field of FIELDS) {
      const expected = truth[field];
      const actual = solved.values[field];
      const tolerance = Math.abs(expected) * 1e-6 + 1e-6;
      assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${locked.join('|')} ${field}: expected ${expected}, got ${actual}`,
      );
    }
  }
});

test('the degenerate lock set is refused', () => {
  const solved = solveFree(['focus', 'near', 'far'], { ...BASE, near: 2000, far: 5000 }, options);
  assert.equal(solved.ok, false);
  assert.equal(solved.error, 'degenerate');
});

test('focusing for an infinite far limit lands on the hyperfocal distance', () => {
  const solved = solveFree(
    ['aperture', 'focalLength', 'far'],
    { focalLength: 24, aperture: 8, focus: 0, near: 0, far: Infinity },
    options,
  );
  assert.equal(solved.ok, true);
  assert.ok(Math.abs(solved.values.focus / 1000 - 5.587) < 0.002, `focus ${solved.values.focus}`);
  assert.ok(Math.abs(solved.values.near / 1000 - 2.806) < 0.002, `near ${solved.values.near}`);
});

test('a near limit closer than the focus is refused', () => {
  const solved = solveFree(
    ['focalLength', 'focus', 'near'],
    { focalLength: 50, aperture: 8, focus: 3000, near: 4000, far: 0 },
    options,
  );
  assert.equal(solved.ok, false);
  assert.equal(solved.error, 'near-not-closer');
});

test('a depth no aperture can hold is reported', () => {
  const solved = solveFree(
    ['aperture', 'far', 'near'],
    { focalLength: 0, aperture: 8, focus: 0, near: 500, far: Infinity },
    { limit: tierLimit('pixel', a7r6), k: DIFFRACTION_K },
  );
  assert.equal(solved.ok, false);
});

test('solved aperture takes the wider root', () => {
  const truth = baseline();
  const solved = solveFree(
    ['focalLength', 'focus', 'near'],
    { focalLength: truth.focalLength, aperture: 0, focus: truth.focus, near: truth.near, far: 0 },
    options,
  );
  assert.equal(solved.ok, true);
  const peak = Math.sqrt(limit * limit) / (DIFFRACTION_K * Math.SQRT2);
  assert.ok(solved.values.aperture < peak, 'wider than the peak aperture');
});
