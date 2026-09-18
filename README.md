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
scripts/                     build- en hulpscripts (sync-immich.mjs haalt alles hierboven uit Immich, zie verder)
.env                         IMMICH_URL + IMMICH_API_KEY (niet in git; voorbeeld in .env.example)
firebase/firestore.rules     beveiligingsregels voor Messenger
```

**Sleutels**: overal waar content.json naar een bestand verwijst (captions, chat-contacten, videotitels) gebruik je de
bestandsnaam in kleine letters zonder extensie: `IMG_1234.HEIC` -> `img_1234`, `Tante An.opus` -> `tante-an`.

## Wat er op staat

- **Welkomstpagina** — "Welkom op de coole site van Elisa" met een ENTER-knop (tekst in `splash`). Na ENTER start het lied
  en blijft het herhalen; de tik op ENTER is ook wat de browser nodig heeft om daarna geluid te mogen spelen.
- **Profiel** — Over mij, Ik hou van / Ik haat, stats volgens de kindjes, Wie bezocht mijn profiel (live), poll (live), muziek.
- **Foto's** — albums (volgorde = volgorde in content.json; een lege map toont als "binnenkort"), lightbox, hartjes (live).
- **Vlog** — de vlogs in XP-webcamvensters (de video past in het venster; staande gsm-video's krijgen een vierkant venster).
- **Dock rechtsonder** (XP-taakbalk) met twee geminimaliseerde programma's:
  - **Windows Live Messenger** — opent als XP-venster over de pagina. Eerst "aanmelden" met enkel een naam of e-mailadres
    (geen wachtwoord). Links de gesprekken: het **groepsgesprek** (enkel getypte berichten, iedereen mag posten) en één
    **privégesprek per fan** met een spraak-/videobericht (`content/audio/fanmail/`, `content/video/fanmail/`), waarin dat
    bericht al gepost staat. De naam van de fan = de bestandsnaam zoals je die typt ("Tante Mieke.ogg" -> Tante Mieke);
    `msn.contacts` (sleutel `tante-mieke`) is er voor de MSN-displaynaam, het pm'tje, de status en aliassen. In een privégesprek kan enkel die persoon zelf typen (aangemeld met de sleutel, de naam of een
    alias uit `msn.contacts`) — of Elisa (aangemeld met `site.msnEmail`, "Elisa" of een alias uit `site.aliases`).
    Dat is een client-side check, geen beveiliging. Nieuwe berichten: MSN-ding + popup vanuit de dock, teller op de knop,
    knop knippert oranje. `#msn` of `#msn/oma` in de URL opent het venster meteen.
  - **BonziBUDDY** — de echte paarse gorilla (originele frames, zie `scripts/bonzi-sprites.mjs`), praat in een ballon,
    vertelt moppen/feitjes (`bonzi` in content.json), jongleert, "zingt" (speelt `lied.mp3`), en spreekt met de browserstem
    (🔊/🔇 in de ballon). Verschijnt de eerste keer vanzelf na 20 s; "Weg" onthoudt dat hij niet welkom is.

## Dagelijks gebruik

```bash
npm install          # eenmalig
npm run sync         # foto's / vlogs / berichten uit Immich halen (zie hieronder) en meteen bouwen
npm run build        # foto's / audio / video in content/ verwerken naar media/ (alleen wat nieuw is)
npm run dev          # lokaal bekijken op http://localhost:5173
```

Dan `content.json` aanpassen, `git add -A && git commit && git push`. GitHub Pages is een minuutje later bijgewerkt.

De build kijkt naar de *inhoud* van elk bronbestand (een vingerafdruk, gecachet in `media/.tmp/`), niet naar de datum: een
bestand vervangen door een nieuwe versie met dezelfde naam (bv. een nieuw `lied.wav`) wordt opgemerkt, ook met een oude datum,
en een bestand hernoemen hernoemt alleen de gemaakte output (geen nieuwe conversie). De site vraagt media op met een versienummer
(`?v=`, afgeleid van die vingerafdruk) zodat browsers en GitHub Pages nooit een oude versie uit hun cache tonen.

Demo-materiaal (placeholders) genereren om te testen: `npm run demo && npm run build`. Verwijder `content/photos/*`, `content/audio/*`,
`content/video/*` en run `npm run build` opnieuw zodra het echte materiaal er is (de build ruimt media/ zelf op).

### Fotoregel
Foto's met een EXIF-datum tussen `photoRules.bannedFrom` en `bannedTo` (content.json) worden overgeslagen en gelogd in
`content/excluded.txt`. Een album met `"allowAllDates": true` negeert de regel. Foto's zonder EXIF-datum gaan altijd door.

### HEIC
iPhone-foto's in HEIC gaan via ImageMagick (`magick`) naar JPEG; die staat al op deze pc.

## Immich

`npm run sync` haalt het bronmateriaal uit Immich naar `content/` en bouwt daarna `media/`. Eenmalig: maak in Immich een
API-sleutel (Account -> API-sleutels) met de rechten **album.read, asset.read, asset.download**, en zet in `.env`
(kopieer `.env.example`):

