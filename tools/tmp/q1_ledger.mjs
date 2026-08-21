#!/usr/bin/env node
/**
 * Q1_LEDGER — the blind-critic round, run ONE CRITIC AT A TIME, across sessions.
 *
 * ## Why this exists
 *
 * Uri: *"let's run 1 at a time for the critiques, so we'll close the gap slowly."*
 *
 * 🚨 **A SINGLE CRITIC RESOLVES NOTHING, AND THE MANIFEST SAYS SO IN ITS OWN NUMBERS.**
 * `q1-manifest.json:floors` carries `1.96*sqrt(2)*0.50/sqrt(k)`:
 *
 *     k=1  ->  1.386      k=3  ->  0.800      k=4  ->  0.693
 *     k=6  ->  0.566      k=8  ->  0.490      8-vs-6 between arms -> 0.529
 *
 * So one critic is **+-1.386** — the full published floor. The number only becomes usable as
 * `k` accumulates, which is exactly what a ledger is for: the value of critic #7 is that #1
 * through #6 are still on disk and still comparable.
 *
 * ## 🚨 THE TRAP IN RUNNING SLOWLY, AND WHY THE ORDER BELOW IS NOT ARBITRARY
 *
 * Byte-identical baseline sheets re-scored six hours later read **0.42 (arena) / 0.58 (cast)
 * LOWER** — 1.30 and 1.80 sigma, *suggestive, not established*. **Spreading a round over days
 * MAXIMISES exposure to exactly that confound.** So the drift arms are not a nice-to-have
 * here; they are the thing that makes a slow round interpretable at all.
 *
 * → **Interleave.** Every `new` critic is followed by a `drift` critic, so drift is sampled on
 *   the SAME cadence as the signal. If the two move together, the movement is the instrument.
 * → **Controls first.** `ctl_low`/`ctl_high` cost 3 each and validate the pipeline before any
 *   signal is spent: `review.mjs` records that a real Brawl Stars plate submitted *as ours*
 *   scores 8.67 and a degraded frame scores 1.83 BELOW its own clean original. A critic that
 *   cannot reproduce that separation makes every later score void.
 * → **The reference side is scored every round and 7-9 is the validity band** (`CLAUDE.md` #7).
 *   Outside it, DISCARD the round rather than keeping it — that rule predates this file.
 *
 * ## Use
 *
 *   node tools/tmp/q1_ledger.mjs            # what is next, and how far along each arm is
 *   node tools/tmp/q1_ledger.mjs --record '<json>'
 *   node tools/tmp/q1_ledger.mjs --selftest
 *
 * ⚠️ The ledger lives in `tools/tmp/`, NOT under `shots/`. **`shots/` is gitignored**, and a
 * round accumulated over weeks that vanishes on a clean checkout would be the most expensive
 * possible place to learn that.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MANIFEST = 'shots/review/q1-manifest.json';
const LEDGER = 'tools/tmp/q1_scores.jsonl';

/** Controls first, then strict new/drift alternation. See the header for why. */
export function runOrder(assignments) {
  const pick = (f) => assignments.filter(f).sort((a, b) => a.critic - b.critic);
  const ctl = pick((a) => a.element.startsWith('ctl_'));
  const fresh = pick((a) => a.arm === 'new' && !a.element.startsWith('ctl_'));
  const drift = pick((a) => a.arm === 'drift');
  const out = [...ctl];
  // Interleave so drift is sampled on the same cadence as the signal, not after it.
  for (let i = 0; i < Math.max(fresh.length, drift.length); i++) {
    if (fresh[i]) out.push(fresh[i]);
    if (drift[i]) out.push(drift[i]);
  }
  return out;
}

const idOf = (a) => `${a.arm}/${a.element}/c${a.critic}`;

export function load() {
  const man = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const done = existsSync(LEDGER)
    ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  return { man, done, doneIds: new Set(done.map((d) => d.id)) };
}

