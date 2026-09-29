import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const GRAPHITE = [0x15, 0x1a, 0x1f];
const WARN = [0xe0, 0xb4, 0x43];
const SHARP = [0x4d, 0xd1, 0x9a];
const SOFT = [0xe2, 0x65, 0x4c];

const BAR_WIDTH = 0.13;
const BAR_GAP = 0.075;
const BAR_HEIGHTS = [0.36, 0.62, 0.32];
const BAR_COLORS = [WARN, SHARP, SOFT];
const TALLEST = Math.max(...BAR_HEIGHTS);
const PLATE_RADIUS = 0.22;
const SUBSAMPLES = 4;

function crcTable() {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}

const CRC = crcTable();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(px, py, x0, y0, x1, y1, radius) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.min(Math.max(px, x0 + radius), x1 - radius);
  const cy = Math.min(Math.max(py, y0 + radius), y1 - radius);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function coverage(x, y, test) {
  let hits = 0;
  for (let sy = 0; sy < SUBSAMPLES; sy += 1) {
    for (let sx = 0; sx < SUBSAMPLES; sx += 1) {
      const px = x + (sx + 0.5) / SUBSAMPLES;
      const py = y + (sy + 0.5) / SUBSAMPLES;
      if (test(px, py)) hits += 1;
    }
  }
  return hits / (SUBSAMPLES * SUBSAMPLES);
}

function blend(buffer, index, color, alpha) {
  if (alpha <= 0) return;
  const existing = buffer[index + 3] / 255;
  const out = alpha + existing * (1 - alpha);
  for (let c = 0; c < 3; c += 1) {
    const src = color[c] * alpha;
    const dst = buffer[index + c] * existing * (1 - alpha);
    buffer[index + c] = Math.round((src + dst) / out);
  }
  buffer[index + 3] = Math.round(out * 255);
}

function renderIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const contentScale = maskable ? 0.88 : 1;
  const barWidth = BAR_WIDTH * size * contentScale;
  const gap = BAR_GAP * size * contentScale;
  const totalWidth = barWidth * 3 + gap * 2;
  const left = (size - totalWidth) / 2;
  const baseline = (size + TALLEST * size * contentScale) / 2;
  const radius = barWidth / 2;

  const plateRadius = maskable ? 0 : PLATE_RADIUS * size;
  const plate = maskable
    ? () => true
    : (px, py) => insideRoundedRect(px, py, 0, 0, size, size, plateRadius);

  const bars = BAR_HEIGHTS.map((heightFraction, i) => {
    const x0 = left + i * (barWidth + gap);
    const y0 = baseline - heightFraction * size * contentScale;
    return (px, py) => insideRoundedRect(px, py, x0, y0, x0 + barWidth, baseline, radius);
  });

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      blend(rgba, index, GRAPHITE, coverage(x, y, plate));
      for (let b = 0; b < bars.length; b += 1) {
        blend(rgba, index, BAR_COLORS[b], coverage(x, y, bars[b]));
      }
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(join(repoRoot, 'icons'), { recursive: true });

const targets = [
  ['icons/icon-192.png', 192, { maskable: false }],
  ['icons/icon-512.png', 512, { maskable: false }],
  ['icons/icon-maskable-512.png', 512, { maskable: true }],
];

for (const [path, size, options] of targets) {
  const png = renderIcon(size, options);
  writeFileSync(join(repoRoot, path), png);
  process.stdout.write(`${path}  ${size}x${size}  ${png.length} bytes\n`);
}
