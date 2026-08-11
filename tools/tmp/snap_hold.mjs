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
 *
 * ⚠️ **DO NOT RUN A BROWSER *GATE* AGAINST A `--swap` HOLD. MEASURE WITH IT; GATE
 * WITHOUT IT.** The live symlink lets Vite issue a FULL PAGE RELOAD in the middle of a
 * `page.evaluate`. Measured 2026-08-11 by two agents on the same night: `menu_accept`
 * read **349/353 once against a `--swap` hold and 361/361 on a plain frozen snapshot of
 * the same tree.** The build was fine; the reload destroyed the execution context
 * mid-assertion. Same family as `--swap` not working on an HTML file with an inline
 * module script. See the fuller note at `tools/snapshot.mjs`'s `--swap`.
 *
 * ⚠️ **AND KILL THIS BY PID WHEN YOU ARE DONE.** A hold blocks forever by design, so a
 * forgotten one keeps a Vite server and a temp tree alive indefinitely.
 * `tools/tmp/snapsweep.mjs` deliberately does NOT count a hold toward its age threshold
 * (a `Math.max` over owners: one forgotten hold would neuter the sweep for every agent
 * on the box) — it spares a hold's own descendants by walking the process tree instead.
 * So a leaked hold is invisible to the sweeper by design, and yours to clean up.
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
