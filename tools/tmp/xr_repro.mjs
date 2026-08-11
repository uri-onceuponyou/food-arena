#!/usr/bin/env node
/**
 * HOW MANY PANELS DOES A PER-ICON SCORE NEED BEFORE IT REPRODUCES?
 *
 * ── The question, and why it is prior to every icon A/B this project has run ──
 * Nine icon verdicts have been acted on here, each from ONE three-judge panel. `67373e5`
 * recorded, in passing, the number that should have stopped all of them:
 *
 *     FOUR INDEPENDENT NATIVE PANELS ON BYTE-IDENTICAL ART:  1/3, 0/3, 3/3, 0/3
 *
 * That is `slash`, one glyph, unchanged, four panels, the full range. This file measures
 * the thing that number is a single instance of, on 6 independent panels × 63 icons, and
 * turns it into a stated resolution floor — `CLAUDE.md` #10.
 *
 * ── The two noise sources, which must NOT be pooled ──────────────────────────
 *   σ²_judge   two judges disagree about the same tile on the SAME plate
 *   σ²_plate   the same icon scores differently on a differently-shuffled plate —
 *              in a forced-choice round a wrong answer is only available while no earlier
 *              tile has claimed it (`ic_pair.mjs` header; `67373e5` §4)
 *
 * Historically an "independent panel" has meant NEW JUDGES AND A NEW PLATE, so a
 * judge-count derived from σ²_judge alone answers the wrong question. The design effect
 * `1 + (m−1)·ICC` is what converts one into the other, and it is measured here rather
 * than assumed.
 *
 * ── 🔴 AND THE ARITHMETIC CEILING, WHICH IS PRIOR TO BOTH ────────────────────
 * A 3-judge panel reports one of FOUR values. Even with a PERFECT instrument — judges
 * independent, no plate effect at all — two panels scoring an icon whose true legibility
 * is 0.5 agree on the exact score only C(3,k)² summed over k, /64 = **20/64 = 31.3%** of
 * the time. That is not a defect of these judges. It is what a 4-level scale with a
 * sampling SD of 0.87 can express. This file prints that ceiling next to the measured
 * rate so the two are never confused.
 *
 *   node tools/tmp/xr_repro.mjs --dir shots/ic/xrk --plates p101,p102,p103,p104,p105,p106
 *   node tools/tmp/xr_repro.mjs --selftest
 *
 * ── THE ANSWER, measured 2026-08-11 on 9 panels × 3 judges × 63 icons ───────
 * (plus a 10th panel, `shots/ic/xrf/p201.png`, which carries 3 forged tiles and is
 * therefore quoted only per-icon for the 60 unforged ones.)
 *
 *   ρ = 0.4936   DEFF 1.99   → 3 judges on one plate are worth **1.51** judges
 *   exact-score reproduction between two panels  **65.2%**  (ceiling **65.8%**)
 *   pass/fail reproduction   K=1 79.5%  K=2 82.9%  K=3 87.1%  K=4 87.0%
 *   panels for ±1 judge of 3 = **6**; for ±0.5 = **23**; for ±0.25 = **92**
 *   twin floor: **36 of 108** readings split on byte-identical art
 *   at 27 judges: CLOSED 26 · BROKEN 4 · **UNRESOLVED 33** of 63
 *
 * 🔴 **THE CONCLUSION IS THAT A PER-ICON ABSOLUTE SCORE IS THE WRONG INSTRUMENT**,
 * except at 0-of-N and N-of-N. `heal` scored 0/3 on EIGHT consecutive panels — Wilson CI
 * [0.01, 0.32], which this tool prints as BROKEN — and then **3/3 on the tenth**. Six
 * panels of unanimity was not enough. Neither tile order nor proximity to `health`
 * explains it, and I could not find what does.
 *
 * ⚠️ THE PROTOCOL, WHICH IS PART OF EVERY NUMBER ABOVE: one `Read` of `JUDGE.md` and one
 * `Read` of the plate PNG, no Bash, no crop, no magnification, forced choice over the 65
 * `SUBJECT` strings, repeats allowed. One sheet was DISCARDED for running `ls` and is
 * kept at `shots/ic/xrk/void/`. Two of 1,881 judgements used an off-list string ("a chess
 * piece", twice, same tile) and scored as misses, which is the conservative direction.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { subjectOf } from './icon_score.mjs';

const IS_MAIN = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE CORE. Everything below takes plain arrays so `--selftest` can drive it with
// synthetic data whose right answer is known by construction.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pooled one-way ANOVA intra-cluster correlation, clusters = PLATES, units = JUDGES.
 *
 * `x` is x[icon][plate][judge] ∈ {0,1}, rectangular. Sums of squares are pooled ACROSS
 * icons after centring within icon, so one icon with 18 observations does not have to
 * carry an ICC estimate on its own.
 *
 * 🔴 IT REFUSES AN EMPTY OR DEGENERATE SET RATHER THAN RETURNING A NUMBER. `[].every()`
 * is `true` and `0/0` is `NaN`, and a vacuous control that reports 0.00 is worse than no
 * control — three of them went vacuous in this repo in one session.
 */
