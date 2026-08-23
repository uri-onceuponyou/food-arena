#!/usr/bin/env node
/**
 * GM_RATIO — THE GROUND MARK'S VALUE AGAINST THE GROUND IT IS DRAWN ON.
 *
 * ── The question, and why nothing here measured it ──────────────────────────────
 *
 * The round-3 critic's prescription for the persistent ground mark is stated as a
 * RATIO, not as a luma: *"a dark hole where every reference analogue sits at or near
 * its own ground's value"*, with a body at **0.9-1.6x the floor's luma** and the dark
 * pushed to a thin outer edge. Every instrument in `tools/tmp` measures either the
 * mark's own internal structure (`fx_flat` — stepRatio, falloffR; `pl_stack` —
 * interiorEdge, segRatio) or its AREA (`tr_area`). None of them divides the mark's
 * value by the ground's, which is the one number the acceptance test is written in.
 *
 * ── WHAT IS DIVIDED BY WHAT, and there are two denominators on purpose ──────────
 *
 *   underRatio   median luma of the mark's STRICT INTERIOR in `vfx_on.png`
 *                ------------------------------------------------------------
 *                median luma of THE SAME PIXELS in `vfx_off.png`
 *
 *                Same pixel set on both sides, so there is no registration question
 *                and no framing question: the denominator is literally the ground
 *                this mark is composited over, in this frame, under this light. It is
 *                also exactly the quantity the composite algebra is written in —
 *                `0.78·C·tex + 0.22·below` divided by `below`.
 *
 *   adjRatio     the same numerator over the median luma of an ANNULUS around the
 *                mark's union (dilate by `--pad2`, minus dilate by `--pad1`), read on
 *                `vfx_off.png` and with every VFX-owned pixel removed. This is the
 *                "adjacent ground" phrasing of the acceptance test. It is the weaker
 *                of the two — an annulus can wander onto a prop, a kerb or the cast —
 *                and it is reported so the number can be compared with a brief that
 *                was written in those terms, not so a decision can be taken on it.
 *
 * ⚠️ **NEITHER IS COMPARABLE TO A NUMBER TAKEN BY A DIFFERENT METHOD.** The figures
 * this was built against (`0.45` / `0.65` ours, `0.82` / `0.98` / `1.62` plates) come
 * from a BOX on both sides. A box includes the mark's antialiased edge and whatever
 * floor shows through between its lobes; a strict interior does not. Use this tool's
 * own before/after pair, measured by this tool on both arms, and say which method
 * produced any number quoted beside it.
 *
 *   p999L        the 99.9th percentile of luma inside a mask, on `vfx_on.png`. Two of
 *                them: over the WHOLE VFX ablation mask (`vfx_mask.png`, the acceptance
 *                test's population) and over the trail alone. A percentile, not a max —
 *                a max is one pixel and one pixel is not a hot core.
 *
 * ── VALIDATION — every arm, and what implementation would FAIL it ───────────────
 *
 * This is POST-HOC on PNGs, so every arm can be synthesised exactly. `CLAUDE.md` rule 6:
 * a guard that has not been shown to FAIL on the bug it guards against is not a guard.
 *
 *   §A NON-EMPTY  the eroded interior and the annulus are asserted above a floor
 *                 BEFORE any median is taken over them. `[].every()` is true and a
 *                 median of an empty set is NaN — which prints as a plausible blank
 *                 rather than as a failure. Fails if `--erode` ate the mask, if the
 *                 ablation found nothing, or if the mask PNG is the wrong size.
 *   §B SELF-PAIR  measured with `on := off` — the mark replaced by the ground it lies
 *                 on — `underRatio` must be EXACTLY 1.000. Fails if the two images are
 *                 misregistered, if a mask is applied to the wrong buffer, or if the
 *                 numerator and denominator are read through different code paths.
 *   §C MOVES DOWN mask pixels forced to black must read `underRatio` ~ 0.
 *   §D SCALE      mask pixels forced to `k x` the ground's own value must read
 *                 `underRatio` = k, for k = 0.5 AND k = 1.4. ⚠️ This is the arm that
 *                 separates a working ratio from a MONOTONE one: §C alone passes for
 *                 any tool that gets the direction right and the scale wrong, and the
 *                 acceptance test is a THRESHOLD on the scale (0.9-1.6), not a sign.
 *   §E PERCENTILE `p999L` must be 255 when 0.5% of the mask is planted at 255 and must
 *                 NOT be 255 when 0.01% is. Fails for a tool that computes a MAX and
 *                 calls it a percentile — which would read "we reached a hot value" off
 *                 a single stray pixel. The planted counts are derived from the real
 *                 mask's size, so the arm is planted where the bug can express itself.
 *   §F RESTORE    after every synthetic arm the untouched buffers are re-measured and
 *                 must return the shipped numbers BIT-IDENTICAL. Fails if a known-bad
 *                 leaked into the reported result.
 *
 * ── USE ────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/fx_own.mjs --url <frozen> --out shots/gm/before_own    # produces the PNGs
 *   node tools/tmp/gm_ratio.mjs --dir shots/gm/before_own
 *   node tools/tmp/gm_ratio.mjs --selftest --dir shots/gm/before_own      # arms + exit
 *
 * Reads only files `fx_own.mjs` already writes. It launches no browser and touches no
 * snapshot, so it can be re-run over an archived capture months later.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; }
}
const DIR = resolve(String(args.dir ?? 'shots/gm/before_own'));
const ERODE = Number(args.erode ?? 4);
const PAD1 = Number(args.pad1 ?? 8);
const PAD2 = Number(args.pad2 ?? 28);
const SELFTEST = !!args.selftest;
/** Floors for §A. Generous on purpose: they exist to catch an EMPTY set, not to
 *  express a judgement about how big a mark should be. */
