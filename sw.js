const VERSION = 'v4';
const CACHE = `tack-sharp-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/tokens.css',
  'css/base.css',
  'css/layout.css',
  'css/controls.css',
  'css/diagram.css',
  'js/app.js',
  'js/pwa.js',
  'js/ui/theme.js',
  'js/core/distance.js',
  'js/core/optics.js',
  'js/core/solve.js',
  'js/core/stops.js',
  'js/core/subjects.js',
  'js/data/cameras.js',
  'js/data/tiers.js',
  'js/core/freecalc.js',
  'js/core/stack.js',
  'js/core/units.js',
  'js/core/scene.js',
  'js/state/store.js',
  'js/state/persist.js',
  'js/ui/widgets.js',
  'js/ui/subjectPanel.js',
  'js/ui/verdict.js',
  'js/ui/details.js',
  'js/ui/stackPanel.js',
  'js/ui/tierPanel.js',
  'js/ui/gearPanel.js',
  'js/ui/summary.js',
  'js/ui/howItWorks.js',
  'js/ui/freePanel.js',
  'js/diagram/canvas.js',
  'js/diagram/palette.js',
  'js/diagram/plan.js',
  'js/diagram/wholescene.js',
  'js/diagram/curve.js',
  'js/diagram/silhouettes.js',
];

const ASSETS = [
  'fonts/barlow-400.woff2',
  'fonts/barlow-500.woff2',
  'fonts/barlow-600.woff2',
  'fonts/barlow-semi-condensed-500.woff2',
  'fonts/barlow-semi-condensed-600.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

const PRECACHE = SHELL.concat(ASSETS);

const shellUrls = new Set(SHELL.map((path) => new URL(path, self.registration.scope).href));

function isShell(request) {
  if (request.mode === 'navigate') return true;
  return shellUrls.has(new URL(request.url).href);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        for (const client of clients) client.postMessage({ type: 'sw-activated', version: VERSION });
      }),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit || network.then((response) => response || Response.error());
}

async function navigate(request) {
  const cache = await caches.open(CACHE);
  const shell = await cache.match('index.html', { ignoreSearch: true });
  if (shell) return shell;
  try {
    return await fetch(request);
  } catch (error) {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  event.respondWith(isShell(request) ? cacheFirst(request) : staleWhileRevalidate(request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
});
