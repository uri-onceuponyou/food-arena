#!/usr/bin/env node
/**
 * cm_shot — SHIPPED-PATH captures of the six migrated characters, at BOTH cameras.
 *
 * THROWAWAY, READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY BOTH PITCHES, AND WHY THEY ARE NOT A FLAG WITH A DEFAULT ─────────────
 * `src/ui/screens/charStage.ts:451` ships the LOBBY at **pitch 20** — close and
 * shallow, where Uri looks at a character and where every one of his reject sheets
 * came from. `src/render/camera.ts:265` defaults the MATCH to **58** — steep and far.
 * A limb passing through a torso is a 3D fact and is wrong at both; the shallow view
 * does not make it wrong, it makes it VISIBLE. So a pass verifies at both, and this
 * tool renders both in ONE browser session so the two pitches cannot drift apart.
 *
 * ── THE PAINT GUARD, AND THE KNOWN-BAD THAT PROVES IT ────────────────────────
 * `window.__previewReady` is a FLAG, and a flag is not a paint (`docs/LESSONS.md`
 * §1, twenty instances — one measured opacity 0.000 when it flipped). The floor is
 * therefore asserted on the DRAWING BUFFER via `gl.readPixels`, not on the DOM.
 *
 *   KNOWN-BAD: `--knownbad blank` clears the drawing buffer before the floor is
 *   read. This tool MUST then exit 3. A guard that has not been shown to FAIL on the
 *   bug it guards against is not a guard (CLAUDE.md #6). Cheap; run it once.
 *
 * Alongside each PNG it writes the **sha256 of the raw RGBA drawing buffer**. That,
 * not the PNG, is what `cm_pix_ab.mjs` compares: a PNG carries an encoder and a
 * timestamp, the drawing buffer carries only what the GPU drew.
 *
 * ── USE ──────────────────────────────────────────────────────────────────────
 *   node tools/tmp/headserve.mjs -- \
 *     node tools/tmp/cm_shot.mjs --out shots/cm/before --label BEFORE --url '{URL}'
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const OUT = get('--out', 'shots/cm/out');
const LABEL = get('--label', 'unlabelled');
const KNOWNBAD = get('--knownbad', null);
const IDS = String(get('--ids', 'hamburger,taco,burrito,donut,egg,lollipop')).split(',').filter(Boolean);

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

/** FROZEN. An arm-specific framing is not a before/after. See the camera note above. */
const CAMERAS = [
  { key: 'lobby', pitch: 20, note: 'charStage.ts:451 — the camera Uri judges' },
  { key: 'match', pitch: 58, note: 'camera.ts:265 — the shipped match camera' },
];
const YAW = 0, FILL = 0.60, T = 1.5, ANIM = 'idle', BG = '3d2b21';
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

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
const errs = [];
page.on('pageerror', (e) => { errs.push(e.message); console.error('[pageerror]', e.message); });

await mkdir(OUT, { recursive: true });

/**
 * ⚠️ A fresh snapshot's FIRST client eats a dep-optimisation reload that presents as
 * `execution context was destroyed`. Warm it with a cheap load before anything is
 * measured (AGENT-BRIEF §3).
 */
await page.goto(`${BASE}/preview.html?piece=character&id=${IDS[0]}&shot=1`, { waitUntil: 'load', timeout: 180_000 })
  .catch(() => { /* the warm-up is allowed to fail; the measured loads are not */ });
await page.waitForTimeout(1500);

const rows = [];
let failed = 0;
for (const cam of CAMERAS) {
  for (const id of IDS) {
    const url = `${BASE}/preview.html?piece=character&id=${id}&pitch=${cam.pitch}&yaw=${YAW}&fill=${FILL}`
      + `&t=${T}&anim=${ANIM}&shot=1&bg=${BG}`;
    await page.goto(url, { waitUntil: 'load', timeout: 180_000 });
    await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 300_000 });

    if (KNOWNBAD === 'blank') {
      await page.evaluate(() => {
        const gl = window.__stage.renderer.getContext();
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      });
    }

    // Frame statistics AND the pixel digest off the drawing buffer itself — css- and
    // DOM-immune, and free of any PNG encoder.
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
      return {
        mean, stdev: Math.sqrt(Math.max(0, s2 / n - mean * mean)), min: mn, max: mx,
        w: cv.width, h: cv.height, bytes: Array.from(p),
      };
    });

    const buf = Buffer.from(stats.bytes);
    delete stats.bytes;
    const sha = createHash('sha256').update(buf).digest('hex');
    const painted = stats.stdev > FLOOR;
    console.log(`${LABEL.padEnd(7)} ${cam.key.padEnd(5)} ${id.padEnd(10)} `
      + `bufStdev=${stats.stdev.toFixed(4)} mean=${stats.mean.toFixed(4)} painted=${painted} sha=${sha.slice(0, 16)}`);
    if (!painted) {
      console.error(`!! PAINT FLOOR FAILED: buffer luma stdev ${stats.stdev.toFixed(4)} <= ${FLOOR}. Nothing was drawn.`);
      failed++;
      continue;
    }

    const png = `${OUT}/${cam.key}_${id}.png`;
    await page.locator('canvas').first().screenshot({ path: png });
    await writeFile(`${OUT}/${cam.key}_${id}.raw`, buf);
    rows.push({ id, camera: cam.key, pitch: cam.pitch, sha, stats, png });
  }
}

await writeFile(`${OUT}/manifest.json`, JSON.stringify({
  tool: 'cm_shot.mjs', label: LABEL, base: BASE, takenAt: new Date().toISOString(),
  cameras: CAMERAS, yaw: YAW, fill: FILL, t: T, anim: ANIM, bg: `0x${BG}`, viewport: { W, H },
  floor: FLOOR, pageErrors: errs, rows,
}, null, 2));
await browser.close();

if (KNOWNBAD === 'blank') {
  console.log(failed === rows.length + failed
    ? `✅ KNOWN-BAD: the paint floor rejected all ${failed} blanked frames.`
    : `🔴 KNOWN-BAD: the paint floor let ${rows.length} blanked frame(s) through.`);
  process.exit(failed > 0 && rows.length === 0 ? 3 : 1);
}
console.log(`wrote ${rows.length} capture(s) to ${OUT}`);
process.exit(failed ? 3 : 0);
