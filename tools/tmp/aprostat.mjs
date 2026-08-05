// Luma statistics inside a rectangular crop, expressed as fractions of the frame.
import sharp from 'sharp';
const [,,file,x0,y0,x1,y1]=process.argv;
const im=sharp(file); const {width,height}=await im.metadata();
const raw=await im.ensureAlpha().raw().toBuffer();
const X0=Math.round(width*+x0),X1=Math.round(width*+x1);
const Y0=Math.round(height*+y0),Y1=Math.round(height*+y1);
const L=[]; const S=[];
for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++){
  const p=(y*width+x)*4, r=raw[p],g=raw[p+1],b=raw[p+2];
  L.push(0.2126*r+0.7152*g+0.0722*b);
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  S.push(mx===0?0:(mx-mn)/mx);
}
L.sort((a,b)=>a-b); S.sort((a,b)=>a-b);
const q=(a,t)=>a[Math.floor(a.length*t)];
console.log(`${file.split('/').slice(-2).join('/')}  crop[${x0},${y0}-${x1},${y1}]  n=${L.length}`);
console.log(`  luma p10=${q(L,.1).toFixed(1)} p50=${q(L,.5).toFixed(1)} p90=${q(L,.9).toFixed(1)}  p90-p10=${(q(L,.9)-q(L,.1)).toFixed(1)}`);
console.log(`  sat  p10=${q(S,.1).toFixed(3)} p50=${q(S,.5).toFixed(3)} p90=${q(S,.9).toFixed(3)}`);
