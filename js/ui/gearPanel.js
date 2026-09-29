import { CAMERAS, megapixels, pixelPitch } from '../data/cameras.js';
import { formatStop, parseStop, stepStop } from '../core/stops.js';
import { formatMicrons } from '../core/units.js';
import { element, stepper, switchRow } from './widgets.js';

export function mountGearPanel({ cameraHost, lensHost, store }) {
  const select = element('select', { class: 'select', 'aria-label': 'Camera' });
  for (const camera of CAMERAS) select.append(element('option', { value: camera.id, text: camera.name }));
  select.append(element('option', { value: 'custom', text: 'Custom' }));
  select.addEventListener('change', () => store.set({ cameraId: select.value }));
  const cameraRow = element('div', { class: 'field' }, [element('label', { text: 'Camera' }), select]);

  const sensorFields = [
    ['width', 'Sensor width', 'mm'],
    ['height', 'Sensor height', 'mm'],
    ['pixelsWide', 'Pixels wide', ''],
    ['pixelsHigh', 'Pixels high', ''],
  ].map(([key, label, suffix]) => {
    const control = stepper({
      label,
      inputMode: 'decimal',
      onStep: (direction) =>
        store.update((draft) => {
          const step = suffix === 'mm' ? 0.1 : 16;
          draft.customCamera[key] = Math.max(0.1, draft.customCamera[key] + direction * step);
        }),
      onCommit: (text) => {
        const value = Number.parseFloat(text);
        if (!Number.isFinite(value) || value <= 0) return;
        store.update((draft) => {
          draft.customCamera[key] = value;
        });
      },
    });
    return { key, suffix, control };
  });

  const pitchNote = element('p', { class: 'note' });

  const diffraction = switchRow({
    label: 'Include diffraction',
    onChange: (checked) => store.set({ diffraction: checked }),
  });

  cameraHost.append(cameraRow, ...sensorFields.map((field) => field.control.node), pitchNote, diffraction.node);

  const lensNote = element('p', {
    class: 'note',
    text: 'Perfect lens: no aberration, just defocus and diffraction. Measured lens profiles arrive in phase 2.',
  });

  const widest = stepper({
    label: 'Widest aperture',
    onStep: (direction) =>
      store.update((draft) => {
        const next = stepStop(draft.apertureMin, direction, undefined, undefined);
        draft.apertureMin = Math.min(next, draft.apertureMax);
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
        const next = stepStop(draft.apertureMax, direction, undefined, undefined);
        draft.apertureMax = Math.max(next, draft.apertureMin);
      }),
    onCommit: (text) => {
      const value = parseStop(text);
      if (value === undefined) return;
      store.update((draft) => {
        draft.apertureMax = Math.max(value, draft.apertureMin);
      });
    },
  });

  lensHost.append(lensNote, widest.node, smallest.node);

  return {
    update(view, state) {
      if (select.value !== state.cameraId) select.value = state.cameraId;
      const isCustom = state.cameraId === 'custom';
      for (const field of sensorFields) {
        field.control.setHidden(!isCustom);
        const value = state.customCamera[field.key];
        field.control.setValue(field.suffix ? `${value} ${field.suffix}` : String(Math.round(value)));
      }
      pitchNote.textContent = `${megapixels(view.camera).toFixed(1)} MP, ${formatMicrons(
        pixelPitch(view.camera),
      )} pixel pitch.`;
      diffraction.setChecked(state.diffraction);
      widest.setValue(formatStop(state.apertureMin));
      smallest.setValue(formatStop(state.apertureMax));
    },
  };
}
