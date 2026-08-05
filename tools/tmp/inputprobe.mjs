import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:1400,height:800}, deviceScaleFactor:1 });
await p.goto('http://localhost:5173/?player=hamburger&enemy=donut', { waitUntil:'networkidle' });
await p.waitForTimeout(5000);
const hit = await p.evaluate(() => {
  const pts = [[700,400],[700,300],[500,500],[1100,600]];
  return pts.map(([x,y]) => {
    const el = document.elementFromPoint(x,y);
    const chain=[]; let e=el;
    while(e && chain.length<4){ chain.push(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className?'.'+String(e.className).split(' ')[0]:'')); e=e.parentElement; }
    return { at:`${x},${y}`, top: chain[0], chain: chain.join(' < '),
             pe: el ? getComputedStyle(el).pointerEvents : null };
  });
});
console.log('--- what is under the cursor ---');
console.log(JSON.stringify(hit,null,1));
// Now try an actual click on the canvas and see if HP moves on the enemy
await p.evaluate(() => { const el=document.getElementById('screens'); if(el) el.style.pointerEvents='none'; });
console.log('--- #screens pointer-events forced to none ---');
const before = await p.evaluate(() => window.__vfxDebugFighters?.enemy?.hp ?? null);
await p.mouse.move(900, 380);
await p.mouse.down();
await p.waitForTimeout(2500);
await p.mouse.up();
const after = await p.evaluate(() => ({ hp: window.__vfxDebugFighters?.enemy?.hp ?? null,
                                        counts: window.__vfxQaCounts ?? null }));
console.log('--- click test ---');
console.log('enemy hp before:', before, ' after:', after.hp);
console.log('vfx counts:', JSON.stringify(after.counts));
await b.close();
