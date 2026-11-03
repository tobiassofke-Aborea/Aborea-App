const V = "nicola-packt-v2";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const isPage = e.request.mode === "navigate";
  e.respondWith(
    isPage
      ? fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put("index.html", c)); return r; }).catch(() => caches.match("index.html"))
      : caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; }))
  );
});
