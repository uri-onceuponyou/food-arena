#!/usr/bin/env node
/**
 * BASELINE SCORE — join blind verdicts to the answer keys and report the number with a
 * stated confidence, in units of the instrument's own resolution floor.
 *
 * Input is one JSON file of raw critic returns, in the rubric's own output shape:
 *
 *   [{ "element": "arena", "critic": 1, "A": 5, "B": 8,
 *      "Afix": "...", "Bfix": "..." }, ...]
 *
 * The critic never learns which panel is which; `sheet_1.key.json` does, and the join
 * happens here. That ordering is the only thing that makes the round blind, so this
 * refuses to score a verdict whose key it cannot find.
 *
 * ── The floor, and why two of them are printed ──────────────────────────────
 * `review.mjs:resolutionFloor` is 1.96*sqrt(2)*sd/sqrt(k) with sd = 0.50 measured over
 * 16 fresh critics on one fixed image. That is the CANONICAL floor and it is what makes
 * this run comparable to the audit. But it assumes both sides have that sd, and here
 * they do not: our side is one fixed image (pure critic noise) while the reference side
 * is a different plate per critic (critic noise + library variation). So the OBSERVED
 * floor, 1.96*sqrt(sd_ours^2/k + sd_ref^2/k), is also printed, and the gap is expressed
 * in both. Where they disagree, believe the larger one.
 *
 * A round whose REFERENCE panel scores outside 7-9 measured the critic, not the work,
 * and is discarded BEFORE the mean is taken — not reconciled afterwards. An invalid
 * round already drove the two largest rewrites the apron ever received.
 *
 * Usage:
 *   node tools/tmp/baseline_score.mjs --assignments shots/review/baseline/assignments.json \
 *     --verdicts shots/review/baseline/verdicts.json
 *   node tools/tmp/baseline_score.mjs --selftest
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
/** Sample sd (n-1). With k=6 the difference from the population form is 9%. */
const sd = (a) => (a.length < 2 ? 0 : Math.sqrt(a.reduce((s, v) => s + (v - mean(a)) ** 2, 0) / (a.length - 1)));

const CANON_SD = 0.50;
const canonicalFloor = (k) => 1.96 * Math.SQRT2 * (CANON_SD / Math.sqrt(Math.max(1, k)));
const observedFloor = (so, sr, k) => 1.96 * Math.sqrt((so * so) / k + (sr * sr) / k);

const REF_BAND = [7, 9];

