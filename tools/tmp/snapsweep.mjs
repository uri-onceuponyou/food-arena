#!/usr/bin/env node
/**
 * Sweep LEAKED snapshot servers, without killing one that a peer is measuring against.
 *
 * ## The problem this exists for
 *
 * `tools/snapshot.mjs` is documented as dying with its parent, and `with_snapshot.mjs`
 * owns both sides of a run and cleans up after itself. Neither is reliable in practice:
 * after ten hours of a six-agent fan-out this box had **28 `fa-snap-*` Vite servers
 * alive against 4 live `with_snapshot` parents**, the oldest running for **10h43m**.
 * Every one of them was parented to an `npm exec vite` shim rather than to any
 * orchestrator — i.e. the owner had gone and the shim kept the child alive.
 *
 * Measured cost at that point: **load average 38.4** across 789 processes, on a box
 * running six agents that each need Chromium and a Vite dev server. That is not a tidy
 * -up issue; it is a direct tax on every measurement in flight, and it compounds — the
 * longer an unattended session runs, the more it slows down.
 *
 * After sweeping 21 of them: load **33.4**, 705 processes, and all four live snapshots
 * untouched.
 *
 * ## Why this is not just `pkill -f fa-snap`
 *
 * Killing a snapshot that a peer is mid-measurement against destroys that agent's run —
 * the same blast-radius argument that makes `git stash` banned in this project
 * (`CLAUDE.md`, non-negotiable 7). A snapshot server looks *identical* whether it is
 * backing a live probe or orphaned; the difference is only visible in the process tree
 * and in age.
 *
 * ## The rule, and why it is safe
 *
 * A `with_snapshot.mjs` process cannot outlive the measurement it owns. So:
 *
 *   **any snapshot server older than the OLDEST live `with_snapshot` parent
 *   cannot be backing a live run.**
 *
 * That is a derived bound, not a guess, and it self-adjusts: if a long measurement is
 * running, the threshold moves out to protect it. `--min-age` only ever makes the sweep
 * MORE conservative — it is clamped, never used to override the derived bound.
 *
 * Servers with no live `with_snapshot` at all fall back to `--min-age` (default 60 min),
 * because an agent may have started a snapshot by another route (`snapshot.mjs` direct,
 * `headserve.mjs`).
 *
 * ## Use
 *
 *   node tools/tmp/snapsweep.mjs               # DRY RUN — prints what it would kill
 *   node tools/tmp/snapsweep.mjs --kill        # actually sweep
 *   node tools/tmp/snapsweep.mjs --kill --min-age 120
 *   node tools/tmp/snapsweep.mjs --selftest    # validate the age parser
 *
 * Dry run is the default deliberately: this tool's failure mode is destroying a peer's
 * work, so it does nothing unless told to.
 */

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const DO_KILL = args.includes('--kill');
const SELFTEST = args.includes('--selftest');
const minAgeMin = args.includes('--min-age') ? Number(args[args.indexOf('--min-age') + 1]) : 60;

/**
 * `ps` etime -> seconds. Formats: `SS`, `MM:SS`, `HH:MM:SS`, `D-HH:MM:SS`.
 *
 * Parsed rather than pattern-matched on colon count, which is what the manual sweep did.
 * That shortcut happens to be right (2+ colons means >= 1 hour) but it cannot express a
 * threshold, and `docs/LESSONS.md` §9 is explicit that these should be parsed.
 */
export function etimeToSeconds(s) {
  const [d, rest] = s.includes('-') ? s.split('-') : [null, s];
  const parts = rest.split(':').map(Number);
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  if (d !== null) sec += Number(d) * 86400;
  return sec;
}

if (SELFTEST) {
  let pass = 0, fail = 0;
  const check = (input, want) => {
    const got = etimeToSeconds(input);
    if (got === want) { pass++; console.log(`PASS  ${input} -> ${got}s`); }
    else { fail++; console.error(`FAIL  ${input} -> ${got}s, want ${want}s`); }
  };
  check('17', 17);
  check('53:17', 3197);
  check('02:26:20', 8780);
  check('10:43:17', 38597);
  check('1-02:00:00', 93600);
  console.log(`\n${pass}/${pass + fail} age-parser checks passed`);
  process.exit(fail ? 1 : 0);
}

const psOut = execFileSync('ps', ['-eo', 'pid,ppid,etime,command']).toString().split('\n');

const snaps = [];
const owners = [];
for (const line of psOut) {
  const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
  if (!m) continue;
  const [, pid, ppid, etime, cmd] = m;
  if (cmd.includes('snapsweep')) continue;
  if (cmd.includes('with_snapshot')) owners.push({ pid: +pid, age: etimeToSeconds(etime) });
  else if (cmd.includes('fa-snap')) snaps.push({ pid: +pid, ppid: +ppid, age: etimeToSeconds(etime), etime });
}

// The derived bound: nothing younger than the oldest live owner can be swept.
const oldestOwner = owners.length ? Math.max(...owners.map((o) => o.age)) : null;
const thresholdSec = oldestOwner !== null
  ? Math.max(oldestOwner, minAgeMin * 60)
  : minAgeMin * 60;

const doomed = snaps.filter((s) => s.age > thresholdSec);
const spared = snaps.filter((s) => s.age <= thresholdSec);

console.log(`\nsnapshot servers: ${snaps.length}   ·   live with_snapshot owners: ${owners.length}`);
if (oldestOwner !== null) {
  console.log(`oldest live owner: ${(oldestOwner / 60).toFixed(1)} min  ->  nothing younger than that is swept`);
} else {
  console.log(`no live owner found  ->  falling back to --min-age ${minAgeMin} min`);
}
console.log(`threshold: ${(thresholdSec / 60).toFixed(1)} min\n`);

for (const s of spared) console.log(`  KEEP  pid ${s.pid}  ${s.etime}`);
for (const s of doomed) console.log(`  ${DO_KILL ? 'KILL' : 'would kill'}  pid ${s.pid}  ${s.etime}`);

if (!doomed.length) {
  console.log('\nnothing to sweep.\n');
  process.exit(0);
}

if (!DO_KILL) {
  console.log(`\nDRY RUN — ${doomed.length} would be swept. Re-run with --kill.\n`);
  process.exit(0);
}

let n = 0;
for (const s of doomed) {
  try { process.kill(s.pid, 'SIGTERM'); n++; } catch { /* already gone */ }
  // The npm shim keeps the child alive if left behind — that is HOW these leak.
  try { process.kill(s.ppid, 'SIGTERM'); } catch { /* already gone */ }
}
console.log(`\nswept ${n} leaked snapshot server(s); ${spared.length} live one(s) untouched.\n`);
