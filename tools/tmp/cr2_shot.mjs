#!/usr/bin/env node
/**
 * cr2_shot — one WHOLE-FIGURE capture of one character at the SHIPPED LOBBY CAMERA.
 *
 * THROWAWAY, READ-ONLY on src/. Measurement instrument; changes no game code.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `pp_ours.mjs` captures per-PART panels and its part classifier is hand-written
 * for `hamburger` — pointing it at `egg` would silently drop every mesh it cannot
 * name into `unclassified:*` and emit a DIFFERENT figure for the two characters.
 * docs/DECISIONS-FOR-URI.md §40 PATTERN 3 is the other half of the reason: the
 * per-part instrument structurally cannot see "these correct parts compose a
 * goat". This round needs exactly the panel per-part cannot produce — the whole
 * figure — so it takes pp_ours's CAMERA and PAINT GUARD and nothing else.
 *
 * ── THE CAMERA IS NOT A CHOICE ───────────────────────────────────────────────
 * `src/ui/screens/charStage.ts:451` ships pitch 20 / yaw 0 / subjectFill 0.60.
 * `src/render/camera.ts` defaults the MATCH to 58. Uri judges the lobby, and every
 * one of his reject sheets (DECISIONS §37-§41) is a lobby view, so 20 is the pitch
 * that matches both the thing he rejected and the close, shallow reference plates.
 * These are hard-coded rather than flagged: a before/after whose two arms could be
 * given different framing is not a before/after.
 *
 * ── THE PAINT GUARD, AND THE KNOWN-BAD THAT PROVES IT ────────────────────────
 * `window.__previewReady` is a FLAG, and a flag is not a paint (docs/LESSONS.md
 * §1, twenty instances). So the floor is asserted on the DRAWING BUFFER via
 * `gl.readPixels`, not on the DOM: luma stdev must exceed 0.02.
 *
 *   KNOWN-BAD INPUT: `--knownbad blank` renders the page with the character root
 *   hidden before the floor is read. The buffer is then a flat backdrop and this
 *   tool MUST exit 3. A guard that has not been shown to FAIL on the bug it guards
 *   against is not a guard (CLAUDE.md #6). Run it once per session; it is cheap.
 *
 * The PNG is the canvas element's own pixels, and the `.capture.json` sidecar
 * records the measured floor so `tools/review.mjs` can vouch for it instead of
 * being waved through with `--allow-unverified`.
 *
 * ── USE ──────────────────────────────────────────────────────────────────────
 *   PREVIEW_BASE=http://localhost:5301 node tools/tmp/cr2_shot.mjs \
 *     --id hamburger --out shots/cr2/before/hamburger.png --label BEFORE
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'hamburger');
const OUT = get('--out', 'shots/cr2/out.png');
const LABEL = get('--label', 'unlabelled');
const KNOWNBAD = get('--knownbad', null);

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

/** Frozen. See the camera note above — an arm-specific framing voids the round. */
const PITCH = 20, YAW = 0, FILL = 0.60, T = 1.5, ANIM = 'idle', BG = '3d2b21';
const W = 900, H = 1400;
const FLOOR = 0.02;

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/** Vite's HMR client is stubbed so a peer's save can never reload a capture mid-flight. */
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const url = `${BASE}/preview.html?piece=character&id=${ID}&pitch=${PITCH}&yaw=${YAW}&fill=${FILL}`
  + `&t=${T}&anim=${ANIM}&shot=1&bg=${BG}`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
const errs = [];
page.on('pageerror', (e) => { errs.push(e.message); console.error('[pageerror]', e.message); });
await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });

// ── KNOWN-BAD INPUTS ────────────────────────────────────────────────────────
// `blank`  — clear the drawing buffer. This is literally the "nothing was drawn"
//            state the floor exists to catch, so the floor MUST reject it (exit 3).
// `nochar` — hide the character root and re-render through the SHIPPED post chain,
//            leaving the graded backdrop. This is the harder question, and the
//            honest expectation is that a whole-frame stdev CANNOT see it: a
//            vignetted, graded backdrop is not flat. Run it to LEARN the guard's
//            coverage, not to confirm it. Whichever way it lands is reported.
if (KNOWNBAD === 'blank') {
  await page.evaluate(() => {
    const gl = window.__stage.renderer.getContext();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  });
} else if (KNOWNBAD === 'nochar') {
  await page.evaluate(() => {
    const s = window.__stage;
    for (const c of s.scene.children) {
      if (c.isLight || c.name === 'lighting' || c.name === 'preview_ground') continue;
      let hasHead = false; c.traverse((o) => { if (o.name === 'head') hasHead = true; });
      if (hasHead) c.visible = false;
    }
    s.render(0);
  });
}

/** Frame statistics off the drawing buffer itself — css- and DOM-immune. */
const stats = await page.evaluate(() => {
  const gl = window.__stage.renderer.getContext();
  const cv = window.__stage.renderer.domElement;
  const p = new Uint8Array(cv.width * cv.height * 4);
  gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.UNSIGNED_BYTE, p);
  let s = 0, s2 = 0, mn = 1, mx = 0; const n = p.length / 4;
  for (let i = 0; i < p.length; i += 4) {
    const L = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
    s += L; s2 += L * L; if (L < mn) mn = L; if (L > mx) mx = L;
  }
  const mean = s / n;
  return { mean, stdev: Math.sqrt(Math.max(0, s2 / n - mean * mean)), min: mn, max: mx, w: cv.width, h: cv.height };
});

const painted = stats.stdev > FLOOR;
console.log(`${LABEL.padEnd(9)} ${ID.padEnd(10)} bufStdev=${stats.stdev.toFixed(4)} mean=${stats.mean.toFixed(4)} `
  + `range=${stats.min.toFixed(3)}..${stats.max.toFixed(3)} painted=${painted}`);

if (!painted) {
  console.error(`!! PAINT FLOOR FAILED: drawing-buffer luma stdev ${stats.stdev.toFixed(4)} <= ${FLOOR}. Nothing was drawn.`);
  await browser.close();
  process.exit(3);
}

await mkdir(dirname(OUT), { recursive: true });
await page.locator('canvas').first().screenshot({ path: OUT });
await writeFile(`${OUT}.capture.json`, JSON.stringify({
  tool: 'cr2_shot.mjs',
  label: LABEL,
  takenAt: new Date().toISOString(),
  painted,
  id: ID,
  url,
  camera: { pitchDeg: PITCH, yawDeg: YAW, subjectFill: FILL, source: 'src/ui/screens/charStage.ts — the SHIPPED lobby character-detail camera' },
  anim: ANIM, t: T, bg: `0x${BG}`, viewport: { W, H },
  drawingBuffer: stats,
  floor: FLOOR,
  pageErrors: errs,
}, null, 2));
console.log(`wrote ${OUT}`);
await browser.close();
