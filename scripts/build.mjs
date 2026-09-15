// Runs all three pipelines; each one updates its own section of media/manifest.json
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './lib.mjs';
for (const s of ['build-photos.mjs', 'build-audio.mjs', 'build-video.mjs']) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', s)], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
