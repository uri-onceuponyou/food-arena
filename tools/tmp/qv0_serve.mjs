/**
 * qv0_serve — a bare static server for a built `dist/`, so a measurement runs against a
 * committed, built artefact rather than the shared dev server or a working-tree snapshot.
 * Prints its PORT and its PID on the first line so the caller can kill BY PID
 * (`pkill -f` matched two peers' servers once and killed them mid-measurement).
 *
 * Usage: node tools/tmp/qv0_serve.mjs <distdir> [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon',
};

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3] ?? 0);
if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`no index.html under ${root}`);
  process.exit(2);
}
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = path.join(root, decodeURIComponent(u.pathname));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
srv.listen(port, '127.0.0.1', () => {
  console.log(`QV0_SERVE pid=${process.pid} url=http://127.0.0.1:${srv.address().port} root=${root}`);
});
