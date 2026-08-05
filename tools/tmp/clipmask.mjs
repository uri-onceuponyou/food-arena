import sharp from 'sharp';
const src = process.argv[2], out = process.argv[3];
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const n = info.width * info.height;
const o = Buffer.alloc(n*3);
for (let i=0;i<n;i++){
  const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
  const clip = r>=253;
  o[i*3]   = clip?255:(r*0.25)|0;
  o[i*3+1] = clip?0:(g*0.25)|0;
  o[i*3+2] = clip?255:(b*0.25)|0;
}
await sharp(o,{raw:{width:info.width,height:info.height,channels:3}}).png().toFile(out);
console.log('->',out);
