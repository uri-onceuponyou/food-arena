#!/usr/bin/env node
/**
 * A2A_CAP — the prop-kit package's captures: the CANONICAL FRAMINGS with exact per-mesh ID
 * and normal passes (so ground / structure-top / structure-side values are measured by role,
 * not by colour key), plus per-piece close-ups at BOTH shipped pitches (58 match, 20 lobby).
 *
 * Owner: work package A2a (graphics revamp wave 3, 2026-10-15). Prefix `a2a_`.
 *
 * ── Why not `rv_capture` / `a1_cap` ─────────────────────────────────────────────
 * `rv_capture` makes the scored frames but writes no masks. `a1_cap` writes masks but at
 * stations of its own (a hub ring, the spawns). The brief asks for the ground value ON THE
 * CANONICAL FRAMES, so this tool re-aims the shipped match rig at the exact positions the
 * canonical frames' local seat stood on at the shutter — read from `rv_capture`'s own trace
 * (`trace_arena.json`, `trace_arena6.json`), never typed — and places every seat where the
 * trace says it was, so the six-seat frame carries its rings and plates where the scored one
 * does. Same virtual clock, seeded `Math.random`, rAF hold and zero shake as `a1_cap`
 * (whose PAGE_PASSES this extends with a view-space normal pass), so two trees render the
 * SAME frame except for the change: the sim never reads arena visuals.
 *
 * ── What it writes (under --out) ────────────────────────────────────────────────
 *   canonA.*, canon6.*   canvas / noshadow / id / idopaque / normal PNGs + mesh table JSON
 *   p58_<kind>.canvas.png, p20_<kind>.canvas.png   one instance per kit kind (nearest the hub)
 *   hub20.canvas.png     the pot district at the lobby pitch, ground framing
 *
 * ── Controls (rule 6 — each must come out the way it is constructed) ─────────────
 *   NULL      two consecutive frozen renders differ in 0 px
 *   RESTORE   a re-render after every pass equals the first render (0 px)
 *   POSITIVE  hiding the arena root changes > 40% of the frame
 *   STATIONS  every station is OUTSIDE every CoverBox (al_guard's third detector), and the
 *             piece list is asserted NON-EMPTY per kind before anything is shot
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/a2a_cap.mjs --url '{URL}' --out <dir> [--only canon,pieces,hub20]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArena, coverAt } from './al_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = resolve(String(arg('--out', 'shots/a2a/cap')));
const ONLY = String(arg('--only', 'canon,pieces,hub20')).split(',');
const TRACE_DIR = resolve(String(arg('--trace-dir', '/Users/uribishansky/claude-code/food-arena/shots/rv/w2/cap')));
const W = 1600, H = 900;
const L20 = 0.35; // camera.ts 'ground' framing: distance / max(0.35, sin(pitch)) — see the 20 deg shots
if (!BASE || BASE.includes(':5173')) { console.error('a2a_cap: --url of a FROZEN snapshot required (never :5173)'); process.exit(2); }

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

const A = loadArena();
const DUMP = JSON.parse(readFileSync(resolve(HERE, '../arena.gameplay.json'), 'utf8'));

// ── the canonical shutter positions, from rv_capture's own traces ────────────────────
function shutter(name) {
  const p = join(TRACE_DIR, `trace_${name}.json`);
  if (!existsSync(p)) { console.error(`a2a_cap: no ${p} — pass --trace-dir <an rv_capture output>`); process.exit(2); }
  const t = JSON.parse(readFileSync(p, 'utf8'));
  const last = t.trace[t.trace.length - 1];
  if (!last || last.t !== t.shotAt || !Array.isArray(last.pos) || !last.pos.length) {
    console.error(`a2a_cap: trace_${name}.json's last row is not the shutter (t ${last?.t} vs shotAt ${t.shotAt})`); process.exit(2);
  }
  return last.pos.map(([x, y]) => [Math.round(x), Math.round(y)]);
}
const POS_A = shutter('arena');
const POS_6 = shutter('arena6');
if (POS_A.length !== 2 || POS_6.length !== 6) { console.error(`a2a_cap: expected 2 + 6 seats, got ${POS_A.length} + ${POS_6.length}`); process.exit(2); }
// arena: donut v taco (rv/1 MATCHUP). The 3rd seat exists only because `?fighters=` refuses
// fewer than three; it stands on the far spawn, outside the frame.
const FAR = A.spawns[0];
const Q_A = `screen=match&pointerLock=0&fighters=donut@${POS_A[0]};taco@${POS_A[1]};egg@${FAR.x},${FAR.y}`;
const ROSTER6 = ['hamburger', 'taco', 'donut', 'sushi', 'egg', 'lollipop'];
const Q_6 = `screen=match&pointerLock=0&fighters=${POS_6.map((p, i) => `${ROSTER6[i]}@${p}`).join(';')}`;

// ── one instance per kit kind: the one nearest the hub (what a hub fight frame shows) ──
const KINDS_ALL = ['stove_island', 'sink_counter', 'fryer_counter', 'prep_counter', 'produce_crate_tall', 'herb_crate',
  'flour_sacks', 'supply_barrel', 'spice_cart', 'stacked_pots', 'freezer', 'boiling_pot'];
const KIND_ARG = arg('--kinds', null);
const KINDS = KIND_ARG ? KINDS_ALL.filter((k) => KIND_ARG.split(',').includes(k)) : KINDS_ALL;
const near = (list) => list.slice().sort((a, b) => Math.hypot(a.x - A.cx, a.y - A.cy) - Math.hypot(b.x - A.cx, b.y - A.cy))[0];
const PIECES = [];
for (const k of KINDS) {
  const of = A.cover.filter((c) => c.kind === k);
  if (!of.length) { console.error(`a2a_cap: the dump has NO ${k} — a filtered set must be non-empty`); process.exit(2); }
  PIECES.push({ kind: k, ...near(of) });
}
const PATCH = near(DUMP.concealment ?? []);
if (!PATCH) { console.error('a2a_cap: the dump has no concealment'); process.exit(2); }
if (!KIND_ARG || KIND_ARG.split(',').includes('conceal')) PIECES.push({ ...PATCH, kind: 'conceal' });

for (const [id, x, y] of [['canonA', ...POS_A[0]], ['canon6', ...POS_6[0]]]) {
  if (coverAt({ cover: A.cover }, x, y)) { console.error(`a2a_cap: station ${id} (${x},${y}) is INSIDE a CoverBox`); process.exit(2); }
}

async function openMatch(browser, query) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.addInitScript(() => {
    let virt = 0;
    performance.now = () => virt;
    window.__clk = { advance(ms) { virt += ms; }, get t() { return virt; } };
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rafOrig = window.requestAnimationFrame.bind(window);
    window.__rafOrig = rafOrig;
    window.__rafPause = false;
    window.__rafHeld = [];
    window.requestAnimationFrame = (cb) => rafOrig((t) => { if (window.__rafPause) window.__rafHeld.push(cb); else cb(t); });
  });
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.__gameReady === true && !!window.__stage, null, { timeout: 180000 });
  return { page, errors };
}

async function step(page, ms) {
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i++) {
      window.__clk.advance(16.667);
      await new Promise((r) => window.__rafOrig(() => r()));
    }
  }, Math.max(1, Math.round(ms / 16.667)));
}

async function pause(page) {
  await page.evaluate(async () => {
    window.__rafPause = true;
    await new Promise((r) => window.__rafOrig(() => r()));
    await new Promise((r) => window.__rafOrig(() => r()));
  });
}

/** a1_cap's PAGE_PASSES + a view-space NORMAL pass (MeshNormalMaterial, post bypassed). */
const PAGE_PASSES = async (aimAt) => {
  const stage = window.__stage;
  const renderer = stage.renderer, scene = stage.scene, rig = stage.rig, cam = rig.camera;
  rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
  if (aimAt) {
    if (!window.__a2aRig) window.__a2aRig = { frameMode: rig.frameMode, viewWidthUnits: rig.viewWidthUnits, pitchDeg: rig.pitchDeg };
    const s = window.__a2aRig;
    rig.frameMode = s.frameMode; rig.viewWidthUnits = s.viewWidthUnits; rig.pitchDeg = s.pitchDeg;
    if (aimAt.ground) { rig.frameMode = 'ground'; rig.viewWidthUnits = aimAt.viewWidth; }
    if (aimAt.pitch != null) rig.pitchDeg = aimAt.pitch;
    rig.snapTo(aimAt.x * 0.05, aimAt.y * 0.05);
    rig.apply();
    stage.lighting.focus(aimAt.x * 0.05, aimAt.y * 0.05);
  }
  const cw = stage.canvas.width, ch = stage.canvas.height;
  const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
  const ctx = c2.getContext('2d', { willReadFrequently: true });
  const snap = () => { ctx.clearRect(0, 0, cw, ch); ctx.drawImage(stage.canvas, 0, 0); return ctx.getImageData(0, 0, cw, ch); };
  const url = (img) => { ctx.putImageData(img, 0, 0); return c2.toDataURL('image/png'); };
  const diffN = (a, b, d = 6) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) { if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) >= d) n++; } return n; };
  const render = () => { renderer.shadowMap.needsUpdate = true; stage.render(0); return snap(); };
  const out = { size: [cw, ch], controls: {} };
  const A0 = render();
  const B0 = render();
  out.controls.NULL = diffN(A0, B0, 1);
  out.canvas = url(A0);
  if (aimAt && aimAt.canvasOnly) return out;
  out.tops = scene.children.map((o, i) => ({ i, name: o.name, type: o.type }));
  const casters = []; scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow) casters.push(o); });
  const savedI = casters.map((l) => l.shadow.intensity);
  casters.forEach((l) => { l.shadow.intensity = 0; });
  out.noshadow = url(render());
  casters.forEach((l, k) => { l.shadow.intensity = savedI[k]; });
  const arenaRoot = scene.children.find((o) => o.name === 'arena:kitchen');
  if (arenaRoot) { arenaRoot.visible = false; const P = render(); out.controls.POSITIVE_arenaHidden = diffN(A0, P, 6) / (cw * ch); arenaRoot.visible = true; }
  const entries = [];
  let basicProto = null, spriteProto = null;
  scene.traverse((o) => {
    if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.visible === false) return;
    if (o.isMesh && m.isMeshBasicMaterial && !basicProto) basicProto = m;
    if (o.isSprite && m.isSpriteMaterial && !spriteProto) spriteProto = m;
    let top = o; while (top.parent && top.parent !== scene) top = top.parent;
    const path = []; for (let p = o.parent; p && p !== scene; p = p.parent) if (p.name) path.push(p.name);
    entries.push({ o, m, top: scene.children.indexOf(top), path });
  });
  if (!basicProto) return { ...out, error: 'no MeshBasicMaterial prototype' };
  const meshes = []; const saved = [];
  const savedTone = renderer.toneMapping; renderer.toneMapping = 0;
  const savedBg = scene.background; scene.background = null;
  const savedFog = scene.fog; scene.fog = null;
  let id = 0;
  for (const e of entries) {
    const { o, m } = e;
    const faint = m.transparent && (m.opacity ?? 1) < 0.05;
    const kind = o.isSprite ? 'sprite' : o.isPoints ? 'points' : o.isLine ? 'line' : 'mesh';
    const rec = { name: o.name || '', kind, top: e.top, path: e.path.slice(0, 4).join('<'), matName: m.name || '', matType: m.type,
      transparent: !!m.transparent, opacity: +(m.opacity ?? 1).toFixed(3), blending: m.blending, depthWrite: m.depthWrite };
    saved.push({ o, mat: o.material, vis: o.visible, ic: o.instanceColor ?? null });
    if (faint || kind === 'points' || kind === 'line' || (kind === 'sprite' && !spriteProto) || id >= 4094) { o.visible = false; rec.id = 0; rec.skipped = faint ? 'faint' : kind; meshes.push(rec); continue; }
    id++; rec.id = id;
    const proto = kind === 'sprite' ? spriteProto : basicProto;
    const mm = proto.clone();
    mm.map = null; mm.alphaMap = null; mm.transparent = false; mm.opacity = 1; mm.vertexColors = false;
    mm.depthWrite = true; mm.depthTest = true; mm.fog = false; mm.blending = 1; mm.side = m.side ?? 0;
    mm.onBeforeCompile = () => {}; mm.customProgramCacheKey = () => 'a2aid';
    mm.color.setRGB(((id & 15) * 16 + 8) / 255, (((id >> 4) & 15) * 16 + 8) / 255, (((id >> 8) & 15) * 16 + 8) / 255, 'srgb');
    o.material = mm;
    if (o.isInstancedMesh && o.instanceColor) o.instanceColor = null;
    meshes.push(rec);
  }
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  out.id = url(snap());
  const hidT = [];
  for (let k = 0; k < saved.length; k++) {
    const s = saved[k], rec = meshes[k];
    if (rec && rec.id && (rec.transparent || rec.blending !== 1) && s.o.visible) { s.o.visible = false; hidT.push(s.o); }
  }
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  out.idopaque = url(snap());
  // NORMAL pass on the same opaque set: world-space normal packed 0..1 (y = up), so a
  // structure top (n.y ~ 1) and a side (|n.y| < 0.35) are told apart by geometry, not hue.
  const normalMat = window.__a2aNormalMat;
  if (normalMat) {
    for (let k = 0; k < saved.length; k++) { const s = saved[k], rec = meshes[k]; if (rec && rec.id && s.o.visible && s.o.isMesh) s.o.material = normalMat; }
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    out.normal = url(snap());
  }
  for (const o of hidT) o.visible = true;
  for (const s of saved) {
    if (s.o.material !== s.mat) { const mm = s.o.material; s.o.material = s.mat; if (mm && mm !== s.mat && mm !== normalMat) mm.dispose(); }
    s.o.visible = s.vis;
    if (s.ic) s.o.instanceColor = s.ic;
  }
  renderer.toneMapping = savedTone; scene.background = savedBg; scene.fog = savedFog;
  const R = render();
  out.controls.RESTORE = diffN(A0, R, 1);
  out.meshes = meshes;
  out.idCount = id;
  out.camera = { pitchDeg: rig.pitchDeg, frameMode: rig.frameMode, position: cam.position.toArray().map((v) => +v.toFixed(4)) };
  return out;
};

