#!/usr/bin/env node
/**
 * MATERIAL VARIATION — is "surfaces are flat and unlit" an AUTHORING gap or a RIG gap?
 *
 * Six independent critics named "no material variation, no contact shadow, no depth" on
 * four of five elements. `src/render/toon.ts` is the shared material factory, so the
 * finding points here — but "point a critic at a file" is not a diagnosis, and
 * `docs/LESSONS.md` §3 records that a critic's OBSERVATION is worth taking and its
 * MECHANISM is worth re-deriving. There are two completely different worlds:
 *
 *   AUTHORING GAP  every material sits at the same roughness, so no surface can differ
 *                  from any other. Fix: vary the numbers at ~200 call sites.
 *   RIG GAP        the numbers already vary, or would vary, and the difference does not
 *                  reach the screen — because a MeshStandardMaterial with metalness 0
 *                  has a fixed F0 of 0.04 and this rig gives it almost nothing bright
 *                  to reflect. Fix: the specular environment, which is `stage.ts`.
 *
 * Spending a pass on the wrong one buys nothing, and `docs/LESSONS.md` §1 says which
 * way to bet: seventeen times running, the thing was there and invisible.
 *
 * ── The three modes ──────────────────────────────────────────────────────────
 *
 *  --mode census   Every material in a live match: type, roughness, metalness,
 *                  envMapIntensity, mesh count, and whether it is on a character.
 *                  Answers "is variation authored at all" with a histogram, not a
 *                  memory. `matcover.mjs` already answers "what share of the frame does
 *                  a material own"; this answers "what is it made of".
 *
 *  --mode sweep    Drive EVERY standard material's roughness (and separately
 *                  envMapIntensity, and the scene's environmentIntensity) across its
 *                  whole range on ONE frozen frame, and measure what reaches the
 *                  screen. If the full 0.05..0.95 range of roughness moves the image by
 *                  less than the noise floor, no amount of per-material authoring can
 *                  ever be seen and the finding is a RIG gap. Every row is image-diff
 *                  guarded, so a knob that does nothing reports dMean 0.000.
 *
 *  --mode chart    THE ONE TO LOOK AT. Drops a row of spheres into the LIVE match, at
 *                  the shipped camera, under the shipped lights, through the shipped
 *                  post chain, sized to the measured on-screen height of a real
 *                  fighter — one per (roughness, metalness, envMapIntensity) cell — and
 *                  writes the frame. `docs/LESSONS.md` non-negotiable #3: judge
 *                  rendered pixels. A number cannot tell you whether two surfaces read
 *                  as different substances; this image can.
 *
 * ⚠️ The spheres are built from a geometry and a material CLONED OUT OF THE LIVE SCENE
 * and carry the same `onBeforeCompile` (so the Fresnel rim is present exactly as it is
 * on a real character). Building them from scratch would have measured a material this
 * game never uses.
 *
 *   node tools/tmp/headserve.mjs --overlay src/render -- \
 *     node tools/tmp/matvar.mjs --mode census
 *   ... --mode sweep --out shots/matvar
 *   ... --mode chart --out shots/matvar
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VL, VL_SRC } from './valuelib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const MODE = get('--mode', 'census');
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const OUT = get('--out', 'shots/matvar');
const ID = get('--id', 'hamburger');
const STATION = get('--station', 'pot_south');

const STATIONS = {
  pot_south: { x: 700, y: 640, fog: 850 },
  spawn_west: { x: 160, y: 500, fog: 850 },
};

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// ─────────────────────────────────────────────────────────────────────────────
const CENSUS = () => {
  const stage = window.__stage;
  const scene = stage.scene;
  const rows = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let top = o, vis = true;
    for (let p = o; p; p = p.parent) { if (!p.visible) vis = false; }
    while (top.parent && top.parent !== scene) top = top.parent;
    const onChar = /^character:/.test(top.name || '');
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m) continue;
      const e = rows.get(m) ?? {
        type: m.type,
        name: m.name || o.name || '(unnamed)',
        roughness: m.roughness === undefined ? null : +m.roughness.toFixed(3),
        metalness: m.metalness === undefined ? null : +m.metalness.toFixed(3),
        envMapIntensity: m.envMapIntensity === undefined ? null : +m.envMapIntensity.toFixed(3),
        clearcoat: m.clearcoat === undefined ? null : +m.clearcoat.toFixed(3),
        flatShading: !!m.flatShading,
        rim: !!(m.userData && m.userData.rimUniforms),
        hex: m.color ? '#' + m.color.getHexString() : null,
        meshes: 0, onChar: false, visible: false,
      };
      e.meshes++;
      if (onChar) e.onChar = true;
      if (vis) e.visible = true;
      rows.set(m, e);
    }
  });
  return {
    environmentIntensity: scene.environmentIntensity,
    hasEnvironment: !!scene.environment,
    rows: [...rows.values()],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
const SWEEP = (opts) => {
  const stage = window.__stage;
  const r = stage.renderer, scene = stage.scene, cam = stage.rig.camera, gl = r.getContext();
  const W = r.domElement.width, H = r.domElement.height;
  const VLl = window.VL;
  const read = () => {
    const b = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
    const out = new Uint8Array(W * H * 4);
    for (let row = 0; row < H; row++) out.set(b.subarray((H - 1 - row) * W * 4, (H - row) * W * 4), row * W * 4);
    return out;
  };

  // ── the player's exact matte, from the DIRECT render (same rule as valuescan) ──
  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };
  const savedBg = scene.background, savedShadow = r.shadowMap.enabled, savedAlpha = r.getClearAlpha();
  let hidden = [];
  const hideEnv = (keep) => {
    hidden = [];
    for (const kid of scene.children) { if (keep.has(kid)) continue; if (kid.visible) { hidden.push(kid); kid.visible = false; } }
  };
  const showEnv = () => { for (const k of hidden) k.visible = true; hidden = []; };
  const matteAll = () => {
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true; r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    const A = read();
    r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
    const B = read();
    const m = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < A.length; i += 4, j++) {
      m[j] = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) < 32 ? 1 : 0;
    }
    return m;
  };

  let mask = null;
  try {
    let best = null;
    for (const c of casts) {
      hideEnv(new Set([topOf(c)]));
      const others = [];
      for (const o of casts) { if (o !== c && topOf(o) === topOf(c) && o.visible) { others.push(o); o.visible = false; } }
      const m = matteAll();
      for (const o of others) o.visible = true;
      showEnv();
      let n = 0; for (let j = 0; j < m.length; j++) n += m[j];
      if (c.name === 'character:' + opts.playerId && n > 0) { best = { m, n }; break; }
      if (!best || n > best.n) best = { m, n };
    }
    mask = best.m;
  } finally {
    showEnv();
    scene.background = savedBg; r.shadowMap.enabled = savedShadow; r.setClearColor(0x000000, savedAlpha);
  }

  // ── every standard material, and its shipped settings ────────────────────
  const mats = [];
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of list) {
      if (!m || seen.has(m) || !m.isMeshStandardMaterial) continue;
      seen.add(m);
      mats.push({ m, rough: m.roughness, metal: m.metalness, env: m.envMapIntensity });
    }
  });
  const env0 = scene.environmentIntensity;
  const restore = () => {
    for (const e of mats) { e.m.roughness = e.rough; e.m.metalness = e.metal; e.m.envMapIntensity = e.env; }
    scene.environmentIntensity = env0;
  };

  const stats = () => {
    stage.render(0); stage.render(0);
    const px = read();
    const luma = new Float32Array(W * H);
    for (let j = 0, i = 0; j < W * H; j++, i += 4) luma[j] = VLl.luma(px[i], px[i + 1], px[i + 2]);
    const lm = [];
    for (let j = 0; j < W * H; j++) if (mask[j]) lm.push(luma[j]);
    const L = VLl.ladder(lm, {});
    const FG = VLl.figureGround(luma, W, H, mask, { ringFrac: 0.30, edgeR: 4 });
    // SPECULAR HEADROOM: how far the brightest part of a surface sits above its own
    // middle. A perfectly matte lambert surface under one key has a small headroom; a
    // glossy one has a bright, localised hit. Measured on the character's own matte so
    // albedo differences between characters cannot move it.
    const s = Float64Array.from(lm); s.sort();
    const q = (f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
    let clip = 0; for (const v of lm) if (v > 0.94) clip++;
    let whole = 0; for (let i = 0; i < px.length; i += 4) if (px[i] === 255 || px[i + 1] === 255 || px[i + 2] === 255) whole++;
    return {
      frame: px,
      p05: +L.p05.toFixed(4), p50: +L.p50.toFixed(4), p95: +L.p95.toFixed(4),
      p99: +q(0.99).toFixed(4), range: +L.range.toFixed(4), steps10: L.steps.j10,
      specHead: +(q(0.99) - q(0.50)).toFixed(4),
      clipShare: +(clip / lm.length).toFixed(5),
      clipHi: +((100 * whole) / (px.length / 4)).toFixed(3),
      dL: FG.dL, dLedge: FG.dLedge,
    };
  };

  const CONFIGS = [
    ['shipped', () => {}],
    ['roughness 0.05 (all)', () => { for (const e of mats) e.m.roughness = 0.05; }],
    ['roughness 0.20 (all)', () => { for (const e of mats) e.m.roughness = 0.20; }],
    ['roughness 0.35 (all)', () => { for (const e of mats) e.m.roughness = 0.35; }],
    ['roughness 0.70 (all)', () => { for (const e of mats) e.m.roughness = 0.70; }],
    ['roughness 0.95 (all)', () => { for (const e of mats) e.m.roughness = 0.95; }],
    ['metalness 0.30 (all)', () => { for (const e of mats) e.m.metalness = 0.30; }],
    ['envMapIntensity x0', () => { for (const e of mats) e.m.envMapIntensity = 0; }],
    ['envMapIntensity x2', () => { for (const e of mats) e.m.envMapIntensity = (e.env ?? 1) * 2; }],
    ['envMapIntensity x4', () => { for (const e of mats) e.m.envMapIntensity = (e.env ?? 1) * 4; }],
    ['scene.envIntensity x0', () => { scene.environmentIntensity = 0; }],
    ['scene.envIntensity x2', () => { scene.environmentIntensity = env0 * 2; }],
    ['rough .20 + env x3', () => {
      for (const e of mats) { e.m.roughness = 0.20; e.m.envMapIntensity = (e.env ?? 1) * 3; }
    }],
  ];

  const out = [];
  let shipped = null;
  for (const [label, apply] of CONFIGS) {
    restore();
    apply();
    for (const e of mats) e.m.needsUpdate = false; // uniforms only; no recompile needed
    const s = stats();
    if (label === 'shipped') shipped = s.frame;
    let sum = 0, mx = 0, over = 0;
    for (let i = 0; i < shipped.length; i += 4) {
      const d = Math.max(Math.abs(shipped[i] - s.frame[i]), Math.abs(shipped[i + 1] - s.frame[i + 1]), Math.abs(shipped[i + 2] - s.frame[i + 2]));
      sum += d; if (d > mx) mx = d; if (d > 2) over++;
    }
    const n = shipped.length / 4;
    delete s.frame;
    out.push({ label, ...s, dMean: +(sum / n).toFixed(4), dMax: mx, dPct: +((100 * over) / n).toFixed(2) });
  }
  restore();
  stage.render(0);
  return { materials: mats.length, environmentIntensity: env0, maskPx: mask.reduce((x, y) => x + y, 0), configs: out };
};

// ─────────────────────────────────────────────────────────────────────────────
const CHART = (opts) => {
  const stage = window.__stage;
  const r = stage.renderer, scene = stage.scene, cam = stage.rig.camera, gl = r.getContext();
  const W = r.domElement.width, H = r.domElement.height;

  // Find the player, a sphere geometry, and a rim-carrying standard material to clone.
  let player = null, sphereGeo = null, protoMat = null, protoMesh = null;
  scene.traverse((o) => {
    if (!player && /^character:/.test(o.name || '')) player = o;
    if (!o.isMesh) return;
    if (!protoMesh) protoMesh = o;
    if (!sphereGeo && o.geometry && o.geometry.type === 'SphereGeometry') sphereGeo = o.geometry;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!protoMat && m && m.isMeshStandardMaterial && m.userData && m.userData.rimUniforms) protoMat = m;
  });
  if (!player || !sphereGeo || !protoMat || !protoMesh) {
    return { error: `missing player=${!!player} sphere=${!!sphereGeo} mat=${!!protoMat}` };
  }

  const V3 = player.position.constructor;
  const base = new V3();
  player.getWorldPosition(base);

  // Sphere radius chosen so the ball's on-screen height matches a fighter's measured
  // 147 px, i.e. the chart is judged at the size the game actually renders at
  // (`docs/LESSONS.md` §6 — every earlier loop judged at ~3.5x the real zoom).
  const R = opts.radius;
  const group = new (scene.constructor)();  // a Scene is an Object3D; only used as a holder
  const holder = new (protoMesh.parent.constructor)();
  scene.add(holder);

  const cells = opts.cells;
  const cols = Math.ceil(Math.sqrt(cells.length));
  const made = [];
  const geo = new (sphereGeo.constructor)(R, 40, 28);
  cells.forEach((c, i) => {
    const m = new (protoMat.constructor)({
      color: new (protoMat.color.constructor)(opts.albedo),
      roughness: c.rough, metalness: c.metal,
    });
    m.envMapIntensity = c.env;
    if (c.rim !== false) { m.onBeforeCompile = protoMat.onBeforeCompile; m.needsUpdate = true; }
    const mesh = new (protoMesh.constructor)(geo, m);
    const cx = (i % cols) - (cols - 1) / 2;
    const cz = Math.floor(i / cols) - (Math.ceil(cells.length / cols) - 1) / 2;
    mesh.position.set(base.x + cx * R * 2.6, R * 1.05, base.z + cz * R * 2.6);
    mesh.castShadow = true; mesh.receiveShadow = true;
    holder.add(mesh);
    made.push({ mesh, m });
  });
  stage.markShadowsDirty();
  stage.render(0); stage.render(0);
  const b = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
  const px = new Uint8Array(W * H * 4);
  for (let row = 0; row < H; row++) px.set(b.subarray((H - 1 - row) * W * 4, (H - row) * W * 4), row * W * 4);

  // Per-sphere statistics, from its own screen bbox, so the image has numbers with it.
  const proj = made.map(({ mesh }) => {
    const v = new V3();
    mesh.getWorldPosition(v);
    v.project(cam);
    return { x: Math.round((v.x * 0.5 + 0.5) * W), y: Math.round((-v.y * 0.5 + 0.5) * H) };
  });
  const luma = (i) => (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
  const rad = Math.round(opts.sampleRadius);
  const per = made.map(({ m }, i) => {
    const { x, y } = proj[i];
    const vals = [];
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      vals.push(luma((yy * W + xx) * 4));
    }
    vals.sort((p, q) => p - q);
    const q = (f) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(f * vals.length))] : null);
    return {
      rough: cells[i].rough, metal: cells[i].metal, env: cells[i].env, rim: cells[i].rim !== false,
      px: vals.length, screen: [x, y],
      p10: +q(0.10).toFixed(4), p50: +q(0.50).toFixed(4), p90: +q(0.90).toFixed(4), p99: +q(0.99).toFixed(4),
      spread: +(q(0.90) - q(0.10)).toFixed(4),
      specHead: +(q(0.99) - q(0.50)).toFixed(4),
    };
  });

  for (const { mesh, m } of made) { holder.remove(mesh); m.dispose(); }
  geo.dispose();
  scene.remove(holder);
  stage.markShadowsDirty();
  stage.render(0);

  let str = '';
  const rgb = new Uint8Array(W * H * 3);
  for (let j = 0; j < W * H; j++) { rgb[j * 3] = px[j * 4]; rgb[j * 3 + 1] = px[j * 4 + 1]; rgb[j * 3 + 2] = px[j * 4 + 2]; }
  for (let i = 0; i < rgb.length; i += 8192) str += String.fromCharCode.apply(null, rgb.subarray(i, i + 8192));
  return { w: W, h: H, b64: btoa(str), per, group: !!group };
};

// ─────────────────────────────────────────────────────────────────────────────
if (!BASE) { console.error('PREVIEW_BASE unset — run under headserve.mjs'); process.exit(2); }
const st = STATIONS[STATION];
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript({ content: VL_SRC });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 300)));
await page.goto(`${BASE}/?player=${ID}&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
await page.waitForTimeout(900);

if (MODE === 'census') {
  const res = await page.evaluate(CENSUS);
  const std = res.rows.filter((r) => /Standard|Physical/.test(r.type));
  const vis = std.filter((r) => r.visible);
  console.log(`\nMATERIAL CENSUS — live match, ${ID} @ ${STATION}`);
  console.log(`scene.environmentIntensity ${res.environmentIntensity}   environment map: ${res.hasEnvironment ? 'yes' : 'NO'}`);
  console.log(`materials ${res.rows.length}   standard/physical ${std.length}   visible ${vis.length}`);
  const byType = {};
  for (const r of res.rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
  console.log('by type:', JSON.stringify(byType));
  const hist = new Map();
  for (const r of std) hist.set(r.roughness, (hist.get(r.roughness) ?? 0) + 1);
  const sorted = [...hist.entries()].sort((x, y) => y[1] - x[1]);
  console.log('\nroughness histogram (standard/physical materials):');
  for (const [v, n] of sorted) {
    console.log(`  ${String(v).padStart(6)}  ${String(n).padStart(4)}  ${((100 * n) / std.length).toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round((60 * n) / std.length))}`);
  }
  const mh = new Map();
  for (const r of std) mh.set(r.metalness, (mh.get(r.metalness) ?? 0) + 1);
  console.log('metalness histogram:', JSON.stringify([...mh.entries()].sort((x, y) => y[1] - x[1])));
  const eh = new Map();
  for (const r of std) eh.set(r.envMapIntensity, (eh.get(r.envMapIntensity) ?? 0) + 1);
  console.log('envMapIntensity histogram:', JSON.stringify([...eh.entries()].sort((x, y) => y[1] - x[1])));
  const chars = std.filter((r) => r.onChar);
  const ch = new Map();
  for (const r of chars) ch.set(r.roughness, (ch.get(r.roughness) ?? 0) + 1);
  console.log(`\nON A CHARACTER: ${chars.length} standard materials, roughness:`, JSON.stringify([...ch.entries()].sort((x, y) => y[1] - x[1])));
  console.log(`carrying the Fresnel rim: ${std.filter((r) => r.rim).length} of ${std.length}`);
  const uniq = new Set(std.map((r) => `${r.roughness}|${r.metalness}|${r.envMapIntensity}`));
  console.log(`\nDISTINCT (roughness, metalness, envMapIntensity) TRIPLES: ${uniq.size} across ${std.length} materials`);
  await writeFile(join(OUT, 'census.json'), JSON.stringify(res, null, 2));
} else if (MODE === 'sweep') {
  const res = await page.evaluate(SWEEP, { playerId: ID });
  console.log(`\nMATERIAL SWEEP — ${res.materials} standard materials, ${res.maskPx} px of ${ID}, envIntensity ${res.environmentIntensity}`);
  console.log('config                        p05    p50    p95    p99  range st specHead clipShare     dL  dLedge | dMean  dMax  dPct');
  for (const c of res.configs) {
    console.log(`${c.label.padEnd(26)}${c.p05.toFixed(3).padStart(7)}${c.p50.toFixed(3).padStart(7)}${c.p95.toFixed(3).padStart(7)}${c.p99.toFixed(3).padStart(7)}` +
      `${c.range.toFixed(3).padStart(7)}${String(c.steps10).padStart(3)}${c.specHead.toFixed(4).padStart(9)}${c.clipShare.toFixed(4).padStart(10)}` +
      `${String(c.dL).padStart(7)}${String(c.dLedge).padStart(8)} | ${String(c.dMean).padStart(6)}${String(c.dMax).padStart(6)}${String(c.dPct).padStart(6)}`);
  }
  await writeFile(join(OUT, 'sweep.json'), JSON.stringify(res, null, 2));
} else if (MODE === 'chart') {
  const cells = [];
  for (const rough of [0.08, 0.25, 0.52, 0.75, 0.95]) {
    for (const env of [0, 1, 3]) cells.push({ rough, metal: 0, env });
  }
  const res = await page.evaluate(CHART, {
    cells, radius: Number(get('--radius', 0.62)), albedo: get('--albedo', '#c9542f'),
    sampleRadius: Number(get('--sample-radius', 16)),
  });
  if (res.error) { console.error(res.error); process.exit(1); }
  await sharp(Buffer.from(res.b64, 'base64'), { raw: { width: res.w, height: res.h, channels: 3 } })
    .png().toFile(join(OUT, 'chart.png'));
  console.log('\nMATERIAL CHART — spheres at shipped camera / lights / post chain');
  console.log('rough  metal  env    p10    p50    p90    p99  spread specHead   px  screen');
  for (const p of res.per) {
    console.log(`${String(p.rough).padStart(5)}${String(p.metal).padStart(7)}${String(p.env).padStart(5)}` +
      `${p.p10.toFixed(3).padStart(7)}${p.p50.toFixed(3).padStart(7)}${p.p90.toFixed(3).padStart(7)}${p.p99.toFixed(3).padStart(7)}` +
      `${p.spread.toFixed(4).padStart(8)}${p.specHead.toFixed(4).padStart(9)}${String(p.px).padStart(6)}  ${p.screen}`);
  }
  await writeFile(join(OUT, 'chart.json'), JSON.stringify(res.per, null, 2));
  console.log(`\nwrote ${OUT}/chart.png`);
}
await browser.close();
