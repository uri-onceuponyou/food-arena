import { chromium } from 'playwright';
const A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const base=process.env.PREVIEW_BASE;
const b=await chromium.launch({args:A});
for (const [name,w,h,touch] of [['touch',844,390,true],['desk',1600,900,false]]) {
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  await p.goto(`${base}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&simSpeed=0.02`,{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction('window.__gameReady === true',null,{timeout:120000});
  if(touch) await p.evaluate(()=>document.documentElement.classList.add('fa-touch-capable'));
  await p.waitForTimeout(1200);
  await p.screenshot({path:`shots/screen_m/match-${name}.png`,timeout:120000});
  await p.close();
}
await b.close(); console.log('ok');
