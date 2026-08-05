/** Does the shadow map still track a MOVING player now that autoUpdate is off? */
import { chromium } from 'playwright';
const A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const base=process.argv[process.argv.indexOf('--url')+1];
const b=await chromium.launch({args:A});
const p=await b.newPage({viewport:{width:1300,height:740},deviceScaleFactor:1});
p.on('pageerror',e=>console.error('PAGEERROR',String(e)));
await p.goto(`${base}/?player=hamburger&enemy=donut&simSpeed=6`,{waitUntil:'networkidle',timeout:60000});
await p.waitForFunction('window.__gameReady === true',null,{timeout:60000});
await p.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'",null,{timeout:90000});
const shots=[];
for (let i=0;i<4;i++){
  await p.keyboard.down('d'); await p.waitForTimeout(900); await p.keyboard.up('d'); await p.waitForTimeout(300);
  const r = await p.evaluate(()=>{
    const s=window.__stage; const gl=s.renderer.getContext(); const cv=s.renderer.domElement;
    const W=cv.width,H=cv.height; const px=new Uint8Array(W*H*4);
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
    // centroid of "dark ground" pixels (the shadow) in the lower-middle band
    let sx=0,sy=0,n=0;
    for(let y=Math.floor(H*0.25);y<Math.floor(H*0.75);y+=2)for(let x=Math.floor(W*0.25);x<Math.floor(W*0.75);x+=2){
      const i=(y*W+x)*4; const l=0.2126*px[i]+0.7152*px[i+1]+0.0722*px[i+2];
      if(l<70){sx+=x;sy+=y;n++;}
    }
    const st=window.__stage;
    return { shadowCentroid:n?[Math.round(sx/n),Math.round(sy/n)]:null, darkPx:n,
             player:[+st.rig.camera.position.x.toFixed(2),+st.rig.camera.position.z.toFixed(2)],
             lightTarget:[+st.lighting.key.target.position.x.toFixed(3),+st.lighting.key.target.position.z.toFixed(3)] };
  });
  shots.push(r);
}
console.log(JSON.stringify(shots,null,1));
await b.close();
