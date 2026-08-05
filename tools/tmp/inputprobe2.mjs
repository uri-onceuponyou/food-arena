import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:1400,height:800}, deviceScaleFactor:1 });
await p.goto('http://localhost:5173/?player=hamburger&enemy=donut', { waitUntil:'networkidle' });
await p.waitForTimeout(9000); // clear the 5s countdown
// instrument the canvas directly
await p.evaluate(() => {
  const c = document.querySelector('#game canvas');
  window.__probe = { moves:0, downs:0, canvasFound: !!c };
  if (c) { c.addEventListener('mousemove', ()=>window.__probe.moves++);
           c.addEventListener('mousedown', ()=>window.__probe.downs++); }
});
async function trial(label, disableScreens) {
  await p.evaluate((off) => {
    window.__probe.moves = 0; window.__probe.downs = 0;
    const el = document.getElementById('screens');
    if (el) el.style.pointerEvents = off ? 'none' : '';
  }, disableScreens);
  await p.mouse.move(600, 350); await p.mouse.move(820, 300); await p.mouse.move(900, 420);
  await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.up();
  const r = await p.evaluate(() => ({ ...window.__probe }));
  console.log(`${label.padEnd(28)} canvasMoves=${r.moves}  canvasDowns=${r.downs}`);
}
await trial('#screens as-is:', false);
await trial('#screens pointer-events:none:', true);
console.log('canvas present:', await p.evaluate(()=>window.__probe.canvasFound));
await b.close();
