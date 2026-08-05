/**
 * Is the opening screen's hero-fill regression MINE?
 *
 * menu_accept's `hero-fills-its-panel` reads window.__charStage()'s PROJECTED vertex
 * positions, not pixels. This pass changed two things on opening.ts: a mask-image on
 * the stage wrapper and a background + mix-blend-mode on a sibling overlay. Neither
 * can move a projected vertex — but "cannot" is a claim, so this measures it: sample
 * the number, then null out both declarations at runtime and sample again. Runtime
 * rather than a file edit, so the comparison is on ONE page load with one animation
 * phase and the idle sway cannot be mistaken for the effect.
 */
/**
 * capture-audit: css-immune — the verdict is `window.__charStage()`, an NDC projection through the 3D camera. It is
 * derived from the canvas LAYOUT size, which a `scale()` transform does not change, so
 * `fa-screen-in` cannot move it. (The 2500ms sleep below is for the idle animation, not
 * for the fade.)
 */
import { chromium } from 'playwright';
const A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const base=process.env.PREVIEW_BASE;
const b=await chromium.launch({args:A});
const p=await b.newPage({viewport:{width:844,height:390},deviceScaleFactor:1});
// The notched variant, which is the one that fails.
await p.addInitScript(()=>{ addEventListener('DOMContentLoaded',()=>{
  const de=document.documentElement;
  de.style.setProperty('--fa-safe-t','0px'); de.style.setProperty('--fa-safe-r','44px');
  de.style.setProperty('--fa-safe-b','21px'); de.style.setProperty('--fa-safe-l','44px');
});});
await p.goto(`${base}/?screen=opening&hold=600000`,{waitUntil:'domcontentloaded',timeout:90000});
await p.waitForFunction('window.__screen==="opening" && window.__screenReady===true',null,{timeout:90000});
await p.waitForTimeout(2500);

const read=async(tag)=>{
  // Ten samples across ~1s of idle animation: the arms sway, so ONE sample cannot
  // tell a real change from the pose it happened to catch.
  const xs=[];
  for(let i=0;i<10;i++){
    xs.push(await p.evaluate(()=>{const h=window.__charStage?.(); return h? Math.abs(h.right.x-h.left.x):null;}));
    await p.waitForTimeout(110);
  }
  const v=xs.filter(Number.isFinite);
  console.log(`${tag.padEnd(22)} n=${v.length} min=${Math.min(...v).toFixed(3)} max=${Math.max(...v).toFixed(3)} mean=${(v.reduce((a,c)=>a+c,0)/v.length).toFixed(3)}`);
  return v;
};
await read('WITH this pass CSS');
await p.evaluate(()=>{
  const s=document.createElement('style');
  s.textContent='.fa-opening .open-stage-3d{-webkit-mask-image:none!important;mask-image:none!important}'
    +'.fa-opening .open-glow{background:none!important;mix-blend-mode:normal!important}';
  document.head.appendChild(s);
});
await p.waitForTimeout(400);
await read('mask+glow DISABLED');
await b.close();
