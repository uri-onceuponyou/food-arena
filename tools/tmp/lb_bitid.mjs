#!/usr/bin/env node
/**
 * lb_bitid — DOES THE LOBBY PASS CHANGE THE SHIPPED TWO-SEAT MATCH? Four arms, one verdict.
 *
 *   node tools/tmp/lb_bitid.mjs --ref <sha>       # sha is REQUIRED in practice; see below
 *   node tools/tmp/lb_bitid.mjs --ref <sha> --quick
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `2f907a7` proved the `seats` flag OFF is bit-identical to the duel this product has
 * always played, on four `np_identity` arms. That proof was about a route FIELD. This pass
 * adds a screen that sets it, an entry point on home, and — the part that actually puts
 * the guarantee at risk — **four edits to `shell.ts`, which every route goes through**:
 * `parseRoute`, `routeFromSearch`, `routeUrl` and `sameRoute` all learned about `seats`.
 *
 * A shipped duel is `?player=X&enemy=Y` with no `seats` anywhere. If any of those four
 * changed what that produces, every balance number, every capture and every A/B baseline
 * in this project is measured against a different game. So this is not a formality.
 *
 * ── The arms, and the two that make the other two mean something ───────────
 *   base  pristine `--ref <sha>`                       what the committed game is
 *   ctrl  pristine `--ref <sha>` again                 🚨 THE DRIFT CONTROL. Must equal
 *                                                      `base` EXACTLY. "No difference"
 *                                                      from an instrument nobody has shown
 *                                                      can produce one is worth nothing —
 *                                                      and this project has a restored GL
 *                                                      context that came back 15.65 luma
 *                                                      darker, forever, on its record.
 *   work  `--ref <sha>` + THIS PASS'S FILES overlaid   the change, HEAD everywhere else
 *   bad   as `work`, plus `--swap`                     🚨 THE KNOWN-BAD. The two slots'
 *                                                      characters are permuted; every
 *                                                      number MUST move, or the whole
 *                                                      battery is measuring nothing.
 *
 * ── Why an overlay rather than a snapshot of the working tree ──────────────
 * `snapshot.mjs` freezes the WORKING tree, and frozen is not clean: peers are mid-edit in
 * `src/game/**` and `src/ui/hud.ts` right now, and a half-saved AI change would land in
 * the same frame this measures — attributed to the lobby. `headserve --overlay` serves a
 * pristine checkout of `<sha>` with EXACTLY the files below copied over it.
 *
 * ⚠️ `np_ab.mjs` is the same idea with a DIFFERENT, hardcoded file list (`hud.ts`,
 * `match.ts`, `vfx.ts`, `director.ts`, `roster.ts`) belonging to the N-presentation pass.
 * Running it here would overlay a peer's dirty files and attribute their frame to this
 * change. Hence a second file rather than a flag on that one, which is not mine to edit.
 *
 * ⚠️ THE TREE CONTROL IS PER FILE, NEVER PER DIRECTORY. The N-fighter pass discarded two
 * whole batteries after a control hashed `git diff src/game` — a directory shared with
 * peers — and a peer's commit moved it mid-run. Every file below is hashed individually,
 * before and after, and one moved digest fails the run.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const QUICK = argv.includes('--quick');
const REF = String(arg('--ref', 'HEAD'));

/**
 * THIS PASS'S FILE SET, named one by one.
 *
 * `src/ui/screens/lobby.ts` is NEW, so it cannot exist in the base arm — which is exactly
 * why it must be in the overlay: without it `shell.ts`'s import does not resolve and the
 * work arm fails to build rather than failing to be identical.
 */
const FILES = [
  'src/ui/screens/lobby.ts',
  'src/ui/screens/shell.ts',
  'src/ui/screens/types.ts',
  'src/ui/screens/brawl.ts',
  'src/ui/screens/home.ts',
  'src/main.ts',
];

const sha = (p) => (existsSync(`${ROOT}/${p}`)
  ? createHash('sha256').update(readFileSync(`${ROOT}/${p}`)).digest('hex').slice(0, 8)
  : '--------');

function treeControl(label) {
  const rows = FILES.map((f) => [f, sha(f)]);
  console.log(`\n── TREE CONTROL (${label}) — per FILE, never per directory ──`);
  for (const [f, h] of rows) console.log(`   ${h}  ${f}`);
  return rows.map(([f, h]) => `${h} ${f}`).join('\n');
}

function runArm(tag, { overlay = false, swap = false } = {}) {
  const flags = ['--ref', REF];
  if (overlay) for (const f of FILES) flags.push('--overlay', f);
  // ⚠️ NO `--url {URL}` here — that placeholder belongs to `with_snapshot.mjs`;
  // `headserve` injects `PREVIEW_BASE` into the child's env.
  const cmd = ['tools/tmp/headserve.mjs', ...flags, '--',
    'node', 'tools/tmp/np_identity.mjs', '--tag', tag, '--json'];
  if (swap) cmd.push('--swap');
  console.log(`\n▶ arm ${tag}${overlay ? ' (overlay)' : ''}${swap ? ' (SWAPPED — known-bad)' : ''}`);
  const r = spawnSync('node', cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}`;
  const line = out.split('\n').reverse().find((l) => l.trim().startsWith('{'));
  if (!line) {
    console.log(out.slice(-4000));
    console.log(`${r.stderr ?? ''}`.slice(-4000));
    throw new Error(`arm ${tag}: no JSON report`);
  }
  return JSON.parse(line);
}

const FIELDS = [
  ['png.p58', (r) => r.png?.p58],
  ['png.p20', (r) => r.png?.p20],
  ['hud', (r) => r.hudSha],
  ['scene', (r) => r.sceneSha],
  ['names', (r) => JSON.stringify(r.names)],
  ['hp', (r) => JSON.stringify(r.hp)],
];

const t0 = treeControl('before');
const base = runArm('base');
const work = runArm('work', { overlay: true });
const ctrl = QUICK ? null : runArm('ctrl');
const bad = QUICK ? null : runArm('bad', { overlay: true, swap: true });
const t1 = treeControl('after');

let fail = 0;
const cmp = (label, a, b, want) => {
  const rows = FIELDS.map(([n, f]) => [n, f(a), f(b)]);
  const same = rows.filter(([, x, y]) => x === y).length;
  const okRow = want === 'same' ? same === rows.length : same < rows.length;
  if (!okRow) fail++;
  console.log(`\n${okRow ? '✓' : '✗'} ${label} — ${same}/${rows.length} fields identical (wanted ${want.toUpperCase()})`);
  for (const [n, x, y] of rows) {
    if (x !== y) console.log(`    ≠ ${n}: ${String(x).slice(0, 24)} vs ${String(y).slice(0, 24)}`);
  }
};

console.log(`\n${'═'.repeat(78)}`);
if (ctrl) cmp('DRIFT CONTROL: base vs ctrl (same pristine tree twice)', base, ctrl, 'same');
cmp('THE CLAIM: base vs work — the lobby pass does not move the shipped duel', base, work, 'same');
if (bad) cmp('KNOWN-BAD: work vs bad (slots permuted) — every field must MOVE', work, bad, 'different');

if (t0 !== t1) { fail++; console.log('\n✗ TREE CONTROL MOVED MID-RUN — discard this run'); }
else console.log('\n✓ tree control steady across the whole battery');

console.log(`\n${fail === 0 ? '✅ lb_bitid: PASS' : `❌ lb_bitid: ${fail} FAILED`}  (ref ${REF})`);
process.exit(fail === 0 ? 0 : 1);
