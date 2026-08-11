#!/usr/bin/env node
/**
 * bw_shot — one capture of one character at EITHER shipped camera, with a DERIVED
 * face/eye crop.
 *
 * THROWAWAY, READ-ONLY on src/. Measurement instrument; changes no game code.
 * Forked from `tools/tmp/ey_shot.mjs` (owned by CAST-C) so the BROWS agent owns its own
 * copy and neither agent can edit the other's instrument mid-round — the same reason
 * `ey_shot` was itself forked from `cr2_shot`. The paint guard, the HMR stub and the
 * sidecar are taken verbatim. Two things are new:
 *
 *   --focus <substr>   union the SCREEN-SPACE bounding box of every mesh whose name
 *                      contains <substr>, in canvas CSS px, and write it to the sidecar.
 *                      A crop derived from the geometry cannot drift off the feature
 *                      the way a hand-typed rectangle does — and `--zoom` uses it.
 *   --zoom <n>         additionally write `<out>.zoom.png`: the focus box, padded, at n x
 *                      nearest-neighbour. Cropped OFFLINE with sharp off the full canvas
 *                      PNG, never with `page.screenshot({clip})` — a page capture would
 *                      re-open the CSS-timeline question `docs/AGENT-BRIEF.md` §3 raises.
 *
 * ⚠️ IT DOES NOT ABLATE, DELIBERATELY. A `--paint sub=RRGGBB` flag was written here and
 * then REMOVED: it was never used for a number in this pass, and an unexercised feature
 * inside an instrument is the thing the next agent trusts without validating. Ablation
 * lives in `bw_brow.mjs`, where it has six known-bads and a blacked-out scene — and where
 * the first version of it was caught reporting 101,125 px of a part the character does
 * not have, because it classified a LIT frame by hue.
 *
 * ── TWO CAMERAS, AND THE PITCH IS A FLAG ─────────────────────────────────────
 *   `src/ui/screens/charStage.ts:451`  pitchDeg 20, subjectFill 0.60 — the LOBBY
 *   `src/render/camera.ts:265`         pitchDeg 58                   — the MATCH
 * `preview.html?piece=character` builds a real `frameMode:'subject'` rig, so pitch 20
 * frames a character rather than the empty frame a bare `pitchDeg=20` on a `fair` rig
 * produces. The pitch is printed on every line and written into the sidecar, so a
 * mismatched before/after pair is visible rather than silent.
 *
 * ── THE PAINT GUARD, AND THE KNOWN-BAD THAT PROVES IT ────────────────────────
 * `window.__previewReady` is a FLAG and a flag is not a paint. The floor is asserted on
 * the DRAWING BUFFER via `gl.readPixels`: luma stdev must exceed 0.02.
 *   KNOWN-BAD: `--knownbad blank` clears the buffer before it is read; this tool MUST
 *   exit 3. A guard not shown to FAIL on the bug it guards is not a guard.
 *   KNOWN-BAD: `--focus __nothing__` matches no mesh; this tool MUST exit 4 rather than
 *   silently writing a crop of the frame's top-left corner.
 *
 *   PREVIEW_BASE=http://localhost:5301 node tools/tmp/bw_shot.mjs \
 *     --id lollipop --pitch 20 --focus lollipop_sclera,lollipop_brow,lollipop_lid --zoom 6 \
 *     --out shots/bw/before/lollipop_p20.png --label BEFORE
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'lollipop');
const OUT = get('--out', 'shots/bw/out.png');
const LABEL = get('--label', 'unlabelled');
const KNOWNBAD = get('--knownbad', null);
const PITCH = Number(get('--pitch', '20'));
const YAW = Number(get('--yaw', '0'));
const FILL = Number(get('--fill', '0.60'));
const FOCUS = get('--focus', null);
const ZOOM = Number(get('--zoom', '0'));
const PAD = Number(get('--pad', '0.35'));

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

const ok = stats.stdev > FLOOR;
console.log(`${LABEL.padEnd(9)} ${ID.padEnd(12)} p${String(PITCH).padStart(2)} y${String(YAW).padStart(3)} `
  + `bufStdev=${stats.stdev.toFixed(4)} mean=${stats.mean.toFixed(4)} painted=${ok}`);

if (!ok) {
  console.error(`!! PAINT FLOOR FAILED: drawing-buffer luma stdev ${stats.stdev.toFixed(4)} <= ${FLOOR}. Nothing was drawn.`);
  await browser.close();
  process.exit(3);
}

// ── FOCUS BOX, in canvas CSS px, projected from the geometry itself ────────
let focus = null;
if (FOCUS) {
  focus = await page.evaluate(({ sub, w, h }) => {
    const cam = window.__stage.rig.camera;
    cam.updateMatrixWorld(true);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, meshes = 0;
    const subs = sub.split(',').filter(Boolean);
    const v = { x: 0, y: 0, z: 0 };
    window.__stage.scene.traverse((o) => {
      if (!o.isMesh || !o.name || !subs.some((s) => o.name.includes(s))) return;
      if (o.name.endsWith('__outline')) return;
      meshes++;
      const pos = o.geometry.attributes.position;
      o.updateMatrixWorld(true);
      const m = o.matrixWorld.elements;
      const p = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
        v.x = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
        v.y = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
        v.z = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
        const cx = p[0] * v.x + p[4] * v.y + p[8] * v.z + p[12];
        const cy = p[1] * v.x + p[5] * v.y + p[9] * v.z + p[13];
        const cw = p[3] * v.x + p[7] * v.y + p[11] * v.z + p[15];
        if (cw <= 0) continue;
        const sxp = (cx / cw * 0.5 + 0.5) * w;
        const syp = (1 - (cy / cw * 0.5 + 0.5)) * h;
        if (sxp < x0) x0 = sxp; if (sxp > x1) x1 = sxp;
        if (syp < y0) y0 = syp; if (syp > y1) y1 = syp;
      }
    });
    return meshes ? { meshes, x0, y0, x1, y1 } : { meshes: 0 };
  }, { sub: FOCUS, w: W, h: H });
  if (!focus.meshes) {
    console.error(`!! FOCUS MATCHED NOTHING: no mesh name contains "${FOCUS}". A crop of a`
      + ' feature that was not found is a crop of the frame corner, and it looks fine.');
    await browser.close();
    process.exit(4);
  }
  console.log(`  focus "${FOCUS}": ${focus.meshes} mesh(es)  box=`
    + `${focus.x0.toFixed(1)},${focus.y0.toFixed(1)} .. ${focus.x1.toFixed(1)},${focus.y1.toFixed(1)}`
    + `  (${(focus.x1 - focus.x0).toFixed(1)} x ${(focus.y1 - focus.y0).toFixed(1)} px)`);
}

await mkdir(dirname(OUT), { recursive: true });
await page.locator('canvas').first().screenshot({ path: OUT });

let zoomOut = null;
if (ZOOM > 0 && focus) {
  const bw = focus.x1 - focus.x0, bh = focus.y1 - focus.y0;
  const px = bw * PAD, py = bh * PAD;
  const left = Math.max(0, Math.floor(focus.x0 - px));
  const top = Math.max(0, Math.floor(focus.y0 - py));
  const width = Math.min(W - left, Math.ceil(bw + 2 * px));
  const height = Math.min(H - top, Math.ceil(bh + 2 * py));
  zoomOut = `${OUT.replace(/\.png$/, '')}.zoom.png`;
  await sharp(OUT).extract({ left, top, width, height })
    .resize({ width: Math.round(width * ZOOM), kernel: 'nearest' }).png().toFile(zoomOut);
  console.log(`  wrote ${zoomOut}  (${width}x${height} @ ${ZOOM}x)`);
}

await writeFile(`${OUT}.capture.json`, JSON.stringify({
  tool: 'bw_shot.mjs', label: LABEL, takenAt: new Date().toISOString(), painted: ok, id: ID, url,
  camera: { pitchDeg: PITCH, yawDeg: YAW, subjectFill: FILL },
  anim: ANIM, t: T, bg: `0x${BG}`, viewport: { W, H },
  focus: FOCUS ? { substr: FOCUS, ...focus, zoom: ZOOM, pad: PAD, out: zoomOut } : null,
  drawingBuffer: stats, floor: FLOOR, pageErrors: errs,
}, null, 2));
console.log(`wrote ${OUT}`);
await browser.close();
