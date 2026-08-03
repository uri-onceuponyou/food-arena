import sharp from 'sharp';
const path = process.argv[2];
const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const lum = (i) => 0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
// three depth bands (top=far, mid, bottom=near)
for (let band = 0; band < 3; band++) {
  const y0 = Math.floor(H*band/3), y1 = Math.floor(H*(band+1)/3);
  const vals = [];
  for (let y = y0; y < y1; y += 2) for (let x = 0; x < W; x += 2) vals.push(lum((y*W+x)*4));
  vals.sort((a,b)=>a-b);
  const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
  const p5 = vals[Math.floor(vals.length*0.05)], p95 = vals[Math.floor(vals.length*0.95)];
  console.log(`${['far','mid','near'][band]}  mean=${mean.toFixed(1)}  p5=${p5.toFixed(0)} p95=${p95.toFixed(0)}  ratio=${(p95/Math.max(p5,1)).toFixed(2)}`);
}
