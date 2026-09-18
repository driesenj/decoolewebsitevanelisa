# Nog in te vullen (content/content.json tenzij anders vermeld)

Alles wat op de site geel `TODO` toont, staat hier. Volgorde = wat het meeste oplevert per minuut.

## Vandaag
- [ ] WhatsApp sturen naar familie/vrienden: spraakbericht (max 30 s) + favoriete foto — deadline donderdagmiddag
- [x] `site.msnEmail` — elisake750@msn.com
- [ ] `site.displayName` — als je haar echte MSN-displaynaam nog weet
- [x] `site.city` — Gent
- [ ] `site.birthday` — staat nu op 1995-09-19, klopt de dag?
- [x] `kids[].name` — Floflo en Luna (overal automatisch ingevuld via {kid1} {kid2})

## Foto's (content/photos/)
De mappen staan klaar (leeg = "binnenkort" op de site); foto's erin droppen en `npm run build` — of maak in Immich albums
met dezelfde namen en run `npm run sync` (zie README, kopje Immich). Vlogs: Immich-album "Vlog"; videoberichten van fans: album "MSN"
(beschrijving van de video in Immich = naam van de fan). Spraakberichten kunnen niet in Immich, die blijven handmatig.
Let op de fotoregel: EXIF-datum tussen 2023-06-01 en 2025-10-01 wordt overgeslagen (zie `content/excluded.txt`), tenzij het album `"allowAllDates": true` heeft.
- [ ] `spermatties/`
- [ ] `fun-with-the-fam/`
- [ ] `turfmollen/`
- [ ] `de-mansion/`
- [ ] `sgattie/`
- [ ] `vinoisserie/`
- [ ] `vacay/`
- [ ] `ons-huisje/`
- [ ] `mijn-kjoeties/`
- [ ] `back2school/`
- [ ] `gore/`
- [ ] `bizonder/` (titel staat nu op "Bizonder")
- [ ] 64 foto's zijn overgeslagen door de datumregel (2023-06 t/m 2025-10), vooral in bizonder (17), vacay (11), mijn-kjoeties (10):
      zie `content/excluded.txt`; wil je ze toch, zet dan `"allowAllDates": true` bij dat album (of pas `photoRules` aan)
- [ ] `_site/avatar.jpg` — profielfoto (vierkant werkt best)
- [ ] `albums.<album>.desc` — tekstje boven elk album, en onderschriften in `captions` (optioneel)

## Audio (content/audio/)
- [ ] `welkom.*` — de kindjes: "Welkom op de coole website van mama!!!" (speelt meteen na het aanmelden)
- [ ] `lied.*` — verjaardagslied door de kindjes
- [ ] `fanmail/<naam>.opus` — spraakberichten; bestandsnaam = naam van de fan. Optioneel per fan een regel in `msn.contacts`
      (sleutel = kleine letters met streepjes: "Tante Mieke.ogg" -> `tante-mieke`) met MSN-displaynaam, pm, status, emoji en
      `aliases` (namen waarmee die persoon zich mag aanmelden om in zijn/haar privégesprek te typen). Volgorde in Messenger = volgorde in `msn.contacts`.
      De oude demo-contacten (oma, opa, de-kindjes, de-webmaster) staan er nog als voorbeeld; ze doen niets zolang er geen bestand met die naam is.

## Video (content/video/)
- [ ] vlogs erin droppen; titels in `videos.items` (sleutel = bestandsnaam zonder extensie)
- [ ] videoberichten van fans in `content/video/fanmail/` (zelfde sleutel als hun spraakclip mag)

## Tekst
- [ ] `profile.stats` — laat de grote mama scoren op een paar dingen (ik heb voorzetten gedaan)
- [ ] `msn.seed` — berichten die al in het groepsgesprek staan bij de start
- [ ] `msn.ads` — de 'advertenties' onderaan de contactenlijst
- [ ] `bonzi.jokes` / `bonzi.facts` / `bonzi.lines` — twee feitjes staan nog op TODO; inside jokes welkom
- [ ] `site.aliases` — nog een paar namen waarmee Elisa zichzelf mag aanmelden (haar echte MSN-adres komt in `site.msnEmail`)
- [ ] `toasts` — nog een paar complimentjes (worden als MSN-popup getoond)
- [ ] Gevoelig: als het gewichtsverlies iets is om te vieren, zeg het; anders laten we het gewoon weg

## Techniek
- [x] Firebase config in `js/firebase-config.js`
- [ ] `.env` aanmaken met `IMMICH_URL` en `IMMICH_API_KEY` (API-sleutel met album.read, asset.read, asset.download), dan `npm run sync -- --dry-run`
- [ ] **Firestore-regels opnieuw publiceren** (`firebase/firestore.rules` heeft nu het `room`-veld; nodig voor privégesprekken)
- [ ] Testberichten en -bezoekers wissen: eerst `firebase/service-account.json` aanmaken (zie README, Firebase), dan
      `npm run chat -- delete 1MX8YMYzG5aTLpfy17vR 7tpPtycFIoFqfvWrDtT9 XgCfgkAGYFM43qbR2D71 pkeZbnpXLOyRDlkEa6TZ audo1jBnwpIEyxAFnZ7c OMUat1RndkKw5HE9N6Tm eqtzOdkQTIGMPprF4TGa`
      (= de 2 testberichten van "Webmaster (test)" en "Jan" + de 5 testbezoekers; `npm run chat` toont de lijst)
- [ ] GitHub Pages aanzetten (Settings -> Pages -> main / root) na de eerste push
- [ ] `assets/og.jpg` opnieuw maken met een echte foto (WhatsApp-preview): `node scripts/gen-og.mjs content/photos/_site/avatar.jpg`
- [ ] Testen op haar type gsm (iPhone/Android) — vooral: geluid na aanmelden, spraakclips, video
