#!/usr/bin/env node
/**
 * Q1_SIGMA — recompute the blind critic's σ FROM THIS ROUND'S OWN REPEATED READS,
 * instead of quoting the published 0.50 or the previous agent's n=3 alarm.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 *
 * `7db3859` found that three fresh critics scored a BYTE-IDENTICAL `ours` panel
 * **4, 4, 6** — sample sd **1.155**, 2.3× the σ = 0.50 that rule 7's ±1.4 floor and
 * `q1_ledger`'s entire `1.96*√2*σ/√k` formula rest on. It correctly did not act on
 * it (n=3 gives a hopelessly noisy sd) and flagged it for whoever reaches k≥6.
 *
 * 🚨 **If σ is really nearer 1.1 than 0.50, every floor this round prints is too
 * tight in the FLATTERING direction** — which would be the third such error in this
 * round alone. So the question is worth answering properly and cheaply, and this
 * file is the cheap way: the round already contains far more repeated reads of
 * identical pixels than anybody had counted.
 *
 * ── THE THREE POPULATIONS, and why the second one is the good one ─────────────
 *
 * §A OURS-SIDE. Every arm in `q1-manifest.json` reuses ONE `ours` frame across all
 *    its critics — only the reference plate and the coin-flipped A/B slot change.
 *    That is the manifest's design, not an arena-arm defect: asserted here by
 *    hashing the `ours` source named in each cell's key and requiring one sha per
 *    element. So every scored cell with k≥2 is a repeated read of fixed pixels.
 *
 * §B REFERENCE-SIDE — the same trick on the other panel, and it is where the
 *    evidence actually is. Plate `bs_01` is the reference in SEVEN different cells
 *    and `bs_02` in SIX, each scored by a different fresh critic. That is k=6–7 on
 *    byte-identical pixels **today**, versus k=2–3 on the ours side.
 *    ⚠️ **And it is biased LOW, which is stated rather than buried.** Reference
 *    plates score 8–9 against a documented critic ceiling of 8–9 (`docs/TOOLS.md`),
 *    so the population is compressed against the top of the scale while the ours
 *    panels sit at 4–6 with room on both sides. §B is a LOWER BOUND on σ_ours, not
 *    an estimate of it. It can refute a large σ; it cannot confirm a small one.
 *
 * §C HISTORIC. `q1-manifest.json`'s `recorded.reads` carry six (mean, sd, n) groups
 *    from 2026-08-05, each a fan-out of 4–6 fresh critics over one fixed sheet set.
 *    Pooling them is where the published σ = 0.50 can be checked against its own
 *    source rather than re-quoted.
 *
 * ── What this DOES NOT do ─────────────────────────────────────────────────────
 *
 * It does not change a floor, and `q1_ledger.mjs` does not import it. Rule 10 says
 * state a floor before acting inside it; it does not say a single agent may move
 * one. This prints evidence and a CI so the number accumulates in public.
 *
 * ⚠️ A χ² interval on σ assumes normal scores. Critic scores are INTEGERS on 0–10,
 * so the interval is indicative, not exact — quoted to three places because the
 * inputs are, not because it is accurate to three places.
 *
 * Usage:
 *   node tools/tmp/q1_sigma.mjs
 *   node tools/tmp/q1_sigma.mjs --selftest
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const MANIFEST = resolve(REPO, 'shots/review/q1-manifest.json');
const LEDGER = resolve(REPO, 'tools/tmp/q1_scores.jsonl');

/** χ² quantiles at 0.025 / 0.975, df 1..40. Only these two columns are ever needed. */
const CHI2 = {
  1: [0.000982, 5.024], 2: [0.0506, 7.378], 3: [0.216, 9.348], 4: [0.484, 11.143],
  5: [0.831, 12.833], 6: [1.237, 14.449], 7: [1.690, 16.013], 8: [2.180, 17.535],
  9: [2.700, 19.023], 10: [3.247, 20.483], 11: [3.816, 21.920], 12: [4.404, 23.337],
  13: [5.009, 24.736], 14: [5.629, 26.119], 15: [6.262, 27.488], 16: [6.908, 28.845],
  17: [7.564, 30.191], 18: [8.231, 31.526], 19: [8.907, 32.852], 20: [9.591, 34.170],
  22: [10.982, 36.781], 24: [12.401, 39.364], 26: [13.844, 41.923], 28: [15.308, 44.461],
  30: [16.791, 46.979], 33: [19.047, 50.725], 35: [20.569, 53.203], 40: [24.433, 59.342],
};
function chi2(df) {
  if (CHI2[df]) return CHI2[df];
  const keys = Object.keys(CHI2).map(Number).sort((a, b) => a - b);
  const k = keys.reduce((best, x) => (Math.abs(x - df) < Math.abs(best - df) ? x : best), keys[0]);
  return CHI2[k];
}

