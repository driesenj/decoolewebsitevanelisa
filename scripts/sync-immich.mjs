// Pulls the site's source material out of Immich into content/, then runs the build:
//   photo albums  ->  content/photos/<slug>/      Immich album named like the album's title or key in content.json
//                                                (or set "immich": "Name in Immich" on the album to pick one explicitly)
//   album "Vlog"  ->  content/video/              videos only                              (name: content.json -> immich.vlog)
//   album "MSN"   ->  content/video/fanmail/      video messages from fans                 (name: content.json -> immich.msn)
//                     content/audio/fanmail/      voice messages, if your Immich accepts audio uploads (most versions don't)
// Vlog/MSN files are named after the asset's description in Immich ("Tante An" -> "Tante An.mov", which the build turns
// into the key tante-an, used in content.json: msn.contacts, videos.items), else after the original file name.
// Photos keep their original file name.
// A file is recognised by its content, not its name: rename a downloaded file and it keeps your name from then on
// (only a file still carrying the name the sync gave it follows a changed description in Immich), and a copy you put in
// content/ yourself is adopted instead of downloaded again.
// Only files this script downloaded are ever removed again (they are tracked in content/.immich-sync.json), so anything
// you drop into content/ by hand stays. An album that disappeared from Immich leaves its files alone too.
//
// Setup: IMMICH_URL and IMMICH_API_KEY in .env (see .env.example); the key needs album.read, asset.read, asset.download.
//   npm run sync                 pull + build
//   npm run sync -- --dry-run    only show what would happen
//   npm run sync -- --no-build   pull without building
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { ROOT, CONTENT, readContent, readJson, ensureDir, exists, baseKey, log, fingerprint, saveHashCache } from './lib.mjs';

const DRY = process.argv.includes('--dry-run');
const NO_BUILD = process.argv.includes('--no-build');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env: maybe the variables are set another way */ }
const BASE = (process.env.IMMICH_URL || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
const KEY = (process.env.IMMICH_API_KEY || '').trim();
if (!BASE || !KEY) {
  console.error('Zet IMMICH_URL en IMMICH_API_KEY in .env (voorbeeld: .env.example). De API-sleutel maak je in Immich onder');
  console.error('Account -> API-sleutels, met de rechten album.read, asset.read en asset.download.');
  process.exit(1);
}

const STATE_FILE = path.join(CONTENT, '.immich-sync.json');
const PARALLEL = 4;
const content = await readContent();
const cfg = content.immich || {};
const state = await readJson(STATE_FILE, { files: {} });
const saveState = () => DRY ? Promise.resolve() : fs.writeFile(STATE_FILE, JSON.stringify(state, null, 1));

// ---- immich api ---------------------------------------------------------------------------------
async function api(pathname, { method = 'GET', body, raw = false } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${pathname}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'x-api-key': KEY, accept: raw ? 'application/octet-stream' : 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    });
  } catch (e) { throw new Error(`Geen verbinding met ${BASE} (${e.cause?.code || e.message})`); }
  if (!res.ok) {
    const hint = res.status === 401 ? ' — API-sleutel klopt niet' : res.status === 403 ? ' — API-sleutel mist een recht (album.read, asset.read, asset.download)' : res.status === 404 && !raw ? ' — is dit wel een Immich-adres?' : '';
    const err = new Error(`${method} ${pathname} -> ${res.status}${hint}`);
    err.status = res.status;
    throw err;
  }
  return raw ? res : res.json();
}

