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

# Monochrom-Ebene je Dichte (108 dp)
for name,px in [('mdpi',108),('hdpi',162),('xhdpi',216),('xxhdpi',324),('xxxhdpi',432)]:
    d=os.path.join(R,'android-assets','monochrome','mipmap-'+name);os.makedirs(d,exist_ok=True)
    m=place(mono,px,S);a=m.getchannel('A');w=Image.new('RGBA',(px,px),(255,255,255,0));w.putalpha(a)
    w.save(os.path.join(d,'ic_launcher_monochrome.png'))

# Web-App
I=os.path.join(R,'icons')
for n,f in [(192,'icon-192.png'),(512,'icon-512.png'),(180,'apple-180.png')]:gesamt.resize((n,n),Image.LANCZOS).save(os.path.join(I,f))
mk=place(wuerfel_grund,512,0.74,BG);mk.alpha_composite(place(A,512,0.74));mk.convert('RGB').save(os.path.join(I,'maskable-512.png'))
print('Symbole erzeugt')
