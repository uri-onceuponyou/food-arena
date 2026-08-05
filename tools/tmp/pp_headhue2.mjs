import sharp from 'sharp';
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);const l=(mx+mn)/2;let h=0,s=0;const d=mx-mn;if(d>1e-6){s=l>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0));else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}return[h,s,l];}
// keep only CHROMATIC pixels of the dominant hue band -> the material itself, not decals
async function mat(p,box,hLo,hHi,label){
  const {data,info}=await sharp(p).extract(box).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const N=info.width*info.height; let hs=[],ls=[],ss=[];
  for(let i=0;i<N;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
    if(Math.abs(r-93)+Math.abs(g-86)+Math.abs(b-87)<18) continue;
    const [h,s,l]=rgb2hsl(r,g,b); if(s<0.25) continue; if(h<hLo||h>hHi) continue;
    hs.push(h);ls.push(l);ss.push(s);}
  const q=(a,f)=>{const c=[...a].sort((x,y)=>x-y);return c[Math.floor(f*(c.length-1))];};
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  console.log(label,'n='+hs.length,
   '| L p05..p95=',q(ls,.05).toFixed(3),'..',q(ls,.95).toFixed(3),'spread',(q(ls,.95)-q(ls,.05)).toFixed(3),
   '| H p05..p95=',q(hs,.05).toFixed(1),'..',q(hs,.95).toFixed(1),'spread',(q(hs,.95)-q(hs,.05)).toFixed(1),
   '| S mean',mean(ss).toFixed(3));
}
await mat('shots/perpart/head/ours.png',{left:290,top:195,width:370,height:225},15,55,'OURS bun material (orange 15-55) ');
await mat('shots/perpart/head/ref.png',{left:150,top:120,width:370,height:225},40,110,'REF  hair material (green 40-110)');
await mat('shots/perpart/head/ref.png',{left:355,top:370,width:260,height:200},5,45,'REF  skin material (warm  5-45)  ');
