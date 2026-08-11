#!/usr/bin/env node
/**
 * WHERE DOES THE BAKED GROUNDING LAYER LAND, AND HOW DARK IS IT WHERE IT IS SEEN?
 *
 * `tools/tmp/ao_ab.mjs` answers "does the baked contact layer reach the screen" with
 * ONE number — mean |dL| over every pixel it changes by more than 0.01. That number is
 * 0.057-0.072 and it is `docs/LESSONS.md` §13 in its purest form: perfectly true, and
 * an answer to a broader question than the one being asked. A decal's mean is dragged
 * down by its own feather, which is most of its area and none of its job. The critics
 * asked for something else entirely: *"a tight contact-occlusion ellipse pinned to
 * every object's base — hard inner core, falloff of a few pixels, ~50-60% at its
 * core."* That is a statement about the ANNULUS immediately outside a prop's
 * footprint, and nothing measured it.
 *
 * ── What this measures ──────────────────────────────────────────────────────
 * For every floor pixel that is actually VISIBLE (mask built by hiding the flat floor
 * geometry and keeping the pixels that change, so a pixel behind a prop is correctly
 * excluded — `docs/LESSONS.md` §5), screen -> ground by an exact homography whose
 * residual it prints, then:
 *
 *   d        shortest distance in world METRES from that pixel to the nearest cover
 *            box's footprint rectangle. Metres, not d/H: a baked decal is scaled to
 *            the prop's FOOTPRINT, so its reach is a property of the footprint, and
 *            the eye reads contact at a roughly fixed world width regardless of how
 *            tall the thing is.
 *   bakedDL  L(decals off) - L(shipped)  — what the baked layer alone contributes
 *   castDL   L(key.castShadow off) - L(shipped)  — what the shadow map contributes
 *   totalDL  L(both off) - L(shipped)
 *
 * reported in bands of d, plus the two quantities a player actually sees:
 *
 *   contactContrast = mean L over open floor (d in [1.5, 3.0] m)
 *                   - mean L over the contact band (d in (0, 0.25] m)
 *
 *   the same split by SIDE — the key's shadow side against its lit side, each
 *   compared with open floor ON ITS OWN SIDE so a whole-arena brightness gradient
 *   cannot masquerade as an asymmetry. `tools/tmp/refcontact.mjs` measures exactly
 *   this on hand-marked prop bases in a reference plate, which is what turns it from
 *   "bigger is better" into a target: Brawl Stars runs 0.1238 / 0.0161 = 7.7:1.
 *
 * ⚠️ The whole-arena ratio has a CEILING that is nothing to do with the decals. The
 * reference figure comes from two barrels standing alone on open grass; this arena has
 * 20 of its 27 cover boxes within 2 m of a neighbour and 8 of them TOUCHING, so one
 * prop's lit side is routinely inside another's cast shadow. `--iso <m>` repeats the
 * reduction over only the props with no neighbour within that distance, which prices
 * the ceiling instead of arguing about it (at 6 m only 3 of 27 qualify).
 *
 * ── VALIDATION, FIRST, BECAUSE THIRTEEN INSTRUMENTS HAVE LIED HERE ──────────
 *   --selftest   synthetic frames whose answer is known by construction: a flat pair
 *                (dL must be 0), a known step in a known annulus (must recover it to
 *                4 dp), a dark ring OUTSIDE the band (must NOT be credited to it),
 *                and the distance field against hand-computed rectangle distances.
 *   --null       in the live game: capture the shipped frame TWICE with nothing
 *                ablated and run the whole pipeline on that pair. Every dL must come
 *                back at the noise floor. This is the only check that tests the
 *                browser, the mask, the homography and the arithmetic together.
 *
 *   node tools/tmp/aoband.mjs --selftest
 *   node tools/tmp/aoband.mjs --url $URL --null
 *   node tools/tmp/aoband.mjs --url $URL --out shots/arena/aoband
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const W = 1600, H = 900;
const SCALE = 0.05; // wu -> metres, `src/units.ts` WORLD_SCALE

// Bands in world metres from the prop footprint.
const BANDS = [[0, 0.15], [0.15, 0.30], [0.30, 0.60], [0.60, 1.20], [1.20, 2.50]];
const CONTACT = [0, 0.25];
const OPEN = [1.5, 3.0];

const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// ── maths (homography identical in form to tools/tmp/contactshadow.mjs) ──────
export function fitHomography(corr) {
  const A = [], b = [];
  for (const c of corr) {
    A.push([c.wx, c.wz, 1, 0, 0, 0, -c.x * c.wx, -c.x * c.wz]); b.push(c.x);
    A.push([0, 0, 0, c.wx, c.wz, 1, -c.y * c.wx, -c.y * c.wz]); b.push(c.y);
  }
  const n = 8, M = Array.from({ length: n }, () => new Float64Array(n + 1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < A.length; k++) s += A[k][i] * A[k][j]; M[i][j] = s; }
    let s = 0; for (let k = 0; k < A.length; k++) s += A[k][i] * b[k]; M[i][n] = s;
  }
  for (let i = 0; i < n; i++) {
    let pv = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[pv][i])) pv = r;
    const t = M[i]; M[i] = M[pv]; M[pv] = t;
    for (let r = 0; r < n; r++) { if (r === i) continue; const f = M[r][i] / M[i][i]; for (let c2 = i; c2 <= n; c2++) M[r][c2] -= f * M[i][c2]; }
  }
  const h = []; for (let i = 0; i < n; i++) h.push(M[i][n] / M[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
export function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
export const apply3 = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };
export function distRect(x, z, r) {
  const dx = Math.max(r.wx0 - x, 0, x - r.wx1);
  const dz = Math.max(r.wz0 - z, 0, z - r.wz1);
  return Math.hypot(dx, dz);
}

/**
 * Core reducer, pure, so `--selftest` exercises the SAME code the live run uses.
 *
 * `side` is optional and holds, per pixel, the cosine between (pixel - nearest prop
 * centre) and the direction the key throws its shadows. It splits the contact band
 * into a SHADOW side and a LIT side, because that is the shape the reference actually
 * has: measured on two isolated barrels in `gameplay_topdown/bs_04.png`
 * (`tools/tmp/refcontact.mjs`), Brawl Stars runs contact contrast 0.1238 on the shadow
 * side and 0.0161 on the lit side — a 7.7:1 asymmetry, the two props agreeing to 0.012.
 * A symmetric AO ring cannot produce that no matter how dark it is, so an all-round
 * mean on its own would let a fix that is wrong in KIND look right.
 */