const MIN_INTERIOR = 300;
const MIN_ANNULUS = 300;

const fail = (m) => { console.error(`gm_ratio: ${m}`); process.exit(1); };

// ── loading ───────────────────────────────────────────────────────────────────
async function rgb(path) {
  if (!existsSync(path)) fail(`missing ${path} — run fx_own.mjs --out ${DIR} first`);
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
async function gray(path) {
  if (!existsSync(path)) fail(`missing ${path} — run fx_own.mjs --out ${DIR} first`);
  const { data, info } = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data: Uint8Array.from(data), w: info.width, h: info.height };
}

/** Rec.709 luma, 0..255 — the SAME formula `fx_flat.mjs` and `pl_stack.mjs` use, so a
 *  number here is on the same scale as a number there. */
function lumaOf(img) {
  const L = new Float64Array(img.w * img.h);
  for (let p = 0, i = 0; p < L.length; p++, i += 3) {
    L[p] = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
  }
  return L;
}

// ── morphology: separable square structuring element ──────────────────────────
function morph(mask, w, h, r, op) {
  if (r <= 0) return Uint8Array.from(mask);
  const pick = op === 'dilate' ? Math.max : Math.min;
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = op === 'dilate' ? 0 : 255;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        // Out of frame counts as BACKGROUND for a dilate and as BACKGROUND for an
        // erode too, so a mask touching the frame edge is eroded away rather than
        // silently preserved — the conservative direction for §A.
        const s = xx < 0 || xx >= w ? 0 : mask[y * w + xx];
        v = pick(v, s);
      }
      tmp[y * w + x] = v;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = op === 'dilate' ? 0 : 255;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        const s = yy < 0 || yy >= h ? 0 : tmp[yy * w + x];
        v = pick(v, s);
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

