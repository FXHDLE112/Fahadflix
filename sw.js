/* sw.js - Service Worker for FahadFlix
   Place this file at the site root: /sw.js
   Requires HTTPS or localhost for registration to work.
*/

const APP_CACHE = 'fahadflix-app-v1';
const VIDEO_CACHE = 'videos-v1';

// Files to pre-cache for the app shell.
const APP_SHELL = [
  '/', // include root so that the index can be cached when installed
  '/index.html',
  // Add any static assets you want cached up-front (icons, css). Update names/paths as needed.
];

// install - cache app shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL).catch(err=>{
      // don't fail install if some assets unavailable
      console.warn('App shell caching failed:', err);
    }))
  );
});

// activate - cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(k => {
        if(k !== APP_CACHE && k !== VIDEO_CACHE) {
          return caches.delete(k);
        }
      }));
    }).then(()=>self.clients.claim())
  );
});

// fetch - respond from cache where possible
self.addEventListener('fetch', event => {
  const req = event.request;

  // Always bypass non-GET
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // Strategy:
  // - For requests to known static assets (app shell), use cache-first
  // - For video requests and other requests: try cache first, else network (and cache successful responses)
  // Note: Range requests (partial content) are not handled here (complex); most browsers will request full resources.
  // If you rely on Range requests for large streaming, you'd need special handling.

  // Cache-first for app shell
  if (APP_SHELL.includes(url.pathname) || url.origin === location.origin && url.pathname === '/') {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp=>{
        // cache the asset for next time
        caches.open(APP_CACHE).then(cache=>cache.put(req, resp.clone()));
        return resp;
      }).catch(()=>caches.match('/index.html')))
    );
    return;
  }

  // For video or large media: try cache first
  const isVideo = req.destination === 'video' || /\.(mp4|webm|m3u8)(\?|$)/i.test(url.pathname);

  if (isVideo) {
    event.respondWith(
      caches.open(VIDEO_CACHE).then(cache => {
        return cache.match(req).then(cached => {
          if (cached) return cached;
          // Not cached - fetch from network and cache it for later
          return fetch(req).then(networkResp => {
            // Only cache OK responses
            if(networkResp && networkResp.ok){
              cache.put(req, networkResp.clone()).catch(e=>{
                // cache.put might fail if the response is opaque or CORS blocked
                console.warn('Video cache put failed', e);
              });
            }
            return networkResp;
          }).catch(err => {
            // If network fails and not in cache, respond with a generic fallback (optional)
            return new Response('Video unavailable offline', {status:404, statusText:'Video unavailable'});
          });
        });
      })
    );
    return;
  }

  // Default: network-first then cache fallback for other resources
  event.respondWith(
    fetch(req).then(networkResp => {
      // update caches for same-origin static assets
      if (req.url.startsWith(self.location.origin)) {
        caches.open(APP_CACHE).then(cache => {
          try { cache.put(req, networkResp.clone()); } catch(e){/* ignore */ }
        });
      }
      return networkResp;
    }).catch(() => {
      return caches.match(req).then(cached => {
        if (cached) return cached;
        // fallback to index.html for navigation requests
        if (req.mode === 'navigate') return caches.match('/index.html');
        return new Response('Offline', {status:503, statusText:'Offline'});
      });
    })
  );
});
