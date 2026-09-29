import { TIERS, findTier } from '../data/tiers.js';
import { formatMicrons, formatPixels } from '../core/units.js';
import { element, segmented, stepper } from './widgets.js';

export function mountTierPanel({ pickerHost, customHost, noteHost, store }) {
  const picker = segmented(TIERS, {
    ariaLabel: 'Sharpness standard',
    onChange: (id) => store.set({ tierId: id }),
  });
  pickerHost.append(picker.node);

  const custom = stepper({
    label: 'Custom limit',
    onStep: (direction) =>
      store.update((draft) => {
        draft.customTierMicrons = Math.max(0.5, Math.round((draft.customTierMicrons + direction * 0.5) * 10) / 10);
      }),
    onCommit: (text) => {
      const value = Number.parseFloat(text);
      if (!Number.isFinite(value) || value <= 0) return;
      store.set({ customTierMicrons: value });
    },
  });
  customHost.append(custom.node);

  return {
    update(view, state) {
      picker.update(TIERS, state.tierId);
      customHost.hidden = state.tierId !== 'custom';
      custom.setValue(`${state.customTierMicrons} µm`);
      const tier = findTier(state.tierId);
      noteHost.textContent = `${tier.blurb} ${formatMicrons(view.limit)} on the ${
        view.camera.name
      }, which is ${formatPixels(view.limit, view.pitch)}.`;
    },
  };
}

export function tierChip(tierId) {
  return element('span', { text: findTier(tierId).name });
}