export function reduce({ ship, off, mask, dist, side, w, h }) {
  const bands = BANDS.map(() => ({ n: 0, sum: 0, past: 0, vals: [] }));
  let cN = 0, cSum = 0, oN = 0, oSum = 0;
  let sN = 0, sSum = 0, lN = 0, lSum = 0, soN = 0, soSum = 0, loN = 0, loSum = 0;
  let sDL = 0, lDL = 0;
  const COS = Math.cos((70 * Math.PI) / 180);
  for (let j = 0; j < w * h; j++) {
    if (!mask[j]) continue;
    const d = dist[j];
    if (!(d >= 0) || d > 4) continue;
    const i = j * 3;
    const ls = luma(ship[i], ship[i + 1], ship[i + 2]);
    const lo = luma(off[i], off[i + 1], off[i + 2]);
    const dl = lo - ls;
    for (let b = 0; b < BANDS.length; b++) {
      if (d > BANDS[b][0] && d <= BANDS[b][1]) {
        bands[b].n++; bands[b].sum += dl; bands[b].vals.push(dl);
        if (dl > 0.06) bands[b].past++;
        break;
      }
    }
    const inContact = d > CONTACT[0] && d <= CONTACT[1];
    const inOpen = d >= OPEN[0] && d <= OPEN[1];
    if (inContact) { cN++; cSum += ls; }
    if (inOpen) { oN++; oSum += ls; }
    if (side) {
      const c = side[j];
      if (inContact && c > COS) { sN++; sSum += ls; sDL += dl; }
      if (inContact && c < -COS) { lN++; lSum += ls; lDL += dl; }
      if (inOpen && c > COS) { soN++; soSum += ls; }
      if (inOpen && c < -COS) { loN++; loSum += ls; }
    }
  }
  const out = bands.map((b, i) => {
    b.vals.sort((x, y) => x - y);
    return {
      band: BANDS[i], n: b.n,
      meanDL: b.n ? b.sum / b.n : 0,
      p90DL: b.n ? b.vals[Math.floor(0.9 * (b.n - 1))] : 0,
      pastThr: b.n ? b.past / b.n : 0,
    };
  });
  return {
    bands: out,
    contactN: cN, openN: oN,
    contactL: cN ? cSum / cN : 0,
    openL: oN ? oSum / oN : 0,
    contactContrast: cN && oN ? (oSum / oN) - (cSum / cN) : 0,
    // Each side is compared against OPEN FLOOR ON ITS OWN SIDE, so a whole-arena
    // brightness gradient cannot masquerade as an asymmetry.
    shadowContrast: sN && soN ? (soSum / soN) - (sSum / sN) : 0,
    litContrast: lN && loN ? (loSum / loN) - (lSum / lN) : 0,
    shadowN: sN, litN: lN,
    // The ABLATED layer's own contribution, split the same way: this is what says
    // whether the layer under test is directional or a symmetric halo.
    shadowDL: sN ? sDL / sN : 0,
    litDL: lN ? lDL / lN : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — synthetic frames whose answer is known by construction.
// ─────────────────────────────────────────────────────────────────────────────
if (has('selftest')) {
  let pass = 0, fail = 0;
  const ok = (name, cond, got) => { if (cond) { pass++; } else { fail++; console.log(`  FAIL ${name}  got ${got}`); } };
  const near = (a, b, t = 1e-4) => Math.abs(a - b) <= t;

  // -- distRect against hand-computed answers ------------------------------
  const R = { wx0: 1, wx1: 3, wz0: 1, wz1: 2 };
  ok('distRect inside', near(distRect(2, 1.5, R), 0), distRect(2, 1.5, R));
  ok('distRect +x', near(distRect(4, 1.5, R), 1), distRect(4, 1.5, R));
  ok('distRect -z', near(distRect(2, 0.25, R), 0.75), distRect(2, 0.25, R));
  ok('distRect corner', near(distRect(0, 0, R), Math.hypot(1, 1)), distRect(0, 0, R));
  ok('distRect edge x1', near(distRect(3.5, 2.5, R), Math.hypot(0.5, 0.5)), distRect(3.5, 2.5, R));

  // -- homography round-trips a known projective map -------------------------
  const Htrue = [1.7, 0.3, 40, -0.2, 1.1, 25, 0.0009, 0.0021, 1];
  const pts = [[0, 0], [8, 0], [0, 8], [8, 8], [-8, -8], [12, -5], [-5, 12], [3, 3]];
  const corr = pts.map(([wx, wz]) => { const [x, y] = apply3(Htrue, wx, wz); return { wx, wz, x, y }; });
  const Hf = fitHomography(corr.slice(0, 4));
  const Hi = invert3(Hf);
  let maxErr = 0;
  for (const c of corr) { const [gx, gz] = apply3(Hi, c.x, c.y); maxErr = Math.max(maxErr, Math.hypot(gx - c.wx, gz - c.wz)); }
  ok('homography residual < 1e-6 m', maxErr < 1e-6, maxErr);

  // -- a FLAT pair must report exactly zero ---------------------------------
  const w = 64, h = 64;
  const flatA = Buffer.alloc(w * h * 3, 120), flatB = Buffer.alloc(w * h * 3, 120);
  const mask = new Uint8Array(w * h).fill(1);
  const dist = new Float32Array(w * h);
  // x pixel -> distance 0..4 m linearly, so every band is populated
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dist[y * w + x] = (x / (w - 1)) * 4;
  const rFlat = reduce({ ship: flatA, off: flatB, mask, dist, w, h });
  ok('flat pair: every band dL == 0', rFlat.bands.every((b) => b.meanDL === 0), JSON.stringify(rFlat.bands.map((b) => b.meanDL)));
  ok('flat pair: contactContrast == 0', near(rFlat.contactContrast, 0), rFlat.contactContrast);
  ok('flat pair: bands populated', rFlat.bands.every((b) => b.n > 0), JSON.stringify(rFlat.bands.map((b) => b.n)));

  // -- a KNOWN step in a KNOWN annulus must be recovered to 4 dp -------------
  // shipped is darker by exactly 40/255 of grey wherever d <= 0.15, elsewhere equal.
  const shipA = Buffer.alloc(w * h * 3, 200), offA = Buffer.alloc(w * h * 3, 200);
  for (let j = 0; j < w * h; j++) if (dist[j] <= 0.15 && dist[j] > 0) shipA.fill(160, j * 3, j * 3 + 3);
  const rStep = reduce({ ship: shipA, off: offA, mask, dist, w, h });
  const want = luma(200, 200, 200) - luma(160, 160, 160);
  ok('step: band0 recovers 40/255', near(rStep.bands[0].meanDL, want), `${rStep.bands[0].meanDL} vs ${want}`);
  ok('step: band0 100% past 0.06', near(rStep.bands[0].pastThr, 1), rStep.bands[0].pastThr);
  ok('step: outer bands untouched', rStep.bands.slice(1).every((b) => b.meanDL === 0), JSON.stringify(rStep.bands.slice(1).map((b) => b.meanDL)));

  // -- a dark ring OUTSIDE the contact band must not be credited to it -------
  const shipB = Buffer.alloc(w * h * 3, 200), offB = Buffer.alloc(w * h * 3, 200);
  for (let j = 0; j < w * h; j++) if (dist[j] > 0.6 && dist[j] <= 1.2) shipB.fill(160, j * 3, j * 3 + 3);
  const rRing = reduce({ ship: shipB, off: offB, mask, dist, w, h });
  ok('far ring: contact band reads 0', near(rRing.bands[0].meanDL, 0), rRing.bands[0].meanDL);
  ok('far ring: band 3 finds it', near(rRing.bands[3].meanDL, want), rRing.bands[3].meanDL);

  // -- contactContrast: darker AT the base must be POSITIVE ------------------
  ok('contactContrast sign', rStep.contactContrast > 0, rStep.contactContrast);
  // The step covers d <= 0.15 and the contact band is d in (0, 0.25]. On this 64-px
  // grid (d = x/63*4) that is columns x=1,2 of the three columns x=1,2,3 in the band,
  // so the expected contrast is exactly 2/3 of the step. Deriving the fraction rather
  // than loosening the tolerance is the point: a tolerance wide enough to swallow a
  // partially-covered band is wide enough to swallow a real error.
  ok('contactContrast magnitude (2/3 of the step, derived)', near(rStep.contactContrast, want * 2 / 3), rStep.contactContrast);
  // and a step covering the WHOLE contact band recovers it exactly
  const shipD = Buffer.alloc(w * h * 3, 200), offD = Buffer.alloc(w * h * 3, 200);
  for (let j = 0; j < w * h; j++) if (dist[j] <= 0.25 && dist[j] > 0) shipD.fill(160, j * 3, j * 3 + 3);
  ok('contactContrast full-band recovers the step exactly', near(reduce({ ship: shipD, off: offD, mask, dist, w, h }).contactContrast, want),
    reduce({ ship: shipD, off: offD, mask, dist, w, h }).contactContrast);
  // and a base LIGHTER than open floor must be negative
  const shipC = Buffer.alloc(w * h * 3, 200), offC = Buffer.alloc(w * h * 3, 200);
  for (let j = 0; j < w * h; j++) if (dist[j] <= 0.25 && dist[j] > 0) shipC.fill(240, j * 3, j * 3 + 3);
  ok('contactContrast negative when base is lighter', reduce({ ship: shipC, off: offC, mask, dist, w, h }).contactContrast < 0,
    reduce({ ship: shipC, off: offC, mask, dist, w, h }).contactContrast);

  // -- the MASK must exclude pixels, not merely weight them ------------------
  const half = new Uint8Array(w * h); for (let j = 0; j < w * h; j++) half[j] = j % 2;
  const rHalf = reduce({ ship: shipA, off: offA, mask: half, dist, w, h });
  ok('mask halves the sample', Math.abs(rHalf.bands[0].n - rStep.bands[0].n / 2) <= 1, `${rHalf.bands[0].n} vs ${rStep.bands[0].n}`);
  ok('mask does not change the mean', near(rHalf.bands[0].meanDL, rStep.bands[0].meanDL), rHalf.bands[0].meanDL);

  // -- the SIDE split: an asymmetric darkening must read as asymmetric ------
  // Top half of the frame is the shadow side (side=+1), bottom half the lit side (-1).
  const side = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) side[y * w + x] = y < h / 2 ? 1 : -1;
  const shipE = Buffer.alloc(w * h * 3, 200), offE = Buffer.alloc(w * h * 3, 200);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = y * w + x;
    if (y < h / 2 && dist[j] <= 0.25 && dist[j] > 0) shipE.fill(160, j * 3, j * 3 + 3);
  }
  const rSide = reduce({ ship: shipE, off: offE, mask, dist, side, w, h });
  ok('side split: shadow side sees the step', near(rSide.shadowContrast, want), rSide.shadowContrast);
  ok('side split: lit side sees nothing', near(rSide.litContrast, 0), rSide.litContrast);
  ok('side split: both sides sampled', rSide.shadowN > 0 && rSide.litN > 0, `${rSide.shadowN}/${rSide.litN}`);
  // A SYMMETRIC darkening must come back symmetric — the control that stops the split
  // from manufacturing an asymmetry out of geometry alone.
  const rSym = reduce({ ship: shipD, off: offD, mask, dist, side, w, h });
  ok('side split: symmetric input reads symmetric', near(rSym.shadowContrast, rSym.litContrast), `${rSym.shadowContrast} vs ${rSym.litContrast}`);
  // A whole-frame brightness gradient must NOT read as an asymmetry, because each
  // side is compared against open floor on its own side.
  const shipF = Buffer.alloc(w * h * 3), offF = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = y * w + x, v = 140 + Math.round((y / (h - 1)) * 80);
    shipF.fill(v, j * 3, j * 3 + 3); offF.fill(v, j * 3, j * 3 + 3);
  }
  const rGrad = reduce({ ship: shipF, off: offF, mask, dist, side, w, h });
  ok('side split: a brightness gradient is not an asymmetry', Math.abs(rGrad.shadowContrast - rGrad.litContrast) < 1e-9,
    `${rGrad.shadowContrast} vs ${rGrad.litContrast}`);

  console.log(`\naoband --selftest  ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE
// ─────────────────────────────────────────────────────────────────────────────
const { chromium } = await import('playwright');
const sharp = (await import('sharp')).default;
// `headserve`/`with_snapshot` hand the URL over in the environment, and `--url $URL`
// in a shell that never expanded it is how three agents have measured port 5173 by
// accident. Environment first, flag second, shared dev server never by default.
const BASE = arg('url', null) && !arg('url').startsWith('$') ? arg('url') : (process.env.PREVIEW_BASE || 'http://localhost:5173');
const OUT = arg('out', 'shots/arena/aoband');
// ⚠️ RE-AIMED FOR THE ×4 MAP, 2026-08-11 (`6631446` took the arena 1400×1000 →
// 2800×2000; these defaults did not follow). **`340:500` sat inside a `freezer` and 1,172 wu from centre**, so the
// gate photographed a fighter buried in a prop inside the fog.
// Coordinates are `tools/arena-scan.mjs`'s current, --selftest-validated stations for
// the same ids, and `fogRadius` is the shipped `maxSafeRadius` 1985 — the old 993 was
// the 1× value, which puts a death-zone wall through the frame. `tools/tmp/al_guard.mjs`
// fails on the old values.
const STATIONS = arg('stations', '1140:940,2200:500,600:1000').split(',');
const PLAYER = arg('player', 'hamburger');
const NULLRUN = has('null');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

const SETVIS = `(uuids, visible) => {
  const st = window.__stage, set = new Set(uuids); let n = 0;
  st.scene.traverse((o) => { if (set.has(o.uuid)) { o.visible = visible; n++; } });
  st.markShadowsDirty();
  return n;
}`;
const SETDECALS = `(on) => { let n = 0; window.__stage.scene.traverse((o) => {
  if (o.isMesh && o.name === 'contact_shadow__no_outline') { o.visible = on; n++; } }); return n; }`;
const SETCAST = `(on) => { const k = window.__stage.lighting.key; k.castShadow = on; window.__stage.markShadowsDirty();
  window.__stage.renderer.shadowMap.autoUpdate = true; return k.castShadow; }`;
const SCENE = `() => {
  const st = window.__stage, scene = st.scene, cam = st.rig.camera;
  const arena = scene.getObjectByName('arena:kitchen');
  scene.updateMatrixWorld(true);
  const boxOf = (o) => {
    const g = o.geometry; if (!g) return null;
    if (o.isInstancedMesh) { o.computeBoundingBox(); } else if (!g.boundingBox) g.computeBoundingBox();
    const bb = o.isInstancedMesh ? o.boundingBox : g.boundingBox;
    if (!bb) return null;
    const e = o.matrixWorld.elements;
    let y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      const vx = (i & 1) ? bb.max.x : bb.min.x, vy = (i & 2) ? bb.max.y : bb.min.y, vz = (i & 4) ? bb.max.z : bb.min.z;
      const wy = e[1]*vx + e[5]*vy + e[9]*vz + e[13];
      if (wy > y1) y1 = wy;
    }
    return { y1 };
  };
  const flat = [];
  arena.traverse((o) => { if (!o.isMesh) return; const b = boxOf(o); if (b && b.y1 < 0.20) flat.push(o.uuid); });
  const pts = [[0,0],[8,0],[0,8],[8,8],[-8,-8],[12,-5],[-5,12],[3,3]];
  const proj = pts.map(([x, z]) => {
    const v = new cam.position.constructor(x, 0, z);
    v.project(cam);
    return { x: (v.x * 0.5 + 0.5) * ${W}, y: (-v.y * 0.5 + 0.5) * ${H}, wx: x, wz: z };
  });
  const kt = st.lighting.key.target.position;
  const ko = st.lighting.key.position.clone().sub(kt);
  return { flat, proj, keyTarget: [kt.x, kt.y, kt.z], keyOffset: [ko.x, ko.y, ko.z] };
}`;

const raw = (buf) => sharp(buf).removeAlpha().raw().toBuffer();
const diffMask = (A, B, thr = 8) => {
  const m = new Uint8Array(W * H); let n = 0;
  for (let i = 0, j = 0; j < W * H; i += 3, j++) {
    if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > thr) { m[j] = 1; n++; }
  }
  return { m, n };
};

const cover = JSON.parse(await readFile('tools/arena.gameplay.json', 'utf8'));
const boxes = cover.cover.map((c, i) => ({
  i, kind: c.kind,
  wx0: (c.x - c.w / 2) * SCALE, wx1: (c.x + c.w / 2) * SCALE,
  wz0: (c.y - c.h / 2) * SCALE, wz1: (c.y + c.h / 2) * SCALE,
}));

await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const results = [];
for (const st of STATIONS) {
  const [sx, sy] = st.split(':').map(Number);
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p.goto(`${BASE}/?player=${PLAYER}&enemy=donut&px=${sx}&py=${sy}&fogRadius=1985&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(`(${SCENE})()`);
  const errX = Math.abs(info.keyTarget[0] - sx * SCALE), errZ = Math.abs(info.keyTarget[2] - sy * SCALE);
  if (errX > 0.25 || errZ > 0.25) throw new Error(`wu->m scale check FAILED at ${st}`);

  const Hh = fitHomography(info.proj.slice(0, 4));
  const Hinv = invert3(Hh);
  let maxErr = 0;
  for (const c of info.proj) { const [gx, gz] = apply3(Hinv, c.x, c.y); maxErr = Math.max(maxErr, Math.hypot(gx - c.wx, gz - c.wz)); }

  const canvas = p.locator('canvas');
  await p.evaluate(`window.__aoVis = ${SETVIS}; window.__aoDecals = ${SETDECALS}; window.__aoCast = ${SETCAST};`);
  const ship = await raw(await canvas.screenshot());

  // floor-visible mask
  await p.evaluate(([u]) => window.__aoVis(u, false), [info.flat]);
  await p.waitForTimeout(700);
  const noFloor = await raw(await canvas.screenshot());
  await p.evaluate(([u]) => window.__aoVis(u, true), [info.flat]);
  await p.waitForTimeout(500);

  let nDecals = 0, decalsOff, castOff, bothOff;
  if (NULLRUN) {
    // Null control: change NOTHING, capture again. Every dL must land at the noise floor.
    await p.waitForTimeout(700);
    decalsOff = await raw(await canvas.screenshot());
    castOff = decalsOff; bothOff = decalsOff;
  } else {
    nDecals = await p.evaluate('window.__aoDecals(false)');
    await p.waitForTimeout(700);
    decalsOff = await raw(await canvas.screenshot());
    await p.evaluate('window.__aoCast(false)');
    await p.waitForTimeout(900);
    bothOff = await raw(await canvas.screenshot());
    await p.evaluate('window.__aoDecals(true)');
    await p.waitForTimeout(900);
    castOff = await raw(await canvas.screenshot());
    await p.evaluate('window.__aoDecals(true)');
    await p.evaluate('window.__aoCast(true)');
    await p.waitForTimeout(700);
  }

  const floor = diffMask(ship, noFloor);
  // The direction the key throws its shadows on the ground, read off the LIVE rig
  // rather than duplicated: shadows run opposite the light's own offset.
  const sdLen = Math.hypot(info.keyOffset[0], info.keyOffset[2]);
  const sdx = -info.keyOffset[0] / sdLen, sdz = -info.keyOffset[2] / sdLen;
  const dist = new Float32Array(W * H).fill(-1);
  const side = new Float32Array(W * H);
  const nearest = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x; if (!floor.m[j]) continue;
    const [gx, gz] = apply3(Hinv, x + 0.5, y + 0.5);
    let best = 1e9, bq = null;
    for (const q of boxes) { const r = distRect(gx, gz, q); if (r < best) { best = r; bq = q; } }
    dist[j] = best;
    if (bq) {
      nearest[j] = bq.i;
      const vx = gx - (bq.wx0 + bq.wx1) / 2, vz = gz - (bq.wz0 + bq.wz1) / 2;
      const l = Math.hypot(vx, vz) || 1;
      side[j] = (vx / l) * sdx + (vz / l) * sdz;
    }
  }

  // ── The DENSITY control ────────────────────────────────────────────────────
  // The reference figure (0.1238 / 0.0161) was measured on two barrels standing alone
  // on open grass. Our arena is not that: 27 cover boxes on a 70x50 m floor, so a pixel
  // on prop A's LIT side is routinely inside prop B's cast shadow, and the whole-arena
  // ratio has a ceiling that has nothing to do with the decals. Repeating the reduction
  // over only those props with no neighbour within ISO metres prices that ceiling
  // instead of arguing about it.
  const ISO = Number(arg('iso', 6));
  const isolated = new Set(boxes.filter((q) => !boxes.some((o) => o.i !== q.i
    && Math.hypot(Math.max(o.wx0 - q.wx1, 0, q.wx0 - o.wx1), Math.max(o.wz0 - q.wz1, 0, q.wz0 - o.wz1)) < ISO)).map((q) => q.i));
  const isoMask = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) if (floor.m[j] && nearest[j] >= 0 && isolated.has(nearest[j])) isoMask[j] = 1;

  const rBaked = reduce({ ship, off: decalsOff, mask: floor.m, dist, side, w: W, h: H });
  const rCast = reduce({ ship, off: castOff, mask: floor.m, dist, side, w: W, h: H });
  const rBoth = reduce({ ship, off: bothOff, mask: floor.m, dist, side, w: W, h: H });
  const rIso = reduce({ ship, off: bothOff, mask: isoMask, dist, side, w: W, h: H });

  console.log(`\n── ${st} ${NULLRUN ? '(NULL CONTROL)' : ''}  homographyErrM ${maxErr.toFixed(4)}  decals ${nDecals}  floorPx ${floor.n}`);
  console.log(`   key offset (${info.keyOffset.map((v) => v.toFixed(2)).join(', ')})  azimuth ${(Math.atan2(info.keyOffset[2], info.keyOffset[0]) * 180 / Math.PI).toFixed(2)} deg  elevation ${(Math.atan2(info.keyOffset[1], Math.hypot(info.keyOffset[0], info.keyOffset[2])) * 180 / Math.PI).toFixed(2)} deg`);
  console.log('   band (m)        n      bakedDL   past.06     castDL   past.06    totalDL   past.06');
  for (let i = 0; i < BANDS.length; i++) {
    console.log(`   ${String(BANDS[i][0].toFixed(2) + '-' + BANDS[i][1].toFixed(2)).padEnd(12)} ${String(rBaked.bands[i].n).padStart(7)}   `
      + `${rBaked.bands[i].meanDL.toFixed(4).padStart(7)}   ${(100 * rBaked.bands[i].pastThr).toFixed(1).padStart(6)}%   `
      + `${rCast.bands[i].meanDL.toFixed(4).padStart(8)}   ${(100 * rCast.bands[i].pastThr).toFixed(1).padStart(6)}%   `
      + `${rBoth.bands[i].meanDL.toFixed(4).padStart(8)}   ${(100 * rBoth.bands[i].pastThr).toFixed(1).padStart(6)}%`);
  }
  console.log(`   contactContrast  openL ${rBoth.openL.toFixed(4)} (n ${rBoth.openN})  -  contactL ${rBoth.contactL.toFixed(4)} (n ${rBoth.contactN})  =  ${rBoth.contactContrast.toFixed(4)}`);
  console.log(`   asymmetry        shadow side ${rBoth.shadowContrast.toFixed(4)} (n ${rBoth.shadowN})   lit side ${rBoth.litContrast.toFixed(4)} (n ${rBoth.litN})`
    + `   ratio ${(rBoth.litContrast ? rBoth.shadowContrast / rBoth.litContrast : NaN).toFixed(2)}   [bs_04 barrels: 0.1238 / 0.0161 = 7.7]`);
  console.log(`   isolated props   ${isolated.size} of ${boxes.length} at >= ${ISO} m   shadow ${rIso.shadowContrast.toFixed(4)} (n ${rIso.shadowN})   lit ${rIso.litContrast.toFixed(4)} (n ${rIso.litN})   ratio ${(rIso.shadowContrast / rIso.litContrast).toFixed(2)}`);
  console.log(`   layer shape      baked  shadowDL ${rBaked.shadowDL.toFixed(4)}  litDL ${rBaked.litDL.toFixed(4)}  ratio ${(rBaked.shadowDL / rBaked.litDL).toFixed(2)}`
    + `    cast  shadowDL ${rCast.shadowDL.toFixed(4)}  litDL ${rCast.litDL.toFixed(4)}  ratio ${(rCast.shadowDL / rCast.litDL).toFixed(2)}`);
  results.push({ station: st, homographyErrM: maxErr, nDecals, floorPx: floor.n, keyOffset: info.keyOffset, baked: rBaked, cast: rCast, both: rBoth, iso: rIso, isolatedCount: isolated.size });
  await p.close();
}
await b.close();

const agg = (sel) => results.reduce((a, r) => a + sel(r), 0) / results.length;
console.log(`\n── MEANS over ${results.length} stations`);
console.log(`   baked  0-0.15 m  ${agg((r) => r.baked.bands[0].meanDL).toFixed(4)}   past .06 ${(100 * agg((r) => r.baked.bands[0].pastThr)).toFixed(1)}%`);
console.log(`   baked  0.15-0.30 ${agg((r) => r.baked.bands[1].meanDL).toFixed(4)}   past .06 ${(100 * agg((r) => r.baked.bands[1].pastThr)).toFixed(1)}%`);
console.log(`   contactContrast   ${agg((r) => r.both.contactContrast).toFixed(4)}`);
console.log(`   shadow side       ${agg((r) => r.both.shadowContrast).toFixed(4)}      lit side ${agg((r) => r.both.litContrast).toFixed(4)}      ratio ${(agg((r) => r.both.shadowContrast) / agg((r) => r.both.litContrast)).toFixed(2)}   [bs_04: 0.1238 / 0.0161 = 7.7]`);
await writeFile(`${OUT}/aoband.json`, JSON.stringify({ base: BASE, stations: STATIONS, results }, null, 2));
