// Kill-switch. Replaces the retired offline (Serwist) service worker.
// Browsers re-fetch /sw.js on navigation; a device that still runs the old
// worker picks this up, clears its Cache Storage, unregisters, and reloads open
// tabs onto the live, uncontrolled app. Served until Phase 62.
// Deliberately does NOT touch IndexedDB: a device may hold an unsent
// completion, and Phase 62 sweeps those databases.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate(c.url))
    })()
  )
})
