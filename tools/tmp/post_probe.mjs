#!/usr/bin/env node
/**
 * THROWAWAY probe for the lighting/post loop.
 *
 * Renders a strip of UNLIT swatches (MeshBasicMaterial, so the pixel that reaches the
 * composer is exactly the authored sRGB colour) through the live post chain, then
 * reads them back. Any difference between authored and measured is caused purely by
 * the grade, with lighting removed from the equation.
 *
 * Usage: node tools/tmp/post_probe.mjs [--label base]
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const SWATCHES = [
  ['KPAL.freezerDoor', '#2E88AC'],
  ['KPAL.steel', '#184F6E'],
  ['KPAL.subfloor(grout)', '#B08355'],
  ['KPAL.border', '#5B3A22'],
  ['KPAL.cabinet', '#C1731E'],
  ['KPAL.tileLight', '#EAD3A8'],
  ['KPAL.herbCrateWood', '#0E8560'],
  ['KPAL.freezerBody', '#1F9FD1'],
  ['mid grey', '#808080'],
  ['dark grey', '#3A3A3A'],
  ['warm brown', '#6B4A2F'],
  ['deep red', '#8E2020'],
];
// Low-channel survival ramp: how small can an authored channel be inside an already
// saturated colour and still arrive non-zero?
for (const x of [4, 8, 12, 16, 20, 26, 34, 44]) {
  SWATCHES.push([`lowchan b=${x}`, '#C87A' + x.toString(16).padStart(2, '0')]);
}

const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1] : 'run';

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));

await page.goto('http://localhost:5173/?player=hamburger&enemy=donut', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
await page.waitForTimeout(400);

const result = await page.evaluate(async (swatches) => {
  const THREE = await import('/node_modules/.vite/deps/three.js?import').catch(() => null)
    ?? await import('three');
  const stage = window.__stage;
  if (!stage) return { error: 'no window.__stage' };

  const cam = stage.rig.camera;
  // Full-screen-ish quad grid parented to the camera so it always fills the view and
  // is unaffected by any scene lighting or fog.
  const grp = new THREE.Group();
  grp.name = '__probe';
  const dist = 2;
  const vFov = (cam.fov * Math.PI) / 180;
  const h = 2 * Math.tan(vFov / 2) * dist;
  const w = h * cam.aspect;
  const n = swatches.length;
  const cw = w / n;
  swatches.forEach(([, hex], i) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), fog: false });
    mat.toneMapped = false;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.98, h * 0.5), mat);
    q.position.set(-w / 2 + cw * (i + 0.5), 0, -dist);
    q.frustumCulled = false;
    grp.add(q);
  });
  cam.add(grp);
  stage.scene.add(cam);

  // Render one frame through the composer, then read back.
  stage.render(1 / 60);
  await new Promise((r) => requestAnimationFrame(r));
  stage.render(1 / 60);

  const gl = stage.renderer.getContext();
  const cv = stage.renderer.domElement;
  const W = cv.width, H = cv.height;
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);

  const rows = [];
  swatches.forEach(([name, hex], i) => {
    // Sample the centre of each swatch (readPixels origin is bottom-left).
    const x = Math.round(W * ((i + 0.5) / n));
    const y = Math.round(H * 0.5);
    const o = (y * W + x) * 4;
    rows.push({ name, hex, out: [px[o], px[o + 1], px[o + 2]] });
  });

  cam.remove(grp);
  return { rows, W, H };
}, SWATCHES);

if (result.error) { console.error(result.error); await browser.close(); process.exit(1); }

function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function hue(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let hh;
  if (mx === r) hh = ((g - b) / d) % 6;
  else if (mx === g) hh = (b - r) / d + 2;
  else hh = (r - g) / d + 4;
  hh *= 60; if (hh < 0) hh += 360;
  return hh;
}
function sat(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; }

console.log(`\n=== POST-CHAIN SWATCH PROBE (${label}) — unlit quads, authored -> measured ===`);
console.log('name                  authored          measured        dHue   satIn->satOut  clipped');
const out = [];
for (const row of result.rows) {
  const a = hexToRgb(row.hex);
  const m = row.out;
  let dh = hue(...m) - hue(...a);
  if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  const clipLo = m.some((v, i) => v === 0 && a[i] > 0);
  const clipHi = m.some((v, i) => v === 255 && a[i] < 255);
  const flag = clipLo ? 'FLOOR->0' : clipHi ? 'CEIL->255' : '';
  console.log(
    `${row.name.padEnd(20)}  ${String(a).padEnd(16)}  ${String(m).padEnd(15)} ` +
    `${dh.toFixed(1).padStart(6)}   ${sat(...a).toFixed(2)}->${sat(...m).toFixed(2)}     ${flag}`,
  );
  out.push({ name: row.name, authored: a, measured: m, dHue: +dh.toFixed(2), satIn: +sat(...a).toFixed(3), satOut: +sat(...m).toFixed(3), flag });
}
await mkdir('shots/light2', { recursive: true });
await writeFile(`shots/light2/probe_${label}.json`, JSON.stringify(out, null, 2));
console.log(`\nwrote shots/light2/probe_${label}.json`);
await browser.close();
