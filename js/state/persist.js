const INFINITY_TOKEN = '__inf__';

export function encode(value) {
  return JSON.stringify(value, (key, entry) => (entry === Infinity ? INFINITY_TOKEN : entry));
}

export function decode(text) {
  return JSON.parse(text, (key, entry) => (entry === INFINITY_TOKEN ? Infinity : entry));
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return decode(raw);
  } catch (error) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, encode(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function mergeDefaults(defaults, stored) {
  if (!stored || typeof stored !== 'object') return structuredClone(defaults);
  const out = structuredClone(defaults);
  for (const [key, value] of Object.entries(stored)) {
    if (!(key in out)) continue;
    const base = out[key];
    if (base && typeof base === 'object' && !Array.isArray(base) && value && typeof value === 'object') {
      out[key] = mergeDefaults(base, value);
    } else if (typeof base === typeof value || base === null || Array.isArray(base) === Array.isArray(value)) {
      out[key] = value;
    }
  }
  return out;
}
