export function minSensorDistance(focalLength) {
  return 4 * focalLength;
}

export function toObject(sensorDistance, focalLength) {
  if (!Number.isFinite(sensorDistance)) return Infinity;
  const discriminant = sensorDistance * sensorDistance - 4 * sensorDistance * focalLength;
  if (discriminant < 0) return NaN;
  return (sensorDistance + Math.sqrt(discriminant)) / 2;
}

export function toSensor(objectDistance, focalLength) {
  if (!Number.isFinite(objectDistance)) return Infinity;
  if (objectDistance <= focalLength) return NaN;
  return (objectDistance * objectDistance) / (objectDistance - focalLength);
}

export function reachesFocus(sensorDistance, focalLength) {
  return !Number.isFinite(sensorDistance) || sensorDistance >= minSensorDistance(focalLength);
}
