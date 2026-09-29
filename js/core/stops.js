const THIRD_STOP_LABELS = [
  '1', '1.1', '1.2', '1.4', '1.6', '1.8', '2', '2.2', '2.5', '2.8',
  '3.2', '3.5', '4', '4.5', '5', '5.6', '6.3', '7.1', '8', '9',
  '10', '11', '13', '14', '16', '18', '20', '22', '25', '29', '32',
];

export const STOPS = [
  { value: 0.95, label: '0.95' },
  ...THIRD_STOP_LABELS.map((label, index) => ({ value: 2 ** (index / 6), label })),
];

export const WIDEST_STOP = STOPS[0].value;
export const NARROWEST_STOP = STOPS[STOPS.length - 1].value;

export function stopLabel(value) {
  let best = STOPS[0];
  let bestGap = Infinity;
  for (const stop of STOPS) {
    const gap = Math.abs(Math.log(stop.value) - Math.log(value));
    if (gap < bestGap) {
      bestGap = gap;
      best = stop;
    }
  }
  return best.label;
}

export function formatStop(value) {
  return Number.isFinite(value) ? `f/${stopLabel(value)}` : 'f/-';
}

export function stopsInRange(min = WIDEST_STOP, max = NARROWEST_STOP) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return STOPS.filter((stop) => stop.value >= low * 0.999 && stop.value <= high * 1.001);
}

export function stopAtOrAbove(value, min, max) {
  return stopsInRange(min, max).find((stop) => stop.value >= value * 0.999);
}

export function stopAtOrBelow(value, min, max) {
  const inRange = stopsInRange(min, max).filter((stop) => stop.value <= value * 1.001);
  return inRange[inRange.length - 1];
}

export function nearestStop(value, min, max) {
  const inRange = stopsInRange(min, max);
  if (!inRange.length) return undefined;
  return inRange.reduce((best, stop) =>
    Math.abs(Math.log(stop.value) - Math.log(value)) < Math.abs(Math.log(best.value) - Math.log(value))
      ? stop
      : best,
  );
}

export function stepStop(value, direction, min, max) {
  const inRange = stopsInRange(min, max);
  if (!inRange.length) return value;
  const current = nearestStop(value, min, max);
  const index = inRange.indexOf(current);
  const next = inRange[Math.min(Math.max(index + direction, 0), inRange.length - 1)];
  return next.value;
}

export function parseStop(text) {
  const cleaned = String(text).trim().replace(/^f\s*\/?\s*/i, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
