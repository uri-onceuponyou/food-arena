#!/usr/bin/env node
/**
 * V1B_DRAWS — what the persistent ground-mark stain costs in DRAW CALLS, at 2 and 6 seats.
 * (Graphics campaign V1b; `src/vfx/groundMarks.ts`. The phone tier has no draw headroom at six
 * seats — docs/REVAMP.md §2.8 — and V1's whole point was "one draw whatever the pile's size".)
 *
 * One frozen instant (virtual clock, frame-stepped like `gx_vfx_cap.mjs`), rendered twice:
 *   on    as shipped                       -> GL draw calls A, canvas pixels P
 *   off   every `vfx_ground_mark` hidden   -> GL draw calls B, canvas pixels Q
 * The stain's cost is A − B and it must be EXACTLY 1. The stain must also DRAW: P and Q must
 * differ on > MIN_PX pixels — a draw call does not prove a picture (a back-face-culled quad still
 * issues its draw; V1 shipped one build that "drew NOTHING with every count correct").
 *
 * Known-bad arm (run every time): the same instant with the stain material forced to
 * `THREE.DoubleSide` AND `forceSinglePass = false`. three renders a transparent DoubleSide
 * material in TWO passes (back, then front — `WebGLRenderer.renderObject`), so the arm must read
 * A − B = 2. If it reads 1 the counter cannot see a second draw and its PASS above means nothing.
 * ⚠️ The first version of this arm set DoubleSide ALONE and read 1 — on the shipped stain AND on
 * V1's — because `ShaderMaterial` defaults `forceSinglePass = true` (three r180): a known-bad
 * planted where the bug cannot express itself (CLAUDE.md rule 6). Found by logging every
 * `renderBufferDirect` the stain mesh received.
 *
 * Draws are counted at the GL level by wrapping every draw entry point on both context
 * prototypes, armed only around the two renders (no other render runs in between: the game's
 * own rAF is held by the pump).
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/v1b_draws.mjs --url '{URL}' \
 *     [--seats 2|6] [--out <json>]
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]; if (!a.startsWith('--')) continue;
  const nx = process.argv[i + 1]; if (nx === undefined || nx.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = nx; i++; }
}
const BASE = args.url ?? process.env.PREVIEW_BASE;
if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
const SEATS = Number(args.seats ?? 6);
const OUT = args.out ?? null;
const MIN_PX = 500;
const W = 1280, H = 720, STEP_MS = 1000 / 30;
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;
// Two Donuts at six seats, so two owners' trails share the one batch.
const SIX = 'donut@1530,1000;taco@1575,922;hamburger@1665,922;lollipop@1710,1000;donut@1665,1078;sushi@1575,1078';

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(240_000);
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance); const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow(); let manual = false; let virt = 0; const q = [];
    window.__clk = { manual() { if (!manual) { virt = realNow() - base; manual = true; } }, qlen: () => q.length,
      pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } } } } };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
    // GL draw counter, armed by window.__drawsOn.
    window.__draws = 0; window.__drawsOn = false;
    for (const P of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
      if (!P) continue;
      for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
        const o = P[fn]; if (typeof o !== 'function') continue;
        P[fn] = function (...a) { if (window.__drawsOn) window.__draws++; return o.apply(this, a); };
      }
    }
  });
  const q = SEATS >= 3
    ? `screen=match&pointerLock=0&fogRadius=1700&fighters=${encodeURIComponent(SIX)}`
    : 'screen=match&pointerLock=0&player=donut&enemy=taco&px=1560&py=1000';
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.evaluate(() => {
    window.__clk.manual();
    const layer = window.__vfxLayer; const orig = layer.sync.bind(layer);
    layer.sync = (s) => { window.__st = s; return orig(s); };
    const st = window.__stage; window.__realRender = st.render.bind(st);
    st.render = (dt) => st.rig.update(dt);
  });
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  for (let i = 0; i < 400; i++) {
    const ph = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
    if (ph === 'playing') break;
  }
  // Lay track: the local Donut walks a slow L for ~3 s (the AI Donut at six seats lays its own).
  for (const [key, frames] of [['KeyD', 45], ['KeyS', 45]]) {
    await page.keyboard.down(key);
    for (let f = 0; f < frames; f++) await page.evaluate((ms) => window.__clk.pump(1, ms), STEP_MS);
    await page.keyboard.up(key);
  }
  await page.evaluate((ms) => window.__clk.pump(3, ms), STEP_MS);

  const shot = await page.evaluate(() => {
    const stage = window.__stage; const rig = stage.rig;
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
    const marks = []; stage.scene.traverse((o) => { if (o.name === 'vfx_ground_mark') marks.push(o); });
    const grab = () => { const cv = document.createElement('canvas'); cv.width = stage.canvas.width; cv.height = stage.canvas.height; const c = cv.getContext('2d'); c.drawImage(stage.canvas, 0, 0); return c.getImageData(0, 0, cv.width, cv.height).data; };
    const count = () => { window.__draws = 0; window.__drawsOn = true; window.__realRender(0); window.__drawsOn = false; return window.__draws; };
    const render = (visibleMarks) => {
      const was = marks.map((m) => m.visible);
      if (!visibleMarks) for (const m of marks) m.visible = false;
      const draws = count();
      const px = grab();
      marks.forEach((m, i) => { m.visible = was[i]; });
      return { draws, px };
    };
    const diffPx = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) n++; return n; };
    // Warm both states once so a first-use program compile is not counted as a draw difference.
    render(true); render(false);
    const on = render(true); const off = render(false);
    const res = { marks: marks.length, visibleMarks: marks.filter((m) => m.visible).length,
      trailMarks: window.__st.trailMarks.length, splats: window.__st.splats.length,
      tiles: window.__vfxLayer?.groundMarks?.tileCount ?? null,
      on: on.draws, off: off.draws, delta: on.draws - off.draws, movedPx: diffPx(on.px, off.px) };
    // KNOWN-BAD: DoubleSide on a transparent material that is NOT single-pass = two passes.
    const mats = marks.map((m) => m.material);
    const saved = mats.map((m) => [m.side, m.forceSinglePass]);
    for (const m of mats) { m.side = 2; m.forceSinglePass = false; m.needsUpdate = true; }
    render(true); render(false);
    const kbOn = render(true); const kbOff = render(false);
    mats.forEach((m, i) => { m.side = saved[i][0]; m.forceSinglePass = saved[i][1]; m.needsUpdate = true; });
    res.knownBad = { side: 'DoubleSide', forceSinglePass: false, on: kbOn.draws, off: kbOff.draws, delta: kbOn.draws - kbOff.draws, movedPx: diffPx(kbOn.px, kbOff.px) };
    return res;
  });
  await browser.close();
  const fails = [];
  if (shot.marks < 1) fails.push('no vfx_ground_mark mesh in the scene — nothing measured');
  if (shot.trailMarks + shot.splats < 1) fails.push('no live trail marks or splats — nothing to draw, the frame proves nothing');
  if (shot.delta !== 1) fails.push(`the stain costs ${shot.delta} draws (want exactly 1)`);
  if (shot.movedPx <= MIN_PX) fails.push(`the stain moved ${shot.movedPx} px (want > ${MIN_PX}) — a draw that draws nothing`);
  if (shot.knownBad.delta !== 2) fails.push(`KNOWN-BAD arm read ${shot.knownBad.delta} draws for a transparent two-pass DoubleSide stain (want 2) — the counter cannot see a second pass`);
  const report = { seats: SEATS, ...shot, pass: fails.length === 0, fails };
  console.log(JSON.stringify(report, null, 1));
  if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));
  console.log(fails.length ? `FAIL: ${fails.join('; ')}` : 'PASS — one draw, and it draws');
  process.exitCode = fails.length ? 1 : 0;
}
await main().catch((e) => { console.error(e); process.exitCode = 1; });
