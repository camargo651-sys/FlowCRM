// Tracktio Service Worker - PWA offline cache + push notifications
const CACHE_VERSION = 'tracktio-v3'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const API_CACHE = `${CACHE_VERSION}-api`
const OFFLINE_URL = '/offline'

const STATIC_ASSETS = [
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// Cached API GET routes (stale-while-revalidate)
const SWR_API_PREFIXES = ['/api/contacts', '/api/deals', '/api/notes', '/api/calendar']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

function isStaticAsset(url) {
  return /\.(?:css|js|woff2?|ttf|otf|eot|png|jpg|jpeg|svg|webp|ico|gif)$/i.test(url.pathname)
}

function isSwrApi(url) {
  return SWR_API_PREFIXES.some((p) => url.pathname.startsWith(p))
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.status === 200) cache.put(request, res.clone())
      return res
    })
    .catch(() => cached)
  return cached || networkPromise
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    if (res && res.status === 200) cache.put(request, res.clone())
    return res
  } catch (err) {
    return cached || Response.error()
  }
}

async function networkFirstNavigation(request) {
  try {
    const res = await fetch(request)
    const cache = await caches.open(RUNTIME_CACHE)
    if (res && res.status === 200) cache.put(request, res.clone())
    return res
  } catch (err) {
    const cache = await caches.open(RUNTIME_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached
    const offline = await caches.match(OFFLINE_URL)
    return offline || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // CRITICAL: never intercept Next.js build assets — they're immutable and
  // caching them causes "originalFactory.call" chunk-loading errors on redeploy.
  if (url.pathname.startsWith('/_next/')) return

  // Navigations: network-first with cached fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Selected APIs: stale-while-revalidate
  if (isSwrApi(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE))
    return
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Tracktio', body: 'New notification' }
  try {
    if (event.data) data = event.data.json()
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Tracktio', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'default',
      data: { url: data.url || '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(clients.openWindow(url))
})
