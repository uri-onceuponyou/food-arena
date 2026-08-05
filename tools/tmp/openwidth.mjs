/**
 * Sweep the title card's stage width against the hero-fill metric.
 *
 * menu_accept's `hero-fills-its-panel` floor (0.42) started failing on ONE viewport —
 * 844x390 with a notch — after charStage was rebuilt into a real 3D set. Proven not to
 * be this pass's CSS (tools/tmp/openframe.mjs: disabling the mask and the glow moves
 * the number DOWN, i.e. the variation is idle sway). The remaining lever that lives in
 * opening.ts is the panel's own aspect: `.open-stage { width: min(100%, 70vh) }` makes
 * a tall narrow box on a 390px-tall phone, and the metric is character width over
 * PANEL width, so a narrower panel raises it — until the character starts being fit by
 * width instead of height, at which point it stops helping and starts shrinking the
 * hero. This finds that knee instead of guessing at it.
 */
/**
 * capture-audit: css-immune — same as openframe.mjs — `window.__charStage()` NDC projections through the 3D camera,
 * unreachable by a CSS transform.
 */
import { chromium } from 'playwright';
const A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const base=process.env.PREVIEW_BASE;
const b=await chromium.launch({args:A});
for (const [name,W,H,notch] of [['phone-notch',844,390,true],['phone',844,390,false],['desktop',1600,900,false],['tablet',1024,768,true]]) {
  const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
  if(notch) await p.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>{const d=document.documentElement;
    d.style.setProperty('--fa-safe-t','0px');d.style.setProperty('--fa-safe-r','44px');
    d.style.setProperty('--fa-safe-b','21px');d.style.setProperty('--fa-safe-l','44px');});});
  await p.goto(`${base}/?screen=opening&hold=600000`,{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction('window.__screen==="opening" && window.__screenReady===true',null,{timeout:90000});
  await p.waitForTimeout(2200);
  const row=[];
  for (const vh of [70,64,58,52,46,40]) {
    await p.evaluate((vh)=>{
      let s=document.getElementById('sweep'); if(!s){s=document.createElement('style');s.id='sweep';document.head.appendChild(s);}
      s.textContent=`.fa-opening .open-stage{width:min(100%, ${vh}vh)!important}`;
      dispatchEvent(new Event('resize'));
    }, vh);
    await p.waitForTimeout(650);
    // Six samples through the idle cycle; report the WORST, because the gate samples once.
    const xs=[];
    for(let i=0;i<6;i++){ xs.push(await p.evaluate(()=>{const h=window.__charStage?.();return h?{w:Math.abs(h.right.x-h.left.x),h:Math.abs(h.feet.y-h.crown.y),inf:h.left.x>=-0.005&&h.right.x<=1.005&&h.crown.y>=-0.005&&h.feet.y<=1.005}:null;})); await p.waitForTimeout(90); }
    const v=xs.filter(Boolean);
    row.push(`${vh}vh:${Math.min(...v.map(o=>o.w)).toFixed(3)}/${Math.max(...v.map(o=>o.h)).toFixed(2)}${v.every(o=>o.inf)?'':' OUT!'}`);
  }
  console.log(`${name.padEnd(13)} ${row.join('  ')}`);
  await p.close();
}
await b.close();
console.log('\nformat  <vh>:<worst width frac>/<height frac>   floor 0.42');
