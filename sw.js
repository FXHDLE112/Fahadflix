const CACHE_NAME = 'fahadflix-v1';
const STATIC_ASSETS = [
  '/index.html',
  '/styles.css', // optional, if you have CSS separate
  '/script.js',  // optional, if you have JS separate
  '/favicon.ico',
  '/movies.json' // we will try caching but won't fail if offline
];

// Install event
self.addEventListener('fetch', event => {
  const req = event.request;

  if(req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cachedResp => {
      if(cachedResp) return cachedResp;

      return fetch(req).then(networkResp => {
        if(!networkResp || !networkResp.ok) return networkResp;

        // Cache network response
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(req, networkResp.clone());
          return networkResp;
        });
      }).catch(err => {
        console.warn('[SW] Fetch failed:', req.url, err);

        // ✅ Ensure valid JSON fallback for movies.json
        if(req.url.endsWith('movies.json')){
          const fallback = { movies: [], shows: [] };
          return new Response(JSON.stringify(fallback), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Fallback for other resources
        return new Response(JSON.stringify({error:'Offline'}), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
          statusText: 'Offline'
        });
      });
    })
  );
});

