import sharp from 'sharp';
const f = 'shots/scan/run2/west_choke.canvas.png';
const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const boxMean=(x,y,w,h)=>{let r=0,g=0,b=0,n=0;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const k=(j*info.width+i)*3;r+=data[k];g+=data[k+1];b+=data[k+2];n++;}return [r/n,g/n,b/n];};
const L = ([r,g,b])=> (0.2126*r+0.7152*g+0.0722*b)/255;
const named = {
  'flour spill decal':      boxMean(545,470,50,35),
  'terracotta tile (lit)':  boxMean(1200,320,60,40),
  'terracotta tile (near)': boxMean(1150,620,60,40),
  'player bun':             boxMean(788,486,28,18),
  'yellow counter top':     boxMean(560,635,90,25),
  'blue barrel':            boxMean(320,480,50,40),
  'purple spice cart':      boxMean(1150,460,60,45),
  'teal mat':               boxMean(1060,700,60,30),
};
const tile = L(named['terracotta tile (near)']);
console.log('region                     rgb                luma    |dL| vs tile   Michelson');
for (const [k,v] of Object.entries(named)){
  const l=L(v); const dl=Math.abs(l-tile); const m=dl/(l+tile);
  console.log(`${k.padEnd(26)} ${String(v.map(n=>Math.round(n))).padEnd(17)} ${l.toFixed(3)}   ${dl.toFixed(3)}         ${m.toFixed(3)}`);
}
