import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FADE_AT, SOFT_AT, WARN_AT, blurColor } from '../../js/diagram/palette.js';
import { axisTicks, RATIO_CEILING } from '../../js/diagram/curve.js';
import { carCorners, centreOf } from '../../js/diagram/silhouettes.js';
import { sceneMapping } from '../../js/diagram/wholescene.js';
import { subjectGeometry, planWindow } from '../../js/diagram/plan.js';
import { computeView } from '../../js/core/scene.js';
import { DEFAULT_STATE } from '../../js/state/store.js';
import { mergeDefaults } from '../../js/state/persist.js';

const palette = { sharp: [0, 255, 0], warn: [255, 255, 0], soft: [255, 0, 0] };

test('the blur ramp runs sharp, warn, soft, then fades', () => {
  assert.deepEqual(blurColor(0.5, palette), { colour: palette.sharp, alpha: 1 });
  assert.deepEqual(blurColor(1, palette), { colour: palette.sharp, alpha: 1 });
  assert.deepEqual(blurColor(WARN_AT, palette).colour, palette.warn);
  assert.deepEqual(blurColor(SOFT_AT, palette).colour, palette.soft);
  assert.equal(blurColor(SOFT_AT, palette).alpha, 1);
  assert.equal(blurColor(FADE_AT, palette).alpha, 0);
  assert.equal(blurColor(FADE_AT * 2, palette).alpha, 0);
  assert.equal(blurColor(Infinity, palette).alpha, 0);
});

test('the ramp is monotonic away from sharp', () => {
  let previousGreen = 255;
  for (let ratio = 1; ratio <= SOFT_AT; ratio += 0.05) {
    const green = blurColor(ratio, palette).colour[1];
    assert.ok(green <= previousGreen + 1, `green rose at ${ratio}`);
    previousGreen = green;
  }
});

function linearMap(low, high, rect) {
  return {
    x: (distance) => rect.x + ((distance - low) / (high - low)) * rect.w,
    toDistance: (px) => low + ((px - rect.x) / rect.w) * (high - low),
  };
}

test('a narrow plan window still gets several round ticks', () => {
  const rect = { x: 10, y: 0, w: 360, h: 80 };
  const ticks = axisTicks(linearMap(1950, 2150, rect), rect, 'm');
  assert.ok(ticks.length >= 3, `only ${ticks.length} ticks`);
  for (const tick of ticks) assert.ok(tick.px >= rect.x && tick.px <= rect.x + rect.w);
});

test('a compressed axis to infinity gets spread-out ticks', () => {
  const rect = { x: 10, y: 0, w: 360, h: 80 };
  const map = sceneMapping(rect, 4000, 96);
  const ticks = axisTicks(map, rect, 'm');
  assert.ok(ticks.length >= 4, `only ${ticks.length} ticks`);
  for (let i = 1; i < ticks.length; i += 1) {
    assert.ok(ticks[i].distance > ticks[i - 1].distance, 'ticks ascend');
    assert.ok(ticks[i].px - ticks[i - 1].px >= 40, 'ticks stay readable');
  }
});

test('the compressed axis starts at the nearest focusable distance and ends at infinity', () => {
  const rect = { x: 0, y: 0, w: 300, h: 80 };
  const map = sceneMapping(rect, 4000, 400);
  assert.ok(Math.abs(map.toDistance(map.left) - 400) < 1, `left is ${map.toDistance(map.left)}`);
  assert.equal(map.toDistance(map.right), Infinity);
  assert.equal(map.x(Infinity), map.right);
});

test('a rotated car keeps its nearest corner at the stated distance', () => {
  for (const angle of [0, 40, 90, 140, 180]) {
    const corners = carCorners(7000, 4900, 1900, angle);
    assert.ok(Math.abs(Math.min(...corners.map(([d]) => d)) - 7000) < 1e-9, `angle ${angle}`);
    assert.equal(corners.length, 4);
  }
  const square = carCorners(0, 4900, 1900, 0);
  assert.ok(Math.abs(centreOf(square)[1]) < 1e-9, 'centred laterally');
});

test('the plan window holds the whole subject at true scale', () => {
  for (const subject of ['portrait', 'group', 'car', 'range']) {
    const state = mergeDefaults(DEFAULT_STATE, { subject, solveFor: 'check' });
    const view = computeView(state);
    const rect = { x: 10, y: 10, w: 360, h: 150 };
    const geometry = subjectGeometry(view, state);
    const map = planWindow(geometry, view, rect);
    assert.ok(map.x(geometry.depth0) >= rect.x - 1, `${subject} near edge`);
    assert.ok(map.x(geometry.depth1) <= rect.x + rect.w + 1, `${subject} far edge`);
    const lateralPixels = Math.abs(map.y(geometry.halfWidth) - map.y(0));
    assert.ok(lateralPixels <= rect.h / 2 + 1, `${subject} lateral fits`);
    const scaleFromX = (map.x(1000) - map.x(0)) / 1000;
    const scaleFromY = (map.y(1000) - map.y(0)) / 1000;
    assert.ok(Math.abs(scaleFromX - scaleFromY) < 1e-9, `${subject} is true scale`);
  }
});

test('the curve ceiling is three times the limit', () => {
  assert.equal(RATIO_CEILING, 3);
});
