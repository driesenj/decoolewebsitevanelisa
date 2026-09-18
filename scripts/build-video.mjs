// content/video/*.{mp4,mov,...}        -> media/video/<key>.mp4 (h264, fits inside 960x960, faststart) + posters/<key>.jpg   (vlogs)
// content/video/fanmail/*.{mp4,...}    -> media/video/fanmail/<key>.mp4 + fanmail/posters/<key>.jpg                         (video messages from fans)
import path from 'node:path';
import fs from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { CONTENT, MEDIA, readManifest, writeManifest, ensureDir, isStale, listFiles, baseKey, run, log, exists, ver, fingerprint, saveHashCache, needsBuild, renamedFrom } from './lib.mjs';

const EXT = new Set(['.mp4', '.mov', '.m4v', '.3gp', '.webm', '.mkv', '.avi', '.mpg', '.mpeg']);

function probe(f) {
  const j = JSON.parse(run(ffprobe.path, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', f]));
  return { w: j.streams?.[0]?.width, h: j.streams?.[0]?.height, duration: parseFloat(j.format?.duration) || 0 };
}

// Encodes when the content changed (fingerprint, see lib.mjs). A renamed source (same bytes, new name) gets its old
// output and poster renamed instead of a fresh encode.
async function buildDir(sub, prev) {
  const SRC = path.join(CONTENT, 'video', sub), OUT = path.join(MEDIA, 'video', sub), POSTERS = path.join(OUT, 'posters');
  await ensureDir(POSTERS);
  const videos = [], keep = new Set();
  let made = 0, renamed = 0;
  const names = await listFiles(SRC, EXT);
  const currentKeys = new Set(names.map(baseKey));
  for (const name of names) {
    const src = path.join(SRC, name), key = baseKey(name);
    const out = path.join(OUT, key + '.mp4'), poster = path.join(POSTERS, key + '.jpg');
    let hash;
    try {
      hash = await fingerprint(src);
      const old = !await exists(out) && renamedFrom(prev, hash, currentKeys);
      if (old && await exists(path.join(OUT, path.basename(old.file)))) {
        await fs.rename(path.join(OUT, path.basename(old.file)), out);
        if (await exists(path.join(POSTERS, path.basename(old.poster)))) await fs.rename(path.join(POSTERS, path.basename(old.poster)), poster);
        log(`  renamed ${old.key} -> ${key}`);
        renamed++;
      }
      if (await needsBuild(src, out, prev.find(e => e.key === key)?.src, hash)) {
        log(`  encoding ${sub ? sub + '/' : ''}${name} ...`);
        run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src,
          '-vf', 'scale=960:960:force_original_aspect_ratio=decrease:force_divisible_by=2',
          '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-pix_fmt', 'yuv420p', '-profile:v', 'main',
          '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', out]);
        made++;
      }
      if (await isStale(out, poster)) run(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', '0.5', '-i', out, '-frames:v', '1', '-q:v', '4', poster]);
    } catch (e) { console.error(`  ! ${name}: ${e.message}`); continue; }
    keep.add(key);
    const rel = sub ? sub + '/' : '';
    videos.push({ key, name: path.parse(name).name, file: `${rel}${key}.mp4`, poster: `${rel}posters/${key}.jpg`, ...probe(out), v: ver(hash), src: hash });
  }
  for (const f of await listFiles(OUT, new Set(['.mp4']))) if (!keep.has(baseKey(f))) await fs.rm(path.join(OUT, f));
  for (const f of await listFiles(POSTERS, new Set(['.jpg']))) if (!keep.has(baseKey(f))) await fs.rm(path.join(POSTERS, f));
  return { videos, made, renamed };
}

const previous = await readManifest();
const vlogs = await buildDir('', previous.videos || []);
const fan = await buildDir('fanmail', previous.videoFanmail || []);
const m = await readManifest();
m.videos = vlogs.videos;
m.videoFanmail = fan.videos;
await writeManifest(m);
await saveHashCache();
const renamed = vlogs.renamed + fan.renamed;
log(`video: ${vlogs.videos.length} vlogs, ${fan.videos.length} video messages (${vlogs.made + fan.made} encoded${renamed ? `, ${renamed} renamed` : ''})`);
