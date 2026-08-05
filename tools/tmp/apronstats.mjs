import { chromium } from 'playwright';
const LAUNCH_ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const BASE=process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const b=await chromium.launch({args:LAUNCH_ARGS});
const p=await b.newPage({viewport:{width:1680,height:720}});
await p.goto(`${BASE}/?player=hamburger&enemy=donut&fogRadius=850&simSpeed=0.02`,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__gameReady===true,null,{timeout:45000});
await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const st=window.__stage; const scene=st.scene ?? st._scene;
  let apron=null; scene.traverse(o=>{ if(o.name==='arena_apron') apron=o; });
  let tris=0, draws=0, verts=0;
  apron.traverse(o=>{
    if(!o.isMesh) return;
    draws++;
    const g=o.geometry; const n=o.isInstancedMesh?o.count:1;
    const idx=g.index? g.index.count : g.attributes.position.count;
    tris += (idx/3)*n; verts += g.attributes.position.count;
  });
  let sTris=0,sDraws=0;
  scene.traverse(o=>{ if(!o.isMesh) return; sDraws++; const g=o.geometry; const n=o.isInstancedMesh?o.count:1;
    const idx=g.index? g.index.count : g.attributes.position.count; sTris+=(idx/3)*n; });
  return {apronDraws:draws, apronTriangles:Math.round(tris), apronVerts:verts,
          sceneDraws:sDraws, sceneTriangles:Math.round(sTris)};
}),null,1));
await b.close();
