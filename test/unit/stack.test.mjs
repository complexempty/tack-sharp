import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findCamera } from '../../js/data/cameras.js';
import { tierLimit } from '../../js/data/tiers.js';
import { DIFFRACTION_K } from '../../js/core/optics.js';
import { MAX_STACK_FRAMES, stackAperture, stackPlan } from '../../js/core/stack.js';

const a7r6 = findCamera('a7r6');

test('stack aperture maximises reach at negligible magnification', () => {
  const pixel = stackAperture({ limit: tierLimit('pixel', a7r6), k: DIFFRACTION_K, m: 0 });
  const critical = stackAperture({ limit: tierLimit('critical', a7r6), k: DIFFRACTION_K, m: 0 });
  assert.equal(pixel.label, '5.6');
  assert.equal(critical.label, '11');
});

test('stack aperture falls back when diffraction alone exceeds the limit', () => {
  const impossible = stackAperture({ limit: 0.0001, k: DIFFRACTION_K, m: 0 });
  assert.equal(impossible, undefined);
});

test('a 24 mm landscape from 2 m to infinity stacks in a handful of frames', () => {
  const limit = tierLimit('critical', a7r6);
  const aperture = stackAperture({ limit, k: DIFFRACTION_K, m: 0 }).value;
  const plan = stackPlan({ near: 2000, far: Infinity, focalLength: 24, aperture, limit, k: DIFFRACTION_K });
  assert.equal(plan.ok, true);
  assert.equal(plan.truncated, false);
  assert.ok(plan.frames.length >= 2 && plan.frames.length <= 8, `frames ${plan.frames.length}`);
  assert.equal(plan.frames[plan.frames.length - 1], Infinity);
  for (let i = 1; i < plan.frames.length; i += 1) {
    assert.ok(plan.frames[i] > plan.frames[i - 1], 'frames run from nearest to farthest');
  }
  assert.ok(plan.frames[0] > 2000, 'the first frame focuses past the near target');
});

test('a finite range stacks and never exceeds the frame cap', () => {
  const limit = tierLimit('pixel', a7r6);
  const aperture = stackAperture({ limit, k: DIFFRACTION_K, m: 0 }).value;
  const plan = stackPlan({ near: 3000, far: 9000, focalLength: 100, aperture, limit, k: DIFFRACTION_K });
  assert.equal(plan.ok, true);
  assert.ok(plan.frames.length > 1);
  assert.ok(plan.frames.length <= MAX_STACK_FRAMES);
  assert.ok(plan.frames.every(Number.isFinite));
});

test('a depth already covered by one frame needs one frame', () => {
  const limit = tierLimit('standard', a7r6);
  const plan = stackPlan({ near: 4900, far: 5100, focalLength: 50, aperture: 8, limit, k: DIFFRACTION_K });
  assert.equal(plan.ok, true);
  assert.equal(plan.frames.length, 1);
});

test('no sharp zone is reported rather than looping', () => {
  const plan = stackPlan({
    near: 2000,
    far: Infinity,
    focalLength: 24,
    aperture: 22,
    limit: tierLimit('pixel', a7r6),
    k: DIFFRACTION_K,
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'no-sharp-zone');
});