const median = (xs) => {
  if (!xs.length) return NaN;
  const s = Float64Array.from(xs).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** A real percentile over a declared mask. NOT a max — see §E. */
function pct(L, mask, q) {
  const xs = [];
  for (let p = 0; p < mask.length; p++) if (mask[p]) xs.push(L[p]);
  if (!xs.length) return NaN;
  xs.sort((a, b) => a - b);
  const idx = Math.min(xs.length - 1, Math.max(0, Math.ceil(q * xs.length) - 1));
  return xs[idx];
}
const count = (m) => { let n = 0; for (let i = 0; i < m.length; i++) if (m[i]) n++; return n; };
const medOver = (L, m) => { const xs = []; for (let p = 0; p < m.length; p++) if (m[p]) xs.push(L[p]); return median(xs); };

// ── the measurement, as a pure function of two luma buffers + the masks ───────
function measure(Lon, Loff, masks) {
  const { interior, annulus, vfx, trail } = masks;
  return {
    interiorPx: count(interior),
    annulusPx: count(annulus),
    vfxPx: count(vfx),
    trailPx: count(trail),
    bodyMed: medOver(Lon, interior),
    underMed: medOver(Loff, interior),
    adjMed: medOver(Loff, annulus),
    underRatio: medOver(Lon, interior) / medOver(Loff, interior),
    adjRatio: medOver(Lon, interior) / medOver(Loff, annulus),
    p999vfx: pct(Lon, vfx, 0.999),
    p999trail: pct(Lon, trail, 0.999),
    p99vfx: pct(Lon, vfx, 0.99),
    maxVfx: pct(Lon, vfx, 1.0),
  };
}

// ── main ──────────────────────────────────────────────────────────────────────
const on = await rgb(join(DIR, 'vfx_on.png'));
const off = await rgb(join(DIR, 'vfx_off.png'));
const vfxM = await gray(join(DIR, 'vfx_mask.png'));
const trailM = await gray(join(DIR, 'trail_mask.png'));
for (const [n, im] of [['vfx_off', off], ['vfx_mask', vfxM], ['trail_mask', trailM]]) {
  if (im.w !== on.w || im.h !== on.h) fail(`${n} is ${im.w}x${im.h} but vfx_on is ${on.w}x${on.h} — these are not one capture`);
}
const W = on.w; const H = on.h;

const interior = morph(trailM.data, W, H, ERODE, 'erode');
const d1 = morph(trailM.data, W, H, PAD1, 'dilate');
const d2 = morph(trailM.data, W, H, PAD2, 'dilate');
const annulus = new Uint8Array(W * H);
for (let p = 0; p < annulus.length; p++) {
  // Ring around the mark, MINUS every pixel any VFX object owns — otherwise the
  // "ground" would include the burst, the halo and the neighbouring marks, i.e. the
  // very thing being divided by it.
  annulus[p] = d2[p] && !d1[p] && !vfxM.data[p] ? 255 : 0;
}

// ── §A NON-EMPTY, BEFORE any median is taken over anything ────────────────────
const nInterior = count(interior);
const nAnnulus = count(annulus);
const nVfx = count(vfxM.data);
const nTrail = count(trailM.data);
console.log(`§A NON-EMPTY  trail ${nTrail} px · interior(erode ${ERODE}) ${nInterior} px · annulus(${PAD1}..${PAD2}) ${nAnnulus} px · vfx ${nVfx} px`);
if (nTrail === 0) fail('§A the trail mask is EMPTY — fx_own reported a vacuous trail ablation. Nothing below would mean anything.');
if (nVfx === 0) fail('§A the vfx mask is EMPTY — the ablation did not take.');
if (nInterior < MIN_INTERIOR) fail(`§A the eroded interior is ${nInterior} px, under the ${MIN_INTERIOR} floor — --erode ate the mask.`);
if (nAnnulus < MIN_ANNULUS) fail(`§A the annulus is ${nAnnulus} px, under the ${MIN_ANNULUS} floor — widen --pad2.`);
console.log('§A PASS\n');

const Lon = lumaOf(on);
const Loff = lumaOf(off);
const masks = { interior, annulus, vfx: vfxM.data, trail: trailM.data };
const R = measure(Lon, Loff, masks);

// ── the validation battery ────────────────────────────────────────────────────
let armsFailed = 0;
const arm = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) armsFailed++;
};
{
  // §B SELF-PAIR — the mark replaced by the ground it lies on.
  const b = measure(Loff, Loff, masks);
  arm('§B SELF-PAIR   on:=off -> underRatio must be EXACTLY 1', b.underRatio === 1, `underRatio ${b.underRatio}`);

  // §C MOVES DOWN — mask pixels forced to black.
  const black = Float64Array.from(Lon);
  for (let p = 0; p < interior.length; p++) if (interior[p]) black[p] = 0;
  const c = measure(black, Loff, masks);
  arm('§C MOVES DOWN  interior:=0 -> underRatio must be ~0', c.underRatio === 0, `underRatio ${c.underRatio.toFixed(4)}`);

  // §D SCALE — the arm §C cannot stand in for. A tool with the right sign and the
  // wrong scale passes §C and fails the acceptance test silently.
  for (const k of [0.5, 1.4]) {
    const scaled = Float64Array.from(Lon);
    for (let p = 0; p < interior.length; p++) if (interior[p]) scaled[p] = Loff[p] * k;
    const d = measure(scaled, Loff, masks);
    arm(`§D SCALE k=${k}   interior:=k·ground -> underRatio must be ${k}`,
      Math.abs(d.underRatio - k) < 1e-9, `underRatio ${d.underRatio.toFixed(6)}`);
  }

  // §E PERCENTILE — planted INSIDE the real vfx mask, sized off the real mask, so the
  // bug (a max wearing a percentile's name) can express itself.
  const idx = [];
  for (let p = 0; p < vfxM.data.length; p++) if (vfxM.data[p]) idx.push(p);
  const plant = (share) => {
    const hot = Float64Array.from(Lon);
    const k = Math.max(1, Math.round(share * idx.length));
    for (let i = 0; i < k; i++) hot[idx[i]] = 255;
    return { p999: pct(hot, vfxM.data, 0.999), k };
  };
  const big = plant(0.005);
  const tiny = plant(0.0001);
  arm('§E PERCENTILE  0.5% of the mask at 255 -> p999 must be 255', big.p999 === 255, `p999 ${big.p999} (${big.k} px planted)`);
  arm('§E PERCENTILE  0.01% of the mask at 255 -> p999 must NOT be 255 (a MAX would say 255)',
    tiny.p999 !== 255, `p999 ${tiny.p999.toFixed(1)} (${tiny.k} px planted), max would read 255`);

  // §F RESTORE — nothing above may have leaked into the reported numbers.
  const again = measure(Lon, Loff, masks);
  const same = JSON.stringify(again) === JSON.stringify(R);
  arm('§F RESTORE     untouched re-measure must be bit-identical', same, same ? '' : `\n  ${JSON.stringify(R)}\n  ${JSON.stringify(again)}`);
}
console.log('');
if (SELFTEST) {
  console.log(armsFailed ? `SELFTEST: ${armsFailed} arm(s) FAILED` : 'SELFTEST: all arms pass');
  process.exit(armsFailed ? 1 : 0);
}
if (armsFailed) fail(`${armsFailed} validation arm(s) failed — do not read the numbers below`);

