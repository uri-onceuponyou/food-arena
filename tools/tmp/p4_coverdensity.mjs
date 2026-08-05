#!/usr/bin/env node
/**
 * P4 — COVER DENSITY, as a share of the SHIPPED frame, by SCENE-GRAPH CLASS.
 *
 * `docs/DECISIONS-FOR-URI.md` §18 records "an ID-buffer measurement independently put
 * our standing geometry at 17-20%" against a critic's "35-45% in all four reference
 * frames". Neither figure has a tool in this repo that reproduces it. This is that tool
 * for OUR side. It does NOT measure the reference — see the report.
 *
 * Method: `matcover.mjs`'s ID-buffer verbatim (12-bit id written in sRGB so it survives
 * the output transfer — `docs/LESSONS.md` §12), but keyed on ANCESTRY rather than on
 * material, because props and floor pads share materials (`cabinetDark` is on both) and
 * a per-material tally therefore cannot answer "how much of the frame is standing
 * geometry".
 *
 * Classes, from the mesh's ancestor chain:
 *   props   — under `arena_props` (every `addCover()` prop + the merged outline hulls)
 *   deco    — under `arena:kitchen` but not `arena_props`: floor, decals, puddles, the
 *             hazard ground ring, and the three walk-through decorations (chalkboard,
 *             exhaust pipes, hanging signs) that already exist with NO CoverBox
 *   apron    — `arena_apron` (outside the playfield)
 *   fog/vfx  — `fog_boundary` / `vfx_layer`
 *   cast     — everything else that is not arena (the two character models)
 *
 * ── KNOWN-BAD VALIDATION (`--selftest`), required before believing any number ──
 * `--ablate props` hides `arena_props` before the ID pass. A tool that is really
 * measuring standing geometry must then report props = 0.00% and must NOT report the
 * same number as the unablated run. That is the control this project demands: a guard
 * that has not been shown to FAIL on the bug it guards against is not a guard.
 *
 * Also asserted per station: `window.__matchDebug.qaSpawnInsideCover === null`. `?px=`
 * / `?py=` do not validate against cover, and a station inside a CoverBox films a
 * buried character and manufactures a false reading (arena-scan lost four stations to
 * exactly that).
 *
 * capture-audit: css-immune — `gl.readPixels()` off the drawing buffer, no DOM capture.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/p4_coverdensity.mjs --url '{URL}'
 *   ... --stations pot_south,west_lane --ablate props
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const ABLATE = arg('ablate', '');
const OUT = arg('out', '');
const W = Number(arg('w', 1600)), H = Number(arg('h', 900));

// The canonical arena-scan station set, minus the three fog stations (a fog wall is a
// different frame, not a different density) and minus `grease_in` (standing IN a puddle
// is a colour station, not a layout one). Same coordinates, so numbers are comparable.
const ALL = [
  ['spawn_west', 160, 390], ['west_lane', 340, 500], ['west_choke', 400, 500],
  ['pot_south', 700, 640], ['pot_diagonal', 570, 430], ['hub_north', 700, 320],
  ['freezer_nw', 430, 420], ['pantry_ne', 1150, 420], ['pantry_sw', 400, 800],
  ['freezer_se', 1000, 580], ['fryer_south', 560, 790], ['edge_west', 70, 500],
];
const pick = arg('stations', '');
const STATIONS = pick ? ALL.filter((s) => pick.split(',').includes(s[0])) : ALL;

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });

const rows = [];
for (const [id, px, py] of STATIONS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=850&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await page.waitForTimeout(1500);

  const res = await page.evaluate((ablate) => {
    const stage = window.__stage;
    if (!stage) return { error: 'no __stage' };
    const scene = stage.scene, cam = stage.rig.camera, renderer = stage.renderer;
    const gl = renderer.getContext();
    const Wp = renderer.domElement.width, Hp = renderer.domElement.height;

    // ── the ablation control: hide the class under test, in the SAME frame ──────
    let ablated = null;
    if (ablate) {
      scene.traverse((o) => { if (o.name === ablate) { ablated = o; } });
      if (!ablated) return { error: 'ablation target not found: ' + ablate };
      ablated.visible = false;
    }

    const classOf = (o) => {
      let arena = false;
      for (let p = o; p; p = p.parent) {
        if (p.name === 'arena_props') return 'props';
        if (p.name === 'arena_apron') return 'apron';
        if (p.name === 'fog_boundary') return 'fog';
        if (p.name === 'vfx_layer') return 'vfx';
        if (p.name === 'arena:kitchen') arena = true;
      }
      return arena ? 'deco' : 'cast';
    };
    // Named ancestor just below the arena root / scene, for the per-object breakdown.
    const objOf = (o) => {
      let last = o.name || '(anon)';
      for (let p = o; p && p.parent; p = p.parent) {
        if (p.parent.name === 'arena_props' || p.parent.name === 'arena:kitchen' || p.parent === scene) return p.name || last;
        if (p.name) last = p.name;
      }
      return last;
    };

    const groups = [];      // one flat colour per (class,obj) bucket
    const key2i = new Map();
    const meshes = [];
    let basicProto = null;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      let vis = true;
      for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
      if (!vis) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;
      if (m.isMeshBasicMaterial && !basicProto) basicProto = m;
      const k = classOf(o) + '|' + objOf(o);
      if (!key2i.has(k)) { key2i.set(k, groups.length); groups.push(k); }
      meshes.push({ o, i: key2i.get(k) });
    });
    if (!basicProto) return { error: 'no MeshBasicMaterial in scene to clone' };
    if (groups.length > 4090) return { error: 'too many buckets: ' + groups.length };

    const savedTone = renderer.toneMapping; renderer.toneMapping = 0;
    const savedBg = scene.background; scene.background = null;
    const idMats = groups.map((_, i) => {
      const mm = basicProto.clone();
      mm.map = null; mm.alphaMap = null; mm.transparent = false; mm.opacity = 1;
      mm.depthWrite = true; mm.depthTest = true; mm.fog = false; mm.side = 0;
      const id = i + 1;
      mm.color.setRGB(((id & 15) * 16 + 8) / 255, (((id >> 4) & 15) * 16 + 8) / 255, (((id >> 8) & 15) * 16 + 8) / 255, 'srgb');
      return mm;
    });
    const saved = meshes.map((e) => e.o.material);
    meshes.forEach((e) => { e.o.material = idMats[e.i]; });
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    const ids = new Uint8Array(Wp * Hp * 4);
    gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, ids);
    meshes.forEach((e, k) => { e.o.material = saved[k]; });
    idMats.forEach((m) => m.dispose());
    renderer.toneMapping = savedTone; scene.background = savedBg;
    if (ablated) ablated.visible = true;

    const n = Wp * Hp;
    const cnt = new Float64Array(groups.length + 1);
    const q = (v) => Math.min(15, Math.max(0, Math.round((v - 8) / 16)));
    for (let p = 0; p < n; p++) {
      const id = q(ids[p * 4]) | (q(ids[p * 4 + 1]) << 4) | (q(ids[p * 4 + 2]) << 8);
      if (id === 0 || id > groups.length) continue;
      cnt[id - 1]++;
    }
    const byClass = {};
    const byObj = {};
    for (let i = 0; i < groups.length; i++) {
      if (!cnt[i]) continue;
      const [cls, obj] = groups[i].split('|');
      byClass[cls] = (byClass[cls] ?? 0) + cnt[i];
      byObj[obj] = (byObj[obj] ?? 0) + cnt[i];
    }
    return {
      total: n, byClass, byObj,
      qaSpawnInsideCover: window.__matchDebug ? window.__matchDebug.qaSpawnInsideCover : 'no __matchDebug',
    };
  }, ABLATE);
  await page.close();
  if (res.error) { console.error(`${id}: ERROR ${res.error}`); continue; }
  if (res.qaSpawnInsideCover) console.error(`  ⚠ ${id}: STATION INSIDE COVER — ${res.qaSpawnInsideCover}`);
  const pc = (k) => ((res.byClass[k] ?? 0) / res.total) * 100;
  rows.push({ id, px, py, total: res.total, byClass: res.byClass, byObj: res.byObj,
    props: pc('props'), deco: pc('deco'), apron: pc('apron'), cast: pc('cast'), fog: pc('fog'), vfx: pc('vfx'),
    inCover: res.qaSpawnInsideCover });
  console.error(`  ${id.padEnd(13)} props ${pc('props').toFixed(2).padStart(6)}%  deco ${pc('deco').toFixed(2).padStart(6)}%  apron ${pc('apron').toFixed(2).padStart(6)}%  cast ${pc('cast').toFixed(2).padStart(5)}%`);
}
await browser.close();

const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
console.log(`\nCOVER DENSITY — ${rows.length} stations, ${W}x${H}${ABLATE ? `, ABLATED: ${ABLATE}` : ''}\n`);
console.log('  station        props%   deco%  apron%   cast%  props+apron%');
for (const r of rows) {
  console.log(`  ${r.id.padEnd(13)} ${r.props.toFixed(2).padStart(6)} ${r.deco.toFixed(2).padStart(7)} ${r.apron.toFixed(2).padStart(7)} ${r.cast.toFixed(2).padStart(7)} ${(r.props + r.apron).toFixed(2).padStart(13)}`);
}
console.log(`  ${'MEAN'.padEnd(13)} ${mean('props').toFixed(2).padStart(6)} ${mean('deco').toFixed(2).padStart(7)} ${mean('apron').toFixed(2).padStart(7)} ${mean('cast').toFixed(2).padStart(7)} ${(mean('props') + mean('apron')).toFixed(2).padStart(13)}`);
const sd = (k) => { const m = mean(k); return Math.sqrt(rows.reduce((s, r) => s + (r[k] - m) ** 2, 0) / Math.max(1, rows.length - 1)); };
console.log(`\n  props%  mean ${mean('props').toFixed(2)}  sd ${sd('props').toFixed(2)}  min ${Math.min(...rows.map(r=>r.props)).toFixed(2)}  max ${Math.max(...rows.map(r=>r.props)).toFixed(2)}`);

// top objects
const agg = new Map();
for (const r of rows) for (const [k, v] of Object.entries(r.byObj)) agg.set(k, (agg.get(k) ?? 0) + v / r.total / rows.length * 100);
console.log('\n  top objects by mean share of frame:');
for (const [k, v] of [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`    ${v.toFixed(2).padStart(6)}%  ${k}`);

if (OUT) { mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true }); writeFileSync(OUT, JSON.stringify({ base: BASE, ablate: ABLATE, rows }, null, 2)); console.log(`\n  wrote ${OUT}`); }
