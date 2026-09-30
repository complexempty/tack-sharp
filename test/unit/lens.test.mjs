import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SEEDED_PROFILES,
  aberrationFor,
  apertureCostOfZooming,
  clampFocalLength,
  isPrime,
  maxApertureAt,
  minApertureAt,
  minFocusAt,
  perfectLens,
  positionForRadius,
} from '../../js/lens/profiles.js';
import { bracketing, interpolateBreakpoints, interpolateInLogAperture } from '../../js/lens/interp.js';
import { computeView, lensFor, availableLenses } from '../../js/core/scene.js';
import { DEFAULT_STATE } from '../../js/state/store.js';
import { mergeDefaults } from '../../js/state/persist.js';
import { stopLabel } from '../../js/core/stops.js';

const [longZoom, standardZoom] = SEEDED_PROFILES;

function close(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message || ''} expected ${expected}, got ${actual}`);
}

test('frame zones split on normalised image height', () => {
  assert.equal(positionForRadius(0).id, 'center');
  assert.equal(positionForRadius(0.3).id, 'center');
  assert.equal(positionForRadius(0.31).id, 'edge');
  assert.equal(positionForRadius(0.8).id, 'edge');
  assert.equal(positionForRadius(0.81).id, 'corner');
  assert.equal(positionForRadius(1).id, 'corner');
});

test('breakpoints interpolate linearly and hold at the ends', () => {
  const points = [
    { focal: 24, value: 170 },
    { focal: 70, value: 340 },
  ];
  close(interpolateBreakpoints(points, 10), 170, 1e-9, 'below the range');
  close(interpolateBreakpoints(points, 24), 170, 1e-9);
  close(interpolateBreakpoints(points, 47), 255, 0.5);
  close(interpolateBreakpoints(points, 70), 340, 1e-9);
  close(interpolateBreakpoints(points, 200), 340, 1e-9, 'above the range');
});

test('aberration interpolates in log aperture and holds at the ends', () => {
  const curve = [
    { aperture: 2.8, aberration: 0.010 },
    { aperture: 5.6, aberration: 0.006 },
    { aperture: 11.2, aberration: 0.008 },
  ];
  close(interpolateInLogAperture(curve, 1.4), 0.010, 1e-12, 'wider than measured');
  close(interpolateInLogAperture(curve, 2.8), 0.010, 1e-12);
  close(interpolateInLogAperture(curve, 4), 0.008, 2e-4, 'halfway in log');
  close(interpolateInLogAperture(curve, 22), 0.008, 1e-12, 'smaller than measured');
});

test('bracketing picks the surrounding measured focal lengths', () => {
  assert.deepEqual(bracketing([24, 50, 70], 35), [24, 50]);
  assert.deepEqual(bracketing([24, 50, 70], 24), [24]);
  assert.deepEqual(bracketing([24, 50, 70], 10), [24]);
  assert.deepEqual(bracketing([24, 50, 70], 200), [70]);
});

test('the 200-600 loses maximum aperture as it zooms', () => {
  assert.equal(stopLabel(maxApertureAt(longZoom, 200)), '5.6');
  assert.equal(stopLabel(maxApertureAt(longZoom, 600)), '6.3');
  const cost = apertureCostOfZooming(longZoom, 200, 600);
  assert.ok(cost, 'a cost is reported');
  close(cost.stops, 1 / 3, 0.02, 'one third of a stop');
  assert.equal(apertureCostOfZooming(longZoom, 600, 200), undefined, 'zooming wider costs nothing');
});

test('the 24-70 keeps f/2.8 throughout but its closest focus moves', () => {
  assert.equal(stopLabel(maxApertureAt(standardZoom, 24)), '2.8');
  assert.equal(stopLabel(maxApertureAt(standardZoom, 70)), '2.8');
  assert.equal(apertureCostOfZooming(standardZoom, 24, 70), undefined);
  close(minFocusAt(standardZoom, 24), 170, 1e-9);
  close(minFocusAt(standardZoom, 70), 340, 1e-9);
  assert.equal(stopLabel(minApertureAt(standardZoom, 50)), '22');
});

test('seeded profiles are zooms clamped to their range and are not calibrated', () => {
  for (const profile of SEEDED_PROFILES) {
    assert.equal(isPrime(profile), false);
    assert.equal(profile.calibrated, false);
    assert.equal(clampFocalLength(profile, 1), profile.focal.min);
    assert.equal(clampFocalLength(profile, 5000), profile.focal.max);
  }
});

test('an uncalibrated lens reports a constant zero aberration', () => {
  const fn = aberrationFor(longZoom, 400, 'center');
  assert.equal(fn.constantValue, 0);
  assert.equal(fn(5.6), 0);
});

test('a calibrated zoom interpolates aberration across focal length', () => {
  const profile = {
    ...standardZoom,
    calibrated: true,
    measurements: [
      { focal: 24, aperture: 2.8, position: 'center', aberration: 0.008 },
      { focal: 24, aperture: 8, position: 'center', aberration: 0.004 },
      { focal: 70, aperture: 2.8, position: 'center', aberration: 0.012 },
      { focal: 70, aperture: 8, position: 'center', aberration: 0.006 },
      { focal: 24, aperture: 2.8, position: 'corner', aberration: 0.02 },
      { focal: 24, aperture: 8, position: 'corner', aberration: 0.009 },
    ],
  };
  const centre = aberrationFor(profile, 47, 'center');
  assert.equal(centre.constantValue, undefined, 'no longer constant, so the solver scans');
  close(centre(2.8), 0.010, 2e-4, 'halfway between 24 and 70 mm');
  close(centre(8), 0.005, 2e-4);

  const corner = aberrationFor(profile, 24, 'corner');
  close(corner(2.8), 0.02, 1e-12);
  assert.ok(corner(2.8) > centre(2.8), 'corners are softer than the centre');

  const missing = aberrationFor(profile, 70, 'edge');
  assert.equal(missing.constantValue, 0, 'an unmeasured position falls back to zero');
});

function stateWith(patch) {
  return mergeDefaults(DEFAULT_STATE, patch);
}

test('the perfect lens is the default and carries the manual aperture range', () => {
  const state = DEFAULT_STATE;
  const lens = lensFor(state);
  assert.equal(lens.perfect, true);
  assert.equal(availableLenses(state).length, 1 + SEEDED_PROFILES.length);
});

test('selecting a lens constrains the aperture range the solver scans', () => {
  const state = stateWith({
    lensId: longZoom.id,
    focalLength: 600,
    subject: 'range',
    solveFor: 'aperture',
    tierId: 'standard',
  });
  state.subjectState.range.distance = 30000;
  state.subjectState.range.depth = 2000;
  const view = computeView(state);
  assert.equal(view.result.ok, true);
  const widest = view.result.scannedStops[0];
  assert.equal(stopLabel(widest.stop.value), '6.3', 'never offers wider than the lens opens');
  const narrowest = view.result.scannedStops[view.result.scannedStops.length - 1];
  assert.ok(narrowest.stop.value <= 36.1, 'never offers smaller than the lens stops down');
});

test('a subject inside the lens minimum focus distance is refused', () => {
  const state = stateWith({ lensId: longZoom.id, focalLength: 200, subject: 'portrait', solveFor: 'check' });
  state.subjectState.portrait.distance = 1500;
  const view = computeView(state);
  assert.equal(view.result.ok, false);
  assert.equal(view.result.error, 'inside-minimum-focus');
  close(view.result.minimumDistance, 2400, 1e-9);
});

test('a calibrated lens raises the blur floor and moves the sharpest aperture', () => {
  const calibrated = {
    ...standardZoom,
    id: 'test-calibrated',
    calibrated: true,
    measurements: [
      { focal: 24, aperture: 2.8, position: 'center', aberration: 0.012 },
      { focal: 24, aperture: 5.6, position: 'center', aberration: 0.007 },
      { focal: 24, aperture: 11, position: 'center', aberration: 0.006 },
    ],
  };
  const base = stateWith({ focalLength: 24, subject: 'landscape', tierId: 'standard', solveFor: 'aperture' });
  const perfect = computeView(base);
  const withLens = computeView({ ...base, lenses: [calibrated], lensId: 'test-calibrated' });

  assert.equal(withLens.result.ok, true);
  assert.ok(withLens.result.aberration > 0, 'aberration is applied');
  assert.ok(
    withLens.result.sharpest.blur > perfect.result.sharpest.blur,
    'a real lens cannot beat a perfect one',
  );
  assert.equal(withLens.result.window, undefined, 'the closed form is skipped when aberration varies');
  assert.ok(withLens.result.scannedStops.length > 0);
});

test('a lens softer than the limit at every aperture is reported as the lens fault', () => {
  const soft = {
    ...standardZoom,
    id: 'test-soft',
    calibrated: true,
    measurements: [{ focal: 24, aperture: 2.8, position: 'center', aberration: 0.05 }],
  };
  const state = stateWith({
    focalLength: 24,
    subject: 'landscape',
    tierId: 'pixel',
    solveFor: 'check',
    lenses: [soft],
    lensId: 'test-soft',
  });
  const view = computeView(state);
  assert.equal(view.result.ok, false);
  assert.equal(view.result.error, 'lens-over-limit');
});

test('the perfect lens places no minimum focus distance in the way', () => {
  assert.equal(minFocusAt(perfectLens(), 85), 0);
});
