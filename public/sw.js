/**
 * Service worker for the Life Dashboard app shell.
 *
 * - install: skipWaiting immediately (don't wait for old tabs to close), and
 *   best-effort precache the app shell document so the very first offline
 *   reload already has something to fall back to.
 * - activate: clients.claim() plus delete every cache that isn't this
 *   build's cache name.
 * - fetch: same-origin GET only - cross-origin and non-GET requests are
 *   never touched (respondWith is simply not called, so the browser's
 *   normal network handling applies untouched):
 *     - navigations -> network-first, falling back to the cached shell.
 *     - data/life.enc.json -> network-first, falling back to the cached copy.
 *     - everything else same-origin -> stale-while-revalidate.
 *
 * BUILD_ID is substituted at build time (see vite.config.ts's swBuildIdPlugin,
 * driven by the same value passed to Vite's `define`) so the cache name
 * changes on every deploy and the activate handler above clears the old one.
 * This file lives in public/ and is copied to dist/ verbatim by Vite (public
 * files are never transformed), so the substitution is a small text patch
 * applied to the copied dist/sw.js after the build rather than esbuild's
 * usual `define` replacement - see vite.config.ts for the exact mechanism.
 */
const BUILD_ID = '__SW_BUILD_ID__';
const CACHE_NAME = `life-dashboard-${BUILD_ID}`;
const DATA_SUFFIX = 'data/life.enc.json';
const SHELL_URL = new URL('.', self.location.href).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.add(SHELL_URL);
      } catch {
        // Offline on first install, or the shell isn't reachable yet - not
        // fatal, the shell gets cached on the first successful navigation.
      }
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** Network-first: try the network, cache a good response, fall back to whatever is cached under `cacheKey` on failure. */
async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (err) {
    const cached = (await cache.match(request)) || (await cache.match(cacheKey));
    if (cached) return cached;
    throw err;
  }
}

/** Stale-while-revalidate: answer from cache immediately if present, refresh the cache in the background either way. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never touch non-GET
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_URL));
    return;
  }
  if (url.pathname.endsWith(DATA_SUFFIX)) {
    event.respondWith(networkFirst(request, request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
