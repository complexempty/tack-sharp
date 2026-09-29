import { findCamera, pixelPitch } from '../data/cameras.js';
import { looserTiersThan, findTier, tierLimit } from '../data/tiers.js';
import { evaluate, makeScene, solveAperture, solveDistance, solveFocalLength } from './solve.js';
import { stackAperture, stackPlan } from './stack.js';
import { alwaysWholeScene, subjectNoun, targetsFor } from './subjects.js';
import { formatDistance, formatOffset } from './units.js';
import { DIFFRACTION_K } from './optics.js';

export function cameraFor(state) {
  return state.cameraId === 'custom' ? { id: 'custom', name: 'Custom', ...state.customCamera } : findCamera(state.cameraId);
}

export function limitFor(state) {
  return tierLimit(state.tierId, cameraFor(state), state.customTierMicrons);
}

function baseOptions(state, limit, overrides = {}) {
  const targets = overrides.targets || targetsFor(state.subject, state.subjectState);
  const focus =
    state.focusMode === 'manual'
      ? state.manualFocus
      : state.focusMode === 'anchor'
        ? targets.anchor
        : undefined;
  return makeScene({
    near: targets.near,
    far: targets.far,
    focalLength: overrides.focalLength ?? state.focalLength,
    aperture: overrides.aperture ?? state.aperture,
    limit,
    diffraction: state.diffraction,
    focus: overrides.focus === undefined ? focus : overrides.focus,
    apertureMin: state.apertureMin,
    apertureMax: state.apertureMax,
  });
}

function focusDescription(state, targets, result, units) {
  if (!result.ok) return '';
  const offset = result.focusSensor - targets.anchor;
  const magnitude = Math.abs(offset);
  if (state.subject === 'group') {
    const index = offset / state.subjectState.group.spacing;
    const lower = Math.floor(index) + 1;
    const upper = lower + 1;
    const between =
      index <= 0
        ? 'In front of row 1'
        : lower >= state.subjectState.group.rows
          ? `Behind row ${state.subjectState.group.rows}`
          : `Between rows ${lower} and ${upper}`;
    return `${between}, ${formatDistance(magnitude, units)} behind the front row`;
  }
  if (magnitude < 0.5) return `On ${targets.anchorLabel}`;
  const direction = offset > 0 ? 'behind' : 'in front of';
  if (state.subject === 'portrait') {
    return `${formatOffset(magnitude, units)} ${direction} ${targets.anchorLabel}`;
  }
  return `${formatDistance(magnitude, units)} past ${targets.anchorLabel}`;
}

function stepBackOption(state, limit, aperture) {
  const solved = solveDistance((distance) =>
    baseOptions(state, limit, {
      targets: targetsFor(state.subject, state.subjectState, distance),
      aperture,
      focus: state.focusMode === 'manual' ? undefined : undefined,
    }),
  );
  if (!solved.ok) return undefined;
  return { distance: solved.solvedDistance, aperture };
}

function looserTierOption(state) {
  for (const tierId of looserTiersThan(state.tierId)) {
    const limit = tierLimit(tierId, cameraFor(state));
    const result = evaluate(baseOptions(state, limit));
    if (result.ok && result.workingStops.length) {
      return { tierId, tierName: findTier(tierId).name, stop: result.workingStops[0] };
    }
  }
  return undefined;
}

export function computeView(state) {
  const camera = cameraFor(state);
  const pitch = pixelPitch(camera);
  const limit = limitFor(state);
  const targets = targetsFor(state.subject, state.subjectState);

  let result;
  let solvedField;
  let solvedDistance;

  if (state.solveFor === 'aperture') {
    result = solveAperture(baseOptions(state, limit), state.apertureMode);
    solvedField = 'aperture';
  } else if (state.solveFor === 'focalLength') {
    result = solveFocalLength(baseOptions(state, limit), state.lensFocalBounds);
    solvedField = 'focalLength';
  } else if (state.solveFor === 'distance') {
    result = solveDistance((distance) =>
      baseOptions(state, limit, { targets: targetsFor(state.subject, state.subjectState, distance) }),
    );
    solvedField = 'distance';
    solvedDistance = result.solvedDistance;
  } else {
    result = evaluate(baseOptions(state, limit));
  }

  const view = {
    camera,
    pitch,
    limit,
    targets,
    result,
    solvedField,
    solvedDistance,
    subjectNoun: subjectNoun(state.subject),
    stackable: targets.stackable,
    forceWholeScene: alwaysWholeScene(state.subject, state.subjectState),
    focusText: focusDescription(state, targets, result, state.units),
    aperture: result.ok ? result.aperture : state.aperture,
    focalLength: result.ok ? result.focalLength : state.focalLength,
  };

  if (!result.ok) return view;

  view.ratio = result.blur / limit;
  view.state = result.state;

  if (result.state !== 'pass') {
    view.options = {};
    if (result.workingStops.length) view.options.apertures = result.workingStops;
    const feasibleAperture = result.workingStops.length ? result.aperture : undefined;
    const fallbackStop = stackAperture({
      limit,
      k: state.diffraction ? DIFFRACTION_K : 0,
      m: result.magnification,
      apertureMin: state.apertureMin,
      apertureMax: state.apertureMax,
    });
    const stepAperture = feasibleAperture || (fallbackStop ? fallbackStop.value : result.sharpest.aperture);
    view.options.stepBack = stepBackOption(state, limit, stepAperture);
    view.options.looserTier = looserTierOption(state);
    if (targets.stackable && fallbackStop) {
      const plan = stackPlan({
        near: targets.near,
        far: targets.far,
        focalLength: result.focalLength,
        aperture: fallbackStop.value,
        limit,
        k: state.diffraction ? DIFFRACTION_K : 0,
      });
      if (plan.ok) view.options.stack = { ...plan, stop: fallbackStop };
    }
  }

  return view;
}

export const ERROR_MESSAGES = {
  'too-close': (view, units) => ({
    headline: 'Too close for this focal length',
    detail: `A ${view.result.focalLength ?? ''} mm lens cannot focus nearer than ${formatDistance(
      view.result.minimumDistance,
      units,
    )} from the sensor. Step back or use a shorter focal length.`,
  }),
  'focus-too-close': (view, units) => ({
    headline: 'Focus point is too close',
    detail: `Focus no nearer than ${formatDistance(view.result.minimumDistance, units)} from the sensor.`,
  }),
  'inside-minimum-focus': (view, units) => ({
    headline: 'Inside the lens minimum focus distance',
    detail: `This lens focuses no nearer than ${formatDistance(
      view.result.minimumDistance,
      units,
    )}. Step back or pick another lens.`,
  }),
  'lens-over-limit': () => ({
    headline: 'The lens alone is over the limit',
    detail: 'At this aperture the lens is softer than the blur limit before defocus or diffraction. Choose a looser standard.',
  }),
  'no-focal-length': () => ({
    headline: 'No focal length works',
    detail: 'Even the shortest focal length cannot hold this depth. Step back, open up, or loosen the standard.',
  }),
  'no-distance': () => ({
    headline: 'No distance works',
    detail: 'Stepping back never brings this depth inside the limit at these settings.',
  }),
  'invalid-target': () => ({
    headline: 'Check the distances',
    detail: 'The near target must be a positive distance from the sensor.',
  }),
  'invalid-focus': () => ({
    headline: 'Check the focus distance',
    detail: 'That focus distance cannot be reached.',
  }),
};
