import { chromium } from 'playwright';
const runs = [
  { name: 'plain-headless', headless: true, args: [] },
  { name: 'headed', headless: false, args: [] },
  { name: 'headless+flags', headless: true, args: ['--enable-features=PointerLockOptions','--disable-features=PointerLockNotification'] },
];
for (const cfg of runs) {
  const b = await chromium.launch({ headless: cfg.headless, args: cfg.args });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  await p.setContent('<body style="margin:0"><div id="t" style="width:800px;height:600px;background:#333"></div><script>window.res="none";const t=document.getElementById("t");t.addEventListener("click",()=>{try{const r=t.requestPointerLock();if(r&&r.then)r.then(()=>{window.res="ok-promise"},e=>{window.res="rej:"+e.name+":"+e.message});}catch(e){window.res="throw:"+e.message}});document.addEventListener("pointerlockchange",()=>{window.res2=document.pointerLockElement?"LOCKED":"unlocked"});document.addEventListener("pointerlockerror",()=>{window.res3="ERROR"});<\/script></body>');
  await p.click('#t');
  await p.waitForTimeout(600);
  console.log(cfg.name, await p.evaluate(() => ({ res: window.res, res2: window.res2, res3: window.res3, el: document.pointerLockElement?.id ?? null })));
  await b.close();
}
