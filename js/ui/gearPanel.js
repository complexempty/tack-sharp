import { CAMERAS, megapixels, pixelPitch } from '../data/cameras.js';
import { formatMicrons } from '../core/units.js';
import { element, stepper, switchRow } from './widgets.js';

export function mountGearPanel({ cameraHost, store }) {
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
    },
  };
}
