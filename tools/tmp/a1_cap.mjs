#!/usr/bin/env node
/**
 * A1_CAP — the "calm stage" package's own captures: DETERMINISTIC match frames with exact
 * per-mesh ID passes, so a ground/litter A/B between two trees is PAIRED (same sim state,
 * same camera, same pixels except the change).
 *
 * Owner: work package A1 (graphics revamp, 2026-10-15). Prefix `a1_`.
 *
 * ── Why not `gx_gap_cap.mjs` ────────────────────────────────────────────────────
 * gx_gap_cap waits for an "eligible" moment on a REAL clock (VFX activity + polling), so two
 * runs land on different ticks and the ground windows sit in different places. A ground
 * A/B needs the same frame on both trees. This tool runs the page on a VIRTUAL clock with a
 * seeded `Math.random` (gx_arena_shots' openMatch), steps to fixed virtual times, holds
 * rAF, zeroes the camera shake, and only then renders. The sim never reads arena VISUALS,
 * so a visual-only change cannot move a fighter.
 *
 * ── What it writes, per shot (under --out) ──────────────────────────────────────
 *   <id>.canvas.png    canvas readback, post chain ON — the delivered pixels, no DOM HUD
 *   <id>.noshadow.png  every caster light's shadow.intensity = 0 (a uniform, no recompile)
 *   <id>.id.png        per-MESH id pass, translucent meshes INCLUDED (top-most surface)
 *   <id>.idopaque.png  the same with translucent / non-normal-blend meshes hidden
 *   <id>.json          mesh table (id -> name, top-level root, material), camera, controls
 *   l20_<id>.canvas.png  the lobby pitch (20 deg, 'ground' framing) — DIAGNOSTIC ONLY
 * The ID encoding is gx_gap_cap's (12-bit, 16 levels per channel), so gx_gap_roles'
 * decoder reads it unchanged.
 *
 * ── Controls (rule 6 — each must come out the way it is constructed) ─────────────
 *   NULL      two consecutive frozen renders differ in 0 px, or nothing here is frozen
 *   RESTORE   a re-render after every pass equals the first render (0 px)
 *   POSITIVE  hiding the arena root changes > 40% of the frame
 *   IDCOVER   decoded ids cover > 85% of the frame (checked in a1_ground.py)
 *
 * ── Stations are DERIVED from the arena dump, never typed (CLAUDE.md: map literals) ──
 *   hub6_t*   six seats on a 185 wu ring around the dump's `center` (gx_gap_cap S1's ring),
 *             the shipped camera on the local seat — the hub fight frames
 *   hubE/hubW 160 wu either side of the centre (gx_gap_cap D1's anchor), re-aimed rig
 *   sp0..sp5  the six spawns from the dump — open floor by construction (spawn_runway)
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/a1_cap.mjs --url '{URL}' --out shots/a1/<arm> [--only hub6,ground,l20]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArena, coverAt } from './al_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = resolve(String(arg('--out', 'shots/a1/cap')));
const ONLY = String(arg('--only', 'hub6,ground,l20,conceal')).split(',');
const W = 1600, H = 900;
const WORLD = 0.05; // m per wu — `units.ts` wu()
if (!BASE || BASE.includes(':5173')) { console.error('a1_cap: --url of a FROZEN snapshot required (never :5173)'); process.exit(2); }

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

const A = loadArena();
const ring = (cx, cy, r, ids) => ids.map((id, i) => {
  const a = (i * 2 * Math.PI) / ids.length;
  return `${id}@${Math.round(cx + r * Math.cos(a))},${Math.round(cy + r * Math.sin(a))}`;
}).join(';');
// The concealment list is read from the same dump; al_lib does not expose it, so it is
// read here, and the anchor is the patch nearest the hub (where fights converge).
const DUMP = JSON.parse(readFileSync(resolve(HERE, '../arena.gameplay.json'), 'utf8'));
const PATCHES = (DUMP.concealment ?? []).slice().sort((a, b) => Math.hypot(a.x - A.cx, a.y - A.cy) - Math.hypot(b.x - A.cx, b.y - A.cy));
if (!PATCHES.length) { console.error('a1_cap: the dump has no concealment list'); process.exit(2); }
const P0 = PATCHES[0];
const STATIONS = [
  { id: 'hubE', x: A.cx + 160, y: A.cy },
  { id: 'hubW', x: A.cx - 160, y: A.cy },
  ...A.spawns.map((s, i) => ({ id: `sp${i}`, x: s.x, y: s.y })),
];
// A station inside a prop measures the prop (al_guard's third detector). Refuse, loudly.
for (const s of STATIONS) {
  if (coverAt({ cover: A.cover }, s.x, s.y)) { console.error(`a1_cap: station ${s.id} (${s.x},${s.y}) is INSIDE a CoverBox`); process.exit(2); }
}
if (STATIONS.length < 8) { console.error(`a1_cap: expected 8 stations, built ${STATIONS.length} — the dump lost its spawns?`); process.exit(2); }

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

/** Everything that happens on one frozen frame. Returns data URLs + the mesh table. */
const PAGE_PASSES = async (aimAt) => {
  const stage = window.__stage;
  const renderer = stage.renderer, scene = stage.scene, rig = stage.rig, cam = rig.camera;
  rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
  if (aimAt) {
    if (aimAt.ground) {
      rig.frameMode = 'ground'; rig.viewWidthUnits = aimAt.viewWidth; rig.pitchDeg = aimAt.pitch;
    } else if (aimAt.pitch != null) rig.pitchDeg = aimAt.pitch;
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
  const tops = scene.children.map((o, i) => ({ i, name: o.name, type: o.type }));
  out.tops = tops;
  const casters = []; scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow) casters.push(o); });
  const savedI = casters.map((l) => l.shadow.intensity);
  casters.forEach((l) => { l.shadow.intensity = 0; });
  out.noshadow = url(render());
  casters.forEach((l, k) => { l.shadow.intensity = savedI[k]; });
  const arenaRoot = scene.children.find((o) => o.name === 'arena:kitchen');
  if (arenaRoot) { arenaRoot.visible = false; const P = render(); out.controls.POSITIVE_arenaHidden = diffN(A0, P, 6) / (cw * ch); arenaRoot.visible = true; }
  // ---- per-mesh ID pass (post bypassed, tone mapping off) — gx_gap_cap's encoding
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
    mm.onBeforeCompile = () => {}; mm.customProgramCacheKey = () => 'a1id';
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
  for (const o of hidT) o.visible = true;
  for (const s of saved) {
    if (s.o.material !== s.mat) { const mm = s.o.material; s.o.material = s.mat; if (mm && mm !== s.mat) mm.dispose(); }
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

function writeShot(tag, res, meta) {
  for (const k of ['canvas', 'noshadow', 'id', 'idopaque']) {
    if (res[k]) { writeFileSync(join(OUT, `${tag}.${k}.png`), Buffer.from(res[k].split(',')[1], 'base64')); delete res[k]; }
  }
  if (!meta.canvasOnly) writeFileSync(join(OUT, `${tag}.json`), JSON.stringify({ ...meta, ...res }, null, 1));
  const c = res.controls ?? {};
  const bad = (c.NULL ?? 0) !== 0 || (c.RESTORE ?? 0) !== 0 || (!meta.canvasOnly && !((c.POSITIVE_arenaHidden ?? 0) > 0.4));
  console.log(`  ${tag.padEnd(14)} NULL ${c.NULL} RESTORE ${c.RESTORE ?? '-'} POS ${(c.POSITIVE_arenaHidden ?? 0).toFixed(3)} ids ${res.idCount ?? '-'} ${res.error ?? ''}${bad ? '  << CONTROL FAILED' : ''}`);
  return !bad;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH });
