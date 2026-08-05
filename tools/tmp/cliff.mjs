/**
 * VALUE CLIFF metric. Median luma of the apron's own pixels vs median luma of the
 * playfield's, per frame. The apron region is identified by diffing against a render
 * with the apron switched off (`?apron=0`), so it needs no world-space knowledge.
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
async function load(f){const im=sharp(f);const{width,height}=await im.metadata();
  const raw=await im.ensureAlpha().raw().toBuffer();return{width,height,raw};}
const [,,withDir,noneDir]=process.argv;
const files=(await readdir(withDir)).filter(f=>f.endsWith('.png')).sort();
for(const f of files){
  const A=await load(join(withDir,f)), B=await load(join(noneDir,f));
  const ap=[],pf=[];
  const n=A.width*A.height;
  for(let i=0,p=0;i<n;i++,p+=4){
    const y=(i/A.width)|0;
    if(y<A.height*0.06||y>A.height*0.88) continue;   // skip HUD bands
    const d=Math.abs(A.raw[p]-B.raw[p])+Math.abs(A.raw[p+1]-B.raw[p+1])+Math.abs(A.raw[p+2]-B.raw[p+2]);
    const L=0.2126*A.raw[p]+0.7152*A.raw[p+1]+0.0722*A.raw[p+2];
    const r=A.raw[p],g=A.raw[p+1],b=A.raw[p+2];
    if(d>18) ap.push(L);
    // playfield = warm pixels (the terracotta tile family), which the apron never is
    else if(r>g&&g>b&&r-b>28) pf.push(L);
  }
  const med=a=>{if(!a.length)return NaN;a.sort((x,y)=>x-y);return a[a.length>>1];};
  const A1=med(ap),P=med(pf);
  console.log(`${f.padEnd(20)} apron ${A1.toFixed(0).padStart(4)}   playfield ${P.toFixed(0).padStart(4)}   ratio ${(100*A1/P).toFixed(0).padStart(4)}%`);
}
