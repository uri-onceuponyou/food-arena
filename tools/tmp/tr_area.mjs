#!/usr/bin/env node
/**
 * TRAIL AREA + OCCLUSION — the two quantities the critics actually named, and the
 * reference band for each.
 *
 * ── Why this exists, and what it is NOT allowed to be ──────────────────────────
 *
 * `b967242` fixed the Sticky Trail's HUE (0.7 deg off the floor -> 22.4 deg) and the
 * critics' complaint did not move: 5 of 6 before, 5 of 6 after. What changed was the
 * adjective. Before: *"opaque flat-pink cloud swallows both fighters"*. After: *"a
 * large flat semi-transparent RED BLOB THAT COVERS A THIRD OF THE PLAY SPACE"*. Hue
 * was never the binding constraint (`docs/LESSONS.md` §6b — an acceptance test can
 * pass by 4.7 floors and move the score zero). The two nouns that survived the fix are
 * **AREA** and **SWALLOWS**, and nothing in this repo measured either.
 *
 * ⚠️ THE INSTRUMENT TRAP THIS EFFECT HAS ALREADY SPRUNG ONCE. `docs/LESSONS.md` §14:
 * `feel_probe.diff()` counted pixels changed in a REGION and saturated — a fog hit
 * (flash only, no VFX at all) read 3904 px while a weapon hit (flash PLUS the entire
 * impact burst) read 3879. So nothing here is a whole-region counter. Every number is
 * a SAME-FRAME ABLATION of the trail against itself: render, hide exactly the trail
 * meshes, render again, and take the pixels that moved. The floor, the cast, the
 * lighting, the post chain and the sim's own animation are bit-identical in both
 * captures and cancel exactly.
 *
 * ── The two metrics, with what fraction of the frame each governs ──────────────
 *
 *  AREA       the trail's delivered pixels as a share of the CANVAS. Governs 100% of
 *             the canvas as a denominator; the numerator is the trail alone.
 *             Also reported in units of the PLAYER'S OWN SILHOUETTE (also ablated),
 *             which is the framing-independent form — our camera and Brawl Stars'
 *             are not at the same zoom, and a share-of-frame comparison between two
 *             different focal lengths is a cross-quantity comparison of the kind
 *             `docs/LESSONS.md` §15b's corollary records.
 *
 *  OCCLUSION  the share of the PLAYER'S OWN PIXELS that the trail repaints. This is
 *             the "swallows the fighters" claim stated as something checkable, and it
 *             is `game/vfx.ts`'s hue-contract rule 2 ("may not repaint more than ~1/3
 *             of the cast's own pixels") pointed at a population it was never pointed
 *             at. Governs only the cast matte — 1-3% of the frame — which is exactly
 *             why it must be reported separately from AREA and never averaged with it.
 *
 * ── The reference band ─────────────────────────────────────────────────────────
 *
 * `--ref <png>` measures a ground effect in a reference plate by hue segmentation +
 * largest connected component + hole fill. That is a DIFFERENT quantity from an
 * ablation and may not be compared to one until it has been shown to recover the
 * ablation's answer. So `--ref` is also run on OUR OWN canvas capture, where the
 * ablation gives ground truth, and the disagreement between the two is reported as
 * the segmentation's error bar. A reference number quoted without that control is
 * exactly the sin §15b names.
 *
 *   node tools/tmp/tr_area.mjs --url $URL                     # live ablation
 *   node tools/tmp/tr_area.mjs --url $URL --selftest          # known-input controls only
 *   node tools/tmp/tr_area.mjs --ref reference/images/curated/gameplay_topdown/bs_05.png \
 *        --hue 296,348 --sat 0.30 --out shots/trail/ref
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = String(args.out ?? 'shots/trail/area');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
const DELTA = Number(args.delta ?? 6);
const ENEMY = String(args.enemy ?? 'donut');
/** Hard wall-clock cap on the "drive until the trail stops growing" loop. */
const DRIVE_CAP_MS = Number(args.drive ?? 75000);
/** Stop the drive the instant this many ground marks are live, so two arms of an A/B
 * carry the SAME population. 0 = drive to plateau (the "worst moment" question). */
const TARGET_MARKS = Number(args.marks ?? 0);

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const pct = (x) => `${(x * 100).toFixed(2)}%`;

// ───────────────────────────────────────────────────────────────────────────────
// SEGMENTATION (the reference side). Deliberately in ONE function so the identical
// code runs on the reference plate and on our own capture.
// ───────────────────────────────────────────────────────────────────────────────
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}
const inBand = (h, lo, hi) => (lo <= hi ? h >= lo && h <= hi : h >= lo || h <= hi);

