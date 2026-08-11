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
 * ## 🚨 THERE IS A SECOND PARENT SHAPE, AND THIS TOOL KILLED ONE MID-RUN
 *
 * `tools/tmp/snap_hold.mjs` holds ONE frozen snapshot open ACROSS several tool calls —
 * that is its entire reason to exist, because a before/after A/B is separated by an
 * EDIT and `with_snapshot` tears its snapshot down when its command list finishes. A
 * `snap_hold --swap` hold is therefore **not** a `with_snapshot` parent, matched no
 * pattern here, and its live server read as a leak: an A/B that ran past the 60-minute
 * `--min-age` fallback had its snapshot swept out from under it.
 *
 * ⚠️ **THE FIX IS NOT TO LOOSEN THE BOUND, AND IT IS NOT TO ADD `snap_hold` TO THE
 * AGE-BOUND OWNERS EITHER.** Those are two different mistakes:
 *
 *  - Loosening the bound (a bigger `--min-age`, a name-based spare) is how this stops
 *    being a derived-bound tool and starts being `pkill -f` with extra steps.
 *  - Adding `snap_hold` to the set that computes `oldestOwner` looks right and is
 *    quietly worse: `oldestOwner` is a `Math.max`, `with_snapshot` is in that set
 *    *because it provably cannot outlive its measurement*, and **`snap_hold` blocks
 *    forever by design.** One forgotten `snap_hold` would push the threshold past every
 *    leaked server on the box and neuter the sweep for all six agents, silently.
 *
 * So the two owner shapes get the two different protections they actually warrant:
 *
 *   BOUND owners  (`with_snapshot`)            cannot outlive their run  -> set the AGE
 *                                                                          THRESHOLD,
 *                                                                          exactly as before.
 *   HOLD owners   (`snap_hold`, `snapshot.mjs`) hold ONE named server and CAN outlive
 *                                              -> spare THEIR OWN DESCENDANTS, by
 *                                                 walking the ppid chain. They do not
 *                                                 move the global threshold at all.
 *
 * Ancestry is the exact question ("is this server's owner still alive?") where age is a
 * bound, and it is spare-only, so it cannot widen what gets killed. It also cannot
 * protect a real leak: the leak shape is precisely a server whose chain reaches the
 * `npm exec vite` shim and then **init** with no owner in between — that is what all 28
 * of them looked like. ⚠️ Which is also why the walk stops at OWNER-SHAPED ancestors and
 * not at "any live ancestor": every agent command in this project runs under a
 * long-lived `zsh -c`, so "has a live ancestor" would spare the leaks too.
 *
 * ## Deliberately out of scope: `fa-head-*` and `fa-wt-*`
 *
 * `headserve.mjs` serves a `git archive` checkout out of `fa-head-<rand>` (or `fa-wt-`),
 * so `cmd.includes('fa-snap')` never matches it and this tool has never swept one. That
 * is left as it is ON PURPOSE: widening the kill pattern is the dangerous direction, and
 * nobody has measured a headserve leak. If one is ever found, it needs its own evidence.
 *
 * ## Use
 *
 *   node tools/tmp/snapsweep.mjs               # DRY RUN — prints what it would kill
 *   node tools/tmp/snapsweep.mjs --kill        # actually sweep
 *   node tools/tmp/snapsweep.mjs --kill --min-age 120
 *   node tools/tmp/snapsweep.mjs --selftest    # age parser + the SELECTION rule
 *
 * Dry run is the default deliberately: this tool's failure mode is destroying a peer's
 * work, so it does nothing unless told to.
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** True only when this file is the process entry point.
 *
 *  🚨 REQUIRED, and it is required BECAUSE this file now exports `classify`. Without it,
 *  `import { classify } from './snapsweep.mjs'` runs the whole tool in the importer:
 *  `process.argv` belongs to the IMPORTING process, so a peer tool invoked as
 *  `node whatever.mjs --kill` would have set `DO_KILL` and swept the box on import.
 *  `ic_spec.mjs` carries the same guard for the same reason after `ic_plate --selftest`
 *  silently ran ic_spec's — *a module that reads the process's arguments cannot also be
 *  a library.* Caught here by an import that printed a live sweep report. */
const IS_MAIN = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const args = process.argv.slice(2);
const DO_KILL = IS_MAIN && args.includes('--kill');
const SELFTEST = IS_MAIN && args.includes('--selftest');
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

/** Owners that provably cannot outlive the measurement they own. ONLY these set the age
 *  threshold — see the header: `oldestOwner` is a `Math.max`, so anything that can be
 *  forgotten must not be in here. */
export const BOUND_OWNERS = ['with_snapshot'];

