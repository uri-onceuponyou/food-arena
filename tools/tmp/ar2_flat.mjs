#!/usr/bin/env node
/**
 * AR2_FLAT — is the stove island's top face actually FLAT, on the tree that ships today?
 *
 * ## The sentence being tested
 *
 * A blind critic, on a frozen 2026-08-05 baseline frame:
 *
 *   > *"Give the large flat pale-blue slab and the crude striped brown rectangle on it real
 *   > surface shading and edge definition, since as drawn they read as untextured placeholder
 *   > geometry occupying the lower half of the frame."*
 *
 * The slab is **`stove_counter`** — `props/counters.ts:buildStoveIsland`, cap material
 * `stoveCap` `#94C5FF`, on a 170 × 90 wu box, *"the arena's largest cover"* by that file's own
 * note. The brown rectangle on it is **`stove_hob`** (`#7A6A52`) under `stove_hob_lip`. Four of
 * them ring the hub at `CENTER ± 320, ± 240`, which is why one is in almost every hub frame.
 *
 * The reported numbers (slab luma sd **2.69** vs tiled floor sd **14.55**, 5.4× flatter) were
 * measured on a frame that **predates every arena commit since**. `docs/AGENT-BRIEF.md` §4.7:
 * a baseline is itself a measurement. So this re-measures both on a CURRENT render.
 *
 * ## How the sample regions are chosen — not by eye, and not by a typed rectangle
 *
 * Both rects are **projected through the live camera** from world geometry:
 *  * the slab rect is the mesh's own world AABB top face, projected and inset 22% so no
 *    sample lands on the silhouette edge, the hob, or a stockpot;
 *  * the floor rect is a world-space square on `y = 0` at an offset that `ar2_frame`'s box
 *    data says holds no cover and no concealment box, projected the same way.
 * Nothing is a screen-space constant, so this survives a camera change.
 *
 * ## 🚨 THE SAMPLE MASK IS AN ABLATION, NOT A RECTANGLE — AND THE RECTANGLE VERSION WAS WRONG
 *
 * The first version projected the island's CoverBox top face and inset it 22%. Its known-bad
 * caught it: repainting the cap magenta moved the sampled mean by **Δrgb 6.4**, and the rect's
 * own mean was **rgb 162,133,84** — warm brown, when `stoveCap` is `#94C5FF` pale blue. The
 * inset rect had landed squarely on the `stove_hob` and the two stockpots that sit in the
 * middle of every island, i.e. it was measuring the clutter and calling it the slab. A guard
 * that had not been shown to fail would have shipped that number.
 *
 * So the mask is built the way `docs/AGENT-BRIEF.md` §4.2 demands: **ablate to an unmissable
 * colour and take the pixels that ARE that colour.** One page repaints the cap unlit magenta;
 * the mask is every strongly-magenta pixel inside the island's projected bounds. A second page
 * does the same to whatever mesh a raycast through the floor sample point actually hits, so the
 * floor comparison is not a typed rectangle either. The statistics are then read off the
 * UNMODIFIED frame within those masks.
 *
 * That also makes the instrument immune to the live page: the frame animates (dust, idle, HUD
 * CSS), so an A-vs-B pixel DIFF would carry that motion. "Is this pixel magenta" does not.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-ar2 -- \
 *     node tools/tmp/ar2_flat.mjs --url '{URL}' --out tools/tmp/ar2_flat_out
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const has = (k) => argv.includes('--' + k);
const BASE = arg('url', process.env.PREVIEW_BASE ?? '');
if (!BASE) { console.error('ar2_flat: --url or PREVIEW_BASE required'); process.exit(2); }
const OUT = arg('out', 'tools/tmp/ar2_flat_out');
const W = Number(arg('w', 1600)), H = Number(arg('h', 900));
mkdirSync(OUT, { recursive: true });

// Player stands SOUTH of the hub's NW stove island (CENTER 1400,1000 minus 320,240 = 1080,760),
// so the island sits up-frame, unobstructed, and large. Derived from the same offsets
// `kitchen.ts` declares; nothing here is a screen coordinate.
const STATION = { id: 'stove_nw', px: Number(arg('px', 1080)), py: Number(arg('py', 950)) };
// A patch of tiled floor with no cover and no concealment box, offset from the player so the
// character's own body and contact shadow are nowhere near it.
const FLOOR_AT = { x: Number(arg('fx', 1300)), y: Number(arg('fy', 980)), half: 45 };

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });

/** Luma mean / sd over an axis-aligned rect of a raw RGB buffer. */
function stats(raw, w, rect) {
  const { x0, y0, x1, y1 } = rect;
  let n = 0, s = 0, s2 = 0, r = 0, g = 0, b = 0;
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, Math.round(y1)); y++) {
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(w, Math.round(x1)); x++) {
      const i = (y * w + x) * 3;
      const L = 0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2];
      n++; s += L; s2 += L * L; r += raw[i]; g += raw[i + 1]; b += raw[i + 2];
    }
  }
  if (!n) return null;
  const mean = s / n;
  return { n, mean, sd: Math.sqrt(Math.max(0, s2 / n - mean * mean)), rgb: [r / n, g / n, b / n] };
}

