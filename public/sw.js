// __APP_BUILD_ID__ is replaced at build time by the inject-sw-version Vite plugin.
// In dev, it stays literal — that's fine, the dev server doesn't deploy the SW.
const CACHE_PREFIX = 'multiviewer-remote-cache-';
const CACHE_NAME = `${CACHE_PREFIX}__APP_BUILD_ID__`;
const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Pass GraphQL through to the network stack untouched.
  if (url.pathname.includes('/api/graphql')) return;

  const accept = request.headers.get('accept') || '';
  const isNavigation = request.mode === 'navigate' || accept.includes('text/html');

  // Network-first for the HTML shell. Guarantees the served index.html always points at
  // the current asset hashes — without this, a stale cached shell will reference a JS
  // bundle that no longer exists on the server and the page renders blank.
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Everything else: cache-first if we happened to precache it, otherwise straight to network.
  // Vite emits content-hashed asset URLs, so they are safe to let the HTTP cache handle.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
