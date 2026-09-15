// content/video/*.{mp4,mov,...} -> media/video/<key>.mp4 (h264, fits inside 960x960, faststart)
//                                  media/video/posters/<key>.jpg
import path from 'node:path';
import fs from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { CONTENT, MEDIA, readManifest, writeManifest, ensureDir, isStale, listFiles, baseKey, run, log } from './lib.mjs';

const SRC = path.join(CONTENT, 'video');
const OUT = path.join(MEDIA, 'video');
const POSTERS = path.join(OUT, 'posters');
const EXT = new Set(['.mp4', '.mov', '.m4v', '.3gp', '.webm', '.mkv', '.avi', '.mpg', '.mpeg']);
await ensureDir(POSTERS);

function probe(f) {
  const j = JSON.parse(run(ffprobe.path, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', f]));
  return { w: j.streams?.[0]?.width, h: j.streams?.[0]?.height, duration: parseFloat(j.format?.duration) || 0 };
}

const videos = [], keep = new Set();
let made = 0;
for (const name of await listFiles(SRC, EXT)) {
  const src = path.join(SRC, name), key = baseKey(name);
  const out = path.join(OUT, key + '.mp4'), poster = path.join(POSTERS, key + '.jpg');
  try {
    if (await isStale(src, out)) {
      log(`  encoding ${name} ...`);
      run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src,
        '-vf', 'scale=960:960:force_original_aspect_ratio=decrease:force_divisible_by=2',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-pix_fmt', 'yuv420p', '-profile:v', 'main',
        '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', out]);
      made++;
    }
    if (await isStale(out, poster)) run(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', '0.5', '-i', out, '-frames:v', '1', '-q:v', '4', poster]);
  } catch (e) { console.error(`  ! ${name}: ${e.message}`); continue; }
  keep.add(key);
  videos.push({ key, file: `${key}.mp4`, poster: `posters/${key}.jpg`, ...probe(out) });
}
for (const f of await listFiles(OUT, new Set(['.mp4']))) if (!keep.has(baseKey(f))) await fs.rm(path.join(OUT, f));
for (const f of await listFiles(POSTERS, new Set(['.jpg']))) if (!keep.has(baseKey(f))) await fs.rm(path.join(POSTERS, f));

const m = await readManifest();
m.videos = videos;
await writeManifest(m);
log(`video: ${videos.length} videos (${made} encoded)`);
