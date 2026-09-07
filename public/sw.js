// LiftLoop service worker (spec §10.1, §5.2 offline).
//  - /_next/static and /icons: cache-first (immutable assets)
//  - navigations to / and /session/*: network-first, falling back to the last cached copy when
//    offline so an in-progress session screen still opens; queued set writes drain on reconnect
//  - everything else (actions, other pages, API): network only, never cached
const STATIC = 'liftloop-static-v2'
const PAGES = 'liftloop-pages-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isSessionNav = (url) => url.pathname === '/' || /^\/session\/[0-9a-f-]{36}$/i.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) cache.put(request, res.clone())
        return res
      }),
    )
    return
  }

  if (request.mode === 'navigate' && isSessionNav(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES)
        try {
          const res = await fetch(request)
          if (res.ok) cache.put(request, res.clone())
          return res
        } catch {
          const hit = await cache.match(request)
          if (hit) return hit
          return new Response('<!doctype html><meta charset="utf-8"><title>LiftLoop</title><body style="background:#0a0a0a;color:#fafafa;font-family:system-ui;padding:32px"><h1>Offline</h1><p>This page has not been opened yet while online. Your logged sets are queued and will save when you reconnect.</p></body>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } })
        }
      })(),
    )
  }
})
