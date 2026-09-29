export const PORTRAIT_FRAMINGS = [
  { id: 'both-eyes', name: 'Both eyes', front: 15, back: 15 },
  { id: 'nose-to-ears', name: 'Nose to ears', front: 30, back: 90 },
  { id: 'head-shoulders', name: 'Head and shoulders', front: 30, back: 200 },
  { id: 'full-body', name: 'Full body', front: 100, back: 250 },
  { id: 'custom', name: 'Custom', front: 30, back: 90 },
];

export const CAR_VIEWS = [
  { id: 'front', name: 'Front', angle: 0 },
  { id: 'three-quarter-front', name: '3/4 front', angle: 40 },
  { id: 'side', name: 'Side', angle: 90 },
  { id: 'three-quarter-rear', name: '3/4 rear', angle: 140 },
  { id: 'rear', name: 'Rear', angle: 180 },
];

export const GROUP_FACE = { front: 30, back: 90 };
export const MAX_ROWS = 8;

export const SUBJECTS = [
  { id: 'portrait', name: 'Portrait', distanceLabel: 'Distance to eyes', defaultDistance: 2000 },
  { id: 'group', name: 'Group', distanceLabel: 'Distance to front row', defaultDistance: 4500 },
  { id: 'car', name: 'Car', distanceLabel: 'Distance to nearest point', defaultDistance: 7000 },
  {
    id: 'landscape',
    name: 'Landscape',
    distanceLabel: 'Nearest point that must be sharp',
    defaultDistance: 2000,
  },
  { id: 'range', name: 'Range', distanceLabel: 'Near edge', defaultDistance: 3000 },
];

export const DEFAULT_SUBJECT_STATE = {
  portrait: { distance: 2000, framing: 'nose-to-ears', front: 30, back: 90 },
  group: { distance: 4500, rows: 3, spacing: 600 },
  car: { distance: 7000, length: 4900, width: 1900, angle: 40 },
  landscape: { distance: 2000 },
  range: { distance: 3000, depth: 2000, infinite: false },
};

export function findSubject(id) {
  return SUBJECTS.find((subject) => subject.id === id) || SUBJECTS[0];
}

export function findFraming(id) {
  return PORTRAIT_FRAMINGS.find((framing) => framing.id === id) || PORTRAIT_FRAMINGS[1];
}

export function carDepth(length, width, angleDegrees) {
  const radians = (angleDegrees * Math.PI) / 180;
  return length * Math.abs(Math.cos(radians)) + width * Math.abs(Math.sin(radians));
}

export function targetsFor(subjectId, state, distanceOverride) {
  const config = state[subjectId];
  const distance = distanceOverride === undefined ? config.distance : distanceOverride;

  if (subjectId === 'portrait') {
    return {
      near: distance - config.front,
      far: distance + config.back,
      anchor: distance,
      anchorLabel: 'the eyes',
      stackable: false,
    };
  }
  if (subjectId === 'group') {
    const back = (config.rows - 1) * config.spacing;
    return {
      near: distance - GROUP_FACE.front,
      far: distance + back + GROUP_FACE.back,
      anchor: distance,
      anchorLabel: 'the front row',
      stackable: false,
      rows: config.rows,
      spacing: config.spacing,
    };
  }
  if (subjectId === 'car') {
    return {
      near: distance,
      far: distance + carDepth(config.length, config.width, config.angle),
      anchor: distance,
      anchorLabel: 'the nearest point',
      stackable: true,
    };
  }
  if (subjectId === 'landscape') {
    return {
      near: distance,
      far: Infinity,
      anchor: distance,
      anchorLabel: 'the nearest point',
      stackable: true,
    };
  }
  return {
    near: distance,
    far: config.infinite ? Infinity : distance + config.depth,
    anchor: distance,
    anchorLabel: 'the near edge',
    stackable: true,
  };
}

export function subjectNoun(subjectId) {
  const names = {
    portrait: 'The portrait',
    group: 'The group',
    car: 'The car',
    landscape: 'The scene',
    range: 'The range',
  };
  return names[subjectId] || 'The subject';
}

export function alwaysWholeScene(subjectId, state) {
  if (subjectId === 'landscape') return true;
  return subjectId === 'range' && state.range.infinite;
}
