import sharp from 'sharp';
const F=[93,86,87];
async function stats(p){
  const {data,info}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,height:H}=info;
  let minX=W,maxX=-1,minY=H,maxY=-1;
  const rowCount=new Array(H).fill(0);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    const d=Math.abs(r-F[0])+Math.abs(g-F[1])+Math.abs(b-F[2]);
    if(d>18){rowCount[y]++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  }
  return {W,H,bbox:[minX,minY,maxX,maxY],hFrac:(maxY-minY+1)/H,rowCount};
}
for(const p of process.argv.slice(2)){
  const s=await stats(p);
  console.log(p,'canvas',s.W+'x'+s.H,'subjectBBox',JSON.stringify(s.bbox),'heightFracOfCrop',s.hFrac.toFixed(3));
  // print row occupancy profile in 20 bands
  const bands=[];for(let k=0;k<20;k++){let sum=0,n=0;for(let y=Math.floor(k*s.H/20);y<Math.floor((k+1)*s.H/20);y++){sum+=s.rowCount[y];n++;}bands.push((sum/n/s.W).toFixed(2));}
  console.log('  rowOccupancy(20 bands top->bottom):',bands.join(' '));
}