/**
 * Largest connected component of a hue/sat band, with interior holes filled.
 *
 * Holes are filled by flood-filling the BACKGROUND from the frame border and calling
 * everything the flood never reached "inside" — so a cloud with bright speckles, a
 * crate sitting on top of it and a character standing in it all count as part of the
 * effect's FOOTPRINT, which is what "covers a third of the play space" means. Measured
 * without the fill, our own trail and the reference cloud would be scored on different
 * definitions (theirs is full of holes, ours is nearly solid).
 */
function segment(data, w, h, ch, { hueLo, hueHi, satMin, lumaMin = 0, lumaMax = 1 }) {
  const n = w * h;
  const raw = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [hh, ss, ll] = hsl(data[i * ch], data[i * ch + 1], data[i * ch + 2]);
    if (inBand(hh, hueLo, hueHi) && ss >= satMin && ll >= lumaMin && ll <= lumaMax) raw[i] = 1;
  }
  // Largest 4-connected component, iterative (a recursive flood blows the stack at 1176x700).
  const lab = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let best = -1, bestSize = 0, next = 0;
  for (let s = 0; s < n; s++) {
    if (!raw[s] || lab[s] >= 0) continue;
    const id = next++;
    let sp = 0, size = 0;
    stack[sp++] = s; lab[s] = id;
    while (sp) {
      const p = stack[--sp]; size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && raw[p - 1] && lab[p - 1] < 0) { lab[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && raw[p + 1] && lab[p + 1] < 0) { lab[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && raw[p - w] && lab[p - w] < 0) { lab[p - w] = id; stack[sp++] = p - w; }
      if (y < h - 1 && raw[p + w] && lab[p + w] < 0) { lab[p + w] = id; stack[sp++] = p + w; }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  const comp = new Uint8Array(n);
  if (best >= 0) for (let i = 0; i < n; i++) if (lab[i] === best) comp[i] = 1;

  // Fill interior holes: flood the NON-component region from the border.
  const outside = new Uint8Array(n);
  let sp = 0;
  const push = (p) => { if (!comp[p] && !outside[p]) { outside[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  const filled = new Uint8Array(n);
  let fillN = 0;
  for (let i = 0; i < n; i++) if (comp[i] || !outside[i]) { filled[i] = 1; fillN++; }
  return { raw, comp, filled, rawN: raw.reduce((a, b) => a + b, 0), compN: bestSize, filledN: fillN };
}

async function writeMask(pngPath, data, w, h, ch, mask, outPath) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
    if (mask[i]) { buf[i * 3] = 255; buf[i * 3 + 1] = 255; buf[i * 3 + 2] = 0; }
    else { buf[i * 3] = (r * 0.35) | 0; buf[i * 3 + 1] = (g * 0.35) | 0; buf[i * 3 + 2] = (b * 0.35) | 0; }
  }
  await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toFile(outPath);
}

/** Mean hue (saturation-weighted, circular), sat, L and L-stdev over a mask — the
 * IDENTICAL definition `tools/tmp/trail_probe.mjs` uses, so the reference band and our
 * own numbers are the same quantity. `docs/LESSONS.md` §3: never compare numbers across
 * instruments that define the quantity differently. */
function maskStats(data, w, h, ch, mask) {
  let sx = 0, sy = 0, ssum = 0, lsum = 0, l2 = 0, n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const [hh, ss, ll] = hsl(data[i * ch], data[i * ch + 1], data[i * ch + 2]);
    const a = (hh * Math.PI) / 180;
    sx += Math.cos(a) * ss; sy += Math.sin(a) * ss;
    ssum += ss; lsum += ll; l2 += ll * ll; n++;
  }
  if (!n) return null;
  let hm = (Math.atan2(sy, sx) * 180) / Math.PI; if (hm < 0) hm += 360;
  const mean = lsum / n;
  return { n, hue: +hm.toFixed(1), sat: +(ssum / n).toFixed(3), luma: +mean.toFixed(4),
    lStdev: +Math.sqrt(Math.max(0, l2 / n - mean * mean)).toFixed(4) };
}
/** A ring of `k` px OUTSIDE a mask — the surface the effect is drawn on, read at the
 * pixels immediately around it. This is the static-plate stand-in for the ablation's
 * "what would be under this pixel if the effect were not there", and it is the ONLY
 * honest one available on an image nobody can re-render. */
function ringOutside(mask, w, h, k) {
  let cur = Uint8Array.from(mask);
  for (let s = 0; s < k; s++) {
    const nx = Uint8Array.from(cur);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (cur[p]) continue;
      if ((x > 0 && cur[p - 1]) || (x < w - 1 && cur[p + 1]) || (y > 0 && cur[p - w]) || (y < h - 1 && cur[p + w])) nx[p] = 1;
    }
    cur = nx;
  }
  const ring = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (cur[i] && !mask[i]) ring[i] = 1;
  return ring;
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

async function refMode() {
  await mkdir(OUT, { recursive: true });
  const file = String(args.ref);
  const [hueLo, hueHi] = String(args.hue ?? '296,348').split(',').map(Number);
  const satMin = Number(args.sat ?? 0.30);
  const lumaMax = Number(args.lmax ?? 1);
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const seg = segment(data, w, h, ch, { hueLo, hueHi, satMin, lumaMax });
  const tag = file.split('/').pop().replace(/\.png$/, '');
  const maskPath = `${OUT}/${tag}.mask.png`;
  await writeMask(file, data, w, h, ch, seg.filled, maskPath);
  // The ring is 24 px out at 1600x900 / 1176x700 — wide enough to clear the effect's
  // own glow and narrow enough to stay on the same surface.
  const ring = ringOutside(seg.filled, w, h, Number(args.ring ?? 24));
  const eff = maskStats(data, w, h, ch, seg.filled);
  const grd = maskStats(data, w, h, ch, ring);
  log(`\n══ GROUND EFFECT FOOTPRINT — ${file} ═══════════════════════════════════════`);
  log(`  frame ${w}x${h} = ${w * h} px   ·   band hue ${hueLo}-${hueHi}, sat >= ${satMin}${lumaMax < 1 ? `, L <= ${lumaMax}` : ''}`);
  log(`  in-band pixels anywhere      ${pad(seg.rawN, 10)}${pct(seg.rawN / (w * h))}`);
  log(`  largest connected component  ${pad(seg.compN, 10)}${pct(seg.compN / (w * h))}`);
  log(`  ...with interior holes filled ${pad(seg.filledN, 9)}${pct(seg.filledN / (w * h))}   <- THE FOOTPRINT`);
  if (eff && grd) {
    log(`\n${pad('', 12)}${pad('hue', 9)}${pad('sat', 9)}${pad('luma', 9)}L stdev`);
    log(`  ${pad('EFFECT', 10)}${pad(eff.hue, 9)}${pad(eff.sat, 9)}${pad(eff.luma, 9)}${eff.lStdev}`);
    log(`  ${pad('GROUND', 10)}${pad(grd.hue, 9)}${pad(grd.sat, 9)}${pad(grd.luma, 9)}${grd.lStdev}   (${args.ring ?? 24} px ring outside)`);
    log(`  |dL| vs ground     ${Math.abs(eff.luma - grd.luma).toFixed(4)}`);
    log(`  hue distance       ${hueDist(eff.hue, grd.hue).toFixed(1)}°`);
    log(`  flatness           ${(eff.lStdev / Math.max(1e-6, grd.lStdev)).toFixed(3)}x   ( <1 = FLATTER than the ground it covers )`);
  }
  log(`  mask -> ${maskPath}   (LOOK AT IT — non-negotiable #3)`);
  await writeFile(`${OUT}/${tag}.json`, JSON.stringify({
    file, w, h, hueLo, hueHi, satMin,
    rawN: seg.rawN, compN: seg.compN, filledN: seg.filledN,
    shareRaw: seg.rawN / (w * h), shareComp: seg.compN / (w * h), shareFilled: seg.filledN / (w * h),
    effect: eff, ground: grd,
    dL: eff && grd ? +Math.abs(eff.luma - grd.luma).toFixed(4) : null,
    dHue: eff && grd ? +hueDist(eff.hue, grd.hue).toFixed(1) : null,
    flatness: eff && grd ? +(eff.lStdev / Math.max(1e-6, grd.lStdev)).toFixed(3) : null,
  }, null, 2));
}

// ───────────────────────────────────────────────────────────────────────────────
// LIVE MODE
// ───────────────────────────────────────────────────────────────────────────────
async function boot(page) {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; let base = realNow();
    performance.now = () => (paused ? virt : realNow() - base);
    window.__clk = {
      pause() { if (!paused) { virt = realNow() - base; paused = true; } },
      resume() { if (paused) { base = realNow() - virt; paused = false; } },
    };
  });
}

