self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((name) => name.toLowerCase().includes('processofacil'))
        .map((name) => caches.delete(name)),
    )

    await self.registration.unregister()

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    await Promise.all(
      windows.map((client) => client.navigate(client.url)),
    )
  })())
})
