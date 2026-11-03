# Nicola packt

Packliste vom Kopf bis zu den Füßen, mit dem kleinen Tobi. Läuft komplett im Browser, auch offline.

## Aufs iPhone

1. https://tobiassofke-aborea.github.io/Aborea-App/kofferliste/ in **Safari** öffnen.
2. Teilen-Knopf → **Zum Home-Bildschirm**.
3. Ab dann startet „Nicola packt“ wie eine App, im Vollbild und ohne Internet.

Alles, was gepackt, gewonnen und freigeschaltet wird, liegt nur auf dem Handy (localStorage). Die Home-Bildschirm-App hat dabei einen eigenen Speicher, getrennt von Safari.

## Dateien

- `index.html` – die ganze App
- `manifest.webmanifest`, `icon-*.png` – Name und Icon für den Home-Bildschirm
- `sw.js` – sorgt dafür, dass die App offline startet
