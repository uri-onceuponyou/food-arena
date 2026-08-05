#!/usr/bin/env node
/** THROWAWAY: where does the white clipping come from — the render or the grade? */
import { chromium } from 'playwright';
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(get('--url', 'http://localhost:5173/?player=hamburger&enemy=donut&simSpeed=12'), { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction('window.__previewReady === true || window.__gameReady === true', null, { timeout: 45000 });
await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(400);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(200);

const rows = await page.evaluate(() => {
  const stage = window.__stage;
  const gl = stage.renderer.getContext();
  const cv = stage.renderer.domElement;
  const W = cv.width, H = cv.height;
  const fx = stage.composer.passes.flatMap((p) => p.effects ?? []);
  const bloom = fx.find((e) => e.name === 'BloomEffect');
  const grade = fx.find((e) => /Grade|HueSat/.test(e.name));
  const contrast = fx.find((e) => e.name === 'BrightnessContrastEffect');
  const vig = fx.find((e) => e.name === 'VignetteEffect');
  const census = () => {
    stage.render(1 / 60); stage.render(1 / 60);
    const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p);
    let zero = 0, full = 0, sat = 0, val = 0, n = 0;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2]; n++;
      if (r === 0 || g === 0 || b === 0) zero++;
      if (r === 255 || g === 255 || b === 255) full++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      val += mx / 255; sat += mx === 0 ? 0 : (mx - mn) / mx;
    }
    return { zeroPct: 100 * zero / n, fullPct: 100 * full / n, meanSat: sat / n, meanVal: val / n };
  };
  const out = [];
  out.push(['as shipped', census()]);
  if (vig) { vig.blendMode.blendFunction = 9; out.push(['-vignette', census()]); }
  if (grade) { grade.blendMode.blendFunction = 9; out.push(['-grade', census()]); }
  if (contrast) { contrast.blendMode.blendFunction = 9; out.push(['-contrast', census()]); }
  if (bloom) { bloom.blendMode.blendFunction = 9; out.push(['-bloom (raw render)', census()]); }
  return out;
});
console.log('\nstage                 anyChan==0   anyChan==255   meanSat  meanVal');
for (const [n, r] of rows) {
  console.log(`${n.padEnd(20)}  ${r.zeroPct.toFixed(2).padStart(6)}%     ${r.fullPct.toFixed(2).padStart(6)}%      ${r.meanSat.toFixed(3)}    ${r.meanVal.toFixed(3)}`);
}
await browser.close();
