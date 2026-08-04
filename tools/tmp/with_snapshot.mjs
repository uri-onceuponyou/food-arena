#!/usr/bin/env node
/**
 * Run a command against a frozen snapshot, in ONE process.
 *
 * `tools/snapshot.mjs --json` prints its JSON and then keeps running (the spawned Vite
 * child holds the event loop open), so `URL=$(node tools/snapshot.mjs --json)` never
 * returns — command substitution waits for the whole pipeline. Backgrounding it instead
 * hits the documented trap that the server dies with the shell that started it.
 *
 * This owns both sides: it spawns the snapshot, reads the JSON line off its stdout, runs
 * the requested command with {URL} / {DIR} substituted, then tears the snapshot down.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/radar_probe.mjs --url {URL} --dir {DIR}
 *   node tools/tmp/with_snapshot.mjs --keep-going -- cmd1 args ::: cmd2 args
 *
 * `:::` separates several commands to run against the SAME snapshot.
 */
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0) {
  console.error('usage: with_snapshot.mjs [--keep-going] -- <cmd> [args...] [::: <cmd> ...]');
  process.exit(2);
}
const keepGoing = argv.slice(0, sep).includes('--keep-going');
const rest = argv.slice(sep + 1);
const commands = [];
let cur = [];
for (const a of rest) {
  if (a === ':::') { commands.push(cur); cur = []; } else cur.push(a);
}
if (cur.length) commands.push(cur);

const snap = spawn('node', ['tools/snapshot.mjs', '--json'], { stdio: ['ignore', 'pipe', 'inherit'] });
const rl = readline.createInterface({ input: snap.stdout });

const info = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('snapshot did not print JSON within 180s')), 180_000);
  rl.on('line', (line) => {
    try {
      const o = JSON.parse(line);
      if (o && o.url) { clearTimeout(t); res(o); }
    } catch { /* not the JSON line */ }
  });
  snap.on('exit', (c) => { clearTimeout(t); rej(new Error(`snapshot exited early (${c})`)); });
});

console.log(`[with_snapshot] url=${info.url} dir=${info.dir}`);

let failed = 0;
for (const cmd of commands) {
  const args = cmd.map((a) => a.replaceAll('{URL}', info.url).replaceAll('{DIR}', info.dir));
  console.log(`\n[with_snapshot] $ ${args.join(' ')}`);
  const code = await new Promise((res) => {
    const p = spawn(args[0], args.slice(1), { stdio: 'inherit', env: { ...process.env, PREVIEW_BASE: info.url, SNAPSHOT_DIR: info.dir } });
    p.on('exit', (c) => res(c ?? 1));
  });
  if (code !== 0) {
    failed++;
    console.log(`[with_snapshot] exit ${code}`);
    if (!keepGoing) break;
  }
}

snap.kill('SIGTERM');
await new Promise((r) => setTimeout(r, 800));
try { snap.kill('SIGKILL'); } catch { /* gone */ }
process.exit(failed ? 1 : 0);
