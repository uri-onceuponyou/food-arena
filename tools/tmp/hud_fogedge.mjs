#!/usr/bin/env node
/**
 * Does the closing-fog EDGE BURN actually reach the screen?
 *
 * `.hud-fogedge` is the HUD's "you are being killed right now" signal: four
 * `rgba(120,26,190,0.75)` ramps burning the frame's border while the player is outside
 * the ring. Violet is reserved project-wide for the fog — but by the time the player is
 * outside it, the ARENA ITSELF is under a violet fog curtain, so the signal and its
 * background are the same hue family. `docs/LESSONS.md` section 1 case 11 is exactly
 * this shape (a slow-effect ring in the same cyan as the puddle it sat on).
 *
 * Reasoning about that settles nothing, so this ABLATES it: shoot the danger frame,
 * hide the element, shoot again, and diff. `tools/tmp/occluder.mjs` and `vfx_ablate.mjs`
 * establish the technique — ablation is the only way to separate "the effect is absent"
 * from "the effect is present and indistinguishable".
 *
 * Reports, for the 11% border band the ramps actually cover and for a centre control:
 *   dLuma   mean luma change the element delivers
 *   dChroma mean |R-B| change (the violet cast it adds)
 *   ratio   WCAG contrast between the burnt border and the SAME border unburnt
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/hud_fogedge.mjs --url {URL}
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = arg('--out', 'shots/hud/fogedge');
mkdirSync(OUT, { recursive: true });

function relLum(r, g, b) {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function raw(p) { const { data, info } = await sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; }

/** Mean colour of a rect. */
function mean(px, W, x, y, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = (yy * W + xx) * 3; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
  return { r: r / n, g: g / n, b: b / n, n };
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto(`${BASE}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&fogRadius=300&px=1180&py=820`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
await page.waitForTimeout(2500);

// Freeze the breathe animation at its brightest so the ablation is not sampling a
// random phase of `hud-fogedge-breathe` (0.6 -> 1.0 opacity, 0.9 s).
await page.evaluate(() => {
  const e = document.querySelector('.hud-fogedge');
  e.style.animation = 'none';
  e.style.opacity = '1';
});
await page.waitForTimeout(300);
const on = await page.evaluate(() => !!document.querySelector('.hud-fogedge')?.classList.contains('is-on'));
await page.screenshot({ path: `${OUT}/on.png`, timeout: 180_000 });
await page.evaluate(() => { document.querySelector('.hud-fogedge').style.display = 'none'; });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/off.png`, timeout: 180_000 });
await browser.close();

const A = await raw(`${OUT}/on.png`);
const B = await raw(`${OUT}/off.png`);
const { W, H } = A;
// The ramps run to 9% of width on the sides and 11% of height top/bottom (hud.ts).
const BANDS = [
  ['left', 0, 0, Math.round(W * 0.09), H],
  ['right', W - Math.round(W * 0.09), 0, Math.round(W * 0.09), H],
  ['top', 0, 0, W, Math.round(H * 0.11)],
  ['bottom', 0, H - Math.round(H * 0.11), W, Math.round(H * 0.11)],
  ['CENTRE (control)', Math.round(W * 0.35), Math.round(H * 0.35), Math.round(W * 0.3), Math.round(H * 0.3)],
];
const rows = [];
console.log(`\n── fog edge burn, ablated (is-on = ${on}) ──`);
for (const [name, x, y, w, h] of BANDS) {
  const a = mean(A.d, W, x, y, w, h);
  const b = mean(B.d, W, x, y, w, h);
  const la = relLum(a.r, a.g, a.b), lb = relLum(b.r, b.g, b.b);
  const row = {
    band: name,
    onRGB: `${a.r.toFixed(0)},${a.g.toFixed(0)},${a.b.toFixed(0)}`,
    offRGB: `${b.r.toFixed(0)},${b.g.toFixed(0)},${b.b.toFixed(0)}`,
    dLuma: +(la * 255 - lb * 255).toFixed(2),
    dChroma: +(((a.r - a.b) - (b.r - b.b))).toFixed(2),
    ratio: +contrast(la, lb).toFixed(3),
  };
  rows.push(row);
  console.log(`  ${name.padEnd(17)} on ${row.onRGB.padStart(12)}  off ${row.offRGB.padStart(12)}   dLuma ${String(row.dLuma).padStart(7)}   dR-B ${String(row.dChroma).padStart(7)}   ratio ${row.ratio}`);
}
writeFileSync(`${OUT}/fogedge.json`, JSON.stringify({ on, rows }, null, 2));
console.log('');
