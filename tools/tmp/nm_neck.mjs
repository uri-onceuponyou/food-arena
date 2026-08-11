#!/usr/bin/env node
/**
 * nm_neck — the CONTRACT of the `withoutNeck()` migration, verified on the SHIPPED
 * character files rather than on the helper's arithmetic.
 *
 * THROWAWAY. READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY THIS EXISTS WHEN `r2_probe --selftest` ALREADY PROVES `withoutNeck()` ─
 * It proves the FUNCTION. It builds a rig from `bodyType(arch)` and a second from
 * `withoutNeck(bodyType(arch))` and shows R and `headCentreY` agree to 1e-9. That is
 * necessary and it is not the thing being shipped: what ships is an EDIT to four
 * character files, and every way that edit can go wrong lives outside the helper —
 * wrapping the wrong call, wrapping it inside the tweaks object instead of around
 * the whole `bodyType()`, a character that also sets `headMount` or `headFraction`
 * in its own tweaks (the tweak spread wins, so `withoutNeck` must run AFTER it), or
 * simply editing three files and believing the fourth.
 *
 * So this snapshots `rig.metrics` for the WHOLE CAST out of the working tree, and a
 * later run diffs against it. The migration's contract is exactly:
 *
 *     headRadius  and  headCentreY  IDENTICAL to six figures
 *     neckGap     -> 0 on the migrated characters, unchanged everywhere else
 *     every other published metric UNCHANGED
 *
 * ⚠️ Six figures is the CLAIM, and the tolerance is deliberately looser than the
 * 1e-9 `r2_probe` asserts on the helper: these numbers are re-derived through a
 * different route (`headFraction' = 2R/height` is a decimal literal typed into a
 * source file, so it carries the rounding of however many digits the author wrote).
 * The default `--tol 5e-7` is what "identical to six figures" means for a value of
 * order 1. A character that needs more digits should get more digits, not a looser
 * gate — the tolerance is printed with every verdict so it cannot drift silently.
 *
 * ── KNOWN-BAD INPUT (CLAUDE.md #6) ───────────────────────────────────────────
 * `--knownbad naive` is the whole reason to trust a green run. It re-derives every
 * character's proportions and drops `neckFraction` to 0 with NOTHING else changed —
 * the naive migration — and requires this comparator to FAIL on the four characters
 * that build a column. A comparator that cannot fail on the naive drop is not
 * checking anything, because the naive drop is the mistake this pass exists to avoid.
 *
 * ⚠️ AND THE KNOWN-BAD CARRIES ITS OWN TRAP, recorded by `de4bb11`: reconstructing a
 * character's proportions WITHOUT its `stance` reproduces R exactly and puts
 * `headCentreY` 0.079 m out on burrito, because `RigStance.splay` moves `hipY`,
 * `hipY` moves `torsoTopY`, and `headCentreY` is measured from there. That is not a
 * `withoutNeck` bug. The reconstruction below therefore passes `rig.stance` through,
 * and the naive arm must fail on the NECK term alone.
 *
 * ── USE ──────────────────────────────────────────────────────────────────────
 *   node tools/tmp/nm_neck.mjs --save shots/nm/neck_before.json    # on the old tree
 *   node tools/tmp/nm_neck.mjs --against shots/nm/neck_before.json \
 *        --migrated hotdog,sushi,soup,pizza                        # after the edit
 *   node tools/tmp/nm_neck.mjs --knownbad naive                    # the comparator's own test
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO, ALL_IDS, ARCHETYPE, captureWarnings, arg, flag, num, writeOut } from './rg_lib.mjs';

const SAVE = arg('--save', null);
const AGAINST = arg('--against', null);
const KNOWNBAD = arg('--knownbad', null);
const TOL = num('--tol', 5e-7);
const MIGRATED = arg('--migrated', '').split(',').map((s) => s.trim()).filter(Boolean);
const IDS = arg('--ids', 'all') === 'all' ? ALL_IDS : arg('--ids', '').split(',').filter(Boolean);

/**
 * Same one-file esbuild bundle `r2_probe` builds, for the same reason it keeps a
 * local copy: `rg_lib.mjs` is not this agent's file, and a two-line convenience is
 * not worth a second owner in a file ten tools import.
 */
