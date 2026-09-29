const TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'stage',
  'line',
  'line-strong',
  'text',
  'muted',
  'accent',
  'sharp',
  'warn',
  'soft',
];

export const WARN_AT = 1.25;
export const SOFT_AT = 2.5;
export const FADE_AT = 4;

function parseHex(value) {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

export function readPalette() {
  const styles = getComputedStyle(document.documentElement);
  const palette = {};
  for (const token of TOKENS) {
    palette[token.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = parseHex(
      styles.getPropertyValue(`--${token}`) || '#000000',
    );
  }
  return palette;
}

export function rgba([r, g, b], alpha = 1) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mix(a, b, t) {
  const clamped = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
  ];
}

export function blurColor(ratio, palette) {
  if (!Number.isFinite(ratio)) return { colour: palette.soft, alpha: 0 };
  if (ratio <= 1) return { colour: palette.sharp, alpha: 1 };
  if (ratio <= WARN_AT) {
    return { colour: mix(palette.sharp, palette.warn, (ratio - 1) / (WARN_AT - 1)), alpha: 1 };
  }
  if (ratio <= SOFT_AT) {
    return { colour: mix(palette.warn, palette.soft, (ratio - WARN_AT) / (SOFT_AT - WARN_AT)), alpha: 1 };
  }
  return {
    colour: palette.soft,
    alpha: Math.max(0, 1 - (ratio - SOFT_AT) / (FADE_AT - SOFT_AT)),
  };
}

export function blurStyle(ratio, palette, alphaScale = 1) {
  const { colour, alpha } = blurColor(ratio, palette);
  return rgba(colour, alpha * alphaScale);
}

export function gradientAcross(ctx, x0, x1, ratioAt, palette, alphaScale = 1, samples = 28) {
  const gradient = ctx.createLinearGradient(x0, 0, x1, 0);
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    gradient.addColorStop(t, blurStyle(ratioAt(x0 + (x1 - x0) * t), palette, alphaScale));
  }
  return gradient;
}
