import { formatStop } from '../core/stops.js';
import { formatDistance } from '../core/units.js';
import { clear, element } from './widgets.js';

export function mountSummary({ host }) {
  return {
    update(view, state) {
      clear(host);
      const cells = [
        { term: 'Aperture', value: view.result.ok ? formatStop(view.aperture) : '—', solved: state.solveFor === 'aperture' },
        {
          term: 'Focus at',
          value: view.result.ok ? formatDistance(view.result.focusSensor, state.units) : '—',
          solved: state.focusMode !== 'manual',
        },
        {
          term: 'Focal length',
          value: view.result.ok ? `${Math.round(view.focalLength)} mm` : '—',
          solved: state.solveFor === 'focalLength',
        },
      ];
      if (state.solveFor === 'distance') {
        cells.push({
          term: 'Stand at',
          value: view.solvedDistance === undefined ? '—' : formatDistance(view.solvedDistance, state.units),
          solved: true,
        });
      }
      for (const cell of cells) {
        host.append(
          element('div', { dataset: { solved: String(Boolean(cell.solved)) } }, [
            element('dt', { text: cell.term }),
            element('dd', { class: 'num', text: cell.value }),
          ]),
        );
      }
    },
  };
}