export function icc(x) {
  if (!Array.isArray(x) || x.length === 0) throw new Error('icc: empty icon set — a decomposition over nothing is not a floor');
  const P = x[0].length, m = x[0][0].length;
  if (P < 2) throw new Error(`icc: ${P} plate(s) — the between-plate term needs at least 2`);
  if (m < 2) throw new Error(`icc: ${m} judge(s) per plate — the within-plate term needs at least 2`);
  for (const rows of x) {
    if (rows.length !== P) throw new Error('icc: ragged plate count — the design must be balanced');
    for (const r of rows) if (r.length !== m) throw new Error('icc: ragged judge count — the design must be balanced');
  }
  let ssb = 0, ssw = 0;
  for (const rows of x) {
    const grand = rows.flat().reduce((s, v) => s + v, 0) / (P * m);
    for (const r of rows) {
      const pm = r.reduce((s, v) => s + v, 0) / m;
      ssb += m * (pm - grand) ** 2;
      for (const v of r) ssw += (v - pm) ** 2;
    }
  }
  const dfB = x.length * (P - 1), dfW = x.length * P * (m - 1);
  const msb = ssb / dfB, msw = ssw / dfW;
  // Negative ICC is a real estimate (plates less variable than chance) and is clamped to
  // 0 only where it feeds a DESIGN EFFECT, never here — a clamp inside the estimator
  // would hide the one arm that proves the estimator can move downward.
  const rho = (msb + (m - 1) * msw) === 0 ? 0 : (msb - msw) / (msb + (m - 1) * msw);
  return { rho, msb, msw, dfB, dfW, P, m, icons: x.length };
}

/** Design effect for a cluster sample: how much a plate-clustered judge is worth. */
export const deff = (rho, m) => 1 + (m - 1) * Math.max(0, rho);

/**
 * Panels (clusters of `m` judges) needed for a 95% CI half-width of `h` on a proportion,
 * at the worst case p = 0.5. Returns a real number; callers round UP.
 */
export const panelsFor = (h, rho, m) => (1.96 ** 2) * 0.25 * deff(rho, m) / (m * h * h);

/** C(n,k) for small n. */
function binom(n, k) { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; }

/**
 * The ARITHMETIC CEILING: P(two independent panels of m judges report the SAME integer
 * score) for an icon of true legibility p, with judges independent and no plate effect.
 * This is the best any instrument of this shape can do, and it is not 1.
 */
export function exactAgreeCeiling(p, m) {
  let s = 0;
  for (let k = 0; k <= m; k++) { const q = binom(m, k) * p ** k * (1 - p) ** (m - k); s += q * q; }
  return s;
}

/** Agreement between two panel scores, on the two predicates the project actually uses. */
export const sameScore = (u, v) => u === v;
export const samePassFail = (u, v, m) => (u >= Math.ceil(2 * m / 3)) === (v >= Math.ceil(2 * m / 3));

/**
 * Empirical reproducibility, per icon, over every unordered pair of the P panels.
 * `S` is S[icon][panel], integers 0..m.
 */
export function pairAgreement(S, m) {
  if (!S.length) throw new Error('pairAgreement: empty icon set');
  const P = S[0].length;
  if (P < 2) throw new Error('pairAgreement: needs at least 2 panels');
  return S.map((row) => {
    let n = 0, ex = 0, pf = 0;
    for (let i = 0; i < P; i++) for (let j = i + 1; j < P; j++) {
      n++;
      if (sameScore(row[i], row[j])) ex++;
      if (samePassFail(row[i], row[j], m)) pf++;
    }
    return { n, exact: ex / n, passfail: pf / n };
  });
}

