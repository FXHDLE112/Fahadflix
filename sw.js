const CACHE_NAME = 'fahadflix-cache-v1';
const VIDEO_CACHE = 'videos-v1';
const STATIC_ASSETS = [
  '/', // home page
  '/index.html', // your main HTML
  '/styles.css', // optional if external
  '/favicon.ico',
  'https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/11.0.1/firebase-database-compat.js',
  'https://fahadflix.netlify.app/movies.json' // cache your JSON
];

// INSTALL
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ACTIVATE
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if(key !== CACHE_NAME && key !== VIDEO_CACHE){
          console.log('[SW] Removing old cache', key);
          return caches.delete(key);
        }
      })
    ))
  );
});

// FETCH
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1️⃣ Video caching
  if(url.origin === location.origin || event.request.destination === 'video'){
    event.respondWith(
      caches.open(VIDEO_CACHE).then(cache =>
        cache.match(event.request).then(resp => {
          if(resp) return resp;
          return fetch(event.request).then(networkResp => {
            if(networkResp.ok) cache.put(event.request, networkResp.clone());
            return networkResp;
          }).catch(() => resp || new Response('Video unavailable offline', {status:503}));
        })
      )
    );
    return;
  }

  // 2️⃣ JSON / static files caching
  if(STATIC_ASSETS.includes(url.href) || STATIC_ASSETS.includes(url.pathname)){
    event.respondWith(
      caches.match(event.request).then(resp => {
        return resp || fetch(event.request).then(networkResp => {
          if(networkResp.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResp.clone()));
          return networkResp;
        }).catch(() => resp || new Response('Offline', {status:503}));
      })
    );
    return;
  }

  // 3️⃣ Default: network first, fallback to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
