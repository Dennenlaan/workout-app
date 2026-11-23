// Service worker — NETWORK-FIRST met cache-fallback (offline).
// Waarom: GitHub Pages stuurt `Cache-Control: max-age=600`. Met stale-while-revalidate zag de
// gebruiker na een update eerst nog de oude versie (soms meerdere keren openen nodig).
// Nu: online → altijd de nieuwste versie (revalidatie via ETag, goedkoop 304), traag/offline →
// na NETWORK_TIMEOUT de cache. Verhoog CACHE bij elke release (en APP_VERSION in app.js).
// Let op: op GitHub Pages delen al je sites (gebruiker.github.io/*) dezelfde cache-opslag,
// dus we ruimen ALLEEN caches met ons eigen voorvoegsel op.
const CACHE_PREFIX = 'workout-tracker-';
const CACHE = `${CACHE_PREFIX}v14`;
const NETWORK_TIMEOUT = 4000;
const isOurOldCache = (k) => k !== CACHE && (k.startsWith(CACHE_PREFIX) || /^workout-v\d+$/.test(k));
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './app.js',
  './progress.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' = HTTP-cache van de browser overslaan, zodat we echt de nieuwe bestanden opslaan
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
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

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
]);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // 'no-cache' = altijd bij de server navragen (ETag → 304 als er niets veranderd is).
    // Navigaties mogen geen RequestInit krijgen, dus die bouwen we opnieuw op uit de URL.
    const netReq = req.mode === 'navigate'
      ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      : new Request(req, { cache: 'no-cache' });
    try {
      const res = await withTimeout(fetch(netReq), NETWORK_TIMEOUT);
      if (res.ok) event.waitUntil(cache.put(req, res.clone()));
      return res;
    } catch (_) {
      const cached = await cache.match(req, { ignoreSearch: true })
        || (req.mode === 'navigate' ? await cache.match('./') : null);
      return cached || Response.error();
    }
  })());
});
