// Generates placeholder source material in content/ so the site can be developed before the real
// photos/voice clips arrive. Everything it makes lands in git-ignored folders; delete at will.
//   npm run demo && npm run build
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { CONTENT, ensureDir, exists, log } from './lib.mjs';

const P = path.join(CONTENT, 'photos');
const A = path.join(CONTENT, 'audio');
const V = path.join(CONTENT, 'video');

// ---- photos -------------------------------------------------------------------------------------
const palettes = [['#ff3fa4', '#5b1a8a'], ['#ff8a00', '#ff2d95'], ['#00c2ff', '#7a00ff'], ['#ffd400', '#ff3fa4'], ['#00e08a', '#0057ff'], ['#ff5e5e', '#ffb800']];
async function placeholder(file, label, { w = 1200, h = 900, date, seed = 0 } = {}) {
  if (await exists(file)) return;
  const [c1, c2] = palettes[seed % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w * 0.5}" cy="${h * 0.42}" r="${Math.min(w, h) * 0.18}" fill="#fff" opacity=".85"/>
    <circle cx="${w * 0.44}" cy="${h * 0.39}" r="${Math.min(w, h) * 0.02}" fill="#333"/>
    <circle cx="${w * 0.56}" cy="${h * 0.39}" r="${Math.min(w, h) * 0.02}" fill="#333"/>
    <path d="M ${w * 0.43} ${h * 0.47} Q ${w * 0.5} ${h * 0.54} ${w * 0.57} ${h * 0.47}" stroke="#333" stroke-width="${Math.min(w, h) * 0.012}" fill="none" stroke-linecap="round"/>
    <text x="50%" y="${h * 0.78}" font-family="Verdana, Arial" font-weight="bold" font-size="${Math.min(w, h) * 0.07}" fill="#fff" text-anchor="middle">${label}</text>
    <text x="50%" y="${h * 0.86}" font-family="Verdana, Arial" font-size="${Math.min(w, h) * 0.035}" fill="#fff" text-anchor="middle" opacity=".8">placeholder</text>
  </svg>`;
  let img = sharp(Buffer.from(svg)).jpeg({ quality: 85 });
  if (date) img = img.withExif({ IFD0: { Software: 'gen-demo' }, IFD2: { DateTimeOriginal: date } });
  await img.toFile(file);
}

const albums = {
  'toen-ik-klein-was': { n: 7, dates: ['1996:06:01 12:00:00', '1999:08:14 12:00:00', '2003:05:01 12:00:00', '2007:07:21 12:00:00', '2009:03:03 12:00:00', '2011:12:24 12:00:00', '2013:09:19 12:00:00'] },
  'trouwfeest': { n: 6, dates: Array(6).fill('2024:06:15 14:00:00') },   // inside the banned window, but allowAllDates in content.json
  'de-kindjes': { n: 8, dates: ['2021:05:01 12:00:00', '2022:01:01 12:00:00', '2022:08:01 12:00:00', '2025:11:01 12:00:00', '2026:01:01 12:00:00', '2026:03:01 12:00:00', '2026:06:01 12:00:00', '2026:08:01 12:00:00'] },
  'random': { n: 6, dates: ['2019:02:02 12:00:00', '2024:04:04 12:00:00', '2020:03:03 12:00:00', null, '2026:05:05 12:00:00', '2018:07:07 12:00:00'] }, // #2 should be excluded by the date rule
};
let i = 0;
for (const [slug, cfg] of Object.entries(albums)) {
  await ensureDir(path.join(P, slug));
  for (let n = 1; n <= cfg.n; n++, i++) {
    const portrait = n % 3 === 0;
    await placeholder(path.join(P, slug, `IMG_${1000 + i}.jpg`), `${slug} #${n}`, { w: portrait ? 900 : 1200, h: portrait ? 1200 : 900, date: cfg.dates[n - 1], seed: i });
  }
}
await ensureDir(path.join(P, '_site'));
await placeholder(path.join(P, '_site', 'avatar.jpg'), 'Elisa', { w: 600, h: 600, seed: 0 });
log('photos: ok');

// ---- audio (Windows TTS) ------------------------------------------------------------------------
async function tts(file, text) {
  if (await exists(file)) return;
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$nl = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'nl-*' } | Select-Object -First 1
if ($nl) { $s.SelectVoice($nl.VoiceInfo.Name) }
$s.SetOutputToWaveFile('${file.replace(/'/g, "''")}')
$s.Speak('${text.replace(/'/g, "''")}')
$s.Dispose()`;
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
}
await ensureDir(path.join(A, 'fanmail'));
await ensureDir(path.join(A, 'soundboard'));
const fanmail = {
  oma: 'Dag Elisa, hier is oma. Een dikke proficiat met je verjaardag. Geniet van Parijs en eet een croissant voor mij.',
  opa: 'Elisa, opa hier. Proficiat. Ik heb dit bericht drie keer moeten inspreken. Dag.',
  'tante-an': 'Hey schat! Gelukkige verjaardag! Ik mis je! Kusjes uit het verre Vlaanderen!',
  'de-kindjes': 'Mama! Gelukkige verjaardag! Kom je snel terug? Wij hebben een taart gemaakt en papa heeft ze laten vallen.',
  'de-webmaster': 'Dit is een testbericht van de webmaster. Als je dit hoort werkt alles. Ik zie u graag.',
};
for (const [k, t] of Object.entries(fanmail)) await tts(path.join(A, 'fanmail', `${k}.wav`), t);
await tts(path.join(A, 'welkom.wav'), 'Welkom op de coole website van mama!');
await tts(path.join(A, 'lied.wav'), 'Lang zal ze leven, lang zal ze leven, lang zal ze leven in de gloria.');
await tts(path.join(A, 'soundboard', 'allez-komaan.wav'), 'Allez, komaan!');
await tts(path.join(A, 'soundboard', 'schoenen-aan.wav'), 'Schoenen aan!');
await tts(path.join(A, 'soundboard', 'mama.wav'), 'Mama!');
log('audio: ok');

// ---- video (ffmpeg test pattern) ----------------------------------------------------------------
await ensureDir(V);
for (const [n, size] of [[1, '540x960'], [2, '960x540'], [3, '540x960']]) {
  const f = path.join(V, `vlog-demo-${n}.mp4`);
  if (await exists(f)) continue;
  const r = spawnSync(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc=duration=6:size=${size}:rate=25`, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', f], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
}
log('video: ok');
