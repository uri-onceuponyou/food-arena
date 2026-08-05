import sharp from 'sharp';
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);const l=(mx+mn)/2;let h=0,s=0;const d=mx-mn;if(d>1e-6){s=l>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0));else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}return[h,s,l];}
async function mat(p,box,hLo,hHi,label){
  const im=sharp(p); const {data,info}= box? await im.extract(box).ensureAlpha().raw().toBuffer({resolveWithObject:true})
                                            : await im.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let hs=[],ls=[],ss=[];
  for(let i=0;i<info.width*info.height;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
    if(Math.abs(r-93)+Math.abs(g-86)+Math.abs(b-87)<18) continue;
    const [h,s,l]=rgb2hsl(r,g,b); if(s<0.25) continue; if(h<hLo||h>hHi) continue; hs.push(h);ls.push(l);ss.push(s);}
  const q=(a,f)=>{const c=[...a].sort((x,y)=>x-y);return c[Math.floor(f*(c.length-1))];};
  console.log(label,'n='+hs.length,'Lspread',(q(ls,.95)-q(ls,.05)).toFixed(3),'Hspread',(q(hs,.95)-q(hs,.05)).toFixed(1));
}
const SCR='/private/tmp/claude-501/-Users-uribishansky-claude-code-food-arena/1bd29668-4fb1-44d6-9466-5543df71f454/scratchpad';
await mat('shots/perpart/head/ref.png',{left:150,top:120,width:370,height:225},40,110,'REF hair CLEAN     ');
await mat(SCR+'/knownbad_flathue.png',null,40,110,'REF hair KNOWN-BAD ');
