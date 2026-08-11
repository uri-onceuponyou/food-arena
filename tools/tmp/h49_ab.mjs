#!/usr/bin/env node
/**
 * §49f ACCEPTANCE — AT TWO FIGHTERS THE HUD IS BYTE-IDENTICAL, OR THIS PASS IS WRONG.
 *
 * `3980e6e` measured the two-fighter HUD DOM as character-for-character what it was
 * before the presentation was made N-capable, and the ENTIRE N-fighter presentation rests
 * on that property. §49f adds a chip treatment above two seats. The acceptance question is
 * therefore not "is the chip layout nice" — it is **"can a two-fighter match tell"**, and
 * the only honest answer is the same one `np_ab.mjs` gives: pixels at both shipped pitches,
 * the serialised HUD DOM, the scene graph, and the selector families two shipped gates key
 * on.
 *
 * ── 🚨 WHY THIS EXISTS RATHER THAN `np_ab.mjs` ──────────────────────────────
 *
 * `np_ab.mjs` overlays FIVE files — `hud.ts`, `match.ts`, `vfx.ts`, `audio/director.ts`
 * and `roster.ts` — because that was `3980e6e`'s file set. §49f's file set is ONE file,
 * and **a peer is mid-edit in `src/game/` right now** (§49a/§49c: `combat.ts`, `sim.ts`,
 * `state.ts` are all dirty in the working tree as this is written). Overlaying a file this
 * pass does not own means a peer saving mid-battery lands inside the measurement — which
 * is precisely the failure the per-file tree control exists to CATCH, and it is cheaper
 * not to invite it. `headserve` archives a pinned commit, so with a one-file overlay the
 * peer's work cannot reach either arm at all.
 *
 * ⚠️ `theme.ts` IS IN THIS PASS'S FILE SET AND IS DELIBERATELY NOT OVERLAID, because it is
 * NOT TOUCHED. It is hashed by the tree control anyway: "I did not change it" is a claim,
 * and a hash printed before and after the battery is the check.
 *
 * ── THE ARMS ────────────────────────────────────────────────────────────────
 *
 *   base  headserve --ref <sha>                        the shipped two-fighter HUD
 *   ctrl  headserve --ref <sha>  (again)               🚨 THE DRIFT CONTROL. Must equal
 *                                                      `base` EXACTLY on every field. A
 *                                                      "no diff" from an instrument nobody
 *                                                      has shown can produce a diff is
 *                                                      worth nothing.
 *   work  headserve --ref <sha> --overlay hud.ts       this change
 *   bad   as `work`, plus np_identity's `--swap`       🚨 THE KNOWN-BAD. The two slots'
 *                                                      characters are permuted and every
 *                                                      number MUST move. It also proves the
 *                                                      instrument is live ON THE OVERLAID
 *                                                      TREE, not merely live.
 *
 * ⚠️ **AND THE OVERLAY'S OWN POSITIVE CONTROL IS NOT HERE — IT IS `h49_chips.mjs`.**
 * Every field below being identical is the RESULT this pass wants, which makes it exactly
 * the result an overlay that silently did nothing would also produce. `--swap` moves under
 * a URL parameter, so it cannot distinguish "the overlay landed" from "the overlay was
 * ignored". `h49_chips.mjs` closes that: it asserts the grid, the rail and the chips at
 * N=3..6, and it is run against BOTH the pristine commit (where it must FAIL) and the
 * overlay (where it must PASS). That pair is the deliberate break.
 *
 *   node tools/tmp/h49_ab.mjs --ref 189d6ed
 *   node tools/tmp/h49_ab.mjs --ref 189d6ed --quick     # base + work only
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

/** OVERLAID: what this pass edits. */
const OVERLAY = ['src/ui/hud.ts'];
/** HASHED BUT NOT OVERLAID: owned by this pass, asserted untouched. */
const WITNESS = ['src/ui/screens/theme.ts'];
const FILES = [...OVERLAY, ...WITNESS];

const sha = (p) => (existsSync(`${ROOT}/${p}`)
  ? createHash('sha256').update(readFileSync(`${ROOT}/${p}`)).digest('hex').slice(0, 8)
  : '--------');

