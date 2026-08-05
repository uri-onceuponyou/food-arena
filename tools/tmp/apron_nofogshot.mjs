/** NW corner + W mid with the fog canopy pushed far out, so the far apron is visible. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const LAUNCH_ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const out = process.argv[2] ?? 'shots/apron/r5_nofog';
const apronOff = process.argv[3] === '0';
await mkdir(out, { recursive: true });
const SHOTS = [['nw_corner',21,21,1680,720],['w_mid',21,500,1680,720],['sw_corner',21,979,1680,720]];
const b = await chromium.launch({ args: LAUNCH_ARGS });
for (const [name,px,py,w,h] of SHOTS) {
  const page = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
  page.setDefaultTimeout(60000);
  const q = new URLSearchParams({ ...(apronOff?{apron:'0'}:{}), player:'hamburger', enemy:'donut', simSpeed:'0.02', fogRadius:'4000', px:String(px), py:String(py) });
  await page.goto(`http://localhost:5173/?${q}`, { waitUntil:'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout:45000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('wrote', name);
  await page.close();
}
await b.close();
