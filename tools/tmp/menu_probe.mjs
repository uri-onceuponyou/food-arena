import { chromium } from 'playwright';
const ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const b = await chromium.launch({ args: ARGS });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle', timeout:45000 });
await p.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
await p.waitForTimeout(400);
const info = await p.evaluate(() => {
  const host = document.querySelector('.home-stage-3d');
  const canvas = host?.querySelector('canvas');
  return {
    screen: window.__screen,
    hostRect: host ? { w: host.clientWidth, h: host.clientHeight } : null,
    canvasRect: canvas ? { w: canvas.clientWidth, h: canvas.clientHeight, bw: canvas.width, bh: canvas.height } : null,
    canvasCount: document.querySelectorAll('canvas').length,
  };
});
console.log(JSON.stringify(info, null, 2));
console.log("charStage:", JSON.stringify(await p.evaluate(() => window.__charStage?.() ?? null)));
console.log('errors:', errs.slice(0, 6));
await b.close();
