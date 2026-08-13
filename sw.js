// Minimal app-shell service worker for Smooth Application.
//
// Scope: caches ONLY same-origin, static app-shell files (this page, the manifest, the icons) so
// the checklist still opens if you lose signal partway through — for example between a bank visit
// and filling in a figure back home. It deliberately does NOT intercept or cache requests to
// cdnjs.cloudflare.com (pdf.js/Tesseract.js/xlsx) or open.er-api.com: those are left to the
// browser's normal network handling, so this worker never becomes a second place that would need
// updating if a CDN version or its Subresource Integrity hash changes, and never caches a
// cross-origin response indefinitely without a way to invalidate it.
//
// Bump CACHE_NAME whenever the app-shell file list below changes so old caches get cleaned up.
var CACHE_NAME = 'smooth-app-shell-v1';
// SCOPE_BASE: the folder this worker itself lives in ("/" on Netlify/Cloudflare, "/<repo>/" on a
// GitHub Pages project site) — computed instead of hardcoded so the exact same file works on
// either kind of host without edits.
var SCOPE_BASE = self.location.pathname.replace(/[^/]*$/, '');
var APP_SHELL = [
  SCOPE_BASE,
  SCOPE_BASE + 'manifest.json',
  SCOPE_BASE + 'icons/icon-192.png',
  SCOPE_BASE + 'icons/icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL);
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
            .map(function(key){ return caches.delete(key); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return; // never cache non-GET
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (CDN) requests pass through untouched

  if (req.mode === 'navigate'){
    // Page loads: prefer a fresh copy when online (so fixes/updates show up immediately), fall
    // back to the cached shell when offline.
    event.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(SCOPE_BASE, copy); });
        return res;
      }).catch(function(){
        return caches.match(SCOPE_BASE);
      })
    );
    return;
  }

  // Other same-origin static assets (manifest, icons): cache-first, refresh the cache in the
  // background when a network copy is available.
  event.respondWith(
    caches.match(req).then(function(cached){
      var networkFetch = fetch(req).then(function(res){
        if (res && res.ok){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || networkFetch;
    })
  );
});
