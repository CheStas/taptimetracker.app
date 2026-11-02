// The app's service worker: makes the PWA installable as a standalone app (no browser address bar) and lets it open
// offline. Network first, so a deploy shows up on the next load; the last copy of each file is the offline fallback.
const CACHE = 'time-tracker-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only this site's files; the feedback API and the usage stats always go to the network.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      // Offline: the cached file, or the app page for any of its routes.
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const page = await cache.match(new URL('./', location.href));
        if (page) return page;
      }
      throw err;
    }
  })());
});
