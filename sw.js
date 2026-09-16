/* Forge Academy service worker — minimal, network-first with offline fallback */
var CACHE = 'forge-v1-2026-05';
var SHELL = [
  './',
  'index.html',
  'schedule.html',
  'pricing.html',
  'coaches.html',
  'contact.html',
  'booking.html',
  'thank-you.html',
  '404.html',
  'css/styles.css',
  'js/app.js',
  'manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// ─── Web push (class reminders) ─────────────────────────────────────────
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { title: 'Forge', body: e.data ? e.data.text() : '' }; }
  var title = data.title || 'Forge';
  var options = {
    body:    data.body  || '',
    icon:    data.icon  || '/og-image.svg',
    badge:   data.badge || '/og-image.svg',
    tag:     data.tag,
    data:    { url: data.url || '/' },
    requireInteraction: false,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(url) > -1 && 'focus' in list[i]) return list[i].focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Don't intercept third-party media (Unsplash photos, Pexels videos, OSM tiles).
  // Letting the browser's native HTTP cache handle them avoids stale photos
  // and saves SW cache space.
  var thirdParty = url.origin !== location.origin;
  if (thirdParty) return;
  var isHTML = req.headers.get('accept') && req.headers.get('accept').indexOf('text/html') !== -1;

  if (isHTML) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match('404.html'); });
      })
    );
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(function (m) {
        return m || fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      }).catch(function () { return caches.match(req); })
    );
  }
});
