#!/usr/bin/env node
/**
 * cc_shot — one WHOLE-FIGURE capture of one character, at EITHER shipped camera.
 *
 * THROWAWAY, READ-ONLY on src/. Measurement instrument; changes no game code.
 * Forked from `cr2_shot.mjs` (a peer's tool, owned by CAST-B) so that CAST-C owns its
 * own copy and neither agent can edit the other's instrument mid-round. The paint
 * guard, the HMR stub and the sidecar are taken verbatim; only the camera is different.
 *
 * ── WHY THE CAMERA IS A FLAG HERE AND WAS NOT THERE ──────────────────────────
 * `cr2_shot` hard-codes pitch 20 so a before/after cannot be given different framing.
 * That is right, and it is also why it can only answer ONE of the two questions
 * CLAUDE.md #3 requires. This job has to confirm at BOTH shipped cameras:
 *
 *   `src/ui/screens/charStage.ts:451`  pitchDeg 20  — the LOBBY, where Uri judges
 *   `src/render/camera.ts:265`         pitchDeg 58  — the MATCH
 *
 * So the pitch is a flag, and the discipline moves to the CALLER: `cc_shotall.mjs`
 * passes one pitch to both arms of a round, and the pitch is written into the sidecar
 * and printed on every line, so a mismatched pair is visible rather than silent.
 *
 * ── THE PAINT GUARD, AND THE KNOWN-BAD THAT PROVES IT ────────────────────────
 * `window.__previewReady` is a FLAG and a flag is not a paint. The floor is asserted
 * on the DRAWING BUFFER via `gl.readPixels`: luma stdev must exceed 0.02.
 *   KNOWN-BAD: `--knownbad blank` clears the buffer before it is read; this tool MUST
 *   exit 3. A guard not shown to FAIL on the bug it guards is not a guard.
 *
 *   PREVIEW_BASE=http://localhost:5301 node tools/tmp/cc_shot.mjs \
 *     --id waterbottle --pitch 20 --out shots/cc/before/waterbottle.png --label BEFORE
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'waterbottle');
const OUT = get('--out', 'shots/cc/out.png');
const LABEL = get('--label', 'unlabelled');
const KNOWNBAD = get('--knownbad', null);
const PITCH = Number(get('--pitch', '20'));
const YAW = Number(get('--yaw', '0'));
const FILL = Number(get('--fill', '0.60'));

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const T = 1.5, ANIM = get('--anim', 'idle'), BG = '3d2b21';
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

if (KNOWNBAD === 'blank') {
  await page.evaluate(() => {
    const gl = window.__stage.renderer.getContext();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
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
console.log(`${LABEL.padEnd(9)} ${ID.padEnd(12)} p${String(PITCH).padStart(2)} y${String(YAW).padStart(3)} `
  + `bufStdev=${stats.stdev.toFixed(4)} mean=${stats.mean.toFixed(4)} painted=${painted}`);

if (!painted) {
  console.error(`!! PAINT FLOOR FAILED: drawing-buffer luma stdev ${stats.stdev.toFixed(4)} <= ${FLOOR}. Nothing was drawn.`);
  await browser.close();
  process.exit(3);
}

await mkdir(dirname(OUT), { recursive: true });
await page.locator('canvas').first().screenshot({ path: OUT });
await writeFile(`${OUT}.capture.json`, JSON.stringify({
  tool: 'cc_shot.mjs', label: LABEL, takenAt: new Date().toISOString(), painted, id: ID, url,
  camera: { pitchDeg: PITCH, yawDeg: YAW, subjectFill: FILL },
  anim: ANIM, t: T, bg: `0x${BG}`, viewport: { W, H },
  drawingBuffer: stats, floor: FLOOR, pageErrors: errs,
}, null, 2));
console.log(`wrote ${OUT}`);
await browser.close();
