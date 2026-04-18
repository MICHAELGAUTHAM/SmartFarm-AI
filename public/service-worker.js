const CACHE_NAME = 'smartfarm-ai-v1';

// The core files to cache for complete offline demo functionality
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/signup.html',
  '/pulse.html',
  '/simulator.html',
  '/vision.html',
  '/yield.html',
  '/css/style.css',
  '/js/main.js',
  '/js/i18n.js',
  '/js/auth.js',
  '/js/pulse.js',
  '/js/voice.js',
  '/manifest.json',
  '/icon.svg'
];

// Install Event: Cache all the core offline files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching core offline files');
        return cache.addAll(OFFLINE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network First, falling back to Service Worker Cache
self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests, not API POSTs for Auth etc.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If we get a good response from the network, update the cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network fails (Offline mode), return from Cache
        console.log('[Service Worker] Serving from cache:', event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
             return cachedResponse;
          }
          // If not in cache and offline, fallback to index
          if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
          }
        });
      })
  );
});
