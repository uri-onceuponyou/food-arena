#!/usr/bin/env node
/**
 * GX_GAP_CAP — action frames WITH EXACT ROLE MASKS, for the whole-frame gap analysis.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────
 * The graphics-revamp review needs frame-level statistics BY ROLE (ground / props / fighters
 * / effects / HUD / cast shadow) on the frames a blind critic scores — 1v1 and six-seat
 * match frames at the shipped 58 deg camera. A colour-keyed segmentation of our own frame
 * would be a second instrument to validate; the renderer can simply be asked. So every
 * captured moment is FROZEN (virtual clock, dt = 0, which also holds the camera shake —
 * `camera.ts` update()'s `dtSeconds > 0` guard) and then rendered several more times:
 *
 *   <id>.png           the page screenshot, HUD included  <- what a critic scores
 *   <id>.canvas.png    canvas readback, no DOM HUD
 *   <id>.novfx.png     `vfx_layer` hidden                 -> delivered-VFX mask by diff
 *   <id>.nofighters.png every fighter root hidden          -> delivered-fighter mask by diff
 *   <id>.noshadow.png  every caster light's shadow.intensity = 0 (a UNIFORM, no recompile)
 *   <id>.id.png        per-MESH id pass (12-bit, matcover's 16-level encoding), post bypassed
 *   <id>.normal.png    MeshNormalMaterial override (view-space normals), post bypassed
 *   <id>.json          mesh table (id -> name, top-level root, ancestry), camera, fighters,
 *                      and the CONTROLS below
 *
 * ── Controls, each REQUIRED to come out the way it is constructed (rule 6) ───────────
 *   NULL      two consecutive frozen renders must differ in 0 px — otherwise nothing here is
 *             a frozen frame and every diff mask is noise.
 *   RESTORE   after all passes, a re-render must equal the first render (0 px), otherwise a
 *             pass leaked state into the next one (LESSONS §13: pooled materials).
 *   POSITIVE  hiding the arena root must change > 40% of the frame — a diff machinery that
 *             cannot see THAT cannot see anything.
 *   ID-COVER  decoded ids must cover > 85% of the frame, and fighters must decode to > 0 px
 *             whenever a fighter is projected on screen (a set filtered to empty passes every
 *             `every()` — CLAUDE.md rule 6).
 *
 * ⚠️ READ-ONLY on the tree it measures. Writes only under --out.
 *
 * Usage (from the repo root, against a FROZEN snapshot of a DETACHED worktree):
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_gap_cap.mjs --url '{URL}' --out shots/rv/audit/gap/cap [--only D1,S1]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = arg('out', 'shots/rv/audit/gap/cap');
const ONLY = arg('only', null);
const W = 1600, H = 900;
const PER_SCENE = Number(arg('per', 2));
const SCENE_BUDGET_MS = Number(arg('budget', 240_000));
if (!BASE || BASE.includes(':5173')) { console.error('need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const ring = (cx, cy, r, ids, a0 = 15) => ids.map((id, i) => {
  const a = (a0 + (i * 360) / ids.length) * Math.PI / 180;
  return `${id}@${Math.round(cx + r * Math.cos(a))},${Math.round(cy + r * Math.sin(a))}`;
}).join(';');

/** Scene table. Positions checked clear of every CoverBox in tools/arena.gameplay.json
 * (pad 26 wu) before use; coordinates are ×4-map (2800x2000, centre 1400,1000). */
