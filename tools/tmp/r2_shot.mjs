#!/usr/bin/env node
/**
 * r2_shot — capture N characters at BOTH shipped cameras in ONE browser session.
 *
 * THROWAWAY, READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `cr2_shot.mjs` is one character at one pitch per Chromium launch. Under
 * SwiftShader that is ~40 s of browser boot per frame, and this pass needs the
 * whole cast at BOTH cameras on BOTH arms of an A/B — 44 frames. One session
 * amortises the boot and, more importantly, makes the two pitches of one
 * character come from the SAME page state, so a difference between them cannot be
 * a difference between two launches.
 *
 * 🚨 **BOTH CAMERAS, ALWAYS.** `charStage.ts:451` ships the LOBBY at pitch 20 and
 * `render/camera.ts:265` the MATCH at 58. A limb through a torso is a 3D fact and
 * is wrong at both; the shallow view only makes it VISIBLE. A change that reads
 * right at 58 and wrong at 20 is not a fix (CLAUDE.md #3).
 *
 * ── THE PAINT GUARD, AND THE KNOWN-BAD THAT PROVES IT ────────────────────────
 * `window.__previewReady` is a FLAG and a flag is not a paint. The floor is
 * asserted on the DRAWING BUFFER via `gl.readPixels` — luma stdev > 0.02.
 *
 *   KNOWN-BAD: `--knownbad blank` CLEARS the drawing buffer before the floor is
 *   read. That is literally the "nothing was drawn" state the floor exists to
 *   catch, so the floor MUST reject it and this tool MUST exit 3. A guard that has
 *   not been shown to FAIL on the bug it guards against is not a guard.
 *
 * ⚠️ **AND THE GUARD'S COVERAGE IS NARROWER THAN IT LOOKS.** The first version of
 * this known-bad hid `rig_root` instead of clearing, and the frame PASSED at stdev
 * 0.1311 — a graded, vignetted backdrop is not flat, so a whole-frame stdev cannot
 * see a missing CHARACTER. `--knownbad nochar` runs that case and REPORTS it
 * without requiring a verdict, which is what `cr2_shot.mjs` already documented and
 * what this tool re-derived the expensive way. **The floor proves the renderer
 * drew; it does not prove the character is in the frame.** For that, read the PNG.
 *
 * ── USE ──────────────────────────────────────────────────────────────────────
 *   PREVIEW_BASE=http://localhost:5301 node tools/tmp/r2_shot.mjs \
 *     --ids sushi,hamburger --pitches 20,58 --out shots/r2/before
 *   node tools/tmp/r2_shot.mjs --url ... --ids all --knownbad blank
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ALL = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop',
  'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog'];
const IDS = (get('--ids', 'all') === 'all' ? ALL : get('--ids', '').split(',')).map((s) => s.trim()).filter(Boolean);
const PITCHES = get('--pitches', '20,58').split(',').map(Number);
const OUT = get('--out', 'shots/r2/out');
const KNOWNBAD = get('--knownbad', null);
const YAW = Number(get('--yaw', '0'));
const T = get('--t', '1.5');
const ANIM = get('--anim', 'idle');
/** Repaint these meshes magenta before the shot — ablation, per CLAUDE.md #4. */
const PAINT = get('--paint', '').split(',').map((s) => s.trim()).filter(Boolean);

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const W = 900, H = 1400, FILL = 0.60, BG = '3d2b21', FLOOR = 0.02;
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const rows = [];
let failures = 0;

for (const id of IDS) {
  for (const pitch of PITCHES) {
    const url = `${BASE}/preview.html?piece=character&id=${id}&pitch=${pitch}&yaw=${YAW}`
      + `&fill=${FILL}&t=${T}&anim=${ANIM}&shot=1&bg=${BG}`;
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.error(`[pageerror ${id}]`, e.message); });
    await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
    await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });
    // ONE evaluate, and it is LAST before the read: `page.evaluate` grants transient
    // user activation over CDP, so an extra bookkeeping read is not free.
    const info = await page.evaluate(({ knownbad, paint }) => {
      const s = window.__stage;
      let painted = 0;
      if (paint.length) {
        s.scene.traverse((o) => {
          if (!o.isMesh || !paint.some((q) => o.name.includes(q))) return;
          painted++;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            if (m.color) m.color.setHex(0xff00ff);
            if (m.emissive) m.emissive.setHex(0x440044);
            m.needsUpdate = true;
          }
        });
      }
      if (knownbad === 'nochar') s.scene.traverse((o) => { if (o.name === 'rig_root') o.visible = false; });
      s.render(0);
      const gl = s.renderer.getContext();
      // AFTER the render, so it is the buffer the floor reads that goes flat.
      if (knownbad === 'blank') { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i < px.length; i += 4 * 7) {
        const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
        sum += l; sum2 += l * l; n++;
      }
      const mean = sum / n;
      return { stdev: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), painted };
    }, { knownbad: KNOWNBAD, paint: PAINT });
    const buf = await page.locator('canvas').first().screenshot();
    await page.close();
    const file = `${OUT}/${id}_p${pitch}.png`;
    await writeFile(file, buf);
    const ok = info.stdev > FLOOR;
    if (!ok) failures++;
    rows.push({ id, pitch, stdev: +info.stdev.toFixed(4), painted: info.painted, ok, errs: errs.length });
    console.log(`${id.padEnd(12)} p${String(pitch).padEnd(3)} stdev ${info.stdev.toFixed(4)} ${ok ? 'OK ' : 'FLOOR-FAIL'} painted=${info.painted} err=${errs.length}  -> ${file}`);
  }
}
await browser.close();
await writeFile(`${OUT}/_shots.json`, JSON.stringify(rows, null, 2));

if (KNOWNBAD === 'blank') {
  // The guard must FAIL on the known-bad input, or it is not a guard.
  if (failures === rows.length) { console.log(`\nKNOWN-BAD OK: all ${rows.length} cleared frames rejected by the paint floor.`); process.exit(3); }
  console.error(`\nKNOWN-BAD FAILED: ${rows.length - failures}/${rows.length} cleared frames PASSED the floor.`);
  process.exit(1);
}
if (KNOWNBAD === 'nochar') {
  // Reported, never required. A graded backdrop is not flat, so a whole-frame stdev
  // is EXPECTED to pass here — run it to learn the guard's coverage, not to confirm it.
  console.log(`\nNOCHAR (coverage probe, no verdict): ${rows.length - failures}/${rows.length} character-less frames PASSED the paint floor.`);
  process.exit(0);
}
if (failures) { console.error(`\n${failures} frame(s) under the paint floor ${FLOOR}`); process.exit(3); }
console.log(`\n${rows.length} frames, all above the paint floor.`);