async function loadCast() {
  const dir = mkdtempSync(path.join(tmpdir(), 'nm-'));
  const entry = path.join(dir, 'entry.ts');
  const q = (p) => JSON.stringify(path.join(REPO, p));
  writeFileSync(entry, [
    `export { createCharacter } from ${q('src/characters/registry')};`,
    `export { ChibiRig } from ${q('src/characters/rig')};`,
    `export { bodyType, withoutNeck } from ${q('src/characters/bodies')};`,
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(REPO, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found at ${esbuild}`);
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
    `--alias:three=${path.join(REPO, 'node_modules/three')}`,
    `--outfile=${out}`, '--log-level=error'], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] });
  return import('file://' + out);
}

const mod = await loadCast();

/** Every published metric, plus the two the contract is written in terms of. */
function snapshot(id) {
  const { value } = captureWarnings(() => mod.createCharacter(id));
  const rig = value.rig;
  rig.restPose();
  rig.joints.root.updateWorldMatrix(true, true);
  const m = rig.metrics;
  const out = {};
  for (const k of Object.keys(m)) if (typeof m[k] === 'number') out[k] = m[k];
  return out;
}

const NUMERIC_KEYS = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();

/**
 * The verdict for one character. `expectNeckZero` says this id is on the migration
 * list, so `neckGap` MUST have gone to 0 — an id that was supposed to migrate and did
 * not is a silent no-op, which is the failure mode a "nothing changed" report hides.
 */
function compare(id, before, after, expectNeckZero) {
  const faults = [];
  for (const k of NUMERIC_KEYS(before, after)) {
    if (k === 'neckGap' || k === 'neckRadius' || k === 'headFraction' || k === 'headMount') continue;
    const d = Math.abs((after[k] ?? NaN) - (before[k] ?? NaN));
    if (!(d <= TOL)) faults.push(`${k} ${before[k]} -> ${after[k]}  (|Δ| ${d.toExponential(3)} > ${TOL})`);
  }
  if (expectNeckZero) {
    if (!(before.neckGap > 0)) faults.push(`listed as migrated but had NO neck to drop (neckGap ${before.neckGap})`);
    if (after.neckGap !== 0) faults.push(`neckGap did not reach 0 — still ${after.neckGap}`);
  } else if (Math.abs(after.neckGap - before.neckGap) > TOL) {
    faults.push(`neckGap moved on a character NOT on the migration list: ${before.neckGap} -> ${after.neckGap}`);
  }
  return faults;
}

function row(id, before, after, faults) {
  const dR = Math.abs(after.headRadius - before.headRadius);
  const dC = Math.abs(after.headCentreY - before.headCentreY);
  return `${id.padEnd(12)} ${String(ARCHETYPE[id]).padEnd(9)}`
    + ` R ${before.headRadius.toFixed(6)} -> ${after.headRadius.toFixed(6)}  |Δ| ${dR.toExponential(2)}`
    + `   centreY ${before.headCentreY.toFixed(6)} -> ${after.headCentreY.toFixed(6)}  |Δ| ${dC.toExponential(2)}`
    + `   gap ${before.neckGap.toFixed(4)} -> ${after.neckGap.toFixed(4)}   ${faults.length ? '🔴 FAIL' : 'ok'}`;
}

// ── --knownbad naive ────────────────────────────────────────────────────────
/**
 * Three checks, and the first two are TWO-SIDED on purpose: a comparator that fails
 * everything is as useless as one that passes everything.
 *
 *   1. NAIVE   `{...bodyType(arch), neckFraction: 0}` — the mistake — must FAIL.
 *   2. CORRECT `withoutNeck(bodyType(arch))` — the fix — must PASS through the same
 *              comparator, on the same pair of rigs.
 *   3. BITE    the tolerance must actually bite at the resolution it claims: a
 *              headRadius perturbed by 2*TOL fails, one perturbed by TOL/10 passes.
 *   4. NO-OP   a character declared `--migrated` whose `neckGap` did not move must
 *              FAIL — a silent no-op is exactly what "nothing changed" hides.
 *
 * ⚠️ It runs on the ARCHETYPE defaults rather than on reconstructed character
 * proportions, and that is a correction: the first version rebuilt each character's
 * proportions from its own `rig.metrics` and the reconstruction was NOT faithful —
 * `shoulderFraction` is not `shoulderY / torsoHeight`, `armClearance` is not a
 * proportion at all, and `legFraction`/`footClearance` are pre-stance. Every one of
 * those showed up as a "failure" that belonged to the reconstruction, not to the
 * naive drop. The archetypes carry a real neck (`lanky`, `standard`, `stout` all
 * have `neckFraction > 0`), so the mistake is reproduced without inventing numbers.
 * The per-character claim is made by `--against` on the shipped files, which needs
 * no reconstruction at all.
 */
if (KNOWNBAD === 'naive') {
  console.log(`KNOWN-BAD: does this comparator see the NAIVE neck drop, and accept the real fix? tol ${TOL}\n`);
  const P = { limb: '#888888', hand: '#888888', foot: '#888888', torso: '#888888' };
  const build = (props) => new mod.ChibiRig({ palette: P, proportions: props, jointsOnly: true }).metrics;
  let fails = 0;
  const say = (label, ok, detail) => { console.log(`  ${ok ? '✓' : '🔴'} ${label}${detail ? `  ${detail}` : ''}`); if (!ok) fails++; };

  for (const arch of ['lanky', 'standard', 'stout', 'stub']) {
    const props = mod.bodyType(arch);
    const ctl = build(props);
    if (!(ctl.neckGap > 0)) { console.log(`${arch.padEnd(9)} no neck to drop — skipped (this is 'stub' and it is correct)`); continue; }
    const naive = build({ ...props, neckFraction: 0 });
    const fixed = build(mod.withoutNeck(props));
    const naiveFaults = compare(arch, ctl, naive, true);
    const fixedFaults = compare(arch, ctl, fixed, true);
    console.log(`${arch.padEnd(9)} gap ${ctl.neckGap.toFixed(4)}`
      + `   naive: R ${ctl.headRadius.toFixed(6)} -> ${naive.headRadius.toFixed(6)}, centreY ${ctl.headCentreY.toFixed(6)} -> ${naive.headCentreY.toFixed(6)}`);
    say(`${arch}: the NAIVE drop is REJECTED`, naiveFaults.length > 0, naiveFaults.length ? `(${naiveFaults[0]})` : '— comparator is blind');
    say(`${arch}: withoutNeck() is ACCEPTED`, fixedFaults.length === 0, fixedFaults.length ? `(${fixedFaults.join('; ')})` : '');
  }

  // BITE — on a real shipped character, so the tolerance is exercised at the scale it
  // will actually be quoted at rather than on a synthetic unit-sized number.
  const probe = snapshot('sushi');
  const nudged = { ...probe, headRadius: probe.headRadius + TOL * 2 };
  const hair = { ...probe, headRadius: probe.headRadius + TOL / 10 };
  say(`tolerance BITES at 2*TOL (${(TOL * 2).toExponential(1)} m of R)`, compare('sushi', probe, nudged, false).length > 0);
  say(`tolerance ADMITS TOL/10 (${(TOL / 10).toExponential(1)} m of R)`, compare('sushi', probe, hair, false).length === 0);

  // NO-OP — an id on the migration list whose neck never moved.
  say('a declared migration that did NOT drop its neck is REJECTED',
    compare('sushi', probe, probe, true).length > 0);
  // ...and the mirror: a neck that moved on a character NOT on the list.
  say('a neck that moves on an UNLISTED character is REJECTED',
    compare('sushi', probe, { ...probe, neckGap: 0 }, false).length > 0);

  console.log(`\n${fails ? `🔴 KNOWN-BAD FAILED — ${fails} check(s)` : '✓ all known-bad checks hold'}`);
  process.exit(fails ? 1 : 0);
}

// ── --save ──────────────────────────────────────────────────────────────────
const now = {};
for (const id of IDS) now[id] = snapshot(id);

if (SAVE) {
  console.log(`\n${writeOut(SAVE, { takenAt: new Date().toISOString(), tol: TOL, ids: IDS, metrics: now })}`);
  for (const id of IDS) {
    const m = now[id];
    console.log(`${id.padEnd(12)} ${String(ARCHETYPE[id]).padEnd(9)} R ${m.headRadius.toFixed(6)}`
      + `  centreY ${m.headCentreY.toFixed(6)}  torsoTopY ${m.torsoTopY.toFixed(6)}  neckGap ${m.neckGap.toFixed(6)}`);
  }
  process.exit(0);
}

// ── --against ───────────────────────────────────────────────────────────────
if (!AGAINST) { console.error('need --save <file>, --against <file>, or --knownbad naive'); process.exit(2); }
if (!existsSync(AGAINST)) { console.error(`no baseline at ${AGAINST}`); process.exit(2); }
const base = JSON.parse(readFileSync(AGAINST, 'utf8'));
const before = base.metrics;

console.log(`\nMIGRATION CONTRACT — R and headCentreY identical to six figures (tol ${TOL})`);
console.log(`baseline ${AGAINST}  taken ${base.takenAt}`);
console.log(`migrated: ${MIGRATED.length ? MIGRATED.join(', ') : '(none declared — every neckGap must hold)'}\n`);

let bad = 0;
for (const id of IDS) {
  if (!before[id]) { console.log(`${id.padEnd(12)} 🔴 not in the baseline`); bad++; continue; }
  const faults = compare(id, before[id], now[id], MIGRATED.includes(id));
  console.log(row(id, before[id], now[id], faults));
  for (const f of faults) console.log(`             · ${f}`);
  if (faults.length) bad++;
}
const unlisted = MIGRATED.filter((id) => !IDS.includes(id));
if (unlisted.length) { console.log(`\n🔴 --migrated names ${unlisted.join(', ')}, which are not in --ids`); bad++; }
console.log(`\n${IDS.length - bad} of ${IDS.length} hold the contract.`);
process.exit(bad ? 1 : 0);
