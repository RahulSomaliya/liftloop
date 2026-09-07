// LiftLoop service worker (spec §10.1): minimal on purpose. Caches only immutable static assets and
// icons (cache-first); every page and action goes to the network so sets are never served stale.
// Offline page caching is v1.1 (§5.2).
const CACHE = 'liftloop-static-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  const cacheable = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
  if (!cacheable) return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request)
      if (hit) return hit
      const res = await fetch(request)
      if (res.ok) cache.put(request, res.clone())
      return res
    }),
  )
})
