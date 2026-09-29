import { displayUnitValue, formatMagnitude } from '../core/units.js';
import { rgba } from './palette.js';

export const RATIO_CEILING = 3;
const LABEL_GAP = 44;
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80];

function ladder(units) {
  const values = [];
  for (let decade = -2; decade <= 4; decade += 1) {
    for (const step of NICE_STEPS) values.push(step * 10 ** decade);
  }
  return values.map((value) => (units === 'ft' ? value * 304.8 : value * 1000));
}

function evenlySpaced(low, high, units) {
  const lowUnits = displayUnitValue(low, units);
  const highUnits = displayUnitValue(high, units);
  const rough = (highUnits - lowUnits) / 4;
  if (!(rough > 0)) return [];
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) || magnitude * 10;
  const values = [];
  for (let value = Math.ceil(lowUnits / step) * step; value <= highUnits + step * 1e-9; value += step) {
    values.push(units === 'ft' ? value * 304.8 : value * 1000);
  }
  return values;
}

export function axisTicks(map, rect, units) {
  const low = map.toDistance(rect.x);
  const high = map.toDistance(rect.x + rect.w);
  const candidates = Number.isFinite(high) ? evenlySpaced(low, high, units) : ladder(units);
  const ticks = [];
  let lastX = -Infinity;
  for (const distance of candidates) {
    const px = map.x(distance);
    if (px < rect.x + 8 || px > rect.x + rect.w - 8) continue;
    if (px - lastX < LABEL_GAP) continue;
    lastX = px;
    ticks.push({ distance, px, label: formatMagnitude(displayUnitValue(distance, units)) });
  }
  return ticks;
}

function labelBox(ctx, text, x, y, palette, colour) {
  const width = ctx.measureText(text).width + 8;
  ctx.fillStyle = rgba(palette.stage, 0.86);
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 9, width, 14, 3);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 2);
}

export function drawCurve(ctx, rect, view, state, palette, ratioAt, map) {
  const result = view.result;
  const toY = (ratio) => rect.y + rect.h * (1 - Math.min(ratio, RATIO_CEILING) / RATIO_CEILING);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y - 32, rect.w, rect.h + 52);
  ctx.clip();

  ctx.strokeStyle = rgba(palette.line, 1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
  ctx.stroke();

  ctx.font = '500 10px "Barlow Semi Condensed", system-ui, sans-serif';
  ctx.fillStyle = rgba(palette.muted, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const tick of axisTicks(map, rect, state.units)) {
    ctx.strokeStyle = rgba(palette.line, 0.8);
    ctx.beginPath();
    ctx.moveTo(tick.px, rect.y + rect.h);
    ctx.lineTo(tick.px, rect.y + rect.h + 3);
    ctx.stroke();
    ctx.fillText(tick.label, tick.px, rect.y + rect.h + 5);
  }

  const floorRatio = Math.hypot(result.kEff * result.aperture, result.aberration) / view.limit;
  ctx.strokeStyle = rgba(palette.muted, 0.5);
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(rect.x, toY(floorRatio));
  ctx.lineTo(rect.x + rect.w, toY(floorRatio));
  ctx.stroke();

  ctx.strokeStyle = rgba(palette.sharp, 0.85);
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(rect.x, toY(1));
  ctx.lineTo(rect.x + rect.w, toY(1));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = rgba(palette.accent, 1);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  let started = false;
  for (let px = rect.x; px <= rect.x + rect.w; px += 1) {
    const ratio = ratioAt(map.toDistance(px));
    if (!Number.isFinite(ratio)) {
      started = false;
      continue;
    }
    const py = toY(ratio);
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  const markers = [
    { label: 'Focus', distance: result.focusSensor, colour: rgba(palette.accent, 1) },
    { label: 'Near', distance: result.depthNear, colour: rgba(palette.muted, 0.9) },
    { label: 'Far', distance: result.depthFar, colour: rgba(palette.muted, 0.9) },
  ].filter((marker) => Number.isFinite(marker.distance));

  const placed = [];
  ctx.font = '600 10px "Barlow Semi Condensed", system-ui, sans-serif';
  for (const marker of markers) {
    const px = map.x(marker.distance);
    if (px < rect.x - 2 || px > rect.x + rect.w + 2) continue;
    ctx.strokeStyle = marker.colour;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, rect.y - 24);
    ctx.lineTo(px, rect.y + rect.h);
    ctx.stroke();
    ctx.setLineDash([]);

    const width = ctx.measureText(marker.label).width + 8;
    const fits = (row) =>
      !placed.some((entry) => entry.row === row && Math.abs(entry.px - px) < (entry.width + width) / 2 + 2);
    const row = [0, 1].find(fits);
    if (row === undefined) continue;
    placed.push({ px, width, row });
    labelBox(ctx, marker.label, px, rect.y - 20 + row * 15, palette, marker.colour);
  }

  ctx.restore();
}
