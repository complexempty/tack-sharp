export const CAMERAS = [
  { id: 'a7r6', name: 'Sony a7R VI', width: 35.9, height: 24.0, pixelsWide: 9984, pixelsHigh: 6656 },
  { id: 'a7r5', name: 'Sony a7R V', width: 35.7, height: 23.8, pixelsWide: 9504, pixelsHigh: 6336 },
  { id: 'a1ii', name: 'Sony a1 II', width: 35.9, height: 24.0, pixelsWide: 8640, pixelsHigh: 5760 },
  { id: 'a7v', name: 'Sony a7 V', width: 35.9, height: 23.9, pixelsWide: 7008, pixelsHigh: 4672 },
  { id: 'a7iv', name: 'Sony a7 IV', width: 35.9, height: 23.9, pixelsWide: 7008, pixelsHigh: 4672 },
  { id: 'a7cr', name: 'Sony a7C R', width: 35.7, height: 23.8, pixelsWide: 9504, pixelsHigh: 6336 },
  { id: 'a7cii', name: 'Sony a7C II', width: 35.9, height: 23.9, pixelsWide: 7008, pixelsHigh: 4672 },
  { id: 'a9iii', name: 'Sony a9 III', width: 35.6, height: 23.8, pixelsWide: 6000, pixelsHigh: 4000 },
  { id: 'a7siii', name: 'Sony a7S III', width: 35.6, height: 23.8, pixelsWide: 4240, pixelsHigh: 2832 },
];

export const DEFAULT_CAMERA_ID = 'a7r6';

export const FULL_FRAME_DIAGONAL = 43.27;

export function shortName(camera) {
  return camera.name.replace(/^Sony\s+/, '');
}

export function pixelPitch(camera) {
  return Math.sqrt((camera.width * camera.height) / (camera.pixelsWide * camera.pixelsHigh));
}

export function sensorDiagonal(camera) {
  return Math.hypot(camera.width, camera.height);
}

export function megapixels(camera) {
  return (camera.pixelsWide * camera.pixelsHigh) / 1e6;
}

export function findCamera(id) {
  return CAMERAS.find((camera) => camera.id === id) || CAMERAS[0];
}

export function customCamera({ width, height, pixelsWide, pixelsHigh }) {
  return { id: 'custom', name: 'Custom', width, height, pixelsWide, pixelsHigh };
}
