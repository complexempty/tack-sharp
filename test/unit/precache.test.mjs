import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'test', 'tools', 'test-results', 'playwright-report']);
const SKIP_FILES = new Set([
  'sw.js',
  'CLAUDE.md',
  'README.md',
  'package.json',
  'package-lock.json',
  'playwright.config.mjs',
  '.gitignore',
  '.nojekyll',
]);

async function walk(directory, collected = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(join(directory, entry.name), collected);
    } else {
      const path = relative(root, join(directory, entry.name)).split(sep).join('/');
      if (SKIP_FILES.has(path)) continue;
      collected.push(path);
    }
  }
  return collected;
}

function listedPaths(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `sw.js is missing the ${name} array`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

test('the service worker precaches every servable file', async () => {
  const source = await readFile(join(root, 'sw.js'), 'utf8');
  const precached = new Set([...listedPaths(source, 'SHELL'), ...listedPaths(source, 'ASSETS')]);
  const onDisk = await walk(root);
  const missing = onDisk.filter((path) => !precached.has(path));
  assert.deepEqual(missing, [], `not precached: ${missing.join(', ')}`);
});

test('every precached path exists on disk', async () => {
  const source = await readFile(join(root, 'sw.js'), 'utf8');
  const precached = [...listedPaths(source, 'SHELL'), ...listedPaths(source, 'ASSETS')].filter(
    (path) => path !== './',
  );
  const onDisk = new Set(await walk(root));
  const stale = precached.filter((path) => !onDisk.has(path));
  assert.deepEqual(stale, [], `precached but absent: ${stale.join(', ')}`);
});
