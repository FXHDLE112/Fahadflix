const CACHE_NAME = 'fahadflix-v1';
const STATIC_ASSETS = [
  '/index.html',
  '/styles.css', // optional, if you have CSS separate
  '/script.js',  // optional, if you have JS separate
  '/favicon.ico',
  '/movies.json' // we will try caching but won't fail if offline
];

// Install event
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for(const asset of STATIC_ASSETS){
        try {
          await cache.add(asset);
          console.log('[SW] Cached', asset);
        } catch(err){
          console.warn('[SW] Failed to cache', asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// Fetch event
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests
  if(req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cachedResp => {
      if(cachedResp) return cachedResp;

      return fetch(req).then(networkResp => {
        if(!networkResp || !networkResp.ok) return networkResp;

        // Cache network response for future
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(req, networkResp.clone());
          return networkResp;
        });
      }).catch(err => {
        console.warn('[SW] Fetch failed, returning fallback', req.url);
        if(req.url.endsWith('movies.json')){
          // return empty JSON as fallback
          return new Response(JSON.stringify({movies:[], shows:[]}), {
            headers: {'Content-Type':'application/json'}
          });
        }
        return new Response('Offline', {status:503, statusText:'Offline'});
      });
    })
  );
});
