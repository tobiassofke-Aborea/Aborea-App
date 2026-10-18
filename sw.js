const C="aborea-ee6c3bc5ab",F=["./", "index.html", "manifest.webmanifest", "fonts/alegreya-400.woff2", "fonts/alegreya-500.woff2", "fonts/alegreya-700.woff2", "fonts/fell.woff2", "icons/apple-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;
  if(e.request.mode==="navigate"){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put("index.html",c));return r;}).catch(()=>caches.match("index.html")));return;}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
