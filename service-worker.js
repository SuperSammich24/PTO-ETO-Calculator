// ============================================================
// PTO/ETO Calculator — Service Worker
// ============================================================
// Caches the app files so the calculator works fully offline.
// When you push changes to GitHub, bump CACHE_VERSION below to
// force users' browsers to fetch the new version on their next visit.
// ============================================================

const CACHE_VERSION = 'v2';
const CACHE_NAME    = `pto-eto-${CACHE_VERSION}`;

// Core app files to pre-cache on install. Use relative paths so this
// works on GitHub Pages regardless of the repo name / subpath.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

// Install: pre-cache the core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())   // activate the new SW immediately
  );
});

// Activate: clean up any old caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('pto-eto-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: stale-while-revalidate strategy
//   - Serve from cache immediately (fast, works offline)
//   - Update the cache in the background with a fresh network copy
// For Google Fonts (different origin) we just use cache-first.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isFonts = url.origin === 'https://fonts.googleapis.com' ||
                  url.origin === 'https://fonts.gstatic.com';

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      const networkFetch = fetch(req).then((response) => {
        // Only cache successful, basic or cors responses
        if (response && response.status === 200 &&
            (response.type === 'basic' || response.type === 'cors')) {
          cache.put(req, response.clone());
        }
        return response;
      }).catch(() => cached);    // offline → fall back to cache

      // For fonts, return cached immediately if we have it
      if (isFonts && cached) return cached;

      // For everything else: stale-while-revalidate
      return cached || networkFetch;
    })
  );
});
