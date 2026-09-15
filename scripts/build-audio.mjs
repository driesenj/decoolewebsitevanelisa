// content/audio/fanmail/*     -> media/audio/fanmail/<key>.mp3    (voice clips: mono, normalised, silence trimmed)
// content/audio/soundboard/*  -> media/audio/soundboard/<key>.mp3
// content/audio/<name>.*      -> media/audio/<key>.mp3             (singles: welkom, lied, ...)
// WhatsApp voice notes (.opus/.ogg/.m4a) are fine as input. iOS Safari cannot play opus, hence mp3.
import path from 'node:path';
import fs from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { CONTENT, MEDIA, readContent, readManifest, writeManifest, ensureDir, isStale, listFiles, baseKey, run, log } from './lib.mjs';

const SRC = path.join(CONTENT, 'audio');
const OUT = path.join(MEDIA, 'audio');
const EXT = new Set(['.opus', '.ogg', '.oga', '.m4a', '.aac', '.mp3', '.wav', '.wma', '.flac', '.amr', '.3gp', '.mp4', '.webm', '.caf']);
const content = await readContent();
// singles listed here are treated as music: stereo, no silence trimming
const musicKeys = new Set((content.audio?.music || ['lied']).map(s => s.toLowerCase()));

const duration = (f) => parseFloat(run(ffprobe.path, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])) || 0;
const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.25,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.4,areverse';
const norm = 'loudnorm=I=-16:TP=-1.5:LRA=11';

async function convert(src, out, { music }) {
  if (!await isStale(src, out)) return false;
  await ensureDir(path.dirname(out));
  const af = music ? norm : `${trim},${norm}`;
  run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src, '-vn', '-af', af, '-ac', music ? '2' : '1', '-ar', '44100',
    '-c:a', 'libmp3lame', '-b:a', music ? '128k' : '96k', out]);
  return true;
}

let made = 0;
const result = { fanmail: [], soundboard: [], singles: {} };
for (const group of ['fanmail', 'soundboard']) {
  const keep = new Set();
  for (const name of await listFiles(path.join(SRC, group), EXT)) {
    const key = baseKey(name), out = path.join(OUT, group, key + '.mp3');
    try { if (await convert(path.join(SRC, group, name), out, { music: false })) made++; }
    catch (e) { console.error(`  ! ${group}/${name}: ${e.message}`); continue; }
    keep.add(key + '.mp3');
    result[group].push({ key, file: `${group}/${key}.mp3`, duration: duration(out) });
  }
  for (const f of await listFiles(path.join(OUT, group), new Set(['.mp3']))) if (!keep.has(f)) await fs.rm(path.join(OUT, group, f));
}
const keepSingles = new Set();
for (const name of await listFiles(SRC, EXT)) {
  const key = baseKey(name), out = path.join(OUT, key + '.mp3');
  try { if (await convert(path.join(SRC, name), out, { music: musicKeys.has(key) })) made++; }
  catch (e) { console.error(`  ! ${name}: ${e.message}`); continue; }
  keepSingles.add(key + '.mp3');
  result.singles[key] = { key, file: `${key}.mp3`, duration: duration(out) };
}
for (const f of await listFiles(OUT, new Set(['.mp3']))) if (!keepSingles.has(f)) await fs.rm(path.join(OUT, f));

const m = await readManifest();
m.audio = result;
await writeManifest(m);
log(`audio: ${result.fanmail.length} fanmail, ${result.soundboard.length} soundboard, ${Object.keys(result.singles).length} singles (${made} converted)`);
