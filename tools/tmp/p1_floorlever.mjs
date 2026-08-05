#!/usr/bin/env node
// capture-audit: css-immune — gl.readPixels only, no DOM screenshot, no element rect.
/**
 * P1_FLOORLEVER — price the material levers on the surface that OWNS the frame.
 *
 * `p1_matresp` measured that three materials — `kpal:tileDark`, `kpal:tileLight`,
 * `kpal:utilityMat` — own 58.8% of a gameplay frame between them, and `p1_rimlook`
 * showed the Fresnel rim reaching 1.4% of pixels. So whatever "surfaces are flat and
 * unlit" is about, it is mostly about those three, and none of the three leads recorded
 * in `docs/STATE.md` PART 2 touches them.
 *
 * A flat ground plane has a CONSTANT normal, so N·L is constant across it and no light
 * rig can produce variation on it. Only three things can:
 *   ROUGHNESS   the specular lobe still varies across the plane because the VIEW vector
 *               does; at 0.55-0.65 that lobe is in the collapsed zone `matvar` measured
 *   NORMAL MAP  the only way to give a plane varying normals at all. There are ZERO
 *               normalMaps in this entire project (grep: 0 hits in src/**)
 *   ENVMAP      per-material `envMapIntensity` is silently discarded by three unless the
 *               material carries its OWN `envMap` — proved here, on HEAD, live
 *
 * Every mutation runs on ONE FROZEN FRAME, so the rows differ by exactly one thing, and
 * every row is image-diff guarded: a knob that does nothing reports dMean 0.0000.
 *
 * KNOWN-BAD CONTROLS, both built in and both required to pass:
 *   NULL   write each material's roughness back at its own value -> dMean must be 0
 *   ENV0   set `envMapIntensity` WITHOUT setting `envMap` -> must be EXACTLY 0.0000,
 *          because that is the three.js discard this run exists to demonstrate
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/p1_floorlever.mjs --out shots/p1
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { settleScreen } from './settle.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/p1');
const ID = get('--id', 'hamburger');
const W = Number(get('--w', 1300));
const H = Number(get('--h', 740));
const NAMES = get('--mats', 'kpal:tileDark,kpal:tileLight,kpal:utilityMat,kpal:subfloor').split(',');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const PROBE = ({ names }) => {
  const stage = window.__stage;
  const { scene, renderer } = stage;
  const cam = stage.rig.camera;
  const gl = renderer.getContext();
  const w = renderer.domElement.width; const h = renderer.domElement.height; const n = w * h;
  const read = () => { const b = new Uint8Array(n * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const shot = () => { stage.render(0.0); return read(); };

  // ── catalogue + ID mask FIRST, before anything mutates a program ───────────
  const mats = []; const idx = new Map(); const meshes = [];
  let basicProto = null;
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    if (m.isMeshBasicMaterial && !basicProto) basicProto = m;
    if (!idx.has(m.uuid)) { idx.set(m.uuid, mats.length); mats.push({ ref: m, name: m.name || '(unnamed)', type: m.type }); }
    meshes.push({ o, i: idx.get(m.uuid) });
  });
  const savedTone = renderer.toneMapping; renderer.toneMapping = 0;
  const savedBg = scene.background; scene.background = null;
  const idMats = mats.map((_, i) => {
    const mm = basicProto.clone();
    mm.map = null; mm.alphaMap = null; mm.transparent = false; mm.opacity = 1;
    mm.depthWrite = true; mm.depthTest = true; mm.fog = false; mm.side = 0;
    const id = i + 1;
    mm.color.setRGB(((id & 15) * 16 + 8) / 255, (((id >> 4) & 15) * 16 + 8) / 255, (((id >> 8) & 15) * 16 + 8) / 255, 'srgb');
    return mm;
  });
  const saved = meshes.map((e) => e.o.material);
  meshes.forEach((e) => { e.o.material = idMats[e.i]; });
  renderer.setRenderTarget(null); renderer.clear(true, true, true); renderer.render(scene, cam);
  const ids = read();
  meshes.forEach((e, k) => { e.o.material = saved[k]; });
  idMats.forEach((m) => m.dispose());
  renderer.toneMapping = savedTone; scene.background = savedBg;

  const q = (v) => Math.min(15, Math.max(0, Math.round((v - 8) / 16)));
  const want = new Set();
  mats.forEach((e, i) => { if (names.includes(e.name)) want.add(i + 1); });
  const mask = new Uint8Array(n); let maskPx = 0;
  for (let p = 0; p < n; p++) {
    const id = q(ids[p * 4]) | (q(ids[p * 4 + 1]) << 4) | (q(ids[p * 4 + 2]) << 8);
    if (want.has(id)) { mask[p] = 1; maskPx++; }
  }
  const targets = mats.filter((e) => names.includes(e.name)).map((e) => e.ref);
  if (!targets.length) return { error: `none of ${names.join(',')} found` };

  // ── a procedural NORMAL MAP, built here so the probe needs no source change ──
  const mkNormal = (size, amp, freq) => {
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    // value-noise height field -> central-difference normal, tangent space
    const R = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const H2 = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = 0; let amp2 = 1; let f = freq;
      for (let o = 0; o < 3; o++) {
        const xi = Math.floor((x * f) / size); const yi = Math.floor((y * f) / size);
        const fx = ((x * f) / size) - xi; const fy = ((y * f) / size) - yi;
        const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
        const a00 = R(xi, yi); const a10 = R(xi + 1, yi); const a01 = R(xi, yi + 1); const a11 = R(xi + 1, yi + 1);
        v += amp2 * ((a00 * (1 - sx) + a10 * sx) * (1 - sy) + (a01 * (1 - sx) + a11 * sx) * sy);
        amp2 *= 0.5; f *= 2;
      }
      H2[y * size + x] = v;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const l = H2[y * size + ((x + size - 1) % size)]; const r = H2[y * size + ((x + 1) % size)];
      const u = H2[((y + size - 1) % size) * size + x]; const d = H2[((y + 1) % size) * size + x];
      const nx = -(r - l) * amp; const ny = -(d - u) * amp; const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i4 = (y * size + x) * 4;
      img.data[i4] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      img.data[i4 + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      img.data[i4 + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      img.data[i4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  };

  const stats = (X) => {
    const L = [];
    for (let p = 0; p < n; p++) if (mask[p]) L.push((0.2126 * X[p * 4] + 0.7152 * X[p * 4 + 1] + 0.0722 * X[p * 4 + 2]) / 255);
    L.sort((x, y) => x - y);
    const pc = (f) => L[Math.min(L.length - 1, Math.floor(f * L.length))];
    return { p05: +pc(0.05).toFixed(4), p50: +pc(0.50).toFixed(4), p95: +pc(0.95).toFixed(4), p99: +pc(0.99).toFixed(4),
      range: +(pc(0.95) - pc(0.05)).toFixed(4), specHead: +(pc(0.99) - pc(0.50)).toFixed(4) };
  };
  const diff = (A, X) => {
    let s = 0; let mx = 0; let cnt = 0; let sIn = 0; let cIn = 0;
    for (let p = 0; p < n; p++) {
      const d = Math.max(Math.abs(A[p * 4] - X[p * 4]), Math.abs(A[p * 4 + 1] - X[p * 4 + 1]), Math.abs(A[p * 4 + 2] - X[p * 4 + 2]));
      s += d; if (d > mx) mx = d; if (d > 1) cnt++;
      if (mask[p]) { sIn += d; if (d > 1) cIn++; }
    }
    return { dMean: +(s / n).toFixed(4), dMax: mx, dPct: +((100 * cnt) / n).toFixed(3),
      dMeanIn: +(sIn / maskPx).toFixed(4), dPctIn: +((100 * cIn) / maskPx).toFixed(2) };
  };

  const origR = targets.map((m) => m.roughness);
  const origM = targets.map((m) => m.metalness);
  const A = shot();
  const rows = [{ label: 'HEAD (control)', ...stats(A), ...diff(A, A) }];

  const setR = (v) => { targets.forEach((m, i) => { m.roughness = v === null ? origR[i] : v; }); };
  // KNOWN-BAD CONTROL: write roughness back at its own value. Must be exactly 0.
  setR(null); { const X = shot(); rows.push({ label: 'NULL roughness rewrite', ...stats(X), ...diff(A, X) }); }
  for (const r of [0.15, 0.25, 0.35, 0.45, 0.85]) { setR(r); const X = shot(); rows.push({ label: `roughness -> ${r}`, ...stats(X), ...diff(A, X) }); }
  setR(null);

  // ── envMapIntensity, WITHOUT its own envMap: the documented three.js discard ──
  const origE = targets.map((m) => m.envMapIntensity);
  targets.forEach((m) => { m.envMapIntensity = 6; });
  { const X = shot(); rows.push({ label: 'KNOWN-BAD envMapIntensity 6, no envMap', ...stats(X), ...diff(A, X) }); }
  // ...and WITH it, which is the one-line fix under test
  targets.forEach((m) => { m.envMap = scene.environment; m.envMapIntensity = scene.environmentIntensity; m.needsUpdate = true; });
  { const X = shot(); rows.push({ label: 'envMap=scene.env @ scene intensity (should be ~identity)', ...stats(X), ...diff(A, X) }); }
  for (const k of [2, 4]) {
    targets.forEach((m) => { m.envMapIntensity = scene.environmentIntensity * k; });
    const X = shot(); rows.push({ label: `envMap set, intensity x${k}`, ...stats(X), ...diff(A, X) });
  }
  targets.forEach((m, i) => { m.envMap = null; m.envMapIntensity = origE[i]; m.needsUpdate = true; });
  { const X = shot(); rows.push({ label: 'restored (control, must return to ~0)', ...stats(X), ...diff(A, X) }); }

  // ── NORMAL MAP — the thing that does not exist anywhere in this project ─────
  //
  // ⚠️ THE FIRST VERSION OF THIS BLOCK CONTAMINATED ITS OWN MEASUREMENT, and the
  // built-in restore control is what caught it (it came back at dMean 10.46 instead of
  // 0). `Texture.clone()` copies `source` BY REFERENCE and `texture.image` is a
  // setter over `source.data`, so `proto.map.clone().image = cv` overwrites the
  // ORIGINAL tile-wear albedo — and three caches uploaded textures by SOURCE, so the
  // shared GPU texture is re-uploaded with the normal data. Every "normal map" row was
  // really "normal map AND the albedo replaced by noise". Built fresh here instead.
  const proto = targets.find((m) => m.map) || null;
  const TexCtor = proto && proto.map ? Object.getPrototypeOf(proto.map).constructor : null;
  const shots = {};
  const normalRows = [];
  for (const cfg of [{ amp: 6, freq: 8, scale: 0.35 }, { amp: 14, freq: 8, scale: 0.7 }, { amp: 14, freq: 24, scale: 0.7 }]) {
    const cv = mkNormal(256, cfg.amp, cfg.freq);
    let tex = null;
    if (TexCtor) {
      tex = new TexCtor(cv);
      tex.wrapS = proto.map.wrapS; tex.wrapT = proto.map.wrapT;
      if (tex.repeat && proto.map.repeat) tex.repeat.copy(proto.map.repeat);
      tex.needsUpdate = true;
    }
    if (!tex) break;
    targets.forEach((m) => {
      m.normalMap = tex;
      if (m.normalScale && m.normalScale.set) m.normalScale.set(cfg.scale, cfg.scale);
      m.needsUpdate = true;
    });
    const X = shot();
    const row = { label: `normalMap amp${cfg.amp} freq${cfg.freq} scale${cfg.scale}`, ...stats(X), ...diff(A, X) };
    rows.push(row); normalRows.push(row);
    if (cfg.amp === 14 && cfg.freq === 8) {
      const F = new Uint8Array(w * h * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const s = ((h - 1 - y) * w + x) * 4; const d = (y * w + x) * 3;
        F[d] = X[s]; F[d + 1] = X[s + 1]; F[d + 2] = X[s + 2];
      }
      let str = ''; const CH = 0x8000;
      for (let i = 0; i < F.length; i += CH) str += String.fromCharCode.apply(null, F.subarray(i, i + CH));
      shots.normal = btoa(str);
    }
  }
  targets.forEach((m) => { m.normalMap = null; if (m.normalScale && m.normalScale.set) m.normalScale.set(1, 1); m.needsUpdate = true; });
  { const X = shot(); rows.push({ label: 'normalMap removed (control, must return to ~0)', ...stats(X), ...diff(A, X) }); }

  const F = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((h - 1 - y) * w + x) * 4; const d = (y * w + x) * 3;
    F[d] = A[s]; F[d + 1] = A[s + 1]; F[d + 2] = A[s + 2];
  }
  { let str = ''; const CH = 0x8000;
    for (let i = 0; i < F.length; i += CH) str += String.fromCharCode.apply(null, F.subarray(i, i + CH));
    shots.head = btoa(str); }

  return { w, h, maskPx, maskPct: +((100 * maskPx) / n).toFixed(2),
    targets: targets.map((m, i) => ({ name: m.name, type: m.type, roughness: origR[i], metalness: origM[i],
      envMapIntensity: origE[i], hasMap: !!m.map, hasNormalMap: !!m.normalMap })),
    rows, shots, environmentIntensity: scene.environmentIntensity };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?player=${ID}&enemy=donut&px=700&py=640&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await settleScreen(page, { timeout: 60000, soft: true, label: 'floorlever' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(300);
const r = await page.evaluate(PROBE, { names: NAMES });
await browser.close();
if (r.error) { console.error(r.error); process.exit(1); }

console.log(`\nFLOOR LEVERS — mask ${r.maskPx} px = ${r.maskPct}% of a ${r.w}x${r.h} frame, scene.environmentIntensity ${r.environmentIntensity}`);
console.log('targets:', r.targets.map((t) => `${t.name}(${t.type} r${t.roughness} env${t.envMapIntensity} map:${t.hasMap ? 'y' : 'n'} nrm:${t.hasNormalMap ? 'y' : 'n'})`).join('  '));
console.log('\nrow                                                    p05    p50    p95  range specHd |  dMean  dMax  dPct%  dMeanIn dPctIn%');
for (const x of r.rows) {
  console.log(`${x.label.padEnd(52)}${x.p05.toFixed(3).padStart(7)}${x.p50.toFixed(3).padStart(7)}${x.p95.toFixed(3).padStart(7)}`
    + `${x.range.toFixed(3).padStart(7)}${x.specHead.toFixed(3).padStart(7)} |${String(x.dMean).padStart(7)}${String(x.dMax).padStart(6)}`
    + `${String(x.dPct).padStart(7)}${String(x.dMeanIn).padStart(9)}${String(x.dPctIn).padStart(8)}`);
}
for (const [k, v] of Object.entries(r.shots)) {
  await sharp(Buffer.from(v, 'base64'), { raw: { width: r.w, height: r.h, channels: 3 } }).png().toFile(join(OUT, `floor_${k}.png`));
}
await writeFile(join(OUT, 'floorlever.json'), JSON.stringify({ ...r, shots: undefined }, null, 2));
console.log(`\nwrote ${OUT}/floorlever.json and ${Object.keys(r.shots).map((k) => `floor_${k}.png`).join(', ')}`);