// Every Immich version lists an album's assets a bit differently: older ones inline them in GET /albums/:id, newer ones
// leave that to the search endpoint, whose paging changed again in v3.2. Try them in turn, oldest first.
async function albumAssets(album) {
  const info = await api(`/albums/${album.id}`);
  if (Array.isArray(info.assets)) return info.assets;
  const variants = [
    { first: () => ({ filter: { albumIds: { any: [album.id] } }, withExif: true, size: 250 }), next: (r, body) => r.assets.nextCursor ? { ...body, cursor: r.assets.nextCursor } : null },
    { first: () => ({ albumIds: [album.id], withExif: true, size: 250, page: 1 }), next: (r, body) => r.assets.nextPage ? { ...body, page: +r.assets.nextPage } : null },
  ];
  let lastErr;
  for (const v of variants) {
    try {
      const items = [];
      for (let body = v.first(); body;) {
        const r = await api('/search/metadata', { method: 'POST', body });
        // a server that silently drops the album filter would hand us the whole library
        if (r.assets.total > album.assetCount || items.length + r.assets.items.length > album.assetCount) throw new Error('albumfilter genegeerd');
        items.push(...r.assets.items);
        body = v.next(r, body);
      }
      return items;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`assets van "${album.albumName}" niet op te halen (${lastErr.message})`);
}

// ---- naming ---------------------------------------------------------------------------------------
// "Tante An" / "Tanté An!" -> "tante-an": the same rule the site uses to match Messenger names (util.js norm)
const slug = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/<3|\(l\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// a description as a file name: drop what Windows/macOS refuse, collapse whitespace
const fileName = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
const MIME_EXT = { 'video/quicktime': '.mov', 'video/mp4': '.mp4', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a' };
const ext = (a) => path.extname(a.originalFileName || '').toLowerCase() || MIME_EXT[a.originalMimeType] || '';
const firstLine = (s) => String(s || '').split('\n')[0].trim();

// finds the Immich album for one of ours: exact name (set with "immich"), else title or key, forgiving about case/decoration
function findAlbum(albums, wanted, exact) {
  if (exact) return albums.find(a => a.albumName.trim().toLowerCase() === exact.trim().toLowerCase()) || null;
  const targets = wanted.map(slug).filter(Boolean);
  return albums.find(a => targets.includes(slug(a.albumName)))
    || albums.find(a => targets.some(t => slug(a.albumName).startsWith(t + '-') || t.startsWith(slug(a.albumName) + '-')))
    || null;
}

// ---- one album -> one folder --------------------------------------------------------------------------
// kind: 'photos' (everything, original names) | 'vlog' (videos) | 'msn' (videos + audio, named by description)
async function syncAlbum({ album, kind, dir, label }) {
  const assets = (await albumAssets(album)).filter(a => !a.isTrashed);
  assets.sort((a, b) => String(a.fileCreatedAt || '').localeCompare(String(b.fileCreatedAt || '')) || a.id.localeCompare(b.id));
  const audioDir = dir.replace(/^video/, 'audio');
  const dirs = kind === 'msn' ? [dir, audioDir] : [dir];
  const mine = (rel) => dirs.includes(path.posix.dirname(rel));
  const abs = (rel) => path.join(CONTENT, rel);

  // what Immich would call each asset (folder + file name)
  const desired = new Map();     // asset -> { sub, name }
  let skipped = 0;
  for (const a of assets) {
    if (kind === 'photos') {
      if (a.type !== 'IMAGE') { skipped++; continue; }
      desired.set(a, { sub: dir, name: a.originalFileName });
    } else {
      const sub = a.type === 'VIDEO' ? dir : a.type === 'AUDIO' && kind === 'msn' ? audioDir : null;
      if (!sub) { skipped++; continue; }
      if (a.exifInfo === undefined) a.exifInfo = (await api(`/assets/${a.id}`)).exifInfo;   // the description lives in there
      desired.set(a, { sub, name: (fileName(firstLine(a.exifInfo?.description)) || path.parse(a.originalFileName || a.id).name) + ext(a) });
    }
  }

  // our files in these folders (by asset id), and the files that are not ours: dropped in or renamed by hand
  const tracked = new Map();
  for (const [rel, e] of Object.entries(state.files)) if (mine(rel)) tracked.set(e.id, { rel, e });
  const untracked = [];
  for (const d of dirs) {
    let names = [];
    try { names = (await fs.readdir(abs(d), { withFileTypes: true })).filter(x => x.isFile() && !x.name.startsWith('.') && !x.name.endsWith('.part')).map(x => x.name); } catch { }
    for (const n of names) { const rel = path.posix.join(d, n); if (!state.files[rel]) untracked.push(rel); }
  }
  // an untracked file with exactly these bytes (hashes are cached, so this is cheap after the first run)
  const twinOf = async (checksum) => { for (const rel of untracked) if (await fingerprint(abs(rel)) === checksum) return rel; return null; };

  const keyOf = (r) => path.posix.dirname(r) + '/' + baseKey(path.posix.basename(r));   // "Bob.mp4" and "bob.mp4" would clash in the build
  const claimed = new Set(), claimedKeys = new Set();
  const claim = (rel) => { claimed.add(rel); claimedKeys.add(keyOf(rel)); };
  const plan = { download: [], again: [], adopt: [], rename: [], dupe: [], foreign: [], kept: 0 };

  for (const [a, { sub, name }] of desired) {
    let t = tracked.get(a.id) || null;
    if (t && !await exists(abs(t.rel))) { delete state.files[t.rel]; t = null; }         // our file is gone: renamed or deleted by hand
    // the same bytes under another name: that name wins (renamed by hand, or copied in before the sync ever ran)
    const twin = await twinOf(a.checksum);
    if (twin) {
      if (t) { plan.dupe.push(t.rel); delete state.files[t.rel]; }                       // our copy is a duplicate now
      const e = { id: a.id, checksum: a.checksum, name: t?.e.name || name };             // name = what the sync calls it; basename != name marks it as yours
      state.files[twin] = e; t = { rel: twin, e };
      untracked.splice(untracked.indexOf(twin), 1);
      plan.adopt.push(twin);
    }
    if (t) {
      const e = t.e;
      e.name ??= path.posix.basename(t.rel);                                              // entries from before names were recorded
      const want = path.posix.join(sub, name);
      // still carrying the name the sync gave it, and Immich calls it differently now: follow Immich
      if (path.posix.basename(t.rel) === e.name && t.rel !== want && !claimedKeys.has(keyOf(want)) && !await exists(abs(want))) {
        plan.rename.push([t.rel, want]);
        delete state.files[t.rel]; state.files[want] = e; e.name = name; t.rel = want;
      }
      if (e.checksum !== a.checksum) plan.again.push([t.rel, a]); else plan.kept++;     // edited in Immich: fetch again, keep the local name
      claim(t.rel);
      continue;
    }
    // new to us: download under Immich's name, made unique among what is there already
    let rel = path.posix.join(sub, name);
    if (await exists(abs(rel))) { plan.foreign.push(rel); continue; }                    // something else lives there: not ours to overwrite
    const [, base, e = ''] = rel.match(/^(.*?)(\.[^./]*)?$/);
    for (let n = 2; claimedKeys.has(keyOf(rel)) || await exists(abs(rel)); n++) rel = `${base}-${n}${e}`;
    plan.download.push([rel, a]);
    claim(rel);
  }
  const gone = Object.keys(state.files).filter(rel => mine(rel) && !claimed.has(rel));  // ours, but no longer in the album

  let failed = 0;
  if (!DRY) {
    for (const rel of plan.dupe) await fs.rm(abs(rel), { force: true });
    for (const [from, to] of plan.rename) { await ensureDir(path.dirname(abs(to))); await fs.rename(abs(from), abs(to)); }
    await pool([...plan.download, ...plan.again], PARALLEL, async ([rel, a]) => {
      try { await download(a, abs(rel)); state.files[rel] = { id: a.id, checksum: a.checksum, name: state.files[rel]?.name || path.posix.basename(rel) }; }
      catch (e) { failed++; console.error(`  ! ${rel}: ${e.message}`); }
    });
    for (const rel of gone) { await fs.rm(abs(rel), { force: true }); delete state.files[rel]; }
    await saveState();
  }
  const noun = desired.size === 1 ? { photos: 'foto', vlog: 'video', msn: 'bericht' }[kind] : { photos: "foto's", vlog: "video's", msn: 'berichten' }[kind];
  const bits = [`${desired.size} ${noun}`];
  if (plan.download.length) bits.push(`${plan.download.length} nieuw`);
  if (plan.again.length) bits.push(`${plan.again.length} opnieuw (gewijzigd in Immich)`);
  if (failed) bits.push(`${failed} mislukt`);
  if (plan.adopt.length) bits.push(`${plan.adopt.length} overgenomen met jouw naam`);
  if (plan.rename.length) bits.push(`${plan.rename.length} hernoemd (beschrijving in Immich)`);
  if (plan.dupe.length) bits.push(`${plan.dupe.length} dubbele sync-kopie weg`);
  if (gone.length) bits.push(`${gone.length} weg (niet meer in het album)`);
  if (plan.foreign.length) bits.push(`${plan.foreign.length} bestaat al (niet van Immich, blijft staan)`);
  if (skipped) bits.push(`${skipped} overgeslagen (${kind === 'photos' ? 'geen foto' : kind === 'vlog' ? 'geen video' : "foto's horen hier niet"})`);
  log(`  ${label.padEnd(18)} <- "${album.albumName}"  ${bits.join(', ')}`);
  for (const rel of plan.adopt) log(`      = ${rel}`);
  for (const [from, to] of plan.rename) log(`      > ${from} -> ${to}`);
  for (const rel of plan.dupe) log(`      - ${rel} (dubbel)`);
  for (const rel of gone) log(`      - ${rel}`);
  if (DRY) for (const [rel] of plan.download) log(`      + ${rel}`);
  if (DRY) for (const [rel] of plan.again) log(`      ~ ${rel}`);
}

async function download(a, abs) {
  const res = await api(`/assets/${a.id}/original`, { raw: true });
  await ensureDir(path.dirname(abs));
  const tmp = abs + '.part';
  const hash = createHash('sha1');
  try {
    await pipeline(Readable.fromWeb(res.body), async function* (src) { for await (const chunk of src) { hash.update(chunk); yield chunk; } }, createWriteStream(tmp));
  } catch (e) { await fs.rm(tmp, { force: true }); throw e; }
  if (a.checksum && hash.digest('base64') !== a.checksum) console.warn(`  ! ${path.basename(abs)}: checksum wijkt af van Immich (download onvolledig?)`);
  await fs.rename(tmp, abs);
}
async function pool(items, n, fn) {
  const it = items[Symbol.iterator]();
  await Promise.all(Array.from({ length: n }, async () => { for (let x = it.next(); !x.done; x = it.next()) await fn(x.value); }));
}

// ---- main ------------------------------------------------------------------------------------------
let albums;
try { albums = await api('/albums'); } catch (e) { console.error(e.message); process.exit(1); }
log(`Immich: ${BASE} — ${albums.length} albums${DRY ? '  (dry-run: er wordt niets gedownload of verwijderd)' : ''}`);
const jobs = [], missing = [];
for (const [key, a] of Object.entries(content.albums || {})) {
  if (key.startsWith('_')) continue;
  const album = findAlbum(albums, [a.title, key], a.immich);
  if (album) jobs.push({ album, kind: 'photos', dir: `photos/${key}`, label: key });
  else missing.push(`${key} (verwacht "${a.immich || a.title || key}")`);
}
for (const [kind, name, dir] of [['vlog', cfg.vlog || 'Vlog', 'video'], ['msn', cfg.msn || 'MSN', 'video/fanmail']]) {
  const album = findAlbum(albums, [name]);
  if (album) jobs.push({ album, kind, dir, label: kind });
  else missing.push(`${kind} (verwacht "${name}")`);
}
let errors = 0;
for (const job of jobs) {
  try { await syncAlbum(job); } catch (e) { errors++; console.error(`  ${job.label.padEnd(18)} !  ${e.message}`); }
}
if (missing.length) log(`  nog geen Immich-album voor: ${missing.join(', ')}`);
const used = new Set(jobs.map(j => j.album.id));
const unused = albums.filter(a => !used.has(a.id)).map(a => `"${a.albumName}"`);
if (unused.length) log(`  niet gebruikt uit Immich: ${unused.join(', ')}`);
await saveHashCache();
if (errors) { console.error(`\n${errors} album(s) mislukt; de bestanden daarvan blijven zoals ze waren.`); process.exit(1); }
if (!DRY && !NO_BUILD) {
  log('');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