function selftest() {
  let pass = 0; let fail = 0;
  const t = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name} ${detail}`); }
    else { fail++; console.log(`  FAIL ${name} ${detail}`); }
  };
  t('mean', mean([1, 2, 3]) === 2);
  t('sd of a constant is 0', sd([5, 5, 5, 5]) === 0);
  t('sd matches the hand calculation', Math.abs(sd([2, 4, 4, 4, 5, 5, 7, 9]) - 2.1381) < 1e-3, sd([2, 4, 4, 4, 5, 5, 7, 9]).toFixed(4));
  // The canonical floor must reproduce review.mjs's printed numbers.
  t('canonical floor at k=1 is 1.39', Math.abs(canonicalFloor(1) - 1.3859) < 1e-3, canonicalFloor(1).toFixed(4));
  t('canonical floor at k=2 is 0.98', Math.abs(canonicalFloor(2) - 0.9800) < 1e-3, canonicalFloor(2).toFixed(4));
  t('canonical floor at k=6 is 0.57', Math.abs(canonicalFloor(6) - 0.5658) < 1e-3, canonicalFloor(6).toFixed(4));
  // Observed floor collapses to the canonical one when both sds are the canonical sd.
  t('observed floor == canonical when both sd are 0.50',
    Math.abs(observedFloor(0.5, 0.5, 6) - canonicalFloor(6)) < 1e-9);
  t('observed floor shrinks with k', observedFloor(0.5, 0.8, 12) < observedFloor(0.5, 0.8, 6));
  // The validity gate must actually reject.
  const inBand = (v) => v >= REF_BAND[0] && v <= REF_BAND[1];
  t('gate accepts 8', inBand(8));
  t('gate rejects 5', !inBand(5));
  t('gate rejects 9.5', !inBand(9.5));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

const args = parseArgs(process.argv);
if (args.selftest) selftest();

const aPath = resolve(args.assignments ?? 'shots/review/baseline/assignments.json');
const vPath = resolve(args.verdicts ?? 'shots/review/baseline/verdicts.json');
if (!existsSync(aPath)) { console.error(`no ${aPath}`); process.exit(2); }
if (!existsSync(vPath)) { console.error(`no ${vPath}`); process.exit(2); }

const { assignments, criticsPerElement } = JSON.parse(await readFile(aPath, 'utf8'));
const verdicts = JSON.parse(await readFile(vPath, 'utf8'));

const rows = [];
for (const v of verdicts) {
  const a = assignments.find((x) => x.element === v.element && x.critic === v.critic);
  if (!a) { console.error(`verdict for ${v.element} c${v.critic} has no assignment`); process.exit(3); }
  const keyPath = a.key;
  if (!existsSync(keyPath)) { console.error(`no key at ${keyPath} — refusing to guess which panel was ours`); process.exit(3); }
  const key = JSON.parse(await readFile(keyPath, 'utf8'));
  const ours = key.A === 'ours' ? v.A : v.B;
  const ref = key.A === 'ours' ? v.B : v.A;
  const oursFix = key.A === 'ours' ? v.Afix : v.Bfix;
  const refFix = key.A === 'ours' ? v.Bfix : v.Afix;
  rows.push({
    element: v.element, critic: v.critic, plate: a.plate,
    oursSlot: key.A === 'ours' ? 'A' : 'B',
    ours, ref, oursFix, refFix,
    valid: ref >= REF_BAND[0] && ref <= REF_BAND[1],
  });
}

const elements = [...new Set(rows.map((r) => r.element))];
const summary = [];

console.log('\n══ per-round ══════════════════════════════════════════════════════════════');
console.log('element    critic plate       slot  ours   ref   valid');
for (const r of rows) {
  console.log(`${r.element.padEnd(10)} c${String(r.critic).padEnd(5)} ${r.plate.padEnd(11)} ${r.oursSlot}    `
    + `${String(r.ours).padStart(5)} ${String(r.ref).padStart(5)}   ${r.valid ? 'yes' : 'NO  <- discarded'}`);
}

console.log('\n══ per-element ════════════════════════════════════════════════════════════');
for (const el of elements) {
  const all = rows.filter((r) => r.element === el);
  const valid = all.filter((r) => r.valid);
  if (valid.length === 0) {
    console.log(`\n${el}: 0 of ${all.length} rounds valid — NOTHING IS REPORTED. The reference side `
      + `scored ${all.map((r) => r.ref).join(', ')}, outside ${REF_BAND[0]}-${REF_BAND[1]}.`);
    summary.push({ element: el, n: 0, discarded: all.length });
    continue;
  }
  const o = valid.map((r) => r.ours);
  const rf = valid.map((r) => r.ref);
  const k = valid.length;
  const so = sd(o); const sr = sd(rf);
  const gap = mean(rf) - mean(o);
  const cf = canonicalFloor(k);
  const of_ = observedFloor(so, sr, k);
  const floor = Math.max(cf, of_);
  summary.push({
    element: el, n: k, discarded: all.length - k,
    ours: +mean(o).toFixed(2), oursSd: +so.toFixed(2), oursRange: [Math.min(...o), Math.max(...o)],
    ref: +mean(rf).toFixed(2), refSd: +sr.toFixed(2), refRange: [Math.min(...rf), Math.max(...rf)],
    gap: +gap.toFixed(2),
    canonicalFloor: +cf.toFixed(2), observedFloor: +of_.toFixed(2),
    gapInFloors: +(gap / floor).toFixed(1),
    resolvable: gap > floor,
  });
  const s = summary[summary.length - 1];
  console.log(`\n${el}  (n=${k}${s.discarded ? `, ${s.discarded} discarded` : ''})`);
  console.log(`   ours       ${s.ours.toFixed(2)}  sd ${s.oursSd.toFixed(2)}  range ${s.oursRange[0]}-${s.oursRange[1]}`);
  console.log(`   reference  ${s.ref.toFixed(2)}  sd ${s.refSd.toFixed(2)}  range ${s.refRange[0]}-${s.refRange[1]}`);
  console.log(`   gap        ${s.gap.toFixed(2)}  = ${s.gapInFloors} floors `
    + `(canonical ${s.canonicalFloor.toFixed(2)}, observed ${s.observedFloor.toFixed(2)}; the larger is used)`);
  console.log(`   ${s.resolvable ? 'RESOLVABLE' : 'NOT RESOLVABLE — inside the floor, so it is not a result'}`);
}

console.log('\n══ named defects, ours ════════════════════════════════════════════════════');
for (const el of elements) {
  const valid = rows.filter((r) => r.element === el && r.valid);
  if (!valid.length) continue;
  console.log(`\n${el}:`);
  for (const r of valid) console.log(`   c${r.critic} (${r.plate}): ${r.oursFix}`);
}

console.log(`\n(k requested per element: ${criticsPerElement})`);
console.log(JSON.stringify({ summary }, null, 2));
