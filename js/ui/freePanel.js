import { computedFields, lockField, solveFree } from '../core/freecalc.js';
import { DIFFRACTION_K } from '../core/optics.js';
import { formatStop, parseStop, stepStop, stopAtOrAbove } from '../core/stops.js';
import { formatDistance, parseDistance, stepDistance, stepFocalLength } from '../core/units.js';
import { limitFor } from '../core/scene.js';
import { element } from './widgets.js';

const LOCKED_PATH = 'M7 9V6.5a3 3 0 0 1 6 0V9M5.5 9h9v6.5h-9z';
const OPEN_PATH = 'M7 9V6.5a3 3 0 0 1 5.8-1M5.5 9h9v6.5h-9z';

const ERRORS = {
  'near-not-closer': 'The near limit must be closer than the focus distance.',
  'far-not-farther': 'The far limit must be farther than the focus distance.',
  'too-close': 'That near limit is closer than this focal length can focus.',
  'no-aperture-holds': 'No aperture holds that depth at this standard. Loosen the standard or accept less depth.',
  'no-focal-length': 'No focal length reaches those limits.',
  'no-aperture': 'No aperture reaches those limits.',
  unreachable: 'Those limits are beyond what this lens setting can reach.',
  degenerate: 'Focus, near and far cannot all be locked at once.',
};

function lockIcon(locked) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', locked ? LOCKED_PATH : OPEN_PATH);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

export function mountFreePanel({ host, noteHost, store }) {
  const rows = new Map();
  let hint = '';
  let lastValues = { ...store.get().free.values };

  function setValue(field, value) {
    store.update((draft) => {
      draft.free.values[field] = value;
      draft.free.locked = lockField(draft.free.locked, field);
    });
  }

  function makeRow(field, label, { onStep, onCommit, extra }) {
    const lock = element('button', {
      type: 'button',
      class: 'lock',
      'aria-label': `Lock state for ${label}`,
    });
    lock.append(lockIcon(true));
    lock.addEventListener('click', () => {
      const locked = store.get().free.locked.includes(field);
      hint = locked
        ? 'Three fields stay locked. Edit a different field and this one releases.'
        : `${label} is calculated. Type in it to lock it.`;
      render(store.get());
    });

    const input = element('input', {
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    let editing = false;
    input.addEventListener('focus', () => {
      editing = true;
    });
    input.addEventListener('blur', () => {
      editing = false;
      onCommit(input.value);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur();
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        onStep(1);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onStep(-1);
      }
    });

    const down = element('button', { type: 'button', text: '−', 'aria-label': `Decrease ${label}`, onClick: () => onStep(-1) });
    const up = element('button', { type: 'button', text: '+', 'aria-label': `Increase ${label}`, onClick: () => onStep(1) });
    const stepperBox = element('div', { class: 'stepper' }, [down, input, up]);

    const labelNode = element('span', { class: 'free-label', text: label });
    const head = element('div', { class: 'free-head' }, [lock, labelNode]);
    const row = element('div', { class: 'field free-row' }, [head, stepperBox, extra].filter(Boolean));

    rows.set(field, {
      row,
      lock,
      input,
      stepperBox,
      setLocked(locked) {
        lock.replaceChildren(lockIcon(locked));
        lock.setAttribute('aria-pressed', String(locked));
        row.classList.toggle('computed', !locked);
        stepperBox.classList.toggle('solved', !locked);
      },
      setText(text) {
        if (!editing) input.value = text;
      },
    });
    return row;
  }

  const infinityButton = element('button', {
    type: 'button',
    class: 'chip',
    text: '∞',
    'aria-label': 'Set the far limit to infinity',
    onClick: () => setValue('far', Infinity),
  });

  host.append(
    makeRow('focalLength', 'Focal length', {
      onStep: (direction) => setValue('focalLength', stepFocalLength(lastValues.focalLength, direction)),
      onCommit: (text) => {
        const value = Number.parseFloat(text);
        if (Number.isFinite(value) && value > 0) setValue('focalLength', value);
      },
    }),
    makeRow('aperture', 'Aperture', {
      onStep: (direction) => setValue('aperture', stepStop(lastValues.aperture, direction)),
      onCommit: (text) => {
        const value = parseStop(text);
        if (value !== undefined) setValue('aperture', value);
      },
    }),
    makeRow('focus', 'Focus distance', {
      onStep: (direction) => setValue('focus', stepDistance(lastValues.focus, direction)),
      onCommit: (text) => {
        const value = parseDistance(text, store.get().units);
        if (value !== undefined) setValue('focus', value);
      },
    }),
    makeRow('near', 'Near limit', {
      onStep: (direction) => setValue('near', stepDistance(lastValues.near, direction)),
      onCommit: (text) => {
        const value = parseDistance(text, store.get().units);
        if (value !== undefined) setValue('near', value);
      },
    }),
    makeRow('far', 'Far limit', {
      onStep: (direction) => setValue('far', stepDistance(lastValues.far, direction)),
      onCommit: (text) => {
        const value = parseDistance(text, store.get().units);
        if (value !== undefined) setValue('far', value);
      },
      extra: infinityButton,
    }),
  );

  function format(field, value, units) {
    if (field === 'focalLength') return `${Math.round(value)} mm`;
    if (field === 'aperture') return formatStop(value);
    return formatDistance(value, units);
  }

  function render(state) {
    const locked = state.free.locked;
    const solved = solveFree(locked, state.free.values, {
      limit: limitFor(state),
      k: state.diffraction ? DIFFRACTION_K : 0,
    });

    const values = solved.ok ? solved.values : state.free.values;
    lastValues = { ...values };
    for (const [field, row] of rows) {
      row.setLocked(locked.includes(field));
      const value = values[field];
      row.setText(Number.isFinite(value) || value === Infinity ? format(field, value, state.units) : '—');
    }
    infinityButton.setAttribute('aria-pressed', String(values.far === Infinity));

    const messages = [];
    if (hint) messages.push(hint);
    if (!solved.ok) {
      messages.push(ERRORS[solved.error] || 'Those settings cannot be solved.');
    } else if (!locked.includes('aperture')) {
      const marked = stopAtOrAbove(values.aperture, state.apertureMin, state.apertureMax);
      if (marked) messages.push(`Set the camera to f/${marked.label}.`);
    }
    noteHost.textContent = messages.join(' ');
    hint = '';
  }

  return {
    update(view, state) {
      render(state);
    },
    computed() {
      return computedFields(store.get().free.locked);
    },
  };
}
