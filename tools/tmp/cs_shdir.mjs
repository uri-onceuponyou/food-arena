import sharp from 'sharp';
const luma=(r,g,b)=>(0.2126*r+0.7152*g+0.0722*b)/255;
const rows=JSON.parse(await (await import('node:fs/promises')).readFile('shots/contact/before/ours.json','utf8')).filter(r=>r.kind==='char'&&r.nearPx>0);
for (const r of rows){
  const st=r.plate.replace(':','_');
  const A=await sharp(`shots/contact/before/${st}__shipped.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const B=await sharp(`shots/contact/before/${st}__ablated.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const W=A.info.width,H=A.info.height;
  const e=r.ellipse;
  let sx=0,sy=0,m=0,n=0, byT=new Float64Array(40), byTn=new Float64Array(40);
  let inSec=0, tot=0;
  const dx0=Math.cos(r.shadowDeg*Math.PI/180), dy0=Math.sin(r.shadowDeg*Math.PI/180), cosLim=Math.cos(50*Math.PI/180);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*3;
    const d=luma(B.data[i],B.data[i+1],B.data[i+2])-luma(A.data[i],A.data[i+1],A.data[i+2]);
    if(d<=0.02) continue;
    const px=x+0.5-e.cx, py=y+0.5-e.cy;
    sx+=px*d; sy+=py*d; m+=d; n++;
    const t=Math.hypot(px/e.rx,py/e.ry);
    const bi=Math.min(39,Math.floor(t/0.25)); byT[bi]+=d; byTn[bi]++;
    tot+=d;
    const l=Math.hypot(px,py)||1;
    if((px/l)*dx0+(py/l)*dy0>=cosLim) inSec+=d;
  }
  const deg=(Math.atan2(sy/m,sx/m)*180)/Math.PI;
  let cum=0; const cums=[]; for(let i=0;i<40;i++){cum+=byT[i];cums.push(cum);}
  const q=(f)=>{const t=cum*f;let a=0;for(let i=0;i<40;i++){if(a+byT[i]>=t)return (i+(byT[i]?(t-a)/byT[i]:0))*0.25;a+=byT[i];}return 10;};
  console.log(`${r.plate} ${r.name}: shadow mass at ${deg.toFixed(1)} deg (sector aimed at ${r.shadowDeg}), px=${n}, in-sector ${(100*inSec/tot).toFixed(1)}%, t50=${q(0.5).toFixed(2)} t90=${q(0.9).toFixed(2)}`);
  const prof=[]; for(let i=0;i<16;i++) prof.push(`${(i*0.25).toFixed(2)}:${(byTn[i]?byT[i]/byTn[i]:0).toFixed(3)}`);
  console.log('   mean dL by t: '+prof.join(' '));
}
