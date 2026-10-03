// オフラインでも動くように、アプリ本体を端末に保持する。
// ファイルを更新したら VERSION を上げること（古い保持分が入れ替わる）。
var VERSION = 'boki-coach-1';
var FILES = [
  './', 'index.html', 'manifest.json', 'icon.svg', 'css/style.css',
  'js/core.js', 'js/grade.js', 'js/content.js', 'js/templates.js',
  'js/mastery.js', 'js/store.js', 'js/planner.js', 'js/ui.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
