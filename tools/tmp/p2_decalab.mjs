#!/usr/bin/env node
/**
 * WHAT DOES "RAISE THE BAKED CONTACT DECAL ~2.5x" ACTUALLY DO, AND CAN IT?
 *
 * READ-ONLY PROBE. Changes nothing on disk. Every variant below is applied to the
 * LIVE scene graph at runtime, measured, and reverted, so the same page and the same
 * frozen snapshot produce every number — no rebuild, no edit, no drift between arms.
 *
 * `docs/STATE.md` says the baked contact layer "sits at |dL| 0.0491 against a 0.1238
 * reference". Those are two different quantities (an ABLATION delta of one layer in
 * the 0-0.15 m band vs the reference's TOTAL shipped contact contrast in 0-0.25 m),
 * and "2.5x" has three possible meanings. This prices all of them:
 *
 *   ALPHA   multiply every decal's vertex alpha by k (clamped at 1). This is the
 *           literal "make the decal stronger" knob.
 *   HOIST   raise every decal from BAKED_SHADOW_Y to a height above every floor
 *           layer. Prices BURIAL rather than strength.
 *   WIDE    scale the decal geometry in the ground plane. Prices radius.
 *
 * ── DELIVERED PIXELS, NOT AUTHORED ONES ────────────────────────────────────
 * A garish pass recolours every decal opaque green and counts pixels three ways:
 *   gDepth      normal depth test              -> what reaches the screen
 *   gNoDepth    depthTest off, renderOrder max -> the whole authored footprint
 *   gNoPads     normal depth, floor overlays hidden -> occluded by PROPS only
 * gDepth/gNoPads separates "correctly hidden under its own prop" from "buried under
 * a floor pad", which is `docs/LESSONS.md` §1 and has been true here twice.
 *
 * ── VALIDATION AGAINST KNOWN-BAD INPUTS ────────────────────────────────────
 *   NULL      capture twice, change nothing: every dL must land at the noise floor.
 *   GARISH-0  run the green counter with the decals HIDDEN: must count 0 px.
 *   AGREE     the k=1 arm must reproduce `aoband.mjs`'s own HEAD number at the same
 *             station, which is the cross-instrument check.
 *
 * The homography / distance / reduce code is copied from `tools/tmp/aoband.mjs` on
 * purpose so the k=1 arm is comparable to it digit for digit. Its own --selftest
 * (25/25) covers that maths; this file's job is the variants.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/p2_decalab.mjs --url '{URL}'
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const W = 1600, H = 900;
const SCALE = 0.05;
const BANDS = [[0, 0.15], [0.15, 0.30], [0.30, 0.60], [0.60, 1.20], [1.20, 2.50]];
const CONTACT = [0, 0.25];
const OPEN = [1.5, 3.0];
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// ── maths, copied verbatim from tools/tmp/aoband.mjs (its --selftest owns it) ──
function fitHomography(corr) {
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
function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const apply3 = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };
function distRect(x, z, r) {
  const dx = Math.max(r.wx0 - x, 0, x - r.wx1);
  const dz = Math.max(r.wz0 - z, 0, z - r.wz1);
  return Math.hypot(dx, dz);
}
function reduce({ ship, off, mask, dist, side, w, h }) {
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
      maxDL: b.n ? b.vals[b.n - 1] : 0,
      pastThr: b.n ? b.past / b.n : 0,
    };
  });
  return {
    bands: out,
    contactL: cN ? cSum / cN : 0,
    openL: oN ? oSum / oN : 0,
    contactContrast: cN && oN ? (oSum / oN) - (cSum / cN) : 0,
    shadowContrast: sN && soN ? (soSum / soN) - (sSum / sN) : 0,
    litContrast: lN && loN ? (loSum / loN) - (lSum / lN) : 0,
    shadowN: sN, litN: lN,
    shadowDL: sN ? sDL / sN : 0,
    litDL: lN ? lDL / lN : 0,
  };
}

const BASE = arg('url', null) && !arg('url').startsWith('$') ? arg('url') : (process.env.PREVIEW_BASE || 'http://localhost:5173');
const OUT = arg('out', 'shots/p2/decalab');
const STATIONS = arg('stations', '570:430,1150:420,340:500').split(',');
const KS = arg('k', '1,1.5,2.5,4').split(',').map(Number);
const HOIST_Y = Number(arg('hoisty', 0.30));
const WIDE = Number(arg('wide', 1.5));
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

// ── in-page hooks ────────────────────────────────────────────────────────────
const HOOKS = `() => {
  const st = window.__stage, scene = st.scene;
  const DEC = 'contact_shadow__no_outline';
  const decals = [];
  scene.traverse((o) => { if (o.isMesh && o.name === DEC) decals.push(o); });
  const origAlpha = new Map(), origY = new Map(), origMat = new Map(), origScale = new Map();
  for (const m of decals) {
    const c = m.geometry.getAttribute('color');
    origAlpha.set(m.uuid, Float32Array.from(c.array));
    origY.set(m.uuid, m.position.y);
    origMat.set(m.uuid, m.material);
    origScale.set(m.uuid, [m.scale.x, m.scale.y, m.scale.z]);
  }
  // one garish material per source material, cloned so the original is untouched
  const garish = new Map();
  for (const m of decals) {
    if (garish.has(m.material.uuid)) continue;
    const g = m.material.clone();
    g.map = null; g.vertexColors = false; g.transparent = false; g.opacity = 1;
    g.color.setHex(0x00ff00); g.depthWrite = false; g.depthTest = true;
    garish.set(m.material.uuid, g);
  }
  // floor-overlay meshes: anything flat that sits ABOVE the decal plane and could bury it
  scene.updateMatrixWorld(true);
  const arena = scene.getObjectByName('arena:kitchen');
  const pads = [];
  arena.traverse((o) => {
    if (!o.isMesh || o.name === DEC) return;
    const g = o.geometry; if (!g) return;
    if (o.isInstancedMesh) o.computeBoundingBox(); else if (!g.boundingBox) g.computeBoundingBox();
    const bb = o.isInstancedMesh ? o.boundingBox : g.boundingBox;
    if (!bb) return;
    const e = o.matrixWorld.elements;
    let y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      const vx = (i & 1) ? bb.max.x : bb.min.x, vy = (i & 2) ? bb.max.y : bb.min.y, vz = (i & 4) ? bb.max.z : bb.min.z;
      const wy = e[1]*vx + e[5]*vy + e[9]*vz + e[13];
      if (wy > y1) y1 = wy;
    }
    if (y1 > 0.02 && y1 < 0.40) pads.push(o);
  });
  window.__p2 = {
    count: decals.length,
    padCount: pads.length,
    padNames: [...new Set(pads.map((p) => p.name || '(unnamed)'))].slice(0, 40),
    show(on) { for (const m of decals) m.visible = on; return decals.length; },
    alpha(k) {
      for (const m of decals) {
        const c = m.geometry.getAttribute('color');
        const o = origAlpha.get(m.uuid);
        for (let i = 3; i < c.array.length; i += 4) c.array[i] = Math.min(1, o[i] * k);
        c.needsUpdate = true;
      }
      return k;
    },
    y(v) { for (const m of decals) m.position.y = v === null ? origY.get(m.uuid) : v; return v; },
    wide(s) { for (const m of decals) { const o = origScale.get(m.uuid); m.scale.set(s === null ? o[0] : o[0] * s, s === null ? o[1] : o[1] * s, o[2]); } return s; },
    garish(mode) {
      for (const m of decals) {
        if (mode === 'off') { m.material = origMat.get(m.uuid); m.renderOrder = 1; continue; }
        const g = garish.get(origMat.get(m.uuid).uuid);
        g.depthTest = mode !== 'nodepth';
        m.material = g;
        m.renderOrder = mode === 'nodepth' ? 9999 : 1;
      }
      return mode;
    },
    padsVisible(on) { for (const p of pads) p.visible = on; st.markShadowsDirty(); return pads.length; },
  };
  return { decals: decals.length, pads: pads.length, padNames: window.__p2.padNames };
}`;

const SETVIS = `(uuids, visible) => {
  const st = window.__stage, set = new Set(uuids); let n = 0;
  st.scene.traverse((o) => { if (set.has(o.uuid)) { o.visible = visible; n++; } });
  st.markShadowsDirty();
  return n;
}`;
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

const { chromium } = await import('playwright');
const sharp = (await import('sharp')).default;
const raw = (buf) => sharp(buf).removeAlpha().raw().toBuffer();
const diffMask = (A, B, thr = 8) => {
  const m = new Uint8Array(W * H); let n = 0;
  for (let i = 0, j = 0; j < W * H; i += 3, j++) {
    if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > thr) { m[j] = 1; n++; }
  }
  return { m, n };
};
// ⚠️ A GREEN-CHANNEL COUNTER WAS TRIED FIRST AND ITS OWN KNOWN-BAD CONTROL KILLED IT.
// With every decal HIDDEN it still counted 7,522 px, because the arena has green food
// props (`debris_veg`, `hub_debris_veg`, herb sprigs) — 8% contamination on the shipped
// arm and a different 8% on each other arm, since the garish decals overdraw some of
// them. Delivered area is now a COLOUR-INDEPENDENT diff against the matching
// decals-hidden frame, which reads exactly 0 when nothing is drawn.
const deliveredPx = (garish, hidden) => diffMask(garish, hidden, 30).n;

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
  await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${sx}&py=${sy}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await p.waitForTimeout(1500);

  const info = await p.evaluate(`(${SCENE})()`);
  const hooks = await p.evaluate(`(${HOOKS})()`);
  const Hh = fitHomography(info.proj.slice(0, 4));
  const Hinv = invert3(Hh);
  let maxErr = 0;
  for (const c of info.proj) { const [gx, gz] = apply3(Hinv, c.x, c.y); maxErr = Math.max(maxErr, Math.hypot(gx - c.wx, gz - c.wz)); }

  const canvas = p.locator('canvas');
  await p.evaluate(`window.__aoVis = ${SETVIS};`);
  const shot = async () => raw(await canvas.screenshot());
  const shotTo = async (name) => { await canvas.screenshot({ path: `${OUT}/${st.replace(':', '_')}.${name}.png` }); };

  const ship = await shot();
  await shotTo('ship');
  // NULL control on the SAME page: capture again, change nothing.
  await p.waitForTimeout(700);
  const ship2 = await shot();

  // floor-visible mask (identical construction to aoband)
  await p.evaluate(([u]) => window.__aoVis(u, false), [info.flat]);
  await p.waitForTimeout(700);
  const noFloor = await shot();
  await p.evaluate(([u]) => window.__aoVis(u, true), [info.flat]);
  await p.waitForTimeout(700);

  await p.evaluate('window.__p2.show(false)');
  await p.waitForTimeout(700);
  const noDecal = await shot();
  await shotTo('noDecal');

  // ── KNOWN-BAD CONTROL: the area counter with the decals HIDDEN must read 0 ──
  await p.evaluate("window.__p2.garish('depth')");
  await p.waitForTimeout(500);
  const gHidden = deliveredPx(await shot(), noDecal);
  await p.evaluate('window.__p2.show(true)');
  await p.waitForTimeout(600);
  const gDepth = deliveredPx(await shot(), noDecal);
  await shotTo('garish_depth');
  await p.evaluate("window.__p2.garish('nodepth')");
  await p.waitForTimeout(600);
  const gNoDepth = deliveredPx(await shot(), noDecal);
  await shotTo('garish_nodepth');
  await p.evaluate("window.__p2.garish('depth')");
  // hoisted 8 mm — clear of `floor_seam` (top 0.072) / `floor_border` (0.075) /
  // `floor_woodpad` (0.070) and still under every plinth and kick (0.100+)
  await p.evaluate('window.__p2.y(0.078)');
  await p.waitForTimeout(700);
  const gHoistLo = deliveredPx(await shot(), noDecal);
  await shotTo('garish_hoist078');
  await p.evaluate(`window.__p2.y(${HOIST_Y})`);
  await p.waitForTimeout(700);
  const gHoist = deliveredPx(await shot(), noDecal);
  await p.evaluate('window.__p2.y(null)');
  await p.waitForTimeout(600);
  await p.evaluate('window.__p2.padsVisible(false)');
  await p.evaluate('window.__p2.show(false)');
  await p.waitForTimeout(800);
  const noDecalNoPads = await shot();
  await p.evaluate('window.__p2.show(true)');
  await p.waitForTimeout(700);
  const gNoPads = deliveredPx(await shot(), noDecalNoPads);
  await shotTo('garish_nopads');
  await p.evaluate('window.__p2.padsVisible(true)');
  await p.evaluate("window.__p2.garish('off')");
  await p.waitForTimeout(800);

  // ── distance / side fields ────────────────────────────────────────────────
  const floor = diffMask(ship, noFloor);
  const sdLen = Math.hypot(info.keyOffset[0], info.keyOffset[2]);
  const sdx = -info.keyOffset[0] / sdLen, sdz = -info.keyOffset[2] / sdLen;
  const dist = new Float32Array(W * H).fill(-1);
  const side = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x; if (!floor.m[j]) continue;
    const [gx, gz] = apply3(Hinv, x + 0.5, y + 0.5);
    let best = 1e9, bq = null;
    for (const q of boxes) { const r = distRect(gx, gz, q); if (r < best) { best = r; bq = q; } }
    dist[j] = best;
    if (bq) {
      const vx = gx - (bq.wx0 + bq.wx1) / 2, vz = gz - (bq.wz0 + bq.wz1) / 2;
      const l = Math.hypot(vx, vz) || 1;
      side[j] = (vx / l) * sdx + (vz / l) * sdz;
    }
  }

  const arms = {};
  arms.NULL = reduce({ ship, off: ship2, mask: floor.m, dist, side, w: W, h: H });
  for (const k of KS) {
    await p.evaluate(`window.__p2.alpha(${k})`);
    await p.waitForTimeout(700);
    const f = await shot();
    if (k !== 1) await shotTo(`alpha${k}`);
    arms[`alpha=${k}`] = reduce({ ship: f, off: noDecal, mask: floor.m, dist, side, w: W, h: H });
  }
  await p.evaluate('window.__p2.alpha(1)');
  await p.waitForTimeout(500);

  for (const hy of [0.078, HOIST_Y]) {
    await p.evaluate(`window.__p2.y(${hy})`);
    await p.waitForTimeout(700);
    const fH = await shot();
    await shotTo(`hoist${hy}`);
    arms[`hoist=${hy}`] = reduce({ ship: fH, off: noDecal, mask: floor.m, dist, side, w: W, h: H });
  }
  // the one arm that is actually available: clear the flat floor layers AND boost alpha
  await p.evaluate('window.__p2.y(0.078)');
  await p.evaluate('window.__p2.alpha(1.6)');
  await p.waitForTimeout(700);
  arms['y.078+a1.6'] = reduce({ ship: await shot(), off: noDecal, mask: floor.m, dist, side, w: W, h: H });
  await shotTo('hoist078_alpha16');
  await p.evaluate('window.__p2.alpha(1)');
  await p.evaluate('window.__p2.y(null)');
  await p.waitForTimeout(700);

  await p.evaluate(`window.__p2.wide(${WIDE})`);
  await p.waitForTimeout(700);
  const fW = await shot();
  await shotTo(`wide${WIDE}`);
  arms[`wide=${WIDE}`] = reduce({ ship: fW, off: noDecal, mask: floor.m, dist, side, w: W, h: H });
  await p.evaluate('window.__p2.wide(null)');
  await p.waitForTimeout(500);

  const px = { gHidden, gDepth, gNoDepth, gNoPads, gHoistLo, gHoist };
  console.log(`\n══ ${st}  decals ${hooks.decals}  padMeshes ${hooks.pads}  homographyErrM ${maxErr.toFixed(4)}  floorPx ${floor.n}`);
  console.log(`   DELIVERED DECAL PIXELS (diff vs the matching decals-hidden frame)`);
  console.log(`     CONTROL decals hidden (must be 0)  ${gHidden}`);
  console.log(`     gDepth   shipped, y=0.070           ${gDepth}`);
  console.log(`     gNoDepth authored footprint         ${gNoDepth}   delivered ${(100 * gDepth / gNoDepth).toFixed(1)}%`);
  console.log(`     gNoPads  floor overlays hidden      ${gNoPads}   buried by floor layers ${(100 * (gNoPads - gDepth) / Math.max(1, gNoPads)).toFixed(1)}%`);
  console.log(`     gHoistLo y=0.078 (clears seam/border/woodpad)  ${gHoistLo}   ${(100 * (gHoistLo - gDepth) / Math.max(1, gDepth)).toFixed(1)}% vs shipped`);
  console.log(`     gHoist   y=${HOIST_Y}                     ${gHoist}   ${(100 * (gHoist - gDepth) / Math.max(1, gDepth)).toFixed(1)}% vs shipped`);
  console.log(`   arm            b0(0-.15)  past.06   b1(.15-.30)  contactContr  shadowC   litC   ratio   bakedShadowDL  bakedLitDL`);
  for (const [name, r] of Object.entries(arms)) {
    console.log(`   ${name.padEnd(13)}  ${r.bands[0].meanDL.toFixed(4)}   ${(100 * r.bands[0].pastThr).toFixed(1).padStart(5)}%   `
      + `${r.bands[1].meanDL.toFixed(4)}       ${r.contactContrast.toFixed(4)}      ${r.shadowContrast.toFixed(4)}  ${r.litContrast.toFixed(4)}  `
      + `${(r.shadowContrast / r.litContrast).toFixed(2).padStart(5)}   ${r.shadowDL.toFixed(4)}        ${r.litDL.toFixed(4)}`);
  }
  results.push({ station: st, decals: hooks.decals, pads: hooks.pads, padNames: hooks.padNames, px, arms, homographyErrM: maxErr, floorPx: floor.n });
  await p.close();
}
await b.close();

console.log(`\n── MEANS over ${results.length} stations   [bs_04 reference: contactContrast shadow 0.1238 / lit 0.0161 = 7.7]`);
const names = Object.keys(results[0].arms);
console.log(`   arm            b0(0-.15)  past.06   contactContr  shadowC   litC   ratio`);
for (const n of names) {
  const m = (sel) => results.reduce((a, r) => a + sel(r.arms[n]), 0) / results.length;
  console.log(`   ${n.padEnd(13)}  ${m((r) => r.bands[0].meanDL).toFixed(4)}   ${(100 * m((r) => r.bands[0].pastThr)).toFixed(1).padStart(5)}%       `
    + `${m((r) => r.contactContrast).toFixed(4)}      ${m((r) => r.shadowContrast).toFixed(4)}  ${m((r) => r.litContrast).toFixed(4)}  ${(m((r) => r.shadowContrast) / m((r) => r.litContrast)).toFixed(2)}`);
}
await writeFile(`${OUT}/p2_decalab.json`, JSON.stringify({ base: BASE, stations: STATIONS, ks: KS, hoistY: HOIST_Y, wide: WIDE, results }, null, 1));
console.log(`\nwrote ${OUT}/p2_decalab.json`);
