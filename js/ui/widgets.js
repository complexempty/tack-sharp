export function element(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.firstChild.remove();
}

export function segmented(options, { onChange, ariaLabel } = {}) {
  const group = element('div', { class: 'segmented', role: 'group', 'aria-label': ariaLabel });
  let buttons = [];

  function render(items, active) {
    clear(group);
    buttons = items.map((item) => {
      const button = element('button', {
        type: 'button',
        text: item.name,
        'aria-pressed': String(item.id === active),
        onClick: () => onChange(item.id),
      });
      group.append(button);
      return { item, button };
    });
  }

  render(options, options[0] && options[0].id);

  return {
    node: group,
    update(items, active) {
      const sameShape =
        buttons.length === items.length && buttons.every((entry, i) => entry.item.id === items[i].id);
      if (!sameShape) render(items, active);
      buttons.forEach((entry) => entry.button.setAttribute('aria-pressed', String(entry.item.id === active)));
    },
  };
}

export function stepper({ label, onStep, onCommit, inputMode = 'decimal' }) {
  const input = element('input', { type: 'text', inputmode: inputMode, autocomplete: 'off', spellcheck: 'false' });
  const down = element('button', { type: 'button', text: '−', 'aria-label': `Decrease ${label}`, onClick: () => onStep(-1) });
  const up = element('button', { type: 'button', text: '+', 'aria-label': `Increase ${label}`, onClick: () => onStep(1) });
  const box = element('div', { class: 'stepper' }, [down, input, up]);
  const labelNode = element('label', { text: label });
  const row = element('div', { class: 'field' }, [labelNode, box]);

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

  const api = {
    node: row,
    input,
    setLabel(text) {
      labelNode.textContent = text;
    },
    setValue(text, { solved = false } = {}) {
      if (!editing) input.value = text;
      box.classList.toggle('solved', solved);
      row.classList.toggle('solved', solved);
    },
    setHidden(hidden) {
      row.hidden = hidden;
    },
  };
  return api;
}

export function switchRow({ label, onChange }) {
  const button = element('button', {
    type: 'button',
    class: 'switch',
    role: 'switch',
    'aria-checked': 'false',
    'aria-label': label,
  });
  button.addEventListener('click', () => onChange(button.getAttribute('aria-checked') !== 'true'));
  const row = element('div', { class: 'switch-row' }, [element('span', { text: label }), button]);
  return {
    node: row,
    setChecked(checked) {
      button.setAttribute('aria-checked', String(Boolean(checked)));
    },
  };
}

export function readout(term, value) {
  return element('div', { class: 'readout' }, [
    element('dt', { text: term }),
    element('dd', { text: value }),
  ]);
}

export function optionButton(text, onClick) {
  return element('button', { type: 'button', class: 'chip', text, onClick });
}
