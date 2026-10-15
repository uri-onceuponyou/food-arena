#!/usr/bin/env node
/**
 * GX_ARENA_SHOTS — the arena audit's own captures, for the frames `arena-scan` and `x4_shot`
 * do not take: a whole-map OVERVIEW at both a plan pitch and the match pitch, the LOBBY-shallow
 * pitch (20°) up close on prop clusters ("diagnose up close", CLAUDE.md rule 3), and SIX-SEAT
 * match frames — one natural `?seats=6` match and one clustered `?fighters=` brawl, so combat
 * VFX is actually on screen over the arena.
 *
 * Read-only audit tool (2026-10-15 review campaign). Prints paths, never verdicts — LOOK at them.
 *
 * Traps it is built around (docs/AGENT-BRIEF.md §3):
 *   * performance.now is VIRTUAL (THREE.Clock reads it), so the sim advances only when told;
 *   * camera shake re-randomises on every render() — zeroed before every capture;
 *   * the overview keeps `frameMode: 'fair'` (the match post chain keys on it) and widens
 *     `fairRadiusUnits` instead, with the match loop PAUSED (rAF held) so it cannot re-target;
 *   * the HUD is hidden with `visibility` (not display) on `.hud-root, #screens`, as arena-scan does.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_arena_shots.mjs --url '{URL}' --out shots/rv/audit/arena/gx [--only overview,lobby,six,cluster]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
if (!BASE) { console.error('gx_arena_shots: --url (or PREVIEW_BASE) required — never :5173'); process.exit(2); }
const OUT = resolve(ROOT, String(arg('--out', 'shots/rv/audit/arena/gx')));
const ONLY = (arg('--only', 'overview,lobby,six,cluster')).split(',');
const W = 1600, H = 900;
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

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
    window.requestAnimationFrame = (cb) => rafOrig((t) => {
      if (window.__rafPause) window.__rafHeld.push(cb); else cb(t);
    });
  });
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
  return { page, errors };
}

/** Advance the virtual clock `ms` in 16.667 ms frames, one real rAF per frame. */
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

async function hud(page, visible) {
  await page.evaluate((v) => {
    for (const e of document.querySelectorAll('.hud-root, #screens')) e.style.visibility = v ? '' : 'hidden';
  }, visible);
  await page.waitForTimeout(120);
}

/**
 * Re-aim the MATCH rig (frameMode stays 'fair') and draw one frame with shake zeroed.
 *
 * ⚠️ `noFog`: the match ships `THREE.Fog(0xffcf8a, near 40 m, far 130 m)` and a 300 m far
 * plane (`camera.ts`). A whole-map camera sits 150–320 m out, so the first overview run came
 * back as a flat fog-coloured frame (plan view: camera 323.7 m up, past the far plane) and an
 * embossed-yellow ghost (p58). Both are rule-4 "rendering and invisible", not an empty map.
 * The overview therefore drops the fog and extends the far plane — a DECLARED deviation from
 * the shipped look, used only to read LAYOUT and per-prop colour at map scale.
 */
async function aim(page, { x, y, pitch, radius, shadowM, noFog = false }) {
  return page.evaluate(({ x, y, pitch, radius, shadowM, noFog }) => {
    const st = window.__stage; const rig = st.rig;
    if (noFog) {
      st.scene.fog = null;
      rig.camera.far = 1500; rig.camera.updateProjectionMatrix();
    }
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
    if (pitch != null) rig.pitchDeg = pitch;
    if (radius != null) rig.fairRadiusUnits = radius;
    if (x != null) rig.snapTo(x * 0.05, y * 0.05);
    rig.apply();
    if (shadowM != null && x != null) st.lighting.focus(x * 0.05, y * 0.05, shadowM);
    st.render(0);
    return { mode: rig.frameMode, pitch: rig.pitchDeg, R: rig.fairRadiusUnits, fog: !!st.scene.fog, cam: rig.camera.position.toArray().map((v) => +v.toFixed(2)) };
  }, { x, y, pitch, radius, shadowM, noFog });
}

async function shot(page, name, note) {
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p, animations: 'disabled' });
  console.log(`  ${name.padEnd(28)} ${p}${note ? `  — ${note}` : ''}`);
  return p;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH });
