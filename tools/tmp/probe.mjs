import sharp from 'sharp';
const [,,path,...pts] = process.argv;
const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (const p of pts) {
  const [x,y] = p.split(',').map(Number);
  const i = (y*info.width + x)*4;
  const hex = '#' + [data[i],data[i+1],data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  console.log(`${x},${y} -> ${hex}  rgb(${data[i]},${data[i+1]},${data[i+2]})`);
}
