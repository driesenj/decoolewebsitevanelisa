// Makes assets/og.jpg (1200x630), the image WhatsApp shows next to the link.
//   node scripts/gen-og.mjs                      -> glitter text only
//   node scripts/gen-og.mjs content/photos/_site/avatar.jpg   -> with a photo on the left
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, ensureDir, log } from './lib.mjs';

const photo = process.argv[2];
const W = 1200, H = 630;
const hearts = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 97) % W, y = (i * 173) % H, s = 0.6 + (i % 5) * 0.35, o = 0.15 + (i % 4) * 0.08;
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" fill="#ff3fa4" opacity="${o}"/>`;
}).join('');
const stars = Array.from({ length: 40 }, (_, i) => `<text x="${(i * 131 + 40) % W}" y="${(i * 89 + 60) % H}" font-size="${14 + (i % 3) * 8}" fill="#fff" opacity="${0.4 + (i % 3) * 0.2}">✦</text>`).join('');
const tx = photo ? 470 : 100, tw = photo ? 690 : 1000;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a0a18"/><stop offset="1" stop-color="#3a0b2e"/></linearGradient>
    <linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7ac8"/><stop offset=".3" stop-color="#fff"/><stop offset=".55" stop-color="#ff2d95"/><stop offset=".8" stop-color="#ffd6ee"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>${hearts}${stars}
  <text x="${tx}" y="215" font-family="Verdana, Arial, sans-serif" font-weight="900" font-size="60" fill="url(#gl)" stroke="#7a0040" stroke-width="2">De coole website</text>
  <text x="${tx}" y="300" font-family="Verdana, Arial, sans-serif" font-weight="900" font-size="60" fill="url(#gl)" stroke="#7a0040" stroke-width="2">van Elisa</text>
  <text x="${tx}" y="370" font-family="Verdana, Arial, sans-serif" font-style="italic" font-size="28" fill="#ffd6ee">..:: officiële fanpagina ::.. ♥</text>
  <rect x="${tx}" y="420" width="560" height="64" rx="8" fill="#ff2d95" stroke="#fff" stroke-width="3"/>
  <text x="${tx + 280}" y="463" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-weight="bold" font-size="25" fill="#fff">KLIK HIER OM BINNEN TE GAAN</text>
  <text x="${tx}" y="560" font-family="Verdana, Arial, sans-serif" font-size="20" fill="#fff" opacity=".7">x-x-x  ·  best bekeken in Internet Explorer 7  ·  1.000.001 bezoekers</text>
</svg>`;
let img = sharp(Buffer.from(svg));
if (photo) {
  const ph = await sharp(path.resolve(ROOT, photo)).rotate().resize(340, 450, { fit: 'cover' }).extend({ top: 8, bottom: 8, left: 8, right: 8, background: '#fff' }).toBuffer();
  img = img.composite([{ input: ph, left: 80, top: 90 }]);
}
await ensureDir(path.join(ROOT, 'assets'));
await img.jpeg({ quality: 88 }).toFile(path.join(ROOT, 'assets', 'og.jpg'));
log('assets/og.jpg written' + (photo ? ` with ${photo}` : ''));
