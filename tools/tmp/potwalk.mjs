/** Walk a real fighter into the pot with real key input and log the closest approach. */
import { chromium } from 'playwright';
const BASE = process.env.PREVIEW_BASE;
const LAUNCH_ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const runs = [
  { name:'from E, hold W', px:850, py:500, keys:['KeyA'] },
  { name:'from S, hold N', px:700, py:700, keys:['KeyW'] },
  { name:'from SE diag',   px:850, py:650, keys:['KeyA','KeyW'] },
];
const b = await chromium.launch({ args: LAUNCH_ARGS });
for (const r of runs) {
  const p = await b.newPage({ viewport:{width:900,height:600} });
  await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${r.px}&py=${r.py}&fogRadius=545&simSpeed=1&pointerLock=0&aimMode=free`, { waitUntil:'networkidle', timeout:90000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout:90000 });
  await p.bringToFront();
  await p.mouse.click(450, 300);
  await p.waitForTimeout(1200);
  const phase0 = await p.evaluate('window.__vfxDebugScreen ?? null');
  console.log('  screen state:', JSON.stringify(phase0));
  for (const k of r.keys) await p.keyboard.down(k);
  let minD = Infinity, minPos = null, hp0 = null, hp1 = null;
  for (let i = 0; i < 90; i++) {
    await p.waitForTimeout(60);
    const f = await p.evaluate('window.__vfxDebugFighters?.player ?? null');
    if (!f) continue;
    if (hp0 === null) hp0 = f.hp;
    hp1 = f.hp;
    const d = Math.hypot(f.x - 700, f.y - 500);
    if (d < minD) { minD = d; minPos = [Math.round(f.x), Math.round(f.y)]; }
  }
  for (const k of r.keys) await p.keyboard.up(k);
  console.log(`${r.name.padEnd(16)} closest centre-distance ${minD.toFixed(1)}wu at (${minPos})  · HP ${hp0} -> ${hp1} (hazard ${hp0-hp1>0?'FIRED':'did not fire'})`);
  await p.close();
}
await b.close();