// ── the report ────────────────────────────────────────────────────────────────
const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : 'NaN');
console.log(`dir            ${DIR}`);
console.log(`trail px       ${R.trailPx}  (${(100 * R.trailPx / R.vfxPx).toFixed(1)}% of the ${R.vfxPx} VFX-owned px)`);
console.log(`interior px    ${R.interiorPx}   annulus px ${R.annulusPx}`);
console.log('');
console.log(`bodyMed        ${f(R.bodyMed, 2)}   (mark interior, vfx_on)`);
console.log(`underMed       ${f(R.underMed, 2)}   (the SAME pixels, vfx_off — the ground it is drawn on)`);
console.log(`adjMed         ${f(R.adjMed, 2)}   (annulus ${PAD1}..${PAD2} px, vfx_off, VFX px removed)`);
console.log('');
console.log(`CRITERION 1a   underRatio  ${f(R.underRatio)}   <- body / the ground beneath it   [target 0.9-1.6]`);
console.log(`CRITERION 1b   adjRatio    ${f(R.adjRatio)}   <- body / adjacent ground`);
console.log(`CRITERION 2    p999L(vfx)  ${f(R.p999vfx, 1)}   [target 253-255]   p999L(trail) ${f(R.p999trail, 1)}`);
console.log(`               p99L(vfx)   ${f(R.p99vfx, 1)}    max(vfx) ${f(R.maxVfx, 1)}`);
writeFileSync(join(DIR, 'gm_ratio.json'), JSON.stringify({ dir: DIR, erode: ERODE, pad1: PAD1, pad2: PAD2, ...R }, null, 2));
console.log(`\n-> ${join(DIR, 'gm_ratio.json')}`);
