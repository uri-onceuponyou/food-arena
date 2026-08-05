/** Every character, in the hero portrait, at the tightest and widest hero columns.
 *  All four bbox extremes must project inside [0,1] or the hero is being cropped. */
import { chromium } from 'playwright';
import { settleScreen } from './settle.mjs';

// ⚠️ THIS FILE HARDCODED `http://localhost:5173` — i.e. it measured whatever was on the
// SHARED dev server, never the frozen snapshot the caller had just built. That is
// `CLAUDE.md` non-negotiable #2 inverted, and it is the same defect `f73925e` found in
// `arena-scan.mjs` ("ignored PREVIEW_BASE, so the canonical snapshot idiom measured
// whatever was on port 5187"). Same shape, second tool.
const BASE = process.env.PREVIEW_BASE
  ?? (process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null);
if (!BASE) {
  console.error('PREVIEW_BASE unset. Run it against a frozen snapshot, never the shared dev server:');
  console.error('  node tools/tmp/with_snapshot.mjs -- node tools/tmp/menu_roster_frame.mjs --url {URL}');
  process.exit(2);
}
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const IDS=['hamburger','donut','taco','burrito','egg','lollipop','pizza','sushi','soup','waterbottle','hotdog'];
const b=await chromium.launch({args:ARGS});
let bad=0;
for (const vp of [{w:844,h:390,n:'phone'},{w:1600,h:900,n:'desktop'},{w:1024,h:768,n:'ipad'}]) {
  const p=await b.newPage({viewport:{width:vp.w,height:vp.h}});
  await p.goto(`${BASE}/?screen=characters`,{waitUntil:'networkidle',timeout:45000});
  await p.waitForFunction('window.__previewReady === true',null,{timeout:45000});
  // The VERDICT here is `window.__charStage()`, an NDC projection no CSS transform can
  // move — but the loop below CLICKS a card, and a click lands on a moving target while
  // `fa-screen-in` runs. Settling costs ~100ms and removes the only CSS-shaped hazard.
  await settleScreen(p, { label: `roster:${vp.n}` });
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