/**
 * Pool the within-group variances of several groups of repeated reads.
 *
 * ⚠️ Rule 6: the set is asserted NON-EMPTY before anything is asserted over it.
 * `[].reduce` on a sum returns 0 and this would happily print `sd 0.000, df 0` —
 * a σ of ZERO, the most flattering possible answer, from no data at all. That
 * vacuity class has fired at least seven times in this repo.
 */
export 
/**
 * A zero-variance group is not evidence that σ is small — it is k reads that happened to
 * agree — and it drags a pooled estimate DOWN until the moment it stops being zero.
 *
 * 🚨 THIS WARNING WAS §A-ONLY, AND THE GROUP IT SHOULD HAVE CAUGHT WAS ON §B. On
 * 2026-08-21 a panel agent found `q1_sigma` printing NO warning while a reference plate
 * sat at `[8,8]` sd 0.000 and its own read took it to `[8,8,8]` — still 0.000, with more
 * weight — quietly moving §B's pool. A warning scoped to one section is a warning that
 * says "clean" about the other.
 *
 * ⚠️ AND ON §B THE DIRECTION IS WORSE. §B is already a STATED LOWER BOUND (plates score
 * 8-9 against a documented 8-9 ceiling), so a zero-variance group drags a low bound lower
 * — the flattering direction, which is where every floor error in this round has gone.
 */
function warnZeroVariance(section, groups) {
  // Rule 6: a pool over nothing would print a confident small number. Refuse instead.
  if (groups.length === 0) throw new Error(`q1_sigma: ${section} has ZERO groups — refusing to report a pool over nothing.`);
  const zero = groups.filter((g) => g.sd === 0);
  if (!zero.length) return;
  console.log(`  ⚠️  ${zero.length} of ${groups.length} ${section} group(s) have sd EXACTLY 0.000 — ${zero.map((g) => g.key ?? '(UNNAMED — a group without a key is a bug)').join(', ')}.`);
  console.log('      A zero-variance group drags the pool DOWN and flips it the moment it ends.');
  console.log(`      Do NOT cite ${section} as independent agreement with §C while one is present.`);
}

function pool(groups) {
  const usable = groups.filter((g) => g.n >= 2);
  if (usable.length === 0) return null;
  const df = usable.reduce((s, g) => s + (g.n - 1), 0);
  if (df === 0) return null;
  const ss = usable.reduce((s, g) => s + (g.n - 1) * g.s2, 0);
  const s2 = ss / df;
  const sd = Math.sqrt(s2);
  const [lo, hi] = chi2(df);
  return { df, sd, groups: usable.length, ci: [sd * Math.sqrt(df / hi), sd * Math.sqrt(df / lo)] };
}

