import sharp from 'sharp';
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);const l=(mx+mn)/2;let h=0,s=0;const d=mx-mn;if(d>1e-6){s=l>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0));else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}return[h,s,l];}
async function region(p,box,label){
  const {data,info}=await sharp(p).extract(box).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const N=info.width*info.height; let hs=[],ss=[],ls=[];
  for(let i=0;i<N;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
    if(Math.abs(r-93)+Math.abs(g-86)+Math.abs(b-87)<18) continue;
    const [h,s,l]=rgb2hsl(r,g,b); hs.push(h);ss.push(s);ls.push(l);}
  const q=(a,f)=>{const c=[...a].sort((x,y)=>x-y);return c[Math.floor(f*(c.length-1))];};
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  // circular-ish hue spread: use p10..p90 on raw degrees (fine for non-wrapping bands)
  console.log(label, 'n='+hs.length,
   'L p05/p50/p95=',q(ls,.05).toFixed(3),q(ls,.5).toFixed(3),q(ls,.95).toFixed(3),
   '| Lspread=',(q(ls,.95)-q(ls,.05)).toFixed(3),
   '| H p10/p50/p90=',q(hs,.10).toFixed(1),q(hs,.5).toFixed(1),q(hs,.90).toFixed(1),
   '| Hspread=',(q(hs,.90)-q(hs,.10)).toFixed(1),
   '| S mean=',mean(ss).toFixed(3));
}
// ours: bun dome only (orange mass), excluding collar/limbs
await region('shots/perpart/head/ours.png',{left:290,top:195,width:370,height:225},'OURS bun-dome ');
// ref: face skin + hair mass, roughly the head mass
await region('shots/perpart/head/ref.png',{left:330,top:350,width:370,height:225},'REF  face-mass');
await region('shots/perpart/head/ref.png',{left:150,top:120,width:370,height:225},'REF  hair-mass');
