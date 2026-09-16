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
content/audio/welkom.*       speelt één keer na het aanmelden bij Messenger;  content/audio/lied.*  = het lied (muziekbox + Bonzi)
content/video/fanmail/       videoberichten van fans (zelfde sleutel als de spraakclip mag)
content/video/               vlogs                                       ->  media/video/*.mp4 (past in 960x960, ~1 MB/min) + posters
media/                       gebouwde output, WEL in git (dat is wat GitHub Pages serveert) + manifest.json
scripts/                     build- en hulpscripts
firebase/firestore.rules     beveiligingsregels voor Messenger
```

**Sleutels**: overal waar content.json naar een bestand verwijst (captions, chat-contacten, videotitels) gebruik je de
bestandsnaam in kleine letters zonder extensie: `IMG_1234.HEIC` -> `img_1234`, `Tante An.opus` -> `tante-an`.

## Wat er op staat

- **Profiel** — Over mij, Ik hou van / Ik haat, stats volgens de kindjes, Wie bezocht mijn profiel (live), poll (live), muziek, links.
- **Foto's** — albums, lightbox, hartjes (live).
- **Vlog** — de vlogs in XP-webcamvensters.
- **Dock rechtsonder** (XP-taakbalk) met twee geminimaliseerde programma's:
  - **Windows Live Messenger** — opent als XP-venster over de pagina. Eerst "aanmelden" met enkel een naam of e-mailadres
    (geen wachtwoord). Links de gesprekken: het **groepsgesprek** (enkel getypte berichten, iedereen mag posten) en één
    **privégesprek per fan** met een spraak-/videobericht (`content/audio/fanmail/`, `content/video/fanmail/`), waarin dat
    bericht al gepost staat. In een privégesprek kan enkel die persoon zelf typen (aangemeld met de sleutel, de naam of een
    alias uit `msn.contacts`) — of Elisa (aangemeld met `site.msnEmail`, "Elisa" of een alias uit `site.aliases`).
    Dat is een client-side check, geen beveiliging. Nieuwe berichten: MSN-ding + popup vanuit de dock, teller op de knop,
    knop knippert oranje. `#msn` of `#msn/oma` in de URL opent het venster meteen.
  - **BonziBUDDY** — de echte paarse gorilla (originele frames, zie `scripts/bonzi-sprites.mjs`), praat in een ballon,
    vertelt moppen/feitjes (`bonzi` in content.json), jongleert, "zingt" (speelt `lied.mp3`), en spreekt met de browserstem
    (🔊/🔇 in de ballon). Verschijnt de eerste keer vanzelf na 20 s; "Weg" onthoudt dat hij niet welkom is.

## Dagelijks gebruik

```bash
npm install          # eenmalig
npm run build        # foto's / audio / video verwerken naar media/ (alleen wat nieuw is)
npm run dev          # lokaal bekijken op http://localhost:5173
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
(Firestore -> Rules -> alles vervangen -> Publish). **Na elke wijziging aan dat bestand opnieuw publiceren** — de versie met het
`room`-veld is nodig voor de privégesprekken; zonder die zie je "Missing or insufficient permissions" bij het posten daar. De `apiKey` mag publiek staan: de regels bepalen wat kan (lezen + toevoegen; niets wijzigen of wissen).

Berichten verwijderen: Firebase console -> Firestore Database -> collectie `guestbook` -> document -> prullenbak.
(Ja, de collectie heet nog `guestbook`; Messenger gebruikt ze. Veld `room` = sleutel van het privégesprek, geen veld = groepsgesprek.) Bezoekers staan in `visitors`, stemmen in `votes`, hartjes in `likes`.

## GitHub Pages

Repo -> **Settings -> Pages -> Build and deployment: Deploy from a branch -> `main` / `/ (root)`** -> Save. Eénmalig.
`.nojekyll` staat er zodat mappen met `_` meegenomen worden.

## WhatsApp-voorbeeld

De preview in WhatsApp komt van de `og:`-tags in `index.html` en `assets/og.jpg` (1200x630, maak met
`node scripts/gen-og.mjs content/photos/_site/avatar.jpg`). WhatsApp cachet die per URL: eerst de definitieve afbeelding pushen,
dan pas de link delen (of een `?v=2` achter de link zetten).

## Extra's die er in zitten

- Aanmelden als **Elisa** in Messenger: confetti, verjaardagspopup, en ze mag in elk gesprek antwoorden.
- De eerste tik op *Aanmelden* ontgrendelt audio; daarna speelt `welkom.mp3` één keer.
- MSN-popups met complimentjes af en toe (lijst `toasts`; regels met TODO worden overgeslagen); klik = Messenger openen.
- Buzzer (⚡) schudt het venster. Sparkle-cursor enkel met muis. Terugknop op de gsm sluit het Messenger-venster.
- Alle `TODO`'s uit content.json worden geel gemarkeerd op de site, zodat je niets vergeet.
