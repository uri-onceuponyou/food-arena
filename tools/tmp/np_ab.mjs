#!/usr/bin/env node
/**
 * THE N-PRESENTATION ACCEPTANCE BATTERY — four arms, one verdict.
 *
 * `np_identity.mjs` photographs one build. This runs it against several and decides
 * whether the presentation refactor changed a two-fighter match.
 *
 *   arm   served by                                    the claim it supports
 *   ────  ───────────────────────────────────────────  ─────────────────────────────
 *   base  headserve --ref <ref>            (pristine)  what the committed game looks like
 *   ctrl  headserve --ref <ref>            (pristine)  ⚠️ THE DRIFT CONTROL — must equal
 *                                                      `base` EXACTLY. A "no diff" from an
 *                                                      instrument nobody has shown can
 *                                                      produce a diff is worth nothing.
 *   work  headserve --ref <ref> --overlay  (the files) the refactor, HEAD everywhere else
 *   bad   as `work`, plus `--swap`                     🚨 THE KNOWN-BAD. The two slots'
 *                                                      characters are permuted and every
 *                                                      number MUST move.
 *
 * ── 🚨 WHY THE OVERLAY, AND NOT A WORKING-TREE SNAPSHOT ────────────────────
 *
 * `tools/snapshot.mjs` freezes the WORKING tree, and "frozen" is not "clean": three peers
 * are mid-edit in `src/characters/**`, `src/ui/icons/**` and `vite.config.ts` right now,
 * and a half-saved character rig lands in the same frame this measures. `headserve
 * --overlay` serves a pristine `git archive` of `<ref>` with EXACTLY the files under test
 * copied over it, so the only difference between `base` and `work` is this file set.
 *
 * ── 🚨 AND WHY THE TREE CONTROL IS PER FILE ────────────────────────────────
 *
 * The N-fighter sim pass discarded TWO whole acceptance batteries to learn this. Its
 * control hashed `git diff src/game`, which is a DIRECTORY this file set shares with
 * peers; a peer's `vfx.ts` went dirty→committed mid-run and moved the hash, and the run
 * was correctly thrown away. A control scoped to a directory is not scoped to the thing
 * being measured. Every file below is hashed INDIVIDUALLY, printed before and after the
 * whole battery, and a single moved digest fails the run.
 *
 *   node tools/tmp/np_ab.mjs                 # full battery
 *   node tools/tmp/np_ab.mjs --quick         # base + work only, no control, no known-bad
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
 * THE FILE SET UNDER TEST, named one by one.
 *
 * `src/game/roster.ts` is in the list because the refactor ADDED it: the four consumers
 * all needed the same three seat-resolution rules and this project's oldest defect shape
 * is one rule stated once and implemented twice. It is new, so it cannot be in the base
 * arm — which is exactly why it has to be in the overlay.
 */
const FILES = [
  'src/ui/hud.ts',
  'src/game/match.ts',
  'src/game/vfx.ts',
  'src/audio/director.ts',
  'src/game/roster.ts',
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
  // ⚠️ NO `--url {URL}` HERE. That placeholder belongs to `with_snapshot.mjs`;
  // `headserve` injects `PREVIEW_BASE` into the child's env instead, and passing the
  // literal string produces `Cannot navigate to invalid URL` — which reads like a dead
  // server rather than like a wrong flag.
  const cmd = ['tools/tmp/headserve.mjs', ...flags, '--',
    'node', 'tools/tmp/np_identity.mjs', '--tag', tag, '--json'];
  if (swap) cmd.push('--swap');
  console.log(`\n▶ arm ${tag}${overlay ? ' (overlay)' : ''}${swap ? ' (SWAPPED — known-bad)' : ''}`);
  const r = spawnSync('node', cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}`;
  // `headserve` prints its own lines around the child; the report is the last line that
  // parses as JSON. Scanning for it rather than assuming the last line keeps this working
  // when a page logs a warning on the way out.
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
  // The RNG draw COUNT and the event->feel census. See `np_identity`'s init script: with a
  // seeded `Math.random` a pixel diff has two possible causes and these separate them.
  ['rng', (r) => String(r.rng)],
  // ⚠️ REPORTED, DELIBERATELY NOT COMPARED FOR PASS/FAIL. `generateUUID` draws are 98.6%
  // of the total and a UUID reaches no pixel; the count moves whenever object
  // construction does, which is a legitimate thing for a refactor to change.
  ['rngUuid*', (r) => String(r.rngUuid)],
  // ⚠️ `events` + `responses` ONLY. `feel.frames` counts rAF TURNS, not sim ticks, so it is
  // wall-clock dependent by construction and moved between two runs of the same tree — a
  // counter that cannot be equal is not a comparison, it is noise wearing one.
  ['feel', (r) => JSON.stringify({ events: r.feel?.events, responses: r.feel?.responses })],
];

function compare(a, b, labelA, labelB, expectSame) {
  console.log(`\n── ${labelA} vs ${labelB} — expected ${expectSame ? 'IDENTICAL' : 'DIFFERENT'} ──`);
  let same = 0, diff = 0;
  for (const [name, get] of FIELDS) {
    const va = get(a), vb = get(b);
    const eq = va === vb;
    // A trailing `*` marks an INFORMATIONAL row: printed, never scored. See `rngUuid*`.
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

console.log(`\n${pass ? 'PASS' : 'FAIL'} — np_ab, ref ${REF}\n`);
process.exit(pass ? 0 : 1);
