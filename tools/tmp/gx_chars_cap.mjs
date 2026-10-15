#!/usr/bin/env node
/**
 * GX_CHARS_CAP — capture set for the CHARACTERS visual audit (review phase, 2026-10-15).
 *
 * READ-ONLY on the tree: it renders and writes PNG/JSON under `shots/rv/audit/chars/`
 * (gitignored) and nothing else. Run it through a frozen snapshot of a detached worktree:
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_chars_cap.mjs --url '{URL}' --set preview,match6
 *
 * Sets (comma list):
 *   preview  roster (colour + silhouette) at the harness pitch 14, then the SAME page re-aimed
 *            at pitch 58 / 20 (match-scale lineup), and per character: lobby pitch 20,
 *            a 3/4 yaw at pitch 20, and a close-up at pitch 58 (diagnose up close at the
 *            match pitch).
 *   match6   six seats via `?fighters=id@x,y;…` clustered so all six are in one match frame.
 *            Per frame: the shipped canvas (post chain), an EXACT cast matte (two-clear-colour
 *            trick borrowed from `valuescan`/`arena-scan`), per-fighter bboxes, and a page
 *            screenshot (HUD included).
 *   home     the home screen for --home-ids, by seeding the profile's `selected`.
 *
 * Every capture is one synchronous `page.evaluate` that renders and reads back, so the
 * app's own rAF loop cannot interleave, and the camera shake is zeroed first
 * (`docs/AGENT-BRIEF.md` §3: a frozen frame is not a frozen camera).
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = arg('out', 'shots/rv/audit/chars/cap');
const SETS = String(arg('set', 'preview')).split(',');
const IDS = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop',
  'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog'];
const ONLY = arg('ids', null);
const CHAR_IDS = ONLY ? ONLY.split(',') : IDS;

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const log = (...a) => console.log('[gx_chars_cap]', ...a);

/** In-page: re-aim the preview rig, render twice, report what was framed. */
const REAIM = (o) => {
  const s = window.__stage;
  if (!s) return { error: 'no __stage' };
  const rig = s.rig;
  if (o.pitch != null) rig.pitchDeg = o.pitch;
  if (o.yaw != null) rig.yawDeg = o.yaw;
  if (o.fill != null) rig.subjectFill = o.fill;
  if (o.subjectHeight != null) rig.subjectHeight = o.subjectHeight;
  if (o.targetHeight != null) rig.targetHeight = o.targetHeight;
  try { rig.shakeAmount = 0; rig.shakeOffset?.set?.(0, 0, 0); } catch { /* private */ }
  rig.snapTo(0, 0);
  s.render(0); s.render(0);
  return { pitch: rig.pitchDeg, yaw: rig.yawDeg, fill: rig.subjectFill, fov: rig.camera.fov };
};

