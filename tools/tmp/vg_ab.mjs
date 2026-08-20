#!/usr/bin/env node
/**
 * VG_AB — JOIN TWO `vg_frame.mjs` RUNS INTO ONE VERDICT, WITH THE FLOOR STATED FIRST.
 *
 * Renders nothing, opens no browser, and **there is no number in here that is not read
 * out of the two JSONs**. That is deliberate: `wv_report.mjs` is built the same way for
 * the same reason — a joiner that can compute is a joiner that can quietly disagree with
 * its own data.
 *
 * ── THE RULE, STATED BEFORE THE ANSWER (CLAUDE.md #10) ─────────────────────────
 *
 * Each arm carries its OWN measured floor: the range of that metric across N passes of
 * the identical scene on the identical tree, which sweeps the PRNG seed and the VFX
 * pools' round-robin phase together. The bar for a between-tree difference is
 *
 *     |after - before|  >  floor(before) + floor(after)
 *
 * — the sum, not either one, because both arms carry the noise independently. A
 * difference inside that band is reported as **INSIDE FLOOR** and is **not a finding**,
 * however suggestive its sign.
 *
 * 🔴 **AND AREA IS NOT THE VERDICT.** `wv_report.mjs` records the measurement that
 * settles this: delivered area's rank correlation with legibility is **0.230**, against
 * the weapon's own lightness at **-0.738**. So area is printed for context and the
 * legibility columns — `dLuma` (the effect against the exact substrate it landed on) and
 * `struct` (internal edge energy per painted pixel) — are what "does it read worse"
 * is judged on, together with `vfx.ts`'s own hue-contract rule 2 (cast repaint).
 *
 *   node tools/tmp/vg_ab.mjs --before shots/vg/before.desktop.p58.json \
 *                            --after  shots/vg/after.desktop.p58.json
 *   node tools/tmp/vg_ab.mjs --dir shots/vg --profile desktop --pitch 58
 */
import { readFile } from 'node:fs/promises';

function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const DIR = String(arg('dir', 'shots/vg'));
const PROFILE = String(arg('profile', 'desktop'));
const PITCH = String(arg('pitch', '58'));
const A_PATH = String(arg('before', `${DIR}/before.${PROFILE}.p${PITCH}.json`));
const B_PATH = String(arg('after', `${DIR}/after.${PROFILE}.p${PITCH}.json`));

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);

const load = async (p) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch (e) { return { __err: String(e) }; } };