const MAGENTA = (raw, i) => raw[i] > 190 && raw[i + 1] < 110 && raw[i + 2] > 190;

/** Luma mean / sd over an explicit boolean mask. */
function maskedStats(raw, w, h, mask) {
  let n = 0, s = 0, s2 = 0, r = 0, g = 0, b = 0;
  for (let k = 0; k < w * h; k++) {
    if (!mask[k]) continue;
    const i = k * 3;
    const L = 0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2];
    n++; s += L; s2 += L * L; r += raw[i]; g += raw[i + 1]; b += raw[i + 2];
  }
  if (!n) return null;
  const mean = s / n;
  return { n, mean, sd: Math.sqrt(Math.max(0, s2 / n - mean * mean)), rgb: [r / n, g / n, b / n] };
}

async function shot(label, mode) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${STATION.px}&py=${STATION.py}&fogRadius=1720&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await page.waitForTimeout(1500);

  const geo = await page.evaluate(({ mode, floorAt, W, H }) => {
    const stage = window.__stage;
    if (!stage) return { error: 'no __stage' };
    const scene = stage.scene, cam = stage.rig.camera;
    cam.updateMatrixWorld(true);
    const arena = window.__matchArena;
    if (!arena) return { error: 'no __matchArena' };

    // 🚨 THE PROP HAS NO PER-INSTANCE MESH ANY MORE. `5aa4655` merged the arena's 1,908 static
    // props into ONE MESH PER MATERIAL to take the phone from 928 draws to 423, so
    // `o.name === 'stove_counter'` finds nothing and reads exactly like "the prop was deleted".
    // The surviving handle is `props:stove_counter:<n>`, one merged mesh for ALL ten islands —
    // which is why the mask has to be intersected with one island's projected bounds below.
    const caps = [];
    scene.traverse((o) => { if (o.isMesh && /(^|:)stove_counter(:|$)/.test(o.name || '')) caps.push(o); });
    if (!caps.length) return { error: 'no mesh matching /stove_counter/ — renamed, or not built' };

    const islands = arena.cover.filter((c) => c.kind === 'stove_island');
    if (!islands.length) return { error: 'ZERO stove_island CoverBoxes — every number would be vacuous' };

    const V = cam.position.constructor;
    const toPx = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; };
    const WS = 0.05;
    let topY = 0;
    for (const m of caps) { m.updateWorldMatrix(true, false); m.geometry.computeBoundingBox(); topY = Math.max(topY, m.geometry.boundingBox.max.y); }

    // The island whose projected top face has the largest ON-SCREEN area, needing >=60% of the
    // face visible: a face 90% off the edge would sample a sliver and call it a slab.
    let best = null;
    const seen = [];
    for (const b of islands) {
      const pts = [
        toPx(new V((b.x - b.w / 2) * WS, topY, (b.y - b.h / 2) * WS)),
        toPx(new V((b.x + b.w / 2) * WS, topY, (b.y - b.h / 2) * WS)),
        toPx(new V((b.x + b.w / 2) * WS, topY, (b.y + b.h / 2) * WS)),
        toPx(new V((b.x - b.w / 2) * WS, topY, (b.y + b.h / 2) * WS)),
      ];
      // The cap's own base, so the bounds cover the whole prop face however it foreshortens.
      const base = [
        toPx(new V((b.x - b.w / 2) * WS, 0, (b.y - b.h / 2) * WS)),
        toPx(new V((b.x + b.w / 2) * WS, 0, (b.y + b.h / 2) * WS)),
      ];
      const xs = [...pts, ...base].map((p) => p[0]), ys = [...pts, ...base].map((p) => p[1]);
      const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
      const full = (bx1 - bx0) * (by1 - by0);
      const cw = Math.max(0, Math.min(bx1, W) - Math.max(bx0, 0));
      const ch = Math.max(0, Math.min(by1, H) - Math.max(by0, 0));
      const area = cw * ch;
      seen.push({ at: [b.x, b.y], x: [Math.round(bx0), Math.round(bx1)], y: [Math.round(by0), Math.round(by1)], on: full ? +(area / full).toFixed(2) : 0 });
      if (!full || area / full < 0.6) continue;
      if (!best || area > best.area) best = { area, bounds: { x0: Math.max(bx0, 0), y0: Math.max(by0, 0), x1: Math.min(bx1, W), y1: Math.min(by1, H) }, world: [b.x, b.y, b.w, b.h, topY] };
    }
    if (!best) return { error: 'no stove_island is >=60% on screen at this station', topY, seen };

    // The floor sample point, projected from world, and the mesh a ray through it actually hits.
    const f = floorAt;
    const fp = [
      toPx(new V((f.x - f.half) * WS, 0, (f.y - f.half) * WS)),
      toPx(new V((f.x + f.half) * WS, 0, (f.y - f.half) * WS)),
      toPx(new V((f.x + f.half) * WS, 0, (f.y + f.half) * WS)),
      toPx(new V((f.x - f.half) * WS, 0, (f.y + f.half) * WS)),
    ];
    const fxs = fp.map((p) => p[0]), fys = fp.map((p) => p[1]);
    const floorBounds = { x0: Math.min(...fxs), y0: Math.min(...fys), x1: Math.max(...fxs), y1: Math.max(...fys) };

    // The FLOOR ablation. A ray-pick found `floor_mat_edge_wear` — a transparent decal that
    // repaints to nothing — so the target is named directly instead: the tile field is the pair
    // of materials `kpal:tileLight` / `kpal:tileDark` (`shared.ts:buildMaterials`), and the
    // magenta mask then proves which of them was actually on screen.
    let floorHit = null;
    if (mode === 'floor') {
      const hits = [];
      scene.traverse((m) => { if (m.isMesh && /tileLight|tileDark/.test(m.material?.name || '')) hits.push(m); });
      if (!hits.length) return { error: 'no mesh carrying kpal:tileLight / kpal:tileDark — the tile field was renamed' };
      floorHit = hits.map((m) => `${m.name || '(anon)'}:${m.material.name}`).join(',');
      for (const m of hits) {
        const flat = new m.material.constructor({ color: 0xff00ff });
        if ('emissive' in flat) flat.emissive.setHex(0xff00ff);
        if ('roughness' in flat) flat.roughness = 1;
        m.material = flat;
      }
    }

    if (mode === 'slab') {
      for (const m of caps) {
        const flat = new m.material.constructor({ color: 0xff00ff });
        if ('emissive' in flat) flat.emissive.setHex(0xff00ff);
        if ('roughness' in flat) flat.roughness = 1;
        m.material = flat;
      }
    }
    stage.render?.(1 / 60);
    return { caps: caps.length, bounds: best.bounds, floorBounds, world: best.world, floorHit, seen };
  }, { mode, floorAt: FLOOR_AT, W, H });

  if (geo.error) { await page.close(); console.error('DEBUG', JSON.stringify(geo).slice(0, 1200)); throw new Error(geo.error); }
  const path = `${OUT}/${label}.png`;
  await page.locator('canvas').screenshot({ path });
  await page.close();
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { label, path, geo, raw: data, w: info.width, h: info.height };
}

