import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDistance,
  formatMagnitude,
  formatMicrons,
  formatOffset,
  parseDistance,
  stepFocalLength,
  stepDistance,
} from '../../js/core/units.js';
import { formatStop, parseStop, stepStop, stopLabel, STOPS } from '../../js/core/stops.js';

test('distance precision steps down as the number grows', () => {
  assert.equal(formatMagnitude(2.3456), '2.35');
  assert.equal(formatMagnitude(23.456), '23.5');
  assert.equal(formatMagnitude(234.56), '235');
});

test('short distances switch to inches or centimetres', () => {
  assert.equal(formatDistance(3000, 'm'), '3.00 m');
  assert.equal(formatDistance(900, 'm'), '90.0 cm');
  assert.equal(formatDistance(3000, 'ft'), '9.84 ft');
  assert.equal(formatDistance(500, 'ft'), '19.7 in');
  assert.equal(formatDistance(Infinity, 'm'), '∞');
});

test('small offsets always read in inches or centimetres', () => {
  assert.equal(formatOffset(30, 'm'), '3.00 cm');
  assert.equal(formatOffset(30, 'ft'), '1.18 in');
});

test('microns show one decimal', () => {
  assert.equal(formatMicrons(0.01497), '15.0 µm');
  assert.equal(formatMicrons(0.0072015), '7.2 µm');
});

test('typed distances accept units and infinity', () => {
  assert.equal(parseDistance('3', 'm'), 3000);
  assert.equal(parseDistance('3', 'ft'), 914.4000000000001);
  assert.equal(parseDistance('250cm', 'ft'), 2500);
  assert.equal(parseDistance('inf', 'm'), Infinity);
  assert.equal(parseDistance('∞', 'm'), Infinity);
  assert.equal(parseDistance('', 'm'), undefined);
});

test('aperture stops are exact third stops plus f/0.95', () => {
  assert.equal(STOPS.length, 32);
  assert.equal(STOPS[0].value, 0.95);
  assert.equal(STOPS[1].value, 1);
  assert.ok(Math.abs(STOPS[7].value - 2) < 1e-12);
  assert.ok(Math.abs(STOPS[19].value - 8) < 1e-12);
  assert.ok(Math.abs(STOPS[31].value - 32) < 1e-12);
  assert.equal(STOPS[31].label, '32');
});

test('aperture labels and parsing', () => {
  assert.equal(stopLabel(11.3137), '11');
  assert.equal(formatStop(5.65685), 'f/5.6');
  assert.equal(parseStop('f/5.6'), 5.6);
  assert.equal(parseStop('5.6'), 5.6);
  assert.equal(parseStop('F 8'), 8);
  assert.equal(parseStop('rubbish'), undefined);
});

test('stepping an aperture moves one third stop', () => {
  const up = stepStop(2 ** (18 / 6), 1);
  assert.equal(stopLabel(up), '9');
  const down = stepStop(2 ** (18 / 6), -1);
  assert.equal(stopLabel(down), '7.1');
});

test('stepping a focal length walks the common list', () => {
  assert.equal(stepFocalLength(85, 1), 90);
  assert.equal(stepFocalLength(85, -1), 75);
  assert.equal(stepFocalLength(8, -1), 8);
  assert.equal(stepFocalLength(1000, 1), 1000);
});

test('stepping a distance moves about three percent on round increments', () => {
  const up = stepDistance(2000, 1);
  assert.ok(up > 2000 && up <= 2200, `up ${up}`);
  assert.equal(up % 50, 0);
  const down = stepDistance(2000, -1);
  assert.ok(down < 2000 && down >= 1800, `down ${down}`);
});
