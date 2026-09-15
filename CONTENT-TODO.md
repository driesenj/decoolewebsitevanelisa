# Nog in te vullen (content/content.json tenzij anders vermeld)

Alles wat op de site geel `TODO` toont, staat hier. Volgorde = wat het meeste oplevert per minuut.

## Vandaag
- [ ] WhatsApp sturen naar familie/vrienden: spraakbericht (max 30 s) + favoriete foto + "welke medaille geef jij Elisa" — deadline donderdagmiddag
- [ ] `site.msnEmail` — haar echte oude MSN-adres (en `site.displayName` als je haar echte displaynaam nog weet)
- [ ] `site.city` — woonplaats
- [ ] `site.birthday` — staat nu op 1995-09-19, klopt de dag?
- [ ] `kids[].name` — namen van de kindjes (nu "de grote" / "de kleine"; overal automatisch ingevuld via {kid1} {kid2})
- [ ] Timeline: per sleutelwoord een jaartal + één zin: studeren, blackfisk, nicaragua, afgestudeerd, joep/mansion, vinois, huisje, luna, flo, papa (`timeline.items`)

## Foto's (content/photos/)
- [ ] `toen-ik-klein-was/` — jeugdfoto's (2008-2012 met flits in de spiegel = goud)
- [ ] `trouwfeest/`
- [ ] `mijn-lief-en-ik/` — >3 jaar oud of <1 jaar oud
- [ ] `de-kindjes/`
- [ ] `random/`
- [ ] `_site/avatar.jpg` — profielfoto (vierkant werkt best)
- [ ] `_blog/` — één foto per timeline-item, naam vrij, verwijs ernaar via `"photo": "_blog/naam.jpg"`
- [ ] `_prijzen/` — bewijsfoto's bij de medailles
- [ ] Onderschriften per album in `albums.<album>.captions` (optioneel)
- [ ] Tekeningen van de grote fotograferen -> `_prijzen/` (diploma) of stuur ze mij, dan maak ik er stickers/achtergrond van

## Audio (content/audio/)
- [ ] `welkom.*` — de kindjes: "Welkom op de coole website van mama!!!" (speelt meteen na het aanmelden)
- [ ] `lied.*` — verjaardagslied door de kindjes
- [ ] `fanmail/<naam>.opus` — spraakberichten; per bestand een regel in `fanmail.contacts` (naam, MSN-displaynaam, pm, status, emoji)
- [ ] `soundboard/` — de grote die mama nadoet ("Allez komaan!", "Schoenen aan!") + de kleine "Mama!"; labels in `soundboard.items`

## Video (content/video/)
- [ ] vlogs erin droppen; titels in `videos.items` (sleutel = bestandsnaam zonder extensie)

## Tekst
- [ ] `profile.fields`: lievelingseten, -drank, guilty pleasure, motto, "fanclub opgericht" (jaar)
- [ ] `profile.loves` / `profile.hates` — inside jokes
- [ ] `profile.stats` — laat de grote mama scoren op een paar dingen (ik heb voorzetten gedaan)
- [ ] `profile.friends.items` — top 8 (3× TODO)
- [ ] `profile.music.top` — haar top 5 van 2008
- [ ] `profile.links.items` — inside jokes als "links"
- [ ] `awards.items` — medailles van vrienden (uit de WhatsApp-oogst)
- [ ] `guestbook.seed` — berichten van mensen die geen zin hebben om zelf te typen
- [ ] `toasts` — nog een paar complimentjes (worden als MSN-popup getoond)
- [ ] `timeline.items[2008]` — haar MSN personal message (liedjestekst)
- [ ] Gevoelig: als het gewichtsverlies iets is om te vieren, zeg het, dan komt er een medaille/blogpost; anders laten we het gewoon weg

## Techniek
- [ ] Firebase aanmaken (README, 10 min) en config plakken in `js/firebase-config.js`
- [ ] GitHub Pages aanzetten (Settings -> Pages -> main / root)
- [ ] `assets/og.jpg` vervangen door een echte foto (WhatsApp-preview), 1200x630
- [ ] `site.lastUpdated` op de dag van verzenden zetten
- [ ] Testen op haar type gsm (iPhone/Android) — vooral: geluid na aanmelden, spraakclips, video
