#!/usr/bin/env node
// capture-audit: css-immune — gl.readPixels only, no DOM screenshot, no element rect.
/**
 * P1_RIMREACH — how much of the SHIPPED frame does the Fresnel rim actually reach?
 *
 * `render/toon.ts` records the rim as "the single largest material lever in the frame"
 * and names two gaps: `rimStrength` is 0.28 on "all 33 materials that carry it", and
 * `glossyMat`'s 18 MeshPhysicalMaterials carry none. Both are AUTHORING facts read off
 * the source. `docs/LESSONS.md` §1 says what to do with an authoring fact: assume it is
 * rendering and invisible, and measure DELIVERED PIXELS.
 *
 * This does not ask which materials were authored with a rim. It drives the rim's own
 * uniform on ONE FROZEN FRAME and asks which pixels move.
 *
 *   A          the shipped frame
 *   NULL       the same uniform written back at its own value, re-rendered — the DRIFT
 *              CONTROL. Any material that "responds" to this is the instrument, not the
 *              rim (`CLAUDE.md` non-negotiable #4: is it the SAME?).
 *   OFF        every reachable rimStrength -> 0
 *   HOT        every reachable rimStrength -> 3.0 (unmissable, LESSONS §1's technique)
 *
 * ⚠️ AND IT REPAIRS ITS OWN BLIND SPOT FIRST. `applyRimLight` publishes its uniforms in
 * `userData.rimUniforms` from inside `onBeforeCompile`, which three calls once per
 * (material, programCacheKey). A material that has never been compiled has an
 * `onBeforeCompile` and NO `userData.rimUniforms`, so a probe reading userData alone
 * under-counts. Every Standard/Physical material is therefore forced to recompile
 * (`needsUpdate = true`) and rendered once BEFORE the census, and the count of materials
 * that GAINED the uniform in that step is printed — if it is not zero, any earlier
 * userData-based count was wrong.
 *
 * KNOWN-BAD CONTROL, built in: `glossyMat` returns a MeshPhysicalMaterial and never
 * calls `applyRimLight`. Those materials MUST show zero response to OFF and to HOT. If
 * they move, this probe is measuring something global and its headline is void.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/p1_rimreach.mjs --out shots/p1
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { settleScreen } from './settle.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/p1');
const ID = get('--id', 'hamburger');
const ENEMY = get('--enemy', 'donut');
const W = Number(get('--w', 1600));
const H = Number(get('--h', 900));
const HOT = Number(get('--hot', 3.0));

const STATIONS = [
  { name: 'pot_south', x: 700, y: 640 },
  { name: 'spawn_west', x: 160, y: 500 },
];

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const PROBE = ({ hot, playerId, noBloom }) => {
  const stage = window.__stage;
  if (!stage) return { error: 'no Stage' };
  if (stage.disposed) return { error: 'DISPOSED Stage' };
  const { scene, renderer } = stage;
  const cam = stage.rig.camera;
  const gl = renderer.getContext();
  const w = renderer.domElement.width; const h = renderer.domElement.height;
  const n = w * h;

  const read = () => { const b = new Uint8Array(n * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const shot = () => { stage.render(0.0); return read(); };

  // ── catalogue ──────────────────────────────────────────────────────────────
  const mats = []; const idx = new Map(); const meshes = [];
  let basicProto = null;
  const topOf = (o) => { let p = o; while (p.parent && p.parent !== scene) p = p.parent; return p; };
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    if (m.isMeshBasicMaterial && !basicProto) basicProto = m;
    if (!idx.has(m.uuid)) {
      idx.set(m.uuid, mats.length);
      mats.push({ i: mats.length, ref: m, name: m.name || '(unnamed)', type: m.type,
        roughness: typeof m.roughness === 'number' ? +m.roughness.toFixed(3) : null,
        metalness: typeof m.metalness === 'number' ? +m.metalness.toFixed(3) : null,
        transparent: !!m.transparent, ownRoots: new Set() });
    }
    const e = mats[idx.get(m.uuid)];
    e.ownRoots.add(topOf(o).name || '(root)');
    meshes.push({ o, i: idx.get(m.uuid) });
  });
  if (!basicProto) return { error: 'no MeshBasicMaterial to clone' };

  const isLit = (m) => m.isMeshStandardMaterial || m.isMeshPhysicalMaterial;
  const defaultOBC = (() => { let p = Object.getPrototypeOf(mats[0].ref);
    while (p && !Object.prototype.hasOwnProperty.call(p, 'onBeforeCompile')) p = Object.getPrototypeOf(p);
    return p ? p.onBeforeCompile : undefined; })();

  // ── the CORRECT handle on the rim, and why userData is not it ──────────────
  //
  // `applyRimLight` publishes `userData.rimUniforms` from inside `onBeforeCompile`, and
  // three calls that exactly once per (material, programCacheKey) — `programs` is a
  // PER-MATERIAL Map (`three.module.js:16907`), so `needsUpdate = true` does NOT re-run
  // it: the map still holds an entry for that key and the branch early-outs. So a
  // userData census is a census of "materials three happened to compile a NEW program
  // for", not of "materials that carry a rim".
  //
  // `renderer.properties.get(material).uniforms` IS the per-material uniform container
  // three built at that same moment (`materialProperties.uniforms = parameters.uniforms`)
  // and is what `WebGLUniforms.upload` reads every draw. A `rimStrength` key in there is
  // proof the program was patched for THIS material, and writing it is the same write
  // the rim itself does.
  const props = renderer.properties;
  const before = mats.filter((e) => isLit(e.ref) && e.ref.userData && e.ref.userData.rimUniforms).length;
  for (const e of mats) if (isLit(e.ref)) e.ref.needsUpdate = true;
  stage.render(0.0);
  const after = mats.filter((e) => isLit(e.ref) && e.ref.userData && e.ref.userData.rimUniforms).length;

  for (const e of mats) {
    e.lit = isLit(e.ref);
    e.ownOBC = typeof e.ref.onBeforeCompile === 'function' && e.ref.onBeforeCompile !== defaultOBC;
    const pu = props.get(e.ref)?.uniforms;
    const u = (pu && pu.rimStrength) ? pu : ((e.ref.userData && e.ref.userData.rimUniforms) || null);
    e.handle = (u && u.rimStrength && typeof u.rimStrength.value === 'number') ? u.rimStrength : null;
    e.hasUniform = !!e.handle;
    e.viaProps = !!(pu && pu.rimStrength);
    e.rimStrength = e.hasUniform ? e.handle.value : null;
  }

  // ── ID mask, matcover's proven sRGB 16-level encoding ───────────────────────
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
  const owner = new Int32Array(n);
  for (let p = 0; p < n; p++) {
    const id = q(ids[p * 4]) | (q(ids[p * 4 + 1]) << 4) | (q(ids[p * 4 + 2]) << 8);
    owner[p] = id > 0 && id <= mats.length ? id - 1 : -1;
  }

  // ── the player's exact matte, by two-clear-colour, environment hidden ───────
  const casts = scene.children.filter((k) => (k.name || '').startsWith('character:'));
  const wanted = casts.find((k) => k.name === `character:${playerId}`) ?? casts[0];
  let heroMask = null; let heroPx = 0;
  if (wanted) {
    const hidden = [];
    for (const kid of scene.children) if (kid !== wanted && kid.visible) { hidden.push(kid); kid.visible = false; }
    const sb = scene.background; scene.background = null;
    const ss = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true); renderer.render(scene, cam);
    const A0 = read();
    renderer.setClearColor(0xffffff, 1); renderer.clear(true, true, true); renderer.render(scene, cam);
    const B0 = read();
    heroMask = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      const d = Math.max(Math.abs(A0[p * 4] - B0[p * 4]), Math.abs(A0[p * 4 + 1] - B0[p * 4 + 1]), Math.abs(A0[p * 4 + 2] - B0[p * 4 + 2]));
      heroMask[p] = d < 32 ? 1 : 0; heroPx += heroMask[p];
    }
    renderer.shadowMap.enabled = ss; scene.background = sb;
    for (const k of hidden) k.visible = true;
  }

  // ── BLOOM MUST BE ABLATED IN BOTH LEGS, and this is not a nicety ───────────
  // The rim is the brightest thing on a silhouette edge and bloom is fed by exactly
  // those pixels, so turning the rim up SPREADS light onto neighbouring materials that
  // have no rim at all. The first run of this probe reported `glossyMat` — which
  // provably has no rim — "responding" at 1.52/255, and that number is bloom. Holding
  // bloom at zero in A and in every mutation removes the only long-range coupling; SMAA
  // still blends across one pixel of silhouette and that residue is what the KNOWN-BAD
  // control below is measuring.
  const passes = stage.composer ? stage.composer.passes : [];
  const fx = passes.flatMap((p) => p.effects ?? []);
  const bloom = fx.find((e) => e.name === 'BloomEffect') ?? null;
  const bloomWas = bloom ? bloom.intensity : null;
  if (bloom && noBloom) bloom.intensity = 0;

  // ── A / NULL / OFF / HOT on one frozen frame ───────────────────────────────
  const A = shot();
  const live = mats.filter((e) => e.hasUniform);
  const orig = live.map((e) => e.handle.value);
  const drive = (fn) => { live.forEach((e, k) => { e.handle.value = fn(orig[k], k); }); return shot(); };
  const NUL = drive((v) => v);
  const OFF = drive(() => 0);
  const HOTF = drive(() => hot);
  live.forEach((e, k) => { e.handle.value = orig[k]; });
  if (bloom && bloomWas !== null) bloom.intensity = bloomWas;
  stage.render(0.0);

  const stat = (X) => {
    const sum = new Float64Array(mats.length); const moved = new Float64Array(mats.length);
    const cnt = new Float64Array(mats.length);
    let heroSum = 0; let heroMoved = 0;
    for (let p = 0; p < n; p++) {
      const d = Math.max(Math.abs(A[p * 4] - X[p * 4]), Math.abs(A[p * 4 + 1] - X[p * 4 + 1]), Math.abs(A[p * 4 + 2] - X[p * 4 + 2]));
      const o = owner[p];
      if (o >= 0) { sum[o] += d; cnt[o]++; if (d > 1) moved[o]++; }
      if (heroMask && heroMask[p]) { heroSum += d; if (d > 1) heroMoved++; }
    }
    return { sum, moved, cnt, heroSum, heroMoved };
  };
  const sNul = stat(NUL); const sOff = stat(OFF); const sHot = stat(HOTF);

  return {
    w, h, total: n, heroPx,
    rimUniformsBefore: before, rimUniformsAfter: after, materials: mats.length,
    bloomAblated: !!(bloom && noBloom), bloomWas,
    handlesViaProps: mats.filter((e) => e.viaProps).length,
    handlesTotal: live.length,
    ownOBCcount: mats.filter((e) => e.ownOBC).length,
    rows: mats.map((e, i) => ({
      name: e.name, type: e.type, roughness: e.roughness, metalness: e.metalness,
      transparent: e.transparent, lit: e.lit, ownOBC: e.ownOBC, hasUniform: e.hasUniform, viaProps: e.viaProps,
      rimStrength: e.rimStrength, roots: [...e.ownRoots].slice(0, 3),
      px: sOff.cnt[i],
      nulMean: sNul.cnt[i] ? +(sNul.sum[i] / sNul.cnt[i]).toFixed(4) : 0,
      offMean: sOff.cnt[i] ? +(sOff.sum[i] / sOff.cnt[i]).toFixed(4) : 0,
      offMovedPct: sOff.cnt[i] ? +((100 * sOff.moved[i]) / sOff.cnt[i]).toFixed(2) : 0,
      hotMean: sHot.cnt[i] ? +(sHot.sum[i] / sHot.cnt[i]).toFixed(4) : 0,
      hotMovedPct: sHot.cnt[i] ? +((100 * sHot.moved[i]) / sHot.cnt[i]).toFixed(2) : 0,
    })).filter((r) => r.px > 0),
    hero: heroPx ? {
      nulMean: +(sNul.heroSum / heroPx).toFixed(4), nulMovedPct: +((100 * sNul.heroMoved) / heroPx).toFixed(2),
      offMean: +(sOff.heroSum / heroPx).toFixed(4), offMovedPct: +((100 * sOff.heroMoved) / heroPx).toFixed(2),
      hotMean: +(sHot.heroSum / heroPx).toFixed(4), hotMovedPct: +((100 * sHot.heroMoved) / heroPx).toFixed(2),
    } : null,
  };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const all = [];
for (const st of STATIONS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.goto(`${BASE}/?player=${ID}&enemy=${ENEMY}&px=${st.x}&py=${st.y}&fogRadius=850&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await settleScreen(page, { timeout: 60000, soft: true, label: st.name });
  await page.evaluate(() => { window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(300);
  const res = await page.evaluate(PROBE, { hot: HOT, playerId: ID, noBloom: !a.includes('--keep-bloom') });
  await page.close();
  if (res.error) { console.error(`${st.name}: ${res.error}`); continue; }
  all.push({ station: st.name, ...res });
  console.error(`  ${st.name}: ${res.rows.length} materials, hero ${res.heroPx} px`);
}
await browser.close();
if (!all.length) { console.error('nothing measured'); process.exit(1); }

for (const r of all) {
  console.log(`\n══ ${r.station} ══  ${r.materials} materials, ${r.rows.length} on screen, hero ${r.heroPx} px`);
  console.log(`bloom ablated in every leg: ${r.bloomAblated ? 'YES (was ' + r.bloomWas + ')' : 'no'}`);
  console.log(`materials with own onBeforeCompile (authored a rim): ${r.ownOBCcount}`);
  console.log(`materials carrying userData.rimUniforms: ${r.rimUniformsBefore} BEFORE a forced recompile, ${r.rimUniformsAfter} AFTER`);
  console.log(`drivable rim handles found: ${r.handlesTotal} (${r.handlesViaProps} via renderer.properties, i.e. INVISIBLE to a userData census)`);
  if (r.rimUniformsAfter !== r.rimUniformsBefore) {
    console.log('  ⚠️ a userData-only census under-counts the rim by '
      + `${r.rimUniformsAfter - r.rimUniformsBefore} materials — three calls onBeforeCompile lazily`);
  }
  const tot = r.total;
  const responds = r.rows.filter((x) => x.hotMean > 1.0);
  const dead = r.rows.filter((x) => x.hotMean <= 1.0);
  const px = (rows) => rows.reduce((s, x) => s + x.px, 0);
  console.log(`\nRIM REACH, driven to ${HOT} on one frozen frame:`);
  console.log(`  responds  (mean |dRGB| > 1/255): ${responds.length} materials, ${((100 * px(responds)) / tot).toFixed(2)}% of frame`);
  console.log(`  DEAD to the rim               : ${dead.length} materials, ${((100 * px(dead)) / tot).toFixed(2)}% of frame`);
  const phys = r.rows.filter((x) => x.type === 'MeshPhysicalMaterial');
  const physHot = phys.length ? phys.reduce((s, x) => s + x.hotMean * x.px, 0) / Math.max(1, px(phys)) : 0;
  console.log(`\nKNOWN-BAD CONTROL — glossyMat (MeshPhysicalMaterial), authored with NO rim:`);
  console.log(`  ${phys.length} materials, ${((100 * px(phys)) / tot).toFixed(3)}% of frame, mean response to HOT ${physHot.toFixed(4)}/255`
    + `  ${physHot < 0.5 ? '(control holds — they are genuinely rimless)' : '(CONTROL FAILED — this probe is measuring something global)'}`);
  const nulMax = Math.max(...r.rows.map((x) => x.nulMean));
  console.log(`DRIFT CONTROL — the same uniform rewritten at its own value: max per-material mean ${nulMax.toFixed(4)}/255`
    + `  ${nulMax < 0.5 ? '(frame is deterministic)' : '(FRAME DRIFTS — every number below is suspect)'}`);
  if (r.hero) {
    console.log(`\nHERO MATTE (${r.heroPx} px): null ${r.hero.nulMean}  |  rim OFF ${r.hero.offMean}/255 over ${r.hero.offMovedPct}% of the matte`
      + `  |  rim ${HOT} ${r.hero.hotMean}/255 over ${r.hero.hotMovedPct}%`);
  }
  console.log('\nTOP 22 BY SHARE OF FRAME — does the rim reach it?');
  console.log('  share%  type                  rough  ownOBC  uniform  strength   offMean  off%   hotMean  hot%   name');
  for (const x of [...r.rows].sort((p, o) => o.px - p.px).slice(0, 22)) {
    console.log(`${((100 * x.px) / tot).toFixed(3).padStart(8)}  ${x.type.padEnd(21)}${String(x.roughness ?? '—').padStart(6)}`
      + `${(x.ownOBC ? 'yes' : 'NO').padStart(8)}${(x.hasUniform ? 'yes' : 'NO').padStart(9)}${String(x.rimStrength ?? '—').padStart(10)}`
      + `${x.offMean.toFixed(3).padStart(10)}${x.offMovedPct.toFixed(1).padStart(6)}`
      + `${x.hotMean.toFixed(3).padStart(10)}${x.hotMovedPct.toFixed(1).padStart(6)}   ${x.name}`);
  }
}
await writeFile(join(OUT, 'rimreach.json'), JSON.stringify(all, null, 2));
console.log(`\nwrote ${OUT}/rimreach.json`);
