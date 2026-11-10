// Offline support: cache the whole app (it's small) on install, serve cache-first.
// Bump VERSION whenever any file below changes so phones pick up the update.
const VERSION = 'shabdkosh-v1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'data/entries.json',
  'src/app.js',
  'src/search.js',
  'src/translit.js',
  'src/distance.js',
  'fonts/tiro-devanagari-hindi-devanagari-400-normal.woff2',
  'fonts/tiro-devanagari-hindi-latin-400-normal.woff2',
  'fonts/tiro-devanagari-hindi-latin-ext-400-normal.woff2',
  'fonts/hanken-grotesk-latin-400-normal.woff2',
  'fonts/hanken-grotesk-latin-600-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
