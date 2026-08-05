import sharp from 'sharp';
const FLAT=7, WIN=15;
function classify(r,g,b){
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  const v=max/255, s=max===0?0:(max-min)/max;
  let h=0; if(max!==min){const d=max-min;
    if(max===r)h=((g-b)/d)%6; else if(max===g)h=(b-r)/d+2; else h=(r-g)/d+4;
    h*=60; if(h<0)h+=360;}
  const isBg=v>=0.55&&h>=14&&h<=52&&s>=0.22&&s<=0.66;
  const isSkirt=v>=0.08&&v<=0.55&&s>=0.25&&s<=0.85&&h>=5&&h<=40;
  const isFogVoid=h>=245&&h<=330&&s>=0.28&&v<=0.62;
  return isBg||isSkirt||isFogVoid;
}
async function load(f){const im=sharp(f);const{width,height}=await im.metadata();
  const raw=await im.ensureAlpha().raw().toBuffer();return{width,height,raw};}
async function flagged(f){
  const{width,height,raw}=await load(f);
  const luma=new Float32Array(width*height), col=new Uint8Array(width*height);
  for(let i=0,p=0;i<width*height;i++,p+=4){const r=raw[p],g=raw[p+1],b=raw[p+2];
    luma[i]=0.2126*r+0.7152*g+0.0722*b; col[i]=classify(r,g,b)?1:0;}
  const half=(WIN-1)/2;
  const rMin=new Float32Array(width*height),rMax=new Float32Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){let lo=1e9,hi=-1e9;
    for(let dx=-half;dx<=half;dx++){const xx=Math.min(width-1,Math.max(0,x+dx));const v=luma[y*width+xx];
      if(v<lo)lo=v; if(v>hi)hi=v;} rMin[y*width+x]=lo;rMax[y*width+x]=hi;}
  const out=new Uint8Array(width*height);
  for(let x=0;x<width;x++)for(let y=0;y<height;y++){let lo=1e9,hi=-1e9;
    for(let dy=-half;dy<=half;dy++){const yy=Math.min(height-1,Math.max(0,y+dy));
      const a=rMin[yy*width+x],b=rMax[yy*width+x]; if(a<lo)lo=a; if(b>hi)hi=b;}
    out[y*width+x]=(hi-lo<=FLAT&&col[y*width+x])?1:0;}
  return {out,width,height,raw};
}
const [,,fa,fb]=process.argv;
const A=await flagged(fa);           // with apron
const B=await load(fb);              // without apron
// apron region = pixels that differ materially between the two renders
let apronPx=0, flagInApron=0, flagOutApron=0, tot=A.width*A.height;
for(let i=0,p=0;i<tot;i++,p+=4){
  const d=Math.abs(A.raw[p]-B.raw[p])+Math.abs(A.raw[p+1]-B.raw[p+1])+Math.abs(A.raw[p+2]-B.raw[p+2]);
  const inApron=d>18;
  if(inApron)apronPx++;
  if(A.out[i]){ if(inApron)flagInApron++; else flagOutApron++; }
}
console.log(`apron covers          ${(100*apronPx/tot).toFixed(1)}% of frame`);
console.log(`flagged inside apron  ${(100*flagInApron/tot).toFixed(2)}% of frame  (= ${(100*flagInApron/apronPx).toFixed(1)}% of the apron's own area)`);
console.log(`flagged elsewhere     ${(100*flagOutApron/tot).toFixed(2)}% of frame`);
