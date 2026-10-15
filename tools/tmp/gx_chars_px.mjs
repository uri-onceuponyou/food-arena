import sharp from 'sharp';
const [,, file, ...rects] = process.argv;
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const srgb2lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);const l=(mx+mn)/2;if(mx===mn)return{h:0,s:0,l};const d=mx-mn;const s=l>0.5?d/(2-mx-mn):d/(mx+mn);let h;if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;return{h,s,l};}
for (const r of rects) {
  const [x,y,w,h] = r.split(',').map(Number);
  let n=0, L=0, sx=0, sy=0, S=0, R=0,G=0,B=0;
  for (let yy=y; yy<y+h; yy++) for (let xx=x; xx<x+w; xx++) {
    const i=(yy*info.width+xx)*3; const r_=data[i],g_=data[i+1],b_=data[i+2];
    const lum = 0.2126*srgb2lin(r_)+0.7152*srgb2lin(g_)+0.0722*srgb2lin(b_);
    const Lr = (0.2126*r_+0.7152*g_+0.0722*b_)/255;
    const q=hsl(r_,g_,b_); L+=Lr; S+=q.s; const a=q.h*Math.PI/180; sx+=Math.cos(a)*q.s; sy+=Math.sin(a)*q.s; n++; R+=r_;G+=g_;B+=b_;
  }
  const hm = (Math.atan2(sy,sx)*180/Math.PI+360)%360;
  console.log(r, 'mean rgb', (R/n|0),(G/n|0),(B/n|0), 'luma(gamma)', (L/n).toFixed(3), 'meanS', (S/n).toFixed(3), 'meanHue', hm.toFixed(1));
}
