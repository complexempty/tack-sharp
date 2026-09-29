import { findFraming } from '../core/subjects.js';
import { gradientAcross, rgba } from './palette.js';
import {
  HEAD,
  blockPath,
  carCorners,
  carFeatures,
  cameraGlyph,
  carPath,
  groupPath,
  headDetails,
  headEar,
  headNose,
  headShoulders,
  headSkull,
  polygonPath,
} from './silhouettes.js';

const WIDE_FRAMINGS = new Set(['head-shoulders', 'full-body']);

export function subjectGeometry(view, state) {
  const targets = view.targets;
  const anchor = targets.anchor;

  if (state.subject === 'portrait') {
    const framing = findFraming(state.subjectState.portrait.framing);
    const shoulders = WIDE_FRAMINGS.has(framing.id) || state.subjectState.portrait.back > 150;
    return {
      kind: 'head',
      shoulders,
      anchor,
      depth0: anchor - HEAD.nose - 10,
      depth1: anchor + (shoulders ? HEAD.shoulderEnd : HEAD.skullCentre + HEAD.skullDepth + 20),
      halfWidth: shoulders ? HEAD.shoulderWidth + 20 : HEAD.skullWidth + 40,
    };
  }

  if (state.subject === 'group') {
    const { rows, spacing } = state.subjectState.group;
    return {
      kind: 'group',
      anchor,
      rows,
      spacing,
      depth0: anchor - HEAD.nose - 20,
      depth1: anchor + (rows - 1) * spacing + HEAD.skullCentre + HEAD.skullDepth + 40,
      halfWidth: 960,
    };
  }

  if (state.subject === 'car') {
    const { length, width, angle } = state.subjectState.car;
    const corners = carCorners(targets.near, length, width, angle);
    const laterals = corners.map(([, lateral]) => lateral);
    const depths = corners.map(([depth]) => depth);
    return {
      kind: 'car',
      length,
      width,
      angle,
      near: targets.near,
      depth0: Math.min(...depths) - 200,
      depth1: Math.max(...depths) + 200,
      halfWidth: Math.max(...laterals.map(Math.abs)) + 260,
    };
  }

  const far = Number.isFinite(targets.far) ? targets.far : targets.near * 3;
  const depth = far - targets.near;
  return {
    kind: 'block',
    near: targets.near,
    far,
    depth0: targets.near - depth * 0.12,
    depth1: far + depth * 0.12,
    halfWidth: Math.max(depth * 0.3, 300),
  };
}

export function planWindow(geometry, view, rect) {
  const subjectDepth = Math.max(geometry.depth1 - geometry.depth0, 1);
  const sharpNear = view.result.depthNear;
  const sharpFar = view.result.depthFar;

  let low = geometry.depth0;
  let high = geometry.depth1;
  if (Number.isFinite(sharpNear)) low = Math.min(low, Math.max(sharpNear, geometry.depth0 - subjectDepth * 2));
  if (Number.isFinite(sharpFar)) high = Math.max(high, Math.min(sharpFar, geometry.depth1 + subjectDepth * 2));

  const centre = (low + high) / 2;
  const lateralNeed = (rect.w * geometry.halfWidth * 2 * 1.08) / rect.h;
  const span = Math.max((high - low) * 1.14, lateralNeed, subjectDepth * 1.2);
  const scale = rect.w / span;
  const start = centre - span / 2;

  return {
    span,
    scale,
    start,
    x: (distance) => rect.x + (distance - start) * scale,
    y: (lateral) => rect.y + rect.h / 2 + lateral * scale,
    toDistance: (px) => start + (px - rect.x) / scale,
  };
}

export function drawPlan(ctx, rect, view, state, palette, ratioAt) {
  const geometry = subjectGeometry(view, state);
  const map = planWindow(geometry, view, rect);
  const ratioAtX = (px) => ratioAt(map.toDistance(px));

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  ctx.fillStyle = gradientAcross(ctx, rect.x, rect.x + rect.w, ratioAtX, palette, 0.16);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const fill = gradientAcross(ctx, rect.x, rect.x + rect.w, ratioAtX, palette, 1);
  const stroke = rgba(palette.lineStrong, 0.55);

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;

  if (geometry.kind === 'head') {
    const parts = [];
    if (geometry.shoulders) parts.push(() => headShoulders(ctx, map, geometry.anchor));
    parts.push(() => headNose(ctx, map, geometry.anchor));
    parts.push(() => headEar(ctx, map, geometry.anchor, -1));
    parts.push(() => headEar(ctx, map, geometry.anchor, 1));
    parts.push(() => headSkull(ctx, map, geometry.anchor));
    for (const part of parts) {
      part();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = rgba(palette.stage, 0.85);
    for (const [px, py] of headDetails(map, geometry.anchor)) {
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.6, map.scale * 8), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (geometry.kind === 'group') {
    groupPath(ctx, map, geometry.anchor, geometry.rows, geometry.spacing);
    ctx.fill();
    ctx.stroke();
  } else if (geometry.kind === 'car') {
    carPath(ctx, map, geometry.near, geometry.length, geometry.width, geometry.angle);
    ctx.fill();
    ctx.stroke();
    const features = carFeatures(map, geometry.near, geometry.length, geometry.width, geometry.angle);
    ctx.fillStyle = rgba(palette.stage, 0.5);
    polygonPath(ctx, map, features.glass);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.lineStrong, 0.4);
    polygonPath(ctx, map, features.roof);
    ctx.stroke();
    ctx.fillStyle = rgba(palette.lineStrong, 0.7);
    for (const [distance, lateral] of features.mirrors) {
      ctx.beginPath();
      ctx.arc(map.x(distance), map.y(lateral), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    blockPath(ctx, map, geometry.near, geometry.far, geometry.halfWidth * 0.62);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  const glyphY = rect.y + rect.h - 14;
  ctx.save();
  ctx.strokeStyle = rgba(palette.muted, 0.4);
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rect.x + 20, glyphY);
  ctx.lineTo(rect.x + rect.w, glyphY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  cameraGlyph(ctx, rect.x + 10, glyphY, 15, rgba(palette.muted, 0.85));

  return map;
}
