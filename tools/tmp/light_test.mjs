#!/usr/bin/env node
/**
 * THROWAWAY acceptance test for the lighting/post element.
 *
 * Runs the REAL game at SHIPPED framing, player-centred, and measures four things
 * that no two critics can contradict each other about:
 *
 *   L1 FIGURE/GROUND  mean greyscale value of the player's body vs the floor annulus
 *                     around it must differ by >= 0.10 (25/255).
 *   L2 DIRECTIONAL    within a disc around the player's feet, the darkest 1% of
 *      SHADOW         non-body pixels must have a centroid offset from the feet of
 *                     >= 10% of the disc radius — a shadow, not a symmetric halo —
 *                     and must be >= 12% darker than the local ground mean.
 *   L3 FORM           on the body, p90 - p10 greyscale >= 0.28 (a real light ramp),
 *                     with < 1% of body pixels clipped to 0 or 255.
 *   L4 COLOUR         (tools/tmp/post_probe.mjs) no authored channel driven to 0/255,
 *      FIDELITY       hue error <= 4 deg, authored saturation ORDER preserved.
 *
 * Usage: node tools/tmp/light_test.mjs --label rN
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const args = process.argv;
const label = args.includes('--label') ? args[args.indexOf('--label') + 1] : 'run';
const W = 1300, H = 740;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));

// simSpeed fast-forwards the 5 s countdown; then we hold still so the frame settles.
await page.goto('http://localhost:5173/?player=hamburger&enemy=donut&simSpeed=12',
  { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
// Wall-clock waits are useless here: SwiftShader runs at a few fps and dt is clamped
// to 1/20 s per frame before simSpeed scales it. Wait on the countdown overlay itself.
await page.waitForFunction(
  "document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 60000 });
await page.waitForTimeout(600);

await mkdir(`shots/light2/${label}`, { recursive: true });
await page.screenshot({ path: `shots/light2/${label}/game.png` });

const res = await page.evaluate(() => {
  const stage = window.__stage;
  const gl = stage.renderer.getContext();
  const cv = stage.renderer.domElement;
  const W = cv.width, H = cv.height;
  const read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };

  // ── frame as shipped ──────────────────────────────────────────────────────
  stage.render(1 / 60);
  const frame = read();

  // ── player mask: player root only, flat white, no post, no fog ────────────
  const scene = stage.scene;
  const player = scene.getObjectByName('character:hamburger')
    ?? scene.children.find((o) => o.name?.startsWith?.('character:'));
  const hidden = [];
  scene.traverseVisible(() => {});
  for (const c of scene.children) {
    if (c === player || c.name === 'lighting' || c.type.endsWith('Camera')) continue;
    if (c.visible) { hidden.push(c); c.visible = false; }
  }
  const fog = scene.fog; scene.fog = null;
  const bg = scene.background; scene.background = null;
  // Render the player alone, lit, against a black clear — anything non-black is body.
  stage.renderer.setRenderTarget(null);
  stage.renderer.setClearColor(0x000000, 1);
  stage.renderer.clear();
  stage.renderer.render(scene, stage.rig.camera);
  const maskRaw = read();

  // restore
  for (const c of hidden) c.visible = true;
  scene.fog = fog; scene.background = bg;
  stage.render(1 / 60);

  const g = (p, i) => (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
  const isBody = (i) => maskRaw[i] + maskRaw[i + 1] + maskRaw[i + 2] > 12;

  // player screen position (top-left origin, CSS px) -> framebuffer, bottom-left
  const sp = window.__vfxDebugScreen?.player;
  const dpr = W / cv.clientWidth;
  const feetX = Math.round((sp?.x ?? cv.clientWidth / 2) * dpr);
  const feetY = Math.round(H - (sp?.y ?? cv.clientHeight / 2) * dpr);

  // ── L1 figure/ground + L3 form ────────────────────────────────────────────
  let bodyN = 0, bodySum = 0, clipped = 0, white = 0;
  const bodyVals = [];
  let bx = 0, by = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!isBody(i)) continue;
    const v = g(frame, i);
    bodyN++; bodySum += v; bodyVals.push(v); bx += x; by += y;
    if (frame[i] === 255 || frame[i + 1] === 255 || frame[i + 2] === 255
      || (frame[i] === 0 && frame[i + 1] === 0 && frame[i + 2] === 0)) clipped++;
    if (frame[i] === 255 && frame[i + 1] === 255 && frame[i + 2] === 255) white++;
  }
  bodyVals.sort((a, b) => a - b);
  const pct = (q) => bodyVals.length ? bodyVals[Math.min(bodyVals.length - 1, Math.floor(q * bodyVals.length))] : 0;
  const bodyMean = bodyN ? bodySum / bodyN : 0;
  const cx = bodyN ? bx / bodyN : feetX, cy = bodyN ? by / bodyN : feetY;

  // Annulus of NON-body ground around the body centroid.
  const R0 = 55, R1 = 140;
  let annN = 0, annSum = 0;
  const cxi = Math.round(cx), cyi = Math.round(cy);
  for (let y = Math.max(0, cyi - R1); y < Math.min(H, cyi + R1); y++)
    for (let x = Math.max(0, cxi - R1); x < Math.min(W, cxi + R1); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 < R0 * R0 || d2 > R1 * R1) continue;
      const i = (y * W + x) * 4;
      if (isBody(i)) continue;
      annN++; annSum += g(frame, i);
    }
  const annMean = annN ? annSum / annN : 0;

  // ── L2 directional shadow ─────────────────────────────────────────────────
  const RS = 130;
  const disc = [];
  for (let y = Math.max(0, feetY - RS); y < Math.min(H, feetY + RS); y++)
    for (let x = Math.max(0, feetX - RS); x < Math.min(W, feetX + RS); x++) {
      const d2 = (x - feetX) ** 2 + (y - feetY) ** 2;
      if (d2 > RS * RS) continue;
      const i = (y * W + x) * 4;
      if (isBody(i)) continue;
      disc.push([g(frame, i), x, y]);
    }
  disc.sort((a, b) => a[0] - b[0]);
  const kDark = Math.max(1, Math.floor(disc.length * 0.01));
  let sx = 0, sy = 0, sv = 0;
  for (let k = 0; k < kDark; k++) { sx += disc[k][1]; sy += disc[k][2]; sv += disc[k][0]; }
  const darkC = { x: sx / kDark, y: sy / kDark, v: sv / kDark };
  const discMean = disc.reduce((a, d) => a + d[0], 0) / Math.max(1, disc.length);
  const off = Math.hypot(darkC.x - feetX, darkC.y - feetY) / RS;

  // ── whole-frame clip census ───────────────────────────────────────────────
  let zero = 0, full = 0, pureBlack = 0, n = 0, satSum = 0, valSum = 0;
  for (let i = 0; i < frame.length; i += 4) {
    const r = frame[i], gg = frame[i + 1], b = frame[i + 2];
    n++;
    if (r === 0 || gg === 0 || b === 0) zero++;
    if (r === 255 || gg === 255 || b === 255) full++;
    if (r === 0 && gg === 0 && b === 0) pureBlack++;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    valSum += mx / 255; satSum += mx === 0 ? 0 : (mx - mn) / mx;
  }

  return {
    bodyPx: bodyN,
    L1: { bodyMean, annMean, delta: Math.abs(bodyMean - annMean) },
    L3: { p10: pct(0.10), p90: pct(0.90), ramp: pct(0.90) - pct(0.10), clippedFrac: bodyN ? clipped / bodyN : 1, whiteFrac: bodyN ? white / bodyN : 1 },
    L2: { offsetFrac: off, darkMean: darkC.v, discMean, darkRatio: discMean ? darkC.v / discMean : 1,
          dx: darkC.x - feetX, dy: darkC.y - feetY },
    frame: { anyChannelZeroPct: 100 * zero / n, anyChannelFullPct: 100 * full / n,
             pureBlackPct: 100 * pureBlack / n, meanSat: satSum / n, meanVal: valSum / n },
  };
});

const P = (b) => (b ? 'PASS' : 'FAIL');
console.log(`\n=== LIGHTING ACCEPTANCE TEST (${label}) — real game, shipped framing ===`);
console.log(`body pixels: ${res.bodyPx}`);
console.log(`L1 figure/ground   body=${res.L1.bodyMean.toFixed(3)} floor=${res.L1.annMean.toFixed(3)} `
  + `delta=${res.L1.delta.toFixed(3)}  (>=0.10)  ${P(res.L1.delta >= 0.10)}`);
console.log(`L2 dir. shadow     offset=${res.L2.offsetFrac.toFixed(3)} of R (>=0.10) `
  + `dx=${res.L2.dx.toFixed(0)} dy=${res.L2.dy.toFixed(0)}  darkRatio=${res.L2.darkRatio.toFixed(3)} (<=0.88)  `
  + `${P(res.L2.offsetFrac >= 0.10 && res.L2.darkRatio <= 0.88)}`);
console.log(`L3 form ramp       p10=${res.L3.p10.toFixed(3)} p90=${res.L3.p90.toFixed(3)} `
  + `ramp=${res.L3.ramp.toFixed(3)} (>=0.28) anyChanClipped=${(100 * res.L3.clippedFrac).toFixed(2)}% (<1%) `
  + `pureWhite=${(100 * res.L3.whiteFrac).toFixed(2)}%  `
  + `${P(res.L3.ramp >= 0.28 && res.L3.clippedFrac < 0.01)}`);
console.log(`frame census       anyChan==0 ${res.frame.anyChannelZeroPct.toFixed(2)}%  `
  + `anyChan==255 ${res.frame.anyChannelFullPct.toFixed(2)}%  pureBlack ${res.frame.pureBlackPct.toFixed(2)}%  `
  + `meanSat ${res.frame.meanSat.toFixed(3)}  meanVal ${res.frame.meanVal.toFixed(3)}`);

await writeFile(`shots/light2/${label}/test.json`, JSON.stringify(res, null, 2));
console.log(`wrote shots/light2/${label}/{game.png,test.json}`);
await browser.close();
