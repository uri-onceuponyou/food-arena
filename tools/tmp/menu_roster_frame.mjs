/** Every character, in the hero portrait, at the tightest and widest hero columns.
 *  All four bbox extremes must project inside [0,1] or the hero is being cropped. */
import { chromium } from 'playwright';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const IDS=['hamburger','donut','taco','burrito','egg','lollipop','pizza','sushi','soup','waterbottle','hotdog'];
const b=await chromium.launch({args:ARGS});
let bad=0;
for (const vp of [{w:844,h:390,n:'phone'},{w:1600,h:900,n:'desktop'},{w:1024,h:768,n:'ipad'}]) {
  const p=await b.newPage({viewport:{width:vp.w,height:vp.h}});
  await p.goto('http://localhost:5173/?screen=characters',{waitUntil:'networkidle',timeout:45000});
  await p.waitForFunction('window.__previewReady === true',null,{timeout:45000});
  for (const id of IDS) {
    await p.click(`.chars-card[data-char="${id}"]`, {force:true});
    await p.waitForTimeout(420);
    const i = await p.evaluate(()=>window.__charStage?.()??null);
    const pts=[i.feet,i.crown,i.left,i.right];
    const ok = i.cameraOk && pts.every(q=>q && q.x>=-0.005 && q.x<=1.005 && q.y>=-0.005 && q.y<=1.005);
    if(!ok) bad++;
    console.log(`${ok?'PASS':'FAIL'} ${vp.n.padEnd(8)} ${id.padEnd(12)} fill=${i.fill} w/h=${i.subject.w}/${i.subject.h} L=${i.left.x} R=${i.right.x} T=${i.crown.y} B=${i.feet.y}`);
  }
  await p.close();
}
await b.close();
console.log(bad===0?'\nALL IN FRAME':`\n${bad} CROPPED`);
