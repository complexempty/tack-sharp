import { ERROR_MESSAGES } from '../core/scene.js';
import { formatStop } from '../core/stops.js';
import { formatDistance, formatMicrons, formatMultiple } from '../core/units.js';
import { clear, element, optionButton } from './widgets.js';

export function mountVerdict({ host, headlineNode, detailNode, optionsNode, store }) {
  return {
    update(view, state) {
      clear(optionsNode);

      if (!view.result.ok) {
        const builder = ERROR_MESSAGES[view.result.error];
        const message = builder
          ? builder(view, state.units)
          : { headline: 'Cannot solve these settings', detail: 'Adjust the distance, focal length or aperture.' };
        host.dataset.state = 'error';
        headlineNode.textContent = message.headline;
        detailNode.textContent = message.detail;
        return;
      }

      const blur = formatMicrons(view.result.blur);
      const limit = formatMicrons(view.limit);

      if (view.state === 'pass') {
        host.dataset.state = 'pass';
        headlineNode.textContent = `${view.subjectNoun} will be tack sharp`;
        detailNode.textContent = `Worst edge ${blur} against a ${limit} limit.`;
        return;
      }

      if (view.state === 'marginal') {
        host.dataset.state = 'marginal';
        headlineNode.textContent = `${view.subjectNoun} is borderline`;
        detailNode.textContent = `Worst edge ${blur} against a ${limit} limit, ${formatMultiple(
          view.ratio,
        )} the limit. That is inside the model's own uncertainty, so treat it as a coin toss.`;
      } else {
        host.dataset.state = 'fail';
        headlineNode.textContent = `${view.subjectNoun} will not be tack sharp`;
        detailNode.textContent = `Best achievable ${formatMicrons(
          view.result.sharpest.blur,
        )} at ${formatStop(view.result.sharpest.aperture)}, ${formatMultiple(
          view.result.sharpest.blur / view.limit,
        )} the ${limit} limit.`;
      }

      const options = view.options || {};
      const list = element('div', { class: 'segmented' });

      if (options.apertures && options.apertures.length) {
        const first = options.apertures[0];
        list.append(
          optionButton(`Use f/${first.label}`, () =>
            store.update((draft) => {
              draft.aperture = first.value;
              draft.solveFor = 'check';
            }),
          ),
        );
      }

      if (options.stepBack) {
        list.append(
          optionButton(
            `Step back to ${formatDistance(options.stepBack.distance, state.units)} at ${formatStop(
              options.stepBack.aperture,
            )}`,
            () =>
              store.update((draft) => {
                draft.subjectState[draft.subject].distance = options.stepBack.distance;
                draft.aperture = options.stepBack.aperture;
                draft.solveFor = 'check';
              }),
          ),
        );
      }

      if (options.looserTier) {
        list.append(
          optionButton(
            `${options.looserTier.tierName} works at f/${options.looserTier.stop.label}`,
            () =>
              store.update((draft) => {
                draft.tierId = options.looserTier.tierId;
                draft.aperture = options.looserTier.stop.value;
                draft.solveFor = 'check';
              }),
          ),
        );
      }

      if (options.stack) {
        const frames = options.stack.frames.length;
        list.append(
          optionButton(`Focus stack: ${frames} frame${frames === 1 ? '' : 's'} at f/${options.stack.stop.label}`, () =>
            document.getElementById('stack-section').scrollIntoView({ behavior: 'smooth', block: 'start' }),
          ),
        );
      }

      if (options.stepBack) {
        optionsNode.append(
          element('p', {
            class: 'note',
            text: 'Stepping back makes the subject smaller in the frame.',
          }),
        );
      }

      if (list.childElementCount) optionsNode.prepend(list);
    },
  };
}
