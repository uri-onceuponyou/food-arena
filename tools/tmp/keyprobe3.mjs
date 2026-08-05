import { chromium } from 'playwright';
const BASE=process.env.PREVIEW_BASE;
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox']});
const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=850&py=500&fogRadius=545&simSpeed=1&pointerLock=0&aimMode=free`,{waitUntil:'networkidle',timeout:90000});
await p.waitForFunction('window.__gameReady === true',null,{timeout:90000});
await p.waitForTimeout(1500);
await p.evaluate(`window.__hits=0; window.addEventListener('keydown', () => { window.__hits++; });`);
await p.keyboard.down('KeyA'); await p.waitForTimeout(400); await p.keyboard.up('KeyA');
await p.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',key:'a',bubbles:true}))`);
console.log('window keydown listener fired:', await p.evaluate('window.__hits'), 'times');
// Now hold the key for 2s and watch position
await p.keyboard.down('KeyA');
await p.waitForTimeout(2000);
console.log('player after 2s of held KeyA:', await p.evaluate('[window.__vfxDebugFighters.player.x, window.__vfxDebugFighters.player.y]'));
await p.keyboard.up('KeyA');
// same for the ARROW key
await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(2000); await p.keyboard.up('ArrowLeft');
console.log('player after 2s of held ArrowLeft:', await p.evaluate('[window.__vfxDebugFighters.player.x, window.__vfxDebugFighters.player.y]'));
await b.close();
