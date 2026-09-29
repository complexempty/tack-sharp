export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;
export const INFINITY_TEXT = '∞';

export function formatMagnitude(value) {
  const size = Math.abs(value);
  if (size < 10) return value.toFixed(2);
  if (size < 100) return value.toFixed(1);
  return String(Math.round(value));
}

export function formatDistance(mm, units) {
  if (!Number.isFinite(mm)) return INFINITY_TEXT;
  if (units === 'ft') {
    const feet = mm / MM_PER_FOOT;
    if (Math.abs(feet) < 2) return `${formatMagnitude(mm / MM_PER_INCH)} in`;
    return `${formatMagnitude(feet)} ft`;
  }
  const metres = mm / 1000;
  if (Math.abs(metres) < 1) return `${formatMagnitude(mm / 10)} cm`;
  return `${formatMagnitude(metres)} m`;
}

export function formatOffset(mm, units) {
  if (!Number.isFinite(mm)) return INFINITY_TEXT;
  if (units === 'ft') return `${formatMagnitude(mm / MM_PER_INCH)} in`;
  return `${formatMagnitude(mm / 10)} cm`;
}

export function formatMicrons(mm) {
  if (!Number.isFinite(mm)) return INFINITY_TEXT;
  return `${(mm * 1000).toFixed(1)} µm`;
}

export function formatPixels(mm, pixelPitchMm) {
  if (!Number.isFinite(mm) || !pixelPitchMm) return INFINITY_TEXT;
  return `${(mm / pixelPitchMm).toFixed(1)} px`;
}

export function formatMultiple(value) {
  return `${value.toFixed(2)}×`;
}

export function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

export function displayUnitValue(mm, units) {
  if (!Number.isFinite(mm)) return Infinity;
  return units === 'ft' ? mm / MM_PER_FOOT : mm / 1000;
}

export function fromDisplayUnit(value, units) {
  if (!Number.isFinite(value)) return Infinity;
  return units === 'ft' ? value * MM_PER_FOOT : value * 1000;
}

export function parseDistance(text, units) {
  const cleaned = String(text).trim().toLowerCase().replace(',', '.');
  if (!cleaned) return undefined;
  if (cleaned === 'inf' || cleaned === 'infinity' || cleaned === INFINITY_TEXT) return Infinity;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return undefined;
  if (/(^|[^a-z])(mm)$/.test(cleaned)) return value;
  if (/cm$/.test(cleaned)) return value * 10;
  if (/(^|\d\s*)m$/.test(cleaned)) return value * 1000;
  if (/(in|")$/.test(cleaned)) return value * MM_PER_INCH;
  if (/(ft|')$/.test(cleaned)) return value * MM_PER_FOOT;
  return fromDisplayUnit(value, units);
}

const DISTANCE_STEPS = [1, 2, 5];

export function stepDistance(mm, direction) {
  if (!Number.isFinite(mm)) return mm;
  const target = mm * (direction > 0 ? 1.03 : 1 / 1.03);
  const exponent = Math.floor(Math.log10(Math.abs(target)));
  const scale = 10 ** (exponent - 1);
  const candidates = [];
  for (let decade = scale / 10; decade <= scale * 100; decade *= 10) {
    for (const step of DISTANCE_STEPS) candidates.push(step * decade);
  }
  const increment = candidates.reduce((best, candidate) =>
    Math.abs(candidate - Math.abs(target - mm)) < Math.abs(best - Math.abs(target - mm)) ? candidate : best,
  );
  const next = direction > 0 ? mm + increment : mm - increment;
  const snapped = Math.round(next / increment) * increment;
  return Math.max(increment, snapped);
}

export const COMMON_FOCAL_LENGTHS = [
  8, 10, 12, 14, 15, 16, 17, 18, 20, 21, 24, 28, 30, 35, 40, 45, 50, 55, 58, 60, 70, 75, 85, 90,
  100, 105, 120, 135, 150, 165, 180, 200, 210, 240, 250, 280, 300, 350, 400, 450, 500, 560, 600,
  700, 800, 900, 1000,
];

export function stepFocalLength(value, direction) {
  const list = COMMON_FOCAL_LENGTHS;
  if (direction > 0) return list.find((entry) => entry > value + 0.001) ?? list[list.length - 1];
  const below = list.filter((entry) => entry < value - 0.001);
  return below.length ? below[below.length - 1] : list[0];
}
