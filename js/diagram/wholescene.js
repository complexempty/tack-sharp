import { gradientAcross, rgba } from './palette.js';
import { cameraGlyph, mountainGlyph, treeGlyph } from './silhouettes.js';

const CAMERA_GUTTER = 34;

export function sceneMapping(rect, focusDistance, nearestFocusable = 0) {
  const k = Math.max(focusDistance, 1);
  const left = rect.x + CAMERA_GUTTER;
  const right = rect.x + rect.w;
  const raw = (distance) => (Number.isFinite(distance) ? distance / (distance + k) : 1);
  const origin = raw(nearestFocusable);
  const compress = (distance) => (raw(distance) - origin) / (1 - origin);
  const expand = (t) => {
    const back = origin + t * (1 - origin);
    return back >= 1 ? Infinity : (k * back) / (1 - back);
  };
  return {
    k,
    left,
    right,
    x: (distance) => left + compress(distance) * (right - left),
    toDistance: (px) => expand(Math.min(1, Math.max(0, (px - left) / (right - left)))),
  };
}

export function drawWholeScene(ctx, rect, view, state, palette, ratioAt) {
  const map = sceneMapping(rect, view.result.focusSensor, view.result.focalLength * 4);
  const ratioAtX = (px) => ratioAt(map.toDistance(px));

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  ctx.fillStyle = gradientAcross(ctx, map.left, map.right, ratioAtX, palette, 0.16);
  ctx.fillRect(map.left, rect.y, map.right - map.left, rect.h);

  const groundY = rect.y + rect.h * 0.78;
  ctx.strokeStyle = rgba(palette.line, 0.9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rect.x, groundY);
  ctx.lineTo(rect.x + rect.w, groundY);
  ctx.stroke();

  if (state.subject === 'landscape') {
    mountainGlyph(ctx, map.right - rect.w * 0.22, groundY, rect.w * 0.34, rect.h * 0.48, rgba(palette.lineStrong, 0.35));
    mountainGlyph(ctx, map.right - rect.w * 0.04, groundY, rect.w * 0.26, rect.h * 0.36, rgba(palette.lineStrong, 0.25));
    treeGlyph(ctx, map.x(view.targets.near), groundY, rect.h * 0.42, rgba(palette.lineStrong, 0.55));
  }

  const barHeight = Math.max(18, rect.h * 0.2);
  const barY = rect.y + rect.h * 0.42 - barHeight / 2;
  const x0 = map.x(view.targets.near);
  const x1 = map.x(view.targets.far);
  ctx.fillStyle = gradientAcross(ctx, x0, Math.max(x1, x0 + 1), ratioAtX, palette, 0.95);
  ctx.beginPath();
  ctx.roundRect(x0, barY, Math.max(x1 - x0, 3), barHeight, 4);
  ctx.fill();
  ctx.strokeStyle = rgba(palette.lineStrong, 0.5);
  ctx.stroke();

  cameraGlyph(ctx, rect.x + CAMERA_GUTTER / 2 - 3, rect.y + rect.h * 0.42, 20, rgba(palette.muted, 0.9));

  ctx.restore();
  return map;
}
