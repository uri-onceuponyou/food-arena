#!/usr/bin/env node
/**
 * IS THE 2.3 : 7.7 CONTACT ASYMMETRY GAP REAL, OR AN ARTEFACT OF THE SIDE SPLIT?
 *
 * READ-ONLY PROBE. `tools/tmp/aoband.mjs` classifies a floor pixel as "shadow side" or
 * "lit side" by the cosine between (pixel - nearest cover box CENTRE) and the key's
 * shadow direction. `tools/tmp/refcontact.mjs` measures the target on two isolated
 * BARRELS — round props ~1 m across, where the centre vector and the surface normal at
 * the contact point are the same thing to within a degree.
 *
 * This arena is not that. Its cover boxes run to 8.5 m. On a long island the vector
 * from the CENTRE to a pixel 0.2 m off the long edge points along the island, not out
 * of it — so half of a big prop's contact band is classified by a direction that has
 * nothing to do with the surface it is hugging. If that is what holds our ratio at
 * 2.3, then "our grounding is the wrong SHAPE" is an instrument artefact and the whole
 * lead built on it is chasing a number that cannot move.
 *
 * Three reductions on the SAME frames, so the only thing that varies is the split:
 *   CENTRE   aoband's own rule, reproduced exactly (the control — must reproduce it)
 *   NORMAL   direction from the CLOSEST POINT on the footprint rectangle to the pixel,
 *            i.e. the actual outward surface normal at the contact point
 *   SMALL    NORMAL, restricted to props whose longest side is <= --small metres, so
 *            the geometry matches what the reference was measured on
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/p2_sidecheck.mjs --url '{URL}'
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const W = 1600, H = 900, SCALE = 0.05;
const CONTACT = [0, 0.25], OPEN = [1.5, 3.0];
const SMALL = Number(arg('small', 3));
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

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
const clampRect = (x, z, r) => [Math.min(Math.max(x, r.wx0), r.wx1), Math.min(Math.max(z, r.wz0), r.wz1)];
const distRect = (x, z, r) => { const [cx, cz] = clampRect(x, z, r); return Math.hypot(x - cx, z - cz); };

// ── SELFTEST: the two side rules on a hand-derivable geometry ────────────────
if (process.argv.includes('--selftest')) {
  let pass = 0, fail = 0;
  const ok = (n, c, g) => { if (c) pass++; else { fail++; console.log(`  FAIL ${n}  got ${g}`); } };
  // A 10 m x 1 m island centred at the origin. Light throws its shadow toward +z.
  const R = { wx0: -5, wx1: 5, wz0: -0.5, wz1: 0.5 };
  const sd = { x: 0, z: 1 };
  const COS = Math.cos((70 * Math.PI) / 180);
  const centreCos = (x, z) => { const vx = x - 0, vz = z - 0, l = Math.hypot(vx, vz) || 1; return (vx / l) * sd.x + (vz / l) * sd.z; };
  const normalCos = (x, z) => { const [cx, cz] = clampRect(x, z, R); const vx = x - cx, vz = z - cz, l = Math.hypot(vx, vz) || 1; return (vx / l) * sd.x + (vz / l) * sd.z; };
  // A point 0.2 m off the SHADOW-side long edge, 4 m along it. It is unambiguously on
  // the shadow side of the surface it touches.
  ok('normal rule calls it shadow side', normalCos(4, 0.7) > COS, normalCos(4, 0.7));
  ok('centre rule does NOT', centreCos(4, 0.7) < COS, centreCos(4, 0.7));
  // The mirror point on the lit edge.
  ok('normal rule calls it lit side', normalCos(4, -0.7) < -COS, normalCos(4, -0.7));
  ok('centre rule does NOT', centreCos(4, -0.7) > -COS, centreCos(4, -0.7));
  // On a SMALL square the two rules must agree, which is the reference's geometry.
  const S = { wx0: -0.5, wx1: 0.5, wz0: -0.5, wz1: 0.5 };
  const nS = (x, z) => { const [cx, cz] = clampRect(x, z, S); const vx = x - cx, vz = z - cz, l = Math.hypot(vx, vz) || 1; return (vx / l) * sd.x + (vz / l) * sd.z; };
  const cS = (x, z) => { const vx = x, vz = z, l = Math.hypot(vx, vz) || 1; return (vx / l) * sd.x + (vz / l) * sd.z; };
  ok('small prop: both rules say shadow', nS(0, 0.7) > COS && cS(0, 0.7) > COS, `${nS(0, 0.7)} ${cS(0, 0.7)}`);
  ok('small prop: both rules say lit', nS(0, -0.7) < -COS && cS(0, -0.7) < -COS, `${nS(0, -0.7)} ${cS(0, -0.7)}`);
  ok('distRect still exact', Math.abs(distRect(4, 0.7, R) - 0.2) < 1e-9, distRect(4, 0.7, R));
  console.log(`\np2_sidecheck --selftest  ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

function reduce({ ship, off, mask, dist, side, keep, w, h }) {
  let cN = 0, cSum = 0, oN = 0, oSum = 0;
  let sN = 0, sSum = 0, lN = 0, lSum = 0, soN = 0, soSum = 0, loN = 0, loSum = 0, sDL = 0, lDL = 0;
  const COS = Math.cos((70 * Math.PI) / 180);
  for (let j = 0; j < w * h; j++) {
    if (!mask[j]) continue;
    if (keep && !keep[j]) continue;
    const d = dist[j];
    if (!(d >= 0) || d > 4) continue;
    const i = j * 3;
    const ls = luma(ship[i], ship[i + 1], ship[i + 2]);
    const dl = off ? luma(off[i], off[i + 1], off[i + 2]) - ls : 0;
    const inC = d > CONTACT[0] && d <= CONTACT[1];
    const inO = d >= OPEN[0] && d <= OPEN[1];
    if (inC) { cN++; cSum += ls; }
    if (inO) { oN++; oSum += ls; }
    const c = side[j];
    if (inC && c > COS) { sN++; sSum += ls; sDL += dl; }
    if (inC && c < -COS) { lN++; lSum += ls; lDL += dl; }
    if (inO && c > COS) { soN++; soSum += ls; }
    if (inO && c < -COS) { loN++; loSum += ls; }
  }
  return {
    contactL: cN ? cSum / cN : 0, openL: oN ? oSum / oN : 0,
    contactContrast: cN && oN ? oSum / oN - cSum / cN : 0,
    shadowContrast: sN && soN ? soSum / soN - sSum / sN : 0,
    litContrast: lN && loN ? loSum / loN - lSum / lN : 0,
    shadowN: sN, litN: lN, openShadowN: soN, openLitN: loN,
    shadowDL: sN ? sDL / sN : 0, litDL: lN ? lDL / lN : 0,
  };
}

const BASE = arg('url', null) && !arg('url').startsWith('$') ? arg('url') : (process.env.PREVIEW_BASE || 'http://localhost:5173');
const OUT = arg('out', 'shots/p2/sidecheck');
const STATIONS = arg('stations', '570:430,1150:420,340:500').split(',');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;
const SETVIS = `(uuids, visible) => { const st = window.__stage, set = new Set(uuids); let n = 0;
  st.scene.traverse((o) => { if (set.has(o.uuid)) { o.visible = visible; n++; } }); st.markShadowsDirty(); return n; }`;
const SETDECALS = `(on) => { let n = 0; window.__stage.scene.traverse((o) => {
  if (o.isMesh && o.name === 'contact_shadow__no_outline') { o.visible = on; n++; } }); return n; }`;
const SETCAST = `(on) => { const k = window.__stage.lighting.key; k.castShadow = on; window.__stage.markShadowsDirty();
  window.__stage.renderer.shadowMap.autoUpdate = true; return k.castShadow; }`;
const SCENE = `() => {
  const st = window.__stage, scene = st.scene, cam = st.rig.camera;
  const arena = scene.getObjectByName('arena:kitchen');
  scene.updateMatrixWorld(true);
  const flat = [];
  arena.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry; if (!g) return;
    if (o.isInstancedMesh) o.computeBoundingBox(); else if (!g.boundingBox) g.computeBoundingBox();
    const bb = o.isInstancedMesh ? o.boundingBox : g.boundingBox; if (!bb) return;
    const e = o.matrixWorld.elements; let y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      const vx = (i & 1) ? bb.max.x : bb.min.x, vy = (i & 2) ? bb.max.y : bb.min.y, vz = (i & 4) ? bb.max.z : bb.min.z;
      const wy = e[1]*vx + e[5]*vy + e[9]*vz + e[13]; if (wy > y1) y1 = wy;
    }
    if (y1 < 0.20) flat.push(o.uuid);
  });
  const pts = [[0,0],[8,0],[0,8],[8,8],[-8,-8],[12,-5],[-5,12],[3,3]];
  const proj = pts.map(([x, z]) => { const v = new cam.position.constructor(x, 0, z); v.project(cam);
    return { x: (v.x * 0.5 + 0.5) * ${W}, y: (-v.y * 0.5 + 0.5) * ${H}, wx: x, wz: z }; });
  const kt = st.lighting.key.target.position, ko = st.lighting.key.position.clone().sub(kt);
  return { flat, proj, keyOffset: [ko.x, ko.y, ko.z] };
}`;

const { chromium } = await import('playwright');
const sharp = (await import('sharp')).default;
const raw = (buf) => sharp(buf).removeAlpha().raw().toBuffer();
const diffMask = (A, B, thr = 8) => { const m = new Uint8Array(W * H); let n = 0;
  for (let i = 0, j = 0; j < W * H; i += 3, j++) if (Math.abs(A[i] - B[i]) + Math.abs(A[i+1] - B[i+1]) + Math.abs(A[i+2] - B[i+2]) > thr) { m[j] = 1; n++; }
  return { m, n }; };

const cover = JSON.parse(await readFile('tools/arena.gameplay.json', 'utf8'));
const boxes = cover.cover.map((c, i) => ({ i, kind: c.kind,
  wx0: (c.x - c.w / 2) * SCALE, wx1: (c.x + c.w / 2) * SCALE,
  wz0: (c.y - c.h / 2) * SCALE, wz1: (c.y + c.h / 2) * SCALE,
  longM: Math.max(c.w, c.h) * SCALE }));
console.log(`cover boxes ${boxes.length}   longest side (m): ${boxes.map((b) => b.longM.toFixed(1)).sort((a, b2) => b2 - a).slice(0, 8).join(' ')} ...`);
console.log(`  <= ${SMALL} m: ${boxes.filter((b) => b.longM <= SMALL).length} of ${boxes.length}`);

await mkdir(OUT, { recursive: true });
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const results = [];
for (const st of STATIONS) {
  const [sx, sy] = st.split(':').map(Number);
  const p = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${sx}&py=${sy}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(`(${SCENE})()`);
  const Hinv = invert3(fitHomography(info.proj.slice(0, 4)));
  let maxErr = 0;
  for (const c of info.proj) { const [gx, gz] = apply3(Hinv, c.x, c.y); maxErr = Math.max(maxErr, Math.hypot(gx - c.wx, gz - c.wz)); }
  const canvas = p.locator('canvas');
  await p.evaluate(`window.__aoVis = ${SETVIS}; window.__aoDecals = ${SETDECALS}; window.__aoCast = ${SETCAST};`);
  const ship = await raw(await canvas.screenshot());
  await p.evaluate(([u]) => window.__aoVis(u, false), [info.flat]);
  await p.waitForTimeout(700);
  const noFloor = await raw(await canvas.screenshot());
  await p.evaluate(([u]) => window.__aoVis(u, true), [info.flat]);
  await p.waitForTimeout(700);
  await p.evaluate('window.__aoDecals(false)');
  await p.waitForTimeout(700);
  const decalsOff = await raw(await canvas.screenshot());
  await p.evaluate('window.__aoDecals(true)');
  await p.evaluate('window.__aoCast(false)');
  await p.waitForTimeout(900);
  const castOff = await raw(await canvas.screenshot());
  await p.evaluate('window.__aoCast(true)');
  await p.waitForTimeout(700);

  const floor = diffMask(ship, noFloor);
  const sdLen = Math.hypot(info.keyOffset[0], info.keyOffset[2]);
  const sdx = -info.keyOffset[0] / sdLen, sdz = -info.keyOffset[2] / sdLen;
  const dist = new Float32Array(W * H).fill(-1);
  const sideC = new Float32Array(W * H);
  const sideN = new Float32Array(W * H);
  const keepSmall = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x; if (!floor.m[j]) continue;
    const [gx, gz] = apply3(Hinv, x + 0.5, y + 0.5);
    let best = 1e9, bq = null;
    for (const q of boxes) { const r = distRect(gx, gz, q); if (r < best) { best = r; bq = q; } }
    dist[j] = best;
    if (!bq) continue;
    const vcx = gx - (bq.wx0 + bq.wx1) / 2, vcz = gz - (bq.wz0 + bq.wz1) / 2;
    const lc = Math.hypot(vcx, vcz) || 1;
    sideC[j] = (vcx / lc) * sdx + (vcz / lc) * sdz;
    const [px2, pz2] = clampRect(gx, gz, bq);
    const vnx = gx - px2, vnz = gz - pz2;
    const ln = Math.hypot(vnx, vnz) || 1;
    sideN[j] = (vnx / ln) * sdx + (vnz / ln) * sdz;
    if (bq.longM <= SMALL) keepSmall[j] = 1;
  }

  const arms = {
    'CENTRE (aoband)': reduce({ ship, off: decalsOff, mask: floor.m, dist, side: sideC, w: W, h: H }),
    'NORMAL': reduce({ ship, off: decalsOff, mask: floor.m, dist, side: sideN, w: W, h: H }),
    [`NORMAL <=${SMALL}m`]: reduce({ ship, off: decalsOff, mask: floor.m, dist, side: sideN, keep: keepSmall, w: W, h: H }),
    [`CENTRE <=${SMALL}m`]: reduce({ ship, off: decalsOff, mask: floor.m, dist, side: sideC, keep: keepSmall, w: W, h: H }),
  };
  const castArms = {
    'NORMAL cast': reduce({ ship, off: castOff, mask: floor.m, dist, side: sideN, w: W, h: H }),
    [`NORMAL cast <=${SMALL}m`]: reduce({ ship, off: castOff, mask: floor.m, dist, side: sideN, keep: keepSmall, w: W, h: H }),
  };
  console.log(`\n══ ${st}  homographyErrM ${maxErr.toFixed(4)}  floorPx ${floor.n}`);
  console.log('   split                openL   contactL  contactContr  shadowC   litC    ratio   nShadow  nLit   bakedShDL  bakedLitDL');
  for (const [n, r] of Object.entries({ ...arms, ...castArms })) {
    console.log(`   ${n.padEnd(20)} ${r.openL.toFixed(4)}  ${r.contactL.toFixed(4)}    ${r.contactContrast.toFixed(4)}     ${r.shadowContrast.toFixed(4)}  ${r.litContrast.toFixed(4)}  `
      + `${(r.shadowContrast / r.litContrast).toFixed(2).padStart(6)}  ${String(r.shadowN).padStart(6)} ${String(r.litN).padStart(6)}   ${r.shadowDL.toFixed(4)}     ${r.litDL.toFixed(4)}`);
  }
  results.push({ station: st, arms, castArms, floorPx: floor.n });
  await p.close();
}
await br.close();
console.log(`\n── MEANS over ${results.length} stations   [bs_04, two isolated ~1 m barrels: shadow 0.1238 / lit 0.0161 = 7.7]`);
const names = [...Object.keys(results[0].arms), ...Object.keys(results[0].castArms)];
for (const n of names) {
  const pick = (r) => r.arms[n] || r.castArms[n];
  const m = (sel) => results.reduce((a, r) => a + sel(pick(r)), 0) / results.length;
  console.log(`   ${n.padEnd(20)} contactContr ${m((r) => r.contactContrast).toFixed(4)}   shadowC ${m((r) => r.shadowContrast).toFixed(4)}   litC ${m((r) => r.litContrast).toFixed(4)}   ratio ${(m((r) => r.shadowContrast) / m((r) => r.litContrast)).toFixed(2)}`);
}
await writeFile(`${OUT}/p2_sidecheck.json`, JSON.stringify({ base: BASE, stations: STATIONS, small: SMALL, results }, null, 1));
