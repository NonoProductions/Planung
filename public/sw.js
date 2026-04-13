const CACHE_VERSION = "noes-planer-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_FALLBACK_URL = "/offline.html";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
const PRECACHE_URLS = [
  OFFLINE_FALLBACK_URL,
  "/manifest.webmanifest",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/maskable-icon-512x512.png",
  "/apple-touch-icon.png",
];
const STATIC_ASSET_EXTENSIONS = [
  ".css",
  ".js",
  ".mjs",
  ".woff",
  ".woff2",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".ico",
  ".webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (isLocalhostScope()) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("noes-planer-"))
            .map((cacheName) => caches.delete(cacheName))
        );

        await self.registration.unregister();

        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.all(
          clients.map((client) => client.navigate(client.url).catch(() => undefined))
        );

        return;
      }

      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== STATIC_CACHE)
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (isLocalhostScope()) {
    return;
  }

  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.pathname.startsWith("/_next/image") ||
    requestUrl.pathname.startsWith("/_next/data") ||
    requestUrl.pathname === "/sw.js"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (isStaticAssetRequest(requestUrl)) {
    event.respondWith(handleStaticAssetRequest(event, request));
  }
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const networkResponse = await fetch(request);

    // Keep the latest successful document as fallback for brief outages.
    if (networkResponse && networkResponse.ok) {
      void cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedPage = await cache.match(request);
    if (cachedPage) {
      return cachedPage;
    }

    const cachedOfflinePage = await caches.match(OFFLINE_FALLBACK_URL);
    if (cachedOfflinePage) {
      return cachedOfflinePage;
    }

    throw error;
  }
}

async function handleStaticAssetRequest(event, request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => undefined);

  if (cachedResponse) {
    event.waitUntil(networkResponsePromise);
    return cachedResponse;
  }

  const networkResponse = await networkResponsePromise;
  if (networkResponse) {
    return networkResponse;
  }

  return Response.error();
}

function isStaticAssetRequest(requestUrl) {
  return (
    requestUrl.pathname.startsWith("/_next/static/") ||
    STATIC_ASSET_EXTENSIONS.some((extension) =>
      requestUrl.pathname.endsWith(extension)
    )
  );
}

function isLocalhostScope() {
  return LOCAL_HOSTS.has(self.location.hostname);
}
