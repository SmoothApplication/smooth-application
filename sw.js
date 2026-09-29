// KILL SWITCH — replaces the old app-shell service worker.
//
// Direct user report, with a screenshot: smoothapplication.github.io/smooth-application/ was still
// rendering the FULL retired app — live data and all — well after that page's own index.html had
// already been replaced with a redirect to smoothapplication.com (see CHANGELOG's "Retire the old
// GitHub Pages site" entry). Root cause: the old app registered this exact file as a service worker
// (`navigator.serviceWorker.register(...)`, index.html ~line 16694) with same-origin scope. Once a
// browser has that worker installed, it keeps controlling every future navigation to this origin
// AT THE BROWSER LEVEL, independent of whatever the server now returns — replacing index.html's
// content alone can never reach someone whose browser already has this worker active. The redirect
// page itself doesn't re-register a service worker, so simply removing the registration call did
// nothing for browsers that already had the old one installed; it only stopped NEW installs.
//
// Fix: this file is the SAME registered script URL the old worker used, so a browser that still has
// the old worker installed will fetch it again (browsers byte-compare a registered service worker's
// script on every navigation within its scope, not just periodically) and detect a change here,
// triggering an install of THIS version instead. Once active, it deletes every cache this origin's
// worker ever created and unregisters itself, then forces every open/future client to do a normal,
// worker-free navigation — which is exactly what finally lets the real, current server response
// (the redirect to smoothapplication.com) reach the browser. After this runs once, the origin has
// no service worker at all, so this can't happen again.
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.matchAll({ type: 'window' });
      })
      .then(function (clients) {
        clients.forEach(function (client) {
          // Re-navigating (rather than just letting the old cached page sit there) is what
          // actually shows the applicant the redirect immediately, on the same tab, without them
          // needing to manually refresh.
          client.navigate(client.url);
        });
      })
  );
});
