#!/usr/bin/env node
/** THROWAWAY: sweep grade parameters against the frame census, one page load. */
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

const GRID = [];
for (const hk of [0.70, 0.78, 0.86, 1.5]) for (const sat of [0.40, 0.55, 0.70]) GRID.push({ hk, sat });

const rows = await page.evaluate((GRID) => {
  const stage = window.__stage;
  const gl = stage.renderer.getContext();
  const cv = stage.renderer.domElement;
  const W = cv.width, H = cv.height;
  const grade = stage.grade;
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
  for (const g of GRID) {
    grade.highlightKnee = g.hk; grade.saturation = g.sat;
    out.push({ ...g, ...census() });
  }
  return out;
}, GRID);

console.log('\nhlKnee  sat    anyChan==0  anyChan==255  meanSat  meanVal');
for (const r of rows) {
  console.log(`${r.hk.toFixed(2)}    ${r.sat.toFixed(2)}   ${r.zeroPct.toFixed(2).padStart(6)}%      ${r.fullPct.toFixed(2).padStart(6)}%     ${r.meanSat.toFixed(3)}    ${r.meanVal.toFixed(3)}`);
}
console.log('\nbaseline (old chain): anyChan==0 9.39%  anyChan==255 10.60%  meanSat 0.503  meanVal 0.662');
await browser.close();
