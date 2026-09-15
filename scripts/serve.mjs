// Tiny static server for local preview:  npm run dev  ->  http://localhost:5173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const PORT = +(process.env.PORT || 5173);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
  '.txt': 'text/plain', '.rules': 'text/plain', '.md': 'text/markdown',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range) { // range requests are needed for <video>/<audio> seeking
      const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
