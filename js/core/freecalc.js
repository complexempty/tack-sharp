import { minSensorDistance, toObject, toSensor } from './distance.js';
import { cEff, effectiveK, magnification, reciprocal } from './optics.js';
import { solveRoot } from './solve.js';
import { NARROWEST_STOP, WIDEST_STOP } from './stops.js';

export const FIELDS = ['focalLength', 'aperture', 'focus', 'near', 'far'];
export const DEGENERATE_SET = ['focus', 'near', 'far'];

const FAR_FOCUS = 1e12;
const MIN_FOCAL = 4;
const MAX_FOCAL = 2000;

export function isDegenerate(locked) {
  return DEGENERATE_SET.every((field) => locked.includes(field));
}

function spreadFor(focusObject, focalLength, aperture, limit, k, aberration) {
  const kAdjusted = effectiveK(k, magnification(focusObject, focalLength));
  const effective = cEff(limit, aperture, kAdjusted, aberration);
  if (effective <= 0) return 0;
  return ((1 - focalLength / focusObject) * aperture * effective) / (focalLength * focalLength);
}

function apertureReach(aperture, focusObject, focalLength, limit, k, aberrationAt) {
  const kAdjusted = effectiveK(k, magnification(focusObject, focalLength));
  return aperture * cEff(limit, aperture, kAdjusted, aberrationAt(aperture));
}

function peakAperture(focusObject, focalLength, limit, k, aberrationAt) {
  const kAdjusted = effectiveK(k, magnification(focusObject, focalLength));
  if (kAdjusted <= 0) return NARROWEST_STOP;
  const constant = aberrationAt.constantValue;
  if (constant !== undefined) {
    const reduced = limit * limit - constant * constant;
    if (reduced <= 0) return NaN;
    return Math.sqrt(reduced) / (kAdjusted * Math.SQRT2);
  }
  let low = WIDEST_STOP;
  let high = NARROWEST_STOP;
  for (let i = 0; i < 80; i += 1) {
    const third = (high - low) / 3;
    const left = low + third;
    const right = high - third;
    const leftReach = apertureReach(left, focusObject, focalLength, limit, k, aberrationAt);
    const rightReach = apertureReach(right, focusObject, focalLength, limit, k, aberrationAt);
    if (leftReach < rightReach) low = left;
    else high = right;
  }
  return (low + high) / 2;
}

function apertureForSpread(spread, focusObject, focalLength, limit, k, aberrationAt) {
  const target = (spread * focalLength * focalLength) / (1 - focalLength / focusObject);
  const peak = peakAperture(focusObject, focalLength, limit, k, aberrationAt);
  if (!Number.isFinite(peak)) return NaN;
  const peakReach = apertureReach(peak, focusObject, focalLength, limit, k, aberrationAt);
  if (target > peakReach) return NaN;
  return solveRoot(
    (aperture) => apertureReach(aperture, focusObject, focalLength, limit, k, aberrationAt) - target,
    Math.min(WIDEST_STOP, peak) * 1e-3,
    peak,
  );
}

function focusForNear(nearObject, focalLength, aperture, limit, k, aberration) {
  const target = 1 / nearObject;
  const invNearOf = (focus) => 1 / focus + spreadFor(focus, focalLength, aperture, limit, k, aberration);
  if (invNearOf(FAR_FOCUS) >= target) return Infinity;
  return solveRoot((focus) => invNearOf(focus) - target, focalLength * (1 + 1e-9), FAR_FOCUS);
}

function focusForFar(farObject, focalLength, aperture, limit, k, aberration) {
  const target = reciprocal(farObject);
  const invFarOf = (focus) => 1 / focus - spreadFor(focus, focalLength, aperture, limit, k, aberration);
  if (invFarOf(FAR_FOCUS) >= target) return Infinity;
  return solveRoot((focus) => invFarOf(focus) - target, focalLength * (1 + 1e-9), FAR_FOCUS);
}

function limitsFromFocus(focusObject, focalLength, aperture, limit, k, aberration) {
  const spread = spreadFor(focusObject, focalLength, aperture, limit, k, aberration);
  const invFar = 1 / focusObject - spread;
  return {
    near: 1 / (1 / focusObject + spread),
    far: invFar > 0 ? 1 / invFar : Infinity,
    spread,
  };
}

function harmonicMean(near, far) {
  return 2 / (1 / near + reciprocal(far));
}

function focalByBisection(residual, ceiling) {
  const low = MIN_FOCAL;
  const high = Math.min(MAX_FOCAL, ceiling * 0.999);
  if (!(high > low)) return NaN;
  const atLow = residual(low);
  const atHigh = residual(high);
  if (!Number.isFinite(atLow) || !Number.isFinite(atHigh)) return NaN;
  if (atLow > 0 === atHigh > 0) return NaN;
  return solveRoot(residual, low, high);
}

function focalCeiling(...sensorDistances) {
  return Math.min(...sensorDistances.filter(Number.isFinite).map((distance) => distance / 4));
}