async function installHarness(page) {
  await page.evaluate(([rw, rh, delta]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = rw; cv.height = rh;
    const c2d = cv.getContext('2d', { willReadFrequently: true });
    const grab = () => {
      stage.render(0);
      c2d.clearRect(0, 0, rw, rh);
      c2d.drawImage(stage.canvas, 0, 0, rw, rh);
      return c2d.getImageData(0, 0, rw, rh).data;
    };
    const maskOf = (a, b) => {
      const s = new Uint8Array(rw * rh);
      let n = 0;
      for (let i = 0, p = 0; i < a.length; i += 4, p++) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d >= delta) { s[p] = 1; n++; }
      }
      return { s, n };
    };
    const andN = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] && b[i]) n++; return n; };
    // hsl + stats are VERBATIM `tools/tmp/trail_probe.mjs`'s, which are verbatim
    // `tools/tmp/vfx_hue.mjs`'s, deliberately: `game/vfx.ts`'s hue contract was written
    // against that formula and every recorded figure is comparable to it only if the
    // quantity is defined the same way (`docs/LESSONS.md` §3).
    const hsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0;
      if (d > 1e-6) {
        if (mx === r) h = ((g - b) / d) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
      }
      const l = (mx + mn) / 2;
      const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
      return [h, s, l];
    };
    const stats = (img, set) => {
      let sx = 0, sy = 0, ssum = 0, lsum = 0, l2 = 0, n = 0;
      for (let p = 0; p < set.length; p++) {
        if (!set[p]) continue;
        const i = p * 4;
        const [h, s, l] = hsl(img[i], img[i + 1], img[i + 2]);
        const a = (h * Math.PI) / 180;
        sx += Math.cos(a) * s; sy += Math.sin(a) * s;
        ssum += s; lsum += l; l2 += l * l; n++;
      }
      if (!n) return null;
      let hm = (Math.atan2(sy, sx) * 180) / Math.PI; if (hm < 0) hm += 360;
      const mean = lsum / n;
      return { n, hue: +hm.toFixed(1), sat: +(ssum / n).toFixed(3), luma: +mean.toFixed(4),
        lStdev: +Math.sqrt(Math.max(0, l2 / n - mean * mean)).toFixed(4) };
    };
    const hueD = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

    /**
     * The ground marks, split by GEOMETRY rather than by colour.
     *
     * `game/vfx.ts` builds one `trailGeo` and one `splatGeo` and shares each across
     * every mesh of that kind, so geometry uuid is the population split — and unlike a
     * colour split it survives a recolour of the very thing this probe exists to
     * re-tune. Grouping by MATERIAL would also work for the split but the save/restore
     * in `controlPaint` must be per material anyway (one material, N meshes: a
     * per-mesh save reads back what the previous mesh's write left there — verbatim
     * the `f12c9de` cast-matte bug), so both groupings are built here.
     */
    const layer = () => { let L = null; stage.scene.traverse((o) => { if (o.name === 'vfx_layer') L = o; }); return L; };
    const groundMarks = () => {
      const L = layer(); const out = [];
      if (L) L.traverse((o) => { if (o.isMesh && o.visible && o.renderOrder === 0) out.push(o); });
      return out;
    };
    const byGeo = () => {
      const m = new Map();
      for (const o of groundMarks()) {
        const k = o.geometry.uuid;
        if (!m.has(k)) m.set(k, { key: k, w: +o.geometry.parameters?.width?.toFixed?.(3), meshes: [] });
        m.get(k).meshes.push(o);
      }
      return [...m.values()].sort((a, b) => b.meshes.length - a.meshes.length);
    };
    const castRoot = (which) => {
      let hit = null;
      stage.scene.traverse((o) => {
        if (typeof o.name === 'string' && o.name.startsWith('character:') && o.visible) {
          if (which === 'any' || o.name.includes(which)) { if (!hit) hit = o; }
        }
      });
      return hit;
    };
    const castRoots = () => { const out = []; stage.scene.traverse((o) => { if (typeof o.name === 'string' && o.name.startsWith('character:') && o.visible) out.push(o); }); return out; };
    /**
     * ⚠️ THE PLAYER ONLY, and this is not a detail. The combined cast matte reads
     * whatever the OPPONENT happens to be made of: measured on this tree, donut+taco
     * gives a cast luma of 0.59-0.64 and donut+hamburger 0.42, so "|dL| mark -> cast"
     * swings from 0.075 to 0.30 on the enemy pick alone. Donut is the only character
     * with `hasTrail` and is therefore the only one guaranteed to be standing in it, so
     * DONUT is the population every mark-vs-cast number here is measured against. A
     * combined matte answers a question nobody asked.
     *
     * Identified by GEOMETRY, not by scene order or by name: in donut-vs-donut both
     * roots are called `character:donut`, and traverse order is an add-order accident.
     * `__vfxDebugFighters` publishes both fighters' SIM positions, and world x/z are
     * monotone in sim x/y, so the sign of the world separation against the sign of the
     * sim separation picks the assignment unambiguously.
     */
    const playerRoot = () => {
      const c = castRoots();
      if (c.length < 2) return c.slice(0, 1);
      const f = window.__vfxDebugFighters;
      if (!f?.player || !f?.enemy) return null;   // refuse to guess — LESSONS §15b
      const dSimX = f.player.x - f.enemy.x;
      const dSimY = f.player.y - f.enemy.y;
      const p0 = c[0].getWorldPosition(c[0].position.clone());
      const p1 = c[1].getWorldPosition(c[1].position.clone());
      const dWx = p0.x - p1.x, dWz = p0.z - p1.z;
      // Use whichever axis the two fighters are better separated on.
      const useX = Math.abs(dSimX) >= Math.abs(dSimY);
      const agree = useX ? (dWx > 0) === (dSimX > 0) : (dWz > 0) === (dSimY > 0);
      return [agree ? c[0] : c[1]];
    };

    const hideAll = (objs) => { const prev = objs.map((o) => o.visible); objs.forEach((o) => { o.visible = false; }); return () => objs.forEach((o, i) => { o.visible = prev[i]; }); };

    window.__tr = {
      census() {
        const g = byGeo();
        return {
          marks: groundMarks().length,
          casts: castRoots().map((o) => o.name),
          geo: g.map((x) => ({ w: x.w, n: x.meshes.length })),
        };
      },
      /**
       * THE HEADLINE — AREA, by same-frame ablation of one geometry group.
       * `which` is the index into `byGeo()` (0 = the biggest group = the trail).
       */
      area(which) {
        const g = byGeo();
        const target = which === 'all' ? groundMarks() : (g[which]?.meshes ?? []);
        if (!target.length) return { n: 0 };
        const on = grab();
        const restore = hideAll(target);
        const off = grab();
        restore();
        const { s, n } = maskOf(on, off);
        return { n, share: n / (rw * rh), mask: null, _s: s };
      },
      /**
       * THE OTHER HEADLINE — OCCLUSION. Cast pixels the trail REPAINTS.
       *
       * The cast matte is itself an ablation (hide the character, diff), so it is the
       * character's true silhouette in this exact frame, not a box. The trail mask is
       * the ablation above. The intersection is the answer, and it is the only form of
       * "swallows the fighters" that is checkable: a ground decal at 0.31 m with
       * depthTest on CANNOT draw over a fighter standing on it, so anything this finds
       * is bloom crossing the silhouette — which is real, and is the thing rule 2 of
       * the hue contract governs.
       */
      occlusion(which) {
        const casts = playerRoot();
        if (!casts || !casts.length) return null;
        const g = byGeo();
        const target = which === 'all' ? groundMarks() : (g[which]?.meshes ?? []);
        if (!target.length) return null;
        const shipped = grab();
        // cast matte
        const rc = hideAll(casts);
        const noCast = grab();
        rc();
        const cast = maskOf(shipped, noCast);
        // trail mask, same frame
        const rt = hideAll(target);
        const noTrail = grab();
        rt();
        const trail = maskOf(shipped, noTrail);
        // ⚠️ THE RAW MATTE OVERSTATES THIS AND THE OVERSTATEMENT IS ALL BOUNDARY.
        // `maskOf(shipped, noCast)` includes the character's ANTIALIASED EDGE, whose
        // pixels are a blend of cast and whatever is behind — so every one of them
        // legitimately changes when the ground under it changes, and counting them as
        // "cast pixels the trail repainted" charges the trail for the cast's own alpha.
        // It is the same fault the predecessor probe's missing guard ring had
        // (`trail_probe.mjs:bandsOf`). Eroding twice leaves pure cast pixels; both are
        // reported because they answer different questions and the gap between them IS
        // the boundary term.
        let core = Uint8Array.from(cast.s);
        for (let e = 0; e < 2; e++) {
          const nx = new Uint8Array(core.length);
          for (let y = 1; y < rh - 1; y++) for (let x = 1; x < rw - 1; x++) {
            const p = y * rw + x;
            if (core[p] && core[p - 1] && core[p + 1] && core[p - rw] && core[p + rw]) nx[p] = 1;
          }
          core = nx;
        }
        let coreN = 0; for (let i = 0; i < core.length; i++) if (core[i]) coreN++;
        return {
          castPx: cast.n, castCorePx: coreN, trailPx: trail.n,
          overlapPx: andN(cast.s, trail.s),
          overlapCorePx: andN(core, trail.s),
          repaintShareOfCast: cast.n ? andN(cast.s, trail.s) / cast.n : 0,
          repaintShareOfCore: coreN ? andN(core, trail.s) / coreN : 0,
          trailPerCast: cast.n ? trail.n / cast.n : 0,
        };
      },
      /**
       * COLOUR — the mark's own pixels against the floor those pixels would have shown,
       * and against the CAST standing in it, all in one frozen frame. Same definitions
       * as `trail_probe.mjs`; reported here so ONE run at a measured steady state gives
       * every number, instead of two runs at two different mark counts.
       */
      colour(which) {
        const g = byGeo();
        const target = which === 'all' ? groundMarks() : (g[which]?.meshes ?? []);
        const casts = playerRoot() ?? [];
        if (!target.length) return null;
        const shipped = grab();
        const rt = hideAll(target);
        const noTrail = grab();
        rt();
        const trail = maskOf(shipped, noTrail);
        if (!trail.n) return null;
        const mark = stats(shipped, trail.s);
        const floor = stats(noTrail, trail.s);
        let cast = null, dLcast = null, dHcast = null;
        if (casts.length) {
          const rc = hideAll(casts);
          const noCast = grab();
          rc();
          let cs = maskOf(shipped, noCast).s;
          // eroded twice: PURE cast pixels, no antialiased boundary (see `occlusion`)
          for (let e = 0; e < 2; e++) {
            const nx = new Uint8Array(cs.length);
            for (let y = 1; y < rh - 1; y++) for (let x = 1; x < rw - 1; x++) {
              const p = y * rw + x;
              if (cs[p] && cs[p - 1] && cs[p + 1] && cs[p - rw] && cs[p + rw]) nx[p] = 1;
            }
            cs = nx;
          }
          cast = stats(shipped, cs);
          if (cast) { dLcast = +Math.abs(mark.luma - cast.luma).toFixed(4); dHcast = +hueD(mark.hue, cast.hue).toFixed(1); }
        }
        return {
          mark, floor, cast,
          dLfloor: +Math.abs(mark.luma - floor.luma).toFixed(4),
          dHfloor: +hueD(mark.hue, floor.hue).toFixed(1),
          flatness: +(mark.lStdev / Math.max(1e-6, floor.lStdev)).toFixed(3),
          dLcast, dHcast,
        };
      },
      /** KNOWN-INPUT CONTROL A — nothing visible must ablate to nothing. */
      controlHidden() {
        const target = groundMarks();
        const restore = hideAll(target);
        const r = window.__tr.area('all');
        restore();
        return r;
      },
      /** KNOWN-INPUT CONTROL B — a mesh set the probe was NOT told about must be
       * recovered at its true size. Scale every trail mark 2x in-plane: the ablated
       * area must grow, and must not grow by more than 4x. A counter that saturates
       * (LESSONS §14) fails this and a linear one passes it. */
      controlScale(k) {
        const g = byGeo();
        const target = g[0]?.meshes ?? [];
        const saved = target.map((o) => o.scale.clone());
        target.forEach((o) => o.scale.multiplyScalar(k));
        const r = window.__tr.area(0);
        target.forEach((o, i) => o.scale.copy(saved[i]));
        return r;
      },
      /** KNOWN-INPUT CONTROL C — the same measurement twice, untouched. The spread is
       * this metric's RESOLUTION FLOOR and nothing smaller may be acted on. */
      repeat(which) { const a = window.__tr.area(which); const b = window.__tr.area(which); return { a: a.n, b: b.n }; },
      shot() { stage.render(0); },
    };
  }, [RW, RH, DELTA]);
}