let fails = 0;
try {
  const warm = await browser.newPage(); await warm.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle' }).catch(() => {}); await warm.waitForTimeout(2500); await warm.close();
  const six = ring(A.cx, A.cy, 185, ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg']);
  const q = `screen=match&player=hamburger&enemy=donut&fighters=${six}&pointerLock=0`;
  if (ONLY.includes('hub6')) {
    console.log(`[hub6] ${six}`);
    const { page, errors } = await openMatch(browser, q);
    let t = 0;
    for (const at of [4600, 5800, 7200]) {
      await step(page, at - t); t = at;
      await pause(page);
      const res = await page.evaluate(PAGE_PASSES, null);
      if (!writeShot(`hub6_t${at}`, res, { tag: `hub6_t${at}`, query: q, at })) fails++;
      await page.evaluate(() => { window.__rafPause = false; const h = window.__rafHeld.splice(0); for (const cb of h) window.__rafOrig(cb); });
    }
    if (errors.length) { fails++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
    await page.close();
  }
  if (ONLY.includes('conceal')) {
    // The local seat stands INSIDE the patch nearest the hub (south-west of its centre), one
    // opponent stands deep inside it (> the 84 wu reveal radius away is impossible inside a
    // 110-130 wu box diagonal only when both sit in opposite corners — so it is the NE
    // corner), one stands on open ground south of it. A visible-fighter self-reveal must
    // show the local seat; the concealed opponent must stay covered.
    const hw = P0.w / 2, hh = P0.h / 2;
    const seats = [
      ['hamburger', P0.x - hw * 0.55, P0.y + hh * 0.55],
      ['donut', P0.x + hw * 0.7, P0.y - hh * 0.7],
      ['taco', P0.x - hw * 0.2, P0.y + hh + 60],
    ];
    const fq = seats.map(([id, x, y]) => `${id}@${Math.round(x)},${Math.round(y)}`).join(';');
    const cq = `screen=match&player=hamburger&enemy=donut&fighters=${fq}&pointerLock=0`;
    console.log(`[conceal] patch ${P0.kind} (${P0.x},${P0.y}) ${P0.w}x${P0.h} — ${fq}`);
    const { page, errors } = await openMatch(browser, cq);
    await step(page, 2400);
    await pause(page);
    const res = await page.evaluate(PAGE_PASSES, null);
    if (!writeShot('conceal_58', res, { tag: 'conceal_58', query: cq, patch: P0 })) fails++;
    const vis = await page.evaluate(() => window.__stage.scene.children.filter((o) => /^character:/.test(o.name)).map((o) => ({ name: o.name, visible: o.visible })));
    console.log('  fighter roots:', JSON.stringify(vis));
    // ── SELF-REVEAL, with its KNOWN-BAD ARM ─────────────────────────────────────────
    // Delivered pixels of each fighter = the px that change when that root alone is hidden.
    // Measured with the canopy's self-reveal ON (shipped) and OFF (`__a1SelfRevealOff`, what
    // a solid canopy without it draws). The local seat stands under the canopy, so OFF must
    // LOSE most of him (the known-bad: a canopy that hides you from yourself) and ON must
    // keep him. On a tree with no self-reveal (the open rack) both arms read the same, which
    // is reported, not failed — the rack never hid him to begin with.
    const sr = await page.evaluate(() => {
      const stage = window.__stage, scene = stage.scene;
      stage.rig.shakeAmount = 0; stage.rig.shakeOffset.set(0, 0, 0);
      const cw = stage.canvas.width, ch = stage.canvas.height;
      const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
      const ctx = c2.getContext('2d', { willReadFrequently: true });
      const snap = () => { stage.renderer.shadowMap.needsUpdate = true; stage.render(0); ctx.clearRect(0, 0, cw, ch); ctx.drawImage(stage.canvas, 0, 0); return ctx.getImageData(0, 0, cw, ch).data; };
      const diffN = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) >= 12) n++; return n; };
      const roots = scene.children.filter((o) => /^character:/.test(o.name));
      const out = {};
      for (const off of [false, true]) {
        window.__a1SelfRevealOff = off;
        const A = snap();
        for (const r of roots) {
          if (!r.visible) { out[`${r.name}|${off ? 'off' : 'on'}`] = 'hidden-root'; continue; }
          r.visible = false; const B = snap(); r.visible = true;
          out[`${r.name}|${off ? 'off' : 'on'}`] = diffN(A, B);
        }
      }
      window.__a1SelfRevealOff = false;
      snap();
      return out;
    });
    console.log('  self-reveal (delivered px per fighter, ON | OFF):', JSON.stringify(sr));
    writeFileSync(join(OUT, 'conceal_selfreveal.json'), JSON.stringify(sr, null, 1));
    const r20 = await page.evaluate(PAGE_PASSES, { x: P0.x, y: P0.y + 40, pitch: 20, ground: true, viewWidth: 300, canvasOnly: true });
    if (!writeShot('conceal_l20', r20, { tag: 'conceal_l20', canvasOnly: true })) fails++;
    if (errors.length) { fails++; console.log('  JS:', errors.slice(0, 5).join(' | ')); }
    await page.close();
  }
  if (ONLY.includes('ground') || ONLY.includes('l20')) {
    const { page, errors } = await openMatch(browser, q);
    await step(page, 400);
    await pause(page);
    if (ONLY.includes('ground')) {
      console.log('[ground — match camera, re-aimed, shipped fair radius]');
      for (const s of STATIONS) {
        const res = await page.evaluate(PAGE_PASSES, { x: s.x, y: s.y, pitch: 58 });
        if (!writeShot(s.id, res, { tag: s.id, station: s, query: q })) fails++;
      }
    }
    if (ONLY.includes('l20')) {
      console.log('[l20 — lobby pitch, ground framing, diagnostic]');
      for (const s of STATIONS) {
        const res = await page.evaluate(PAGE_PASSES, { x: s.x, y: s.y, pitch: 20, ground: true, viewWidth: 340, canvasOnly: true });
        if (!writeShot(`l20_${s.id}`, res, { tag: `l20_${s.id}`, canvasOnly: true })) fails++;
      }
    }
    if (errors.length) { fails++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(join(OUT, 'stations.json'), JSON.stringify({ arena: { cx: A.cx, cy: A.cy }, stations: STATIONS, root: resolve(HERE, '../..') }, null, 1));
console.log(fails ? `${fails} control/JS failure(s) — do not trust this capture` : 'all controls held — NOW READ THE PNGs');
process.exitCode = fails ? 1 : 0;
