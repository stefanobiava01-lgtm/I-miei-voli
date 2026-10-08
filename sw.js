// Service worker: rete prima, con copia salvata per aprire l'app anche senza connessione.
// I dati dei voli NON passano da qui (Supabase non viene messo in cache): stanno in localStorage.
const CACHE_NAME = 'i-miei-voli-v3';
const TILE_CACHE = 'i-miei-voli-tiles-v1';
const TILE_MAX = 3000;
const TILE_BASES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/'
];

async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  if (keys.length > TILE_MAX) for (const k of keys.slice(0, keys.length - TILE_MAX)) await c.delete(k);
}

async function prefetchWorld() {
  const c = await caches.open(TILE_CACHE);
  for (const z of [2, 3]) {
    const n = Math.pow(2, z);
    for (const base of TILE_BASES) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const url = base + z + '/' + y + '/' + x;
        if (await c.match(url)) continue;
        try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) await c.put(url, r); } catch (e) { return; }
      }
    }
  }
}

self.addEventListener('message', (e) => {
  if (e.data === 'prefetch-tiles') e.waitUntil(prefetchWorld());
});
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== TILE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (TILE_BASES.some(b => req.url.startsWith(b))) {
    event.respondWith(caches.open(TILE_CACHE).then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      try {
        const res = await fetch(req.url, { mode: 'cors' });
        if (res.ok) { c.put(req.url, res.clone()); if (Math.random() < 0.02) trimTiles(); }
        return res;
      } catch (e) { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return; // Supabase, mappe, loghi: sempre in rete
  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
