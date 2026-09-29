import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MARGINAL_BAND, verdictState } from '../../js/core/solve.js';
import { computeView } from '../../js/core/scene.js';
import { DEFAULT_STATE } from '../../js/state/store.js';
import { decode, encode, mergeDefaults } from '../../js/state/persist.js';

function stateWith(patch) {
  return mergeDefaults(DEFAULT_STATE, patch);
}

test('the marginal band is one sided', () => {
  const limit = 0.015;
  assert.equal(verdictState(limit * 0.5, limit), 'pass');
  assert.equal(verdictState(limit * 0.999, limit), 'pass');
  assert.equal(verdictState(limit, limit), 'pass');
  assert.equal(verdictState(limit * 1.02, limit), 'marginal');
  assert.equal(verdictState(limit * (1 + MARGINAL_BAND), limit), 'marginal');
  assert.equal(verdictState(limit * (1 + MARGINAL_BAND) * 1.001, limit), 'fail');
});

test('the default state is a borderline portrait, not a pass', () => {
  const view = computeView(DEFAULT_STATE);
  assert.equal(view.result.ok, true);
  assert.equal(view.state, 'marginal');
  assert.ok(view.ratio > 1 && view.ratio < 1.05, `ratio ${view.ratio}`);
  assert.equal(view.options.apertures, undefined);
  assert.ok(view.options.looserTier, 'a looser tier is offered');
});

test('every subject and tier combination resolves without throwing', () => {
  for (const subject of ['portrait', 'group', 'car', 'landscape', 'range']) {
    for (const tierId of ['pixel', 'critical', 'standard', 'custom']) {
      for (const solveFor of ['aperture', 'focalLength', 'distance', 'check']) {
        const view = computeView(stateWith({ subject, tierId, solveFor }));
        assert.ok(view, `${subject}/${tierId}/${solveFor}`);
        if (view.result.ok) {
          assert.ok(Number.isFinite(view.result.blur), `${subject}/${tierId}/${solveFor} blur`);
        } else {
          assert.ok(view.result.error, `${subject}/${tierId}/${solveFor} error code`);
        }
      }
    }
  }
});

test('only stackable subjects offer a focus stack', () => {
  for (const subject of ['portrait', 'group']) {
    const view = computeView(stateWith({ subject, tierId: 'pixel', solveFor: 'check' }));
    assert.equal(view.options && view.options.stack, undefined, subject);
  }
  const landscape = computeView(stateWith({ subject: 'landscape', tierId: 'pixel', solveFor: 'check' }));
  assert.ok(landscape.options.stack, 'landscape stacks');
  assert.ok(landscape.options.stack.frames.length > 1);
});

test('landscape and infinite ranges force the whole-scene view', () => {
  assert.equal(computeView(stateWith({ subject: 'landscape' })).forceWholeScene, true);
  assert.equal(computeView(stateWith({ subject: 'range' })).forceWholeScene, false);
  const infinite = stateWith({ subject: 'range' });
  infinite.subjectState.range.infinite = true;
  assert.equal(computeView(infinite).forceWholeScene, true);
});

test('focus wording names the anchor for each subject', () => {
  assert.match(computeView(stateWith({ subject: 'portrait' })).focusText, /the eyes$/);
  assert.match(computeView(stateWith({ subject: 'group' })).focusText, /behind the front row$/);
  assert.match(computeView(stateWith({ subject: 'car' })).focusText, /past the nearest point$/);
});

test('state survives a persistence round trip with infinity intact', () => {
  const state = stateWith({ subject: 'range' });
  state.subjectState.range.infinite = true;
  state.free.values.far = Infinity;
  const restored = decode(encode(state));
  assert.equal(restored.free.values.far, Infinity);
  assert.equal(restored.subjectState.range.infinite, true);
});

test('unknown stored keys are ignored and missing ones fall back', () => {
  const merged = mergeDefaults(DEFAULT_STATE, { units: 'm', nonsense: 42, subject: 'car' });
  assert.equal(merged.units, 'm');
  assert.equal(merged.subject, 'car');
  assert.equal(merged.nonsense, undefined);
  assert.equal(merged.tierId, DEFAULT_STATE.tierId);
});
