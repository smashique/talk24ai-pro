self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installed');
});

self.addEventListener('fetch', (e) => {
  // Basic fetch pass-through
  e.respondWith(fetch(e.request));
});