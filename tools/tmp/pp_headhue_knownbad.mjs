import sharp from 'sharp';
const SCR='/private/tmp/claude-501/-Users-uribishansky-claude-code-food-arena/1bd29668-4fb1-44d6-9466-5543df71f454/scratchpad';
// KNOWN-BAD: take the REF hair region and collapse its hue to a single value while
// PRESERVING luma. If my instrument is real, Hspread must fall to ~0 and Lspread must NOT.
const box={left:150,top:120,width:370,height:225};
const {data,info}=await sharp('shots/perpart/head/ref.png').extract(box).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const out=Buffer.from(data);
for(let i=0;i<info.width*info.height;i++){
  const r=data[i*4]/255,g=data[i*4+1]/255,b=data[i*4+2]/255;
  const l=0.299*r+0.587*g+0.114*b;
  // single fixed hue (green 75deg) at fixed sat, luma preserved
  const k=[0.55,1.0,0.35];
  const kl=0.299*k[0]+0.587*k[1]+0.114*k[2];
  for(let c=0;c<3;c++) out[i*4+c]=Math.max(0,Math.min(255,Math.round(255*k[c]*l/kl)));
}
await sharp(out,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(SCR+'/knownbad_flathue.png');
console.log('wrote knownbad_flathue.png');
