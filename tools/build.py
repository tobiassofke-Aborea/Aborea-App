# Baut die installierbare Android-Version (PWA) aus dem Artifact-Quelltext.
import re,hashlib,json,os
import sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(os.path.join(ROOT,'quelle','aborea-charakterbogen.html'),encoding='utf-8').read()
A=ROOT
fonts='''<style>
@font-face{font-family:"IM Fell English SC";src:url(fonts/fell.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Alegreya Sans";font-weight:400;src:url(fonts/alegreya-400.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Alegreya Sans";font-weight:500;src:url(fonts/alegreya-500.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Alegreya Sans";font-weight:700;src:url(fonts/alegreya-700.woff2) format("woff2");font-display:swap}
</style>'''
body=re.sub(r'<link rel="preconnect"[^>]*>\n?','',src)
body=re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n?','',body)
sbfont='<link href=\\"https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap\\" rel=\\"stylesheet\\">'
assert body.count(sbfont)==1,'sb font link'
body=body.replace(sbfont,json.dumps(fonts)[1:-1].replace('/','\\/'))
title=re.search(r'<title>.*?</title>\n?',body).group(0);body=body.replace(title,'',1)
ver=hashlib.sha1(src.encode()).hexdigest()[:10]
head=f'''<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Aborea Charakterbogen</title>
<meta name="theme-color" content="#e9e5dc" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1c1814" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-180.png">
{fonts}
</head><body>
'''
tail=f'''
<script>if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{{}}));</script>
</body></html>
'''
open(A+'/index.html','w').write(head+body+tail)
man={"name":"Aborea Charakterbogen","short_name":"Aborea","id":"./","start_url":"./","scope":"./","display":"standalone","orientation":"portrait",
 "background_color":"#e9e5dc","theme_color":"#6b4c25","lang":"de","description":"Charakterbogen, Kampf, Würfel, Geldsack und Spruchbuch für Aborea",
 "icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"},
          {"src":"icons/maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
open(A+'/manifest.webmanifest','w').write(json.dumps(man,ensure_ascii=False,indent=1))
files=['./','index.html','manifest.webmanifest']+[f'{d}/{f}' for d in ('fonts','icons') for f in sorted(os.listdir(f'{A}/{d}'))]
open(A+'/sw.js','w').write(f'''const C="aborea-{ver}",F={json.dumps(files)};
self.addEventListener("install",e=>{{e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting()));}});
self.addEventListener("activate",e=>{{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));}});
self.addEventListener("fetch",e=>{{if(e.request.method!=="GET")return;
  if(e.request.mode==="navigate"){{e.respondWith(fetch(e.request).then(r=>{{const c=r.clone();caches.open(C).then(x=>x.put("index.html",c));return r;}}).catch(()=>caches.match("index.html")));return;}}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));}});
''')
print('built',ver)
