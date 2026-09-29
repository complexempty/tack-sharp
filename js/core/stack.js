import { toObject, toSensor } from './distance.js';
import { cEff, effectiveK, magnification, reciprocal } from './optics.js';
import { solveRoot } from './solve.js';
import { stopsInRange } from './stops.js';

export const MAX_STACK_FRAMES = 99;
export const STACK_OVERLAP = 0.1;

const FAR_FOCUS = 1e12;

export function stackAperture({ limit, k, aberrationAt = () => 0, m = 0, apertureMin, apertureMax }) {
  const kAdjusted = effectiveK(k, m);
  let best;
  for (const stop of stopsInRange(apertureMin, apertureMax)) {
    const reach = stop.value * cEff(limit, stop.value, kAdjusted, aberrationAt(stop.value));
    if (!best || reach > best.reach) best = { stop, reach };
  }
  return best && best.reach > 0 ? best.stop : undefined;
}

export function stackPlan({
  near,
  far,
  focalLength,
  aperture,
  limit,
  k,
  aberrationAt = () => 0,
}) {
  const f = focalLength;
  const nearObject = toObject(near, f);
  const farObject = toObject(far, f);
  if (!Number.isFinite(nearObject)) return { ok: false, error: 'invalid-target' };

  const aberration = aberrationAt(aperture);

  const spreadAt = (focus) => {
    const kAdjusted = effectiveK(k, magnification(focus, f));
    const effective = cEff(limit, aperture, kAdjusted, aberration);
    if (effective <= 0) return 0;
    return ((1 - f / focus) * aperture * effective) / (f * f);
  };
  const invNearOf = (focus) => 1 / focus + spreadAt(focus);
  const invFarOf = (focus) => 1 / focus - spreadAt(focus);

  if (spreadAt(nearObject) <= 0) return { ok: false, error: 'no-sharp-zone' };

  const spreadAtInfinity = spreadAt(FAR_FOCUS);
  const invFarTarget = reciprocal(farObject);
  const epsilon = Math.max(invNearOf(nearObject) * 1e-12, Number.EPSILON);

  const frames = [];
  let front = 1 / nearObject;
  let truncated = false;

  while (frames.length < MAX_STACK_FRAMES) {
    if (front <= invFarTarget + epsilon) break;
    if (front <= spreadAtInfinity) {
      frames.push(Infinity);
      break;
    }
    const focus = solveRoot((candidate) => invNearOf(candidate) - front, f * (1 + 1e-9), FAR_FOCUS);
    if (!Number.isFinite(focus)) {
      truncated = true;
      break;
    }
    frames.push(focus);
    const back = invFarOf(focus);
    if (back <= invFarTarget + epsilon) break;
    const next = back + STACK_OVERLAP * (front - back);
    if (!(next < front)) {
      truncated = true;
      break;
    }
    front = next;
  }

  if (frames.length >= MAX_STACK_FRAMES && front > invFarTarget + epsilon) truncated = true;

  return {
    ok: true,
    truncated,
    aperture,
    frames: frames.map((focus) => toSensor(focus, f)),
    focusObjects: frames,
  };
}
