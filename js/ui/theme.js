const KEY = 'tacksharp.theme';
const CHOICES = ['auto', 'light', 'dark'];
const LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' };

const lightQuery = window.matchMedia('(prefers-color-scheme: light)');

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (CHOICES.includes(raw)) return raw;
  } catch (error) {
    return 'dark';
  }
  return 'dark';
}

function write(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch (error) {
    return;
  }
}

function resolve(preference) {
  if (preference !== 'auto') return preference;
  return lightQuery.matches ? 'light' : 'dark';
}

function apply(preference) {
  const resolved = resolve(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePref = preference;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#eef1f3' : '#151a1f');
}

export function mountTheme(container) {
  let preference = read();
  apply(preference);

  const row = document.createElement('div');
  row.className = 'switch-row';
  const label = document.createElement('span');
  label.textContent = 'Theme';
  const group = document.createElement('div');
  group.className = 'segmented';
  row.append(label, group);

  const buttons = CHOICES.map((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = LABELS[choice];
    button.addEventListener('click', () => {
      preference = choice;
      write(choice);
      apply(choice);
      sync();
    });
    group.append(button);
    return button;
  });

  function sync() {
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(CHOICES[index] === preference));
    });
  }

  lightQuery.addEventListener('change', () => {
    if (preference === 'auto') apply(preference);
  });

  sync();
  container.append(row);
}
