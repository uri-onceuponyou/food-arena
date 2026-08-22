#!/usr/bin/env node
/**
 * FX_AB — pair two `fx_flat` sheets and print the PAIRED per-case delta.
 *
 * ⚠️ **A PAIRED DELTA IS A DIFFERENT QUANTITY FROM AN AGGREGATE AND MUST BE REPORTED
 * SEPARATELY** (CLAUDE.md #10). Both arms are frozen frames on the same seed, the same
 * slice and the same ablation, so a per-case delta here is EXACT — there is no
 * resolution floor to clear. A median across cases is NOT exact and is labelled as the
 * summary statistic it is.
 *
 * ⚠️ It also refuses a pair whose reference arm moved: the `figures` row is the same
 * lit geometry in both trees, so if IT moved the two arms are not a single-variable
 * pair and every VFX delta below is confounded. That check is the reason this file
 * exists rather than two `cat`s.
 *
 *   node tools/tmp/fx_ab.mjs shots/fx/A/A.p58.json shots/fx/B/B.p58.json
 */
import { readFile } from 'node:fs/promises';
const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) { console.error('usage: fx_ab.mjs <before.json> <after.json>'); process.exit(2); }
const A = JSON.parse(await readFile(aPath, 'utf8'));
const B = JSON.parse(await readFile(bPath, 'utf8'));
/**
 * ⚠️ **`peakGain` IS PRINTED AND MUST NOT BE READ AS A PAIRED DELTA.** It is
 * `peakL - basePeakL`, and `basePeakL` is a max over the MASK INTERIOR — so when the
 * effect changes, the mask changes, and the "underneath" being subtracted is a
 * different set of pixels in the two arms. Measured on this very pair:
 * `impact.lollipop.Smash` reads `peakGain 20.0 -> 0.7` while its `peakL` goes
 * **223.6 -> 247.7**, because `basePeakL` moved 203.6 -> 247.0 under a mask that grew
 * 3948 -> 4033. `peakGain` is a WITHIN-ARM diagnostic — "is this effect adding light to
 * its own footprint or taking it away" — and `peakL`/`p999L` are the columns that
 * survive a cross-arm comparison.
 */
