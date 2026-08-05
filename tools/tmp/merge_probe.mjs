import { chromium } from 'playwright';
const LAUNCH_ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const base = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url')+1] : 'http://localhost:5194';
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport:{width:1300,height:740}, deviceScaleFactor:1 });
page.on('pageerror', e=>console.error('PAGEERROR', String(e)));
await page.route('**/@vite/client*', r=>r.fulfill({status:200,contentType:'text/javascript',body:`const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=u=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`}));
await page.goto(`${base}/?player=hamburger&enemy=donut&simSpeed=12`, {waitUntil:'networkidle',timeout:60000});
await page.waitForFunction('window.__gameReady === true', null, {timeout:60000});
await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, {timeout:90000});
await page.waitForTimeout(600);
await page.evaluate(()=>{ window.requestAnimationFrame = ()=>0; });
await page.waitForTimeout(300);
const out = await page.evaluate(async () => {
  const toon = await import('/src/render/toon.ts');
  const stage = window.__stage; const r = stage.renderer; r.info.autoReset = false;
  const gl = r.getContext(); const cv = r.domElement; const W=cv.width,H=cv.height;
  const read=()=>{const p=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  const measure=()=>{ stage.markShadowsDirty(); r.info.reset(); stage.render(1/60); return r.info.render.calls; };
  const count=()=>{ let n=0; stage.scene.traverse(o=>{ if(o.isMesh && /__outline$/.test(o.name||'')) n++; }); return n; };
  const drawsA = measure(); const A = read(); const hullsA = count();
  // Merge the arena's hulls only — find the group that owns the 0.016 ink.
  let removed = 0; const merged = [];
  for (const child of stage.scene.children) {
    // ARENA ONLY: skip any subtree that carries character ink (0.004), because a
    // character rig animates its joints and a baked hull would freeze in bind pose.
    let hasCharInk = false, hulls = 0;
    child.traverse((o) => {
      if (!o.isMesh || !/__outline$/.test(o.name || '')) return;
      hulls++;
      const t = o.material?.uniforms?.outlineThickness?.value ?? -1;
      if (t > 0 && t < 0.005) hasCharInk = true;
    });
    if (!hulls || hasCharInk) continue;
    const n = toon.mergeOutlines(child);
    if (n) { removed += n; merged.push(`${child.name || child.type}:${n}`); }
  }
  const drawsB = measure(); const B = read(); const hullsB = count();
  let sum=0,max=0,changed=0; for(let i=0;i<A.length;i+=4){const d=Math.max(Math.abs(A[i]-B[i]),Math.abs(A[i+1]-B[i+1]),Math.abs(A[i+2]-B[i+2]));sum+=d;if(d>max)max=d;if(d>2)changed++;}
  const n=A.length/4;
  return { drawsA, drawsB, hullsA, hullsB, removed, merged, meanDiff:sum/n, maxDiff:max, changedPct:100*changed/n };
});
console.log(JSON.stringify(out,null,1));
await browser.close();
