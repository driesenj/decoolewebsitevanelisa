# De coole website van Elisa

Elisa's Netlog-profiel anno 2008, gemaakt door haar fanclub. Statische site op GitHub Pages, live chat via Firebase.

Live: https://driesenj.github.io/decoolewebsitevanelisa/

## Hoe het in elkaar zit

```
index.html, css/, js/        de site zelf (vanilla JS, geen framework, hash-routing: #profiel #chat #fotos #vlog)
content/content.json         ALLE tekst. Hier vul je in.  Zie CONTENT-TODO.md.
content/photos/<album>/      bronfoto's (niet in git)       ->  npm run build  ->  media/photos/<album>/  (max 1600px, EXIF gestript)
content/photos/_site/        avatar.jpg (mappen met _ zijn geen albums)
content/audio/fanmail/       spraakberichten (WhatsApp .opus/.m4a ok)   ->  media/audio/fanmail/*.mp3  (genormaliseerd, stilte weggeknipt)
content/audio/welkom.*       speelt na het aanmelden;  content/audio/lied.*  = het lied in de muziekbox
content/video/               vlogs                                       ->  media/video/*.mp4 (past in 960x960, ~1 MB/min) + posters
media/                       gebouwde output, WEL in git (dat is wat GitHub Pages serveert) + manifest.json
scripts/                     build- en hulpscripts
firebase/firestore.rules     beveiligingsregels voor de chat
```

**Sleutels**: overal waar content.json naar een bestand verwijst (captions, chat-contacten, videotitels) gebruik je de
bestandsnaam in kleine letters zonder extensie: `IMG_1234.HEIC` -> `img_1234`, `Tante An.opus` -> `tante-an`.

## Tabs

- **Profiel** — Over mij, Ik hou van / Ik haat, stats volgens de kindjes, Wie bezocht mijn profiel (live), poll (live), muziek, links.
- **Chat** — één MSN-groepsgesprek. De spraakclips uit `content/audio/fanmail/` staan bovenaan als berichten van de contacten
  (deelnemerslijst links, op gsm achter de 👥-knop; klik op een naam = scroll + afspelen). Daaronder de getypte berichten:
  `chat.seed` uit content.json, dan alles wat mensen live typen (Firebase). Nieuw bericht van iemand anders = MSN-ding + popup.
- **Foto's** — albums, lightbox, hartjes (live).
- **Vlog** — de vlogs in MSN-webcamvensters.

## Dagelijks gebruik

```bash
npm install          # eenmalig
npm run build        # foto's / audio / video verwerken naar media/ (alleen wat nieuw is)
npm run dev          # lokaal bekijken op http://localhost:5173   (…/?login toont het aanmeldscherm opnieuw)
```

Dan `content.json` aanpassen, `git add -A && git commit && git push`. GitHub Pages is een minuutje later bijgewerkt.

Demo-materiaal (placeholders) genereren om te testen: `npm run demo && npm run build`. Verwijder `content/photos/*`, `content/audio/*`,
`content/video/*` en run `npm run build` opnieuw zodra het echte materiaal er is (de build ruimt media/ zelf op).

### Fotoregel
Foto's met een EXIF-datum tussen `photoRules.bannedFrom` en `bannedTo` (content.json) worden overgeslagen en gelogd in
`content/excluded.txt`. Een album met `"allowAllDates": true` (trouwfeest) negeert de regel. Foto's zonder EXIF-datum gaan altijd door.

### HEIC
iPhone-foto's in HEIC gaan via ImageMagick (`magick`) naar JPEG; die staat al op deze pc.

## Firebase (live chat, bezoekers, poll, hartjes)

Config staat in `js/firebase-config.js` (hou het `export`-woord als je ooit een nieuwe plakt). Regels: `firebase/firestore.rules`
(Firestore -> Rules -> Publish). De `apiKey` mag publiek staan: de regels bepalen wat kan (lezen + toevoegen; niets wijzigen of wissen).

Berichten verwijderen: Firebase console -> Firestore Database -> collectie `guestbook` -> document -> prullenbak.
(Ja, de collectie heet nog `guestbook`; de chat gebruikt ze.) Bezoekers staan in `visitors`, stemmen in `votes`, hartjes in `likes`.

## GitHub Pages

Repo -> **Settings -> Pages -> Build and deployment: Deploy from a branch -> `main` / `/ (root)`** -> Save. Eénmalig.
`.nojekyll` staat er zodat mappen met `_` meegenomen worden.

## WhatsApp-voorbeeld

De preview in WhatsApp komt van de `og:`-tags in `index.html` en `assets/og.jpg` (1200x630, maak met
`node scripts/gen-og.mjs content/photos/_site/avatar.jpg`). WhatsApp cachet die per URL: eerst de definitieve afbeelding pushen,
dan pas de link delen (of een `?v=2` achter de link zetten).

## Extra's die er in zitten

- MSN-aanmeldscherm als "cold open"; de tik op *Aanmelden* ontgrendelt meteen audio, daarna speelt `welkom.mp3`.
- Vul je naam in bij "Laat weten dat je langs was" (of in de chat) -> verschijnt bij *Wie bezocht mijn profiel*.
  Vul je **Elisa** in -> confetti + verjaardagsmodus.
- MSN-popups met complimentjes elke ±75 s (lijst `toasts` in content.json; regels met TODO worden overgeslagen); klik = naar de chat.
- Buzzer in het chatvenster schudt het scherm. Sparkle-cursor enkel met muis.
- Alle `TODO`'s uit content.json worden geel gemarkeerd op de site, zodat je niets vergeet.