function treeControl(label) {
  const rows = FILES.map((f) => [f, sha(f), OVERLAY.includes(f) ? 'overlaid' : 'witness']);
  console.log(`\n── TREE CONTROL (${label}) — per FILE, never per directory ──`);
  for (const [f, h, role] of rows) console.log(`   ${h}  ${role.padEnd(8)} ${f}`);
  return rows.map(([f, h]) => `${h} ${f}`).join('\n');
}

function runArm(tag, { overlay = false, swap = false } = {}) {
  const flags = ['--ref', REF];
  if (overlay) for (const f of OVERLAY) flags.push('--overlay', f);
  // ⚠️ NO `--url {URL}` — that placeholder is `with_snapshot.mjs`'s. `headserve` injects
  // PREVIEW_BASE into the child's env, and the literal string produces
  // `Cannot navigate to invalid URL`, which reads like a dead server rather than a wrong flag.
  const cmd = ['tools/tmp/headserve.mjs', ...flags, '--',
    'node', 'tools/tmp/np_identity.mjs', '--tag', `h49-${tag}`, '--json'];
  if (swap) cmd.push('--swap');
  console.log(`\n▶ arm ${tag}${overlay ? ' (overlay hud.ts)' : ''}${swap ? ' (SWAPPED — known-bad)' : ''}`);
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
  ['png.p58', (r) => r.png.p58],
  ['png.p20', (r) => r.png.p20],
  ['hud', (r) => r.hudSha],
  ['scene', (r) => r.sceneSha],
  ['names', (r) => JSON.stringify(r.names)],
  ['hp', (r) => JSON.stringify(r.hp)],
  ['selectors', (r) => JSON.stringify(r.selectors)],
  ['rng', (r) => String(r.rng)],
  // Informational: `generateUUID` is ~98.6% of all draws and reaches no pixel.
  ['rngUuid*', (r) => String(r.rngUuid)],
  ['feel', (r) => JSON.stringify({ events: r.feel?.events, responses: r.feel?.responses })],
];

function compare(a, b, labelA, labelB, expectSame) {
  console.log(`\n── ${labelA} vs ${labelB} — expected ${expectSame ? 'IDENTICAL' : 'DIFFERENT'} ──`);
  let same = 0, diff = 0;
  for (const [name, get] of FIELDS) {
    const va = get(a), vb = get(b);
    const eq = va === vb;
    const scored = !name.endsWith('*');
    if (scored) { if (eq) same++; else diff++; }
    const verdict = !scored ? 'info' : eq ? 'same' : 'DIFF';
    const detail = eq ? String(va).slice(0, 48) : `${String(va).slice(0, 32)} -> ${String(vb).slice(0, 32)}`;
    console.log(`   ${verdict}  ${name.padEnd(10)} ${detail}`);
  }
  const ok = expectSame ? diff === 0 : diff > 0;
  console.log(`   => ${ok ? 'PASS' : 'FAIL'}  (${same} same, ${diff} different)`);
  return ok;
}

if (REF === 'HEAD') {
  console.warn('\n  ⚠ h49_ab: --ref HEAD is resolved PER ARM. Pass an explicit SHA to every arm.\n');
}

const before = treeControl('before');
const results = {};
results.base = runArm('base');
if (!QUICK) results.ctrl = runArm('ctrl');
results.work = runArm('work', { overlay: true });
if (!QUICK) results.bad = runArm('bad', { overlay: true, swap: true });

let pass = true;
if (!QUICK) pass = compare(results.base, results.ctrl, 'base', 'ctrl (self-pair)', true) && pass;
pass = compare(results.base, results.work, 'base', 'work', true) && pass;
if (!QUICK) pass = compare(results.work, results.bad, 'work', 'bad (known-bad)', false) && pass;

const after = treeControl('after');
if (before !== after) {
  console.log('\n🚨 TREE MOVED MID-BATTERY — every number above is measured across two trees. DISCARD.');
  pass = false;
}

console.log(`\n${pass ? 'PASS' : 'FAIL'} — h49_ab, ref ${REF}\n`);
process.exit(pass ? 0 : 1);
