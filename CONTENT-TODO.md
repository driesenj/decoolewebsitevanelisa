# Nog in te vullen (content/content.json tenzij anders vermeld)

Alles wat op de site geel `TODO` toont, staat hier. Volgorde = wat het meeste oplevert per minuut.

## Vandaag
- [ ] WhatsApp sturen naar familie/vrienden: spraakbericht (max 30 s) + favoriete foto — deadline donderdagmiddag
- [ ] `site.msnEmail` — haar echte oude MSN-adres (en `site.displayName` als je haar echte displaynaam nog weet)
- [ ] `site.city` — woonplaats
- [ ] `site.birthday` — staat nu op 1995-09-19, klopt de dag?
- [ ] `kids[].name` — namen van de kindjes (nu "de grote" / "de kleine"; overal automatisch ingevuld via {kid1} {kid2})

## Foto's (content/photos/)
- [ ] `toen-ik-klein-was/` — jeugdfoto's (2008-2012 met flits in de spiegel = goud)
- [ ] `trouwfeest/`
- [ ] `mijn-lief-en-ik/` — >3 jaar oud of <1 jaar oud
- [ ] `de-kindjes/`
- [ ] `random/`
- [ ] `_site/avatar.jpg` — profielfoto (vierkant werkt best)
- [ ] Onderschriften per album in `albums.<album>.captions` (optioneel)

## Audio (content/audio/)
- [ ] `welkom.*` — de kindjes: "Welkom op de coole website van mama!!!" (speelt meteen na het aanmelden)
- [ ] `lied.*` — verjaardagslied door de kindjes
- [ ] `fanmail/<naam>.opus` — spraakberichten; per bestand een regel in `chat.contacts` (naam, MSN-displaynaam, pm, status, emoji).
      Volgorde in de chat = volgorde in `chat.contacts`.

## Video (content/video/)
- [ ] vlogs erin droppen; titels in `videos.items` (sleutel = bestandsnaam zonder extensie)

## Tekst
- [ ] `profile.fields`: lievelingseten, -drank, guilty pleasure, motto, "fanclub opgericht" (jaar)
- [ ] `profile.loves` / `profile.hates` — inside jokes
- [ ] `profile.stats` — laat de grote mama scoren op een paar dingen (ik heb voorzetten gedaan)
- [ ] `profile.music.top` — haar top 5 van 2008
- [ ] `profile.links.items` — inside jokes als "links"
- [ ] `chat.seed` — berichten die al in de chat staan bij de start (bv. van mensen die geen zin hebben om zelf te typen)
- [ ] `chat.groupName` / `chat.welcome` — naar smaak
- [ ] `toasts` — nog een paar complimentjes (worden als MSN-popup getoond)
- [ ] Gevoelig: als het gewichtsverlies iets is om te vieren, zeg het; anders laten we het gewoon weg

## Techniek
- [x] Firebase config in `js/firebase-config.js`
- [ ] Testbericht "Webmaster (test)" verwijderen in de Firebase console (Firestore -> guestbook)
- [ ] GitHub Pages aanzetten (Settings -> Pages -> main / root) na de eerste push
- [ ] `assets/og.jpg` opnieuw maken met een echte foto (WhatsApp-preview): `node scripts/gen-og.mjs content/photos/_site/avatar.jpg`
- [ ] Testen op haar type gsm (iPhone/Android) — vooral: geluid na aanmelden, spraakclips, video
