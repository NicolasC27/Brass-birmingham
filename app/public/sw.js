/* The journal's own porter. The shell and the pictures are kept once
   seen; a page asked for while the line is down is served from the
   copy, so the front page opens on the local edition. Nothing of the
   office's is kept: the wire is the wire. */
const CACHE = 'blackrail-v1';
const KEEP = /\.(webp|png|jpg|svg|woff2?|css|js)$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest'])).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* a page: the network first, the copy of the shell when it fails */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put('/', r.clone()));
          return r;
        })
        .catch(() => caches.match('/').then((hit) => hit || Response.error())),
    );
    return;
  }
  /* the shell's files and the pictures: the copy first, then the network */
  if (url.pathname.startsWith('/assets/') || KEEP.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((r) => {
            if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone()));
            return r;
          }),
      ),
    );
  }
});
