#!/usr/bin/env node
/** LK1_DBG — dump world-Y of soup's broth-plane objects at the frozen preview time.
 *  Diagnosis only: `lk1_area` said the depth ring and all three garnish specks deliver
 *  0 px at all three stations while MATCHING objects, so they exist and are occluded.
 *  This asks by how much, rather than guessing. */
import { chromium } from 'playwright';
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', '')).replace(/\/$/, '');
const T = get('--t', '1.5');
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 900, height: 1150 } });
await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
await page.goto(`${BASE}/preview.html?piece=character&id=soup&pitch=20&yaw=0&t=${T}&anim=idle&shot=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180000 });
const out = await page.evaluate(() => {
  const s = window.__stage; s.scene.updateMatrixWorld(true);
  const rows = [];
  s.scene.traverse((o) => {
    if (!o.isMesh) return;
    const hex = o.material && o.material.color ? o.material.color.getHexString() : '';
    if (!/broth/.test(o.name) && hex !== '5c8a3a') return;
    const p = new (o.position.constructor)();
    o.getWorldPosition(p);
    rows.push({ name: o.name || '(unnamed)', hex, y: +p.y.toFixed(6), localY: +o.position.y.toFixed(6), visible: o.visible, renderOrder: o.renderOrder });
  });
  return { rows, headRadius: s.piece?.rig?.headRadius ?? null };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
