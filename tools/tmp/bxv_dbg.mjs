import { chromium } from 'playwright';
const a=process.argv, get=(k,d)=>a.includes(k)?a[a.indexOf(k)+1]:d;
const BASE=process.env.PREVIEW_BASE??get('--url',null);
const LAUNCH=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const b=await chromium.launch({args:LAUNCH});
const page=await b.newPage({viewport:{width:393,height:852},deviceScaleFactor:3});
await page.route('**/@vite/client',(r)=>r.fulfill({status:200,contentType:'application/javascript',body:'export const createHotContext=()=>({accept(){},dispose(){},on(){},off(){},send(){},invalidate(){},prune(){},acceptExports(){},data:{}});export const injectQuery=(u)=>u;export const updateStyle=()=>{};export const removeStyle=()=>{};export const ErrorOverlay=class{};export default {};'}));
await page.goto(`${BASE}/?screen=characters`,{waitUntil:'load',timeout:120000});
await page.waitForFunction('window.__screen==="characters" && window.__screenReady===true',null,{timeout:180000});
await page.click('[data-char="hamburger"]');
await page.waitForFunction('window.__charStage && window.__charStage() && window.__charStage().id==="hamburger"',null,{timeout:60000});
await page.waitForTimeout(1500);
const r=await page.evaluate(()=>{
  const st=window.__stage; const cv=st.renderer.domElement; const cam=st.rig.camera;
  cam.updateMatrixWorld(true);
  const out=[];let meshes=0,vis=0;
  st.scene.traverse((o)=>{ if(!o.isMesh) return; meshes++; if(o.visible) vis++;
    if(o.name==='brow'||o.name==='eye'||o.name==='eye_lash'){
      o.updateMatrixWorld(true);
      const p=new o.position.constructor(0,0,0);
      p.setFromMatrixPosition(o.matrixWorld);
      const q=p.clone().project(cam);
      let anc=o,hidden=null; while(anc){ if(!anc.visible) hidden=anc.name||anc.type; anc=anc.parent; }
      out.push({name:o.name,visible:o.visible,hiddenAncestor:hidden,world:[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)],ndc:[+q.x.toFixed(3),+q.y.toFixed(3),+q.z.toFixed(3)],
        px:[Math.round((q.x*0.5+0.5)*cv.width),Math.round((1-(q.y*0.5+0.5))*cv.height)], mat:o.material?.type, layers:o.layers.mask});
    }});
  let proto=null,protoOwner=null;
  st.scene.traverse((o)=>{ if(proto) return; if(o.isMesh&&o.material&&o.material.isMeshBasicMaterial){proto=o.material;protoOwner=o.name||o.type;} });
  const P=proto?{owner:protoOwner,name:proto.name,visible:proto.visible,transparent:proto.transparent,opacity:proto.opacity,depthTest:proto.depthTest,depthWrite:proto.depthWrite,colorWrite:proto.colorWrite,side:proto.side,blending:proto.blending,toneMapped:proto.toneMapped,fog:proto.fog}:null;
  return {proto:P, cvw:cv.width,cvh:cv.height,meshes,vis,camLayers:cam.layers.mask,camPos:[+cam.position.x.toFixed(2),+cam.position.y.toFixed(2),+cam.position.z.toFixed(2)],near:cam.near,far:cam.far,out,
    info:window.__charStage(), stages:Object.keys(window.__stages||{}), rtBound: !!st.renderer.getRenderTarget()};
});
console.log(JSON.stringify(r,null,1));
await b.close();