export function solveFree(locked, values, options) {
  const { limit, k, aberrationAt = () => 0 } = options;
  const key = [...locked].sort().join('|');
  const aberration = aberrationAt(values.aperture);

  if (isDegenerate(locked)) return { ok: false, error: 'degenerate' };

  const out = { ...values };

  const finish = () => {
    if (!Number.isFinite(out.focalLength) || out.focalLength <= 0) {
      return { ok: false, error: 'no-focal-length' };
    }
    if (!Number.isFinite(out.aperture) || out.aperture <= 0) {
      return { ok: false, error: 'no-aperture' };
    }
    for (const field of ['focus', 'near']) {
      if (!Number.isFinite(out[field]) || out[field] <= 0) return { ok: false, error: 'unreachable' };
    }
    if (out.near < minSensorDistance(out.focalLength)) {
      return { ok: false, error: 'too-close', minimumDistance: minSensorDistance(out.focalLength) };
    }
    if (out.near >= out.focus) return { ok: false, error: 'near-not-closer' };
    if (out.far <= out.focus) return { ok: false, error: 'far-not-farther' };
    return { ok: true, values: out };
  };

  if (key === 'aperture|focalLength|focus') {
    const focusObject = toObject(out.focus, out.focalLength);
    const limits = limitsFromFocus(focusObject, out.focalLength, out.aperture, limit, k, aberration);
    out.near = toSensor(limits.near, out.focalLength);
    out.far = toSensor(limits.far, out.focalLength);
    return finish();
  }

  if (key === 'aperture|focalLength|near') {
    const nearObject = toObject(out.near, out.focalLength);
    const focusObject = focusForNear(nearObject, out.focalLength, out.aperture, limit, k, aberration);
    if (!focusObject || Number.isNaN(focusObject)) return { ok: false, error: 'unreachable' };
    out.focus = toSensor(focusObject, out.focalLength);
    out.far = toSensor(
      limitsFromFocus(focusObject, out.focalLength, out.aperture, limit, k, aberration).far,
      out.focalLength,
    );
    return finish();
  }

  if (key === 'aperture|far|focalLength') {
    const farObject = toObject(out.far, out.focalLength);
    const focusObject = focusForFar(farObject, out.focalLength, out.aperture, limit, k, aberration);
    if (!focusObject || Number.isNaN(focusObject)) return { ok: false, error: 'unreachable' };
    out.focus = toSensor(focusObject, out.focalLength);
    out.near = toSensor(
      limitsFromFocus(focusObject, out.focalLength, out.aperture, limit, k, aberration).near,
      out.focalLength,
    );
    return finish();
  }

  if (key === 'focalLength|focus|near' || key === 'far|focalLength|focus') {
    const focusObject = toObject(out.focus, out.focalLength);
    const anchor = key === 'focalLength|focus|near' ? out.near : out.far;
    const anchorObject = toObject(anchor, out.focalLength);
    const spread =
      key === 'focalLength|focus|near'
        ? 1 / anchorObject - 1 / focusObject
        : 1 / focusObject - reciprocal(anchorObject);
    if (!(spread > 0)) {
      return { ok: false, error: key === 'focalLength|focus|near' ? 'near-not-closer' : 'far-not-farther' };
    }
    const aperture = apertureForSpread(spread, focusObject, out.focalLength, limit, k, aberrationAt);
    if (!Number.isFinite(aperture)) return { ok: false, error: 'no-aperture-holds' };
    out.aperture = aperture;
    const limits = limitsFromFocus(
      focusObject,
      out.focalLength,
      aperture,
      limit,
      k,
      aberrationAt(aperture),
    );
    out.near = toSensor(limits.near, out.focalLength);
    out.far = toSensor(limits.far, out.focalLength);
    return finish();
  }

  if (key === 'far|focalLength|near') {
    const nearObject = toObject(out.near, out.focalLength);
    const farObject = toObject(out.far, out.focalLength);
    const focusObject = harmonicMean(nearObject, farObject);
    const spread = 1 / nearObject - 1 / focusObject;
    if (!(spread > 0)) return { ok: false, error: 'near-not-closer' };
    const aperture = apertureForSpread(spread, focusObject, out.focalLength, limit, k, aberrationAt);
    if (!Number.isFinite(aperture)) return { ok: false, error: 'no-aperture-holds' };
    out.aperture = aperture;
    out.focus = toSensor(focusObject, out.focalLength);
    return finish();
  }

  if (key === 'aperture|focus|near' || key === 'aperture|far|focus') {
    const usingNear = key === 'aperture|focus|near';
    const residual = (focalLength) => {
      const focusObject = toObject(out.focus, focalLength);
      if (!Number.isFinite(focusObject)) return NaN;
      const limits = limitsFromFocus(focusObject, focalLength, out.aperture, limit, k, aberration);
      const anchorObject = toObject(usingNear ? out.near : out.far, focalLength);
      if (usingNear) return limits.near - anchorObject;
      return reciprocal(anchorObject) - reciprocal(limits.far);
    };
    const focalLength = focalByBisection(residual, focalCeiling(out.focus, usingNear ? out.near : Infinity));
    if (!Number.isFinite(focalLength)) return { ok: false, error: 'no-focal-length' };
    out.focalLength = focalLength;
    const focusObject = toObject(out.focus, focalLength);
    const limits = limitsFromFocus(focusObject, focalLength, out.aperture, limit, k, aberration);
    out.near = toSensor(limits.near, focalLength);
    out.far = toSensor(limits.far, focalLength);
    return finish();
  }

  if (key === 'aperture|far|near') {
    const residual = (focalLength) => {
      const nearObject = toObject(out.near, focalLength);
      const farObject = toObject(out.far, focalLength);
      if (!Number.isFinite(nearObject)) return NaN;
      const focusObject = harmonicMean(nearObject, farObject);
      const limits = limitsFromFocus(focusObject, focalLength, out.aperture, limit, k, aberration);
      return limits.near - nearObject;
    };
    const focalLength = focalByBisection(residual, focalCeiling(out.near));
    if (!Number.isFinite(focalLength)) return { ok: false, error: 'no-focal-length' };
    out.focalLength = focalLength;
    const nearObject = toObject(out.near, focalLength);
    const farObject = toObject(out.far, focalLength);
    out.focus = toSensor(harmonicMean(nearObject, farObject), focalLength);
    return finish();
  }

  return { ok: false, error: 'unsupported' };
}
