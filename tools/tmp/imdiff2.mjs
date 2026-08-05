import sharp from 'sharp';
const [a,b]=process.argv.slice(2);
const A=await sharp(a).raw().toBuffer({resolveWithObject:true});
const B=await sharp(b).raw().toBuffer({resolveWithObject:true});
const {width:W,height:H,channels:C}=A.info;
let sum=0,n=0,minX=1e9,minY=1e9,maxX=-1,maxY=-1,darker=0,lighter=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*C;
  const d=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);
  sum+=d/3;
  if(d>18){n++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
    const la=A.data[i]+A.data[i+1]+A.data[i+2],lb=B.data[i]+B.data[i+1]+B.data[i+2];
    if(lb<la)darker++;else lighter++;}
}
console.log(`mean abs diff ${(sum/(W*H)).toFixed(4)}/255 · changed px ${n} (${(n/(W*H)*100).toFixed(3)}%) · bbox ${minX},${minY}..${maxX},${maxY} · darker ${darker} lighter ${lighter}`);