```
IMMICH_URL=https://immich.jouwdomein.be
IMMICH_API_KEY=...
```

Wat er gesynct wordt:

- **Fotoalbums** — voor elk album in `content.json` het Immich-album met dezelfde naam als de titel of de sleutel
  (hoofdletters, accenten en dingen als `<3` maken niet uit: "Mijn kjoeties" past bij "Mijn kjoeties <3<3"). Heet het in Immich
  anders, zet dan `"immich": "Naam in Immich"` bij dat album. Foto's houden hun bestandsnaam; video's in een fotoalbum worden overgeslagen.
- **Vlog** — het Immich-album `Vlog` (`immich.vlog` in content.json) -> `content/video/`, enkel video's.
- **MSN** — het Immich-album `MSN` (`immich.msn`) -> videoberichten naar `content/video/fanmail/` en, als je Immich audio
  aanneemt, spraakberichten naar `content/audio/fanmail/`. **Let op:** de meeste Immich-versies weigeren audio (WhatsApp-.opus),
  dus spraakberichten drop je gewoon zelf in `content/audio/fanmail/`; de sync laat die staan.
- **Namen in Vlog en MSN** komen van de *beschrijving* van de video in Immich: beschrijving "Tante An" -> `Tante An.mov` ->
  contact Tante An (sleutel `tante-an` in `msn.contacts`; zelfde sleutel als haar spraakclip = één gesprek met beide). Zonder
  beschrijving wordt de originele bestandsnaam gebruikt (`VID-20260918-WA0010.mp4`). Bij vlogs is die sleutel wat je in `videos.items` gebruikt.
- **Hernoemen mag.** De sync herkent een bestand aan zijn inhoud, niet aan zijn naam: hernoem `VID-20260918-WA0010.mp4` naar
  `Fatou.mp4` en de volgende sync neemt die naam over (niets wordt opnieuw gedownload; de build hernoemt de gemaakte video mee
  in plaats van opnieuw te encoderen). Jouw naam wint vanaf dan; alleen een bestand dat nog de naam van de sync draagt volgt
  een later gewijzigde beschrijving in Immich. Een kopie die je zelf al in `content/` had gezet (zelfde bytes) wordt op dezelfde
  manier overgenomen, en een dubbele sync-kopie ernaast wordt opgeruimd.
- De sync verwijdert alleen bestanden die hij zelf beheert (bijgehouden in `content/.immich-sync.json`) en die uit het
  Immich-album verdwenen zijn. Wat je zelf in `content/` zet blijft staan, ook als Immich een bestand met dezelfde naam maar
  andere inhoud heeft (dat wordt dan gemeld en overgeslagen). Een album dat helemaal uit Immich verdwijnt laat zijn bestanden staan.
- `npm run sync -- --dry-run` toont wat er zou gebeuren zonder iets te downloaden; `-- --no-build` slaat de build over.
  Albums in Immich die nergens bij horen worden onderaan opgesomd. Werkt met Immich v1.107 en nieuwer (incl. v2 en v3).

## Firebase (live chat, bezoekers, poll, hartjes)

Config staat in `js/firebase-config.js` (hou het `export`-woord als je ooit een nieuwe plakt). Regels: `firebase/firestore.rules`
(Firestore -> Rules -> alles vervangen -> Publish). **Na elke wijziging aan dat bestand opnieuw publiceren** — de versie met het
`room`-veld is nodig voor de privégesprekken; zonder die zie je "Missing or insufficient permissions" bij het posten daar. De `apiKey` mag publiek staan: de regels bepalen wat kan (lezen + toevoegen; niets wijzigen of wissen).

Berichten of bezoekers verwijderen: `npm run chat` toont alles met id, `npm run chat -- delete <id> [id...]` wist ze. Daarvoor
is eenmalig een service-account-sleutel nodig (de site zelf mag niets wissen): Firebase console -> Projectinstellingen ->
Serviceaccounts -> "Nieuwe persoonlijke sleutel genereren", bewaar het bestand als `firebase/service-account.json` (staat in
.gitignore; deel het met niemand). Het kan ook met de hand: Firestore Database -> collectie `guestbook` -> document -> prullenbak.
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
- Het lied (`lied.mp3`) start bij ENTER op de welkomstpagina en blijft herhalen. Een spraakclip, de welkomstboodschap of een
  vlog onderbreekt het; daarna gaat het verder waar het was. ❚❚ in de muziekbox zet het uit.
- De eerste tik op *Aanmelden* ontgrendelt audio; daarna speelt `welkom.mp3` één keer.
- MSN-popups met complimentjes af en toe (lijst `toasts`; regels met TODO worden overgeslagen); klik = Messenger openen.
- Buzzer (⚡) schudt het venster. Sparkle-cursor enkel met muis. Terugknop op de gsm sluit het Messenger-venster.
- Alle `TODO`'s uit content.json worden geel gemarkeerd op de site, zodat je niets vergeet.
