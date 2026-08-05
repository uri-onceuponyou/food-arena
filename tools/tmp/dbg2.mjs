import { chromium } from 'playwright';
const LAUNCH_ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const b=await chromium.launch({args:LAUNCH_ARGS});
for (let i=0;i<3;i++){
  const p=await b.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
  p.on('framenavigated',f=>{ if(f===p.mainFrame()) console.log('  NAVIGATED ->',f.url()); });
  p.on('console',m=>{ const t=m.text(); if(/hmr|reload|update/i.test(t)) console.log('  CONSOLE:',t); });
  await p.goto('http://localhost:5173/?player=hamburger&enemy=donut',{waitUntil:'networkidle'});
  await p.waitForFunction('window.__previewReady === true',null,{timeout:45000});
  await p.waitForTimeout(260);
  console.log(i, await p.evaluate(()=>({fair:typeof window.__fairView, ready:window.__gameReady})));
  await p.close();
}
await b.close();
