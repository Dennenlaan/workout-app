// Service worker — stale-while-revalidate voor de app-shell.
// Verhoog de versie in CACHE bij elke release zodat oude caches worden opgeruimd.
// Let op: op GitHub Pages delen al je sites (gebruiker.github.io/*) dezelfde cache-opslag,
// dus we ruimen ALLEEN caches met ons eigen voorvoegsel op.
const CACHE_PREFIX = 'workout-tracker-';
const CACHE = `${CACHE_PREFIX}v6`;
const isOurOldCache = (k) => k !== CACHE && (k.startsWith(CACHE_PREFIX) || /^workout-v\d+$/.test(k));
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(isOurOldCache).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Tik op een herinnering → open/focus de app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./');
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req)
      .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => cached);
    event.waitUntil(network.then(() => undefined, () => undefined));
    return cached || network;
  })());
});
