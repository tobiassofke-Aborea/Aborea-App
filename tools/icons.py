"""Erzeugt alle App-Symbole aus dem Artwork-Paket in android-assets/quelle.

Android (ab 8): Hintergrund-Ebene = Würfel auf hellem Grund, Vordergrund-Ebene = das A,
Monochrom-Ebene (Android 13 "Designsymbole") = das A als Silhouette.
Alle Ebenen nutzen denselben Maßstab, so dass der Würfel im 66-dp-Sicherheitskreis liegt
und das A die sichtbare 72-dp-Fläche gerade nicht verlässt.
"""
import os
from PIL import Image
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q=lambda f:os.path.join(R,'android-assets','quelle',f)
BG=(233,229,220)
S=0.63  # Anteil der 108-dp-Fläche, den das 432er-Artwork einnimmt

def place(img,n,s,bg=None):
    w=round(n*s);t=img.convert('RGBA').resize((w,w),Image.LANCZOS)
    o=Image.new('RGBA',(n,n),(bg+(255,)) if bg else (0,0,0,0));o.alpha_composite(t,((n-w)//2,(n-w)//2));return o

wuerfel_grund=Image.open(Q('wuerfel-auf-grund.png'));A=Image.open(Q('a.png'));mono=Image.open(Q('a-mono.png'))
gesamt=Image.open(Q('gesamt.jpg')).convert('RGB')

N=1024
place(wuerfel_grund,N,S,BG).convert('RGB').save(os.path.join(R,'android-assets','icon-background.png'))
place(A,N,S).save(os.path.join(R,'android-assets','icon-foreground.png'))
gesamt.resize((N,N),Image.LANCZOS).save(os.path.join(R,'android-assets','icon-only.png'))

# Android-Ressourcen direkt (ohne zusätzlichen Einzug), 108 dp je Ebene, 48 dp fürs alte Symbol
from PIL import ImageDraw
RES=os.path.join(R,'android-assets','res')
DENS=[('ldpi',.75),('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)]
for name,f in DENS:
    d=os.path.join(RES,'mipmap-'+name);os.makedirs(d,exist_ok=True)
    px=round(108*f)
    place(wuerfel_grund,px,S,BG).convert('RGB').save(os.path.join(d,'ic_launcher_background.png'))
    place(A,px,S).save(os.path.join(d,'ic_launcher_foreground.png'))
    m=place(mono,px,S);w=Image.new('RGBA',(px,px),(255,255,255,0));w.putalpha(m.getchannel('A'))
    w.save(os.path.join(d,'ic_launcher_monochrome.png'))
    lp=round(48*f);g=gesamt.resize((lp,lp),Image.LANCZOS)
    g.save(os.path.join(d,'ic_launcher.png'))
    k=Image.new('L',(lp*4,lp*4),0);ImageDraw.Draw(k).ellipse([0,0,lp*4-1,lp*4-1],fill=255);k=k.resize((lp,lp),Image.LANCZOS)
    r=g.convert('RGBA');r.putalpha(k);r.save(os.path.join(d,'ic_launcher_round.png'))
d=os.path.join(RES,'mipmap-anydpi-v26');os.makedirs(d,exist_ok=True)
XML="""<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
"""
for f in ('ic_launcher.xml','ic_launcher_round.xml'):open(os.path.join(d,f),'w').write(XML)

# Web-App
I=os.path.join(R,'icons')
for n,f in [(192,'icon-192.png'),(512,'icon-512.png'),(180,'apple-180.png')]:gesamt.resize((n,n),Image.LANCZOS).save(os.path.join(I,f))
mk=place(wuerfel_grund,512,0.74,BG);mk.alpha_composite(place(A,512,0.74));mk.convert('RGB').save(os.path.join(I,'maskable-512.png'))
print('Symbole erzeugt')
