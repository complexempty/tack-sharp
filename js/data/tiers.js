import { pixelPitch, sensorDiagonal, FULL_FRAME_DIAGONAL } from './cameras.js';

export const TIERS = [
  {
    id: 'pixel',
    name: 'Pixel-level',
    blurb: 'Sharp at 100% zoom.',
    limit: (camera) => 2 * pixelPitch(camera),
  },
  {
    id: 'critical',
    name: 'Critical',
    blurb: 'Large prints and heavy crops.',
    limit: (camera) => standardLimit(camera) / 2,
  },
  {
    id: 'standard',
    name: 'Standard',
    blurb: 'The whole image on a screen or a small print.',
    limit: (camera) => standardLimit(camera),
  },
  {
    id: 'custom',
    name: 'Custom',
    blurb: 'Your own limit, in microns.',
    limit: (camera, customMicrons) => (customMicrons || 0) / 1000,
  },
];

export const DEFAULT_TIER_ID = 'critical';

export function standardLimit(camera) {
  return (0.03 * sensorDiagonal(camera)) / FULL_FRAME_DIAGONAL;
}

export function findTier(id) {
  return TIERS.find((tier) => tier.id === id) || TIERS[1];
}

export function tierLimit(tierId, camera, customMicrons) {
  return findTier(tierId).limit(camera, customMicrons);
}

export function looserTiersThan(tierId) {
  const order = ['pixel', 'critical', 'standard'];
  const index = order.indexOf(tierId);
  if (index < 0) return [];
  return order.slice(index + 1);
}
