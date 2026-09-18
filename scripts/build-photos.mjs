// content/photos/<album>/*.{jpg,png,heic,...}  ->  media/photos/<album>/<key>.jpg        (max 1600px)
//                                                 media/photos/<album>/thumbs/<key>.jpg (max 480px)
// Folders starting with "_" are asset folders (blog/awards photos): resized, but not listed as albums.
// A folder without (usable) photos is not an album either: the site then shows it as "binnenkort".
// EXIF is stripped from the output (no GPS in a public repo). Photos whose EXIF date falls inside the
// content.json -> photoRules banned window are skipped unless the album has "allowAllDates": true.
// A photo is only converted again when its content changed (see fingerprint in lib.mjs); a renamed source just gets its
// existing output renamed along.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import { CONTENT, MEDIA, readContent, readManifest, writeManifest, ensureDir, isStale, listFiles, listDirs, baseKey, natural, run, exists, log, ver, fingerprint, saveHashCache, needsBuild, renamedFrom } from './lib.mjs';

const SRC = path.join(CONTENT, 'photos');
const OUT = path.join(MEDIA, 'photos');
const TMP = path.join(MEDIA, '.tmp');
const MAX = 1600, THUMB = 480;
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff', '.gif', '.avif']);
const NEEDS_MAGICK = new Set(['.heic', '.heif']);

const content = await readContent();
const rules = content.photoRules || {};
const banFrom = rules.bannedFrom ? new Date(rules.bannedFrom) : null;
const banTo = rules.bannedTo ? new Date(rules.bannedTo) : null;

function exifDate(buf) {
  if (!buf) return null;
  try {
    const ex = exifReader(buf);
    let d = ex?.Photo?.DateTimeOriginal ?? ex?.exif?.DateTimeOriginal ?? ex?.Image?.DateTime ?? ex?.image?.ModifyDate ?? null;
    if (typeof d === 'string') {
      const m = d.match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
      d = m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
    }
    return d instanceof Date && !isNaN(d) ? d : null;
  } catch { return null; }
}

async function toSharpInput(file) {
  const ext = path.extname(file).toLowerCase();
  if (!NEEDS_MAGICK.has(ext)) return file;
  // the prebuilt sharp binaries cannot decode HEIC; go through ImageMagick first
  await ensureDir(TMP);
  const tmp = path.join(TMP, baseKey(file) + '.jpg');
  if (await isStale(file, tmp)) run('magick', [file, '-quality', '95', tmp]);
  return tmp;
}

const previous = await readManifest();
const albums = [];
const assets = {};
const excluded = [];
let made = 0, kept = 0, renamed = 0;

for (const slug of await listDirs(SRC)) {
  const srcDir = path.join(SRC, slug);
  const outDir = path.join(OUT, slug);
  const thumbDir = path.join(outDir, 'thumbs');
  await ensureDir(thumbDir);
  const cfg = content.albums?.[slug] || {};
  const isAsset = slug.startsWith('_');
  const allowAll = isAsset || cfg.allowAllDates === true;
  const photos = [];
  const keep = new Set();
  // what the previous build made of this folder (fingerprints + keys), for change and rename detection
  const prev = isAsset
    ? Object.entries(previous.assets || {}).filter(([k]) => k.startsWith(slug + '/')).map(([k, e]) => ({ key: baseKey(k.slice(slug.length + 1)), file: k.slice(slug.length + 1), ...e }))
    : previous.albums?.find(a => a.slug === slug)?.photos || [];
  const names = await listFiles(srcDir, EXT);
  const currentKeys = new Set(names.map(baseKey));

  for (const name of names) {
    const src = path.join(srcDir, name);
    const key = baseKey(name);
    const out = path.join(outDir, key + '.jpg');
    const thumb = path.join(thumbDir, key + '.jpg');
    let date = null, w, h, tw, th, hash;
    try {
      const input = await toSharpInput(src);
      const img = sharp(input, { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      date = exifDate(meta.exif);
      if (!allowAll && date && banFrom && banTo && date >= banFrom && date <= banTo) {
        excluded.push(`${slug}/${name}  (${date.toISOString().slice(0, 10)})`);
        continue;
      }
      hash = await fingerprint(src);
      const old = !await exists(out) && renamedFrom(prev, hash, currentKeys);
      if (old && await exists(path.join(outDir, old.file))) {
        // same photo under a new name: move the outputs along
        await fs.rename(path.join(outDir, old.file), out);
        if (await exists(path.join(thumbDir, old.file))) await fs.rename(path.join(thumbDir, old.file), thumb);
        renamed++;
      }
      if (await needsBuild(src, out, prev.find(e => e.key === key)?.src, hash) || !await exists(thumb)) {
        const big = await img.clone().resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(out);
        const sm = await img.clone().resize({ width: THUMB, height: THUMB, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 78, mozjpeg: true }).toFile(thumb);
        ({ width: w, height: h } = big); ({ width: tw, height: th } = sm); made++;
      } else {
        ({ width: w, height: h } = await sharp(out).metadata());
        ({ width: tw, height: th } = await sharp(thumb).metadata()); kept++;
      }
    } catch (e) { console.error(`  ! ${slug}/${name}: ${e.message}`); continue; }
    keep.add(key + '.jpg');
    photos.push({ key, file: key + '.jpg', w, h, tw, th, date: date ? date.toISOString().slice(0, 10) : null, v: ver(hash), src: hash });
  }

  // remove outputs whose source disappeared
  for (const dir of [outDir, thumbDir]) {
    for (const f of await listFiles(dir, new Set(['.jpg']))) if (!keep.has(f)) await fs.rm(path.join(dir, f));
  }

  if (isAsset) { for (const p of photos) assets[`${slug}/${p.file}`] = { w: p.w, h: p.h, v: p.v, src: p.src }; continue; }
  if (!photos.length) { await fs.rm(outDir, { recursive: true, force: true }); continue; }
  if (cfg.sort === 'date') photos.sort((a, b) => (a.date || '').localeCompare(b.date || '') || natural(a.key, b.key));
  if (Array.isArray(cfg.order)) {
    const idx = k => { const i = cfg.order.indexOf(k); return i < 0 ? 1e9 : i; };
    photos.sort((a, b) => idx(a.key) - idx(b.key));
  }
  const cover = photos.find(p => p.key === (cfg.cover || '').toLowerCase()) || photos[0];
  albums.push({ slug, count: photos.length, cover: cover?.file || null, photos });
}

// drop album output dirs that no longer have a source dir
const srcDirs = new Set(await listDirs(SRC));
for (const d of await listDirs(OUT)) if (!srcDirs.has(d)) await fs.rm(path.join(OUT, d), { recursive: true, force: true });

const m = await readManifest();
m.albums = albums;
m.assets = assets;
await writeManifest(m);
await saveHashCache();

const excludedFile = path.join(CONTENT, 'excluded.txt');
if (excluded.length) {
  await fs.writeFile(excludedFile, excluded.join('\n') + '\n');
  log(`\n  ${excluded.length} photo(s) skipped because of the date rule (see content/excluded.txt).`);
  log(`  Set "allowAllDates": true on that album in content.json to override.\n`);
} else if (await exists(excludedFile)) await fs.rm(excludedFile);
log(`photos: ${albums.length} albums, ${albums.reduce((n, a) => n + a.count, 0)} photos, ${Object.keys(assets).length} assets (${made} converted, ${kept} up to date${renamed ? `, ${renamed} renamed` : ''})`);
