#!/usr/bin/env node
/**
 * SHADE-TO-LIT RATIO ON ONE GROUND MATERIAL — the number a critic asked for, and the
 * number the same critic guessed wrong.
 *
 * A blind critic reading the arena cold: *"in-shadow floor sits at roughly 80-85% of
 * the lit floor's luminance; in both reference frames in-shadow ground is around
 * 50-60%. Cut hemisphere/ambient by ~40%."* That prescription is the third time the
 * ambient-dominates-the-key mechanism has been named here and the second time it comes
 * with a testable quantity, so it is measured rather than argued with.
 *
 * The measurement has to be restricted to ONE material, or it is meaningless: a frame
 * containing a pink tile field, a teal service mat and a purple plinth has a luminance
 * spread that has nothing to do with the light rig. So a region is selected by HUE
 * (with a tolerance) inside a hand-given rectangle, and the ratio reported is
 *
 *     p10 of that material's luma  /  p90 of that material's luma
 *
 * i.e. its own deep shade against its own open light. Percentiles rather than min/max
 * so one clipped pixel or one prop edge cannot set the answer.
 *
 * ⚠️ It runs on OUR frames and on the REFERENCE PLATES with the same code, because the
 * whole question is what the reference actually does — and the critic's 50-60% claim
 * for the reference is exactly as much a guess as its 80-85% claim for us.
 *
 *   node tools/tmp/shaderatio.mjs --selftest
 *   node tools/tmp/shaderatio.mjs --img shots/x.png --rect 0,380,560,500 --hue 340 --tol 30
 */
import sharp from 'sharp';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** p10/p90 of luma over pixels inside `rect` whose hue is within `tol` of `hue`. */
export function ratio(buf, w, h, rect, hue, tol, minSat = 0.12) {
  const [x0, y0, rw, rh] = rect;
  const vals = [];
  for (let y = y0; y < Math.min(h, y0 + rh); y++) {
    for (let x = x0; x < Math.min(w, x0 + rw); x++) {
      const i = (y * w + x) * 3;
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      const mx = Math.max(r, g, b);
      if (!mx || (mx - Math.min(r, g, b)) / mx < minSat) continue;
      if (hue != null && hueDist(hueOf(r, g, b), hue) > tol) continue;
      vals.push(luma(r, g, b));
    }
  }
  vals.sort((a, b) => a - b);
  if (vals.length < 100) return { n: vals.length, p10: 0, p50: 0, p90: 0, ratio: 0 };
  const q = (p) => vals[Math.floor(p * (vals.length - 1))];
  return { n: vals.length, p10: q(0.10), p50: q(0.50), p90: q(0.90), ratio: q(0.10) / q(0.90) };
}

if (has('selftest')) {
  let pass = 0, fail = 0;
  const ok = (n, c, g) => { if (c) pass++; else { fail++; console.log(`  FAIL ${n} got ${g}`); } };
  const near = (a, b, t = 2e-3) => Math.abs(a - b) <= t;
  ok('hue of pure red', near(hueOf(255, 0, 0), 0), hueOf(255, 0, 0));
  ok('hue of pure green', near(hueOf(0, 255, 0), 120), hueOf(0, 255, 0));
  ok('hue of pure blue', near(hueOf(0, 0, 255), 240), hueOf(0, 0, 255));
  ok('hue wraps the short way', near(hueDist(350, 10), 20), hueDist(350, 10));
  // A synthetic material: 200 columns at luma X, 200 at 0.55X, same hue.
  const w = 400, h = 40, buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y * w + x) * 3, f = x < 200 ? 1 : 0.55;
    buf[j] = Math.round(200 * f); buf[j + 1] = Math.round(100 * f); buf[j + 2] = Math.round(140 * f);
  }
  const r = ratio(buf, w, h, [0, 0, w, h], hueOf(200, 100, 140), 10);
  ok('two-plateau ratio recovers 0.55', near(r.ratio, 0.55, 0.02), r.ratio);
  ok('all pixels selected', r.n === w * h, r.n);
  // A DIFFERENT hue in the same rect must be excluded, not averaged in.
  for (let y = 0; y < h; y++) for (let x = 300; x < 400; x++) {
    const j = (y * w + x) * 3; buf[j] = 20; buf[j + 1] = 200; buf[j + 2] = 90;
  }
  const r2 = ratio(buf, w, h, [0, 0, w, h], hueOf(200, 100, 140), 10);
  ok('the foreign hue is excluded', r2.n === 300 * h, r2.n);
  ok('and the ratio is unchanged by it', near(r2.ratio, 0.55, 0.02), r2.ratio);
  ok('too few samples returns 0 rather than a number', ratio(buf, w, h, [0, 0, 2, 2], 0, 1).ratio === 0, 'nonzero');
  console.log(`\nshaderatio --selftest  ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

const img = arg('img', null);
const rect = arg('rect', '0,0,99999,99999').split(',').map(Number);
const hue = arg('hue', null) == null ? null : Number(arg('hue'));
const tol = Number(arg('tol', 25));
const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const r = ratio(data, info.width, info.height, rect, hue, tol);
console.log(`${img}  rect ${rect.join(',')}  hue ${hue ?? 'any'}+-${tol}`);
console.log(`  n ${r.n}   p10 ${r.p10.toFixed(4)}   p50 ${r.p50.toFixed(4)}   p90 ${r.p90.toFixed(4)}   shade/lit ${r.ratio.toFixed(3)}`);
