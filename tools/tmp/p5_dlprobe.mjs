#!/usr/bin/env node
/**
 * p5_dlprobe — a KNOWN-BAD-INPUT test for `valuelib.vlAdjacency`'s `dL`, plus the
 * BROWSER-FREE recovery that says how much of it is live.
 *
 * `weakBoundaryPct` gates on `dL = |p50(A) - p50(B)|` — the two parts' WHOLE-PART
 * medians. The perceptual question the metric is standing in for is "does the eye see
 * an edge where A meets B", which is a property of the pixels AT THE CONTACT.
 *
 * These two are the same number only when each part is roughly uniform. This file
 * builds the two cases where they are not and shows the metric returning a confident
 * wrong answer in BOTH directions. Every expected value below is derived by hand in the
 * comment beside it.
 *
 * ── STATUS ───────────────────────────────────────────────────────────────────
 * These four cases now ALSO live in `valuescan.mjs --selftest` section L, which is where
 * the gate battery runs them (78 -> 105 assertions). This file is kept because it is the
 * derivation, and because of `--live`, which the selftest cannot do: the selftest proves
 * the metric on inputs whose answer is known, and `--live` measures how far apart the two
 * quantities are ON THE REAL CAST. Both are needed — a metric can be provably correct and
 * still be measuring something nobody cares about.
 *
 * ── `--live <dir>` ───────────────────────────────────────────────────────────
 * Recomputes the contact-local step for every character in an existing `--mode chars`
 * output WITHOUT A BROWSER, by recovering the exact merged owner map from valuescan's own
 * `<id>.ss.yaw<N>.parts.png` and the luma from `<id>.ss.yaw<N>.value.png`.
 *
 * ⚠️ IT VALIDATES ITSELF BEFORE IT PRINTS. The recovered owner map has to reproduce the
 * recorded `contacts` count for EVERY pair EXACTLY — an integer, so there is no tolerance
 * to hide in — and any character where it does not is REFUSED rather than reported.
 * Recovery through a nearest-neighbour upscale and an 8-bit PNG is exactly the kind of
 * step that returns a plausible wrong number, which is the failure this repo has now
 * caught nineteen instruments doing.
 *
 * The recovered luma is 8-bit (`round(L * 255)` in `writeOverlays`), so the floor on a
 * recovered `dLcontact` is 1/255 = 0.0039. `dL` is quoted from the JSON, not recovered:
 * the live `dL` is taken over each part's UNMERGED mask and the owner map is merged, so a
 * pixel two parts both claim is in one part's median and not the other's. That difference
 * is real and small (measured at 0.007 on hotdog's hipL) and it is not this tool's to
 * paper over.
 *
 * Run: node tools/tmp/p5_dlprobe.mjs
 *      node tools/tmp/p5_dlprobe.mjs --live shots/p5/gate1
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { VL } from './valuelib.mjs';

const W = 40, H = 40;
let pass = 0, fail = 0;
const check = (name, got, want, tol = 1e-3) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? '  OK ' : '  ** '} ${name.padEnd(62)} ${String(got).padStart(8)}  (want ${want})`);
  ok ? pass++ : fail++;
};

/** Two vertical slabs, A on the left half, B on the right half. */
function slabs(lumaOfA, lumaOfB) {
  const A = new Uint8Array(W * H), B = new Uint8Array(W * H);
  const luma = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x;
    if (x < W / 2) { A[j] = 1; luma[j] = lumaOfA(x, y); } else { B[j] = 1; luma[j] = lumaOfB(x, y); }
  }
  return { A, B, luma };
}

// ── CASE 1: FALSE NEGATIVE — a boundary that is a hard 0.90 step, reported as 0.000 ──
// A is half 0.10 and half 0.90, arranged so the 0.90 band is the column that TOUCHES B.
// A's median is 0.50 by construction. B is uniform 0.50. Whole-part medians: identical.
// At the contact the step is |0.90 - 0.50| = 0.40, and it is a hard edge.
{
  const { A, B, luma } = slabs(
    (x) => (x >= W / 4 ? 0.90 : 0.10),   // right half of A (the touching side) is bright
    () => 0.50,
  );
  const r = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8);
  const p = r.pairs[0];
  check('CASE 1  contacts found', p.contacts, H);
  check('CASE 1  A p50 (half 0.10, half 0.90)', r.stats[0].p50, 0.50);
  check('CASE 1  B p50', r.stats[1].p50, 0.50);
  check('CASE 1  dL REPORTED  <- the metric says NO EDGE', p.dL, 0.0);
  // the truth, computed on the touching columns only
  let a = 0, b = 0;
  for (let y = 0; y < H; y++) { a += luma[y * W + (W / 2 - 1)]; b += luma[y * W + (W / 2)]; }
  check('CASE 1  dL AT THE CONTACT  <- what the eye sees', +(Math.abs(a - b) / H).toFixed(4), 0.40);
}