/** A world-normal material built from the page's own `three` (a MeshBasicMaterial whose
 * colour is replaced in the fragment by the packed world normal). */
const INSTALL_NORMAL_MAT = () => {
  const stage = window.__stage;
  let proto = null;
  stage.scene.traverse((o) => { if (!proto && o.isMesh && o.material && o.material.isMeshBasicMaterial) proto = o.material; });
  if (!proto) return false;
  const m = proto.clone();
  m.map = null; m.alphaMap = null; m.transparent = false; m.opacity = 1; m.vertexColors = false;
  m.depthWrite = true; m.depthTest = true; m.fog = false; m.blending = 1; m.side = 2;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 a2aN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\na2aN = normalize( mat3( modelMatrix ) * normal );');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 a2aN;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor = vec4( normalize( a2aN ) * 0.5 + 0.5, 1.0 );');
  };
  m.customProgramCacheKey = () => 'a2anormal';
  window.__a2aNormalMat = m;
  return true;
};

function writeShot(tag, res, meta) {
  for (const k of ['canvas', 'noshadow', 'id', 'idopaque', 'normal']) {
    if (res[k]) { writeFileSync(join(OUT, `${tag}.${k}.png`), Buffer.from(res[k].split(',')[1], 'base64')); delete res[k]; }
  }
  if (!meta.canvasOnly) writeFileSync(join(OUT, `${tag}.json`), JSON.stringify({ ...meta, ...res }, null, 1));
  const c = res.controls ?? {};
  const bad = (c.NULL ?? 0) !== 0 || (!meta.canvasOnly && ((c.RESTORE ?? 1) !== 0 || !((c.POSITIVE_arenaHidden ?? 0) > 0.4)));
  console.log(`  ${tag.padEnd(24)} NULL ${c.NULL} RESTORE ${c.RESTORE ?? '-'} POS ${(c.POSITIVE_arenaHidden ?? 0).toFixed(3)} ids ${res.idCount ?? '-'} ${res.error ?? ''}${bad ? '  << CONTROL FAILED' : ''}`);
  return !bad;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH });
