import { chromium } from 'playwright';
const BASE = process.env.PREVIEW_BASE;
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},send(){}});export function injectQuery(u){return u} export function removeStyle(){} export function updateStyle(){}' }));
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=700&py=640&fogRadius=850&simSpeed=0.02&pointerLock=0`, { waitUntil:'networkidle', timeout:120000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => {
  const s = window.__stage, out = [];
  s.scene.traverse((o) => { if (/^character:/.test(o.name||'')) {
    const e = o.rotation; const q = o.getWorldQuaternion(new (o.quaternion.constructor)());
    const v = new (o.position.constructor)(0,0,1).applyQuaternion(q);
    out.push({ name:o.name, rotYdeg:+(e.y*180/Math.PI).toFixed(1), worldFwd:[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)], pos:[+o.position.x.toFixed(2),+o.position.y.toFixed(2),+o.position.z.toFixed(2)] });
  }});
  return { casts: out, camPos: s.rig.camera.position.toArray().map(v=>+v.toFixed(2)), dbg: window.__matchDebug ? {fx:window.__matchDebug.facingX, fy:window.__matchDebug.facingY} : null };
}), null, 1));
await b.close();