const SCENES = [
  { id: 'D1', kind: 'duel', q: { player: 'hamburger', enemy: 'donut', px: 1560, py: 1000 }, note: 'hub, 160 wu east of the pot' },
  { id: 'D2', kind: 'duel', q: { player: 'taco', enemy: 'sushi', px: 860, py: 500 }, note: 'the baseline_capture anchor (a 1x-map literal)' },
  // D3 was (1700,400) — ON produce_crate_tall's west edge, so the 'checked clear' above was
  // false for it; al_guard caught it 2026-10-15. 60 wu west is clear at pad 26.
  { id: 'D3', kind: 'duel', q: { player: 'pizza', enemy: 'burrito', px: 1640, py: 400 }, note: 'north, open floor near props' },
  // D2/D3 found no engagement in 300 s on the first run (the AI never closed on screen);
  // D1 worked because the player stood on the enemy's route. D4/D5 stand on the route out
  // of the enemy spawn (2500,1190), clear of cover (pad 32 wu, and +-40 wu around).
  { id: 'D4', kind: 'duel', q: { player: 'hotdog', enemy: 'egg', px: 2275, py: 1225 }, note: 'east, on the route out of the enemy spawn' },
  { id: 'D5', kind: 'duel', q: { player: 'lollipop', enemy: 'soup', px: 2425, py: 975 }, note: 'east, north of the enemy spawn' },
  { id: 'S1', kind: 'six', q: { fighters: ring(1400, 1000, 185, ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'], 0), fogRadius: 1700 }, note: 'hub ring around the pot' },
  { id: 'S2', kind: 'six', q: { fighters: ring(2350, 1100, 130, ['lollipop', 'burrito', 'soup', 'waterbottle', 'hotdog', 'hamburger']), fogRadius: 1700 }, note: 'east cluster' },
  { id: 'S3', kind: 'six', q: { fighters: ring(1100, 1600, 130, ['egg', 'pizza', 'sushi', 'donut', 'taco', 'lollipop']), fogRadius: 1700 }, note: 'south cluster' },
];

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'gx-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};
const PAGE_UNSTILL_HUD = () => { document.getElementById('gx-still')?.remove(); for (const a of document.getAnimations()) { try { a.play(); } catch { /* */ } } };

/** Everything that happens on a frozen frame. Returns data URLs + tables. */
const PAGE_PASSES = async () => {
  const stage = window.__stage;
  const renderer = stage.renderer, scene = stage.scene, cam = stage.rig.camera;
  const cw = stage.canvas.width, ch = stage.canvas.height;
  const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
  const ctx = c2.getContext('2d', { willReadFrequently: true });
  const snap = () => { ctx.clearRect(0, 0, cw, ch); ctx.drawImage(stage.canvas, 0, 0); return ctx.getImageData(0, 0, cw, ch); };
  const url = (img) => { ctx.putImageData(img, 0, 0); return c2.toDataURL('image/png'); };
  const diffN = (a, b, d = 6) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) { if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) >= d) n++; } return n; };
  const render = () => { renderer.shadowMap.needsUpdate = true; stage.render(0); return snap(); };

  const out = { size: [cw, ch], controls: {} };
  const A = render();
  const B = render();
  out.controls.NULL = diffN(A, B, 1);
  out.canvas = url(A);

  // ---- top-level census, and the role of each top-level child
  const tops = scene.children.map((o, i) => {
    let n = 0; o.traverse((x) => { if (x.isMesh || x.isSprite || x.isPoints || x.isLine) n++; });
    let role = 'other';
    if (o.name === 'arena:kitchen') role = 'arena';
    else if (o.name === 'fog_boundary') role = 'fog';
    else if (o.name === 'vfx_layer') role = 'vfx';
    else if (o.name === 'contact:shadows') role = 'contact';
    else if (o.isLight || /Light$/.test(o.type)) role = 'light';
    // ⚠️ The first version tested `isGroup && !name` and classified ZERO fighters: the roots
    // are named `character:<id>`. Its fighter ablation hid nothing and wrote a PNG byte-
    // identical to the canvas — the vacuous-control class. FIGHTER_ABL below now fails it.
    else if (/^character:/.test(o.name) || (o.isGroup && !o.name && n > 3)) role = 'fighter';
    return { i, name: o.name, type: o.type, visible: o.visible, renderables: n, role };
  });
  out.tops = tops;
  const fighterRoots = scene.children.filter((o, i) => tops[i].role === 'fighter');
  const vfxRoot = scene.children.find((o) => o.name === 'vfx_layer');
  const arenaRoot = scene.children.find((o) => o.name === 'arena:kitchen');

  // ---- ablations (post chain ON: these are DELIVERED pixels)
  if (vfxRoot) { vfxRoot.visible = false; out.novfx = url(render()); vfxRoot.visible = true; }
  out.fighterRoots = fighterRoots.map((f) => f.name);
  for (const f of fighterRoots) f.visible = false;
  const NF = render();
  out.controls.FIGHTER_ABL_px = diffN(A, NF, 6);
  out.nofighters = url(NF);
  for (const f of fighterRoots) f.visible = true;
  const casters = []; scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow) casters.push(o); });
  const savedI = casters.map((l) => l.shadow.intensity);
  casters.forEach((l) => { l.shadow.intensity = 0; });
  out.noshadow = url(render());
  casters.forEach((l, k) => { l.shadow.intensity = savedI[k]; });
  out.casters = casters.map((l) => ({ name: l.name, type: l.type, intensity: l.intensity, shadowIntensity: l.shadow.intensity }));
  if (arenaRoot) { arenaRoot.visible = false; const P = render(); out.controls.POSITIVE_arenaHidden = diffN(A, P, 6) / (cw * ch); arenaRoot.visible = true; }

  // ---- LEVER PROBES (--probes): what do two existing knobs contribute to the value
  // structure? (a) the camera-axis FRONT FILL (`lighting.ts`: DirectionalLight 2.2 at 8 deg
  // elevation on the camera azimuth, castShadow false) and (b) the arena VALUE LIFT
  // (`shared.ts` liftArenaValue, V' = V^0.72 on mat.color), inverted exactly: V = V'^(1/0.72),
  // same uniform channel scale. A probe prices a lever; it does not say the viewer reacts.
  if (window.__gxProbes) {
    const front = []; scene.traverse((o) => { if (o.isDirectionalLight && !o.castShadow && o.position.z > 30) front.push(o); });
    out.probeFront = front.map((l) => ({ intensity: l.intensity, pos: l.position.toArray().map((v) => +v.toFixed(2)) }));
    const fI = front.map((l) => l.intensity);
    front.forEach((l) => { l.intensity = 0; });
    out.nofront = url(render());
    const seen = new Set(); const savedC = []; const tmp = { r: 0, g: 0, b: 0 };
    if (arenaRoot) arenaRoot.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isSprite)) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m || !m.color || seen.has(m.uuid)) continue;
        seen.add(m.uuid);
        savedC.push({ m, r: m.color.r, g: m.color.g, b: m.color.b });
        m.color.getRGB(tmp, 'srgb');
        const v = Math.max(tmp.r, tmp.g, tmp.b);
        if (v <= 0.02) continue;
        const k = Math.pow(v, 1 / 0.72) / v;
        m.color.setRGB(tmp.r * k, tmp.g * k, tmp.b * k, 'srgb');
      }
    });
    out.probeUnliftMaterials = savedC.length;
    out.nofront_unlift = url(render());
    front.forEach((l, k) => { l.intensity = fI[k]; });
    out.unlift = url(render());
    // (d) shadow depth at the reference's ratio: shadow.intensity 0.7 (a uniform, no recompile);
    // (e) the combined re-key — front fill 0 + shadow 0.7 + lift inverted — as a VISUAL target.
    const sI = casters.map((l) => l.shadow.intensity);
    casters.forEach((l) => { l.shadow.intensity = 0.7; });
    front.forEach((l) => { l.intensity = 0; });
    out.combo = url(render());
    front.forEach((l, k) => { l.intensity = fI[k]; });
    for (const s of savedC) { s.m.color.r = s.r; s.m.color.g = s.g; s.m.color.b = s.b; }
    out.shadow70 = url(render());
    casters.forEach((l, k) => { l.shadow.intensity = sI[k]; });
    // (c) the match camera at 48 deg, FAIR framing re-solved by the rig itself (apply() ->
    // computeDistance() -> fairSolveAt at the new pitch) — the pitch the reference box faces
    // imply (top/front 1.10-1.17 on two plates' cube blocks). Restored, and RESTORE must
    // still read 0.
    const rig = stage.rig; const p0 = rig.pitchDeg;
    rig.pitchDeg = 48; rig.apply();
    out.pitch48 = url(render());
    out.pitch48cam = { position: cam.position.toArray().map((v) => +v.toFixed(3)) };
    rig.pitchDeg = p0; rig.apply();
  }

  // ---- per-mesh ID pass (post bypassed, tone mapping off) — matcover's encoding
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
  out.renderables = entries.length;
  if (!basicProto) return { ...out, error: 'no MeshBasicMaterial prototype' };
  const meshes = [];
  const saved = [];
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
    id++;
    rec.id = id;
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
  out.id = url(snap());
  // ---- OPAQUE-ONLY id pass: translucent overlays (decals, glows, smoke) hidden, so the base
  // surface under them is recoverable. A translucent quad made opaque in the pass above
  // claims the whole quad, which is coverage, not what the viewer reads as the surface.
  const hidT = [];
  for (const s of saved) {
    const rec = meshes[saved.indexOf(s)];
    if (rec && rec.id && (rec.transparent || rec.blending !== 1)) { if (s.o.visible) { s.o.visible = false; hidT.push(s.o); } }
  }
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  out.idopaque = url(snap());
  for (const o of hidT) o.visible = true;
  // ---- normal pass: MeshNormalMaterial via the page's OWN three module (same URL => same instance)
  try {
    const threeUrl = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/deps\/three(\.module)?\.js/.test(n))
      || performance.getEntriesByType('resource').map((r) => r.name).find((n) => /three/.test(n) && /\.js/.test(n));
    out.threeUrl = threeUrl || null;
    if (threeUrl) {
      const THREE = await import(threeUrl);
      const nm = new THREE.MeshNormalMaterial();
      // hide non-meshes and VFX for this pass; normals are only read on arena + fighters
      const hide = [];
      for (const e of entries) if (e.o.visible && (!e.o.isMesh || tops[e.top]?.role === 'vfx')) { hide.push(e.o); e.o.visible = false; }
      scene.overrideMaterial = nm;
      renderer.clear(true, true, true);
      renderer.render(scene, cam);
      out.normal = url(snap());
      scene.overrideMaterial = null;
      for (const o of hide) o.visible = true;
      nm.dispose();
    }
  } catch (err) { out.normalError = String(err).slice(0, 200); }
  // ---- restore
  for (const s of saved) {
    if (s.o.material !== s.mat) { const mm = s.o.material; s.o.material = s.mat; if (mm && mm !== s.mat) mm.dispose(); }
    s.o.visible = s.vis;
    if (s.ic) s.o.instanceColor = s.ic;
  }
  renderer.toneMapping = savedTone; scene.background = savedBg; scene.fog = savedFog;
  const R = render();
  out.controls.RESTORE = diffN(A, R, 1);
  out.meshes = meshes;
  out.idCount = id;
  out.camera = { fov: cam.fov, aspect: cam.aspect, near: cam.near, far: cam.far,
    position: cam.position.toArray().map((v) => +v.toFixed(4)), quaternion: cam.quaternion.toArray().map((v) => +v.toFixed(6)),
    pitchDeg: stage.rig.pitchDeg, matrixWorld: cam.matrixWorld.elements.map((v) => +v.toFixed(6)) };
  return out;
};

