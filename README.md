# Aborea Charakterbogen

Charakterbogen fürs Pen-and-Paper Aborea: Lebens- und Manapunkte, Würfeln, Kampf und Magie, Würfeltisch, Geldsack und Spruchbuch.

## Aufs Handy

**Als Android-App (APK):** [Aborea.apk herunterladen](https://github.com/tobiassofke-Aborea/Aborea-App/releases/latest/download/Aborea.apk), die Datei auf dem Handy öffnen und installieren. Beim ersten Mal fragt Android, ob Apps aus dieser Quelle installiert werden dürfen.

**Aufs iPhone/iPad:** https://tobiassofke-aborea.github.io/Aborea-App/ in Safari öffnen, unten auf Teilen tippen und „Zum Home-Bildschirm“ wählen. Die App startet dann ohne Browserleiste und läuft auch offline.

**Als Web-App auf Android/PC:** dieselbe Adresse in Chrome öffnen und im Menü „App installieren“ wählen.

Die Web-Adresse wird von `.github/workflows/pages.yml` gebaut. Einmalig nötig: im Repository unter Settings → Pages bei „Source“ den Punkt „GitHub Actions“ wählen.

Die Daten liegen nur auf dem Handy. Charaktere zieht man mit „Charakter als Text kopieren“ und „Charakter einfügen“ im Bogen um.

## Aufbau

- `quelle/aborea-charakterbogen.html`: die App selbst
- `tools/build.py`: erzeugt daraus `index.html`, `manifest.webmanifest` und `sw.js` (offline-fähig)
- `tools/icons.py`: erzeugt alle App-Symbole aus dem Artwork in `android-assets/quelle` (Würfel als Hintergrund, A als Vordergrund und Monochrom-Ebene)
- `.github/workflows/android.yml`: baut bei jeder Änderung die APK und legt sie unter Releases ab
