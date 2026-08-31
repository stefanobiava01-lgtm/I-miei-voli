// Service worker minimo — serve solo a rendere la pagina "installabile" come app.
// Non fa caching aggressivo: i dati voli vengono sempre letti freschi da Supabase.
const CACHE_NAME = 'i-miei-voli-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch handler "pass-through": richiesto dai criteri di installabilità di Chrome,
// ma lascia che ogni richiesta vada semplicemente in rete come farebbe normalmente.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
