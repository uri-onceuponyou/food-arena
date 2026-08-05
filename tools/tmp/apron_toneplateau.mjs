/** Rank-A run tops vs the service floor they stand on, in the SOUTH frame (clean light).
 *  Both are horizontal surfaces under one directional key, so albedo is the only thing
 *  that can separate them. Reports the luma histogram peaks inside the apron band. */
import sharp from 'sharp';
const f=process.argv[2];
const im=sharp(f);const{width,height}=await im.metadata();
const raw=await im.ensureAlpha().raw().toBuffer();
// apron band on the south bound: below the kerb, above the ability bar
const y0=Math.floor(height*Number(process.argv[3])), y1=Math.floor(height*Number(process.argv[4]));
const hist=new Float64Array(256);
for(let y=y0;y<y1;y++)for(let x=0;x<width;x++){
  const p=(y*width+x)*4;
  const L=Math.round(0.2126*raw[p]+0.7152*raw[p+1]+0.0722*raw[p+2]);
  hist[L]++;
}
// smooth then find local maxima
const sm=new Float64Array(256);
for(let i=0;i<256;i++){let s=0,n=0;for(let d=-3;d<=3;d++){const j=i+d;if(j>=0&&j<256){s+=hist[j];n++;}}sm[i]=s/n;}
const peaks=[];
for(let i=2;i<254;i++) if(sm[i]>sm[i-1]&&sm[i]>=sm[i+1]&&sm[i]>width*0.4) peaks.push([i,sm[i]]);
console.log(`south-bound apron band, rows ${y0}-${y1}`);
for(const [l,c] of peaks) console.log(`  luma plateau ${String(l).padStart(3)}  (${(100*c*7/((y1-y0)*width)).toFixed(1)}% weight)`);
