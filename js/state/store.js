import { DEFAULT_CAMERA_ID } from '../data/cameras.js';
import { DEFAULT_TIER_ID } from '../data/tiers.js';
import { DEFAULT_SUBJECT_STATE } from '../core/subjects.js';
import { NARROWEST_STOP, WIDEST_STOP } from '../core/stops.js';
import { PERFECT_LENS_ID } from '../lens/profiles.js';
import { load, mergeDefaults, save } from './persist.js';

const KEY = 'tacksharp.state';

export const DEFAULT_STATE = {
  mode: 'subject',
  units: 'ft',
  cameraId: DEFAULT_CAMERA_ID,
  customCamera: { width: 35.9, height: 24.0, pixelsWide: 9984, pixelsHigh: 6656 },
  tierId: DEFAULT_TIER_ID,
  customTierMicrons: 15,
  diffraction: true,
  apertureMin: WIDEST_STOP,
  apertureMax: NARROWEST_STOP,
  lensId: PERFECT_LENS_ID,
  framePosition: 'center',
  lenses: [],
  subject: 'portrait',
  subjectState: DEFAULT_SUBJECT_STATE,
  focalLength: 85,
  aperture: 2 ** (18 / 6),
  solveFor: 'aperture',
  apertureMode: 'widest',
  focusMode: 'best',
  manualFocus: 2000,
  view: 'closeup',
  diagramOpen: true,
  free: {
    locked: ['focalLength', 'aperture', 'focus'],
    order: ['focalLength', 'aperture', 'focus'],
    values: { focalLength: 50, aperture: 2 ** (18 / 6), focus: 3000, near: 0, far: 0 },
  },
};

export function createStore() {
  let state = mergeDefaults(DEFAULT_STATE, load(KEY, undefined));
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener(state);
  }

  return {
    get() {
      return state;
    },
    set(patch) {
      state = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      save(KEY, state);
      notify();
    },
    update(mutator) {
      const draft = structuredClone(state);
      mutator(draft);
      state = draft;
      save(KEY, state);
      notify();
    },
    reset() {
      state = structuredClone(DEFAULT_STATE);
      save(KEY, state);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
