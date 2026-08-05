#!/usr/bin/env node
// capture-audit: css-immune — gl.readPixels only, no DOM screenshot, no element rect.
/**
 * P1_CASTMAT — price `docs/STATE.md` lead 1 ("glossyMat has no rim at all") with the
 * gate it has to clear.
 *
 * The lead is recorded as one line, gated on "a per-character clipShare run" that was
 * never done. This does that run, and it does it by SIMULATING the source change on a
 * live frozen frame rather than by reasoning about it: every MeshPhysicalMaterial in the
 * scene is given the same Fresnel patch `applyRimLight` installs, at the same default
 * strength 0.28, and the character's own matte is re-measured.
 *
 * Per character, on its exact two-clear-colour matte at SHIPPED gameplay framing:
 *
 *   mattePx      the character's delivered pixels
 *   physShare    share of the matte owned by MeshPhysicalMaterial — i.e. how much of
 *                this character the change can even touch
 *   clipShare    share of the matte above luma 0.94. The number the near-white pass
 *                drove 0.1007 -> 0.0275 against a reference MEDIAN of 0.0249 and a
 *                reference band MAXIMUM of 0.0929 (`render/toon.ts`)
 *   p05 / range  the value-ladder rails: range >= 0.636, p05 <= 0.180
 *
 * CONTROLS, both required:
 *   NULL   re-render with nothing changed -> every number identical
 *   rim 0  patch the physical materials and drive the new uniform to 0 -> must return
 *          to the HEAD row, which proves the patch itself (a recompile, a new program)
 *          is not what moved the numbers
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/p1_castmat.mjs --ids lollipop,sushi,soup,egg,hamburger
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { settleScreen } from './settle.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/p1');
const IDS = get('--ids', 'lollipop,sushi,soup,egg,hamburger').split(',');
const STRENGTH = Number(get('--strength', 0.28));
const W = Number(get('--w', 1300));
const H = Number(get('--h', 740));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const PROBE = ({ id, strength }) => {
  const stage = window.__stage;
  const { scene, renderer } = stage;
  const cam = stage.rig.camera;
  const gl = renderer.getContext();
  const w = renderer.domElement.width; const h = renderer.domElement.height; const n = w * h;
  const read = () => { const b = new Uint8Array(n * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const shot = () => { stage.render(0.0); return read(); };

  const root = scene.children.find((k) => k.name === `character:${id}`);
  if (!root) return { error: `no scene child named character:${id} (have ${scene.children.map((k) => k.name).join(',')})` };

  // ── the character's exact matte, by two clear colours, environment hidden ──
  const hidden = [];
  for (const kid of scene.children) if (kid !== root && kid.visible) { hidden.push(kid); kid.visible = false; }
  const sb = scene.background; scene.background = null;
  const ss = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true); renderer.render(scene, cam);
  const A0 = read();
  renderer.setClearColor(0xffffff, 1); renderer.clear(true, true, true); renderer.render(scene, cam);
  const B0 = read();
  const matte = new Uint8Array(n); let mattePx = 0;
  for (let p = 0; p < n; p++) {
    const d = Math.max(Math.abs(A0[p * 4] - B0[p * 4]), Math.abs(A0[p * 4 + 1] - B0[p * 4 + 1]), Math.abs(A0[p * 4 + 2] - B0[p * 4 + 2]));
    matte[p] = d < 32 ? 1 : 0; mattePx += matte[p];
  }

  // ── which of the matte's pixels are MeshPhysicalMaterial, from the SAME hidden
  //    render state so mask and value cannot disagree (`docs/LESSONS.md` §5) ──
  const physMeshes = []; const physMats = new Set(); const stdMats = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    let anyPhys = false;
    for (const m of list) { if (!m) continue;
      if (m.isMeshPhysicalMaterial) { physMats.add(m); anyPhys = true; }
      else if (m.isMeshStandardMaterial) stdMats.add(m); }
    if (anyPhys) physMeshes.push(o);
  });
  const wasVis = physMeshes.map((o) => o.visible);
  physMeshes.forEach((o) => { o.visible = false; });
  renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true); renderer.render(scene, cam);
  const A1 = read();
  renderer.setClearColor(0xffffff, 1); renderer.clear(true, true, true); renderer.render(scene, cam);
  const B1 = read();
  let physPx = 0;
  for (let p = 0; p < n; p++) {
    if (!matte[p]) continue;
    const d = Math.max(Math.abs(A1[p * 4] - B1[p * 4]), Math.abs(A1[p * 4 + 1] - B1[p * 4 + 1]), Math.abs(A1[p * 4 + 2] - B1[p * 4 + 2]));
    if (!(d < 32)) physPx++;                    // was opaque with them, is not without
  }
  physMeshes.forEach((o, i) => { o.visible = wasVis[i]; });
  renderer.shadowMap.enabled = ss; scene.background = sb;
  for (const k of hidden) k.visible = true;
  stage.render(0.0);

  const stats = (X) => {
    const L = [];
    for (let p = 0; p < n; p++) if (matte[p]) L.push((0.2126 * X[p * 4] + 0.7152 * X[p * 4 + 1] + 0.0722 * X[p * 4 + 2]) / 255);
    L.sort((x, y) => x - y);
    const pc = (f) => L[Math.min(L.length - 1, Math.floor(f * L.length))];
    let clip = 0; for (const v of L) if (v > 0.94) clip++;
    // value steps at 0.10, valuescan's own definition: distinct decile bins occupied
    const bins = new Set(); for (const v of L) bins.add(Math.floor(v * 10));
    return { p05: +pc(0.05).toFixed(4), p50: +pc(0.50).toFixed(4), p95: +pc(0.95).toFixed(4),
      range: +(pc(0.95) - pc(0.05)).toFixed(4), clipShare: +(clip / L.length).toFixed(4), steps10: bins.size };
  };
  const dstat = (A, X) => {
    let s = 0; let c = 0; let mx = 0;
    for (let p = 0; p < n; p++) if (matte[p]) {
      const d = Math.max(Math.abs(A[p * 4] - X[p * 4]), Math.abs(A[p * 4 + 1] - X[p * 4 + 1]), Math.abs(A[p * 4 + 2] - X[p * 4 + 2]));
      s += d; if (d > 1) c++; if (d > mx) mx = d;
    }
    return { dMean: +(s / mattePx).toFixed(4), dPct: +((100 * c) / mattePx).toFixed(2), dMax: mx };
  };

  const A = shot();
  const rows = [{ label: 'HEAD', ...stats(A), ...dstat(A, A) }];
  { const X = shot(); rows.push({ label: 'NULL re-render (control)', ...stats(X), ...dstat(A, X) }); }

  // ── simulate `applyRimLight(glossyMat's output)` — the one-line source change ──
  const patch = (mat, color, str) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.rimColor = { value: mat.color.clone().setHex(color) };
      shader.uniforms.rimStrength = { value: str };
      mat.userData.p1RimUniforms = shader.uniforms;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n uniform vec3 rimColor;\n uniform float rimStrength;')
        .replace('#include <dithering_fragment>',
          `#include <dithering_fragment>
           float rimDot = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
           float rim = pow(rimDot, 2.6) * rimStrength;
           gl_FragColor.rgb += rimColor * rim;`);
    };
    mat.needsUpdate = true;
  };
  const physList = [...physMats];
  for (const m of physList) patch(m, 0xbfe4ff, 0);
  { const X = shot(); rows.push({ label: 'patched, rimStrength 0 (control)', ...stats(X), ...dstat(A, X) }); }
  const handles = [];
  for (const m of physList) {
    const u = renderer.properties.get(m)?.uniforms;
    if (u && u.rimStrength) handles.push(u.rimStrength);
    else if (m.userData.p1RimUniforms?.rimStrength) handles.push(m.userData.p1RimUniforms.rimStrength);
  }
  for (const s of [strength, strength * 2]) {
    handles.forEach((u) => { u.value = s; });
    const X = shot();
    rows.push({ label: `glossyMat rim ${s}`, ...stats(X), ...dstat(A, X) });
  }
  handles.forEach((u) => { u.value = 0; });

  return { id, w, h, n, mattePx, physPx, physMats: physList.length, stdMats: stdMats.size,
    physShare: +(physPx / Math.max(1, mattePx)).toFixed(4), handles: handles.length, rows };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const out = [];
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.goto(`${BASE}/?player=${id}&enemy=donut&px=700&py=640&fogRadius=850&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await settleScreen(page, { timeout: 60000, soft: true, label: id });
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(300);
  const r = await page.evaluate(PROBE, { id, strength: STRENGTH });
  await page.close();
  if (r.error) { console.error(`${id}: ${r.error}`); continue; }
  out.push(r);
  console.error(`  ${id}: matte ${r.mattePx} px, physical ${r.physPx} px (${(100 * r.physShare).toFixed(1)}%), ${r.handles}/${r.physMats} handles`);
}
await browser.close();

console.log('\nGLOSSYMAT RIM — per-character, on the character\'s own matte at shipped gameplay framing');
console.log('reference clipShare: median 0.0249, band MAX 0.0929 · ladder rails: range >= 0.636, p05 <= 0.180\n');
console.log('char        matte px  phys%  row                            p05    p95   range  clipShare  steps  dMean  dPct%');
for (const r of out) {
  for (const x of r.rows) {
    console.log(`${(x === r.rows[0] ? r.id : '').padEnd(11)}${(x === r.rows[0] ? String(r.mattePx) : '').padStart(8)}`
      + `${(x === r.rows[0] ? (100 * r.physShare).toFixed(1) : '').padStart(7)}  ${x.label.padEnd(28)}`
      + `${x.p05.toFixed(3).padStart(7)}${x.p95.toFixed(3).padStart(7)}${x.range.toFixed(3).padStart(7)}`
      + `${x.clipShare.toFixed(4).padStart(11)}${String(x.steps10).padStart(7)}${String(x.dMean).padStart(7)}${String(x.dPct).padStart(7)}`);
  }
  console.log('');
}
await writeFile(join(OUT, 'castmat.json'), JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}/castmat.json`);
