#!/usr/bin/env node
/**
 * Safe-area + first-run affordance check for the touch controls.
 * Injects a simulated landscape-iPhone notch on <html> (the same technique
 * tools/tmp/menu_accept.mjs uses) and measures every HUD element the touch work moved.
 */
import { chromium } from 'playwright';
const url = process.argv[process.argv.indexOf('--url')+1];
const SAFE = { t: 0, r: 44, b: 21, l: 44 };
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, hasTouch:true, isMobile:true, deviceScaleFactor:1 });
const p = await ctx.newPage();
await p.goto(url+'/?player=hamburger&enemy=donut', { waitUntil:'networkidle' });
await p.waitForFunction('window.__gameReady===true',null,{timeout:90000});
await p.waitForFunction(()=>document.querySelector('.hud-countdown')?.style.display==='none',null,{timeout:60000});
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/touch/first-run-hints.png' });

await p.evaluate((s)=>{ const st=document.documentElement.style;
  st.setProperty('--fa-safe-t',s.t+'px'); st.setProperty('--fa-safe-r',s.r+'px');
  st.setProperty('--fa-safe-b',s.b+'px'); st.setProperty('--fa-safe-l',s.l+'px');
  document.documentElement.classList.add('fa-touch'); }, SAFE);
await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/touch/notch.png' });
const rects = await p.evaluate(()=>{
  const out={}; const vw=innerWidth, vh=innerHeight;
  const grab=(sel,key)=>{ const el=document.querySelector(sel); if(!el) return;
    const r=el.getBoundingClientRect();
    out[key]={L:Math.round(r.left),T:Math.round(r.top),R:Math.round(vw-r.right),B:Math.round(vh-r.bottom)}; };
  grab('.hud-topbar','topbar'); grab('.hud-weapons','weapons'); grab('.hud-radar','radar');
  grab('.hud-mute','mute'); grab('.tch-hint--move','hintMove'); grab('.tch-hint--aim','hintAim');
  return out;
});
console.log(JSON.stringify(rects,null,1));
const bad = Object.entries(rects).filter(([k,r])=> r.L < 44-1 || r.R < 44-1 || r.B < 21-1 || r.T < -1);
console.log(bad.length ? 'INSIDE THE INSET BAND: '+JSON.stringify(bad) : 'all measured elements clear the notch band');
await b.close();