const A = await shot('base', 'none');
const S = await shot('kb_slab', 'slab');
const F = await shot('kb_floor', 'floor');
await browser.close();

/** Magenta pixels inside `bounds` — the ablation mask. */
function maskFrom(img, bounds) {
  const mask = new Uint8Array(img.w * img.h);
  let n = 0;
  for (let y = Math.max(0, Math.floor(bounds.y0)); y < Math.min(img.h, Math.ceil(bounds.y1)); y++) {
    for (let x = Math.max(0, Math.floor(bounds.x0)); x < Math.min(img.w, Math.ceil(bounds.x1)); x++) {
      const k = y * img.w + x;
      if (MAGENTA(img.raw, k * 3)) { mask[k] = 1; n++; }
    }
  }
  return { mask, n };
}

const slabMask = maskFrom(S, S.geo.bounds);
const floorMask = maskFrom(F, F.geo.floorBounds);
const slab = maskedStats(A.raw, A.w, A.h, slabMask.mask);
const floor = maskedStats(A.raw, A.w, A.h, floorMask.mask);
if (!slab || !floor) {
  console.error(`🔴 ar2_flat: a mask is EMPTY (slab ${slabMask.n} px, floor ${floorMask.n} px) — every statistic would be vacuous.`);
  process.exit(1);
}
const fmt = (s) => s ? `n=${s.n}  luma mean ${s.mean.toFixed(2)}  sd ${s.sd.toFixed(2)}  rgb ${s.rgb.map((v) => v.toFixed(0)).join(',')}` : 'EMPTY';

