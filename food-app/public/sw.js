/* Service Worker: يجعل التطبيق قابلاً للتثبيت ويفتح بسرعة. البيانات (/api) لا تُخزن أبداً */
const CACHE = 'talabati-v1';
const SHELL = ['/', '/admin', '/style.css', '/common.js', '/app.js', '/admin.js', '/manifest.webmanifest', '/admin.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // الشبكة أولاً (لتصل التحديثات فوراً) ثم النسخة المخزنة عند انقطاع الإنترنت
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && !url.pathname.startsWith('/uploads/')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