async function previewSet(browser) {
  const dir = join(OUT, 'preview');
  await mkdir(dir, { recursive: true });
  const manifest = [];

  const shot = async (page, name) => {
    const p = join(dir, `${name}.png`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: p });
    manifest.push(p);
    log('wrote', p);
  };

  // ── ROSTER ─────────────────────────────────────────────────────────────────
  for (const sil of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1800, height: 700 }, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/preview.html?piece=roster&shot=1&t=1.5${sil ? '&silhouette=1' : ''}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
    await shot(page, `roster_p14${sil ? '_sil' : ''}`);
    // Same page, same models, re-aimed to the match pitch at ~match scale (the roster's own
    // subject framing puts a 2.1 m fighter at ~95-110 px of 900 — see the report).
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.evaluate(() => window.__stage?.resize?.());
    const aspect = 1600 / 900;
    const span = (IDS.length - 1) * 2.6 + 3.4;
    const r58 = await page.evaluate(REAIM, { pitch: 58, subjectHeight: span / aspect, fill: 0.95 });
    await shot(page, `roster_p58${sil ? '_sil' : ''}`);
    const r20 = await page.evaluate(REAIM, { pitch: 20 });
    await shot(page, `roster_p20${sil ? '_sil' : ''}`);
    log('reaim', JSON.stringify({ r58, r20 }));
    await page.close();
  }

  // ── PER CHARACTER ──────────────────────────────────────────────────────────
  for (const id of CHAR_IDS) {
    const page = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1&pitch=20&fill=0.6`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
    await page.evaluate(REAIM, { pitch: 20, yaw: 0, fill: 0.6 });
    await shot(page, `${id}_lobby20`);
    await page.evaluate(REAIM, { pitch: 20, yaw: 35, fill: 0.6 });
    await shot(page, `${id}_lobby20_yaw35`);
    await page.evaluate(REAIM, { pitch: 58, yaw: 0, fill: 0.6 });
    await shot(page, `${id}_close58`);
    await page.evaluate(REAIM, { pitch: 58, yaw: 90, fill: 0.6 });
    await shot(page, `${id}_close58_yaw90`);
    const info = await page.evaluate(() => window.__preview?.info?.());
    manifest.push({ id, info, errors });
    await page.close();
  }
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

/**
 * In-page six-seat capture: shipped frame + exact cast matte + per-cast bbox.
 * Everything inside ONE synchronous evaluate.
 */
const MATCH_CAPTURE = () => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig?.camera;
  const gl = r.getContext();
  const W = r.domElement.width, H = r.domElement.height;
  const rig = stage.rig;
  try { rig.shakeAmount = 0; rig.shakeOffset?.set?.(0, 0, 0); } catch { /* */ }

  const readAll = () => {
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4;
      for (let x = 0; x < W; x++) {
        const i = src + x * 4, j = (y * W + x) * 3;
        out[j] = buf[i]; out[j + 1] = buf[i + 1]; out[j + 2] = buf[i + 2];
      }
    }
    return out;
  };
  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  if (!casts.length) return { error: 'no character:* roots' };

  stage.render(0); stage.render(0);
  const shipped = readAll();

  // Matte: hide every mesh that is NOT under a character root, render on black and on
  // white, keep pixels identical in both. Colour-independent by construction.
  const under = new Set();
  for (const c of casts) c.traverse((o) => under.add(o));
  const hidden = [];
  scene.traverse((o) => {
    if (under.has(o)) return;
    if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible) { hidden.push(o); o.visible = false; }
  });
  const savedBg = scene.background, savedShadow = r.shadowMap.enabled, savedAuto = r.autoClear;
  // A THREE.Color constructor without importing three: borrow one off any material.
  let ColorCtor = null;
  scene.traverse((o) => { if (!ColorCtor && o.material && o.material.color) ColorCtor = o.material.color.constructor; });
  const savedClear = ColorCtor ? r.getClearColor(new ColorCtor()) : null;
  const savedClearAlpha = r.getClearAlpha();
  const direct = (hex) => {
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
    r.setRenderTarget(null); r.setClearColor(hex, 1); r.clear(true, true, true); r.render(scene, cam);
    return readAll();
  };
  const per = [];
  let all;
  try {
    const A = direct(0x000000), B = direct(0xffffff);
    all = new Uint8Array(W * H);
    for (let j = 0; j < W * H; j++) {
      const d = Math.max(Math.abs(A[j * 3] - B[j * 3]), Math.abs(A[j * 3 + 1] - B[j * 3 + 1]), Math.abs(A[j * 3 + 2] - B[j * 3 + 2]));
      all[j] = d < 32 ? 1 : 0;
    }
    // per cast: hide the others too
    for (const c of casts) {
      const off = [];
      for (const o of casts) if (o !== c && o.visible) { off.push(o); o.visible = false; }
      const A2 = direct(0x000000), B2 = direct(0xffffff);
      for (const o of off) o.visible = true;
      let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let j = 0; j < W * H; j++) {
        const d = Math.max(Math.abs(A2[j * 3] - B2[j * 3]), Math.abs(A2[j * 3 + 1] - B2[j * 3 + 1]), Math.abs(A2[j * 3 + 2] - B2[j * 3 + 2]));
        if (d >= 32) continue;
        n++; const x = j % W, y = (j / W) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      per.push({ name: c.name, visible: c.visible, px: n, bbox: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null,
        rotY: +((c.rotation.y * 180) / Math.PI).toFixed(1) });
    }
  } finally {
    for (const o of hidden) o.visible = true;
    scene.background = savedBg; r.shadowMap.enabled = savedShadow; r.autoClear = savedAuto;
    if (savedClear) r.setClearColor(savedClear, savedClearAlpha);
    stage.render(0);
  }
  return {
    W, H,
    shipped: Array.from(shipped),
    matte: Array.from(all),
    casts: per,
    phase: window.__matchDebug?.phase, frames: window.__matchDebug?.frames,
    slots: window.__vfxDebugScreen?.slots ?? null,
  };
};

async function writeFrame(dir, tag, cap) {
  const { W, H } = cap;
  const rgb = Buffer.from(cap.shipped);
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toFile(join(dir, `${tag}_canvas.png`));
  const m = Buffer.alloc(W * H);
  for (let j = 0; j < W * H; j++) m[j] = cap.matte[j] ? 255 : 0;
  await sharp(m, { raw: { width: W, height: H, channels: 1 } }).png().toFile(join(dir, `${tag}_matte.png`));
  // cast-only composite on mid grey so the matte can be LOOKED at
  const comp = Buffer.alloc(W * H * 3);
  for (let j = 0; j < W * H; j++) {
    if (cap.matte[j]) { comp[j * 3] = rgb[j * 3]; comp[j * 3 + 1] = rgb[j * 3 + 1]; comp[j * 3 + 2] = rgb[j * 3 + 2]; }
    else { comp[j * 3] = 128; comp[j * 3 + 1] = 128; comp[j * 3 + 2] = 128; }
  }
  await sharp(comp, { raw: { width: W, height: H, channels: 3 } }).png().toFile(join(dir, `${tag}_castonly.png`));
  // per-fighter 4x crops from the shipped frame
  for (const c of cap.casts) {
    if (!c.bbox) continue;
    const [x, y, w, h] = c.bbox;
    const pad = Math.round(Math.max(w, h) * 0.35);
    const left = Math.max(0, x - pad), top = Math.max(0, y - pad);
    const cw = Math.min(W - left, w + 2 * pad), ch = Math.min(H - top, h + 2 * pad);
    await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
      .extract({ left, top, width: cw, height: ch })
      .resize(cw * 4, ch * 4, { kernel: 'nearest' })
      .png().toFile(join(dir, `${tag}_crop_${c.name.replace('character:', '')}.png`));
  }
  const meta = { W, H, phase: cap.phase, frames: cap.frames, casts: cap.casts, slots: cap.slots };
  await writeFile(join(dir, `${tag}.json`), JSON.stringify(meta, null, 2));
  return meta;
}

async function match6Set(browser) {
  const dir = join(OUT, 'match6');
  await mkdir(dir, { recursive: true });
  // A clear patch SOUTH of the pot (pot r=95 at 1400,1000; fryer counter centred 1400,1330
  // h=70; stove islands centred 1080/1720,1240 w=170). Slot 0 at the centre — the camera
  // follows slot 0 — and five around it on an ellipse rx=150, ry=70.
  const C = { x: 1400, y: 1190 };
  const ring = [-90, -18, 54, 126, 198].map((a) => ({
    x: Math.round(C.x + 150 * Math.cos((a * Math.PI) / 180)),
    y: Math.round(C.y + 70 * Math.sin((a * Math.PI) / 180)),
  }));
  const groups = {
    A: ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop'],   // the shipped ?seats=6 roster for hamburger
    B: ['pizza', 'sushi', 'soup', 'waterbottle', 'hotdog', 'hamburger'],
  };
  const which = String(arg('groups', 'A,B')).split(',');
  for (const g of which) {
    const ids = groups[g];
    const spec = ids.map((id, i) => (i === 0 ? `${id}@${C.x},${C.y}` : `${id}@${ring[i - 1].x},${ring[i - 1].y}`)).join(';');
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const url = `${BASE}/?fighters=${encodeURIComponent(spec)}&pointerLock=0`;
    log('goto', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240_000 });
    await page.waitForTimeout(1500);
    const shots = [];
    const grab = async (tag) => {
      await page.screenshot({ path: join(dir, `${g}_${tag}_page.png`) });
      const cap = await page.evaluate(MATCH_CAPTURE);
      if (cap.error) { log('capture error', cap.error); return; }
      const meta = await writeFrame(dir, `${g}_${tag}`, cap);
      shots.push({ tag, phase: meta.phase, frames: meta.frames, casts: meta.casts.map((c) => [c.name, c.px, c.bbox, c.rotY]) });
      log(g, tag, meta.phase, JSON.stringify(meta.casts.map((c) => [c.name.replace('character:', ''), c.px])));
    };
    await grab('t0');
    // wait into the fight
    await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 240_000 }).catch(() => {});
    const f0 = await page.evaluate(() => window.__matchDebug?.frames ?? 0);
    await page.waitForFunction((f) => (window.__matchDebug?.frames ?? 0) > f + 25, f0, { timeout: 240_000 }).catch(() => {});
    await grab('t1');
    const f1 = await page.evaluate(() => window.__matchDebug?.frames ?? 0);
    await page.waitForFunction((f) => (window.__matchDebug?.frames ?? 0) > f + 25, f1, { timeout: 240_000 }).catch(() => {});
    await grab('t2');
    await writeFile(join(dir, `${g}_shots.json`), JSON.stringify({ url, spec, shots, errors }, null, 2));
    await page.close();
  }
}

/**
 * The canonical 1v1 (`q1_capture.mjs`'s matchup and DERIVED anchor: centre + 1.684 x pot
 * radius, read from `tools/arena.gameplay.json`, never retyped). The local seat idles; the
 * bot walks in and fights, so frames are taken once both are on screen.
 */
async function match2Set(browser) {
  const dir = join(OUT, 'match2');
  await mkdir(dir, { recursive: true });
  const { readFile } = await import('node:fs/promises');
  const A = JSON.parse(await readFile('tools/arena.gameplay.json', 'utf8'));
  const pot = (A.hazards ?? []).find((h) => h.kind === 'damage');
  const anchor = { x: Math.round(A.center.x + pot.radius * 1.684), y: Math.round(A.center.y) };
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const url = `${BASE}/?pointerLock=0&player=donut&enemy=taco&px=${anchor.x}&py=${anchor.y}`;
  log('goto', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240_000 });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 240_000 }).catch(() => {});
  const shots = [];
  const onScreen = (s) => s && s.x > 60 && s.x < 1540 && s.y > 60 && s.y < 840;
  const t0 = Date.now();
  while (shots.length < 3 && Date.now() - t0 < 300_000) {
    const scr = await page.evaluate(() => window.__vfxDebugScreen ?? null);
    if (scr && onScreen(scr.player) && onScreen(scr.enemy)) {
      const tag = `f${shots.length}`;
      await page.screenshot({ path: join(dir, `${tag}_page.png`) });
      const cap = await page.evaluate(MATCH_CAPTURE);
      if (!cap.error) {
        const meta = await writeFrame(dir, tag, cap);
        shots.push({ tag, casts: meta.casts.map((c) => [c.name, c.px, c.bbox, c.rotY]) });
        log('1v1', tag, JSON.stringify(meta.casts.map((c) => [c.name.replace('character:', ''), c.px, c.rotY])));
      }
      const f = await page.evaluate(() => window.__matchDebug?.frames ?? 0);
      await page.waitForFunction((n) => (window.__matchDebug?.frames ?? 0) > n + 20, f, { timeout: 120_000 }).catch(() => {});
    } else {
      await page.waitForTimeout(400);
    }
  }
  await writeFile(join(dir, 'shots.json'), JSON.stringify({ url, anchor, shots }, null, 2));
  await page.close();
}

async function homeSet(browser) {
  const dir = join(OUT, 'home');
  await mkdir(dir, { recursive: true });
  const ids = String(arg('home-ids', 'donut,egg,lollipop,sushi,waterbottle')).split(',');
  for (const id of ids) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((sel) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify({ name: 'Chef', wins: 0, losses: 0, xp: 0, selected: sel })); } catch { /* */ }
    }, id);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const p = join(dir, `home_${id}.png`);
    await page.screenshot({ path: p });
    log('wrote', p);
    await ctx.close();
  }
}

async function main() {
  if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    // warm the fresh snapshot (first client eats Vite's dep-optimisation reload)
    const warm = await browser.newPage();
    await warm.goto(`${BASE}/preview.html?piece=character&id=egg&t=0.5&shot=1`, { waitUntil: 'networkidle', timeout: 180_000 }).catch(() => {});
    await warm.waitForTimeout(3000);
    await warm.close();
    if (SETS.includes('preview')) await previewSet(browser);
    if (SETS.includes('match6')) await match6Set(browser);
    if (SETS.includes('match2')) await match2Set(browser);
    if (SETS.includes('home')) await homeSet(browser);
  } finally {
    await browser.close();
  }
}

if (IS_MAIN) await main();
