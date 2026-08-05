import { chromium } from 'playwright';
const A = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const b = await chromium.launch({ args: A });
for (const [w,h,label] of [[1300,740,'16:9'],[1680,720,'21:9'],[1000,750,'4:3']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto('http://localhost:5173/?player=hamburger&enemy=donut', { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
  const gw = await p.evaluate(() => window.__fairView?.());
  console.log(label, JSON.stringify(gw));
  await p.close();
}
await b.close();
