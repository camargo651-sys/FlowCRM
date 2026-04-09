const CACHE_NAME = 'tracktio-v1'
const OFFLINE_URL = '/offline'

// Cache the app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/offline',
        '/manifest.json',
      ])
    })
  )
  self.skipWaiting()
})

// Clean old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    })
  )
  self.clients.claim()
})

// Network-first strategy with offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    )
  }
})

// Push notification handling
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'Tracktio', body: 'New notification' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'default',
      data: { url: data.url || '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
