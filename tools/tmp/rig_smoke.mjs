// Smoke: does the live game and the character-select screen boot with no runtime
// error, with characters actually animating? Narrow check that the rig rewrite did
// not break anything that constructs a character.
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://localhost:5186';
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox']});
for (const [name, url, wait] of [
  ['live match', `${BASE}/?simSpeed=1&player=hamburger&enemy=hotdog`, 'window.__gameReady === true || document.querySelector("canvas")'],
  ['character select', `${BASE}/?screen=characters`, 'document.querySelector("canvas") || document.body.innerText.length > 40'],
  ['home', `${BASE}/`, 'document.body.innerText.length > 20'],
]) {
  const p = await b.newPage({viewport:{width:1280,height:720}});
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  try {
    await p.goto(url, {waitUntil:'networkidle', timeout:60000});
    await p.waitForFunction(wait, null, {timeout:30000});
    await p.waitForTimeout(2500);
    await p.screenshot({path:`shots/motion/smoke_${name.replace(/\W+/g,'_')}.png`});
    console.log(`${errs.length? '✗':'✓'} ${name}${errs.length? '  errors: '+errs.slice(0,3).join(' | '):''}`);
  } catch(e) { console.log(`✗ ${name}  ${String(e).split('\n')[0]}`); if(errs.length) console.log('   ', errs.slice(0,3).join(' | ')); }
  await p.close();
}
await b.close();
