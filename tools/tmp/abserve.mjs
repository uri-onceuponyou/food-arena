#!/usr/bin/env node
/**
 * A/B server: serve `git archive HEAD` (pristine, peer-free), optionally with a few
 * working-tree files overlaid on top.
 *
 * `tools/snapshot.mjs` freezes the WORKING TREE, which is the right tool when the
 * tree is quiet. It is the wrong tool here: three peers are mid-edit in rules.ts /
 * sim.ts / shared.ts / hud.ts, so a snapshot taken now and a snapshot taken twenty
 * minutes ago differ in files this agent does not own — and any before/after built
 * from them measures the peers as much as the change. HEAD + exactly one delta is
 * the only pair where the difference is attributable.
 *
 *   node tools/tmp/abserve.mjs --json                                  # pristine HEAD
 *   node tools/tmp/abserve.mjs --json --overlay src/a.ts,src/b.ts      # HEAD + those files
 */
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import net from 'node:net';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const asJson = !!args.json;
const overlay = args.overlay ? String(args.overlay).split(',').map((s) => s.trim()).filter(Boolean) : [];
const ref = String(args.ref ?? 'HEAD');

const dir = mkdtempSync(join(tmpdir(), 'fa-ab-'));
execSync(`git archive ${ref} | tar -x -C "${dir}"`, { cwd: ROOT, stdio: 'inherit' });
for (const rel of overlay) {
  const from = join(ROOT, rel);
  if (!existsSync(from)) { console.error(`--overlay: no such file: ${rel}`); process.exit(1); }
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  cpSync(from, join(dir, rel));
}
symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

const port = await new Promise((res, rej) => {
  const srv = net.createServer();
  srv.on('error', rej);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => res(port)); });
});

const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  { cwd: dir, stdio: asJson ? 'ignore' : 'inherit' });

const url = `http://localhost:${port}`;
const deadline = Date.now() + 60_000;
let up = false;
while (Date.now() < deadline && !up) {
  up = await new Promise((res) => {
    const s = net.connect(port, '127.0.0.1');
    s.on('connect', () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    setTimeout(() => { s.destroy(); res(false); }, 500);
  });
  if (!up) await new Promise((r) => setTimeout(r, 400));
}
if (!up) { vite.kill('SIGTERM'); console.error(`abserve: vite did not come up on ${port}`); process.exit(1); }
console.log(JSON.stringify({ url, port, dir, ref, overlay }));
