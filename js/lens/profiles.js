import { NARROWEST_STOP, WIDEST_STOP } from '../core/stops.js';
import { bracketing, constantAberration, interpolateBreakpoints, interpolateInLogAperture } from './interp.js';

export const FRAME_POSITIONS = [
  { id: 'center', name: 'Center', maxRadius: 0.3 },
  { id: 'edge', name: 'Edge', maxRadius: 0.8 },
  { id: 'corner', name: 'Corner', maxRadius: Infinity },
];

export const PERFECT_LENS_ID = 'perfect';

export function positionForRadius(normalisedRadius) {
  return FRAME_POSITIONS.find((zone) => normalisedRadius <= zone.maxRadius) || FRAME_POSITIONS[2];
}

export const SEEDED_PROFILES = [
  {
    id: 'sony-fe-200-600-g',
    name: 'Sony FE 200-600mm F5.6-6.3 G OSS',
    shortName: 'FE 200-600 G',
    exifModel: 'FE 200-600mm F5.6-6.3 G OSS',
    type: 'zoom',
    focal: { min: 200, max: 600 },
    maxAperture: [
      { focal: 200, value: 2 ** (15 / 6) },
      { focal: 400, value: 2 ** (16 / 6) },
      { focal: 600, value: 2 ** (16 / 6) },
    ],
    minAperture: [
      { focal: 200, value: 2 ** (30 / 6) },
      { focal: 600, value: 36 },
    ],
    minFocus: [
      { focal: 200, value: 2400 },
      { focal: 600, value: 2400 },
    ],
    measurements: [],
    calibrated: false,
  },
  {
    id: 'sigma-24-70-dgdn-ii',
    name: 'Sigma 24-70mm F2.8 DG DN Art II',
    shortName: 'Sigma 24-70 Art II',
    exifModel: '24-70mm F2.8 DG DN II',
    type: 'zoom',
    focal: { min: 24, max: 70 },
    maxAperture: [{ focal: 24, value: 2 ** (9 / 6) }],
    minAperture: [{ focal: 24, value: 2 ** (27 / 6) }],
    minFocus: [
      { focal: 24, value: 170 },
      { focal: 70, value: 340 },
    ],
    measurements: [],
    calibrated: false,
  },
];

export function perfectLens(apertureMin, apertureMax) {
  return {
    id: PERFECT_LENS_ID,
    name: 'Perfect lens',
    shortName: 'Perfect lens',
    type: 'zoom',
    focal: { min: 1, max: 2000 },
    maxAperture: [{ focal: 1, value: apertureMin ?? WIDEST_STOP }],
    minAperture: [{ focal: 1, value: apertureMax ?? NARROWEST_STOP }],
    minFocus: [{ focal: 1, value: 0 }],
    measurements: [],
    calibrated: false,
    perfect: true,
  };
}

export function maxApertureAt(profile, focalLength) {
  return interpolateBreakpoints(profile.maxAperture, focalLength) ?? WIDEST_STOP;
}

export function minApertureAt(profile, focalLength) {
  return interpolateBreakpoints(profile.minAperture, focalLength) ?? NARROWEST_STOP;
}

export function minFocusAt(profile, focalLength) {
  return interpolateBreakpoints(profile.minFocus, focalLength) ?? 0;
}

export function clampFocalLength(profile, focalLength) {
  return Math.min(Math.max(focalLength, profile.focal.min), profile.focal.max);
}

export function isPrime(profile) {
  return profile.type === 'prime' || profile.focal.min === profile.focal.max;
}

export function aberrationFor(profile, focalLength, position) {
  if (!profile || !profile.measurements || !profile.measurements.length) return constantAberration(0);
  const atPosition = profile.measurements.filter((entry) => entry.position === position);
  if (!atPosition.length) return constantAberration(0);

  const focals = [...new Set(atPosition.map((entry) => entry.focal))];
  const bracket = bracketing(focals, focalLength);
  const curveAt = (focal) => atPosition.filter((entry) => entry.focal === focal);

  if (bracket.length === 1) {
    const curve = curveAt(bracket[0]);
    return (aperture) => interpolateInLogAperture(curve, aperture);
  }

  const [low, high] = bracket;
  const lowCurve = curveAt(low);
  const highCurve = curveAt(high);
  const span = high - low;
  const t = span === 0 ? 0 : (focalLength - low) / span;
  return (aperture) =>
    interpolateInLogAperture(lowCurve, aperture) * (1 - t) +
    interpolateInLogAperture(highCurve, aperture) * t;
}

export function apertureCostOfZooming(profile, fromFocal, toFocal) {
  const before = maxApertureAt(profile, fromFocal);
  const after = maxApertureAt(profile, toFocal);
  if (after <= before * 1.001) return undefined;
  return { before, after, stops: Math.log2((after / before) ** 2) };
}

export function findProfile(profiles, id) {
  return profiles.find((profile) => profile.id === id);
}