const READ = () => {
  const qa = window.__vfxQaCounts ? Object.values(window.__vfxQaCounts).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0) : 0;
  const scr = window.__vfxDebugScreen ?? null;
  const f = window.__vfxDebugFighters ?? null;
  const go = document.querySelector('[data-el="gameover"]');
  return { qa, slots: scr?.slots ?? null, fs: f?.slots ?? null, ended: !!go && go.style.display === 'flex', dbg: window.__matchDebug ? { phase: window.__matchDebug.phase, viewSubject: window.__matchDebug.viewSubject } : null };
};

async function shootScene(browser, sc) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(480_000);
  page.on('pageerror', (e) => console.log(`   [${sc.id}] PAGEERROR ${String(e).slice(0, 200)}`));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  if (process.argv.includes('--probes')) await page.addInitScript(() => { window.__gxProbes = true; });
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; let base = realNow();
    window.__clk = {
      pause() { if (!paused) { virt = realNow() - base; paused = true; } },
      resume() { if (paused) { base = realNow() - virt; paused = false; } },
      get paused() { return paused; },
    };
    performance.now = () => (paused ? virt : realNow() - base);
  });
  const q = new URLSearchParams({ pointerLock: '0', simSpeed: String(sc.simSpeed ?? 3), ...Object.fromEntries(Object.entries(sc.q).map(([k, v]) => [k, String(v)])) });
  const t0 = Date.now();
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 480_000 });
  await page.waitForFunction(() => window.__gameReady === true && !!window.__stage && !!window.__vfxLayer, null, { timeout: 480_000 });
  console.log(`   [${sc.id}] ready in ${((Date.now() - t0) / 1000).toFixed(1)}s  ${sc.note}`);
  const shots = [];
  const hist = [];
  let firing = false;
  let polls = 0;
  const tStart = Date.now();
  while (shots.length < PER_SCENE && Date.now() - tStart < SCENE_BUDGET_MS) {
    let r; try { r = await page.evaluate(READ); } catch (e) { console.log(`   [${sc.id}] read failed ${String(e).slice(0, 120)}`); break; }
    polls++;
    if (r.ended) { console.log(`   [${sc.id}] match ended`); break; }
    const now = Date.now();
    hist.push({ t: now, qa: r.qa }); while (hist.length > 1 && now - hist[0].t > 1500) hist.shift();
    const vfxDelta = r.qa - hist[0].qa;
    const on = (s) => s && s.x > 60 && s.x < W - 60 && s.y > 110 && s.y < H - 110;
    const alive = (i) => r.fs && r.fs[i] && r.fs[i].alive;
    const onIdx = (r.slots ?? []).map((s, i) => (on(s) && alive(i) ? i : -1)).filter((i) => i >= 0);
    // aim at the nearest on-screen opponent and hold fire (slot 0 is the local seat)
    const me = r.slots?.[0];
    let tgt = null, best = 1e9;
    // ⚠️ A dead local seat projects to null (spectator camera follows its killer); the first
    // run dereferenced it and lost S1. Six-seat frames stay capturable after a local death.
    for (const i of onIdx) { if (i === 0 || !me) continue; const s = r.slots[i]; const d = Math.hypot(s.x - me.x, s.y - me.y); if (d < best) { best = d; tgt = s; } }
    if (tgt) { await page.mouse.move(Math.max(2, Math.min(W - 2, tgt.x)), Math.max(2, Math.min(H - 2, tgt.y))).catch(() => {}); if (!firing) { await page.mouse.down().catch(() => {}); firing = true; } }
    let eligible = false;
    if (sc.kind === 'duel') {
      eligible = onIdx.includes(0) && onIdx.includes(1) && best >= 40 && best <= 260 && vfxDelta > 0;
    } else {
      eligible = onIdx.length >= 3 && vfxDelta > 0;
    }
    if (eligible && Date.now() - tStart > 1500) {
      const tag = `${sc.id}_${shots.length}`;
      await page.evaluate(() => window.__clk.pause());
      await page.waitForTimeout(250);
      const stillLeft = await page.evaluate(PAGE_STILL_HUD);
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(OUT, `${tag}.png`), clip: { x: 0, y: 0, width: W, height: H } });
      const res = await page.evaluate(PAGE_PASSES);
      const meta = { scene: sc, tag, polls, elapsedRealS: +((Date.now() - tStart) / 1000).toFixed(1), stillLeft,
        slots: r.slots, fighters: r.fs, vfxDelta, onScreen: onIdx, dbg: r.dbg };
      for (const k of ['canvas', 'novfx', 'nofighters', 'noshadow', 'id', 'idopaque', 'normal', 'nofront', 'unlift', 'nofront_unlift', 'pitch48', 'combo', 'shadow70']) {
        if (res[k]) { writeFileSync(join(OUT, `${tag}.${k}.png`), Buffer.from(res[k].split(',')[1], 'base64')); delete res[k]; }
      }
      writeFileSync(join(OUT, `${tag}.json`), JSON.stringify({ ...meta, ...res }, null, 1));
      const c = res.controls ?? {};
      const fighterOk = onIdx.length === 0 || (c.FIGHTER_ABL_px ?? 0) > 100;
      console.log(`   [${sc.id}] shot ${tag}: onScreen ${onIdx.length} vfxΔ ${vfxDelta} | NULL ${c.NULL} RESTORE ${c.RESTORE} POS ${(c.POSITIVE_arenaHidden ?? 0).toFixed(3)} FIGHTER_ABL ${c.FIGHTER_ABL_px}px ${fighterOk ? 'ok' : 'VACUOUS'} roots ${(res.fighterRoots ?? []).length} ids ${res.idCount}/${res.renderables} still ${stillLeft} ${res.error ?? ''} ${res.normalError ?? ''}`);
      shots.push(tag);
      await page.evaluate(PAGE_UNSTILL_HUD);
      await page.evaluate(() => window.__clk.resume());
      await page.waitForTimeout(sc.kind === 'duel' ? 2500 : 3500);
    } else {
      await page.waitForTimeout(120);
    }
  }
  if (firing) await page.mouse.up().catch(() => {});
  if (!shots.length) console.log(`   [${sc.id}] NO eligible moment within ${SCENE_BUDGET_MS / 1000}s (${polls} polls)`);
  await page.close();
  return shots;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const all = {};
  try {
    // warm the snapshot: the first client eats a dep-optimisation reload (AGENT-BRIEF §3)
    const warm = await browser.newPage(); await warm.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle' }).catch(() => {}); await warm.waitForTimeout(3000); await warm.close();
    for (const sc of SCENES) {
      if (ONLY && !ONLY.split(',').includes(sc.id)) continue;
      console.log(`── ${sc.id} (${sc.kind})`);
      try { all[sc.id] = await shootScene(browser, sc); } catch (e) { console.log(`   [${sc.id}] FAILED ${String(e).slice(0, 300)}`); all[sc.id] = []; }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(all, null, 1));
  console.log('done', JSON.stringify(all));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
