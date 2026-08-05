import sharp from 'sharp';
const f = process.argv[2];
const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const L = (i) => (0.2126*data[i*3] + 0.7152*data[i*3+1] + 0.0722*data[i*3+2]) / 255;
function region(name, x0, y0, x1, y1) {
  let n=0, s=0, r=0,g=0,b=0;
  for (let y=y0; y<y1; y++) for (let x=x0; x<x1; x++) { const i=y*W+x; s+=L(i); r+=data[i*3]; g+=data[i*3+1]; b+=data[i*3+2]; n++; }
  console.log(name.padEnd(18), 'L='+(s/n).toFixed(3), 'rgb('+Math.round(r/n)+','+Math.round(g/n)+','+Math.round(b/n)+')');
}
const regs = JSON.parse(process.argv[3]);
for (const [name, ...box] of regs) region(name, ...box);
