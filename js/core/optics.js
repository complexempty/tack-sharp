export const LAMBDA_MM = 0.00055;
export const DIFFRACTION_K = 1.68 * LAMBDA_MM;

export function reciprocal(distance) {
  return Number.isFinite(distance) ? 1 / distance : 0;
}

export function magnification(focus, focalLength) {
  return focalLength / (focus - focalLength);
}

export function effectiveK(k, m) {
  return k * (1 + m);
}

export function defocusBlur(objectDistance, focus, focalLength, aperture) {
  const spread = Math.abs(reciprocal(objectDistance) - 1 / focus);
  return (focalLength * focalLength * spread) / (aperture * (1 - focalLength / focus));
}

export function diffractionBlur(k, aperture, m) {
  return k * aperture * (1 + m);
}

export function totalBlur({ objectDistance, focus, focalLength, aperture, k, aberration = 0 }) {
  const m = magnification(focus, focalLength);
  return Math.hypot(
    defocusBlur(objectDistance, focus, focalLength, aperture),
    diffractionBlur(k, aperture, m),
    aberration,
  );
}

export function cEff(limit, aperture, kEff, aberration = 0) {
  const squared = limit * limit - (kEff * aperture) ** 2 - aberration * aberration;
  return squared > 0 ? Math.sqrt(squared) : 0;
}

export function bestFocus(near, far) {
  return 2 / (reciprocal(near) + reciprocal(far));
}

export function worstEdge(near, far, focus, focalLength) {
  const centre = 1 / focus;
  const g = Math.max(Math.abs(reciprocal(near) - centre), Math.abs(centre - reciprocal(far)));
  return { g, a: (focalLength * focalLength * g) / (1 - focalLength / focus) };
}

export function edgeBlur(edgeCoefficient, aperture, kEff, aberration = 0) {
  return Math.hypot(edgeCoefficient / aperture, kEff * aperture, aberration);
}

export function depthOfField(focus, focalLength, aperture, cEffValue) {
  if (cEffValue <= 0) return { near: focus, far: focus, j: Infinity, spread: 0 };
  const j = (focalLength * focalLength) / (aperture * cEffValue);
  const spread = (1 - focalLength / focus) / j;
  const invFar = 1 / focus - spread;
  return {
    j,
    spread,
    near: 1 / (1 / focus + spread),
    far: invFar > 0 ? 1 / invFar : Infinity,
  };
}

export function hyperfocal({ focalLength, aperture, limit, k, aberration = 0 }) {
  let focus = 1e9;
  for (let i = 0; i < 80; i += 1) {
    const kAdjusted = effectiveK(k, magnification(focus, focalLength));
    const effective = cEff(limit, aperture, kAdjusted, aberration);
    if (effective <= 0) return Infinity;
    const next = (focalLength * focalLength) / (aperture * effective) + focalLength;
    if (Math.abs(next - focus) < 1e-9) return next;
    focus = next;
  }
  return focus;
}

export function apertureWindow(edgeCoefficient, limit, kEff, aberration = 0) {
  const reduced = limit * limit - aberration * aberration;
  if (reduced <= 0) return { feasible: false, lower: NaN, upper: NaN };
  const c = Math.sqrt(reduced);
  if (kEff <= 0) {
    return { feasible: true, lower: edgeCoefficient / c, upper: Infinity };
  }
  if (2 * edgeCoefficient * kEff > c * c) return { feasible: false, lower: NaN, upper: NaN };
  const q = Math.sqrt(c ** 4 - 4 * kEff * kEff * edgeCoefficient * edgeCoefficient);
  return {
    feasible: true,
    lower: Math.sqrt((2 * edgeCoefficient * edgeCoefficient) / (c * c + q)),
    upper: Math.sqrt((c * c + q) / (2 * kEff * kEff)),
  };
}

export function sharpestAperture(edgeCoefficient, kEff) {
  return kEff > 0 ? Math.sqrt(edgeCoefficient / kEff) : Infinity;
}

export function sharpestBlur(edgeCoefficient, kEff) {
  return Math.sqrt(2 * edgeCoefficient * kEff);
}
