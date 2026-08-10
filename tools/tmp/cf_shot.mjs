#!/usr/bin/env node
/**
 * cf_shot — whole-figure capture of one character at EITHER shipped camera.
 *
 * THROWAWAY, READ-ONLY on src/. Measurement instrument; changes no game code.
 *
 * ── WHY A THIRD CAPTURE TOOL ────────────────────────────────────────────────
 * `cr2_shot.mjs` hard-codes pitch 20 deliberately — "a before/after whose two arms
 * could be given different framing is not a before/after" — and that is right for
 * a single-camera round. This round is explicitly a TWO-camera round (CLAUDE.md #3:
 * a limb through a torso is a 3D fact, wrong at every angle; the lobby camera is the
 * better DETECTOR, the match camera is the confirmation). So the pitch is a flag —
 * but the flag is recorded in the sidecar and printed on every line, so an A/B that
 * accidentally mixes pitches is visible rather than silent.
 *
 * ⚠️ It is ALSO owned by this agent (`cf_*`). `cr2_*` is a peer's untracked file and
 * could change under a multi-hour round; copying its camera and paint guard rather
 * than importing them is the file-ownership rule (CLAUDE.md #9), not duplication for
 * its own sake.
 *
 * ── THE TWO CAMERAS ─────────────────────────────────────────────────────────
 *   pitch 20 — `src/ui/screens/charStage.ts:451`, the LOBBY character-detail camera.
 *              Where Uri looks and where every reject sheet came from.
 *   pitch 58 — `src/render/camera.ts:265`, the MATCH camera.
 * `--fill` defaults to 0.60, which is `charStage`'s `subjectFill`.
 *
 * ── THE PAINT GUARD, AND THE KNOWN-BAD THAT PROVES IT ───────────────────────
 * `window.__previewReady` is a FLAG and a flag is not a paint (docs/LESSONS.md §1,
 * twenty instances). The floor is asserted on the DRAWING BUFFER via `gl.readPixels`:
 * luma stdev must exceed 0.02.
 *
 *   KNOWN-BAD: `--knownbad blank` clears the drawing buffer before it is read. That
 *   is literally the "nothing was drawn" state, so this tool MUST exit 3. A guard not
 *   shown to FAIL on the bug it guards against is not a guard (CLAUDE.md #6).
 *
 *   KNOWN-BAD: `--knownbad nochar` hides the character root and re-renders through the
 *   shipped post chain. The honest expectation is that a whole-frame stdev CANNOT see
 *   this — a vignetted graded backdrop is not flat. Run it to LEARN the guard's
 *   coverage, not to confirm it; whichever way it lands is reported.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   PREVIEW_BASE=http://localhost:5301 node tools/tmp/cf_shot.mjs \
 *     --id sushi --pitch 20 --out shots/cf/before/sushi_p20.png --label BEFORE
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'sushi');
const OUT = get('--out', 'shots/cf/out.png');
const LABEL = get('--label', 'unlabelled');
const KNOWNBAD = get('--knownbad', null);
const PITCH = Number(get('--pitch', '20'));
const YAW = Number(get('--yaw', '0'));
const FILL = Number(get('--fill', '0.60'));
const T = Number(get('--t', '1.5'));
const ANIM = get('--anim', 'idle');
const BG = get('--bg', '3d2b21');
const W = Number(get('--w', '900'));
const H = Number(get('--h', '1400'));
const FLOOR = 0.02;

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

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
console.log(`${LABEL.padEnd(10)} ${ID.padEnd(10)} p${PITCH} bufStdev=${stats.stdev.toFixed(4)} mean=${stats.mean.toFixed(4)} `
  + `range=${stats.min.toFixed(3)}..${stats.max.toFixed(3)} painted=${painted}`);

if (!painted) {
  console.error(`!! PAINT FLOOR FAILED: drawing-buffer luma stdev ${stats.stdev.toFixed(4)} <= ${FLOOR}. Nothing was drawn.`);
  await browser.close();
  process.exit(3);
}

await mkdir(dirname(OUT), { recursive: true });
await page.locator('canvas').first().screenshot({ path: OUT });
await writeFile(`${OUT}.capture.json`, JSON.stringify({
  tool: 'cf_shot.mjs',
  label: LABEL,
  takenAt: new Date().toISOString(),
  painted,
  id: ID,
  url,
  camera: {
    pitchDeg: PITCH, yawDeg: YAW, subjectFill: FILL,
    source: PITCH === 20 ? 'src/ui/screens/charStage.ts:451 — the SHIPPED lobby character-detail camera'
      : PITCH === 58 ? 'src/render/camera.ts:265 — the SHIPPED match camera'
        : 'ad-hoc pitch, NOT a shipped camera',
  },
  anim: ANIM, t: T, bg: `0x${BG}`, viewport: { W, H },
  drawingBuffer: stats,
  floor: FLOOR,
  pageErrors: errs,
}, null, 2));
console.log(`wrote ${OUT}`);
await browser.close();
