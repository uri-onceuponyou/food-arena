#!/usr/bin/env node
/**
 * Measure the ACTUAL visible ground rectangle by unprojecting the four NDC corners
 * onto the y=0 plane in the live game, then report how far past the arena bounds a
 * legal player position can see.
 */
import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const VIEWPORTS = [
  { name: '4:3', w: 1200, h: 900 },
  { name: '16:9', w: 1600, h: 900 },
  { name: '21:9', w: 1680, h: 720 },
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  for (const v of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    const url = `${BASE}/?player=hamburger&enemy=donut&px=21&py=500`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
    await page.waitForTimeout(600);
    const out = await page.evaluate(() => {
      const THREE = window.__THREE;
      const cam = window.__gameCamera;
      if (!cam) return { err: 'no camera hook' };
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      const pts = corners.map(([x, y]) => {
        const a = new THREE.Vector3(x, y, -1).unproject(cam);
        const b = new THREE.Vector3(x, y, 1).unproject(cam);
        const dir = b.clone().sub(a).normalize();
        const t = -a.y / dir.y;
        const p = a.clone().add(dir.multiplyScalar(t));
        return { x: p.x / 0.05, y: p.z / 0.05 };
      });
      return { pts, camPos: { x: cam.position.x, y: cam.position.y, z: cam.position.z }, player: window.__playerPos };
    });
    console.log(v.name, JSON.stringify(out));
    await page.close();
  }
} finally {
  await browser.close();
}
