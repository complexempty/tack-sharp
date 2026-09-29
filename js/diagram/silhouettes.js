import { carDepth } from '../core/subjects.js';

export const HEAD = {
  nose: 30,
  ears: 90,
  skullCentre: 72,
  skullDepth: 78,
  skullWidth: 77,
  eyeOffset: 30,
  earWidth: 15,
  earDepth: 11,
  shoulderStart: 60,
  shoulderEnd: 260,
  shoulderWidth: 230,
};

function ellipse(ctx, map, distance, lateral, depthRadius, widthRadius) {
  const cx = map.x(distance);
  const cy = map.y(lateral);
  const rx = Math.abs(map.x(distance + depthRadius) - map.x(distance));
  const ry = Math.abs(map.y(widthRadius) - map.y(0));
  ctx.moveTo(cx + rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

export function headShoulders(ctx, map, anchor) {
  const x0 = map.x(anchor + HEAD.shoulderStart);
  const x1 = map.x(anchor + HEAD.shoulderEnd);
  const y0 = map.y(-HEAD.shoulderWidth);
  const y1 = map.y(HEAD.shoulderWidth);
  const radius = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 0.3;
  ctx.beginPath();
  ctx.roundRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), radius);
  return ctx;
}

export function headSkull(ctx, map, anchor) {
  ctx.beginPath();
  ellipse(ctx, map, anchor + HEAD.skullCentre, 0, HEAD.skullDepth, HEAD.skullWidth);
  return ctx;
}

export function headNose(ctx, map, anchor) {
  ctx.beginPath();
  ctx.moveTo(map.x(anchor - HEAD.nose), map.y(0));
  ctx.lineTo(map.x(anchor + 40), map.y(-28));
  ctx.lineTo(map.x(anchor + 40), map.y(28));
  ctx.closePath();
  return ctx;
}

export function headEar(ctx, map, anchor, side) {
  ctx.beginPath();
  ellipse(ctx, map, anchor + HEAD.ears, side * (HEAD.skullWidth + 3), HEAD.earDepth, HEAD.earWidth);
  return ctx;
}

export function headDetails(map, anchor) {
  return [-1, 1].map((side) => [map.x(anchor), map.y(side * HEAD.eyeOffset)]);
}

export function groupPath(ctx, map, anchor, rows, spacing) {
  ctx.beginPath();
  for (let row = 0; row < rows; row += 1) {
    const distance = anchor + row * spacing;
    const stagger = row % 2 === 0 ? 0 : 270;
    for (const lateral of [-540 + stagger, 0 + stagger, 540 + stagger]) {
      ellipse(ctx, map, distance + HEAD.skullCentre, lateral, HEAD.skullDepth, HEAD.skullWidth);
      ctx.closePath();
    }
  }
  return ctx;
}

export function carCorners(near, length, width, angleDegrees) {
  const radians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const half = [
    [length / 2, width / 2],
    [length / 2, -width / 2],
    [-length / 2, -width / 2],
    [-length / 2, width / 2],
  ];
  const rotated = half.map(([u, v]) => [u * cos - v * sin, u * sin + v * cos]);
  const minDepth = Math.min(...rotated.map(([d]) => d));
  return rotated.map(([d, lateral]) => [d - minDepth + near, lateral]);
}

export function carPath(ctx, map, near, length, width, angle) {
  const outline = carCorners(near, length, width, angle);
  ctx.beginPath();
  outline.forEach(([distance, lateral], index) => {
    const px = map.x(distance);
    const py = map.y(lateral);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  return ctx;
}

export function carFeatures(map, near, length, width, angle) {
  const glass = carCorners(near, length * 0.46, width * 0.82, angle);
  const roof = carCorners(near, length * 0.26, width * 0.7, angle);
  const glassCentre = centreOf(carCorners(near, length, width, angle));
  const shift = (shape, factor) => {
    const centre = centreOf(shape);
    return shape.map(([d, l]) => [
      d + (glassCentre[0] - centre[0]) + factor,
      l + (glassCentre[1] - centre[1]),
    ]);
  };
  return {
    glass: shift(glass, length * 0.04),
    roof: shift(roof, length * 0.06),
    mirrors: [-1, 1].map((side) => {
      const radians = (angle * Math.PI) / 180;
      const offset = [length * 0.06, side * (width / 2 + 90)];
      const rotated = [
        offset[0] * Math.cos(radians) - offset[1] * Math.sin(radians),
        offset[0] * Math.sin(radians) + offset[1] * Math.cos(radians),
      ];
      return [glassCentre[0] + rotated[0], glassCentre[1] + rotated[1]];
    }),
    depth: carDepth(length, width, angle),
  };
}

export function centreOf(shape) {
  const sum = shape.reduce((acc, [d, l]) => [acc[0] + d, acc[1] + l], [0, 0]);
  return [sum[0] / shape.length, sum[1] / shape.length];
}

export function polygonPath(ctx, map, shape) {
  ctx.beginPath();
  shape.forEach(([distance, lateral], index) => {
    const px = map.x(distance);
    const py = map.y(lateral);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  return ctx;
}

export function blockPath(ctx, map, near, far, halfWidth) {
  const x0 = map.x(near);
  const x1 = map.x(far);
  const y0 = map.y(-halfWidth);
  const y1 = map.y(halfWidth);
  ctx.beginPath();
  ctx.roundRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), 6);
  return ctx;
}

export function cameraGlyph(ctx, x, y, size, colour) {
  const w = size;
  const h = size * 0.68;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - w * 0.16, y - h / 2 - h * 0.22, w * 0.32, h * 0.26, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - h * 0.32);
  ctx.lineTo(x + w / 2 + w * 0.42, y);
  ctx.lineTo(x + w / 2, y + h * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function treeGlyph(ctx, x, baseY, height, colour) {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x - height * 0.05, baseY - height * 0.28, height * 0.1, height * 0.28, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, baseY - height);
  ctx.lineTo(x + height * 0.3, baseY - height * 0.26);
  ctx.lineTo(x - height * 0.3, baseY - height * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function mountainGlyph(ctx, x, baseY, width, height, colour) {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, baseY);
  ctx.lineTo(x - width * 0.12, baseY - height);
  ctx.lineTo(x + width * 0.16, baseY - height * 0.62);
  ctx.lineTo(x + width * 0.34, baseY - height * 0.88);
  ctx.lineTo(x + width / 2, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
