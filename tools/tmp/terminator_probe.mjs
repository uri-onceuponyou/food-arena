#!/usr/bin/env node
/**
 * THROWAWAY: how much of this rig's light is orientation-INDEPENDENT?
 *
 * Drops a neutral matte sphere into the live scene next to the player and reads the
 * value of the point facing the key against the point facing away. A rig whose light
 * is all flat fill returns a ratio near 1.0 and every rounded form reads as a sticker;
 * a rig that models volume returns roughly 0.4-0.55.
 *
 * Also reports the per-source breakdown by switching sources off one at a time.
 *
 * Usage: node tools/tmp/terminator_probe.mjs
 */
import { chromium } from 'playwright';
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto('http://localhost:5173/?player=hamburger&enemy=donut&simSpeed=12', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 60000 });
await page.waitForTimeout(400);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(200);

const out = await page.evaluate(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js?import');
  const stage = window.__stage;
  const scene = stage.scene;
  const L = stage.lighting;

  // A neutral 0.5-grey matte ball at the player's feet, big enough to sample.
  const probe = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 64, 48),
    new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.6, metalness: 0 }),
  );
  probe.castShadow = true; probe.receiveShadow = true;
  const p = window.__vfxDebugScreen ? null : null;
  probe.position.copy(stage.rig.camera.position).add(
    stage.rig.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(28));
  probe.position.y = 1.2;
  scene.add(probe);

  const gl = stage.renderer.getContext(), cv = stage.renderer.domElement;
  const W = cv.width, H = cv.height;
  const px = new Uint8Array(W * H * 4);

  // Screen-project a point on the sphere with the given world normal.
  const project = (n) => {
    const wp = probe.position.clone().add(n.clone().multiplyScalar(0.86));
    const v = wp.project(stage.rig.camera);
    return { x: Math.round((v.x * 0.5 + 0.5) * W), y: Math.round((v.y * 0.5 + 0.5) * H) };
  };
  const keyDir = L.key.position.clone().sub(L.key.target.position).normalize();
  const away = keyDir.clone().negate();
  // Both sample points must be on the camera-facing hemisphere; tilt them toward
  // the camera so neither is hidden behind the sphere.
  const toCam = stage.rig.camera.position.clone().sub(probe.position).normalize();
  const litN = keyDir.clone().multiplyScalar(0.75).add(toCam.clone().multiplyScalar(0.65)).normalize();
  const darkN = away.clone().multiplyScalar(0.75).add(toCam.clone().multiplyScalar(0.65)).normalize();
  const topN = new THREE.Vector3(0, 1, 0).multiplyScalar(0.7).add(toCam.clone().multiplyScalar(0.7)).normalize();

  const sample = (pt) => {
    let s = 0, n = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = pt.x + dx, y = pt.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      s += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255; n++;
    }
    return n ? s / n : 0;
  };
  const shot = () => {
    stage.render(1 / 60); stage.render(1 / 60);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const lit = sample(project(litN)), dark = sample(project(darkN)), top = sample(project(topN));
    return { lit, dark, top, ratio: lit > 0 ? dark / lit : 1 };
  };

  const rows = [];
  rows.push(['as shipped', shot()]);
  const envI = scene.environmentIntensity, amb = L.ambient.intensity,
    fill = L.fill.intensity, rim = L.rim.intensity, key = L.key.intensity;
  scene.environmentIntensity = 0; rows.push(['-IBL', shot()]); scene.environmentIntensity = envI;
  L.ambient.intensity = 0; rows.push(['-ambient', shot()]); L.ambient.intensity = amb;
  L.fill.intensity = 0; rows.push(['-hemi fill', shot()]); L.fill.intensity = fill;
  L.rim.intensity = 0; rows.push(['-rim', shot()]); L.rim.intensity = rim;
  L.key.intensity = 0; rows.push(['-KEY (all indirect)', shot()]); L.key.intensity = key;
  scene.environmentIntensity = 0; L.ambient.intensity = 0; L.fill.intensity = 0; L.rim.intensity = 0;
  rows.push(['KEY ONLY', shot()]);
  scene.environmentIntensity = envI; L.ambient.intensity = amb; L.fill.intensity = fill; L.rim.intensity = rim;

  scene.remove(probe);
  return rows;
});

console.log('\nneutral matte sphere — value at the point facing the key vs facing away');
console.log('config                 lit     away    top     away/lit');
for (const [n, r] of out) {
  console.log(`${n.padEnd(20)}  ${r.lit.toFixed(3)}   ${r.dark.toFixed(3)}   ${r.top.toFixed(3)}   ${r.ratio.toFixed(3)}`);
}
console.log('\ntarget: away/lit <= 0.55 (a form that reads as a solid volume)');
await browser.close();
