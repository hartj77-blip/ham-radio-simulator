// Service worker: always load the newest version of the game.
// GitHub Pages tells browsers to cache files for 10 minutes, and phones / home-screen apps can
// hold on to old copies even longer — with many separate ES-module files that can mean a mix of
// old and new code. This worker goes to the network first (revalidating with the server, so an
// unchanged file is just a quick 304) and only falls back to its saved copy when offline.
// Only our own files are handled; live data, streams and APIs on other sites are left alone.
const CACHE = 'hamradio-v4';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