const main = async () => {
  const A = await load(A_PATH);
  const B = await load(B_PATH);
  if (A.__err) { log(`cannot read ${A_PATH}: ${A.__err}`); process.exitCode = 2; return; }
  if (B.__err) { log(`cannot read ${B_PATH}: ${B.__err}`); process.exitCode = 2; return; }

  log('══════════════════════════════════════════════════════════════════════════════');
  log(` MATCH-FRAME A/B — ${A.label} vs ${B.label} · ${A.profile} · pitch ${A.pitch}`);
  log('══════════════════════════════════════════════════════════════════════════════');

  // ── The comparability preconditions, checked rather than assumed ──────────────
  const bad = [];
  if (A.profile !== B.profile || A.pitch !== B.pitch) bad.push(`profile/pitch differ: ${A.profile}/p${A.pitch} vs ${B.profile}/p${B.pitch}`);
  if (JSON.stringify(A.roster) !== JSON.stringify(B.roster)) bad.push('roster differs');
  if (A.delta !== B.delta) bad.push(`change threshold differs (${A.delta} vs ${B.delta})`);
  if (JSON.stringify(A.slices) !== JSON.stringify(B.slices)) bad.push('slice schedule differs');
  if (JSON.stringify(A.buffers?.drawingBuffer) !== JSON.stringify(B.buffers?.drawingBuffer)) {
    bad.push(`DRAWING BUFFER DIFFERS: ${A.buffers?.drawingBuffer} vs ${B.buffers?.drawingBuffer}`);
  }
  // 🚨 The seated positions must match, or every pixel difference below is a different
  // WORLD and not a different renderer. `3483d23` and `b2be2f7` change SIM behaviour
  // inside this window, which is exactly why the sim is held still and why this is
  // checked instead of trusted.
  let maxSeatDelta = 0;
  if (A.fighters && B.fighters && A.fighters.length === B.fighters.length) {
    for (let i = 0; i < A.fighters.length; i++) {
      const d = Math.hypot(A.fighters[i].x - B.fighters[i].x, A.fighters[i].y - B.fighters[i].y);
      if (d > maxSeatDelta) maxSeatDelta = d;
      if (A.fighters[i].id !== B.fighters[i].id) bad.push(`slot ${i} is ${A.fighters[i].id} vs ${B.fighters[i].id}`);
    }
  } else bad.push('fighter lists are not the same length');

  log(`\n══ COMPARABILITY ═══════════════════════════════════════════════════════════`);
  log(`  drawing buffer   ${A.buffers?.drawingBuffer?.join('x')}  vs  ${B.buffers?.drawingBuffer?.join('x')}`);
  log(`  renderer pixel ratio ${A.buffers?.rendererPixelRatio} vs ${B.buffers?.rendererPixelRatio} · dPR ${A.buffers?.devicePixelRatio} vs ${B.buffers?.devicePixelRatio}`);
  log(`  max seat position delta  ${maxSeatDelta.toFixed(2)} wu  (want ~0 — otherwise the two arms are different WORLDS)`);
  log(`  DRIFT ${A.controls?.drift?.n} / ${B.controls?.drift?.n} px · DRIFT-GAP ${A.controls?.drift?.gapN} / ${B.controls?.drift?.gapN} px  (want 0 on all four)`);
  const faultsA = (A.faults ?? []).length, faultsB = (B.faults ?? []).length;
  log(`  control faults   before ${faultsA} · after ${faultsB}`);
  for (const f of A.faults ?? []) log(`    before 🔴 ${f}`);
  for (const f of B.faults ?? []) log(`    after  🔴 ${f}`);
  for (const x of bad) log(`  🔴 ${x}`);
  if (bad.length || faultsA || faultsB) {
    log(`\n🔴 NOT QUOTABLE. Fix the above before reading anything below as a result.`);
    process.exitCode = 1;
  }

  const names = [...new Set([...Object.keys(A.scenes ?? {}), ...Object.keys(B.scenes ?? {})])];
  if (!names.length) { log('\nno scenes in either run'); process.exitCode = 2; return; }

  let findings = 0;
  for (const name of names) {
    const a = A.scenes[name], b = B.scenes[name];
    log(`\n══ ${name} ═════════════════════════════════════════════════════════════`);
    if (!a || !b) { log(`  🔴 present in only one arm`); continue; }
    log(`  ${a.what}`);
    if (!a.peak || !b.peak) { log(`  🔴 one arm delivered NOTHING — a null here is vacuous, not a result`); continue; }
    log(`  events reached: ${a.eventsReached}/${a.events} before · ${b.eventsReached}/${b.events} after`);

    // ── Paired slice-by-slice, then the peak ──────────────────────────────────
    log(`\n  ${pad('ms', 6)}${rp('px before', 11)}${rp('px after', 10)}${rp('delta', 9)}${rp('dL before', 11)}${rp('dL after', 10)}${rp('st before', 11)}${rp('st after', 10)}`);
    const bySlice = new Map();
    for (const s of a.series) bySlice.set(s.ms, { a: s });
    for (const s of b.series) bySlice.set(s.ms, { ...(bySlice.get(s.ms) ?? {}), b: s });
    for (const [ms, r] of bySlice) {
      const an = r.a?.empty ? 0 : (r.a?.n ?? 0);
      const bn = r.b?.empty ? 0 : (r.b?.n ?? 0);
      log(`  ${pad(ms, 6)}${rp(an, 11)}${rp(bn, 10)}${rp(bn - an, 9)}`
        + `${rp(r.a?.dLuma ?? '-', 11)}${rp(r.b?.dLuma ?? '-', 10)}`
        + `${rp(r.a?.structAfter ?? '-', 11)}${rp(r.b?.structAfter ?? '-', 10)}`);
    }

    /**
     * 🚨 **THE TWO ARMS ARE COMPARED AT A COMMON SLICE, AND THE FIRST VERSION COMPARED
     *    EACH ARM AT ITS OWN PEAK — WHICH IS A DIFFERENT INSTANT.**
     *
     * `vg_frame` computes each arm's floor at that arm's own peak slice. When the two
     * arms peak at the same slice that is also the common slice and nothing is wrong. On
     * the PHONE profile they did not: `giant5` peaked at **150 ms before and 320 ms
     * after**, so the "before vs after" row was 150 ms against 320 ms — and since every
     * one-shot in `vfx.ts` is fading by 320 ms, it reported `dLuma` and `luma` as
     * **WORSE** and every victim's rule-2 repaint as sharply DOWN (sushi 58.7% -> 34.6%).
     * Those were artefacts of the clock, not of the code, and they were the only rows in
     * the whole run pointing that direction — i.e. exactly the shape of a finding someone
     * would have chased.
     *
     * The fix costs nothing because the raw per-pass series are in the JSON: pick the
     * slice index maximising `before.n + after.n` (the joint peak), then rebuild BOTH
     * arms' floors at THAT index from `passes`. Each arm's own peak is still printed, and
     * a disagreement is called out rather than silently absorbed.
     */
    const stat = (vals) => {
      const v = vals.filter((x) => typeof x === 'number');
      if (!v.length) return null;
      const m = v.reduce((x, y) => x + y, 0) / v.length;
      return { mean: +m.toFixed(5), range: +(Math.max(...v) - Math.min(...v)).toFixed(5), n: v.length };
    };
    const atIdx = (scene, idx, sel) => stat((scene.passes ?? []).map((pp) => {
      const r = pp.series?.[idx];
      return r && !r.empty ? sel(r) : null;
    }));
    let common = -1, bestSum = -1;
    for (let i = 0; i < (a.series?.length ?? 0); i++) {
      const an = a.series[i]?.empty ? 0 : (a.series[i]?.n ?? 0);
      const bn = b.series[i]?.empty ? 0 : (b.series[i]?.n ?? 0);
      if (an + bn > bestSum) { bestSum = an + bn; common = i; }
    }
    if (common < 0) { log(`\n  🔴 no comparable slice`); continue; }
    const commonMs = a.series[common].ms;
    log(`\n  COMMON SLICE ${commonMs} ms  (before peaks at ${a.peak.ms} ms, after at ${b.peak.ms} ms`
      + `${a.peak.ms !== b.peak.ms ? ' — ⚠️ THEY DIFFER, so each-arm-own-peak would compare two different instants' : ''})`);

    const build = (scene) => {
      const nS = atIdx(scene, common, (r) => r.n);
      if (!nS) return null;
      return {
        mean: nS.mean, range: nS.range, n: [],
        dLuma: atIdx(scene, common, (r) => r.dLuma),
        structAfter: atIdx(scene, common, (r) => r.structAfter),
        lumaAfter: atIdx(scene, common, (r) => r.lumaAfter),
        hue: atIdx(scene, common, (r) => r.hue),
        victimPct: Object.fromEntries((scene.victims ?? []).map((v) => [v,
          atIdx(scene, common, (r) => r.victims?.[v]?.pct ?? null) ?? { mean: 0, range: 0 }])),
      };
    };
    const fa = build(a), fb = build(b);
    if (!fa || !fb) { log(`\n  🔴 no measured floor in one arm — nothing below is judgeable`); continue; }
    log(`  FLOORS at ${commonMs} ms (range over ${(a.passes ?? []).length} / ${(b.passes ?? []).length} identical passes — seed AND pool phase):`);
    log(`    painted  before ${fa.mean} +/- ${fa.range} px   ·  after ${fb.mean} +/- ${fb.range} px   -> bar ${(fa.range + fb.range).toFixed(1)} px`);
    log(`    dLuma    before ${fa.dLuma.mean} +/- ${fa.dLuma.range}  ·  after ${fb.dLuma.mean} +/- ${fb.dLuma.range}   -> bar ${(fa.dLuma.range + fb.dLuma.range).toFixed(5)}`);
    log(`    struct   before ${fa.structAfter.mean} +/- ${fa.structAfter.range}  ·  after ${fb.structAfter.mean} +/- ${fb.structAfter.range}   -> bar ${(fa.structAfter.range + fb.structAfter.range).toFixed(5)}`);

    const judge = (label, av, bv, barA, barB, moreIsBetter) => {
      const bar = barA + barB;
      const d = bv - av;
      const out = Math.abs(d) > bar;
      const dir = d === 0 ? 'flat' : (d > 0 === !!moreIsBetter ? 'BETTER' : 'WORSE');
      if (out) findings++;
      log(`    ${pad(label, 22)}${rp(av, 12)}${rp(bv, 12)}${rp(d.toFixed(5), 12)}   bar ${rp(bar.toFixed(5), 10)}  `
        + (out ? `🔴 OUTSIDE FLOOR — ${dir}` : 'inside floor — NOT a finding'));
      return out;
    };

    log(`\n  AT EACH ARM'S OWN FLOOR-MEAN (the paired quantity):`);
    log(`    ${pad('metric', 22)}${rp('before', 12)}${rp('after', 12)}${rp('delta', 12)}`);
    judge('painted px', fa.mean, fb.mean, fa.range, fb.range, true);
    judge('dLuma vs substrate', fa.dLuma.mean, fb.dLuma.mean, fa.dLuma.range, fb.dLuma.range, true);
    judge('struct (edge energy)', fa.structAfter.mean, fb.structAfter.mean, fa.structAfter.range, fb.structAfter.range, true);
    judge('luma', fa.lumaAfter.mean, fb.lumaAfter.mean, fa.lumaAfter.range, fb.lumaAfter.range, true);
    /**
     * 🔴 HUE IS NOT JUDGED, AND THAT IS A DEFECT IN THIS FILE FOUND BY READING ITS OWN
     *    OUTPUT — the exact class CLAUDE.md #10's seat-fairness note warns about.
     *
     * Hue is CIRCULAR. `vg_frame` reports it as a vector mean (correct) but computes its
     * floor as `max - min` over the passes (WRONG): a set straddling 0/360 gives a range
     * near 360, and the run printed literally `bar 360.20000` and `bar 354.40000` — a bar
     * nothing can ever exceed, so every hue row read "inside floor — NOT a finding"
     * **by construction**. That is a vacuous green, and it would have been quoted as
     * "hue did not move" on the one scene (`soup2`) whose whole point is a hue change.
     *
     * A linear range is the wrong statistic for this quantity; reaching for it because it
     * is the statistic used for the others is how a floor gets quoted an order of
     * magnitude wrong. Rather than invent a circular floor at the end of a run, the row
     * is printed as UNJUDGED with its raw values, and the colour question is answered
     * where it is exact instead: the `Weapon.color` literals in `rules.ts`
     * (`#E8792A` -> `#CC9F0D`), which are bytes and need no floor at all.
     */
    const hueDelta = ((fb.hue.mean - fa.hue.mean + 540) % 360) - 180;
    log(`    ${pad('hue (deg)', 22)}${rp(fa.hue.mean, 12)}${rp(fb.hue.mean, 12)}${rp(hueDelta.toFixed(2), 12)}`
      + `   🔴 UNJUDGED — hue is circular and this file has no circular floor. See the note in vg_ab.mjs.`);

    /**
     * ── THE ANCHOR'S OWN SHARE, AND ITS OWN TEXTURE ─────────────────────────────
     *
     * ⚠️ **DERIVED, NOT MEASURED — and the assumption is stated because it is doing
     * real work.** For every scene whose bespoke sculpts are BYTE-IDENTICAL across the
     * window (verified with `git diff --stat 8ca8f88 a494f98 -- src/vfx/weapons/*`:
     * only `soup.ts` changed), `after - before` is the anchor's contribution, because
     * `src/game/match.ts` is byte-identical too and the only executable change on the
     * path is `impactAnchor`.
     *
     * The TEXTURE decomposition below additionally assumes the painted sets are NESTED
     * (the sculpt's pixels are still painted in the composite) and that the anchor does
     * not change the sculpt's own pixel values where they do not overlap. Neither is
     * exactly true — the anchor is additive and composites OVER the sculpt — so treat
     * `struct(anchor)` as an ESTIMATE that explains the direction of the measured
     * `struct` row, not as a fourth measurement. It is included because "struct fell"
     * on its own invites the reading that the sculpt got worse, and it did not: the
     * sculpt is unchanged bytes. What changed is what is now sitting on top of it.
     */
    /**
     * 🚨 THE TIMING-ROBUST SHARE — because a single slice is a single instant, and the
     *    two arms do not live on the same schedule.
     *
     * The two arms peak at different slices (`swarm1`: 60 ms before, 220 ms after), so
     * ANY single-instant share depends on which instant is chosen: at each arm's own peak
     * the anchor is 79.6% of `swarm1`, at the joint peak it is 88.1%. Neither is wrong and
     * neither is the answer. The integral over the whole slice schedule — sum of painted
     * px across all eight slices, averaged over the passes — has no such dependence and is
     * the number quoted. It is a discrete approximation to delivered area x time, which is
     * also closer to what an eye integrates than any one frame is.
     */
    const integral = (scene) => {
      const sums = (scene.passes ?? []).map((pp) => (pp.series ?? [])
        .reduce((acc, r) => acc + (r.empty ? 0 : (r.n ?? 0)), 0));
      if (!sums.length) return null;
      const m = sums.reduce((x, y) => x + y, 0) / sums.length;
      return { mean: m, range: Math.max(...sums) - Math.min(...sums), sums };
    };
    const iA = integral(a), iB = integral(b);
    if (iA && iB && iB.mean > iA.mean) {
      const share = 100 * (iB.mean - iA.mean) / iB.mean;
      log(`\n  INTEGRATED OVER ALL ${a.series.length} SLICES (timing-independent):`);
      log(`    sculpt ${iA.mean.toFixed(0)} px-slices (+/-${iA.range})  ->  composite ${iB.mean.toFixed(0)} (+/-${iB.range})`
        + `  ·  anchor = ${share.toFixed(1)}% of the delivered hit`);
    }

    const eB = fa.structAfter.mean * fa.mean;
    const eA = fb.structAfter.mean * fb.mean;
    const anchorPx = fb.mean - fa.mean;
    if (anchorPx > 0) {
      const structAnchor = (eA - eB) / anchorPx;
      log(`
  ANCHOR SHARE (derived — see the note in vg_ab.mjs):`);
      log(`    sculpt ${fa.mean} px  ->  composite ${fb.mean} px   ·  anchor ${anchorPx.toFixed(1)} px`
        + ` = ${(100 * anchorPx / fb.mean).toFixed(1)}% OF WHAT THE PLAYER SEES`);
      /**
       * 🔴 **`struct` IS CONFOUNDED WITH REGION SIZE, AND THIS FILE SAID SO ONLY AFTER
       *    THE CONFOUND WAS QUANTIFIED — it was nearly the headline before that.**
       *
       * `struct` is the mean |luma gradient| over the painted pixels. At the BOUNDARY of a
       * painted region the gradient is effect-against-background and therefore large, so a
       * region's mean rises with its perimeter/area ratio — which for a compact blob goes
       * as `1/r`, i.e. as `1/sqrt(area)`. **A bigger effect scores lower on `struct` for
       * geometric reasons alone, with no change in softness whatsoever.**
       *
       * So the size-only expectation for the anchor is
       *     struct(sculpt) * sqrt(area(sculpt) / area(anchor))
       * and the only part of a `struct` drop that means anything is the RESIDUAL below it.
       * On the run that produced this file's first draft the residual was 6-37% while the
       * raw drop looked like 60% — i.e. **most of the "the anchor is softer" signal was
       * the anchor being BIGGER.** Reported here rather than quietly dropped, because the
       * raw ratio is the number a reader would otherwise quote.
       *
       * The two rows that are NOT confounded this way, and which carry the verdict
       * instead: the anchor's SHARE of the composite (pure area arithmetic) and the
       * hue-contract rule-2 repaint (a fraction of a fixed matte).
       */
      const sizeOnly = fa.structAfter.mean * Math.sqrt(fa.mean / anchorPx);
      const residual = 100 * (structAnchor - sizeOnly) / sizeOnly;
      log(`    edge energy: sculpt ${eB.toFixed(1)} -> composite ${eA.toFixed(1)}`
        + `  ·  struct(sculpt) ${fa.structAfter.mean.toFixed(5)} vs struct(anchor) ~${structAnchor.toFixed(5)}`
        + `  = ${(100 * structAnchor / fa.structAfter.mean).toFixed(0)}% as textured`);
      log(`    ⚠️ size-only expectation for a region this much bigger: ${sizeOnly.toFixed(5)}`
        + `  ->  RESIDUAL ${residual >= 0 ? '+' : ''}${residual.toFixed(0)}%`
        + `  (${Math.abs(residual) < 20 ? 'the raw drop is essentially ALL SIZE — not a softness finding'
          : residual < 0 ? 'softer than size alone explains' : 'more textured than size alone explains'})`);
    }

    // ── hue-contract rule 2, the one written down in `src/game/vfx.ts` ─────────
    const ultimate = name === 'giant5';
    log(`\n  hue-contract RULE 2 — "may not repaint more than ~1/3 of the cast's own pixels`);
    log(`  unless it is a death or an ultimate" (src/game/vfx.ts). Bar ${ultimate ? 'EXEMPT (ultimate)' : '33.3%'}:`);
    log(`    ${pad('victim', 14)}${rp('before%', 10)}${rp('after%', 10)}${rp('delta', 10)}${rp('bar', 10)}`);
    for (const v of Object.keys(fa.victimPct ?? {})) {
      const va = fa.victimPct[v], vb = fb.victimPct?.[v];
      if (!vb) { log(`    ${pad(v, 14)} 🔴 missing in the after arm`); continue; }
      const bar = va.range + vb.range;
      const d = vb.mean - va.mean;
      const outside = Math.abs(d) > bar;
      const overRule = !ultimate && vb.mean > 33.3;
      if (outside) findings++;
      log(`    ${pad(v, 14)}${rp(va.mean.toFixed(2), 10)}${rp(vb.mean.toFixed(2), 10)}${rp(d.toFixed(2), 10)}${rp(bar.toFixed(2), 10)}  `
        + (outside ? `🔴 OUTSIDE FLOOR${d > 0 ? ' — MORE of the victim repainted' : ''}` : 'inside floor')
        + (overRule ? '  🔴🔴 AND OVER THE 1/3 RULE' : ''));
    }
  }

  log(`\n══════════════════════════════════════════════════════════════════════════════`);
  log(` ${findings} metric(s) moved OUTSIDE their measured floor across ${names.length} scenes.`);
  log(` Everything else is INSIDE FLOOR and is not a finding.`);
  log('══════════════════════════════════════════════════════════════════════════════');
};

await main();
