// Fetches the original BonziBUDDY animation frames (JCLemme/bonzi, MIT-licensed extraction of the MS Agent
// character) and packs a handful of animations into sprite sheets: assets/bonzi/<anim>.png + assets/bonzi/anims.json
//   node scripts/bonzi-sprites.mjs
// Only the animations listed in WANT are fetched (a few hundred frames instead of 1,253).
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, ensureDir, exists, log } from './lib.mjs';

const RAW = 'https://raw.githubusercontent.com/JCLemme/bonzi/master/data/';
const OUT = path.join(ROOT, 'assets', 'bonzi');
const CACHE = path.join(ROOT, 'media', '.tmp', 'bonzi-frames');
const W = 200, H = 160;
// name in the .acd -> short name used by the site
const WANT = {
  Greet: 'greet', Wave: 'wave', Idle1_1: 'idle', Blink: 'blink', Explain: 'explain', Congratulate: 'congratulate',
  Surprised: 'surprised', Pleased: 'pleased', GetAttention: 'attention', Think: 'think', Hide: 'hide', Show: 'show',
  RestPose: 'rest', Sad: 'sad', Read: 'read', Juggle: 'juggle', Banana: 'banana', BlowKiss: 'kiss', Hug: 'hug',
  Giggle: 'giggle', Wink: 'wink', DoMagic1: 'magic', HeadphonesContinued: 'headphones', Suggest: 'suggest', Shoosh: 'shoosh',
};

const acd = await (await fetch(RAW + 'bonzi_def.txt')).text();
const anims = {};
const animRe = /DefineAnimation\s+"([^"]+)"([\s\S]*?)EndAnimation/g;
const frameRe = /DefineFrame([\s\S]*?)EndFrame/g;
const durRe = /Duration\s*=\s*(\d+)/;
const imgRe = /Filename\s*=\s*"Images\\(\d+)\.bmp"/g;
let m;
while ((m = animRe.exec(acd))) {
  const frames = [];
  let f;
  while ((f = frameRe.exec(m[2]))) {
    const body = f[1];
    const dur = durRe.exec(body);
    const imgs = [...body.matchAll(imgRe)].map(x => x[1]);
    frames.push({ imgs, dur: dur ? +dur[1] : 10 });
  }
  anims[m[1]] = frames;
}
log(`${Object.keys(anims).length} animations in Bonzi.acd:`, Object.keys(anims).join(', '));

await ensureDir(OUT); await ensureDir(CACHE);
async function frame(id) {
  const p = path.join(CACHE, id + '.png');
  if (!await exists(p)) {
    const r = await fetch(`${RAW}Images/${id}.bmp.png`);
    if (!r.ok) throw new Error(`frame ${id}: ${r.status}`);
    await fs.writeFile(p, Buffer.from(await r.arrayBuffer()));
  }
  return p;
}

const manifest = {};
for (const [acdName, short] of Object.entries(WANT)) {
  const frames = anims[acdName];
  if (!frames) { log(`  (no animation "${acdName}")`); continue; }
  // MS Agent frames can stack several images; composite them onto one 200x160 cell
  const cells = [];
  for (const fr of frames) {
    if (!fr.imgs.length) { cells.push(null); continue; }
    const layers = [];
    for (const id of fr.imgs) layers.push({ input: await frame(id), left: 0, top: 0 });
    cells.push(await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer());
  }
  const n = cells.length;
  const cols = Math.min(n, 10), rows = Math.ceil(n / cols);
  const sheet = sharp({ create: { width: W * cols, height: H * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(cells.map((c, i) => c ? { input: c, left: (i % cols) * W, top: Math.floor(i / cols) * H } : null).filter(Boolean));
  await sheet.png({ compressionLevel: 9, palette: true }).toFile(path.join(OUT, short + '.png'));
  manifest[short] = { cols, frames: frames.map(f => f.dur * 10) };   // durations in ms (MS Agent unit = 1/100 s)
  log(`  ${short.padEnd(12)} ${n} frames, ${frames.reduce((a, f) => a + f.dur, 0) * 10} ms`);
}
manifest._meta = { w: W, h: H, source: 'https://github.com/JCLemme/bonzi (MIT) — original Bonzi Software artwork' };
await fs.writeFile(path.join(OUT, 'anims.json'), JSON.stringify(manifest));
log('assets/bonzi/ written');
