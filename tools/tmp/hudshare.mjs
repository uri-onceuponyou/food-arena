/**
 * Probe: does arena-scan's "<id>.canvas.png (canvas only, no HUD)" actually exclude the
 * DOM HUD, and if not, how much of the colour budget is HUD rather than arena?
 *
 * Playwright element screenshots capture the COMPOSITED page clipped to the element box,
 * so an overlay painted above the canvas lands in the "canvas only" file.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5187');
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=700&py=640&fogRadius=850&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(1200);

const box0 = await page.locator('canvas').first().boundingBox();
const buf0 = await page.evaluate(() => { const c = document.querySelector('canvas'); return [c.width, c.height]; });
await page.locator('canvas').first().screenshot({ path: 'tools/tmp/_hud_on.png' });

const hidden = await page.evaluate(() => {
  const roots = [...document.querySelectorAll('.hud-root, #screens, #hud, [class*="hud"]')].filter((e) => !e.closest('canvas'));
  const seen = [];
  for (const e of roots) { seen.push(e.className || e.id); e.style.visibility = 'hidden'; }
  return seen;
});
await page.waitForTimeout(250);
const box1 = await page.locator('canvas').first().boundingBox();
const buf1 = await page.evaluate(() => { const c = document.querySelector('canvas'); return [c.width, c.height]; });
await page.locator('canvas').first().screenshot({ path: 'tools/tmp/_hud_off.png' });
await browser.close();

console.log('hidden elements:', hidden);
console.log('canvas css box  ON', box0, ' OFF', box1);
console.log('drawing buffer  ON', buf0, ' OFF', buf1);

const grab = async (p) => (await sharp(p).resize(320, 180, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;
const A = await grab('tools/tmp/_hud_on.png'), B = await grab('tools/tmp/_hud_off.png');
const n = 320 * 180;
let changed = 0;
const budget = (data, mask, want) => {
  let sat = 0, warm = 0, cool = 0, px = 0;
  for (let i = 0; i < n; i++) {
    if (mask && (mask[i] === 1) !== want) continue;
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2 / 255;
    const s = d === 0 ? 0 : (l > 0.5 ? d / (510 - mx - mn) : d / (mx + mn));
    sat += s; px++;
    if (s < 0.15) continue;
    let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = ((h * 60) % 360 + 360) % 360;
    if (h < 60) warm += s; else cool += s;
  }
  return { px, pct: +(100 * px / n).toFixed(2), meanSatFrame: +(sat / n).toFixed(4), warm: +(warm / n).toFixed(4), cool: +(cool / n).toFixed(4) };
};
const mask = new Uint8Array(n);
for (let i = 0; i < n; i++) {
  const d = Math.max(Math.abs(A[i * 3] - B[i * 3]), Math.abs(A[i * 3 + 1] - B[i * 3 + 1]), Math.abs(A[i * 3 + 2] - B[i * 3 + 2]));
  if (d > 8) { mask[i] = 1; changed++; }
}
console.log(`\nHUD pixels in the "canvas only" capture: ${changed}/${n} = ${(100 * changed / n).toFixed(2)}%`);
console.log('whole frame WITH hud   ', budget(A, null, true));
console.log('whole frame WITHOUT hud', budget(B, null, true));
console.log('HUD region only        ', budget(A, mask, true));
console.log('arena region only      ', budget(A, mask, false));