/** Owners that hold ONE named server open and CAN outlive a single command. They spare
 *  their own DESCENDANTS and move no threshold. `snapshot.mjs` is here as well as
 *  `snap_hold.mjs` because `snap_hold` spawns it and because `node tools/snapshot.mjs`
 *  is a documented way to hold a snapshot by hand.
 *  ⚠️ `'snapshot.mjs'` is a substring of `'with_snapshot.mjs'`, which is harmless (both
 *  are owners) and is why the two lists are matched independently rather than in an
 *  if/else.
 *  ⚠️ AND THE PATTERN CARRIES `.mjs` FOR A MEASURED REASON. On a live 698-process table
 *  (2026-08-11, six agents), the loose string `'snapshot'` matched **7 processes and all
 *  7 were Claude Code's `shell-snapshots/snapshot-zsh-*.sh` prelude**, which is on every
 *  agent command line ever run. `'snapshot.mjs'` matched none of them. A pattern that
 *  caught the prelude would make every shell a live owner and stop the sweep dead —
 *  the silent-neutering failure, arrived at from the other direction. */
export const HOLD_OWNERS = ['snap_hold', 'snapshot.mjs'];

/** `ps -eo pid,ppid,etime,command` -> records. Exported so the selftest can drive the
 *  selection with a captured process table instead of whatever is running right now. */
export function parsePs(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    out.push({ pid: +m[1], ppid: +m[2], etime: m[3], age: etimeToSeconds(m[3]), cmd: m[4] });
  }
  return out;
}

/**
 * THE SELECTION RULE, as a pure function of a process table.
 *
 * Pulled out of the top level for one reason: while it was inline, the only thing
 * `--selftest` could validate was the age parser, so the part of this tool that can
 * destroy a peer's run had **no known-bad input at all** (CLAUDE.md #6). Both directions
 * are now testable — a real leak must still be swept, and a live hold must survive.
 *
 * `boundOwners` / `holdOwners` are parameters so the selftest can re-run the HISTORICAL
 * configuration (`holdOwners: []`) and require it to kill the live `snap_hold` server.
 * A guard that has not been shown to fail on the bug it guards against is not a guard.
 */