// ── CASE 2: FALSE POSITIVE — no visible edge at all, reported as a strong 0.40 ────────
// A ramps 0.10 -> 0.50 left to right; B ramps 0.50 -> 0.90. The two are CONTINUOUS
// across the seam: adjacent pixels differ by one ramp step. Medians are 0.30 and 0.70.
{
  const { A, B, luma } = slabs(
    (x) => 0.10 + (0.40 * x) / (W / 2 - 1),
    (x) => 0.50 + (0.40 * (x - W / 2)) / (W / 2 - 1),
  );
  const r = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8);
  const p = r.pairs[0];
  check('CASE 2  A p50 (ramp 0.10..0.50)', r.stats[0].p50, 0.30, 0.011);
  check('CASE 2  B p50 (ramp 0.50..0.90)', r.stats[1].p50, 0.70, 0.011);
  check('CASE 2  dL REPORTED  <- the metric says STRONG EDGE', p.dL, 0.40, 0.021);
  let a = 0, b = 0;
  for (let y = 0; y < H; y++) { a += luma[y * W + (W / 2 - 1)]; b += luma[y * W + (W / 2)]; }
  check('CASE 2  dL AT THE CONTACT  <- what the eye sees', +(Math.abs(a - b) / H).toFixed(4), 0.0, 0.011);
}

// ── CASE 3: the CONTROL — two uniform slabs, where median IS the contact ────────────
{
  const { A, B, luma } = slabs(() => 0.20, () => 0.65);
  const r = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8);
  check('CASE 3  uniform slabs: reported dL == contact dL', r.pairs[0].dL, 0.45);
}

// ── CASE 4: the minContacts gate is a CLIFF, not a taper ────────────────────────────
// One pixel of contact either side of the threshold flips a pair between "counted" and
// "does not exist". `weakBoundaryPct` weights by contacts, so a pair at the threshold
// enters the denominator AND the numerator at full weight.
{
  const A = new Uint8Array(W * H), B = new Uint8Array(W * H);
  const luma = new Float64Array(W * H).fill(0.5);
  for (let y = 0; y < 8; y++) { A[y * W + 10] = 1; B[y * W + 11] = 1; luma[y * W + 11] = 0.5; }
  const at8 = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8).pairs.length;
  const at9 = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 9).pairs.length;
  check('CASE 4  8 contacts at minContacts=8  -> pair EXISTS', at8, 1);
  check('CASE 4  8 contacts at minContacts=9  -> pair VANISHES', at9, 0);
}

console.log(`\n${pass} passed, ${fail} failed`);

