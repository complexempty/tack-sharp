import { toObject } from '../core/distance.js';
import { totalBlur } from '../core/optics.js';
import { formatDistance, formatMicrons, formatMultiple } from '../core/units.js';
import { readPalette, rgba } from './palette.js';
import { drawPlan } from './plan.js';
import { drawWholeScene } from './wholescene.js';
import { drawCurve } from './curve.js';

const PICTURE_RATIO = 0.46;
const CURVE_HEIGHT = 86;
const PADDING = 10;
const AXIS_ROOM = 18;
const LABEL_BAND = 32;

export function makeRatioAt(view) {
  const result = view.result;
  return (sensorDistance) => {
    if (!Number.isFinite(sensorDistance)) {
      return (
        totalBlur({
          objectDistance: Infinity,
          focus: result.focusObject,
          focalLength: result.focalLength,
          aperture: result.aperture,
          k: result.k,
          aberration: result.aberration,
        }) / view.limit
      );
    }
    const object = toObject(sensorDistance, result.focalLength);
    if (!Number.isFinite(object) || Number.isNaN(object)) return Infinity;
    return (
      totalBlur({
        objectDistance: object,
        focus: result.focusObject,
        focalLength: result.focalLength,
        aperture: result.aperture,
        k: result.k,
        aberration: result.aberration,
      }) / view.limit
    );
  };
}

export function mountDiagram({ canvas, scrubNode, store }) {
  const ctx = canvas.getContext('2d');
  let current = null;
  let scrubX = null;

  function layout() {
    const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth || 380;
    const pictureHeight = Math.round(Math.min(Math.max(cssWidth * PICTURE_RATIO, 132), 210));
    const cssHeight = pictureHeight + LABEL_BAND + CURVE_HEIGHT + AXIS_ROOM;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    }
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {
      width: cssWidth,
      height: cssHeight,
      picture: { x: PADDING, y: PADDING, w: cssWidth - PADDING * 2, h: pictureHeight - PADDING },
      curve: {
        x: PADDING,
        y: pictureHeight + LABEL_BAND,
        w: cssWidth - PADDING * 2,
        h: CURVE_HEIGHT,
      },
    };
  }

  function draw() {
    if (!current) return;
    const { view, state } = current;
    const box = layout();
    const palette = readPalette();

    ctx.clearRect(0, 0, box.width, box.height);

    if (!view.result.ok) {
      ctx.fillStyle = rgba(palette.muted, 0.9);
      ctx.font = '500 13px "Barlow", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No solution to draw', box.width / 2, box.height / 2);
      current.map = null;
      return;
    }

    const ratioAt = makeRatioAt(view);
    const useScene = state.view === 'scene' || view.forceWholeScene;

    const map = useScene
      ? drawWholeScene(ctx, box.picture, view, state, palette, ratioAt)
      : drawPlan(ctx, box.picture, view, state, palette, ratioAt);

    drawCurve(ctx, box.curve, view, state, palette, ratioAt, map);

    current.map = map;
    current.box = box;
    current.ratioAt = ratioAt;

    if (scrubX !== null) drawScrub(box, map, ratioAt, palette, state, view);
  }

  function drawScrub(box, map, ratioAt, palette, state, view) {
    const px = Math.min(Math.max(scrubX, box.curve.x), box.curve.x + box.curve.w);
    const distance = map.toDistance(px);
    const ratio = ratioAt(distance);
    ctx.save();
    ctx.strokeStyle = rgba(palette.text, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, box.picture.y);
    ctx.lineTo(px, box.curve.y + box.curve.h);
    ctx.stroke();
    ctx.restore();

    const blur = ratio * view.limit;
    const verdict = ratio <= 1 ? 'sharp' : formatMultiple(ratio);
    scrubNode.textContent = `${formatDistance(distance, state.units)} · ${formatMicrons(blur)} · ${verdict}`;
    scrubNode.hidden = false;
    const width = scrubNode.offsetWidth || 150;
    const left = Math.min(Math.max(px - width / 2, 4), box.width - width - 4);
    scrubNode.style.left = `${left}px`;
    scrubNode.style.top = `${box.picture.y + 2}px`;
  }

  function pointerX(event) {
    const rect = canvas.getBoundingClientRect();
    return event.clientX - rect.left;
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    scrubX = pointerX(event);
    draw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (scrubX === null) return;
    scrubX = pointerX(event);
    draw();
  });
  const endScrub = () => {
    scrubX = null;
    scrubNode.hidden = true;
    draw();
  };
  canvas.addEventListener('pointerup', endScrub);
  canvas.addEventListener('pointercancel', endScrub);
  canvas.addEventListener('pointerleave', () => {
    if (scrubX !== null) endScrub();
  });

  const observer = new ResizeObserver(() => draw());
  observer.observe(canvas.parentElement);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => draw());

  return {
    update(view, state) {
      current = { view, state };
      if (!state.diagramOpen) {
        scrubNode.hidden = true;
        return;
      }
      draw();
    },
    redraw: draw,
  };
}
