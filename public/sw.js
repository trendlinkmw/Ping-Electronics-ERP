// Minimal service worker — required by Chrome for the "Install app" prompt
// to appear. Doesn't cache anything; every request just passes straight
// through to the network as normal.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})