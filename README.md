# Hochzeitsbilder – vollständige aktuelle Version

Enthalten:

- öffentlicher Upload ohne Login oder Gäste-Passwort
- Mehrfach-Upload (bis 50 Bilder gleichzeitig, max. 20 MB pro Bild)
- privater Cloudflare-R2-Speicher
- passwortgeschützter Adminbereich
- öffentliche Galerie nur für freigegebene Bilder
- Admin-Multiselect mit Sammelaktionen
- Galerie-Multiselect für Wunsch-Downloads
- Filter für Alle / Querformat / Hochkant
- ZIP-Download der Auswahl
- ZIP-Download aller freigegebenen Bilder
- Admin-ZIP für Uploads, Galerie oder alle Bilder
- Einzelansicht und Einzel-Download
- Freigeben, aus Galerie entfernen und löschen

## Ordnerstruktur

`public/`, `functions/`, `package.json`, `.gitignore` und `README.md` müssen direkt im Stamm des GitHub-Repositories liegen.

## Cloudflare Pages

- Production branch: `main`
- Build command: `exit 0`
- Build output directory: `public`
- Root directory: `/`

## R2-Binding

Im Pages-Projekt unter **Settings → Bindings**:

- Typ: R2 bucket
- Variable name: `BUCKET`
- Bucket: dein eigener Hochzeitsbilder-Bucket, z. B. `hochzeitsbilder-uploads`

Der Bucket sollte privat bleiben.

## Admin-Passwort

Unter **Settings → Variables and Secrets** ein Secret anlegen:

- Name: `ADMIN_PASSWORD`
- Wert: dein Admin-Passwort

Danach ein neues Production-Deployment starten.

## Seiten

- Upload: `/`
- Admin: `/admin/`
- Galerie: `/galerie/`
- Status: `/api/health`

## Speicherung

Neue Bilder landen unter `uploads/`. Freigegebene Bilder werden nach `approved/` verschoben. Die Galerie und der öffentliche Komplett-Download sehen ausschließlich `approved/`.

## Mehrfachauswahl

### Admin

- einzelne oder alle sichtbaren Bilder auswählen
- Auswahl freigeben
- Auswahl aus Galerie entfernen
- Auswahl löschen
- Auswahl als ZIP herunterladen
- aktuellen Bereich als ZIP herunterladen
- alle Bilder als ZIP herunterladen

### Galerie

- Alle / Querformat / Hochkant filtern
- einzelne oder alle sichtbaren Bilder auswählen
- Auswahl als ZIP herunterladen
- alle freigegebenen Bilder als ZIP herunterladen

## Wichtig bei bestehenden Bildern

Das Deployment verändert bestehende R2-Dateien nicht automatisch. Bereits vorhandene Dateien unter `uploads/` und `approved/` bleiben erhalten, solange derselbe R2-Bucket als `BUCKET` gebunden bleibt.
