import { chromium } from 'playwright';
const BASE=process.env.PREVIEW_BASE;
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox']});
const p=await b.newPage({viewport:{width:900,height:600}});
p.on('console',m=>{ if(m.type()==='error') console.log('[err]',m.text()); });
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=850&py=500&fogRadius=545&simSpeed=1&pointerLock=0&aimMode=free`,{waitUntil:'networkidle',timeout:90000});
await p.waitForFunction('window.__gameReady === true',null,{timeout:90000});
for (const t of [0,1,2,3,4,5]) {
  await p.waitForTimeout(1000);
  const s = await p.evaluate('JSON.stringify({f:window.__vfxDebugFighters, vis:document.visibilityState, hid:document.hidden})');
  console.log(`t=${t}s`, s.slice(0,220));
}
await b.close();