function main() {
  const { man, done, doneIds } = load();
  const order = runOrder(man.assignments);
  const next = order.find((a) => !doneIds.has(idOf(a)));

  // ⚠️ `k` COUNTS SCORED ROWS, NOT RECORDED ONES. The first version counted anything in the
  // ledger, so four deliberate SKIPs made the controls report a k=3 floor of 0.800 when
  // exactly ONE critic had scored them — a floor 1.7x tighter than the evidence supports,
  // printed in the tool built to stop precisely that. A skipped row contributes no
  // observation and must contribute no confidence.
  const scored = new Map(done.filter((d) => !d.skipped).map((d) => [d.id, d]));
  const by = {};
  for (const a of man.assignments) {
    const k = `${a.arm}/${a.element}`;
    by[k] ??= { done: 0, total: 0, skipped: 0 };
    by[k].total++;
    if (scored.has(idOf(a))) by[k].done++;
    else if (doneIds.has(idOf(a))) by[k].skipped++;
  }
  console.log(`\n══ Q1 LEDGER ══  ${done.length} of ${man.assignments.length} scored\n`);
  for (const k of Object.keys(by).sort()) {
    const { done: d, total: t, skipped: sk } = by[k];
    // ⚠️ COMPUTE the floor; do NOT look it up with a fallback. `man.floors` carries only
    // k1/k3/k4/k6/k8, and a `?? '<0.49'` fallback printed **<0.49 for k=2** — TIGHTER than
    // the truth (0.980), i.e. it claimed more confidence than two observations can support.
    // Second time a display in this round understated its own floor; the first was counting
    // SKIPPED rows toward k. Both times the number was wrong in the flattering direction.
    const floor = d === 0 ? null : (1.96 * Math.SQRT2 * 0.50 / Math.sqrt(d)).toFixed(3);
    const tag = sk ? `  (${sk} skipped)` : '';
    console.log(`  ${k.padEnd(26)} ${String(d).padStart(2)}/${t}   floor ${d === 0 ? '    —' : floor.padStart(5)}${tag}`);
  }
  if (!next) { console.log('\n  COMPLETE.\n'); return; }
  console.log(`\n  NEXT: ${idOf(next)}`);
  console.log(`    sheet  ${next.sheet}`);
  console.log(`    rubric ${man.rubric}`);
  console.log(`    ⚠️  the critic must NEVER be shown ${next.key}\n`);
}

function selftest() {
  let p = 0, f = 0;
  const t = (n, c, ev = '') => { if (c) { p++; console.log(`  ok   ${n}`); } else { f++; console.log(`  FAIL ${n}  ${ev}`); } };
  const A = [
    { arm: 'new', element: 'arena', critic: 2 }, { arm: 'new', element: 'arena', critic: 1 },
    { arm: 'drift', element: 'd', critic: 1 }, { arm: 'new', element: 'ctl_low', critic: 1 },
  ];
  const o = runOrder(A);
  t('the run order is NON-EMPTY before anything is concluded from it', o.length > 0, `${o.length}`);
  t('every assignment appears exactly once', o.length === A.length);
  t('a CONTROL comes first — the instrument is validated before signal is spent',
    o[0].element === 'ctl_low', `${o[0].element}`);
  t('critics are ordered within an arm (c1 before c2)',
    o.findIndex((x) => x.critic === 1 && x.element === 'arena') < o.findIndex((x) => x.critic === 2), '');
  // KNOWN-BAD: an order that appends drift AFTER all fresh work would defeat the interleave.
  const bad = [...A.filter((a) => a.arm === 'new'), ...A.filter((a) => a.arm === 'drift')];
  const iF = bad.findIndex((x) => x.arm === 'new' && !x.element.startsWith('ctl'));
  t('KNOWN-BAD: a non-interleaved order is DETECTABLY different from this one',
    JSON.stringify(bad) !== JSON.stringify(o), `iF=${iF}`);
  console.log(`\nq1_ledger selftest ${p} pass / ${f} fail`);
  process.exit(f ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) selftest();
else if (argv[0] === '--record') {
  const rec = JSON.parse(argv[1]);
  for (const k of ['id', 'ours', 'reference', 'oursNote', 'referenceNote']) {
    if (!(k in rec)) { console.error(`--record: missing ${k}`); process.exit(2); }
  }
  rec.at = new Date().toISOString();
  writeFileSync(LEDGER, JSON.stringify(rec) + '\n', { flag: 'a' });
  const valid = rec.reference >= 7 && rec.reference <= 9;
  console.log(`recorded ${rec.id}  ours ${rec.ours}  ref ${rec.reference}  ${valid ? 'VALID' : '🔴 REF OUTSIDE 7–9 — DISCARD THIS ROUND'}`);
} else main();
