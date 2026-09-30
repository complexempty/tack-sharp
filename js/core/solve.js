import { toObject, toSensor, minSensorDistance } from './distance.js';
import {
  DIFFRACTION_K,
  apertureWindow,
  bestFocus,
  cEff,
  depthOfField,
  edgeBlur,
  effectiveK,
  hyperfocal,
  magnification,
  sharpestAperture,
  sharpestBlur,
  worstEdge,
} from './optics.js';
import { stopsInRange } from './stops.js';

export const MARGINAL_BAND = 0.1;
export const MIN_FOCAL_LENGTH = 8;
export const MAX_FOCAL_LENGTH = 1000;

export function solveRoot(fn, low, high, iterations = 90) {
  let a = low;
  let b = high;
  let fa = fn(a);
  if (fa === 0) return a;
  const fb = fn(b);
  if (fb === 0) return b;
  if (fa > 0 === fb > 0) return NaN;
  for (let i = 0; i < iterations; i += 1) {
    const mid = (a + b) / 2;
    const fm = fn(mid);
    if (fm === 0) return mid;
    if (fm > 0 === fa > 0) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

export function largestPassing(works, low, high, iterations = 70) {
  if (!works(low)) return NaN;
  if (works(high)) return high;
  let a = low;
  let b = high;
  for (let i = 0; i < iterations; i += 1) {
    const mid = (a + b) / 2;
    if (works(mid)) a = mid;
    else b = mid;
  }
  return a;
}

export function smallestPassing(works, low, high, iterations = 70) {
  if (works(low)) return low;
  if (!works(high)) return NaN;
  let a = low;
  let b = high;
  for (let i = 0; i < iterations; i += 1) {
    const mid = (a + b) / 2;
    if (works(mid)) b = mid;
    else a = mid;
  }
  return b;
}

function constantAberration(value = 0) {
  const fn = () => value;
  fn.constantValue = value;
  return fn;
}

export function makeScene(options) {
  const {
    near,
    far,
    focalLength,
    aperture,
    limit,
    diffraction = true,
    aberrationAt = constantAberration(0),
    focus,
    apertureMin,
    apertureMax,
    minFocusDistance = 0,
  } = options;
  return {
    near,
    far,
    focalLength,
    aperture,
    limit,
    k: diffraction ? DIFFRACTION_K : 0,
    aberrationAt,
    focus,
    apertureMin,
    apertureMax,
    minFocusDistance,
  };
}

export function evaluate(scene) {
  const f = scene.focalLength;
  const limit = scene.limit;

  if (!Number.isFinite(scene.near) || scene.near <= 0) {
    return { ok: false, error: 'invalid-target' };
  }
  if (scene.near < minSensorDistance(f)) {
    return {
      ok: false,
      error: 'too-close',
      minimumDistance: minSensorDistance(f),
    };
  }
  if (scene.focus !== undefined && scene.focus < minSensorDistance(f)) {
    return { ok: false, error: 'focus-too-close', minimumDistance: minSensorDistance(f) };
  }

  const nearObject = toObject(scene.near, f);
  const farObject = toObject(scene.far, f);
  const focusObject =
    scene.focus === undefined ? bestFocus(nearObject, farObject) : toObject(scene.focus, f);

  if (!Number.isFinite(focusObject) && scene.focus !== undefined) {
    return { ok: false, error: 'invalid-focus' };
  }

  const focusSensor = toSensor(focusObject, f);
  if (scene.minFocusDistance > 0 && focusSensor < scene.minFocusDistance) {
    return {
      ok: false,
      error: 'inside-minimum-focus',
      minimumDistance: scene.minFocusDistance,
      focusSensor,
    };
  }

  const m = magnification(focusObject, f);
  const kEff = effectiveK(scene.k, m);
  const edge = worstEdge(nearObject, farObject, focusObject, f);

  const aberrationFn = scene.aberrationAt;
  const blurAt = (aperture) => edgeBlur(edge.a, aperture, kEff, aberrationFn(aperture));

  const floorAberration = aberrationFn(scene.aperture);
  if (floorAberration >= limit) {
    return { ok: false, error: 'lens-over-limit', aberration: floorAberration, limit };
  }

  const stops = stopsInRange(scene.apertureMin, scene.apertureMax);
  const scanned = stops.map((stop) => ({ stop, blur: blurAt(stop.value) }));
  const working = scanned.filter((entry) => entry.blur <= limit);
  const sharpestScanned = scanned.reduce(
    (best, entry) => (entry.blur < best.blur ? entry : best),
    scanned[0],
  );

  const constant = aberrationFn.constantValue;
  const window =
    constant === undefined ? undefined : apertureWindow(edge.a, limit, kEff, constant);
  const continuousSharpest =
    constant === undefined
      ? undefined
      : {
          aperture: sharpestAperture(edge.a, effectiveK(scene.k, m)),
          blur: sharpestBlur(edge.a, kEff),
        };

  const aberration = aberrationFn(scene.aperture);
  const effectiveLimit = cEff(limit, scene.aperture, kEff, aberration);
  const field = depthOfField(focusObject, f, scene.aperture, effectiveLimit);
  const blur = blurAt(scene.aperture);

  return {
    ok: true,
    focalLength: f,
    aperture: scene.aperture,
    limit,
    k: scene.k,
    kEff,
    magnification: m,
    aberration,
    nearObject,
    farObject,
    focusObject,
    focusSensor,
    nearTarget: scene.near,
    farTarget: scene.far,
    edge,
    blurAt,
    blur,
    state: verdictState(blur, limit),
    cEff: effectiveLimit,
    noSharpZone: effectiveLimit <= 0,
    depthNear: toSensor(field.near, f),
    depthFar: toSensor(field.far, f),
    depthOfField: field,
    hyperfocalSensor: toSensor(
      hyperfocal({ focalLength: f, aperture: scene.aperture, limit, k: scene.k, aberration }),
      f,
    ),
    window,
    continuousSharpest,
    workingStops: working.map((entry) => entry.stop),
    scannedStops: scanned,
    sharpest: { aperture: sharpestScanned.stop.value, blur: sharpestScanned.blur, stop: sharpestScanned.stop },
  };
}

export function verdictState(blur, limit) {
  if (blur <= limit) return 'pass';
  return blur <= limit * (1 + MARGINAL_BAND) ? 'marginal' : 'fail';
}

export function solveAperture(scene, mode = 'widest') {
  const base = evaluate(scene);
  if (!base.ok) return base;
  if (mode === 'sharpest' || !base.workingStops.length) {
    return evaluate({ ...scene, aperture: base.sharpest.aperture });
  }
  return evaluate({ ...scene, aperture: base.workingStops[0].value });
}

export function solveFocalLength(sceneFor, bounds = {}) {
  const build = typeof sceneFor === 'function' ? sceneFor : (focalLength) => ({ ...sceneFor, focalLength });
  const low = Math.max(bounds.min || MIN_FOCAL_LENGTH, 1);
  const high = bounds.max || MAX_FOCAL_LENGTH;
  const works = (focalLength) => {
    const result = evaluate(build(focalLength));
    return result.ok && result.blur <= result.limit;
  };
  const exact = largestPassing(works, low, high);
  if (Number.isNaN(exact)) return { ok: false, error: 'no-focal-length', tried: { low, high } };
  const rounded = Math.max(low, Math.floor(exact));
  const chosen = works(rounded) ? rounded : Math.floor(exact * 1000) / 1000;
  return evaluate(build(chosen));
}

export function solveDistance(makeScene, bounds = {}) {
  const low = bounds.min || 1;
  const high = bounds.max || 5e6;
  const works = (distance) => {
    const result = evaluate(makeScene(distance));
    return result.ok && result.blur <= result.limit;
  };
  const exact = smallestPassing(works, low, high);
  if (Number.isNaN(exact)) return { ok: false, error: 'no-distance' };
  const rounded = Math.ceil(exact);
  const chosen = works(rounded) ? rounded : Math.ceil(exact * 1000) / 1000;
  const result = evaluate(makeScene(chosen));
  return { ...result, solvedDistance: chosen };
}
