import { CAR_VIEWS, PORTRAIT_FRAMINGS, SUBJECTS, findSubject } from '../core/subjects.js';
import { formatStop, parseStop, stepStop, stopLabel } from '../core/stops.js';
import { formatDistance, parseDistance, stepDistance, stepFocalLength } from '../core/units.js';
import { clear, element, segmented, stepper } from './widgets.js';
import { lensFor } from '../core/scene.js';
import { clampFocalLength, maxApertureAt, minApertureAt } from '../lens/profiles.js';

const SOLVE_MODES = [
  { id: 'aperture', name: 'Aperture' },
  { id: 'focalLength', name: 'Focal length' },
  { id: 'distance', name: 'Distance' },
  { id: 'check', name: 'Just check' },
];

const APERTURE_MODES = [
  { id: 'widest', name: 'Widest that works' },
  { id: 'sharpest', name: 'Sharpest' },
];

function distanceStepper(label, read, write, store) {
  const control = stepper({
    label,
    onStep: (direction) =>
      store.update((draft) => {
        write(draft, stepDistance(read(store.get()), direction));
      }),
    onCommit: (text) => {
      const parsed = parseDistance(text, store.get().units);
      if (parsed === undefined) return;
      store.update((draft) => write(draft, parsed));
    },
  });
  return control;
}

function countStepper(label, read, write, store, { min, max, step = 1 }) {
  return stepper({
    label,
    inputMode: 'numeric',
    onStep: (direction) =>
      store.update((draft) => {
        const next = Math.min(max, Math.max(min, read(store.get()) + direction * step));
        write(draft, next);
      }),
    onCommit: (text) => {
      const value = Number.parseFloat(text);
      if (!Number.isFinite(value)) return;
      store.update((draft) => write(draft, Math.min(max, Math.max(min, value))));
    },
  });
}