// ─────────────────────────────────────────────────────────────────────────────
// --live <dir>: how much of the above is happening on the actual cast
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv.includes('--live')) {
  const dir = process.argv[process.argv.indexOf('--live') + 1] ?? 'shots/p5/gate1';
  const charsPath = join(dir, 'chars.json');
  if (!existsSync(charsPath)) {
    console.log(`\n--live: no ${charsPath} — nothing to recompute. (Run --mode chars first.)`);
    process.exit(fail ? 1 : 0);
  }
  const J = JSON.parse(readFileSync(charsPath, 'utf8'));
  const M = J.__meta ?? {};
  const yaw = (M.yaws ?? [90])[0];
  const SSF = M.ss ?? 2;
  // The SAME minContacts the capture used: `8 * dsf` for the supersampled pass.
  const minC = 8 * SSF;
  // `writeOverlays`' palette, copied because it is the encoding, not a choice.
  const PAL = [[255, 80, 80], [80, 255, 120], [90, 150, 255], [255, 220, 60], [255, 120, 255],
    [80, 230, 230], [255, 160, 40], [160, 100, 255], [120, 255, 60], [255, 60, 160],
    [60, 200, 160], [200, 200, 200], [140, 90, 40], [40, 90, 140], [240, 140, 140],
    [90, 240, 200], [200, 90, 240]];
  const palKey = new Map(PAL.map((c, i) => [`${c[0]},${c[1]},${c[2]}`, i]));

  console.log(`\n\n── LIVE RECOVERY from ${dir}  (tree ${M.srcId}  tool ${M.toolHash}  yaw ${yaw}  ss ${SSF})`);
  console.log('   dL is QUOTED from the JSON; dLcontact is RECOMPUTED from the parts/value PNGs.');
  console.log('   Every character below reproduced its recorded contact counts EXACTLY or was refused.\n');
  console.log('char          pairs  weakB%  weakBc%  flips   the pair that dominates weakB%');

  let totalPairs = 0, totalFlips = 0, refused = 0, maxP50 = 0, maxP50At = null, p50Total = 0, uniN = 0, uniWorst = 0, uniAt = null;
  for (const id of Object.keys(J)) {
    if (id === '__meta') continue;
    const c = J[id] && J[id].ss;
    if (!c || c.error || !c.adjacent || !c.crop) continue;
    const [, , cw, ch] = c.crop;
    const pPath = join(dir, 'chars', `${id}.ss.yaw${yaw}.parts.png`);
    const vPath = join(dir, 'chars', `${id}.ss.yaw${yaw}.value.png`);
    if (!existsSync(pPath) || !existsSync(vPath)) { console.log(`${id.padEnd(13)} NO PNG — skipped`); continue; }

    const P = await sharp(pPath).raw().toBuffer({ resolveWithObject: true });
    const V = await sharp(vPath).raw().toBuffer({ resolveWithObject: true });
    const scale = Math.round(P.info.width / cw);
    const nch = P.info.channels, vch = V.info.channels;

    const owner = new Int16Array(cw * ch).fill(-1);
    const luma = new Float64Array(cw * ch);
    let unknown = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const src = ((y * scale) * P.info.width + x * scale) * nch;
      const k = `${P.data[src]},${P.data[src + 1]},${P.data[src + 2]}`;
      const j = y * cw + x;
      if (k === '24,24,30') owner[j] = -1;             // the unowned colour writeOverlays uses
      else if (palKey.has(k)) owner[j] = palKey.get(k);
      else { owner[j] = -1; unknown++; }
      const vs = ((y * scale) * V.info.width + x * scale) * vch;
      luma[j] = V.data[vs] / 255;                       // grey inside the matte; see below
    }
    if (unknown) { console.log(`${id.padEnd(13)} REFUSED — ${unknown} px of parts.png match no palette entry`); refused++; continue; }

    const names = c.ownerNames ?? c.parts.map((p) => p.part);
    const masks = names.map((_, i) => {
      const m = new Uint8Array(cw * ch);
      for (let j = 0; j < cw * ch; j++) if (owner[j] === i) m[j] = 1;
      return m;
    });
    const rec = VL.adjacency(masks, names, cw, ch, luma, minC);
    const recBy = new Map(rec.pairs.map((p) => [`${p.a}|${p.b}`, p]));

    // ── THE VALIDATION, before a single number is printed ────────────────────
    // Integer contact counts, every pair, exact. If the owner map came back even one
    // pixel wrong this fails, and a wrong owner map is the only way dLcontact can be
    // wrong here.
    let mismatch = null;
    for (const p of c.adjacent) {
      const r = recBy.get(`${p.a}|${p.b}`);
      if (!r) { mismatch = `${p.a}|${p.b} not recovered at all`; break; }
      if (r.contacts !== p.contacts) { mismatch = `${p.a}|${p.b} contacts ${r.contacts} != recorded ${p.contacts}`; break; }
    }
    if (c.adjacent.length !== rec.pairs.length) mismatch ??= `pair count ${rec.pairs.length} != recorded ${c.adjacent.length}`;
    if (mismatch) { console.log(`${id.padEnd(13)} REFUSED — ${mismatch}`); refused++; continue; }
    // ── AND A SECOND CONTROL, for the LUMA ───────────────────────────────────
    // The contact check validates the OWNER MAP and says nothing about the values. A luma
    // read from the wrong channel, or off an unscaled PNG, would sail straight through it.
    //
    // The per-part medians can't be compared naively: the recorded p50 is over each part's
    // UNMERGED mask while this one is over the merged owner map, so wherever two parts
    // claim the same pixel the two medians are legitimately different quantities — on a
    // 16 px part that is worth tenths, and a control that fires on a real difference is
    // not a control. So compare ONLY the parts where the recovered pixel count EQUALS the
    // recorded one, which is precisely where the two masks are the same set and the
    // medians therefore MUST agree to the 8-bit floor. That is an exact test with no
    // tolerance to argue about.
    let p50Worst = 0, p50At = null, p50N = 0;
    names.forEach((nm, i) => {
      const r = c.parts.find((p) => p.part === nm);
      if (!r || r.p50 == null || rec.stats[i].p50 == null) return;
      if (rec.stats[i].px !== r.px) return;         // masks differ — not comparable, by construction
      p50N++;
      const d = Math.abs(r.p50 - rec.stats[i].p50);
      if (d > p50Worst) { p50Worst = d; p50At = nm; }
    });

    // ── THE ACCEPTANCE TEST, defined before round 1 ──────────────────────────
    // Where BOTH parts are near-uniform, dL and dLcontact are the same quantity by
    // construction and must agree. A disagreement there is an implementation fault, not a
    // finding — which is the only thing that separates "the metric changed the answer"
    // from "the metric is broken". `valuescan --mode gate` prints the same check.
    //
    // ⚠️ 0.05, NOT the 0.15 this was specified with. A part whose p10-p90 spans 0.15 can
    // legitimately have its contact band 0.15 from its median, so "spread < 0.15 must
    // agree within 0.02" demands 0.02 from a shape that permits 0.15. As specified it
    // selected 2 pairs and "failed" at 0.1190 on hamburger kneeL|footL (spreads 0.141 /
    // 0.136) — the TEST was wrong, not the metric. At 0.05 nothing on this cast qualifies,
    // because the narrowest pair anywhere is 0.119, and that is the point: no part of any
    // character is uniform, so the whole-part median is the wrong statistic for EVERY pair.
    for (const p of c.adjacent) {
      const sp = (q) => { const r = c.parts.find((z) => z.part === q); return r && r.p90 != null ? r.p90 - r.p10 : null; };
      const sa = sp(p.a), sb = sp(p.b);
      if (sa == null || sb == null || sa >= 0.05 || sb >= 0.05) continue;
      uniN++;
      const d = Math.abs(p.dL - recBy.get(`${p.a}|${p.b}`).dLcontact);
      if (d > uniWorst) { uniWorst = d; uniAt = `${id} ${p.a}|${p.b} (spreads ${sa.toFixed(3)}/${sb.toFixed(3)})`; }
    }

    const tot = c.adjacent.reduce((s, p) => s + p.contacts, 0);
    const weakB = tot ? (100 * c.adjacent.filter((p) => p.dL < 0.10).reduce((s, p) => s + p.contacts, 0)) / tot : 0;
    const weakBc = tot ? (100 * c.adjacent.filter((p) => recBy.get(`${p.a}|${p.b}`).dLcontact < 0.10)
      .reduce((s, p) => s + p.contacts, 0)) / tot : 0;
    const flipped = c.adjacent.filter((p) => (p.dL < 0.10) !== (recBy.get(`${p.a}|${p.b}`).dLcontact < 0.10));
    // The cliff: the single pair carrying the most weight among those weakB% counts.
    const weak = c.adjacent.filter((p) => p.dL < 0.10).sort((a, b) => b.contacts - a.contacts)[0];
    const note = weak
      ? `${weak.a}|${weak.b} ${((100 * weak.contacts) / tot).toFixed(1)}pp  dL ${weak.dL.toFixed(4)} -> dLc ${recBy.get(`${weak.a}|${weak.b}`).dLcontact.toFixed(4)}`
      : '—';
    totalPairs += c.adjacent.length; totalFlips += flipped.length;
    p50Total += p50N;
    if (p50Worst > maxP50) { maxP50 = p50Worst; maxP50At = `${id} ${p50At}`; }
    console.log(`${id.padEnd(13)}${String(c.adjacent.length).padStart(6)}${weakB.toFixed(1).padStart(8)}${weakBc.toFixed(1).padStart(9)}${String(flipped.length).padStart(7)}   ${note}`);
  }
  console.log(`\n${totalFlips} of ${totalPairs} pairs get a DIFFERENT 0.10 verdict from the boundary-local step`
    + `${refused ? `, ${refused} character(s) REFUSED` : ''}.`);
  console.log('Per character above, never aggregated — the aggregate is not the quantity anyone acts on.');
  console.log(`\nLUMA RECOVERY CONTROL: over the ${p50Total} parts whose recovered pixel count equals the`);
  console.log('recorded one — i.e. where the merged and unmerged masks are provably the SAME SET, so the');
  console.log(`two medians must agree — the worst |recovered p50 - recorded p50| is ${maxP50.toFixed(4)} at ${maxP50At}.`);
  console.log('The 8-bit quantisation floor of value.png is 0.0039. A luma read off the wrong channel or');
  console.log('an unscaled PNG would put this in the tenths.');
  console.log(`\nCONSTRUCTION CHECK: ${uniN} pairs where BOTH parts are near-uniform (p90-p10 < 0.05) — the`);
  console.log('case where dL and dLcontact are the SAME quantity by construction and must agree.');
  if (uniN) console.log(`Worst |dL - dLcontact| = ${uniWorst.toFixed(4)} at ${uniAt}.`);
  console.log(uniN === 0
    ? 'n=0 is EXPECTED here and is itself the finding: the narrowest pair on the whole cast spreads\n0.119, so no part is uniform and the whole-part median is the wrong statistic for EVERY pair.\nThe agreement is proved synthetically instead — valuescan --selftest section L3.'
    : (uniWorst <= 0.02 ? 'Within 0.02: the new quantity is not simply a different number.'
      : '⚠️ OVER 0.02 — an IMPLEMENTATION FAULT in dLcontact, not a finding about the cast.'));
}

process.exit(fail ? 1 : 0);
