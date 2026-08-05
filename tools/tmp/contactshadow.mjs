#!/usr/bin/env node
/**
 * DOES A PROP'S SHADOW TOUCH THE PROP? — and what does shortening it cost?
 *
 * Two blind critics independently named "props cast no shadow at all" as the arena's
 * #1 defect. Three probes already exist and none of them produces a number for the
 * thing that actually failed:
 *   `shadowprobe.mjs`   killed the flag hypothesis (470/740 arena meshes cast).
 *   `arena_shadow_ab.mjs` proved the shadows reach the screen (5.4-11.4% of frame).
 *   `shadowmap_vis.mjs` painted them, and by EYE they are long and displaced.
 * The missing quantity is CONTACT: does the darkening land where the object meets
 * the floor, or somewhere else entirely.
 *
 * ── What this measures ──────────────────────────────────────────────────────
 * For every cover-box prop in frame, in WORLD metres on the ground plane:
 *
 *   d   shortest distance from a visible floor pixel to that prop's footprint
 *   H   that prop's own height
 *   dL  how much the key's cast shadow darkens that pixel — the shipped frame
 *       against the same frame with `key.castShadow = false` and nothing else moved
 *
 * reported as dL binned by d/H:
 *
 *   contactDL   mean dL over d/H in (0, 0.35]     "is there a shadow AT the base"
 *   contactCov  % of that band past 0.06, which is `arena-scan`'s own
 *               "no value separation" threshold
 *   p50/p95Throw  d/H holding 50% / 95% of the shadow's total darkening mass
 *
 * ── The instrument validation, which comes first ────────────────────────────
 * A directional light at elevation e throws a point at height h exactly h*cot(e)
 * from its own base. So p95Throw has a CLOSED FORM and `--validate` sweeps the
 * elevation and checks the measurement against it. `docs/LESSONS.md` §13: eleven
 * instruments have been caught returning confident wrong answers on this project.
 * Nothing below may be believed until `--validate` passes.
 *
 * ── And the price, measured in the same run ─────────────────────────────────
 * Shortening a shadow means raising the key, and a key that is straight overhead
 * flattens the vinyl-toy modelling the whole art direction rests on. So the same
 * pass also reports, per rig:
 *
 *   heroDL      hero-vs-ground figure/ground, `valuelib.mjs`'s own `figureGround`
 *               on an exact hero matte — the number a character pass just spent
 *               surplus to raise (cast minimum 0.0834)
 *   formSpread  p90-p10 of luma across the STANDING arena geometry's own pixels —
 *               the modelling half. A light straight up collapses this.
 *
 * ── Three masks, all taken from the SHIPPED configuration ───────────────────
 * `docs/LESSONS.md` §5: "a mask from one render and a value from another is a lie
 * wherever they disagree." Each mask here is built by HIDING geometry and keeping
 * the pixels that CHANGE, so a floor pixel behind a prop does not change and is
 * correctly excluded. The hero matte is taken with the hero's own shadow already
 * off, or the diff would carry the shadow as if it were the character.
 *
 * Screen -> ground is an exact homography (a pinhole camera and a plane), fitted
 * from four world points the page projects itself and CHECKED against four more;
 * the residual is printed as `homographyErrM`.
 *
 *   node tools/tmp/contactshadow.mjs --url $URL --validate
 *   node tools/tmp/contactshadow.mjs --url $URL --rigs tools/tmp/rigs.json --out shots/lightg/r1
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { VL } from './valuelib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const BASE = arg('url', 'http://localhost:5173');
const OUT = arg('out', 'shots/lightg/cs');
const STATIONS = arg('stations', '570:430,1150:420,340:500').split(',');
const PLAYER = arg('player', 'hamburger');
const W = 1600, H = 900;
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

let RIGS = [{ id: 'ship' }];
if (has('validate')) RIGS = [20, 30, 40, 50, 60, 70].map((e) => ({ id: `elev${e}`, keyElev: e }));
else if (arg('rigs', null)) RIGS = JSON.parse(await readFile(arg('rigs'), 'utf8'));

// ── in-page: runtime lighting override ───────────────────────────────────────
// `match.ts` calls `lighting.focus()` EVERY frame and `focus()` re-sets `key.position`
// from its own authored offset, so a one-shot `key.position.set()` is overwritten
// before the next capture. The rig's `focus` is WRAPPED, not called.
const APPLY = `(cfg) => {
  const st = window.__stage, rig = st.lighting;
  const key = rig.key, fill = rig.fill, rim = rig.rim, amb = rig.ambient;
  if (!rig.__lgWrapped) {
    rig.__lgShip = {
      keyOff: key.position.clone().sub(key.target.position),
      keyInt: key.intensity, keyColor: key.color.getHex(),
      fillInt: fill.intensity, fillSky: fill.color.getHex(), fillGround: fill.groundColor.getHex(),
      rimInt: rim.intensity, rimPos: rim.position.clone(), rimColor: rim.color.getHex(),
      ambInt: amb.intensity, shadowFar: key.shadow.camera.far, shadowRadius: key.shadow.radius,
      bias: key.shadow.bias, normalBias: key.shadow.normalBias,
    };
    rig.__lgOrigFocus = rig.focus.bind(rig);
    rig.__lgCfg = null;
    rig.focus = (x, z, r) => {
      rig.__lgOrigFocus(x, z, r);
      const c = rig.__lgCfg; if (!c) return;
      const t = key.target.position, D = c.D;
      key.position.set(t.x + D * Math.cos(c.e) * Math.cos(c.a), D * Math.sin(c.e), t.z + D * Math.cos(c.e) * Math.sin(c.a));
      const s = rig.__sun;
      if (s && s.visible) {
        s.target.position.copy(t); s.target.updateMatrixWorld();
        s.position.set(t.x + D * Math.cos(c.se) * Math.cos(c.sa), D * Math.sin(c.se), t.z + D * Math.cos(c.se) * Math.sin(c.sa));
      }
    };
    rig.__lgWrapped = true;
  }
  const S = rig.__lgShip, D = S.keyOff.length();
  const shipElev = Math.asin(S.keyOff.y / D) * 180 / Math.PI;
  const shipAz = Math.atan2(S.keyOff.z, S.keyOff.x) * 180 / Math.PI;
  const elev = cfg.keyElev == null ? shipElev : cfg.keyElev;
  const az = cfg.keyAz == null ? shipAz : cfg.keyAz;
  const sElev = cfg.sunElev == null ? 70 : cfg.sunElev;
  const sAz = cfg.sunAz == null ? az : cfg.sunAz;
  rig.__lgCfg = { D, e: elev * Math.PI / 180, a: az * Math.PI / 180, se: sElev * Math.PI / 180, sa: sAz * Math.PI / 180 };

  key.intensity = cfg.keyInt == null ? S.keyInt : cfg.keyInt;
  key.color.setHex(cfg.keyColor == null ? S.keyColor : cfg.keyColor);
  key.castShadow = cfg.keyCast == null ? true : !!cfg.keyCast;
  key.shadow.camera.far = cfg.shadowFar == null ? S.shadowFar : cfg.shadowFar;
  key.shadow.radius = cfg.shadowRadius == null ? S.shadowRadius : cfg.shadowRadius;
  key.shadow.bias = cfg.bias == null ? S.bias : cfg.bias;
  key.shadow.normalBias = cfg.normalBias == null ? S.normalBias : cfg.normalBias;
  key.shadow.camera.updateProjectionMatrix();

  fill.intensity = cfg.fillInt == null ? S.fillInt : cfg.fillInt;
  fill.color.setHex(cfg.fillSky == null ? S.fillSky : cfg.fillSky);
  fill.groundColor.setHex(cfg.fillGround == null ? S.fillGround : cfg.fillGround);
  rim.intensity = cfg.rimInt == null ? S.rimInt : cfg.rimInt;
  rim.color.setHex(cfg.rimColor == null ? S.rimColor : cfg.rimColor);
  if (cfg.rimElev != null || cfg.rimAz != null) {
    const RD = S.rimPos.length();
    const re = (cfg.rimElev == null ? Math.asin(S.rimPos.y / RD) * 180 / Math.PI : cfg.rimElev) * Math.PI / 180;
    const ra = (cfg.rimAz == null ? Math.atan2(S.rimPos.z, S.rimPos.x) * 180 / Math.PI : cfg.rimAz) * Math.PI / 180;
    rim.position.set(RD * Math.cos(re) * Math.cos(ra), RD * Math.sin(re), RD * Math.cos(re) * Math.sin(ra));
  } else rim.position.copy(S.rimPos);
  amb.intensity = cfg.ambInt == null ? S.ambInt : cfg.ambInt;

  if (cfg.sunInt != null) {
    if (!rig.__sun) {
      const L = new key.constructor(0xffffff, 1);
      L.castShadow = true;
      L.shadow.mapSize.set(key.shadow.mapSize.x, key.shadow.mapSize.y);
      rig.group.add(L); rig.group.add(L.target);
      rig.__sun = L;
    }
    const s = rig.__sun;
    s.visible = true;
    s.intensity = cfg.sunInt;
    s.color.setHex(cfg.sunColor == null ? 0xfff4de : cfg.sunColor);
    s.castShadow = cfg.sunCast == null ? true : !!cfg.sunCast;
    const c2 = key.shadow.camera, s2 = s.shadow.camera;
    s2.left = c2.left; s2.right = c2.right; s2.top = c2.top; s2.bottom = c2.bottom;
    s2.near = c2.near; s2.far = c2.far; s2.updateProjectionMatrix();
    s.shadow.bias = key.shadow.bias; s.shadow.normalBias = key.shadow.normalBias;
    s.shadow.radius = key.shadow.radius;
  } else if (rig.__sun) { rig.__sun.visible = false; rig.__sun.intensity = 0; rig.__sun.castShadow = false; }

  // The rig may now OWN a front fill (lighting.ts's 'front'). Drive it the same way, so
  // a rig row can revert it to zero and reproduce the pre-change lighting exactly.
  // NO BACKTICKS IN HERE — this whole block lives inside a template literal, and one
  // backtick in a comment terminates it (docs/LESSONS.md section 9, fifth time).
  if (rig.front) {
    if (!rig.__lgFront) rig.__lgFront = { int: rig.front.intensity, pos: rig.front.position.clone(), color: rig.front.color.getHex() };
    const F = rig.__lgFront, FD = F.pos.length();
    rig.front.intensity = cfg.frontInt == null ? F.int : cfg.frontInt;
    rig.front.color.setHex(cfg.frontColor == null ? F.color : cfg.frontColor);
    const fe = (cfg.frontElev == null ? Math.asin(F.pos.y / FD) * 180 / Math.PI : cfg.frontElev) * Math.PI / 180;
    const fa = (cfg.frontAz == null ? Math.atan2(F.pos.z, F.pos.x) * 180 / Math.PI : cfg.frontAz) * Math.PI / 180;
    rig.front.position.set(FD * Math.cos(fe) * Math.cos(fa), FD * Math.sin(fe), FD * Math.cos(fe) * Math.sin(fa));
  }

  rig.focus(key.target.position.x, key.target.position.z, key.shadow.camera.right);
  st.markShadowsDirty();
  st.renderer.shadowMap.autoUpdate = true;   // probe only: the sim is frozen at 0.02x
  return { elev: +elev.toFixed(2), az: +az.toFixed(2), D: +D.toFixed(2), keyInt: key.intensity,
           fillInt: fill.intensity, rimInt: rim.intensity,
           sunInt: rig.__sun && rig.__sun.visible ? rig.__sun.intensity : 0, sunElev: sElev,
           frontInt: rig.front ? rig.front.intensity : 0 };
}`;

const SCENE = `() => {
  const st = window.__stage, scene = st.scene, cam = st.rig.camera;
  const arena = scene.getObjectByName('arena:kitchen');
  scene.updateMatrixWorld(true);
  const boxOf = (o) => {
    const g = o.geometry; if (!g) return null;
    if (o.isInstancedMesh) { o.computeBoundingBox(); }
    else if (!g.boundingBox) g.computeBoundingBox();
    const bb = o.isInstancedMesh ? o.boundingBox : g.boundingBox;
    if (!bb) return null;
    const e = o.matrixWorld.elements;
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let i = 0; i < 8; i++) {
      const vx = (i & 1) ? bb.max.x : bb.min.x, vy = (i & 2) ? bb.max.y : bb.min.y, vz = (i & 4) ? bb.max.z : bb.min.z;
      const wx = e[0]*vx + e[4]*vy + e[8]*vz + e[12];
      const wy = e[1]*vx + e[5]*vy + e[9]*vz + e[13];
      const wz = e[2]*vx + e[6]*vy + e[10]*vz + e[14];
      if (wx<x0) x0=wx; if (wx>x1) x1=wx; if (wy<y0) y0=wy; if (wy>y1) y1=wy; if (wz<z0) z0=wz; if (wz>z1) z1=wz;
    }
    return { x0, x1, y0, y1, z0, z1 };
  };
  const flat = [], stand = [];
  let floorBase = null;
  arena.traverse((o) => {
    if (!o.isMesh) return;
    const b = boxOf(o); if (!b) return;
    if (o.name === 'floor_base') floorBase = b;
    (b.y1 < 0.20 ? flat : stand).push(o.uuid);
  });
  const hero = [], cast = [], arenaCast = [];
  arena.traverse((o) => { if (o.isMesh) arenaCast.push(o.uuid); });
  const heroRoot = scene.getObjectByName('character:' + window.__lgPlayer);
  if (heroRoot) heroRoot.traverse((o) => { if (o.isMesh) hero.push(o.uuid); });
  scene.children.forEach((c) => c.traverse && c.traverse((o) => { if (o.isMesh) { let n = o, l = ''; while (n) { if (n.name) l = n.name; n = n.parent; } if (l.indexOf('character:') === 0) cast.push(o.uuid); } }));

  const boxes = window.__lgCover || [];
  const props = boxes.map((cb) => ({ ...cb, h: 0, n: 0 }));
  arena.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    const b = boxOf(o); if (!b) return;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    for (const p of props) {
      if (cx >= p.wx0 && cx <= p.wx1 && cz >= p.wz0 && cz <= p.wz1) { if (b.y1 > p.h) p.h = b.y1; p.n++; break; }
    }
  });
  const pts = [[0,0],[8,0],[0,8],[8,8],[-8,-8],[12,-5],[-5,12],[3,3]];
  const proj = pts.map(([x, z]) => {
    const v = new cam.position.constructor(x, 0, z);
    v.project(cam);
    return { x: (v.x * 0.5 + 0.5) * ${W}, y: (-v.y * 0.5 + 0.5) * ${H}, wx: x, wz: z };
  });
  const kt = st.lighting.key.target.position;
  return { flat, stand, hero, cast, arenaCast, floorBase, props, proj, keyTarget: [kt.x, kt.y, kt.z] };
}`;

const SETVIS = `(uuids, visible) => {
  const st = window.__stage, set = new Set(uuids); let n = 0;
  st.scene.traverse((o) => { if (set.has(o.uuid)) { o.visible = visible; n++; } });
  st.markShadowsDirty();
  return n;
}`;
const SETCAST = `(uuids, on) => {
  const st = window.__stage, set = new Set(uuids); let n = 0;
  st.scene.traverse((o) => {
    if (!set.has(o.uuid)) return;
    if (o.__lgCast === undefined) o.__lgCast = o.castShadow;
    o.castShadow = on ? o.__lgCast : false; n++;
  });
  st.markShadowsDirty();
  return n;
}`;

// ── maths ────────────────────────────────────────────────────────────────────
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
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const raw = (buf) => sharp(buf).removeAlpha().raw().toBuffer();
function distRect(x, z, r) {
  const dx = Math.max(r.wx0 - x, 0, x - r.wx1);
  const dz = Math.max(r.wz0 - z, 0, z - r.wz1);
  return Math.hypot(dx, dz);
}
const diffMask = (A, B, thr = 8) => {
  const m = new Uint8Array(W * H); let n = 0;
  for (let i = 0, j = 0; j < W * H; i += 3, j++) {
    if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > thr) { m[j] = 1; n++; }
  }
  return { m, n };
};

// ── run ──────────────────────────────────────────────────────────────────────
const cover = JSON.parse(await readFile('tools/arena.gameplay.json', 'utf8'));
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const results = [];

for (const st of STATIONS) {
  const [sx, sy] = st.split(':').map(Number);
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p.goto(`${BASE}/?player=${PLAYER}&enemy=donut&px=${sx}&py=${sy}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(`window.__lgPlayer = ${JSON.stringify(PLAYER)}; window.__lgVis = ${SETVIS}; window.__lgCast = ${SETCAST}; window.__lgApply = ${APPLY};`);

  // wu -> metres is `WORLD_SCALE` in `src/units.ts`, and `groundPos()` does NOT
  // re-centre: world = (x*S, 0, y*S), origin at the layout's own (0,0) corner. A
  // first draft derived the scale from `floor_base`'s width and got 0.0607 — the
  // floor plate is 21% wider than the gameplay rect — and placed every cover box
  // outside the frame, which is exactly the kind of confidently-wrong instrument
  // `docs/LESSONS.md` §13 is about. So: the constant, CHECKED against the one thing
  // in the scene that is a known function of it — `focus()` aims the key at the
  // player, so `key.target` must equal (px*S, 0, py*S) to within the focus quantum.
  const pre = await p.evaluate(`(${SCENE})()`);
  const SCALE = 0.05;
  const errX = Math.abs(pre.keyTarget[0] - sx * SCALE), errZ = Math.abs(pre.keyTarget[2] - sy * SCALE);
  if (errX > 0.25 || errZ > 0.25) {
    throw new Error(`wu->m scale check FAILED: key.target ${pre.keyTarget.map((v) => v.toFixed(2))} vs expected ${(sx * SCALE).toFixed(2)},0,${(sy * SCALE).toFixed(2)}`);
  }
  const boxes = cover.cover.map((c, i) => ({
    i, kind: c.kind,
    wx0: (c.x - c.w / 2) * SCALE, wx1: (c.x + c.w / 2) * SCALE,
    wz0: (c.y - c.h / 2) * SCALE, wz1: (c.y + c.h / 2) * SCALE,
  }));
  await p.evaluate((bx) => { window.__lgCover = bx; }, boxes);
  const info = await p.evaluate(`(${SCENE})()`);

  const Hh = fitHomography(info.proj.slice(0, 4));
  const Hinv = invert3(Hh);
  let maxErr = 0;
  for (const c of info.proj) { const [gx, gz] = apply3(Hinv, c.x, c.y); maxErr = Math.max(maxErr, Math.hypot(gx - c.wx, gz - c.wz)); }

  const canvas = p.locator('canvas');
  const shipShot = await raw(await canvas.screenshot());

  // floor-visible mask
  await p.evaluate(([u]) => window.__lgVis(u, false), [info.flat]);
  await p.waitForTimeout(700);
  const noFloor = await raw(await canvas.screenshot());
  await p.evaluate(([u]) => window.__lgVis(u, true), [info.flat]);
  // standing-arena mask
  await p.evaluate(([u]) => window.__lgVis(u, false), [info.stand]);
  await p.waitForTimeout(700);
  const noStand = await raw(await canvas.screenshot());
  await p.evaluate(([u]) => window.__lgVis(u, true), [info.stand]);
  // hero matte, with the hero's own shadow already OFF so the diff is coverage only
  await p.evaluate(([u]) => window.__lgCast(u, false), [info.hero]);
  await p.waitForTimeout(700);
  const heroCastOff = await raw(await canvas.screenshot());
  await p.evaluate(([u]) => window.__lgVis(u, false), [info.hero]);
  await p.waitForTimeout(700);
  const noHero = await raw(await canvas.screenshot());
  await p.evaluate(([u]) => window.__lgVis(u, true), [info.hero]);
  await p.evaluate(([u]) => window.__lgCast(u, true), [info.hero]);
  await p.waitForTimeout(500);

  const floor = diffMask(shipShot, noFloor);
  const stand = diffMask(shipShot, noStand);
  const heroM = diffMask(heroCastOff, noHero);

  const propOf = new Int16Array(W * H).fill(-1);
  const ratio = new Float32Array(W * H);
  const relX = new Float32Array(W * H), relZ = new Float32Array(W * H);
  const seen = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x; if (!floor.m[j]) continue;
    const [gx, gz] = apply3(Hinv, x + 0.5, y + 0.5);
    let best = -1, bestR = 1e9, bq = null;
    for (const q of info.props) {
      if (q.h < 0.35) continue;
      const r = distRect(gx, gz, q) / q.h;
      if (r < bestR) { bestR = r; best = q.i; bq = q; }
    }
    if (best >= 0 && bestR < 4) {
      propOf[j] = best; ratio[j] = bestR; seen.add(best);
      relX[j] = gx - (bq.wx0 + bq.wx1) / 2; relZ[j] = gz - (bq.wz0 + bq.wz1) / 2;
    }
  }

  // Every cast-shadow figure below is ARENA-ONLY. The characters keep casting in the
  // frame that gets LOOKED at, and stop casting for the two frames the profile is
  // diffed from — because a hamburger's own 1.7x-height shadow lands wherever it
  // lands and was showing up in the d/H tail as if a counter had thrown it. That is
  // what pinned `p95Throw` near 2.5 at every elevation in the first validation run.
  // ── THE HERO'S OWN SHADOW ────────────────────────────────────────────────
  // Measured separately and on its own render pair, because a fighter is TALL and
  // NARROW where a counter is squat and wide: at elevation e the same cot(e) adds
  // 1.24 hero-heights to a 1 m footprint and only 0.15 of a counter's own length. A
  // rig that grounds every prop can still leave the character trailing a smear, and
  // a blind critic said exactly that. `CHARACTER_RADIUS`/`CHARACTER_HEIGHT` from
  // src/units.ts: 1.05 m and 2.1 m.
  const HX = sx * SCALE, HZ = sy * SCALE, HR = 1.05, HH = 2.1;
  const heroRect = { wx0: HX - HR, wx1: HX + HR, wz0: HZ - HR, wz1: HZ + HR };
  const heroRatio = new Float32Array(W * H);
  const heroRel = new Float32Array(W * H * 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x; if (!floor.m[j]) { heroRatio[j] = -1; continue; }
    const [gx, gz] = apply3(Hinv, x + 0.5, y + 0.5);
    const r = distRect(gx, gz, heroRect) / HH;
    heroRatio[j] = r < 3 ? r : -1;
    heroRel[j * 2] = gx - HX; heroRel[j * 2 + 1] = gz - HZ;
  }

  for (const rig of RIGS) {
    const applied = await p.evaluate(([c]) => window.__lgApply(c), [rig]);
    await p.waitForTimeout(1000);
    const shotBuf = await canvas.screenshot();
    await sharp(shotBuf).toFile(`${OUT}/${PLAYER}_${sx}_${sy}__${rig.id}.png`);
    await p.evaluate(([u]) => window.__lgCast(u, false), [info.cast]);
    await p.waitForTimeout(800);
    const S = await raw(await canvas.screenshot());
    await p.evaluate(([c]) => window.__lgApply({ ...c, keyCast: false, sunCast: false }), [rig]);
    await p.waitForTimeout(900);
    const O = await raw(await canvas.screenshot());
    await p.evaluate(([c]) => window.__lgApply(c), [rig]);
    await p.evaluate(([u]) => window.__lgCast(u, true), [info.cast]);
    await p.waitForTimeout(400);

    // hero-only pair: arena stops casting, the cast keeps casting
    await p.evaluate(([u]) => window.__lgCast(u, false), [info.arenaCast]);
    await p.waitForTimeout(800);
    const HS = await raw(await canvas.screenshot());
    await p.evaluate(([c]) => window.__lgApply({ ...c, keyCast: false, sunCast: false }), [rig]);
    await p.waitForTimeout(800);
    const HO = await raw(await canvas.screenshot());
    await p.evaluate(([c]) => window.__lgApply(c), [rig]);
    await p.evaluate(([u]) => window.__lgCast(u, true), [info.arenaCast]);
    await p.waitForTimeout(400);

    // the ground direction the shadow is thrown in, for THIS rig
    const aR = (applied.az * Math.PI) / 180;
    const gdx = -Math.cos(aR), gdz = -Math.sin(aR);
    const NB = 80, BW = 0.05;
    const binSum = new Float64Array(NB), binN = new Float64Array(NB);
    let contactSum = 0, contactN = 0, contactHit = 0;
    let shadeSum = 0, shadeN = 0, shadeHit = 0;
    let coreSum = 0, coreN = 0;
    let acneN = 0, acneHit = 0;
    let frameSum = 0, frameN = 0, lumaSum = 0;
    const lum = new Float32Array(W * H);
    const standL = [];
    for (let i = 0, j = 0; j < W * H; i += 3, j++) {
      const ls = luma(S[i], S[i + 1], S[i + 2]);
      lum[j] = ls; lumaSum += ls;
      if (stand.m[j]) standL.push(ls);
      const d = luma(O[i], O[i + 1], O[i + 2]) - ls;
      if (d > 0.01) { frameSum += d; frameN++; }
      if (propOf[j] < 0) continue;
      const bi = Math.min(NB - 1, Math.floor(ratio[j] / BW));
      binSum[bi] += Math.max(0, d); binN[bi]++;
      if (ratio[j] > 0 && ratio[j] <= 0.35) {
        contactSum += Math.max(0, d); contactN++; if (d > 0.06) contactHit++;
        // ...and the half of that band the shadow is actually thrown into. A ring mean
        // averages the lit side in and halves the number a viewer sees at the base.
        if (relX[j] * gdx + relZ[j] * gdz > 0) {
          shadeSum += Math.max(0, d); shadeN++; if (d > 0.06) shadeHit++;
          // the innermost tenth of a prop-height: the "hard core" a critic asked for,
          // and the band a shadow bias erodes first (peter-panning shows up HERE or
          // nowhere).
          if (ratio[j] <= 0.10) { coreSum += Math.max(0, d); coreN++; }
        }
      }
      // ACNE DETECTOR. Open floor more than two prop-heights from any footprint has no
      // legitimate cast shadow on it once the throw is under 0.75 — so darkening out
      // there is self-shadowing speckle, which is exactly what lowering the bias buys
      // you if you lower it too far.
      if (ratio[j] > 2.0) { acneN++; if (d > 0.03) acneHit++; }
    }
    let tot = 0; const cum = [];
    for (let i2 = 0; i2 < NB; i2++) { tot += binSum[i2]; cum.push(tot); }
    // interpolated INSIDE the bin — quantising to bin centres put a floor of BW/2 on
    // the answer and broke the proportionality check at high elevation, where the
    // whole shadow lives in the first two bins.
    const qAt = (f) => {
      const t = tot * f; let acc = 0;
      for (let i2 = 0; i2 < NB; i2++) {
        if (acc + binSum[i2] >= t) return (i2 + (binSum[i2] ? (t - acc) / binSum[i2] : 0)) * BW;
        acc += binSum[i2];
      }
      return NB * BW;
    };
    standL.sort((a, c) => a - c);
    const q = (a, f) => (a.length ? a[Math.min(a.length - 1, Math.floor(f * a.length))] : 0);
    const fg = VL.figureGround(lum, W, H, heroM.m, { ringFrac: 0.30, edgeR: 4 });

    // ── the two defects a peer's blind critic named in THIS file set ───────────
    // (a) "the terminator is too hard — raise fill to ~40% of key". The measurable
    //     form is the hero's own value ladder: a softer terminator lifts p05 and
    //     narrows the range. `valuescan --mode gate`'s reference-derived thresholds
    //     are range >= 0.636 and p05 <= 0.180, so this reads on the same axis as the
    //     gate that would refuse the change. (Native resolution here; valuescan
    //     resamples to a 136 px fighter, so treat these as directional, not equal.)
    // (b) "bloom halos off the lit edge into the floor". A halo is a luminance ramp
    //     OUTSIDE the silhouette, so it is exactly measurable: the ground 2-8 px out
    //     minus the same ground 14-26 px out. Zero if the floor is flat; positive if
    //     something is bleeding off the character.
    const heroL = [];
    for (let j = 0; j < W * H; j++) if (heroM.m[j]) heroL.push(lum[j]);
    heroL.sort((a, c) => a - c);
    const hA = (applied.az * Math.PI) / 180, hgx = -Math.cos(hA), hgz = -Math.sin(hA);
    const HNB = 60, HBW = 0.05;
    const hBin = new Float64Array(HNB);
    let hCoreSum = 0, hCoreN = 0, hShadeSum = 0, hShadeN = 0, hShadeHit = 0;
    for (let i = 0, j = 0; j < W * H; i += 3, j++) {
      const r = heroRatio[j]; if (r < 0) continue;
      const d = luma(HO[i], HO[i + 1], HO[i + 2]) - luma(HS[i], HS[i + 1], HS[i + 2]);
      hBin[Math.min(HNB - 1, Math.floor(r / HBW))] += Math.max(0, d);
      if (r <= 0.35 && heroRel[j * 2] * hgx + heroRel[j * 2 + 1] * hgz > 0) {
        hShadeSum += Math.max(0, d); hShadeN++; if (d > 0.06) hShadeHit++;
        if (r <= 0.10) { hCoreSum += Math.max(0, d); hCoreN++; }
      }
    }
    let hTot = 0; const hCum = [];
    for (let i2 = 0; i2 < HNB; i2++) { hTot += hBin[i2]; hCum.push(hTot); }
    const hQ = (f) => { const t = hTot * f; let acc = 0; for (let i2 = 0; i2 < HNB; i2++) { if (acc + hBin[i2] >= t) return (i2 + (hBin[i2] ? (t - acc) / hBin[i2] : 0)) * HBW; acc += hBin[i2]; } return HNB * HBW; };

    const dOut = VL.distanceField(heroM.m, W, H, 28);   // distance TO the hero, outside it
    let nearSum = 0, nearN = 0, farSum = 0, farN = 0;
    for (let j = 0; j < W * H; j++) {
      if (heroM.m[j]) continue;
      const dd = dOut[j];
      if (dd >= 2 && dd <= 8) { nearSum += lum[j]; nearN++; }
      else if (dd >= 14 && dd <= 26) { farSum += lum[j]; farN++; }
    }
    const haloDL = nearN && farN ? nearSum / nearN - farSum / farN : null;

    const row = {
      station: `${sx}:${sy}`, player: PLAYER, rig: rig.id, applied,
      scaleMPerWu: +SCALE.toFixed(5), homographyErrM: +maxErr.toFixed(4),
      floorPx: floor.n, heroPx: heroM.n, propsInFrame: seen.size,
      contactDL: +(contactN ? contactSum / contactN : 0).toFixed(4),
      contactCov: +(contactN ? (100 * contactHit) / contactN : 0).toFixed(1),
      contactPx: contactN,
      contactShadeDL: +(shadeN ? shadeSum / shadeN : 0).toFixed(4),
      coreDL: +(coreN ? coreSum / coreN : 0).toFixed(4), corePx: coreN,
      heroCoreDL: +(hCoreN ? hCoreSum / hCoreN : 0).toFixed(4),
      heroShadeDL: +(hShadeN ? hShadeSum / hShadeN : 0).toFixed(4),
      heroShadeCov: +(hShadeN ? (100 * hShadeHit) / hShadeN : 0).toFixed(1),
      heroThrow50: +hQ(0.5).toFixed(3), heroThrow95: +hQ(0.95).toFixed(3),
      acnePct: +(acneN ? (100 * acneHit) / acneN : 0).toFixed(3), acnePx: acneN,
      contactShadeCov: +(shadeN ? (100 * shadeHit) / shadeN : 0).toFixed(1),
      p50Throw: +qAt(0.5).toFixed(3), p95Throw: +qAt(0.95).toFixed(3),
      frameShadowPct: +((100 * frameN) / (W * H)).toFixed(2),
      frameShadowDL: +(frameN ? frameSum / frameN : 0).toFixed(4),
      frameLuma: +(lumaSum / (W * H)).toFixed(4),
      heroDL: fg ? fg.dL : null, heroLuma: fg ? fg.figureLuma : null, groundLuma: fg ? fg.groundLuma : null,
      heroP05: +q(heroL, 0.05).toFixed(4), heroP95: +q(heroL, 0.95).toFixed(4),
      heroRange: +(q(heroL, 0.95) - q(heroL, 0.05)).toFixed(4),
      haloDL: haloDL == null ? null : +haloDL.toFixed(4),
      formSpread: +(q(standL, 0.90) - q(standL, 0.10)).toFixed(4),
      standMean: +(standL.length ? standL.reduce((a2, c2) => a2 + c2, 0) / standL.length : 0).toFixed(4),
      formRel: +(standL.length ? (q(standL, 0.90) - q(standL, 0.10)) / (standL.reduce((a2, c2) => a2 + c2, 0) / standL.length) : 0).toFixed(4),
      profile: Array.from({ length: 30 }, (_, i2) => +(binN[i2] ? binSum[i2] / binN[i2] : 0).toFixed(4)),
    };
    results.push(row);
    console.log(`${row.station.padEnd(9)} ${rig.id.padEnd(17)} e${String(applied.elev.toFixed(0)).padStart(3)} a${String(applied.az.toFixed(0)).padStart(4)} k${String(applied.keyInt).padStart(4)} f${String(applied.fillInt).padStart(5)} r${String(applied.rimInt).padStart(4)} s${String(applied.sunInt).padStart(4)} F${String(applied.frontInt).padStart(4)} | coreDL ${row.coreDL.toFixed(4)} shadeDL ${row.contactShadeDL.toFixed(4)} cov ${String(row.contactShadeCov).padStart(5)}% | throw ${String(row.p50Throw).padStart(5)}/${String(row.p95Throw).padStart(5)} | heroDL ${String(row.heroDL).padStart(7)} rng ${row.heroRange.toFixed(3)} p05 ${row.heroP05.toFixed(3)} halo ${String(row.haloDL).padStart(7)} | HERO core ${row.heroCoreDL.toFixed(4)} shade ${row.heroShadeDL.toFixed(4)} cov ${String(row.heroShadeCov).padStart(5)}% throw ${String(row.heroThrow50).padStart(5)}/${String(row.heroThrow95).padStart(5)} | luma ${row.frameLuma.toFixed(4)} formRel ${row.formRel.toFixed(3)}`);
  }
  await p.close();
}
await b.close();
await writeFile(`${OUT}/contact.${PLAYER}.json`, JSON.stringify(results, null, 1));

if (has('validate')) {
  // The closed form is for the shadow's TIP: a point at height h lands h*cot(e) from
  // its base. What the profile measures is where the darkening MASS sits, and for a
  // box swept along the light that mass concentrates well short of the tip — so the
  // testable claim is PROPORTIONALITY, not equality. The constant is reported, not
  // fitted away: a broken instrument fails this badly (the first draft of this tool
  // returned 2.50/2.55/2.60/2.70/2.80/2.80 across a 7.5x sweep of cot(e), i.e. a
  // ratio that moved by a factor of 7.7).
  console.log('\nINSTRUMENT VALIDATION — throw must be PROPORTIONAL to cot(elevation)');
  console.log('  elev   cot(e)   p50Throw   p95Throw   p50/cot   p95/cot');
  const byRig = new Map();
  for (const r of results) { const a = byRig.get(r.rig) ?? []; a.push(r); byRig.set(r.rig, a); }
  const k50 = [], k95 = [];
  for (const [, rs] of byRig) {
    const e = rs[0].applied.elev, cot = 1 / Math.tan((e * Math.PI) / 180);
    const m50 = rs.reduce((s, r) => s + r.p50Throw, 0) / rs.length;
    const m95 = rs.reduce((s, r) => s + r.p95Throw, 0) / rs.length;
    k50.push(m50 / cot); k95.push(m95 / cot);
    console.log(`  ${String(e.toFixed(0)).padStart(4)}   ${cot.toFixed(3).padStart(6)}   ${m50.toFixed(3).padStart(8)}   ${m95.toFixed(3).padStart(8)}   ${(m50 / cot).toFixed(3).padStart(7)}   ${(m95 / cot).toFixed(3).padStart(7)}`);
  }
  const spread = (a) => (Math.max(...a) - Math.min(...a)) / (a.reduce((s, v) => s + v, 0) / a.length);
  const s50 = spread(k50), s95 = spread(k95);
  console.log(`\n  ratio spread (max-min)/mean:  p50 ${(100 * s50).toFixed(0)}%   p95 ${(100 * s95).toFixed(0)}%`);
  console.log(`  excluding the 20 deg rung (its shadow runs off the visible pad and is truncated): p50 ${(100 * spread(k50.slice(1))).toFixed(0)}%`);
  // 45%, and the number is chosen against the FAILING case rather than to pass. The
  // first draft of this tool returned 2.50 / 2.55 / 2.60 / 2.70 / 2.80 / 2.80 over a
  // 7.5x sweep of cot(e) — a ratio that moved by a factor of 7.7, i.e. it was not
  // measuring throw at all. Anything that tracks the physics to within a factor of
  // 1.5 over that range is doing so for a reason.
  const ok = s50 <= 0.45;
  console.log(ok
    ? `\nVALIDATED on p50Throw — proportional to cot(e) with constant ${(k50.reduce((s, v) => s + v, 0) / k50.length).toFixed(3)}.`
    : '\nNOT VALIDATED — do not believe any number above.');
  process.exit(ok ? 0 : 1);
}
console.log(`\nwrote ${OUT}/contact.json`);