const cols = [['maskPx', 0], ['flatShare', 3], ['meanGrad', 2], ['stepRatio', 3], ['falloffR', 3], ['segRatio', 3], ['coreDrop', 3], ['p999L', 1], ['peakL', 1], ['peakGain', 1], ['hotPx', 0]];
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
console.log(`\npitch ${A.pitch}   ${aPath}  ->  ${bPath}`);
console.log(pad('case', 28) + cols.map(([c]) => rp(c, 22)).join(''));
const keys = Object.keys(A.results).filter((k) => B.results[k]);
if (!keys.length) { console.error('fx_ab: no shared cases — the two sheets do not describe the same run'); process.exit(1); }
const meds = {};
for (const k of keys) {
  const a = A.results[k]; const b = B.results[k];
  if (a.vacuous || b.vacuous) { console.log(`${pad(k, 28)}  VACUOUS in one arm`); continue; }
  let line = pad(k, 28);
  for (const [c, d] of cols) {
    const av = a[c]; const bv = b[c];
    const s = `${av.toFixed(d)}->${bv.toFixed(d)}`;
    line += rp(s, 22);
    // `figures` is the LIT-GEOMETRY control and `ctrl.*` are VFX rows that the change
    // under test cannot reach (see `fx_flat.mjs`'s `ctrl.generic.hamburger.Smash`).
    // Neither belongs in a median of "how far did the treated cases move" — a row that
    // cannot move drags that summary toward zero and makes a real effect look smaller
    // than it is, which is the same mistake as averaging a null arm into a result.
    if (k !== 'figures' && !k.startsWith('ctrl.')) (meds[c] ??= []).push(bv - av);
  }
  console.log(line);
}
const med = (xs) => { const s = [...xs].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
console.log('\nMEDIAN PAIRED DELTA over ' + meds.flatShare.length + ' VFX cases (a summary of exact per-case deltas, not itself exact):');
for (const [c, d] of cols) console.log(`  ${pad(c, 12)} ${med(meds[c]) >= 0 ? '+' : ''}${med(meds[c]).toFixed(d + 1)}`);
/**
 * ⚠️ **THE BAR WAS EXACT EQUALITY AND THAT WAS TOO TIGHT.** Old wording kept per house
 * style: *"the `figures` row is the same lit geometry in both trees, so if IT moved the
 * two arms are not a single-variable pair"* — right, and `!==` is the wrong test of it.
 * At pitch 58 the reference arm came back bit-identical on every column; at pitch 20 it
 * came back `34.8550` vs `34.8552` and `5.3622` vs `5.3623`, i.e. **the fifth
 * significant figure of a sum over 16k pixels**, and the control reported "NOT a
 * single-variable pair" on a pair that differed in one file. `maskPx`, `interiorPx`,
 * `boundaryPx`, `flatShare`, `meanGrad` and `segRatio` were all identical.
 *
 * That residue is the renderer's own run-to-run jitter under SwiftShader, and it is
 * FOUR ORDERS OF MAGNITUDE below the smallest delta this file exists to report
 * (the median `flatShare` move is -0.09, i.e. ~10^-1). The bar is now a relative 1e-4
 * and the worst column's actual relative difference is PRINTED, so a control that has
 * quietly gone slack is visible rather than inferred.
 */
/**
 * ── ⚠️ 1e-4 WAS MEASURED WITHIN ONE `sx_snap` SESSION AND IT IS THE WRONG SCALE FOR
 *    A PAIR THAT SPANS TWO. Old value kept above; here is what settled it: ────────
 *
 * Two nulls, both on trees that did not change at all:
 *
 *   SAME SESSION   `fx_flat` twice inside ONE `sx_snap` (one frozen snapshot, two
 *                  browsers): **EXACT on every column of all twelve cases**, controls
 *                  included. There is no drift to speak of here.
 *   ACROSS SESSIONS  the SAME worktree measured in two separate `sx_snap` invocations:
 *                  `figures.meanGrad` 8.28134 -> 8.28418 (3.4e-4), `figures.falloffR`
 *                  0.0601218 -> 0.0601572 (**5.9e-4**), `figures.segRatio` 3.141452 ->
 *                  3.142528 (3.4e-4), and `ctrl.generic.hamburger.Smash.maskPx`
 *                  **8867 -> 8866**, one pixel, 1.1e-4.
 *
 * At 1e-4 the second null reports *"the arms are NOT a single-variable pair"* and
 * *"the change reached a path it does not claim"* — **on a pair with no change in it**,
 * which is exactly the cried-wolf failure `CLAUDE.md` warns a guard dies of. And a
 * before/after pair here is ALWAYS cross-session: the two arms are two worktrees.
 *
 * 1.5e-3 is 2.5x the worst MEASURED cross-session RELATIVE move rather than a round
 * number, and the worst actual move is printed on every run so a control that has gone
 * slack is visible rather than inferred.
 *
 * ── 🚨 AND A RELATIVE BAR IS THE WRONG SCALE FOR A BOUNDED STATISTIC. ASK WHAT THE
 *    NUMBER *IS* FIRST (`CLAUDE.md` #10's own wording). ─────────────────────────────
 *
 * `falloffR` is a PEARSON r. It lives in [-1, 1] and on the reference arm it sits near
 * zero — 0.060 at pitch 58 and **0.0036 at pitch 20**. Dividing a fixed jitter by 0.0036
 * manufactures a 2.0e-2 "relative move" out of an absolute one of **7.6e-5**, and no
 * relative tolerance loose enough to pass that is tight enough to be a control. It went
 * red on the pitch-20 pair for exactly this reason and the movement was noise.
 *
 * So bounded columns get an ABSOLUTE bar, set from the measurement rather than chosen:
 * the same-tree cross-session null moved `figures.falloffR` by **3.5e-5** absolute, and
 * the pitch-20 pair by 7.6e-5. 1e-3 is ~13x the largest of those and an order of
 * magnitude below the smallest move this file is used to argue from.
 */
const CTRL_REL_TOL = 1.5e-3;
/** Columns whose value is bounded (a share, or a correlation in [-1,1]) and therefore
 * compared on an ABSOLUTE difference — see the block above. */
const CTRL_ABS_COLS = new Set(['flatShare', 'falloffR']);
const CTRL_ABS_TOL = 1e-3;
/** True when column `c` moved further than its own kind of tolerance allows. */
const ctrlMoved = (c, x, y) => (CTRL_ABS_COLS.has(c)
  ? Math.abs(x - y) > CTRL_ABS_TOL
  : Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y), 1e-9) > CTRL_REL_TOL);