export function mountSubjectPanel({ pickerHost, controlsHost, solveHost, store }) {
  const picker = segmented(SUBJECTS, {
    ariaLabel: 'Subject',
    onChange: (id) => store.set({ subject: id }),
  });
  pickerHost.append(picker.node);

  const distance = distanceStepper(
    'Distance',
    (state) => state.subjectState[state.subject].distance,
    (draft, value) => {
      draft.subjectState[draft.subject].distance = value;
      if (draft.solveFor === 'distance') draft.solveFor = 'check';
    },
    store,
  );

  const framing = segmented(PORTRAIT_FRAMINGS, {
    ariaLabel: 'Framing',
    onChange: (id) =>
      store.update((draft) => {
        const preset = PORTRAIT_FRAMINGS.find((entry) => entry.id === id);
        draft.subjectState.portrait.framing = id;
        if (id !== 'custom') {
          draft.subjectState.portrait.front = preset.front;
          draft.subjectState.portrait.back = preset.back;
        }
      }),
  });
  const framingRow = element('div', { class: 'field' }, [element('label', { text: 'Framing' }), framing.node]);
  framingRow.style.gridTemplateColumns = '1fr';

  const front = distanceStepper(
    'Sharp in front of eyes',
    (state) => state.subjectState.portrait.front,
    (draft, value) => {
      draft.subjectState.portrait.front = value;
      draft.subjectState.portrait.framing = 'custom';
    },
    store,
  );
  const back = distanceStepper(
    'Sharp behind eyes',
    (state) => state.subjectState.portrait.back,
    (draft, value) => {
      draft.subjectState.portrait.back = value;
      draft.subjectState.portrait.framing = 'custom';
    },
    store,
  );

  const rows = countStepper(
    'Rows',
    (state) => state.subjectState.group.rows,
    (draft, value) => {
      draft.subjectState.group.rows = Math.round(value);
    },
    store,
    { min: 1, max: 8 },
  );
  const spacing = distanceStepper(
    'Row spacing',
    (state) => state.subjectState.group.spacing,
    (draft, value) => {
      draft.subjectState.group.spacing = value;
    },
    store,
  );

  const carView = segmented(CAR_VIEWS, {
    ariaLabel: 'Car view',
    onChange: (id) =>
      store.update((draft) => {
        draft.subjectState.car.angle = CAR_VIEWS.find((entry) => entry.id === id).angle;
      }),
  });
  const carViewRow = element('div', { class: 'field' }, [element('label', { text: 'View' }), carView.node]);
  carViewRow.style.gridTemplateColumns = '1fr';

  const angle = countStepper(
    'Angle',
    (state) => state.subjectState.car.angle,
    (draft, value) => {
      draft.subjectState.car.angle = value;
    },
    store,
    { min: 0, max: 180, step: 5 },
  );
  const carLength = distanceStepper(
    'Length',
    (state) => state.subjectState.car.length,
    (draft, value) => {
      draft.subjectState.car.length = value;
    },
    store,
  );
  const carWidth = distanceStepper(
    'Width',
    (state) => state.subjectState.car.width,
    (draft, value) => {
      draft.subjectState.car.width = value;
    },
    store,
  );

  const rangeDepth = distanceStepper(
    'Depth',
    (state) => state.subjectState.range.depth,
    (draft, value) => {
      draft.subjectState.range.depth = value;
      draft.subjectState.range.infinite = false;
    },
    store,
  );
  const rangeInfinite = element('button', {
    type: 'button',
    class: 'chip',
    text: 'Far is ∞',
    'aria-pressed': 'false',
    onClick: () =>
      store.update((draft) => {
        draft.subjectState.range.infinite = !draft.subjectState.range.infinite;
      }),
  });
  const rangeInfiniteRow = element('div', { class: 'field' }, [
    element('label', { text: 'Far edge' }),
    rangeInfinite,
  ]);

  controlsHost.append(
    distance.node,
    framingRow,
    front.node,
    back.node,
    rows.node,
    spacing.node,
    carViewRow,
    angle.node,
    carLength.node,
    carWidth.node,
    rangeDepth.node,
    rangeInfiniteRow,
  );

  const solveMode = segmented(SOLVE_MODES, {
    ariaLabel: 'Solve for',
    onChange: (id) =>
      store.update((draft) => {
        draft.solveFor = id;
        if (id === 'distance' && draft.focusMode === 'manual') draft.focusMode = 'best';
      }),
  });
  const solveRow = element('div', { class: 'field' }, [element('label', { text: 'Solve for' }), solveMode.node]);
  solveRow.style.gridTemplateColumns = '1fr';

  const apertureMode = segmented(APERTURE_MODES, {
    ariaLabel: 'Aperture preference',
    onChange: (id) => store.set({ apertureMode: id }),
  });
  const apertureModeRow = element('div', { class: 'field' }, [
    element('label', { text: 'Aperture preference' }),
    apertureMode.node,
  ]);
  apertureModeRow.style.gridTemplateColumns = '1fr';

  const focalLength = stepper({
    label: 'Focal length',
    inputMode: 'numeric',
    onStep: (direction) =>
      store.update((draft) => {
        draft.focalLength = clampFocalLength(lensFor(draft), stepFocalLength(draft.focalLength, direction));
        if (draft.solveFor === 'focalLength') draft.solveFor = 'check';
      }),
    onCommit: (text) => {
      const value = Number.parseFloat(text);
      if (!Number.isFinite(value) || value <= 0) return;
      store.update((draft) => {
        draft.focalLength = clampFocalLength(lensFor(draft), value);
        if (draft.solveFor === 'focalLength') draft.solveFor = 'check';
      });
    },
  });

  const aperture = stepper({
    label: 'Aperture',
    onStep: (direction) =>
      store.update((draft) => {
        const lens = lensFor(draft);
        draft.aperture = stepStop(
          draft.aperture,
          direction,
          maxApertureAt(lens, draft.focalLength),
          minApertureAt(lens, draft.focalLength),
        );
        if (draft.solveFor === 'aperture') draft.solveFor = 'check';
      }),
    onCommit: (text) => {
      const value = parseStop(text);
      if (value === undefined) return;
      store.update((draft) => {
        const lens = lensFor(draft);
        draft.aperture = Math.min(
          Math.max(value, maxApertureAt(lens, draft.focalLength)),
          minApertureAt(lens, draft.focalLength),
        );
        if (draft.solveFor === 'aperture') draft.solveFor = 'check';
      });
    },
  });

  const focusModeGroup = segmented([{ id: 'best', name: 'Best point' }], {
    ariaLabel: 'Focus point',
    onChange: (id) => store.set({ focusMode: id }),
  });
  const focusModeRow = element('div', { class: 'field' }, [
    element('label', { text: 'Focus point' }),
    focusModeGroup.node,
  ]);
  focusModeRow.style.gridTemplateColumns = '1fr';

  const focus = distanceStepper(
    'Focus at',
    (state) => state.manualFocus,
    (draft, value) => {
      draft.manualFocus = value;
      draft.focusMode = 'manual';
    },
    store,
  );

  const solveNote = element('p', { class: 'note' });
  solveHost.append(solveRow, apertureModeRow, focalLength.node, aperture.node, focusModeRow, focus.node, solveNote);

  return {
    update(view, state) {
      const subject = findSubject(state.subject);
      picker.update(SUBJECTS, state.subject);

      distance.setLabel(subject.distanceLabel);
      const solvingDistance = state.solveFor === 'distance' && view.solvedDistance !== undefined;
      const shownDistance = solvingDistance ? view.solvedDistance : state.subjectState[state.subject].distance;
      distance.setValue(formatDistance(shownDistance, state.units), { solved: solvingDistance });

      const isPortrait = state.subject === 'portrait';
      framingRow.hidden = !isPortrait;
      front.setHidden(!isPortrait);
      back.setHidden(!isPortrait);
      if (isPortrait) {
        framing.update(PORTRAIT_FRAMINGS, state.subjectState.portrait.framing);
        front.setValue(formatDistance(state.subjectState.portrait.front, state.units));
        back.setValue(formatDistance(state.subjectState.portrait.back, state.units));
      }

      const isGroup = state.subject === 'group';
      rows.setHidden(!isGroup);
      spacing.setHidden(!isGroup);
      if (isGroup) {
        rows.setValue(String(state.subjectState.group.rows));
        spacing.setValue(formatDistance(state.subjectState.group.spacing, state.units));
      }

      const isCar = state.subject === 'car';
      carViewRow.hidden = !isCar;
      angle.setHidden(!isCar);
      carLength.setHidden(!isCar);
      carWidth.setHidden(!isCar);
      if (isCar) {
        const match = CAR_VIEWS.find((entry) => entry.angle === state.subjectState.car.angle);
        carView.update(CAR_VIEWS, match ? match.id : '');
        angle.setValue(`${Math.round(state.subjectState.car.angle)}°`);
        carLength.setValue(formatDistance(state.subjectState.car.length, state.units));
        carWidth.setValue(formatDistance(state.subjectState.car.width, state.units));
      }

      const isRange = state.subject === 'range';
      rangeDepth.setHidden(!isRange || state.subjectState.range.infinite);
      rangeInfiniteRow.hidden = !isRange;
      if (isRange) {
        rangeInfinite.setAttribute('aria-pressed', String(state.subjectState.range.infinite));
        rangeDepth.setValue(formatDistance(state.subjectState.range.depth, state.units));
      }

      const modes = view.isPrime ? SOLVE_MODES.filter((mode) => mode.id !== 'focalLength') : SOLVE_MODES;
      solveMode.update(modes, state.solveFor);
      apertureModeRow.hidden = state.solveFor !== 'aperture';
      apertureMode.update(APERTURE_MODES, state.apertureMode);

      const solvingFocal = state.solveFor === 'focalLength' && view.result.ok;
      focalLength.setValue(`${Math.round(view.focalLength)} mm`, { solved: solvingFocal });

      const solvingAperture = state.solveFor === 'aperture' && view.result.ok;
      aperture.setValue(formatStop(view.aperture), { solved: solvingAperture });

      const focusOptions = [{ id: 'best', name: 'Best point' }];
      if (state.subject === 'portrait') focusOptions.push({ id: 'anchor', name: 'On eyes' });
      if (state.subject === 'group') focusOptions.push({ id: 'anchor', name: 'Front row' });
      focusOptions.push({ id: 'manual', name: 'Manual' });
      focusModeGroup.update(focusOptions, state.focusMode);

      const focusValue = view.result.ok ? view.result.focusSensor : state.manualFocus;
      focus.setValue(formatDistance(focusValue, state.units), { solved: state.focusMode !== 'manual' });

      if (view.apertureCost) {
        const stops = view.apertureCost.stops;
        solveNote.textContent = `At ${Math.round(view.focalLength)} mm this lens opens only to ${formatStop(
          view.apertureCost.after,
        )}, ${stops < 0.4 ? 'a third of a stop' : `${stops.toFixed(1)} stops`} slower than at ${Math.round(
          state.focalLength,
        )} mm.`;
      } else {
        solveNote.textContent = '';
      }
    },
  };
}

export function apertureSummary(view) {
  return view.result.ok ? `f/${stopLabel(view.aperture)}` : '—';
}

export function clearHost(host) {
  clear(host);
}
