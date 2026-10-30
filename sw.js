// Offline support: cache the game files and serve them cache-first.
// Cloud saves (Supabase, another origin) always go to the network.
const VERSION = 'meadow-v1.5.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/data.js', 'js/world.js', 'js/sim.js', 'js/economy.js', 'js/path.js', 'js/render.js',
  'js/input.js', 'js/ui.js', 'js/save.js', 'js/cloud.js', 'js/looks.js', 'js/seasons.js', 'js/art/grade.js',
  'js/art/core.js', 'js/art/items.js', 'js/art/land.js', 'js/art/plants.js', 'js/art/buildings.js',
  'js/art/decor.js', 'js/art/chars.js', 'js/art/icons.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = FONT_HOSTS.includes(url.hostname);
  if (url.origin !== self.location.origin && !font) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
