import { availableLenses } from '../core/scene.js';
import { FRAME_POSITIONS, PERFECT_LENS_ID, isPrime, maxApertureAt, minApertureAt, minFocusAt } from '../lens/profiles.js';
import { formatStop, parseStop, stepStop } from '../core/stops.js';
import { formatDistance } from '../core/units.js';
import { element, stepper } from './widgets.js';

export function mountLensPanel({ host, store }) {
  const select = element('select', { class: 'select', 'aria-label': 'Lens' });
  select.addEventListener('change', () =>
    store.update((draft) => {
      draft.lensId = select.value;
      const lens = availableLenses(draft).find((entry) => entry.id === select.value);
      if (lens) {
        draft.focalLength = Math.min(Math.max(draft.focalLength, lens.focal.min), lens.focal.max);
        if (isPrime(lens)) {
          draft.focalLength = lens.focal.min;
          if (draft.solveFor === 'focalLength') draft.solveFor = 'check';
        }
      }
    }),
  );
  const lensRow = element('div', { class: 'field' }, [element('label', { text: 'Lens' }), select]);

  const widest = stepper({
    label: 'Widest aperture',
    onStep: (direction) =>
      store.update((draft) => {
        draft.apertureMin = Math.min(stepStop(draft.apertureMin, direction), draft.apertureMax);
      }),
    onCommit: (text) => {
      const value = parseStop(text);
      if (value === undefined) return;
      store.update((draft) => {
        draft.apertureMin = Math.min(value, draft.apertureMax);
      });
    },
  });

  const smallest = stepper({
    label: 'Smallest aperture',
    onStep: (direction) =>
      store.update((draft) => {
        draft.apertureMax = Math.max(stepStop(draft.apertureMax, direction), draft.apertureMin);
      }),
    onCommit: (text) => {
      const value = parseStop(text);
      if (value === undefined) return;
      store.update((draft) => {
        draft.apertureMax = Math.max(value, draft.apertureMin);
      });
    },
  });

  const summary = element('p', { class: 'note' });
  const calibration = element('p', { class: 'note' });

  host.append(lensRow, widest.node, smallest.node, summary, calibration);

  let renderedIds = '';

  return {
    update(view, state) {
      const lenses = availableLenses(state);
      const ids = lenses.map((lens) => lens.id).join('|');
      if (ids !== renderedIds) {
        renderedIds = ids;
        select.replaceChildren(
          ...lenses.map((lens) => element('option', { value: lens.id, text: lens.name })),
        );
      }
      if (select.value !== state.lensId) select.value = state.lensId;

      const perfect = state.lensId === PERFECT_LENS_ID;
      widest.setHidden(!perfect);
      smallest.setHidden(!perfect);
      if (perfect) {
        widest.setValue(formatStop(state.apertureMin));
        smallest.setValue(formatStop(state.apertureMax));
        summary.textContent = 'No aberration, just defocus and diffraction.';
        calibration.textContent = '';
        return;
      }

      const lens = view.lens;
      const focal = view.focalLength;
      const range = isPrime(lens) ? `${lens.focal.min} mm` : `${lens.focal.min} to ${lens.focal.max} mm`;
      summary.textContent = `${range}, ${formatStop(maxApertureAt(lens, focal))} to ${formatStop(
        minApertureAt(lens, focal),
      )} at ${Math.round(focal)} mm, closest focus ${formatDistance(minFocusAt(lens, focal), state.units)}.`;
      calibration.textContent = lens.calibrated
        ? 'Measured from your own test shots.'
        : 'Not calibrated yet, so aberration counts as zero. Until you measure it, this lens reads as a perfect one.';
    },
  };
}

export function mountFramePosition({ host, store }) {
  const group = element('div', { class: 'segmented', role: 'group', 'aria-label': 'Frame position' });
  const buttons = FRAME_POSITIONS.map((zone) => {
    const button = element('button', {
      type: 'button',
      text: zone.name,
      onClick: () => store.set({ framePosition: zone.id }),
    });
    group.append(button);
    return { zone, button };
  });
  const row = element('div', { class: 'field' }, [
    element('label', { text: 'Where in the frame' }),
    group,
  ]);
  row.style.gridTemplateColumns = '1fr';
  host.append(row);

  return {
    update(view, state) {
      row.hidden = state.lensId === PERFECT_LENS_ID;
      for (const entry of buttons) {
        entry.button.setAttribute('aria-pressed', String(entry.zone.id === state.framePosition));
      }
    },
  };
}