export function classify(procs, opts = {}) {
  const minAgeMin = opts.minAgeMin ?? 60;
  const boundOwners = opts.boundOwners ?? BOUND_OWNERS;
  const holdOwners = opts.holdOwners ?? HOLD_OWNERS;

  const byPid = new Map();
  const bound = [];
  const holds = [];
  const snaps = [];
  for (const p of procs) {
    if (p.cmd.includes('snapsweep')) continue;
    byPid.set(p.pid, p);
    const isBound = boundOwners.some((k) => p.cmd.includes(k));
    const isHold = holdOwners.some((k) => p.cmd.includes(k));
    if (isBound) bound.push(p);
    if (isHold) holds.push(p);
    // An owner is never a sweep candidate. Written as three independent tests rather
    // than an if/else chain because the categories genuinely overlap: `with_snapshot.mjs`
    // contains the substring `snapshot.mjs`, so it is both, and that is correct — it
    // sets the bound AND protects its descendants.
    if (!isBound && !isHold && p.cmd.includes('fa-snap')) snaps.push(p);
  }
  const holdPids = new Set(holds.map((h) => h.pid));

  // The derived bound: nothing younger than the oldest live BOUND owner can be swept.
  const oldestOwner = bound.length ? Math.max(...bound.map((o) => o.age)) : null;
  const thresholdSec = oldestOwner !== null
    ? Math.max(oldestOwner, minAgeMin * 60)
    : minAgeMin * 60;

  /** Walk up the ppid chain to a live HOLD owner. Bounded, because a corrupt or
   *  truncated table must not spin. Returns the owning pid, or null. */
  const ownerAbove = (p) => {
    let cur = p;
    for (let hop = 0; hop < 32 && cur; hop++) {
      if (holdPids.has(cur.ppid)) return cur.ppid;
      cur = byPid.get(cur.ppid);
    }
    return null;
  };

  const doomed = [];
  const spared = [];
  for (const s of snaps) {
    const held = ownerAbove(s);
    if (held !== null) { spared.push({ ...s, why: `held by live owner pid ${held}` }); continue; }
    if (s.age <= thresholdSec) { spared.push({ ...s, why: 'younger than the threshold' }); continue; }
    doomed.push(s);
  }
  return { snaps, bound, holds, oldestOwner, thresholdSec, minAgeMin, doomed, spared };
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
  // ⚠️ THIS LINE AND ITS NUMBER ARE PARSED BY `gatecount` (docs/TOOLS.md's gate table).
  // It counts the AGE-PARSER checks and nothing else, which is why the selection arms
  // below print their own line. They still gate: the process exits non-zero if any of
  // them fails, and `gatecount` treats a non-zero exit as GATE-FAIL.
  console.log(`\n${pass}/${pass + fail} age-parser checks passed`);

  // ── THE SELECTION RULE, against process tables taken from the real shapes ──
  let spass = 0, sfail = 0;
  const t = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { spass++; console.log(`PASS  ${name}`); }
    else { sfail++; console.error(`FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
  };
  const ps = (rows) => parsePs(rows.map((r) => `${String(r[0]).padStart(6)} ${String(r[1]).padStart(6)} ${r[2].padStart(11)} ${r[3]}`).join('\n'));
  const pids = (list) => list.map((s) => s.pid).sort((a, b) => a - b);

  // KNOWN-BAD 1 — THE INCIDENT. A `snap_hold --swap` A/B that outran the 60-min
  // fallback. Command lines copied from a real `ps` on this box, including the fact
  // that the vite child's argv carries the temp dir (`.../fa-snap-*/node_modules/.bin/vite`)
  // while its `npm exec` shim parent does not, which is what `fa-snap` matches on.
  const incident = ps([
    [100, 1, '01:45:12', 'node tools/tmp/snap_hold.mjs --swap src/ui/screens/thumbs.ts --out /tmp/fa_snap.json'],
    [101, 100, '01:45:10', 'node tools/snapshot.mjs --json --swap src/ui/screens/thumbs.ts'],
    [102, 101, '01:45:08', 'npm exec vite --port 52894 --strictPort --host 127.0.0.1'],
    [103, 102, '01:45:08', 'node /private/var/folders/jb/T/fa-snap-Ab12Cd/node_modules/.bin/vite --port 52894 --strictPort --host 127.0.0.1'],
  ]);
  // The historical configuration: `with_snapshot` was the only owner shape known.
  t('HISTORICAL config sweeps the live snap_hold server — the bug, reproduced',
    pids(classify(incident, { holdOwners: [] }).doomed), [103]);
  t('shipped config spares it, and says whose it is',
    [pids(classify(incident).doomed), classify(incident).spared.map((s) => s.why)],
    [[], ['held by live owner pid 101']]);

  // KNOWN-BAD 2 — A REAL LEAK MUST STILL BE SWEPT. The 10h43m orphan from this file's
  // header: the owner is gone and the `npm exec` shim (reparented to init) holds the
  // child alive. This is the arm that fails if the fix "protects" too much.
  const leak = [
    [200, 1, '10:43:17', 'npm exec vite --port 51111 --strictPort --host 127.0.0.1'],
    [201, 200, '10:43:17', 'node /private/var/folders/jb/T/fa-snap-Zz9Qr/node_modules/.bin/vite --port 51111 --strictPort'],
  ];
  t('a real leak with no live owner is still swept', pids(classify(ps(leak)).doomed), [201]);

  // KNOWN-BAD 3 — AND A FORGOTTEN `snap_hold` MUST NOT NEUTER THE SWEEP. This is the
  // reason `snap_hold` is NOT in the age-bound set: `oldestOwner` is a `Math.max`, so a
  // 3-hour hold would push the threshold past every leak on the box.
  const leakPlusHold = ps([...leak,
    [300, 1, '03:00:00', 'node tools/tmp/snap_hold.mjs --swap src/render/toon.ts --out /tmp/fa_snap2.json'],
    [301, 300, '02:59:58', 'node tools/snapshot.mjs --json --swap src/render/toon.ts'],
    [302, 301, '02:59:55', 'npm exec vite --port 53333 --strictPort --host 127.0.0.1'],
    [303, 302, '02:59:55', 'node /private/var/folders/jb/T/fa-snap-Hold3h/node_modules/.bin/vite --port 53333'],
  ]);
  const both = classify(leakPlusHold);
  t('a 3h hold protects ONLY its own server; the 10h leak beside it is still swept',
    [pids(both.doomed), pids(both.spared), both.thresholdSec], [[201], [303], 3600]);

  // KNOWN-BAD 4 — THE DERIVED BOUND IS UNCHANGED. A live `with_snapshot` at 90 min
  // still moves the threshold to 90 min, and a hold does not move it at all.
  const bounded = ps([
    [400, 1, '01:30:00', 'node tools/tmp/with_snapshot.mjs -- node tools/arena-scan.mjs --url {URL}'],
    [401, 1, '01:20:00', 'npm exec vite --port 54000 --strictPort --host 127.0.0.1'],
    [402, 401, '01:20:00', 'node /private/var/folders/jb/T/fa-snap-Young/node_modules/.bin/vite --port 54000'],
    [403, 1, '01:40:00', 'npm exec vite --port 54001 --strictPort --host 127.0.0.1'],
    [404, 403, '01:40:00', 'node /private/var/folders/jb/T/fa-snap-Older/node_modules/.bin/vite --port 54001'],
  ]);
  t('the with_snapshot bound still decides: 80 min spared, 100 min swept, threshold = 90 min',
    [pids(classify(bounded).doomed), pids(classify(bounded).spared), classify(bounded).thresholdSec],
    [[404], [402], 5400]);
  const withHold = ps([
    [400, 1, '01:30:00', 'node tools/tmp/with_snapshot.mjs -- node tools/arena-scan.mjs --url {URL}'],
    [500, 1, '05:00:00', 'node tools/tmp/snap_hold.mjs --swap src/arena/floor.ts --out /tmp/fa_snap3.json'],
  ]);
  t('a 5h hold does NOT move the threshold', classify(withHold).thresholdSec, 5400);

  // KNOWN-BAD 5 — `--min-age` ONLY EVER MAKES IT MORE CONSERVATIVE. Documented since
  // the tool was written and never tested: a small `--min-age` must not be able to
  // override a longer derived bound.
  t('--min-age 5 cannot shrink a 90-min derived bound',
    classify(bounded, { minAgeMin: 5 }).thresholdSec, 5400);
  t('--min-age 240 does raise it', classify(bounded, { minAgeMin: 240 }).thresholdSec, 14400);

  // KNOWN-BAD 6 — MONOTONICITY. Teaching the tool a new owner shape must never make it
  // kill MORE. Asserted as a set relation over the union of every table above, so it
  // holds for the whole battery rather than for one hand-picked case.
  {
    const all = ps([
      [100, 1, '01:45:12', 'node tools/tmp/snap_hold.mjs --swap src/ui/screens/thumbs.ts --out /tmp/fa_snap.json'],
      [101, 100, '01:45:10', 'node tools/snapshot.mjs --json --swap src/ui/screens/thumbs.ts'],
      [102, 101, '01:45:08', 'npm exec vite --port 52894 --strictPort --host 127.0.0.1'],
      [103, 102, '01:45:08', 'node /private/var/folders/jb/T/fa-snap-Ab12Cd/node_modules/.bin/vite --port 52894'],
      ...leak,
      [400, 1, '01:30:00', 'node tools/tmp/with_snapshot.mjs -- node tools/arena-scan.mjs --url {URL}'],
      [403, 1, '01:40:00', 'npm exec vite --port 54001 --strictPort --host 127.0.0.1'],
      [404, 403, '01:40:00', 'node /private/var/folders/jb/T/fa-snap-Older/node_modules/.bin/vite --port 54001'],
    ]);
    const before = new Set(pids(classify(all, { holdOwners: [] }).doomed));
    const after = pids(classify(all).doomed);
    t('the new owner shape only ever spares — doomed(new) is a subset of doomed(old)',
      [after.every((p) => before.has(p)), [...before].sort((a, b) => a - b), after],
      [true, [103, 201, 404], [201, 404]]);
  }

  // KNOWN-BAD 7 — the walk must not be fooled by a cycle in a corrupt table.
  t('a ppid cycle terminates instead of spinning',
    pids(classify(ps([
      [600, 601, '09:00:00', 'node /private/var/folders/jb/T/fa-snap-Cycle/node_modules/.bin/vite --port 55000'],
      [601, 600, '09:00:00', 'npm exec vite --port 55000 --strictPort'],
    ])).doomed), [600]);

  console.log(`\n${spass}/${spass + sfail} selection checks passed`);
  process.exit(fail || sfail ? 1 : 0);
}

// ── The live sweep. Guarded, so importing this file measures and kills NOTHING. ──
if (!IS_MAIN) { /* library use: exports only */ } else {

const procs = parsePs(execFileSync('ps', ['-eo', 'pid,ppid,etime,command']).toString());
const { snaps, bound, holds, oldestOwner, thresholdSec, doomed, spared } = classify(procs, { minAgeMin });

console.log(`\nsnapshot servers: ${snaps.length}   ·   live with_snapshot owners: ${bound.length}`
  + `   ·   live holds (snap_hold / snapshot.mjs): ${holds.length}`);
if (oldestOwner !== null) {
  console.log(`oldest live owner: ${(oldestOwner / 60).toFixed(1)} min  ->  nothing younger than that is swept`);
} else {
  console.log(`no live with_snapshot found  ->  falling back to --min-age ${minAgeMin} min`);
}
console.log(`threshold: ${(thresholdSec / 60).toFixed(1)} min`);
console.log(`holds spare their own descendants regardless of age, and move no threshold\n`);

for (const s of spared) console.log(`  KEEP  pid ${s.pid}  ${s.etime}  (${s.why})`);
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

}