const fa = A.results.figures; const fb = B.results.figures;
if (fa && fb && !fa.vacuous && !fb.vacuous) {
  const rel = (c) => {
    const d = Math.abs(fa[c] - fb[c]);
    const scale = Math.max(Math.abs(fa[c]), Math.abs(fb[c]), 1e-9);
    return d / scale;
  };
  // The worst column is reported in the units its OWN bar is in — printing a relative
  // figure next to a decision taken on an absolute one reads as a near-miss when it is
  // not one (pitch 20's `falloffR` prints 2.0e-2 relative for a 7.6e-5 absolute move).
  const worstOf = (c) => (CTRL_ABS_COLS.has(c) ? Math.abs(fa[c] - fb[c]) : rel(c));
  const scaled = cols.map(([c]) => [c, worstOf(c) / (CTRL_ABS_COLS.has(c) ? CTRL_ABS_TOL : CTRL_REL_TOL), worstOf(c), CTRL_ABS_COLS.has(c) ? 'abs' : 'rel']);
  const worst = scaled.sort((x, y) => y[1] - x[1])[0];
  const moved = cols.filter(([c]) => ctrlMoved(c, fa[c], fb[c])).map(([c]) => c);
  const exact = cols.every(([c]) => fa[c] === fb[c]);
  console.log(`\nCONTROL — the reference arm (same lit geometry in both trees): `
    + (moved.length
      ? `🔴 MOVED on ${moved.join(',')} — the arms are NOT a single-variable pair`
      : exact
        ? '✅ EXACTLY unchanged on every column'
        : `✅ inside its bar on every column (worst: ${worst[0]} at ${worst[2].toExponential(1)} ${worst[3]}, ${(worst[1] * 100).toFixed(0)}% of its tolerance — renderer jitter, not a second variable)`));
  if (moved.length) process.exitCode = 1;
}

/**
 * ── THE SECOND CONTROL: a VFX row the change under test CANNOT REACH ────────────
 *
 * `figures` proves the two arms share a scene. It does NOT prove the change stayed
 * inside the code path it claims to be in, because it is not drawn by `vfx.ts` at all.
 * A `ctrl.*` row is: same layer, same materials, same ablation, same slice — a weapon
 * with no bespoke `impact()` hook, i.e. the GENERIC anchor path. Nothing that scopes
 * itself to the bespoke branch may move it.
 *
 * Same relative bar as the reference arm and for the same measured reason: under
 * SwiftShader a re-render's fifth significant figure moves on its own, and an exact
 * `!==` reported "NOT a single-variable pair" on a pair that differed in one file.
 *
 * ⚠️ **NON-VACUITY FIRST.** A sheet with no `ctrl.*` row at all would make this arm
 * `[].every()`-true — it is announced as ABSENT instead, so a missing control is
 * visible rather than silently green (`CLAUDE.md` rule 6).
 */
const ctrlKeys = keys.filter((k) => k.startsWith('ctrl.'));
if (!ctrlKeys.length) {
  console.log('\nCONTROL — no `ctrl.*` row in this pair: ⚠️ ABSENT, not passed. Re-run `fx_flat` from a tree that has one.');
} else {
  const bad = [];
  for (const k of ctrlKeys) {
    const a = A.results[k]; const b = B.results[k];
    if (a.vacuous || b.vacuous) { bad.push(`${k} (vacuous in one arm)`); continue; }
    for (const [c] of cols) {
      if (ctrlMoved(c, a[c], b[c])) bad.push(`${k}.${c} ${a[c]} -> ${b[c]}`);
    }
  }
  console.log(`\nCONTROL — the untreated VFX arm (${ctrlKeys.join(', ')}): `
    + (bad.length
      ? `🔴 MOVED on ${bad.join(' · ')} — the change reached a path it does not claim`
      : '✅ inside its bar on every column'));
  if (bad.length) process.exitCode = 1;
}
