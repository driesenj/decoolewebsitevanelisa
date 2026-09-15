// Shared helpers for the build scripts.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
export async function mtime(p) { try { return (await fs.stat(p)).mtimeMs; } catch { return -1; } }
// true when `out` is missing or older than `src`
export async function isStale(src, out) {
  const [a, b] = await Promise.all([mtime(src), mtime(out)]);
  return b < 0 || a > b;
}
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
