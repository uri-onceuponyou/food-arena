import sharp from 'sharp';
import { modeL } from './cs_charcontact.mjs';
const luma=(r,g,b)=>(0.2126*r+0.7152*g+0.0722*b)/255;
const cands = {
 bs_01: [[930,620],[360,455],[500,250],[820,300],[240,120]],
 bs_02: [[1000,600],[430,180],[640,700],[120,300],[900,430]],
 bs_03: [[880,640],[240,700],[1000,380],[150,330],[700,690]],
 bs_04: [[300,620],[900,600],[430,600],[360,250],[980,480]],
 bs_05: [[200,600],[1000,600],[600,620],[150,300],[1050,450]],
 bs_06: [[700,600],[830,620],[620,690],[420,220],[980,660]],
};
for (const [plate, list] of Object.entries(cands)) {
  const {data,info}=await sharp(`reference/images/curated/gameplay_topdown/${plate}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  for (const [cx,cy] of list) {
    const W=info.width,H=info.height,w=120,h=50;
    const s=[];
    for(let y=Math.max(0,cy-h/2);y<Math.min(H,cy+h/2);y++)for(let x=Math.max(0,cx-w/2);x<Math.min(W,cx+w/2);x++){const i=(y*W+x)*3;s.push(luma(data[i],data[i+1],data[i+2]));}
    s.sort((a,b)=>a-b);
    const sp=s[Math.round(0.9*(s.length-1))]-s[Math.round(0.1*(s.length-1))];
    console.log(plate, String(cx).padStart(5), String(cy).padStart(4), 'mode', modeL(s).toFixed(4), 'spread', sp.toFixed(4), 'n', s.length);
  }
}
