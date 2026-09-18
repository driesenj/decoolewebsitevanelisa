// Shared helpers for the build scripts.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT = path.join(ROOT, 'content');
export const MEDIA = path.join(ROOT, 'media');
export const MANIFEST = path.join(MEDIA, 'manifest.json');

export async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { if (fallback !== undefined) return fallback; throw e; }
}
export const readContent = () => readJson(path.join(CONTENT, 'content.json'));
export const readManifest = () => readJson(MANIFEST, {});
export async function writeManifest(m) {
  m.builtAt = new Date().toISOString();
  await ensureDir(MEDIA);
  await fs.writeFile(MANIFEST, JSON.stringify(m, null, 1));
}
export const ensureDir = (d) => fs.mkdir(d, { recursive: true });
export async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
// "When did this file last change here?" A file copied in with its original date (Explorer, cp -p, WhatsApp exports)
// keeps an old mtime but gets a fresh ctime/birthtime, so take the latest of the three.
export async function mtime(p) { try { const s = await fs.stat(p); return Math.max(s.mtimeMs, s.ctimeMs, s.birthtimeMs); } catch { return -1; } }
// true when `out` is missing or older than `src`
export async function isStale(src, out) {
  const [a, b] = await Promise.all([mtime(src), mtime(out)]);
  return b < 0 || a > b;
}
// ---- content fingerprints ---------------------------------------------------------------------------
// The builds decide "has this source changed?" by content, not by timestamp: a file copied in with an old date, or
// renamed (which bumps ctime), is still recognised. Hashes are cached by (size, mtime, ctime) in media/.tmp/hashes.json
// so an unchanged file is never read twice. The same fingerprint identifies a renamed source (same bytes, new name),
// and its first characters make the ?v= cache-buster the site appends to media URLs.
export function sha1File(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha1');
    createReadStream(file).on('data', c => h.update(c)).on('error', reject).on('end', () => resolve(h.digest('base64')));
  });
}
const HASH_CACHE = path.join(MEDIA, '.tmp', 'hashes.json');
let hashCache = null, hashDirty = false;
export async function fingerprint(file) {
  hashCache ??= await readJson(HASH_CACHE, {});
  const key = path.relative(ROOT, file).replace(/\\/g, '/');
  const st = await fs.stat(file);
  const c = hashCache[key];
  if (c && c.size === st.size && c.mtime === st.mtimeMs && c.ctime === st.ctimeMs) return c.sha1;
  const sha1 = await sha1File(file);
  hashCache[key] = { size: st.size, mtime: st.mtimeMs, ctime: st.ctimeMs, sha1 };
  hashDirty = true;
  return sha1;
}
export async function saveHashCache() {
  if (!hashDirty) return;
  for (const key of Object.keys(hashCache)) if (!await exists(path.join(ROOT, key))) delete hashCache[key];
  await ensureDir(path.dirname(HASH_CACHE));
  await fs.writeFile(HASH_CACHE, JSON.stringify(hashCache));
  hashDirty = false;
}
// version token for the site's ?v= (base64url so it is safe in a URL)
export const ver = (sha1) => sha1.slice(0, 8).replace(/\+/g, '-').replace(/\//g, '_');
// Decides whether `out` must be (re)made from `src`. `prevSrc` is the fingerprint recorded for this output by the previous
// build; without one (first build after this was introduced) the timestamps decide, as before.
export async function needsBuild(src, out, prevSrc, hash) {
  if (!await exists(out)) return true;
  return prevSrc ? prevSrc !== hash : isStale(src, out);
}
// A source that was renamed still has its old output lying around under the old key: find that entry.
// `prev` = previous manifest entries of the same folder, `currentKeys` = keys that still have a source (those stay put).
export const renamedFrom = (prev, hash, currentKeys) => prev.find(e => e.src === hash && !currentKeys.has(e.key)) || null;
export const natural = (a, b) => a.localeCompare(b, 'nl', { numeric: true, sensitivity: 'base' });
export async function listFiles(dir, exts) {
  let names;
  try { names = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
  return names
    .filter(d => d.isFile() && !d.name.startsWith('.') && exts.has(path.extname(d.name).toLowerCase()))
    .map(d => d.name).sort(natural);
}
export async function listDirs(dir) {
  try { return (await fs.readdir(dir, { withFileTypes: true })).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name).sort(natural); }
  catch { return []; }
}
// Output keys are the lowercase file name without extension: "IMG_1234.HEIC" -> "img_1234"
export const baseKey = (f) => path.parse(f).name.toLowerCase().replace(/\s+/g, '-');

export function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${path.basename(bin)} failed (${r.status}):\n${r.stderr || r.stdout}`);
  return r.stdout;
}
export const log = (...a) => console.log(...a);
