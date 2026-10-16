#!/usr/bin/env node
/**
 * t1a_stage_race — the KNOWN-BAD for a gate that stages a sim into a shared, fixed path.
 *
 * `driver_guard.mjs` staged into `/tmp/driver_guard/cd{5,3}` — one name for every copy of
 * the gate on the machine, i.e. every agent in every worktree. Its e2e imports `cd5`, runs a
 * whole 110-matchup ladder, and only THEN imports `cd3`. A second run from another tree that
 * restages in that window hands the first run a different sim for its second arm, and the
 * gate reports the difference between two TREES as a countdown "balance result". B4 hit it
 * as "3 Donut matchups moved" on a run 4 s behind a peer's (2026-10-16).
 *
 *   node tools/tmp/t1a_stage_race.mjs                 # all three arms (~4 min under load)
 *   node tools/tmp/t1a_stage_race.mjs --arm before    # one arm
 *
 * Arms — each one states the outcome it must produce, and the tool exits 1 if it does not:
 *   before      the gate AS IT SHIPPED (`git show <--ref>:tools/tmp/driver_guard.mjs`), its
 *               fixed path rewritten to a PRIVATE fixed path so this harness never writes into
 *               a peer's `/tmp/driver_guard`. Mid-run, a "peer" restages cd3 from a planted
 *               tree (REGEN_DELAY_MS 4000 -> 1000). MUST read red: N > 0 matchups "moved".
 *   knownbad    the gate as it is NOW (per-run mkdtemp). The harness reads the staged dir off
 *               the gate's own stdout and restages cd3 the same way. MUST read red on the
 *               provenance row — this is what shows the new assertion can fail.
 *   concurrent  two copies of the gate as it is now, the second 4 s behind (B4's shape).
 *               MUST read 0 failed on both, from two DIFFERENT staging dirs.
 *
 * ⚠️ `before` runs the old gate from a temp dir OUTSIDE the repo (its two relative anchors
 * re-pointed at this tree): a copy under `tools/` would trip the gate's own driver census.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt('arm', 'all');
const REF = opt('ref', '3bf9bdf'); // the last commit with the fixed path
const PLANT = ['COUNTDOWN_FROM=3', 'REGEN_DELAY_MS=1000']; // a peer tree that differs from ours
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function run(file, { onLine } = {}) {
  const child = spawn(process.execPath, [file], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  let buf = '';
  child.stdout.on('data', (d) => {
    out += d; buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); onLine?.(line); }
  });
  child.stderr.on('data', (d) => { out += d; });
  const done = new Promise((r) => child.on('exit', (code) => r({ code, out })));
  return { child, done };
}
const peerRestage = (dir) =>
  execFileSync(process.execPath, [`${ROOT}/tools/tmp/stage_rules.mjs`, dir, ...PLANT], { stdio: 'ignore' });
const parse = (out) => ({
  moved: Number(/fixed driver: (\d+)\/110/.exec(out)?.[1] ?? NaN),
  passed: Number(/driver_guard: (\d+) passed/.exec(out)?.[1] ?? NaN),
  failed: Number(/driver_guard: \d+ passed, (\d+) failed/.exec(out)?.[1] ?? NaN),
  stage: /staged into (\S+)/.exec(out)?.[1] ?? null,
  provenanceRed: /FAIL e2e: the staged sims were not changed/.test(out),
});

const results = [];
const verdict = (arm, good, detail) => { results.push({ arm, good, detail }); console.log(`  ${good ? 'ok  ' : 'FAIL'} ${arm}: ${detail}`); };

async function armBefore() {
  const src = execFileSync('git', ['show', `${REF}:tools/tmp/driver_guard.mjs`], { cwd: ROOT, encoding: 'utf8' });
  const PRIV = mkdtempSync(join(tmpdir(), 't1a-race-before-'));
  // The copy lives OUTSIDE the repo: the gate's census flags any unregistered `.mjs` under
  // `tools/` carrying the nav FINGERPRINT, and the gate carries that string itself, so a copy in
  // `tools/tmp/` would fail the census (here AND in the concurrent arm) for the wrong reason.
  // Its only two relative anchors are re-pointed at this tree, and each must match exactly once.
  const anchors = [
    [`from './scripted_player.mjs'`, `from ${JSON.stringify(`${ROOT}/tools/tmp/scripted_player.mjs`)}`],
    [`resolve(new URL('../..', import.meta.url).pathname)`, JSON.stringify(ROOT)],
    ['/tmp/driver_guard/', `${PRIV}/`],
  ];
  let text = src;
  for (const [from, to] of anchors) {
    const n = text.split(from).length - 1;
    if (n !== 1) { verdict('before', false, `anchor ${JSON.stringify(from)} matched ${n} times in ${REF}'s gate — refusing to guess`); rmSync(PRIV, { recursive: true, force: true }); return; }
    text = text.replace(from, to);
  }
  const copy = join(PRIV, 'driver_guard_at_ref.mjs');
  writeFileSync(copy, text);
  try {
    const { done } = run(copy);
    // The old gate prints nothing between staging and its first ladder, so wait for cd3 to
    // exist, then give its stage_rules child time to finish; the cd5 ladder that follows
    // takes far longer than this, so the restage lands BETWEEN the two imports.
    const t0 = Date.now();
    while (!existsSync(join(PRIV, 'cd3', 'game', 'rules.ts'))) {
      if (Date.now() - t0 > 120_000) break;
      await wait(100);
    }
    await wait(1500);
    peerRestage(join(PRIV, 'cd3'));
    const { code, out } = await done;
    const p = parse(out);
    verdict('before', code === 1 && p.moved > 0,
      `${REF}'s gate exit ${code}, ${p.moved}/110 matchups "moved by the countdown" — every one moved by the PEER's tree (${p.passed} passed, ${p.failed} failed)`);
  } finally {
    rmSync(PRIV, { recursive: true, force: true });
  }
}

async function armKnownbad() {
  let restaged = null;
  const { done } = run(join(ROOT, 'tools', 'tmp', 'driver_guard.mjs'), {
    onLine: (line) => {
      const m = /staged into (\S+)/.exec(line);
      if (m && !restaged) { restaged = m[1]; peerRestage(join(m[1], 'cd3')); }
    },
  });
  const { code, out } = await done;
  const p = parse(out);
  if (!restaged) { verdict('knownbad', false, 'the gate never printed its staged dir — nothing was tampered, so nothing was tested'); return; }
  verdict('knownbad', code === 1 && p.provenanceRed,
    `tampered ${restaged}/cd3 mid-run -> exit ${code}, provenance row ${p.provenanceRed ? 'RED' : 'green (BLIND)'}, ${p.moved}/110 moved`);
}

async function armConcurrent() {
  const a = run(join(ROOT, 'tools', 'tmp', 'driver_guard.mjs'));
  await wait(4000);
  const b = run(join(ROOT, 'tools', 'tmp', 'driver_guard.mjs'));
  const [ra, rb] = await Promise.all([a.done, b.done]);
  const pa = parse(ra.out), pb = parse(rb.out);
  verdict('concurrent', ra.code === 0 && rb.code === 0 && pa.failed === 0 && pb.failed === 0 && pa.stage && pb.stage && pa.stage !== pb.stage,
    `A ${pa.passed}/${pa.failed} in ${pa.stage}, B ${pb.passed}/${pb.failed} in ${pb.stage} (passed/failed), ${pa.moved} and ${pb.moved} moved`);
}

console.log(`t1a_stage_race — arm ${ARM}, ref ${REF}, plant ${PLANT.join(' ')}`);
if (ARM === 'all') {
  await Promise.all([armBefore(), armKnownbad()]);
  await armConcurrent();
} else if (ARM === 'before') await armBefore();
else if (ARM === 'knownbad') await armKnownbad();
else if (ARM === 'concurrent') await armConcurrent();
else { console.error(`unknown --arm ${ARM}`); process.exit(2); }

if (!results.length) { console.log('no arm ran — refusing to report a pass over an empty set'); process.exit(1); }
const bad = results.filter((r) => !r.good).length;
console.log(`\nt1a_stage_race: ${results.length - bad} of ${results.length} arms produced their required outcome`);
process.exit(bad ? 1 : 0);