let fails = 0;
try {
  const warm = await browser.newPage(); await warm.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle' }).catch(() => {}); await warm.waitForTimeout(2500); await warm.close();
  if (ONLY.includes('canon')) {
    for (const [tag, q, at] of [['canonA', Q_A, POS_A[0]], ['canon6', Q_6, POS_6[0]]]) {
      console.log(`[${tag}] ${q}`);
      const { page, errors } = await openMatch(browser, q);
      await step(page, 400);
      await pause(page);
      const okN = await page.evaluate(INSTALL_NORMAL_MAT);
      if (!okN) { console.log('  no normal material prototype'); fails++; }
      const res = await page.evaluate(PAGE_PASSES, { x: at[0], y: at[1], pitch: 58 });
      if (!writeShot(tag, res, { tag, query: q, station: at })) fails++;
      // the lobby pitch at the same spot, ground framing — DIAGNOSTIC, canvas only
      // 'ground' framing divides by max(0.35, sin(pitch)) (camera.ts computeDistance), so at 20
      // the framed span is viewWidth / 0.35 — 0.35 x the span wanted, not the span itself.
      const r20 = await page.evaluate(PAGE_PASSES, { x: at[0], y: at[1] - 60, pitch: 20, ground: true, viewWidth: 760 * L20, canvasOnly: true });
      if (!writeShot(`${tag}_l20`, r20, { tag: `${tag}_l20`, canvasOnly: true })) fails++;
      if (errors.length) { fails++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
      await page.close();
    }
  }
  if (ONLY.includes('tris')) {
    // PER-PIECE TRIANGLES on the UNBATCHED graph: `preview.html` keeps every `cover:<kind>`
    // group (kitchen.ts skips the static merge there). Outline hulls excluded — they are a
    // tier-dependent copy of the same geometry, priced separately by perf.mjs.
    // `?merge=0` is kitchen.ts's own escape hatch: the static batch is skipped, the groups stay
    const { page } = await openMatch(browser, `${Q_6}&merge=0`);
    const rows = await page.evaluate(() => {
      let root = null;
      const find = (o) => { if (o.name === 'arena_props') root = o; for (const c of o.children) if (!root) find(c); };
      find(window.__stage.scene);
      if (!root) return { error: 'no arena_props group found' };
      const out = {};
      const mats = new Set();
      for (const grp of root.children) {
        const kind = grp.name;
        let tris = 0, kit = 0, meshes = 0;
        grp.traverse((o) => {
          if (!o.isMesh || /__outline$/.test(o.name)) return;
          const g = o.geometry; const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
          tris += n; meshes++;
          if (/^kit_/.test(o.name)) kit += n;
          mats.add(o.material.uuid);
        });
        const r = out[kind] ?? (out[kind] = { n: 0, trisMax: 0, kitMax: 0, meshesMax: 0 });
        r.n++; r.trisMax = Math.max(r.trisMax, tris); r.kitMax = Math.max(r.kitMax, kit); r.meshesMax = Math.max(r.meshesMax, meshes);
      }
      return { kinds: out, materials: mats.size };
    });
    console.log('[tris]', JSON.stringify(rows, null, 1));
    writeFileSync(join(OUT, 'tris.json'), JSON.stringify(rows, null, 1));
    await page.close();
  }
  if (ONLY.includes('pieces') || ONLY.includes('hub20')) {
    const { page, errors } = await openMatch(browser, Q_6);
    await step(page, 400);
    await pause(page);
    if (ONLY.includes('pieces')) {
      console.log('[pieces — one instance per kind, nearest the hub]');
      for (const p of PIECES) {
        const span = Math.max(p.w, p.h);
        // 58: the match pitch, framed close (diagnose up close, LESSONS §6)
        const r58 = await page.evaluate(PAGE_PASSES, { x: p.x, y: p.y, pitch: 58, ground: true, viewWidth: span + 150, canvasOnly: true });
        if (!writeShot(`p58_${p.kind}`, r58, { tag: `p58_${p.kind}`, canvasOnly: true })) fails++;
        // 20: the lobby pitch — the better detector for construction defects (CLAUDE.md 3)
        const r20 = await page.evaluate(PAGE_PASSES, { x: p.x, y: p.y - 10, pitch: 20, ground: true, viewWidth: (span + 220) * L20, canvasOnly: true });
        if (!writeShot(`p20_${p.kind}`, r20, { tag: `p20_${p.kind}`, canvasOnly: true })) fails++;
      }
      writeFileSync(join(OUT, 'pieces.json'), JSON.stringify(PIECES, null, 1));
    }
    if (ONLY.includes('hub20')) {
      const r = await page.evaluate(PAGE_PASSES, { x: A.cx, y: A.cy + 120, pitch: 20, ground: true, viewWidth: 1150 * L20, canvasOnly: true });
      if (!writeShot('hub20', r, { tag: 'hub20', canvasOnly: true })) fails++;
      const r2 = await page.evaluate(PAGE_PASSES, { x: A.cx, y: A.cy, pitch: 58, ground: true, viewWidth: 1100, canvasOnly: true });
      if (!writeShot('hub58', r2, { tag: 'hub58', canvasOnly: true })) fails++;
    }
    if (errors.length) { fails++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(fails ? `${fails} control/JS failure(s) — do not trust this capture` : 'all controls held — NOW READ THE PNGs');
process.exitCode = fails ? 1 : 0;
