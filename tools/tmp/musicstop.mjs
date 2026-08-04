import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:1200,height:700} });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForTimeout(2500);
await p.mouse.click(600, 350);           // gesture -> unlock
await p.waitForTimeout(4000);
const measure = () => p.evaluate(() => new Promise(res => {
  const eng = window.__audio; const ctx = eng?.engine.context; if (!ctx) return res(null);
  const sp = ctx.createScriptProcessor(2048, 2, 1);
  let peak=0,sum=0,n=0,blocks=0;
  sp.onaudioprocess = e => { const d=e.inputBuffer.getChannelData(0);
    for(let i=0;i<d.length;i++){const v=Math.abs(d[i]); if(v>peak)peak=v; sum+=d[i]*d[i]; n++;}
    if(++blocks>=45){ sp.disconnect(); res({peak:+peak.toFixed(4), rms:+Math.sqrt(sum/n).toFixed(4)}); } };
  sp.connect(ctx.destination); eng.connectTap(sp);
  setTimeout(()=>{try{sp.disconnect();}catch{} res({peak:+peak.toFixed(4),rms:+Math.sqrt(sum/Math.max(1,n)).toFixed(4),to:true});},6000);
}));
console.log('screen:', await p.evaluate(()=>window.__screen), ' ->', JSON.stringify(await measure()));
await p.evaluate(() => window.__shell?.navigate({name:'match', player:'hamburger', enemy:'donut'}));
await p.waitForTimeout(3500);            // let the fade complete
const inMatch = await measure();
console.log('screen:', await p.evaluate(()=>window.__screen), ' ->', JSON.stringify(inMatch));
await p.evaluate(() => window.__shell?.navigate({name:'home'}));
await p.waitForTimeout(3000);
console.log('screen:', await p.evaluate(()=>window.__screen), ' ->', JSON.stringify(await measure()));
await b.close();
