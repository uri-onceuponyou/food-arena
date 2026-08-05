/** Is there a continuous apron ground plane in the lower-left of the corner frame,
 *  or do the props stand over nothing? Apron mask = diff vs the ?apron=0 render. */
import sharp from 'sharp';
import { join } from 'node:path';
async function load(f){const im=sharp(f);const{width,height}=await im.metadata();
  const raw=await im.ensureAlpha().raw().toBuffer();return{width,height,raw};}
const [,,withDir,noneDir,file]=process.argv;
const A=await load(join(withDir,file)), B=await load(join(noneDir,file));
const {width,height}=A;
// lower-left quadrant, inside the HUD-safe band
const x0=0,x1=Math.floor(width*0.35),y0=Math.floor(height*0.45),y1=Math.floor(height*0.88);
let apron=0,tot=0,lum=[],nonApronLum=[];
for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const i=y*width+x,p=i*4;
  const d=Math.abs(A.raw[p]-B.raw[p])+Math.abs(A.raw[p+1]-B.raw[p+1])+Math.abs(A.raw[p+2]-B.raw[p+2]);
  const L=0.2126*A.raw[p]+0.7152*A.raw[p+1]+0.0722*A.raw[p+2];
  tot++;
  if(d>18){apron++;lum.push(L);} else nonApronLum.push(L);
}
const med=a=>{if(!a.length)return NaN;a.sort((x,y)=>x-y);return a[a.length>>1];};
console.log(`${file}  lower-left quadrant (${x1-x0}x${y1-y0}px)`);
console.log(`  apron coverage        ${(100*apron/tot).toFixed(1)} %`);
console.log(`  apron median luma     ${med(lum).toFixed(1)} /255`);
console.log(`  NON-apron median luma ${med(nonApronLum).toFixed(1)} /255   (${(100*(tot-apron)/tot).toFixed(1)} % of area)`);
