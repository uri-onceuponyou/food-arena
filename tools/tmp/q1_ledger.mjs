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
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    by[k] ??= { done: 0, total: 0, skipped: 0, rows: [], sheets: new Set() };
    by[k].total++;
    if (scored.has(idOf(a))) { by[k].done++; by[k].rows.push(scored.get(idOf(a))); by[k].sheets.add(a.sheet); }
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
    // 🚨 `k` IS DISTINCT SHEETS, NOT SCORED ROWS — AND IT WAS ROWS UNTIL 2026-08-22.
    //
    // `q1_packets.mjs`'s `DRIFT_ORDER = [1,2,3,4,5,6,1,2]` gives every drift element **8
    // seats over 6 distinct sheets** on purpose (its comment: "two critics see one
    // identical file, which is the sd-0.50 design, not a defect"). So a fully-scored drift
    // arm published a floor computed from **n=8** while resting on **6** distinct images —
    // `drift_base_arena` printed 0.490 where the honest figure is 0.566.
    //
    // Two reads of the SAME pixels are not two independent observations of the artwork.
    // The published floor was therefore **tighter than the evidence**, which is the
    // direction every floor error in this round has gone: the k1 fallback that claimed
    // more confidence than two observations support, the arm that counted SKIPPED rows
    // toward k, and now this. **Three separate ways to be flatteringly wrong about n.**
    //
    // ⚠️ The MEANS are unaffected (4.125 → 4.167 on the worst cell) — a repeated read is a
    // legitimate observation of the CRITIC. It is only illegitimate as evidence about the
    // IMAGE, which is exactly what a floor quantifies.
    const kDistinct = by[k].sheets.size;
    const floor = d === 0 ? null : (1.96 * Math.SQRT2 * 0.50 / Math.sqrt(kDistinct)).toFixed(3);
    const dupTag = kDistinct < d ? `  ⚠️ ${d} reads over ${kDistinct} DISTINCT sheets` : '';
    const tag = sk ? `  (${sk} skipped)` : '';
    // ⚠️ THE GAP IS THE ANSWER, AND THIS TOOL DID NOT PRINT IT. Every panel agent
    // recomputed it out of `q1_public.jsonl` by hand — six agents, six chances to slip,
    // and I told one of them "the gaps as the ledger prints them today" when the ledger
    // prints no such thing. A number every reader derives themselves is a number that
    // will eventually be derived wrong.
    //
    // 🚨 It is the MEAN OF PAIRED GAPS, not the difference of the two means. They coincide
    // when every cell has both sides, and they diverge the moment one does not — and cells
    // legitimately lack a side (a SKIPPED control scores only one). Pairing within the cell
    // is the quantity rule 10 calls EXACT; a difference of aggregates is the one that hid
    // 58 of 110 moving matchups behind an 0.8 pp headline.
    // NOT `?? []`: a missing accumulator would print dashes forever and read as
    // "nothing scored yet" rather than as a bug. Assert it exists.
    if (!Array.isArray(by[k].rows)) throw new Error('q1_ledger: row accumulator missing for ' + k);
    const rows = by[k].rows.filter((r) => typeof r.ours === 'number' && typeof r.reference === 'number');
    const gapCol = rows.length
      ? `  ours ${(rows.reduce((a, r) => a + r.ours, 0) / rows.length).toFixed(3)}`
        + `  ref ${(rows.reduce((a, r) => a + r.reference, 0) / rows.length).toFixed(3)}`
        + `  GAP ${(rows.reduce((a, r) => a + (r.reference - r.ours), 0) / rows.length).toFixed(3)}`
        + ` (n=${rows.length})`
      : '  ours     —  ref     —  GAP     —';
    console.log(`  ${k.padEnd(26)} ${String(d).padStart(2)}/${t}   floor ${d === 0 ? '    —' : floor.padStart(5)}${gapCol}${tag}${dupTag}`);
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

/**
 * 🚨 IS_MAIN — MISSING UNTIL 2026-08-21, IN A FILE THAT EXPORTS **AND WRITES**.
 *
 * This module exports `runOrder` and `load`, so a peer tool importing it for the run
 * order also ran the CLI block below. Proved both arms in a scratch cwd:
 *
 *   * a plain `await import()` ran `main()` — from the repo it PRINTED THE WHOLE LEDGER
 *     into the importer's output; from anywhere else it THREW inside `readFileSync`, so
 *     the importer saw an fs crash it never caused.
 *   * a tool whose own `argv` happened to be `--record '<json>'` **APPENDED A ROW** by
 *     merely importing this file — and `q1_scores.jsonl` is resolved RELATIVE TO CWD, so
 *     the write lands wherever the importer happens to be standing.
 *
 * That last one is the dangerous shape: the failure is a silent write to a path nobody
 * chose, in the file that decides which panel is scored next. **Fifth instance of
 * `AGENT-BRIEF` §3's class in this repo, and the first that mutates state.**
 *
 * Same block form as `q1_public.mjs`, which was fixed for the same reason.
 */
const IS_MAIN = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

const argv = IS_MAIN ? process.argv.slice(2) : [];
if (!IS_MAIN) { /* imported for `runOrder`/`load` — the CLI path must not run, and must not WRITE */ }
else if (argv.includes('--selftest')) selftest();
else if (argv[0] === '--record') {
  const rec = JSON.parse(argv[1]);
  for (const k of ['id', 'ours', 'reference', 'oursNote', 'referenceNote']) {
    if (!(k in rec)) { console.error(`--record: missing ${k}`); process.exit(2); }
  }
  rec.at = new Date().toISOString();
  writeFileSync(LEDGER, JSON.stringify(rec) + '\n', { flag: 'a' });
  // ⚠️ A SKIP IS NOT A DISCARD. `null >= 7` is false, so this printed the loudest failure
  // string in the round — "🔴 REF OUTSIDE 7–9 — DISCARD THIS ROUND" — on a perfectly
  // healthy skipped row, five times. `main()` reads `skipped` correctly and excludes it
  // from `k`; only the banner was wrong. A cosmetic bug that cries wolf is still a bug:
  // an operator who learns to ignore that string will ignore it on a real discard.
  const valid = rec.skipped === true || (rec.reference >= 7 && rec.reference <= 9);
  const verdict = rec.skipped === true ? 'SKIPPED (not scored, excluded from k)'
    : valid ? 'VALID' : '🔴 REF OUTSIDE 7–9 — DISCARD THIS ROUND';
  console.log(`recorded ${rec.id}  ours ${rec.ours}  ref ${rec.reference}  ${verdict}`);
} else main();
