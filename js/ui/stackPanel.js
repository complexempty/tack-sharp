import { formatDistance } from '../core/units.js';
import { clear, element } from './widgets.js';

export function mountStackPanel({ section, summaryHost, framesHost }) {
  return {
    update(view, state) {
      const stack = view.options && view.options.stack;
      section.hidden = !stack;
      clear(summaryHost);
      clear(framesHost);
      if (!stack) return;

      const count = stack.frames.length;
      summaryHost.append(
        element('p', {
          text: `${count} frame${count === 1 ? '' : 's'} at f/${stack.stop.label}, from nearest to farthest.`,
        }),
      );
      if (stack.truncated) {
        summaryHost.append(
          element('p', {
            class: 'note',
            text: 'Capped at 99 frames. Open up, step back, or loosen the standard.',
          }),
        );
      }

      for (const focus of stack.frames) {
        framesHost.append(element('li', { class: 'num', text: formatDistance(focus, state.units) }));
      }
    },
  };
}
