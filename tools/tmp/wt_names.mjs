import { chromium } from 'playwright';
const a=process.argv; const url=a[a.indexOf('--url')+1];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox']});
const p=await b.newPage({viewport:{width:1300,height:740},deviceScaleFactor:1});
await p.goto(`${url}/?player=hamburger&enemy=donut&px=1950&py=1100&fogRadius=1200&simSpeed=0.02&pointerLock=0`,{waitUntil:'networkidle',timeout:120000});
await p.waitForFunction('window.__gameReady === true',null,{timeout:120000});
await p.waitForTimeout(2500);
const out=await p.evaluate(async()=>{
  const s=window.__stage,r=s.renderer;
  const orig=r.renderBufferDirect.bind(r);
  const rec=[];
  let capture=false;
  r.renderBufferDirect=(cam,scene,geo,mat,obj,grp)=>{
    if(capture) rec.push(`${obj.name||'(unnamed)'}|${mat.name||mat.type}|${geo.index?geo.index.count/3:geo.attributes.position.count/3}`);
    return orig(cam,scene,geo,mat,obj,grp);
  };
  await new Promise(res=>requestAnimationFrame(()=>{capture=true;requestAnimationFrame(()=>{capture=false;res();});}));
  r.renderBufferDirect=orig;
  return rec;
});
console.log(JSON.stringify(out));
await b.close();