let bad = 0;
try {
  // ── 1. OVERVIEW — the whole 2800x2000 map, plan and match pitch, HUD hidden ────────────
  if (ONLY.includes('overview')) {
    console.log('\n[overview]');
    const { page, errors } = await openMatch(browser, 'screen=match&player=hamburger&enemy=donut&px=1400&py=600&simSpeed=0&pointerLock=0');
    await step(page, 400);
    await pause(page);
    await hud(page, false);
    const info = [];
    info.push(await aim(page, { x: 1400, y: 1000, pitch: 89, radius: 1060, shadowM: 95, noFog: true }));
    await shot(page, 'overview_plan89', 'whole map, plan view (fog off, far 1500 — declared)');
    info.push(await aim(page, { x: 1400, y: 1000, pitch: 58, radius: 1150, shadowM: 95, noFog: true }));
    await shot(page, 'overview_p58', 'whole map at the match pitch');
    info.push(await aim(page, { x: 1400, y: 1000, pitch: 58, radius: 520, shadowM: 45, noFog: true }));
    await shot(page, 'overview_hub_p58', 'hub district, 2x the match radius');
    info.push(await aim(page, { x: 600, y: 600, pitch: 58, radius: 520, shadowM: 45, noFog: true }));
    await shot(page, 'overview_nw_p58', 'NW quadrant district');
    console.log('  rig:', JSON.stringify(info));
    if (errors.length) { bad++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
    await page.close();
  }

  // ── 2. LOBBY PITCH — 20° up close on prop clusters (diagnose geometry) ──────────────────
  if (ONLY.includes('lobby')) {
    console.log('\n[lobby pitch 20]');
    const { page, errors } = await openMatch(browser, 'screen=match&player=hamburger&enemy=donut&px=1400&py=600&simSpeed=0&pointerLock=0');
    await step(page, 400);
    await pause(page);
    await hud(page, false);
    const P = [
      ['l20_hub_pot', 1400, 1140, 'pot + hazard ring from the south'],
      ['l20_stove_island', 1720, 1340, 'stove island SE of the hub'],
      ['l20_freezer_nw', 460, 420, 'NW freezer stack + rack'],
      ['l20_north_wall', 900, 300, 'north wall service line'],
      ['l20_pantry_ne', 2350, 560, 'NE pantry nook'],
      ['l20_conceal_rack', 1215, 540, 'a concealment rack (1215,420) from the south'],
      ['l20_puddle', 1950, 1230, 'grease puddle (1950,1100) from the south'],
      ['l20_apron_edge', 1400, 2060, 'south boundary / apron'],
    ];
    for (const [name, x, y, note] of P) {
      await aim(page, { x, y, pitch: 20, radius: 210, shadowM: 30 });
      await shot(page, name, note);
      await aim(page, { x, y, pitch: 58, radius: 210, shadowM: 30 });
      await shot(page, name.replace('l20_', 'c58_'), `${note} — same spot, match pitch, close`);
    }
    if (errors.length) { bad++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
    await page.close();
  }

  // ── 2b. LOBBY PITCH, ground framing — the 'lobby' block above came back BLANK at 20° ───
  // A 'fair' solve at a shallow pitch puts the horizon in frame (camera.ts guards `far` →
  // infinity), so the rig backs off past the 300 m far plane: rendering, and invisible
  // (rule 4). Here the rig switches to frameMode 'ground' with a fixed viewWidthUnits —
  // exactly preview.html's arena framing. The post chain/grade do not key on frameMode
  // (only letterboxing and character contact decals do), so prop pixels are comparable.
  if (ONLY.includes('lobby2')) {
    console.log('\n[lobby pitch 20, ground framing]');
    const { page, errors } = await openMatch(browser, 'screen=match&player=hamburger&enemy=donut&px=1400&py=600&simSpeed=0&pointerLock=0');
    await step(page, 400);
    await pause(page);
    await hud(page, false);
    const P = [
      ['l20_hub_pot', 1400, 1000, 'pot + hazard ring'],
      ['l20_stove_island', 1720, 1240, 'stove island + crate stack SE of the hub'],
      ['l20_freezer_nw', 420, 420, 'NW freezer stack + rack'],
      ['l20_north_wall', 850, 160, 'north wall service line'],
      ['l20_conceal_rack', 1215, 420, 'a concealment rack'],
      ['l20_puddle', 1950, 1100, 'grease puddle'],
      ['l20_apron_edge', 1400, 1950, 'south boundary / apron'],
    ];
    for (const [name, x, y, note] of P) {
      const r = await page.evaluate(({ x, y }) => {
        const st = window.__stage; const rig = st.rig;
        rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
        rig.frameMode = 'ground'; rig.viewWidthUnits = 340; rig.pitchDeg = 20;
        rig.snapTo(x * 0.05, y * 0.05); rig.apply();
        st.lighting.focus(x * 0.05, y * 0.05, 30);
        st.render(0);
        return rig.camera.position.toArray().map((v) => +v.toFixed(1));
      }, { x, y });
      await shot(page, name, `${note} — cam ${JSON.stringify(r)}`);
    }
    if (errors.length) { bad++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
    await page.close();
  }

  // ── 3. SIX SEATS, natural — the product path, camera on the local seat ──────────────────
  if (ONLY.includes('six')) {
    console.log('\n[six seats, natural]');
    const { page, errors } = await openMatch(browser, 'screen=match&player=hamburger&enemy=donut&seats=6&pointerLock=0');
    let t = 0;
    for (const at of [6000, 13000, 20000]) {
      await step(page, at - t); t = at;
      await page.evaluate(() => { const r = window.__stage.rig; r.shakeAmount = 0; r.shakeOffset.set(0, 0, 0); r.apply(); });
      await hud(page, true);
      await shot(page, `six_t${at / 1000}s`, 'as shipped, HUD on');
      await hud(page, false);
      await shot(page, `six_t${at / 1000}s_nohud`);
      await hud(page, true);
    }
    if (errors.length) { bad++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
    await page.close();
  }

  // ── 4. SIX SEATS, clustered brawl — VFX actually on screen over the arena ───────────────
  if (ONLY.includes('cluster')) {
    console.log('\n[six seats, clustered at (1700,1080) — positions checked against the dump]');
    const fighters = 'hamburger@1580,1080;donut@1820,1080;taco@1760,1162;pizza@1640,1162;egg@1640,998;sushi@1760,998';
    const { page, errors } = await openMatch(browser, `screen=match&player=hamburger&enemy=donut&fighters=${fighters}&pointerLock=0`);
    let t = 0;
    for (const at of [4600, 5800, 7200]) {
      await step(page, at - t); t = at;
      await page.evaluate(() => { const r = window.__stage.rig; r.shakeAmount = 0; r.shakeOffset.set(0, 0, 0); r.apply(); });
      await hud(page, true);
      await shot(page, `cluster_t${at}`, 'as shipped, HUD on');
      await hud(page, false);
      await shot(page, `cluster_t${at}_nohud`);
      await hud(page, true);
    }
    if (errors.length) { bad++; console.log('  JS:', errors.slice(0, 3).join(' | ')); }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${bad ? `${bad} page(s) logged JS errors` : 'no JS errors'} — NOW READ THE PNGs.`);
process.exitCode = bad ? 1 : 0;