export function stats(values) {
  const n = values.length;
  if (n === 0) return { n: 0, mean: null, s2: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const s2 = n < 2 ? 0 : values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { n, mean, s2, sd: Math.sqrt(s2) };
}

const f3 = (x) => (x === null || x === undefined ? '  —  ' : x.toFixed(3));

function report(title, p) {
  if (!p) { console.log(`  ${title}: NO GROUP HAS k>=2 — nothing poolable, and 0.000 would be a LIE.`); return; }
  console.log(`  ${title}: pooled sd ${f3(p.sd)}  (df ${p.df}, ${p.groups} groups)   `
    + `95% CI [${f3(p.ci[0])}, ${f3(p.ci[1])}]`);
}

function main() {
  const man = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  if (!existsSync(LEDGER)) { console.error('q1_sigma: the local ledger is absent (it is gitignored by design).'); process.exit(2); }
  const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const scored = new Map(rows.filter((r) => !r.skipped).map((r) => [r.id, r]));
  if (scored.size === 0) { console.error('q1_sigma: ZERO scored rows. Refusing to pool nothing.'); process.exit(2); }

  const idOf = (a) => `${a.arm}/${a.element}/c${a.critic}`;

  // ── §A OURS SIDE. Assert the identity claim rather than trusting the header.
  console.log('\n══ §A OURS-SIDE — repeated reads of ONE frame, k>=2 cells ══\n');
  const byElement = new Map();
  for (const a of man.assignments) {
    const key = `${a.arm}/${a.element}`;
    if (!byElement.has(key)) byElement.set(key, []);
    byElement.get(key).push(a);
  }
  const oursGroups = [];
  for (const [key, cells] of [...byElement].sort()) {
    // The identity claim, hashed. A cell whose ours source differs is NOT a repeated read.
    const shas = new Set();
    for (const c of cells) if (existsSync(c.ours)) shas.add(createHash('sha256').update(readFileSync(c.ours)).digest('hex').slice(0, 12));
    const vals = cells.map((c) => scored.get(idOf(c))).filter(Boolean).map((r) => r.ours);
    const st = stats(vals);
    const idTag = shas.size === 1 ? `ours ${[...shas][0]}` : `🔴 ${shas.size} DIFFERENT ours sources — NOT a repeated read`;
    console.log(`  ${key.padEnd(26)} k=${st.n}  ${JSON.stringify(vals).padEnd(14)} `
      + `mean ${f3(st.mean)}  sd ${st.n >= 2 ? f3(st.sd) : '  —  '}   ${idTag}`);
    // `key` attached: `stats()` returns only the numbers, so a warning about WHICH group
    // is degenerate had nothing to name — it printed an empty string, which is a warning
    // that cannot be acted on.
    if (shas.size === 1 && st.n >= 2) oursGroups.push({ ...st, key });
  }
  report('§A pooled σ_ours', pool(oursGroups));

  // 🚨 §A IS VOLATILE AND MUST SAY SO ON EVERY RUN, BECAUSE IT IS QUOTED EVERY ROUND.
  //
  // 2026-08-21: a single new read flipped §A's CI from [0.461, 1.024] — containing 0.50,
  // excluding 1.1 — to [0.562, 1.211], which EXCLUDES 0.50 and CONTAINS 1.1. The opposite
  // conclusion, from one score. The mechanism is arithmetic, not evidence: `new/cast` sat
  // at [5,5,5], **sd exactly 0.000**, and a zero-variance group drags a pooled estimate
  // down until the moment it stops being zero.
  //
  // A group with sd 0 is not a measurement that σ is small — it is k reads that happened
  // to agree, and at k=3 that is unremarkable. So §A must not be cited as independent
  // agreement with §C while one is in the pool.
  //
  // ⚠️ §C is untouched by any of this (it pools the 2026-08-05 fan-outs the published
  // σ = 0.50 came from) and still reads ~0.501 on df 26. **Rule 7's ±1.4 floor rests on
  // §C, not on §A.** This warning exists so a reader cannot mistake §A's number for a
  // second, agreeing witness.
  warnZeroVariance('§A', oursGroups);

  // ── §B REFERENCE SIDE. Same plate, many cells, many fresh critics.
  console.log('\n══ §B REFERENCE-SIDE — same PLATE across cells (k is much larger here) ══');
  console.log('  ⚠️  BIASED LOW: plates score 8–9 against a documented 8–9 ceiling, so this');
  console.log('      population is compressed. It is a LOWER BOUND on σ_ours, not an estimate.\n');
  const byPlate = new Map();
  for (const a of man.assignments) {
    const r = scored.get(idOf(a));
    if (!r || typeof r.reference !== 'number') continue;
    if (!byPlate.has(a.plate)) byPlate.set(a.plate, []);
    byPlate.get(a.plate).push(r.reference);
  }
  const refGroups = [];
  for (const [plate, vals] of [...byPlate].sort()) {
    const st = stats(vals);
    console.log(`  plate ${plate.padEnd(20)} k=${st.n}  ${JSON.stringify(vals).padEnd(22)} `
      + `mean ${f3(st.mean)}  sd ${st.n >= 2 ? f3(st.sd) : '  —  '}`);
    // `key` attached for the same reason §A's is: a degeneracy warning with nothing to
    // name is a warning that cannot be acted on. §B pushed bare `stats()` and would have
    // printed an empty string — the exact bug §A's comment records as fixed THERE.
    if (st.n >= 2) refGroups.push({ ...st, key: `plate ${plate}` });
  }
  report('§B pooled σ_ref ', pool(refGroups));
  warnZeroVariance('§B', refGroups);

  // ── §C HISTORIC, from the manifest's own recorded fan-outs.
  console.log('\n══ §C HISTORIC — the 2026-08-05 fan-outs the published σ = 0.50 came from ══\n');
  const seen = new Set();
  const histGroups = [];
  for (const a of man.assignments) {
    const key = `${a.arm}/${a.element}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const rd of a.recorded?.reads ?? []) {
      console.log(`  ${key.padEnd(26)} n=${rd.n}  mean ${f3(rd.mean)}  sd ${f3(rd.sd)}   ${rd.at}`);
      histGroups.push({ n: rd.n, s2: rd.sd ** 2 });
    }
  }
  report('§C pooled σ_hist', pool(histGroups));

  // ── §D BETWEEN-SESSION. σ = 0.50 was measured WITHIN one session on one fixed
  //    image. This round is deliberately spread over days (`q1_ledger`'s header:
  //    "spreading a round over days MAXIMISES exposure to exactly that confound"),
  //    so a second variance component can ride on top of §C's σ and would make
  //    every ledger floor too tight. The drift arms exist to see it.
  //    ⚠️ PAIRED ONLY. Comparing session MEANS is confounded by which cells each
  //    session happened to sample — `CLAUDE.md` rule 10's "a paired delta on
  //    identical seeds is a DIFFERENT quantity from an aggregate" applied to dates.
  console.log('\n══ §D BETWEEN-SESSION — the SAME pixels re-read on a later day ══\n');
  const days = new Map();
  for (const [key, cells] of [...byElement].sort()) {
    const shas = new Set();
    for (const c of cells) if (existsSync(c.ours)) shas.add(createHash('sha256').update(readFileSync(c.ours)).digest('hex'));
    if (shas.size !== 1) continue;
    const reads = cells.map((c) => scored.get(idOf(c))).filter(Boolean)
      .map((r) => ({ day: String(r.at).slice(0, 10), ours: r.ours }));
    for (const r of reads) days.set(r.day, (days.get(r.day) ?? 0) + 1);
    const byDay = new Map();
    for (const r of reads) { if (!byDay.has(r.day)) byDay.set(r.day, []); byDay.get(r.day).push(r.ours); }
    if (byDay.size < 2) continue;
    const ds = [...byDay.keys()].sort();
    const m = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const first = ds[0], last = ds[ds.length - 1];
    console.log(`  ${key.padEnd(26)} ${first} ${JSON.stringify(byDay.get(first))} -> `
      + `${last} ${JSON.stringify(byDay.get(last))}   paired delta ${(m(byDay.get(last)) - m(byDay.get(first))).toFixed(3)}`);
  }
  console.log(`\n  sessions in the ledger: ${[...days].sort().map(([d, n]) => `${d}(${n})`).join('  ')}`);
  console.log('  A cell spanning ONE day only cannot speak to this and is not printed.');

  console.log('\n══ VERDICT ══');
  const a = pool(oursGroups), b = pool(refGroups), c = pool(histGroups);
  const lines = [];
  if (c) lines.push(`published σ = 0.50 vs §C pooled ${f3(c.sd)} on df ${c.df} — the source checks out.`);
  if (b) lines.push(`§B excludes σ >= ${f3(b.ci[1])} on the reference side (95%), but see the bias note.`);
  if (a) lines.push(`§A point estimate ${f3(a.sd)} on df ${a.df}; CI [${f3(a.ci[0])}, ${f3(a.ci[1])}] `
    + `${a.ci[0] <= 0.50 && 0.50 <= a.ci[1] ? 'CONTAINS' : 'EXCLUDES'} 0.50, and `
    + `${a.ci[0] <= 1.1 && 1.1 <= a.ci[1] ? 'CONTAINS' : 'EXCLUDES'} 1.1.`);
  lines.push('NOT a licence to move a floor. Accumulate k and re-run.');
  for (const l of lines) console.log('  ' + l);
  console.log('');
}

function selftest() {
  let p = 0, f = 0;
  const t = (n, c, ev = '') => { if (c) { p++; console.log(`  ok   ${n}`); } else { f++; console.log(`  FAIL ${n}  ${ev}`); } };

  const s = stats([4, 4, 6]);
  t('A sd of the 4/4/6 alarm reproduces the 1.155 in 7db3859',
    Math.abs(s.sd - 1.1547) < 0.001, `${s.sd}`);

  // Pooling must RECOVER a σ it was fed. Six groups of n=5 all with s=0.5 -> 0.5.
  const rec = pool(Array.from({ length: 6 }, () => ({ n: 5, s2: 0.25 })));
  t('B pooling recovers the σ it was fed', Math.abs(rec.sd - 0.5) < 1e-9, `${rec.sd}`);
  t('B2 …with the right df (6 groups × 4)', rec.df === 24, `${rec.df}`);

  // KNOWN-BAD 1: the vacuity that would print σ = 0 from no data.
  t('C KNOWN-BAD an empty group set returns null, NOT sd 0.000', pool([]) === null);
  t('C2 KNOWN-BAD groups that are ALL k=1 return null, not 0.000',
    pool([{ n: 1, s2: 0 }, { n: 1, s2: 0 }]) === null);

  // KNOWN-BAD 2: pooling must be able to REPORT a large σ. A pool that always
  // returned ~0.5 would read exactly like the real one on this round's data.
  const big = pool([{ n: 6, s2: 1.21 }, { n: 6, s2: 1.44 }]);
  t('D KNOWN-BAD a genuinely wide population pools WIDE (>1.0)', big.sd > 1.0, `${f3(big.sd)}`);

  // The CI must move the right way with df: more data, tighter interval.
  const thin = pool([{ n: 3, s2: 0.25 }]);
  const thick = pool(Array.from({ length: 10 }, () => ({ n: 6, s2: 0.25 })));
  t('E more df narrows the CI', (thick.ci[1] - thick.ci[0]) < (thin.ci[1] - thin.ci[0]),
    `${f3(thick.ci[1] - thick.ci[0])} vs ${f3(thin.ci[1] - thin.ci[0])}`);
  t('E2 the CI brackets the point estimate', thick.ci[0] < thick.sd && thick.sd < thick.ci[1]);

  // A single-value group contributes NO confidence — the same class as `q1_ledger`
  // counting SKIPPED rows toward k, which printed a floor 1.7× too tight.
  const mixed = pool([{ n: 2, s2: 1.0 }, { n: 1, s2: 999 }]);
  t('F a k=1 group is dropped rather than folded in', mixed.df === 1 && Math.abs(mixed.sd - 1) < 1e-9,
    `df ${mixed.df} sd ${mixed.sd}`);

  console.log(`\nq1_sigma selftest ${p} pass / ${f} fail`);
  process.exit(f ? 1 : 0);
}

if (process.argv.slice(2).includes('--selftest')) selftest();
else main();