/**
 * Pool K panels and ask whether two DISJOINT pools of K land on the same side of the
 * pass/fail line. This is the historical question — "did the verdict reproduce" — asked
 * of a K-panel measurement instead of a 1-panel one.
 * `S` is S[icon][panel]; returns per-icon agreement rate over all disjoint K|K splits.
 */
export function poolAgreement(S, m, K) {
  if (!S.length) throw new Error('poolAgreement: empty icon set');
  const P = S[0].length;
  if (2 * K > P) throw new Error(`poolAgreement: ${P} panels cannot make two disjoint pools of ${K}`);
  const idx = [...Array(P).keys()];
  const combos = [];
  const rec = (start, cur) => {
    if (cur.length === K) { combos.push([...cur]); return; }
    for (let i = start; i < P; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  const pairs = [];
  for (let i = 0; i < combos.length; i++) for (let j = i + 1; j < combos.length; j++) {
    if (combos[i].some((v) => combos[j].includes(v))) continue;
    pairs.push([combos[i], combos[j]]);
  }
  if (!pairs.length) throw new Error(`poolAgreement: no disjoint pools of ${K} exist among ${P} panels`);
  return S.map((row) => {
    let ok = 0;
    for (const [A, B] of pairs) {
      const pa = A.reduce((s, k) => s + row[k], 0) / (K * m);
      const pb = B.reduce((s, k) => s + row[k], 0) / (K * m);
      if ((pa >= 2 / 3) === (pb >= 2 / 3)) ok++;
    }
    return { n: pairs.length, agree: ok / pairs.length };
  });
}

/** Wilson score interval — the one that behaves at p = 0 and p = 1, which is exactly
 *  where the icons that DO reproduce live. `neff` lets the plate clustering in. */
export function wilson(hits, n, neff = n) {
  const z = 1.96, p = n ? hits / n : 0;
  const d = 1 + z * z / neff;
  const c = p + z * z / (2 * neff);
  const s = z * Math.sqrt(p * (1 - p) / neff + z * z / (4 * neff * neff));
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN-BAD INPUTS. CLAUDE.md #6 — a guard that has not been shown to FAIL on the bug
// it guards against is not a guard, and a decomposition that cannot tell its two arms
// apart is one of the seven controls this session produced that could not.
// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN && 'selftest' in a) {
  let pass = 0, fail = 0;
  const check = (label, ok, got) => {
    ok ? pass++ : fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}  got ${JSON.stringify(got)}`);
  };
  const near = (x, y, tol) => Math.abs(x - y) <= tol;

  // ── ARM 1: ALL the variance is BETWEEN plates. Judges on a plate agree perfectly;
  //    plates disagree completely. ICC must be 1. A decomposition that reports ~0 here
  //    is reading judge noise as plate noise and would say "3 judges is plenty".
  const allPlate = [];
  for (let i = 0; i < 20; i++) allPlate.push([[1, 1, 1], [0, 0, 0], [1, 1, 1], [0, 0, 0], [1, 1, 1], [0, 0, 0]]);
  check('ALL between-plate variance -> ICC = 1', near(icc(allPlate).rho, 1, 1e-9), icc(allPlate).rho);

  // ── ARM 2: NO plate effect at all. Judges i.i.d. Bernoulli, plates exchangeable.
  //    ICC must sit at ~0. This is the arm that stops the estimator being tautological:
  //    an estimator hard-wired to return 1 passes ARM 1 and must fail here.
  //
  // 🔴 THE FIRST FIXTURE HERE WAS WRONG AND THE SELFTEST CAUGHT IT, WHICH IS THE ONLY
  //    REASON THIS COMMENT EXISTS. It gave every icon the SAME hand-written pattern, so
  //    all six plate means were exactly 2/3, SSB was exactly 0, and the estimator
  //    correctly returned **−0.5** — the theoretical minimum −1/(m−1). That is not "ICC
  //    ≈ 0 with noise"; zero between-plate variance is LESS variable than chance, and a
  //    hand-written fixture cannot produce a chance-level one. It has to be sampled.
  //    Kept as ARM 2b below rather than deleted, because a degenerate input with a known
  //    exact answer is a better guard than a noisy one.
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const noPlate = [];
  for (let i = 0; i < 400; i++) noPlate.push([...Array(6)].map(() => [...Array(3)].map(() => (rnd() < 0.5 ? 1 : 0))));
  check('NO plate effect (i.i.d. judges) -> ICC within 0.10 of 0', Math.abs(icc(noPlate).rho) < 0.10, +icc(noPlate).rho.toFixed(4));

  // ── ARM 2b: ZERO between-plate variance — every plate lands on the same mean by
  //    construction. The estimator must return exactly the floor −1/(m−1) = −0.5, and
  //    `deff` must clamp it to 1 rather than reporting that clustering BUYS precision.
  const flat = [];
  for (let i = 0; i < 40; i++) flat.push([[1, 0, 1], [0, 1, 1], [1, 1, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]]);
  check('ZERO between-plate variance -> ICC is exactly the floor −1/(m−1)', near(icc(flat).rho, -0.5, 1e-12), icc(flat).rho);

  // ── ARM 3: the two arms must ORDER correctly. Either alone can be passed by a
  //    constant; only the ordering shows the estimator responds to the input.
  check('ORDERS: all-plate ICC > no-plate ICC', icc(allPlate).rho > icc(noPlate).rho + 0.5,
    [+icc(allPlate).rho.toFixed(3), +icc(noPlate).rho.toFixed(3)]);

  // ── ARM 4: VACUITY. An empty set, a one-plate design and a one-judge design must all
  //    THROW, not return. `[].every()` is true and 0/0 is NaN; a control that filters a
  //    set to nothing and then reports 0.00 is the failure this repo hit three times.
  const throws = (f) => { try { f(); return false; } catch { return true; } };
  check('an EMPTY icon set is REFUSED, not scored', throws(() => icc([])), true);
  check('a ONE-PLATE design is REFUSED (no between term exists)', throws(() => icc([[[1, 0, 1]]])), true);
  check('a ONE-JUDGE-per-plate design is REFUSED (no within term exists)',
    throws(() => icc([[[1], [0], [1]]])), true);
  check('a RAGGED design is REFUSED rather than silently averaged',
    throws(() => icc([[[1, 0, 1], [0, 1]]])), true);
  check('pairAgreement REFUSES an empty set', throws(() => pairAgreement([], 3)), true);
  check('poolAgreement REFUSES pools it cannot make disjoint', throws(() => poolAgreement([[0, 1, 2]], 3, 2)), true);

  // ── ARM 5: the ARITHMETIC CEILING, checked against hand arithmetic. At p = 0.5 and
  //    m = 3 it is (1 + 9 + 9 + 1)/64 = 20/64. At p = 1 it is 1. If this ever returns 1
  //    for p = 0.5 the whole "the scale cannot express it" finding evaporates.
  check('exact-agreement ceiling at p=0.5, m=3 is 20/64', near(exactAgreeCeiling(0.5, 3), 20 / 64, 1e-12), exactAgreeCeiling(0.5, 3));
  check('a DETERMINISTIC icon reproduces perfectly (p=1 -> 1.00)', near(exactAgreeCeiling(1, 3), 1, 1e-12), exactAgreeCeiling(1, 3));
  check('the ceiling is BELOW 1 in the middle — it is not a tautology',
    exactAgreeCeiling(0.5, 3) < 0.35 && exactAgreeCeiling(0.5, 3) > 0.30, +exactAgreeCeiling(0.5, 3).toFixed(4));

  // ── ARM 6: pairAgreement must separate a REPRODUCING icon from a churning one, and
  //    the pass/fail predicate must be laxer than the exact-score one, never stricter.
  const pa = pairAgreement([[3, 3, 3, 3, 3, 3], [0, 3, 1, 2, 0, 3], [3, 2, 3, 2, 3, 2]], 3);
  check('a 3/3-every-panel icon reproduces exactly 100%', pa[0].exact === 1, pa[0]);
  check('a churning icon does NOT', pa[1].exact < 0.4, +pa[1].exact.toFixed(3));
  check('pass/fail is never STRICTER than exact score', pa.every((r) => r.passfail >= r.exact), pa.map((r) => [+r.exact.toFixed(2), +r.passfail.toFixed(2)]));
  check('an icon that straddles the line at 3-vs-2 still passes/fails alike', pa[2].passfail === 1, pa[2]);

  // ── ARM 7: the panel-count formula must MOVE with the design effect and with the
  //    target, in the right direction and by the right factor. A formula that returned a
  //    constant would pass every arm above.
  check('DEFF at ICC 0 is 1.00', deff(0, 3) === 1, deff(0, 3));
  check('DEFF at ICC 1 with m=3 is 3.00', deff(1, 3) === 3, deff(1, 3));
  check('a NEGATIVE ICC is clamped in DEFF only (never below 1 panel-worth)', deff(-0.4, 3) === 1, deff(-0.4, 3));
  check('halving the target half-width QUADRUPLES the panels',
    near(panelsFor(0.1, 0.2, 3) / panelsFor(0.2, 0.2, 3), 4, 1e-9), +(panelsFor(0.1, 0.2, 3) / panelsFor(0.2, 0.2, 3)).toFixed(6));
  check('clustering makes panels MORE expensive, never less', panelsFor(0.15, 0.4, 3) > panelsFor(0.15, 0.0, 3),
    [+panelsFor(0.15, 0.4, 3).toFixed(2), +panelsFor(0.15, 0.0, 3).toFixed(2)]);

  // ── ARM 8: Wilson must behave at the ends, which is exactly where the icons that DO
  //    reproduce live, and a naive normal interval is degenerate there.
  check('Wilson at 18/18 does NOT collapse to a point', wilson(18, 18)[0] < 1 && wilson(18, 18)[0] > 0.7,
    wilson(18, 18).map((v) => +v.toFixed(3)));
  check('Wilson at 0/18 does NOT collapse to a point', wilson(0, 18)[1] > 0 && wilson(0, 18)[1] < 0.3,
    wilson(0, 18).map((v) => +v.toFixed(3)));
  check('a smaller EFFECTIVE n widens the interval', (wilson(9, 18, 9)[1] - wilson(9, 18, 9)[0]) > (wilson(9, 18, 18)[1] - wilson(9, 18, 18)[0]),
    [+(wilson(9, 18, 9)[1] - wilson(9, 18, 9)[0]).toFixed(3), +(wilson(9, 18, 18)[1] - wilson(9, 18, 18)[0]).toFixed(3)]);

  console.log(`\nxr_repro selftest ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

if (!IS_MAIN) { /* imported: expose the pure core only */ } else {

// ─────────────────────────────────────────────────────────────────────────────
// THE RUN.
// ─────────────────────────────────────────────────────────────────────────────
const dir = a.dir ?? 'shots/ic/xrk';
const plates = (a.plates ?? 'p101,p102,p103,p104,p105,p106').split(',').map((s) => s.trim()).filter(Boolean);
const M = Number(a.judges ?? 3);

/** Read one sheet into Map<tileIndex, rawAnswer>. */
function sheet(path) {
  const m = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue;
    const mm = line.match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
    if (mm) m.set(Number(mm[1]), mm[2]);
  }
  return m;
}

const faults = [];
const perPlate = [];       // [{ plate, key, judges: [{id, ans}] }]
for (const p of plates) {
  const keyPath = join(dir, `${p}.key.json`);
  if (!existsSync(keyPath)) { faults.push(`${p}: no key at ${keyPath}`); continue; }
  const key = JSON.parse(readFileSync(keyPath, 'utf8'));
  const jdir = join(dir, p);
  const files = existsSync(jdir) ? readdirSync(jdir).filter((f) => /^ans_.+\.txt$/.test(f)).sort() : [];
  if (files.length !== M) faults.push(`${p}: ${files.length} answer sheet(s), expected ${M}`);
  perPlate.push({ plate: p, key, judges: files.map((f) => ({ id: f.replace(/^ans_|\.txt$/g, ''), ans: sheet(join(jdir, f)) })) });
}
if (faults.length) { console.log('🔴 INPUT INVALID:\n  ' + faults.join('\n  ')); process.exit(1); }

// ── The icon set. A twinned icon contributes its FIRST tile as the datum; the second
//    tile is the FLOOR CONTROL and is scored separately, never pooled into the score.
const icons = [...new Set(perPlate[0].key.plan.filter((t) => t.twin !== 2).map((t) => t.name))].sort();
if (!icons.length) { console.log('🔴 no icons after filtering — refusing to report over an empty set'); process.exit(1); }
for (const pp of perPlate) {
  const s = [...new Set(pp.key.plan.filter((t) => t.twin !== 2).map((t) => t.name))].sort();
  if (JSON.stringify(s) !== JSON.stringify(icons)) faults.push(`${pp.plate}: icon set differs from ${perPlate[0].plate}`);
}
if (faults.length) { console.log('🔴 PLATES NOT COMPARABLE:\n  ' + faults.join('\n  ')); process.exit(1); }

// x[icon][plate][judge] ∈ {0,1}
const X = icons.map((name) => perPlate.map((pp) => {
  const tile = pp.key.plan.find((t) => t.name === name && t.twin !== 2);
  return pp.judges.map((j) => (subjectOf(j.ans.get(tile.i)) === name ? 1 : 0));
}));
const S = X.map((rows) => rows.map((r) => r.reduce((s, v) => s + v, 0)));

// ── TWIN FLOOR, per plate: identical pixels, two tiles, ONE judge. Not a guess and not
//    borrowed. `ic_pair.mjs`: a legible twin's floor does NOT apply to a failing subject,
//    so the twins must BRACKET or the round has no floor for one kind of subject.
const twinNames = perPlate[0].key.twins ?? [];
const twinRows = [];
for (const pp of perPlate) {
  for (const n of twinNames) {
    const ts = pp.key.plan.filter((t) => t.name === n);
    if (ts.length !== 2) continue;
    for (const j of pp.judges) {
      const g = ts.map((t) => subjectOf(j.ans.get(t.i)) ?? `?${j.ans.get(t.i) ?? '(blank)'}`);
      // `posA`/`posB` are the SAME ART at two grid positions. Scoring them separately is
      // what turns the twin control from "did the judge agree with itself" into a direct
      // measurement of the plate's own POSITION effect — the thing that makes a panel
      // score depend on which shuffle it was drawn from.
      twinRows.push({
        plate: pp.plate, judge: j.id, name: n, given: g,
        agree: g[0] === g[1], hit: g.every((v) => v === n),
        posA: g[0] === n ? 1 : 0, posB: g[1] === n ? 1 : 0,
      });
    }
  }
}

const R = icc(X);
const D = deff(R.rho, R.m);
const nJudges = R.P * R.m;

console.log(`XR REPRODUCIBILITY — ${icons.length} icons × ${R.P} independent panels × ${R.m} judges = ${icons.length * nJudges} judgements`);
console.log(`protocol: NATIVE (nozoom), one look, delivered size — every panel identical\n`);

// ── 1. THE FLOOR ────────────────────────────────────────────────────────────
console.log('── 1. VARIANCE DECOMPOSITION (pooled one-way ANOVA, clusters = PLATES) ──');
console.log(`  MSB ${R.msb.toFixed(4)} (df ${R.dfB})   MSW ${R.msw.toFixed(4)} (df ${R.dfW})`);
console.log(`  ICC (intra-plate correlation)   ρ = ${R.rho.toFixed(4)}`);
console.log(`  DESIGN EFFECT                   1 + (m−1)ρ = ${D.toFixed(3)}`);
console.log(`  → ${R.m} judges on one plate are worth ${(R.m / D).toFixed(2)} independent judges.`);

// ── 2. THE ARITHMETIC CEILING ───────────────────────────────────────────────
console.log('\n── 2. THE CEILING, BEFORE ANY NOISE ────────────────────────────────────');
console.log('  P(two PERFECT-instrument panels report the same 0..3 score), by true legibility p:');
for (const p of [0.1, 0.25, 0.5, 0.75, 0.9, 1.0]) {
  console.log(`     p = ${p.toFixed(2)}   ${(100 * exactAgreeCeiling(p, R.m)).toFixed(1)}%`);
}
console.log('  A 3-judge panel has FOUR possible values and a sampling SD of 0.87 at p=0.5.');
console.log('  Exact reproduction in the middle is arithmetically unavailable, not badly measured.');

// ── 3. MEASURED REPRODUCIBILITY ─────────────────────────────────────────────
const PA = pairAgreement(S, R.m);
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
console.log(`\n── 3. MEASURED, over all ${PA[0].n} unordered pairs of the ${R.P} panels ──────────`);
console.log(`  same EXACT 0..3 score       ${(100 * mean(PA.map((r) => r.exact))).toFixed(1)}%   (ceiling at each icon's own p: ${(100 * mean(icons.map((_, i) => exactAgreeCeiling(S[i].reduce((s, v) => s + v, 0) / nJudges, R.m)))).toFixed(1)}%)`);
console.log(`  same PASS/FAIL verdict      ${(100 * mean(PA.map((r) => r.passfail))).toFixed(1)}%`);
const repro = icons.filter((_, i) => PA[i].exact === 1);
const reproPF = icons.filter((_, i) => PA[i].passfail === 1);
console.log(`  icons whose EXACT score reproduced across ALL ${PA[0].n} pairs: ${repro.length} of ${icons.length}`);
console.log(`  icons whose PASS/FAIL reproduced across ALL ${PA[0].n} pairs:    ${reproPF.length} of ${icons.length}`);

// ── 4. POOLING PANELS ───────────────────────────────────────────────────────
console.log('\n── 4. DOES POOLING PANELS FIX IT? (two DISJOINT pools, pass/fail verdict) ──');
for (let K = 1; 2 * K <= R.P; K++) {
  const PO = poolAgreement(S, R.m, K);
  const all = icons.filter((_, i) => PO[i].agree === 1).length;
  console.log(`  K = ${K} panel(s) (${K * R.m} judges)   mean agreement ${(100 * mean(PO.map((r) => r.agree))).toFixed(1)}%   icons agreeing on every split: ${all} of ${icons.length}`);
}

// ── 5. WHAT IT WOULD COST ───────────────────────────────────────────────────
console.log('\n── 5. PANELS NEEDED FOR A STATED RESOLUTION (worst case p = 0.5) ───────');
for (const [label, h] of [['±1 judge of 3 (h = 0.333)', 1 / 3], ['±0.5 judge of 3 (h = 0.167)', 1 / 6], ['±0.25 judge of 3 (h = 0.083)', 1 / 12]]) {
  const k = panelsFor(h, R.rho, R.m);
  console.log(`  ${label.padEnd(30)} K = ${Math.ceil(k)} panels = ${Math.ceil(k) * R.m} judges`);
}

// ── 6. PER-ICON, ordered by how well it reproduced ──────────────────────────
// 🔴 WAS `HITS/18` AND `${r.hits}/18`, HARDCODED AT THE 6-PANEL DESIGN. The moment the
//    design grew to 9 panels this printed `avatar 19/18` and `boxPineapple 18/18 p̂ 0.67`
//    — a denominator that disagreed with the ratio printed beside it. Kept in words
//    because it is this file's own instance of the fault it was written to find.
console.log(`\n── 6. PER ICON — ${nJudges} judges, Wilson 95% CI widened by the design effect ──`);
console.log('ICON'.padEnd(15) + `HITS/${nJudges}`.padEnd(9) + 'p̂     95% CI          panels 3/3 2/3 1/3 0/3   exact-repro  VERDICT');
const rows = icons.map((name, i) => {
  const hits = S[i].reduce((s, v) => s + v, 0);
  const p = hits / nJudges;
  const ci = wilson(hits, nJudges, nJudges / D);
  const dist = [0, 0, 0, 0];
  for (const s of S[i]) dist[s]++;
  // The three bands. A verdict is only claimed where the whole interval is on one side.
  const v = ci[0] >= 2 / 3 ? 'CLOSED' : ci[1] <= 1 / 3 ? 'BROKEN' : 'UNRESOLVED';
  return { name, hits, p, ci, dist, exact: PA[i].exact, v };
});
for (const r of rows.sort((x, y) => x.p - y.p || x.name.localeCompare(y.name))) {
  console.log(r.name.padEnd(15) + `${r.hits}/${nJudges}`.padEnd(9) + r.p.toFixed(2).padEnd(6)
    + `[${r.ci[0].toFixed(2)},${r.ci[1].toFixed(2)}]`.padEnd(16)
    + `${r.dist[3]}   ${r.dist[2]}   ${r.dist[1]}   ${r.dist[0]}`.padEnd(22)
    + `${(100 * r.exact).toFixed(0)}%`.padEnd(13) + r.v);
}
const byV = (v) => rows.filter((r) => r.v === v);
console.log(`\n  CLOSED ${byV('CLOSED').length}  ·  BROKEN ${byV('BROKEN').length}  ·  UNRESOLVED ${byV('UNRESOLVED').length}   (of ${icons.length})`);
console.log(`  BROKEN: ${byV('BROKEN').map((r) => `${r.name} ${r.hits}/${nJudges}`).join(', ') || 'none'}`);

// ── 7. THE TWIN FLOOR ───────────────────────────────────────────────────────
console.log('\n── 7. TWIN FLOOR — identical pixels, two tiles, ONE judge ──────────────');
const byIcon = new Map();
for (const t of twinRows) {
  const v = byIcon.get(t.name) ?? { n: 0, split: 0, hit: 0, a: 0, b: 0 };
  v.n++; if (!t.agree) v.split++; if (t.hit) v.hit++; v.a += t.posA; v.b += t.posB;
  byIcon.set(t.name, v);
}
console.log('  TWIN       splits    tile A    tile B   |Δ|   kind');
for (const [n, v] of byIcon) {
  const kind = v.hit === v.n ? 'LEGIBLE (floor for a PASSING subject)' : v.hit ? 'MARGINAL' : 'ILLEGIBLE (floor for a FAILING subject)';
  console.log(`  ${n.padEnd(10)} ${`${v.split}/${v.n}`.padEnd(9)} ${`${v.a}/${v.n}`.padEnd(9)} ${`${v.b}/${v.n}`.padEnd(8)} ${String(Math.abs(v.a - v.b)).padEnd(5)} ${kind}`);
}
console.log('  🔴 tile A and tile B are BYTE-IDENTICAL ART. Any |Δ| above zero is the PLATE');
console.log('     scoring the same drawing two ways in ONE judge\'s ONE pass — the position');
console.log('     effect, measured directly rather than inferred from between-round swing.');
const vals = [...byIcon.values()];
if (!vals.some((v) => v.hit === 0) || !vals.some((v) => v.hit === v.n)) {
  console.log('  ⚠️  the twins do not BRACKET — this round has no floor for one kind of subject');
}
console.log(`\n  POOLED: ${twinRows.filter((t) => !t.agree).length} of ${twinRows.length} twin readings split on IDENTICAL art.`);

// ── 8. IS LEGIBILITY A PROPERTY OF THE DRAWING, OR OF THE DELIVERED SIZE? ──
//
// Every icon pass in this repo has spent its variables on the DRAWING — silhouette,
// clasp dominance, lid overhang, trail colour, which diagonal — and `src/ui/icons/`
// records six consecutive Δ +0s for that programme. The spec carries a second variable
// nobody has regressed on: `px`, the size the SITE delivers the glyph at, which lives in
// `src/ui/screens/` and not in the icon files at all.
//
// Both numbers are of the SAME KIND on each side of this comparison — a per-icon
// proportion against a per-icon CSS px — which is the check `AGENT-BRIEF` §4 demands
// after two arms of one instrument were false by construction for comparing a rendered
// frame's luma against a material's colour.
console.log('\n── 8. LEGIBILITY vs DELIVERED SIZE (the variable that is NOT in the icon files) ──');
{
  const pts = rows.map((r) => {
    const t = perPlate[0].key.plan.find((q) => q.name === r.name && q.twin !== 2);
    return { name: r.name, px: t.px, p: r.p };
  });
  const bands = [[0, 12], [12, 14], [14, 18], [18, 24], [24, 99]];
  console.log('  delivered px    icons   mean legibility   0/N icons');
  for (const [lo, hi] of bands) {
    const b = pts.filter((q) => q.px >= lo && q.px < hi);
    if (!b.length) continue;
    const mp = b.reduce((s, q) => s + q.p, 0) / b.length;
    console.log(`  ${`${lo.toFixed(1)}–${hi === 99 ? '∞' : hi.toFixed(1)}`.padEnd(15)} ${String(b.length).padEnd(7)} ${mp.toFixed(3).padEnd(17)} ${b.filter((q) => q.p === 0).length}`);
  }
  // Pearson r between delivered px and legibility. Reported with its own caveat: it is a
  // correlation over 63 icons that differ in a hundred ways, not an experiment.
  const n = pts.length;
  const mx = pts.reduce((s, q) => s + q.px, 0) / n, my = pts.reduce((s, q) => s + q.p, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const q of pts) { sxy += (q.px - mx) * (q.p - my); sxx += (q.px - mx) ** 2; syy += (q.p - my) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy);
  console.log(`\n  Pearson r(delivered px, legibility) = ${r.toFixed(3)} over ${n} icons`);
  console.log(`  ⚠️  A CORRELATION OVER 63 ICONS THAT DIFFER IN EVERY OTHER WAY. It is a pointer at`);
  console.log('     a variable, not an experiment on it — the experiment is one icon at two sizes.');
}

// ── 9. AGGREGATE, for comparison with the historical rounds ─────────────────
console.log('\n── 9. AGGREGATE per panel (comparable with the native rounds r8–r13) ───');
for (let p = 0; p < R.P; p++) {
  const tot = icons.reduce((s, _, i) => s + X[i][p].reduce((t, v) => t + v, 0), 0);
  const per = perPlate[p].judges.map((_, j) => icons.reduce((s, _, i) => s + X[i][p][j], 0));
  console.log(`  ${perPlate[p].plate}  ${per.join('/')} = ${tot}/${icons.length * R.m} = ${(100 * tot / (icons.length * R.m)).toFixed(1)}%`);
}
}
