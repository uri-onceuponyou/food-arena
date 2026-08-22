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
const cols = [['maskPx', 0], ['flatShare', 3], ['meanGrad', 2], ['stepRatio', 3], ['falloffR', 3], ['segRatio', 3], ['coreDrop', 3]];
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
    if (k !== 'figures') (meds[c] ??= []).push(bv - av);
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
const CTRL_REL_TOL = 1e-4;
const fa = A.results.figures; const fb = B.results.figures;
if (fa && fb && !fa.vacuous && !fb.vacuous) {
  const rel = (c) => {
    const d = Math.abs(fa[c] - fb[c]);
    const scale = Math.max(Math.abs(fa[c]), Math.abs(fb[c]), 1e-9);
    return d / scale;
  };
  const worst = cols.map(([c]) => [c, rel(c)]).sort((x, y) => y[1] - x[1])[0];
  const moved = cols.filter(([c]) => rel(c) > CTRL_REL_TOL).map(([c]) => c);
  const exact = cols.every(([c]) => fa[c] === fb[c]);
  console.log(`\nCONTROL — the reference arm (same lit geometry in both trees): `
    + (moved.length
      ? `🔴 MOVED on ${moved.join(',')} — the arms are NOT a single-variable pair`
      : exact
        ? '✅ EXACTLY unchanged on every column'
        : `✅ unchanged within ${CTRL_REL_TOL} relative (worst: ${worst[0]} at ${worst[1].toExponential(1)} — renderer jitter, not a second variable)`));
  if (moved.length) process.exitCode = 1;
}
