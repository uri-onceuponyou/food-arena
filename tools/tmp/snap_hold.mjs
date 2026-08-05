#!/usr/bin/env node
/**
 * Hold ONE frozen snapshot open across several tool invocations, with named files
 * symlinked back to the live tree (`--swap`).
 *
 * Why this and not `tools/tmp/with_snapshot.mjs`: that tool owns both sides and tears
 * the snapshot down when its command list finishes, which is exactly right when the
 * whole experiment is one command. It is exactly WRONG for a before/after A/B, because
 * "before" and "after" are separated by an EDIT — so they land on two different
 * snapshots, and with five peer agents live in `src/characters/**`, `src/render/**` and
 * `src/arena/**`, the tree underneath the two measurements is not the same tree.
 * `docs/LESSONS.md` §5 is about exactly that: single-owner file sets stop write
 * conflicts and do nothing about measurement.
 *
 * So: freeze once, symlink MY file live, and measure both sides against the same
 * stationary background. The only thing that moves between the two runs is the edit.
 *
 *   node tools/tmp/snap_hold.mjs --swap src/ui/screens/thumbs.ts --out /tmp/fa_snap.json
 *
 * Writes `{url, port, dir}` to `--out` once Vite is up, then blocks. Run it with the
 * Bash tool's `run_in_background` so the process survives between calls; the snapshot
 * dies with it, which is the documented behaviour and is what makes the teardown safe.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import readline from 'node:readline';

const argv = process.argv.slice(2);
const swaps = [];
let out = '/tmp/fa_snap.json';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--swap') swaps.push(argv[++i]);
  else if (argv[i] === '--out') out = argv[++i];
}

const args = ['tools/snapshot.mjs', '--json'];
for (const s of swaps) args.push('--swap', s);

const snap = spawn('node', args, { stdio: ['ignore', 'pipe', 'inherit'] });
const rl = readline.createInterface({ input: snap.stdout });
rl.on('line', (line) => {
  try {
    const o = JSON.parse(line);
    if (o && o.url) {
      writeFileSync(out, JSON.stringify(o));
      console.log(`[snap_hold] ready ${o.url}  (swaps: ${swaps.join(', ') || 'none'})`);
    }
  } catch { /* not the JSON line */ }
});
snap.on('exit', (c) => { console.log(`[snap_hold] snapshot exited ${c}`); process.exit(c ?? 1); });
process.on('SIGTERM', () => { snap.kill('SIGTERM'); });
