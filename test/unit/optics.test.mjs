import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findCamera, pixelPitch, sensorDiagonal } from '../../js/data/cameras.js';
import { tierLimit } from '../../js/data/tiers.js';
import { minSensorDistance, toObject, toSensor } from '../../js/core/distance.js';
import { DIFFRACTION_K, hyperfocal, depthOfField, cEff, effectiveK, magnification } from '../../js/core/optics.js';
import { evaluate, makeScene } from '../../js/core/solve.js';
import { carDepth } from '../../js/core/subjects.js';
import { stopLabel } from '../../js/core/stops.js';

const a7r6 = findCamera('a7r6');
const microns = (mm) => mm * 1000;

function close(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message || ''} expected ${expected}, got ${actual} (tolerance ${tolerance})`,
  );
}

test('a7R VI sensor geometry', () => {
  close(microns(pixelPitch(a7r6)), 3.6008, 0.0002, 'pixel pitch');
  close(sensorDiagonal(a7r6), 43.1835, 0.0005, 'diagonal');
});

test('blur limit tiers on the a7R VI', () => {
  close(microns(tierLimit('pixel', a7r6)), 7.2015, 0.0005, 'pixel-level');
  close(microns(tierLimit('critical', a7r6)), 14.97, 0.005, 'critical');
  close(microns(tierLimit('standard', a7r6)), 29.94, 0.005, 'standard');
  close(microns(tierLimit('custom', a7r6, 22.5)), 22.5, 1e-9, 'custom');
});

test('diffraction constant matches 1.68 lambda at 550 nm', () => {
  close(DIFFRACTION_K, 0.000924, 1e-12);
});

test('sensor-plane distances round trip through object space', () => {
  for (const focalLength of [24, 50, 85, 200, 600]) {
    for (const sensorDistance of [4 * focalLength, 1000, 2000, 7000, 50000]) {
      if (sensorDistance < minSensorDistance(focalLength)) continue;
      const object = toObject(sensorDistance, focalLength);
      close(toSensor(object, focalLength), sensorDistance, sensorDistance * 1e-9, `${focalLength}mm`);
    }
  }
  assert.equal(toObject(Infinity, 50), Infinity);
  assert.equal(toSensor(Infinity, 50), Infinity);
});

test('minimum sensor distance is four focal lengths', () => {
  close(minSensorDistance(24), 96, 1e-9);
  close(minSensorDistance(85), 340, 1e-9);
  close(minSensorDistance(200), 800, 1e-9);
  assert.ok(Number.isNaN(toObject(300, 85)));
});

test('car depth uses the rotated bounding box', () => {
  close(carDepth(4900, 1900, 0), 4900, 1e-9);
  close(carDepth(4900, 1900, 90), 1900, 1e-9);
  close(carDepth(4900, 1900, 40), 4900 * Math.cos(Math.PI / 4.5) + 1900 * Math.sin(Math.PI / 4.5), 1e-9);
});

function portrait({ distance = 2000, front = 30, back = 90, focalLength = 85, tier = 'critical' }) {
  return makeScene({
    near: distance - front,
    far: distance + back,
    focalLength,
    aperture: 8,
    limit: tierLimit(tier, a7r6),
  });
}

function widestLabel(result) {
  return result.workingStops.length ? `f/${result.workingStops[0].label}` : 'none';
}

test('85 mm portrait, nose to ears, Critical is out of reach', () => {
  const result = evaluate(portrait({}));
  assert.equal(result.ok, true);
  assert.equal(widestLabel(result), 'none');
  close(microns(result.sharpest.blur), 15.28, 0.01, 'best blur');
  assert.equal(stopLabel(result.sharpest.aperture), '11');
  assert.equal(result.window.feasible, false);
});

test('85 mm portrait, nose to ears, Standard works from f/4.5', () => {
  const result = evaluate(portrait({ tier: 'standard' }));
  assert.equal(widestLabel(result), 'f/4.5');
  close(microns(result.sharpest.blur), 15.28, 0.01);
});

test('85 mm portrait, both eyes, Critical works from f/2.2', () => {
  const result = evaluate(portrait({ front: 15, back: 15 }));
  assert.equal(widestLabel(result), 'f/2.2');
  close(microns(result.sharpest.blur), 7.76, 0.01);
  assert.equal(stopLabel(result.sharpest.aperture), '5.6');
  assert.equal(result.window.feasible, true);
});

test('85 mm portrait, head and shoulders, Critical is out of reach', () => {
  const result = evaluate(portrait({ front: 30, back: 200 }));
  assert.equal(widestLabel(result), 'none');
  close(microns(result.sharpest.blur), 20.62, 0.01);
  assert.equal(stopLabel(result.sharpest.aperture), '14');
});

test('24 mm landscape from 2 m to infinity needs stacking at Critical', () => {
  const result = evaluate(
    makeScene({ near: 2000, far: Infinity, focalLength: 24, aperture: 8, limit: tierLimit('critical', a7r6) }),
  );
  assert.equal(widestLabel(result), 'none');
  close(microns(result.sharpest.blur), 16.52, 0.01);
  assert.equal(stopLabel(result.sharpest.aperture), '13');
  close(result.focusSensor, 3975.6, 0.2, 'best focus');
});

test('85 mm car at 7 m, three-quarter front, Critical is out of reach', () => {
  const depth = carDepth(4900, 1900, 40);
  const result = evaluate(
    makeScene({ near: 7000, far: 7000 + depth, focalLength: 85, aperture: 8, limit: tierLimit('critical', a7r6) }),
  );
  assert.equal(widestLabel(result), 'none');
  close(microns(result.sharpest.blur), 20.33, 0.01);
  assert.equal(stopLabel(result.sharpest.aperture), '16');
});

test('hyperfocal at 24 mm f/8 Critical', () => {
  const limit = tierLimit('critical', a7r6);
  const object = hyperfocal({ focalLength: 24, aperture: 8, limit, k: DIFFRACTION_K });
  close(toSensor(object, 24) / 1000, 5.587, 0.002, 'hyperfocal');
  const m = magnification(object, 24);
  const effective = cEff(limit, 8, effectiveK(DIFFRACTION_K, m));
  const field = depthOfField(object, 24, 8, effective);
  close(toSensor(field.near, 24) / 1000, 2.806, 0.002, 'near limit at hyperfocal');
  assert.equal(field.far, Infinity);
});

test('focus at the harmonic mean splits blur evenly between the edges', () => {
  const result = evaluate(portrait({}));
  const nearBlur = Math.abs(1 / result.nearObject - 1 / result.focusObject);
  const farBlur = Math.abs(1 / result.focusObject - 1 / result.farObject);
  close(nearBlur, farBlur, 1e-12);
});

test('a target closer than four focal lengths is rejected', () => {
  const result = evaluate(makeScene({ near: 300, far: 400, focalLength: 85, aperture: 8, limit: 0.015 }));
  assert.equal(result.ok, false);
  assert.equal(result.error, 'too-close');
  close(result.minimumDistance, 340, 1e-9);
});
