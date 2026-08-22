// Minimal service worker — required by Chrome for the "Install app" prompt.
// It doesn't cache anything aggressively; it just passes requests through,
// so it won't interfere with your normal app behavior or API calls.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass-through: just fetch from network as usual.
  event.respondWith(fetch(event.request));
});
