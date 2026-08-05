import sharp from 'sharp';
const [a,b,out]=process.argv.slice(2);
const A=await sharp(a).raw().toBuffer({resolveWithObject:true});
const B=await sharp(b).raw().toBuffer({resolveWithObject:true});
const {width:W,height:H,channels:C}=A.info;
const cells=new Float64Array(16*9);
const px=Buffer.alloc(W*H*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*C;
  const d=(Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]))/3;
  cells[Math.min(8,Math.floor(y/H*9))*16+Math.min(15,Math.floor(x/W*16))]+=d;
  const v=Math.min(255,d*12); const j=(y*W+x)*3; px[j]=v;px[j+1]=v;px[j+2]=v;
}
const per=(W/16)*(H/9);
console.log('per-cell mean abs diff (x12 nothing, raw /255):');
for(let r=0;r<9;r++)console.log(Array.from({length:16},(_,c)=>(cells[r*16+c]/per).toFixed(2).padStart(6)).join(''));
if(out) await sharp(px,{raw:{width:W,height:H,channels:3}}).png().toFile(out);
