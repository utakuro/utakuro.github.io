/* PROJECT EGO — service worker.
   Кэширует файлы приложения, чтобы оно открывалось на телефоне без интернета.
   Работает только по https (например, GitHub Pages) — при локальном запуске
   через file:// просто не регистрируется, и это нормально. */

const CACHE = 'project-ego-v3';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Сначала кэш, при промахе — сеть (данные-то всё равно в localStorage). */
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))
  );
});
