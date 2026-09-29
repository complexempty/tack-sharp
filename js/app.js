import { registerServiceWorker } from './pwa.js';
import { mountTheme } from './ui/theme.js';

function mountTabs() {
  const tabs = [
    { button: document.getElementById('tab-subject'), panel: document.getElementById('panel-subject') },
    { button: document.getElementById('tab-free'), panel: document.getElementById('panel-free') },
  ];
  tabs.forEach((entry, index) => {
    entry.button.addEventListener('click', () => {
      tabs.forEach((other, otherIndex) => {
        const selected = otherIndex === index;
        other.button.setAttribute('aria-selected', String(selected));
        other.panel.hidden = !selected;
      });
    });
  });
}

function mountStageCollapse() {
  const button = document.getElementById('stage-collapse');
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('stage-canvas');
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    button.textContent = open ? 'Show' : 'Hide';
    canvas.hidden = open;
    stage.classList.toggle('collapsed', open);
  });
}

function start() {
  mountTabs();
  mountStageCollapse();
  mountTheme(document.getElementById('appearance-controls'));
  document.getElementById('verdict-headline').textContent = 'Solver arrives in the next commit';
  document.getElementById('verdict-detail').textContent =
    'The shell, theming, icons and offline caching are in place.';
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
