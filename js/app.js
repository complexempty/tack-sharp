import { registerServiceWorker } from './pwa.js';
import { createStore } from './state/store.js';
import { computeView } from './core/scene.js';
import { shortName } from './data/cameras.js';
import { mountTheme } from './ui/theme.js';
import { mountSubjectPanel } from './ui/subjectPanel.js';
import { mountVerdict } from './ui/verdict.js';
import { mountDetails } from './ui/details.js';
import { mountStackPanel } from './ui/stackPanel.js';
import { mountTierPanel } from './ui/tierPanel.js';
import { mountGearPanel } from './ui/gearPanel.js';
import { mountSummary } from './ui/summary.js';
import { mountHowItWorks } from './ui/howItWorks.js';

function byId(id) {
  return document.getElementById(id);
}

function start() {
  const store = createStore();

  const tabs = [
    { id: 'subject', button: byId('tab-subject'), panel: byId('panel-subject') },
    { id: 'free', button: byId('tab-free'), panel: byId('panel-free') },
  ];
  for (const tab of tabs) {
    tab.button.addEventListener('click', () => store.set({ mode: tab.id }));
  }

  const unitsChip = byId('units-chip');
  unitsChip.addEventListener('click', () =>
    store.set({ units: store.get().units === 'ft' ? 'm' : 'ft' }),
  );

  const cameraChip = byId('camera-chip');
  cameraChip.addEventListener('click', () =>
    byId('gear-section').scrollIntoView({ behavior: 'smooth', block: 'start' }),
  );

  const collapse = byId('stage-collapse');
  const canvas = byId('stage-canvas');
  collapse.addEventListener('click', () => store.set({ diagramOpen: !store.get().diagramOpen }));

  for (const [id, view] of [
    ['view-closeup', 'closeup'],
    ['view-scene', 'scene'],
  ]) {
    byId(id).addEventListener('click', () => store.set({ view }));
  }

  const panels = {
    subject: mountSubjectPanel({
      pickerHost: byId('subject-picker'),
      controlsHost: byId('subject-controls'),
      solveHost: byId('solve-controls'),
      store,
    }),
    verdict: mountVerdict({
      host: byId('verdict'),
      headlineNode: byId('verdict-headline'),
      detailNode: byId('verdict-detail'),
      optionsNode: byId('verdict-options'),
      store,
    }),
    details: mountDetails({ host: byId('details') }),
    stack: mountStackPanel({
      section: byId('stack-section'),
      summaryHost: byId('stack-summary'),
      framesHost: byId('stack-frames'),
    }),
    tier: mountTierPanel({
      pickerHost: byId('tier-picker'),
      customHost: byId('tier-custom'),
      noteHost: byId('tier-note'),
      store,
    }),
    gear: mountGearPanel({
      cameraHost: byId('camera-controls'),
      lensHost: byId('lens-controls'),
      store,
    }),
    summary: mountSummary({ host: byId('summary') }),
  };

  mountTheme(byId('appearance-controls'));
  mountHowItWorks({ host: byId('how-body') });

  function render(state) {
    const view = computeView(state);

    for (const tab of tabs) {
      const selected = tab.id === state.mode;
      tab.button.setAttribute('aria-selected', String(selected));
      tab.panel.hidden = !selected;
    }

    unitsChip.textContent = state.units;
    cameraChip.textContent = shortName(view.camera);

    const showClose = state.view === 'closeup' && !view.forceWholeScene;
    byId('view-closeup').setAttribute('aria-pressed', String(showClose));
    byId('view-scene').setAttribute('aria-pressed', String(!showClose));
    byId('view-closeup').disabled = view.forceWholeScene;

    collapse.setAttribute('aria-expanded', String(state.diagramOpen));
    collapse.textContent = state.diagramOpen ? 'Hide' : 'Show';
    canvas.hidden = !state.diagramOpen;

    panels.tier.update(view, state);
    panels.subject.update(view, state);
    panels.verdict.update(view, state);
    panels.details.update(view, state);
    panels.stack.update(view, state);
    panels.gear.update(view, state);
    panels.summary.update(view, state);
  }

  store.subscribe(render);
  render(store.get());
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
