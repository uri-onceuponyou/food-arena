import { chromium } from 'playwright';
const A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const b=await chromium.launch({args:A});
const p=await b.newPage({viewport:{width:800,height:600}});
await p.goto('http://localhost:5173/preview.html?piece=arena&shot=1',{waitUntil:'networkidle'});
await p.waitForTimeout(2000);
const out=await p.evaluate(async()=>{
  const m=await import('/src/arena/kitchen.ts');
  const root=m.createKitchenArena().build(); root.updateMatrixWorld(true);
  const res=[];
  root.traverse(o=>{
    if(!o.isMesh) return;
    const e=o.matrixWorld.elements; const x=e[12],y=e[13],z=e[14];
    // world metres: arena wu*0.05. NW freezer ~ (11.5, 9.5). Look at x 8..22, z 0..16
    if(x>8&&x<24&&z>0&&z<16&&!/shadow/i.test(o.name)) res.push({n:o.name,x:+x.toFixed(2),y:+y.toFixed(2),z:+z.toFixed(2),t:o.geometry.type});
  });
  return res.filter(r=>r.t==='TorusGeometry'||r.t==='CylinderGeometry').slice(0,40);
});
await b.close();
console.log(out.map(r=>`${r.t.padEnd(18)} ${r.n.padEnd(28)} (${r.x}, ${r.y}, ${r.z})`).join('\n'));