/** How many ground marks are alive, without needing the harness. */
async function markCount(page) {
  return page.evaluate(() => {
    const stage = window.__stage;
    let L = null;
    stage.scene.traverse((o) => { if (o.name === 'vfx_layer') L = o; });
    let n = 0;
    if (L) L.traverse((o) => { if (o.isMesh && o.visible && o.renderOrder === 0) n++; });
    return n;
  });
}

async function liveMode(urlOverride) {
  const pageBase = (urlOverride ?? BASE).replace(/\/$/, '');
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let failures = 0;
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await boot(page);
    // Donut is the only character with `hasTrail`. Default enemy is ALSO Donut: two
    // trails is the shipped worst case for this effect and "worst moment in a real
    // match" is what the brief asks for. `--enemy hamburger` gives the one-trail case.
    await page.goto(`${pageBase}/?player=donut&enemy=${ENEMY}&simSpeed=1&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120000 });

    // ── DRIVE TO STEADY STATE, and do not assume when that is ──────────────────
    //
    // ⚠️ The predecessor probe held each key for 1200 ms and got NINE marks against
    // the 28 that `TRAIL.durationMs / dropIntervalMs` predicts. It was not a small
    // trail: `match.ts:1056` steps the sim on `Math.min(clock.getDelta(), 1/20)`, so a
    // SwiftShader frame that takes 200 ms of wall clock advances the sim by 50 ms.
    // Headless, the sim runs at roughly a quarter of real time and a fixed wall-clock
    // drive measures the RENDERER'S FRAME RATE, not the trail (LESSONS §10 — a probe
    // that measures its own setup). So: drive until the live mark count stops rising,
    // and report the count against the analytic ceiling.
    const keys = ['d', 'd', 's', 's', 'a', 'a', 'w', 'w'];
    let ki = 0;
    let best = 0, flat = 0;
    const t0 = Date.now();
    const trace = [];
    while (Date.now() - t0 < DRIVE_CAP_MS) {
      const k = keys[ki++ % keys.length];
      await page.keyboard.down(k);
      await page.waitForTimeout(500);
      await page.keyboard.up(k);
      const n = await markCount(page);
      trace.push(n);
      if (n > best) { best = n; flat = 0; } else { flat++; }
      // ⚠️ STOP ON A MARK COUNT, NOT ON A CLOCK. Two runs of the same tree that stop at
      // different mark counts are not an A/B — the predecessor probe's before/after
      // pair was taken at 9 marks and 6, and a third of the "change" was the count.
      // With `--marks N` both arms carry the same population and the only difference
      // left is the edit.
      if (TARGET_MARKS && n >= TARGET_MARKS) break;
      if (!TARGET_MARKS && flat >= 6 && best >= 12) break;
    }
    if (TARGET_MARKS && best < TARGET_MARKS) {
      log(`  ⚠️ asked for ${TARGET_MARKS} marks, drive plateaued at ${best} — NOT comparable to a run that reached it.`);
      failures++;
    }
    log(`  mark-count trace: ${trace.join(' ')}`);
    log(`  peak live ground marks: ${best}   (analytic ceiling for one Donut = 4500/160 = 28)`);
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await installHarness(page);

    const census = await page.evaluate(() => window.__tr.census());
    log(`\nlive ground marks: ${census.marks}   ·   casts: ${census.casts.join(', ')}`);
    for (const g of census.geo) log(`    geometry width ${g.w} wu   x${g.n}`);
    if (census.marks < 8) { log(`ONLY ${census.marks} MARKS — the drive failed, nothing below is a worst case.`); failures++; }

    // ── KNOWN-INPUT CONTROLS ───────────────────────────────────────────────────
    const hidden = await page.evaluate(() => window.__tr.controlHidden());
    const rep = await page.evaluate(() => window.__tr.repeat(0));
    const base = await page.evaluate(() => window.__tr.area(0));
    const s2 = await page.evaluate(() => window.__tr.controlScale(2));
    const floorPx = Math.abs(rep.a - rep.b);
    log('\n══ INSTRUMENT VALIDATION (known inputs) ═══════════════════════════════════');
    log(`  A every mark hidden          n=${pad(hidden.n, 10)}(want 0)`);
    log(`  B same measurement twice     ${pad(rep.a, 8)}/ ${pad(rep.b, 8)}spread ${floorPx} px = ${pct(floorPx / (RW * RH))}  <- RESOLUTION FLOOR`);
    log(`  C every trail mark scaled 2x ${pad(s2.n, 8)}vs ${pad(base.n, 8)}ratio ${(s2.n / Math.max(1, base.n)).toFixed(2)}x  (want >1.3x and <=4x — a SATURATED counter reads ~1.0x)`);
    const ratio = s2.n / Math.max(1, base.n);
    const ok = hidden.n === 0 && base.n > 500 && floorPx <= Math.max(60, base.n * 0.02) && ratio > 1.3 && ratio <= 4.2;
    log(ok ? '  → INSTRUMENT VALID' : '  → INSTRUMENT INVALID — nothing below is trustworthy');
    if (!ok) failures++;
    if (args.selftest) { await browser.close(); process.exit(ok ? 0 : 1); }

    // ── AREA ───────────────────────────────────────────────────────────────────
    const all = await page.evaluate(() => window.__tr.area('all'));
    const occ = await page.evaluate(() => window.__tr.occlusion(0));
    log('\n══ AREA — the trail\'s delivered pixels, by same-frame ablation ════════════');
    log(`  canvas ${RW}x${RH} = ${RW * RH} px  (WebGL canvas; the DOM HUD is not in it)`);
    log(`  TRAIL only        ${pad(base.n, 10)}${pct(base.share)} of canvas`);
    log(`  all ground marks  ${pad(all.n, 10)}${pct(all.share)} of canvas`);
    if (occ) {
      log(`  cast silhouette   ${pad(occ.castPx, 10)}${pct(occ.castPx / (RW * RH))} of canvas   (core, eroded 2: ${occ.castCorePx})`);
      log(`  TRAIL / CAST      ${(occ.trailPerCast).toFixed(2)}x    <- framing-independent: the trail is this many character silhouettes`);
      log('\n══ OCCLUSION — "it swallows the fighters", stated checkably ═══════════════');
      log(`  cast pixels repainted, WHOLE matte  ${pad(occ.overlapPx, 8)}= ${pct(occ.repaintShareOfCast)}  (includes the antialiased edge — overstates)`);
      log(`  cast pixels repainted, CORE only    ${pad(occ.overlapCorePx, 8)}= ${pct(occ.repaintShareOfCore)}  <- THE NUMBER`);
      log('  (hue-contract rule 2 allows ~1/3 = 33%. A ground decal with depthTest on cannot');
      log('   draw over a fighter standing on it, so anything here is bloom crossing the edge.)');
    }

    const col = await page.evaluate(() => window.__tr.colour(0));
    if (col) {
      log('\n══ COLOUR — the mark, the floor it covers, the cast standing in it ════════');
      log(`${pad('', 12)}${pad('hue', 9)}${pad('sat', 9)}${pad('luma', 9)}L stdev`);
      log(`  ${pad('MARK', 10)}${pad(col.mark.hue, 9)}${pad(col.mark.sat, 9)}${pad(col.mark.luma, 9)}${col.mark.lStdev}`);
      log(`  ${pad('FLOOR', 10)}${pad(col.floor.hue, 9)}${pad(col.floor.sat, 9)}${pad(col.floor.luma, 9)}${col.floor.lStdev}`);
      if (col.cast) log(`  ${pad('CAST', 10)}${pad(col.cast.hue, 9)}${pad(col.cast.sat, 9)}${pad(col.cast.luma, 9)}${col.cast.lStdev}   (core, eroded 2)`);
      log(`\n  |dL| vs floor      ${col.dLfloor}    (rule 3 asks >= 0.10 DOWNWARD)`);
      log(`  hue dist vs floor  ${col.dHfloor}°`);
      log(`  flatness           ${col.flatness}x    (<1 = FLATTER than the floor;  reference bs_05 = 1.209x)`);
      log(`  mark L stdev       ${col.mark.lStdev}    (reference bs_05 effect = 0.1371)`);
      log(`  |dL| vs CAST       ${col.dLcast}    (hue contract asks >= 0.15)   hue dist ${col.dHcast}°`);
    }

    await page.evaluate(() => window.__tr.shot());
    const canvasPng = `${OUT}/canvas.png`;
    const el = await page.$('canvas');
    await el.screenshot({ path: canvasPng });
    await page.screenshot({ path: `${OUT}/frame.png` });
    await writeFile(`${OUT}/area.json`, JSON.stringify({
      base: pageBase, enemy: ENEMY, peakMarks: best, census,
      trailPx: base.n, trailShare: base.share, allPx: all.n, allShare: all.share,
      occlusion: occ, colour: col, resolutionFloorPx: floorPx, scale2Ratio: ratio,
    }, null, 2));
    log(`\npng -> ${canvasPng} + ${OUT}/frame.png   json -> ${OUT}/area.json`);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
}

/**
 * `--snap` — own the snapshot for the length of THIS run.
 *
 * `tools/tmp/with_snapshot.mjs` is the right tool for a single command but it does not
 * pass `--swap`, so it freezes `src/game/vfx.ts` too and an edit to the file under test
 * never reaches the page. `tools/tmp/snap_hold.mjs` does pass `--swap` and holds one
 * snapshot across an edit, which is exactly what a before/after wants — but held in the
 * background across several tool calls it was torn down under this probe THREE times in
 * one session, and a run that dies at `ERR_CONNECTION_REFUSED` after a two-minute drive
 * costs the whole measurement.
 *
 * So this owns its own: spawn `tools/snapshot.mjs --json --swap src/game/vfx.ts`, read
 * the URL off its stdout, measure, tear it down. One process, nothing to leak, nothing
 * for a peer's `snapsweep` to reach. `--swap` keeps MY file live and everything else
 * frozen, which is the whole point (`docs/LESSONS.md` §5).
 */
async function withOwnSnapshot(run) {
  const swaps = String(args.snap === true ? 'src/game/vfx.ts' : args.snap).split(',');
  const a = ['tools/snapshot.mjs', '--json'];
  for (const s of swaps) a.push('--swap', s);
  // ⚠️ `--tree <dir>` — SNAPSHOT SOMEBODY ELSE'S TREE, and this is not a convenience.
  // `tools/snapshot.mjs` copies the WORKING tree, which freezes peers OUT of the future
  // and not out of the present: taken mid-session it captures whatever half-saved state
  // five concurrent agents happen to be in. Two arms of this A/B taken 40 minutes apart
  // landed on two different trees and the second pair was garbage — cast luma 0.86 at
  // hue 248, a 7.7%-of-canvas "silhouette", and `THREE.WebGLState: MultiplyBlending
  // requires material.premultipliedAlpha` on every frame, none of it mine. Point this at
  // a `git worktree add --detach <dir> HEAD` (node_modules symlinked in) and every arm
  // measures against the SAME committed tree, with only the file under test varying.
  const cwd = args.tree ? String(args.tree) : process.cwd();
  const snap = spawn('node', a, { stdio: ['ignore', 'pipe', 'inherit'], cwd });
  const rl = readline.createInterface({ input: snap.stdout });
  const info = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('snapshot did not print JSON within 180s')), 180000);
    rl.on('line', (line) => { try { const o = JSON.parse(line); if (o?.url) { clearTimeout(t); res(o); } } catch { /* not the JSON line */ } });
    snap.on('exit', (c) => { clearTimeout(t); rej(new Error(`snapshot exited ${c} before printing a URL`)); });
  });
  log(`  [snap] ${info.url}   swaps: ${swaps.join(', ')}`);
  try { return await run(info.url); } finally { snap.kill('SIGTERM'); }
}

if (args.ref) await refMode();
else if (args.snap) await withOwnSnapshot((url) => liveMode(url));
else await liveMode();
