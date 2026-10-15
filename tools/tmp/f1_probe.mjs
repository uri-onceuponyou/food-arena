#!/usr/bin/env node
/**
 * F1_PROBE — graphics campaign work package F1 (the fighter unit), its own instrument.
 * Owner of the `f1_` prefix.
 *
 * A COPY of R1's `r1_probe.mjs` (which exports nothing, so it cannot be imported), trimmed of
 * R1's light-only passes (raw light families, the EXTERNAL override control, the normal pass)
 * and extended with the two things F1 needs:
 *
 *   --seats sim|infer   `sim` (default) states every seat to the Stage through
 *                       `stage.setFighterSeats` from the SIM's own `alive` flags before any
 *                       pass — i.e. it renders what the game draws once `match.ts` makes the
 *                       call F1 routes to its owner. `infer` leaves the Stage's scene-graph
 *                       inference, which cannot see death (a corpse keeps its ring).
 *   <scene>.page.png    the PAGE (DOM HUD included) of the frozen live frame, with every CSS
 *                       animation held by CDP — the nameplates and damage numbers as a
 *                       capture sees them.
 *
 * Everything else is R1's, verbatim: ONE frozen deterministic frame per scene (rv_capture's
 * virtual clock + seeded PRNG), every requested LOOK variant rendered on that one frame, the
 * role passes in gx_gap_cap's encoding, the NULL / RESTORE / COUNTS controls. Variants are
 * R1's grammar (`r1`, `-<switch>`, `k:<knob>=<v>+...`, `dbg:green`); F1's switch is `rings`
 * and its knobs are `ringSpread ringFill ringRim ringKey ringLocal ringEnemy`.
 *
 * Usage (from a worktree, against a frozen snapshot of the tree being measured):
 *   node tools/tmp/sx_snap.mjs --root <tree> -- \
 *     node tools/tmp/f1_probe.mjs --url '{URL}' --out shots/rv/f1/<run> \
 *       [--scenes S1,S2] [--variants r1,-rings] [--tier low] [--w 1600 --h 900] [--seats sim]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RV_INIT } from './rv_capture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = resolve(String(arg('--out', 'shots/rv/f1/run')));
const SEATS = String(arg('--seats', 'sim'));
const ANGLE = arg('--angle', 'metal');
const W = Number(arg('--w', 1600));
const H = Number(arg('--h', 900));
const DPR = Number(arg('--dpr', 1));
const TIER = arg('--tier', null);
const T_MS = Number(arg('--t', 7008));
const VARIANTS = String(arg('--variants', 'r1,legacy')).split(',').filter(Boolean);
const NO_ROLES = has('--no-roles');
const SEED = 0x5eed2610;
const EPOCH = Date.UTC(2026, 9, 15, 12, 0, 0);

const ARENA = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const CX = ARENA.center.x, CY = ARENA.center.y;
const ring = (cx, cy, r, ids, a0 = 15) => ids.map((id, i) => {
  const a = (a0 + (i * 360) / ids.length) * Math.PI / 180;
  return `${id}@${Math.round(cx + r * Math.cos(a))},${Math.round(cy + r * Math.sin(a))}`;
}).join(';');
// Coordinates are DERIVED from the arena's own centre (CLAUDE.md: never retype a map literal).
// S1/S2 are gx_gap_cap's six-seat stations; T1 is its D4 station with three fighters.
const SCENES = {
  S1: { fighters: ring(CX, CY, 185, ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'], 0), note: 'hub ring around the pot' },
  S2: { fighters: ring(CX + 950, CY + 100, 130, ['lollipop', 'burrito', 'soup', 'waterbottle', 'hotdog', 'hamburger']), note: 'east cluster' },
  T1: { fighters: ring(CX + 875, CY + 225, 90, ['hotdog', 'egg', 'pizza']), note: 'east, three fighters by cover' },
  S3: { fighters: ring(CX - 300, CY + 600, 130, ['egg', 'pizza', 'sushi', 'donut', 'taco', 'lollipop']), note: 'south cluster' },
};
const SCENE_IDS = String(arg('--scenes', 'S1,S2,T1')).split(',').filter(Boolean);

if (!BASE || BASE.includes(':5173')) { console.error('f1_probe: need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }

const LAUNCH = ANGLE === 'metal'
  ? { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--force-color-profile=srgb', '--disable-threaded-animation'] }
  : { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--disable-threaded-animation'] };
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// PAGE SIDE — everything that happens on the frozen frame
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_PASSES = async (cfg) => {
  const st = window.__stage;
  const renderer = st.renderer, scene = st.scene, cam = st.rig.camera;
  const cw = st.canvas.width, ch = st.canvas.height;
  const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
  const ctx = c2.getContext('2d', { willReadFrequently: true });
  const snap = () => { ctx.clearRect(0, 0, cw, ch); ctx.drawImage(st.canvas, 0, 0); return ctx.getImageData(0, 0, cw, ch); };
  const url = (img) => { ctx.putImageData(img, 0, 0); return c2.toDataURL('image/png'); };
  const diffN = (a, b, d = 1) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) { if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) >= d) n++; } return n; };
  const hasLook = !!st.look;
  const look0 = hasLook ? { ...st.look } : null;
  const L = st.lighting;
  // Zero shadow intensity AFTER the look has set it (applyLook runs inside render()), and put
  // back exactly what the look had set once the frame is taken. Restoring explicitly matters
  // since 4512aed+1: the look writes the lights only when it CHANGES, so a zero left behind
  // would leak into the next variant whenever two variants share the same light settings.
  let forceNoShadow = false;
  let lookShadowI = null;
  const origApply = L.applyLook ? L.applyLook.bind(L) : null;
  if (origApply) L.applyLook = (l) => { origApply(l); if (forceNoShadow) { lookShadowI = L.key.shadow.intensity; L.key.shadow.intensity = 0; } };
  const keyI0 = L.key.shadow.intensity;
  const render = () => {
    renderer.shadowMap.needsUpdate = true;
    if (!origApply) L.key.shadow.intensity = forceNoShadow ? 0 : keyI0;
    st.render(0);
    const img = snap();
    if (origApply && forceNoShadow && lookShadowI !== null) { L.key.shadow.intensity = lookShadowI; lookShadowI = null; }
    return img;
  };
  const ink0 = st.contour ? st.contour.color.clone() : null;
  const width0 = st.contour ? st.contour.width : null;
  const setVariant = (v) => {
    if (!hasLook) { if (v !== 'cur') throw new Error(`variant ${v} needs Stage.look (this tree has none)`); return; }
    Object.assign(st.look, look0);
    if (st.contour && ink0) { st.contour.color.copy(ink0); st.contour.width = width0; }
    if (v === 'cur' || v === 'r1') return;
    // Debug: the contour drawn in pure green, so WHERE it lands is unmissable (rule 4).
    if (v === 'dbg:green') { if (!st.contour) throw new Error('no contour effect'); st.contour.color.setRGB(0, 1, 0); return; }
    if (v === 'legacy') { Object.assign(st.look, { split: false, form: false, shadow: false, rimGate: false, contour: false }); return; }
    // only:<a>[+<b>...] — every switch OFF except the ones named (isolates one change vs legacy)
    if (v.startsWith('only:')) {
      Object.assign(st.look, { split: false, form: false, shadow: false, rimGate: false, contour: false });
      for (const k of v.slice(5).split('+')) { if (!(k in st.look)) throw new Error(`no look switch ${k}`); st.look[k] = true; }
      return;
    }
    if (v.startsWith('-')) { const k = v.slice(1); if (!(k in st.look)) throw new Error(`no look switch ${k}`); st.look[k] = false; return; }
    if (v.startsWith('k:')) {
      for (const kv of v.slice(2).split('+')) {
        const [k, raw] = kv.split('=');
        const val = raw.startsWith('0x') ? parseInt(raw, 16) : Number(raw);
        // contour knobs live on the effect handle, not on `look`
        if (k === 'contourWidth') { if (!st.contour) throw new Error('no contour effect'); st.contour.width = val; continue; }
        if (k === 'ink') { if (!st.contour) throw new Error('no contour effect'); st.contour.color.setHex(val); continue; }
        if (!(k in st.look)) throw new Error(`no look knob ${k}`);
        st.look[k] = val;
      }
      return;
    }
    throw new Error(`unknown variant ${v}`);
  };
  const countDraws = (withShadow) => {
    const info = renderer.info; const ar = info.autoReset; info.autoReset = false; info.reset();
    renderer.shadowMap.needsUpdate = withShadow;
    st.render(0);
    const r = { calls: info.render.calls, triangles: info.render.triangles };
    info.reset(); info.autoReset = ar; return r;
  };

  const out = { size: [cw, ch], hasLook, controls: {}, variants: {}, images: {}, tier: window.__renderTier ?? null, pixelRatio: renderer.getPixelRatio() };
  const refV = cfg.variants.includes('r1') ? 'r1' : cfg.variants[0];
  setVariant(refV);
  const A0 = render();
  const A1 = render();
  out.controls.NULL = diffN(A0, A1);
  for (const v of cfg.variants) {
    setVariant(v);
    render();                           // a first render may compile programs
    const img = render();
    const rec = { NULLsecond: diffN(img, render()) };
    out.images[`${v}`] = url(img);
    forceNoShadow = true;
    out.images[`${v}.noshadow`] = url(render());
    forceNoShadow = false;
    rec.drawsShadow = countDraws(true);
    rec.drawsCached = countDraws(false);
    rec.vsRef = diffN(img, A0);
    rec.ringsShown = st.seatRings ? (st.seatRings.group.visible ? st.seatRings.shown : 0) : null;
    if (hasLook) rec.look = { ...st.look };
    rec.frontI = L.front.intensity; rec.keyShadowI = L.key.shadow.intensity;
    rec.sky = L.fill.color.getHexString();
    rec.camLayers = cam.layers.mask;
    out.variants[v] = rec;
  }
  if (cfg.variants.includes('r1') && cfg.variants.includes('legacy')) {
    out.controls.MOVES_r1_vs_legacy = out.variants.legacy.vsRef;
  }
  setVariant(refV);
  const R = render();
  out.controls.RESTORE = diffN(A0, R);
  out.ringsShown = st.seatRings ? st.seatRings.shown : null;
  // ── census of the top-level children + the reference variant's role passes ──
  const tops = scene.children.map((o, i) => {
    let n = 0; o.traverse((x) => { if (x.isMesh || x.isSprite || x.isPoints || x.isLine) n++; });
    return { i, name: o.name, type: o.type, visible: o.visible, renderables: n };
  });
  out.tops = tops;
  const fighterRoots = scene.children.filter((o) => /^character:/.test(o.name));
  out.fighterRoots = fighterRoots.map((f) => f.name);
  // hull census: how many per-part character hulls exist and how many the camera can see
  let hulls = 0, hullsVisible = 0;
  for (const f of fighterRoots) f.traverse((o) => { if (o.isMesh && /__outline$/.test(o.name)) { hulls++; if (o.layers.test(cam.layers)) hullsVisible++; } });
  out.hulls = { total: hulls, visibleToCamera: hullsVisible };
  // material-role census (R1 trees only): a role patch that never landed is a dead claim
  if (st.look) {
    const seen = new Set(); const roles = { charLit: 0, charTag: 0, env: 0, none: 0 };
    scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m || seen.has(m)) continue; seen.add(m);
        const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
        if (key.includes('r1role:char')) { if (m.isMeshStandardMaterial) roles.charLit++; else roles.charTag++; }
        else if (key.includes('r1role:env')) roles.env++;
        else roles.none++;
      }
    });
    out.roles = roles;
  }
  if (cfg.noRoles) return out;

  const vfxRoot = scene.children.find((o) => o.name === 'vfx_layer');
  out.images.canvas = url(A0);
  if (vfxRoot) { vfxRoot.visible = false; out.images.novfx = url(render()); vfxRoot.visible = true; }
  for (const f of fighterRoots) f.visible = false;
  const NF = render();
  out.controls.FIGHTER_ABL_px = diffN(A0, NF, 6);
  out.images.nofighters = url(NF);
  for (const f of fighterRoots) f.visible = true;
  forceNoShadow = true; out.images.noshadow = url(render()); forceNoShadow = false;

  // per-mesh ID pass (post bypassed) — gx_gap_cap's 12-bit 16-level encoding, ported verbatim
  const entries = [];
  let basicProto = null, spriteProto = null;
  scene.traverse((o) => {
    if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    if (!o.layers.test(cam.layers)) return;    // hulls hidden by the camera stay hidden
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
    mm.color.setRGB(((id & 15) * 16 + 8) / 255, (((id >> 4) & 15) * 16 + 8) / 255, (((id >> 8) & 15) * 16 + 8) / 255, 'srgb');
    o.material = mm;
    if (o.isInstancedMesh && o.instanceColor) o.instanceColor = null;
    meshes.push(rec);
  }
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  out.images.id = url(snap());
  const hidT = [];
  for (let k = 0; k < saved.length; k++) {
    const s = saved[k]; const rec = meshes[k];
    if (rec && rec.id && (rec.transparent || rec.blending !== 1)) { if (s.o.visible) { s.o.visible = false; hidT.push(s.o); } }
  }
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  out.images.idopaque = url(snap());
  for (const o of hidT) o.visible = true;
  for (const s of saved) {
    if (s.o.material !== s.mat) { const mm = s.o.material; s.o.material = s.mat; if (mm && mm !== s.mat) mm.dispose(); }
    s.o.visible = s.vis;
    if (s.ic) s.o.instanceColor = s.ic;
  }
  renderer.toneMapping = savedTone; scene.background = savedBg; scene.fog = savedFog;
  const R2 = render();
  out.controls.RESTORE_after_roles = diffN(A0, R2);
  out.meshes = meshes;
  out.idCount = id;
  out.camera = { fov: cam.fov, aspect: cam.aspect, near: cam.near, far: cam.far,
    position: cam.position.toArray().map((v) => +v.toFixed(4)), pitchDeg: st.rig.pitchDeg,
    matrixWorld: cam.matrixWorld.elements.map((v) => +v.toFixed(6)) };
  if (origApply) L.applyLook = origApply;
  return out;
};

const READ_SLOTS = () => {
  const scr = window.__vfxDebugScreen ?? null;
  const f = window.__vfxDebugFighters ?? null;
  return { slots: scr?.slots ?? null, fs: f?.slots ?? null, phase: window.__matchDebug?.phase ?? null };
};

async function shootScene(browser, sid) {
  const sc = SCENES[sid];
  if (!sc) throw new Error(`unknown scene ${sid}`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  await page.addInitScript(RV_INIT, { protocol: 'f1/1', seed: SEED, epoch: EPOCH, draw: true, storage: {} });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  const errors = [];
  page.on('pageerror', (e) => { errors.push(String(e).slice(0, 300)); console.log(`   [${sid}] PAGEERROR ${String(e).slice(0, 200)}`); });
  page.on('console', (m) => { if (m.type() === 'warning' && /\[roles\]|\[stage\]/.test(m.text())) { errors.push(m.text().slice(0, 300)); console.log(`   [${sid}] WARN ${m.text().slice(0, 200)}`); } });
  page.setDefaultTimeout(300_000);
  const q = new URLSearchParams({ pointerLock: '0', fighters: sc.fighters, fogRadius: '1700' });
  if (TIER) q.set('tier', TIER);
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 300_000 });
  await page.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
  let now = 0;
  const t0 = Date.now();
  while (now < T_MS) {
    const res = await page.evaluate(([k]) => window.__rv.frames(k, 16), [Math.min(8, Math.ceil((T_MS - now) / 16))]);
    now = res.now;
    // shake off as soon as the match Stage exists (rv_capture's suppressShake)
    await page.evaluate(() => {
      const st = window.__stage; if (!st || !st.rig || st.rig.__r1NoShake) return;
      st.rig.shake = () => {}; st.rig.shakeAmount = 0; if (st.rig.shakeOffset?.set) st.rig.shakeOffset.set(0, 0, 0); st.rig.__r1NoShake = true;
    });
  }
  const ready = await page.evaluate(() => window.__gameReady === true && !!window.__stage);
  if (!ready) throw new Error(`${sid}: not ready at t=${now}`);
  const slots = await page.evaluate(READ_SLOTS);
  console.log(`   [${sid}] frozen at t=${now} ms (${((Date.now() - t0) / 1000).toFixed(1)} s real) phase=${slots.phase} — ${sc.note}`);
  // ── SEATS: state them from the SIM (what match.ts will pass), or leave inference ──
  // Roots in SCENE order = slot order (match.ts adds them so, load-bearing); the sim's
  // per-slot `alive` comes from the vfx debug mirror rv_capture already reads. A count
  // mismatch is a refusal, not a guess (a set that cannot be paired is not stated).
  const seatInfo = await page.evaluate((mode) => {
    const st = window.__stage;
    const fs = window.__vfxDebugFighters?.slots ?? null;
    const roots = st.scene.children.filter((o) => /^character:/.test(o.name));
    if (mode !== 'sim') return { mode, roots: roots.length, stated: false };
    if (typeof st.setFighterSeats !== 'function') return { mode, roots: roots.length, stated: false, why: 'tree has no setFighterSeats' };
    if (!fs || fs.length !== roots.length) return { mode, roots: roots.length, sim: fs?.length ?? null, stated: false, why: 'count mismatch' };
    st.setFighterSeats(roots.map((root, i) => ({ root, local: i === 0, alive: !!fs[i].alive })));
    return { mode, roots: roots.length, stated: true, alive: fs.map((f) => !!f.alive) };
  }, SEATS);
  if (SEATS === 'sim' && !seatInfo.stated && seatInfo.why !== 'tree has no setFighterSeats') throw new Error(`${sid}: seats not stated — ${JSON.stringify(seatInfo)}`);
  console.log(`   [${sid}] seats ${JSON.stringify(seatInfo)}`);
  // ── THE PAGE, HUD INCLUDED, of the live frame (rendered once more so the stated seats show) ──
  await page.evaluate(() => { window.__stage.render(0); });
  await page.screenshot({ path: join(OUT, `${sid}.page.png`) });
  const res = await page.evaluate(PAGE_PASSES, { variants: VARIANTS, noRoles: NO_ROLES });
  res.seats = seatInfo;
  const tag = `${sid}`;
  for (const [k, v] of Object.entries(res.images ?? {})) {
    const name = k === 'canvas' ? `${tag}.canvas.png` : `${tag}.${k}.png`;
    writeFileSync(join(OUT, name), Buffer.from(v.split(',')[1], 'base64'));
    if (k === 'canvas') writeFileSync(join(OUT, `${tag}.png`), Buffer.from(v.split(',')[1], 'base64'));
  }
  delete res.images;
  const meta = { scene: { id: sid, ...sc }, t: now, tier: TIER, geometry: { W, H, DPR }, angle: ANGLE, slots: slots.slots, fighters: slots.fs, errors, ...res };
  writeFileSync(join(OUT, `${tag}.json`), JSON.stringify(meta, null, 1));
  const c = res.controls;
  const vs = Object.entries(res.variants).map(([k, r]) => `${k}: draws ${r.drawsShadow.calls}/${r.drawsCached.calls} vsRef ${r.vsRef}px null2 ${r.NULLsecond}`).join(' | ');
  console.log(`   [${sid}] NULL ${c.NULL} RESTORE ${c.RESTORE}/${c.RESTORE_after_roles ?? '-'} FIGHTER_ABL ${c.FIGHTER_ABL_px ?? '-'} rings shown ${res.ringsShown ?? '-'} hulls ${res.hulls.visibleToCamera}/${res.hulls.total} ${res.error ?? ''}`);
  console.log(`   [${sid}] ${vs}`);
  await context.close();
  return { sid, controls: c, errors: errors.length };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const summary = [];
  try {
    const warm = await browser.newPage();
    await warm.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    await warm.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(2500); await warm.close();
    for (const sid of SCENE_IDS) {
      console.log(`── ${sid}`);
      try { summary.push(await shootScene(browser, sid)); } catch (e) { console.log(`   [${sid}] FAILED ${String(e).slice(0, 400)}`); summary.push({ sid, failed: String(e).slice(0, 400) }); }
    }
  } finally { await browser.close(); }
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ base: BASE, variants: VARIANTS, tier: TIER, W, H, DPR, angle: ANGLE, t: T_MS, summary }, null, 1));
  console.log('done ->', OUT);
}

const isMain = (() => { try { return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) await main();