console.log(`\n══ AR2 FLAT ══  station (${STATION.px},${STATION.py})  island ${JSON.stringify(A.geo.world)}  floor mesh ${F.geo.floorHit}`);
console.log(`   slab  bounds ${JSON.stringify(S.geo.bounds).replace(/"/g, '')}`);
console.log(`   floor bounds ${JSON.stringify(F.geo.floorBounds).replace(/"/g, '')}\n`);
console.log(`   SLAB  (unmodified frame, ablation mask)  ${fmt(slab)}`);
console.log(`   FLOOR (unmodified frame, ablation mask)  ${fmt(floor)}`);

let fail = 0;
const check = (label, ok, detail) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${label}  [${detail}]`); if (!ok) fail++; };
console.log('\n§0 — NON-EMPTY: a mask of zero pixels makes every statistic below vacuous');
check('the slab ablation mask is non-empty', slabMask.n > 2000, `${slabMask.n} px`);
check('the floor ablation mask is non-empty', floorMask.n > 2000, `${floorMask.n} px`);
console.log('\n§1 — THE MASK IS ON THE RIGHT THING: the UNMODIFIED frame is not magenta there');
check('slab mask is NOT magenta in the base frame (else the ablation did nothing)',
  !(slab.rgb[0] > 190 && slab.rgb[1] < 110 && slab.rgb[2] > 190), `rgb ${slab.rgb.map((v) => v.toFixed(0)).join(',')}`);
check('slab mask colour is the pale-blue cap #94C5FF (148,197,255), not the brown hob',
  slab.rgb[2] > slab.rgb[0] && slab.rgb[1] > slab.rgb[0], `rgb ${slab.rgb.map((v) => v.toFixed(0)).join(',')} — B>R and G>R`);
check('floor mask is NOT magenta in the base frame', !(floor.rgb[0] > 190 && floor.rgb[1] < 110 && floor.rgb[2] > 190),
  `rgb ${floor.rgb.map((v) => v.toFixed(0)).join(',')}`);
console.log('\n§2 — CONTROL: the two masks are disjoint (a mask covering both measures nothing)');
let overlap = 0;
for (let k = 0; k < slabMask.mask.length; k++) if (slabMask.mask[k] && floorMask.mask[k]) overlap++;
check('slab and floor masks do not overlap', overlap === 0, `${overlap} px`);
console.log('\n§3 — THE CLAIM: slab luma sd vs tiled-floor luma sd, on the CURRENT tree');
console.log(`         slab sd ${slab.sd.toFixed(2)}  ·  floor sd ${floor.sd.toFixed(2)}  ·  floor/slab ${(floor.sd / slab.sd).toFixed(2)}×`);
console.log('         (the critic panel reported 2.69 vs 14.55 = 5.4× on a frozen 2026-08-05 frame)');

writeFileSync(`${OUT}/ar2_flat.json`, JSON.stringify({
  station: STATION, floorAt: FLOOR_AT, world: A.geo.world, floorHit: F.geo.floorHit,
  slabMaskPx: slabMask.n, floorMaskPx: floorMask.n, slab, floor,
}, null, 1));
console.log(`\n${fail ? '🔴 FAIL' : '✅ PASS'}  ar2_flat: ${fail} failed\n`);
process.exit(fail ? 1 : 0);
