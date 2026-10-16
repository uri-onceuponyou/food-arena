#!/usr/bin/env node
/**
 * t1a_boot_stall — a KNOWN-BAD INJECTOR for "the page never boots": a proxy in front of a
 * snapshot that forwards everything EXCEPT one exact request URL, which it holds open and
 * never answers. The browser's `goto` on that URL then times out exactly as it does when a
 * boot loses the race against SwiftShader contention — on demand, instead of by luck.
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- \
 *     node tools/tmp/t1a_boot_stall.mjs --upstream '{URL}' --stall '/?hold=600000' -- \
 *     node tools/tmp/menu_accept.mjs --flow-only --boot-ms 8000
 *
 * The wrapped command gets `PREVIEW_BASE` pointed at the proxy. `--stall` matches the request
 * URL EXACTLY (path + query), default `/`. In `menu_accept` the round-trip flow loads
 * `/?hold=600000` (since T1a's race fix; it was a bare `/` before), a URL no other page in
 * that battery uses, so `--stall '/?hold=600000'` hits the flow's boot and nothing else.
 * Prints how many requests it held, and REFUSES (exit 3) if it held none — a stall that
 * never fired would make the wrapped run a plain control wearing a known-bad's name.
 *
 * ⚠️ The snapshot is a Vite DEV server, so the HMR websocket is piped through raw. Without it
 * the Vite client logs a connection error into every page and each `no-console-errors` row
 * would go red for a reason that has nothing to do with the stall.
 */
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0) { console.error('usage: t1a_boot_stall.mjs --upstream <url> [--stall <url-path>] -- <cmd> [args...]'); process.exit(2); }
const head = argv.slice(0, sep);
const cmd = argv.slice(sep + 1);
const opt = (k, d) => { const i = head.indexOf(`--${k}`); return i >= 0 ? head[i + 1] : d; };
const UP = new URL(opt('upstream', process.env.PREVIEW_BASE ?? ''));
const STALL = opt('stall', '/');

let held = 0;
const heldSockets = new Set();
const server = http.createServer((req, res) => {
  if (req.url === STALL) {
    held++;
    heldSockets.add(req.socket);
    req.socket.on('close', () => heldSockets.delete(req.socket));
    return; // never answered
  }
  const up = http.request({
    host: UP.hostname, port: UP.port, method: req.method, path: req.url, headers: req.headers,
  }, (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
  up.on('error', () => { try { res.writeHead(502); res.end(); } catch { /* socket gone */ } });
  req.pipe(up);
});
server.on('upgrade', (req, socket, headBuf) => {
  const up = net.connect(Number(UP.port), UP.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (headBuf?.length) up.write(headBuf);
    socket.pipe(up).pipe(socket);
  });
  const end = () => { socket.destroy(); up.destroy(); };
  up.on('error', end); socket.on('error', end);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const proxy = `http://127.0.0.1:${server.address().port}`;
console.error(`t1a_boot_stall: ${proxy} -> ${UP.origin}, holding ${JSON.stringify(STALL)} unanswered`);

const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', env: { ...process.env, PREVIEW_BASE: proxy } });
const code = await new Promise((r) => child.on('exit', (c) => r(c ?? 1)));
for (const s of heldSockets) s.destroy();
server.close();
console.error(`t1a_boot_stall: held ${held} request(s) for ${JSON.stringify(STALL)}; wrapped command exited ${code}`);
if (held === 0) {
  console.error('t1a_boot_stall: REFUSED — the stall never fired, so the wrapped run was not the known-bad it was named as');
  process.exit(3);
}
process.exit(code);
