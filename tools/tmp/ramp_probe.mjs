#!/usr/bin/env node
/**
 * THROWAWAY: is SATURATION still a dimension an author can use?
 *
 * Renders a ramp of unlit swatches at constant hue and value with authored HSV
 * saturation stepping 0.10 -> 1.00, and reports what arrives. If the measured values
 * flatten out, the palette has lost the top of its saturation range no matter how
 * few channels are literally clipped.
 *
 * Usage: node tools/tmp/ramp_probe.mjs [--sat 0.70] [--hk 0.78]
 */
import { chromium } from 'playwright';
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? Number(a[a.indexOf(k) + 1]) : d);
const SATS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const HUES = [30, 200];   // warm orange (grout/cabinet band) and cyan (steel/freezer band)

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto('http://localhost:5173/?player=hamburger&enemy=donut', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
await page.waitForTimeout(300);

const sweeps = [];
for (const hue of HUES) {
  const swatches = SATS.map((s) => {
    // HSV -> RGB at V = 0.72 so nothing is near either bound before the grade.
    const v = 0.72, c = v * s, h = hue / 60, x = c * (1 - Math.abs((h % 2) - 1)), m = v - c;
    const t = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x]
      : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return t.map((u) => Math.round((u + m) * 255));
  });
  const rows = await page.evaluate(async ({ swatches, sat, hk }) => {
    const THREE = await import('/node_modules/.vite/deps/three.js?import');
    const stage = window.__stage;
    if (sat >= 0) stage.grade.saturation = sat;
    if (hk >= 0) stage.grade.highlightKnee = hk;
    const cam = stage.rig.camera;
    const grp = new THREE.Group();
    const dist = 2, vFov = (cam.fov * Math.PI) / 180;
    const h = 2 * Math.tan(vFov / 2) * dist, w = h * cam.aspect, n = swatches.length, cw = w / n;
    swatches.forEach((rgb, i) => {
      const mat = new THREE.MeshBasicMaterial({ fog: false });
      mat.color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
      mat.toneMapped = false;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.98, h * 0.5), mat);
      q.position.set(-w / 2 + cw * (i + 0.5), 0, -dist);
      q.frustumCulled = false;
      grp.add(q);
    });
    cam.add(grp); stage.scene.add(cam);
    stage.render(1 / 60);
    await new Promise((r) => requestAnimationFrame(r));
    stage.render(1 / 60);
    const gl = stage.renderer.getContext(), cv = stage.renderer.domElement;
    const W = cv.width, H = cv.height;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out = swatches.map((rgb, i) => {
      const x = Math.round(W * ((i + 0.5) / n)), y = Math.round(H * 0.5), o = (y * W + x) * 4;
      return { in: rgb, out: [px[o], px[o + 1], px[o + 2]] };
    });
    cam.remove(grp);
    return out;
  }, { swatches, sat: get('--sat', -1), hk: get('--hk', -1) });
  sweeps.push({ hue, rows });
}

const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const hue = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
};
for (const s of sweeps) {
  console.log(`\n--- hue ${s.hue}deg, V 0.72, authored S 0.10 -> 1.00 ---`);
  console.log('authoredS  measuredS  step   measuredV  dHue   rgb');
  let prev = null;
  for (let i = 0; i < s.rows.length; i++) {
    const r = s.rows[i];
    const ms = sat(...r.out), mv = Math.max(...r.out) / 255;
    let dh = hue(...r.out) - hue(...r.in); if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    const step = prev === null ? '' : (ms - prev >= 0.005 ? '+' : ms - prev > 0 ? '~' : 'FLAT');
    console.log(`  ${SATS[i].toFixed(2)}       ${ms.toFixed(3)}     ${(prev === null ? 0 : ms - prev).toFixed(3)} ${step.padEnd(5)} `
      + `${mv.toFixed(3)}    ${dh.toFixed(1).padStart(5)}   ${r.out.join(',')}`);
    prev = ms;
  }
}
await browser.close();
