#!/usr/bin/env node
/**
 * WV_CAMCHECK — did the re-pitch actually MOVE THE CAMERA?
 *
 * `wv_area.mjs --pitch 20` reported impact areas within a few percent of its pitch-58
 * numbers (352,524,854,... at 58 against 359,551,855,... at 20). That reads exactly
 * like a `setPitch()` that silently did nothing — and a whole 37-minute arm measured
 * through a camera that never moved would be worse than no arm at all.
 *
 * So this reads the rig's own fields and its world POSITION before and after, renders
 * both, and writes the two frames to be LOOKED AT (CLAUDE.md #3). Measured on
 * `8ca8f88`:
 *
 *     BEFORE  pitch 58  mode fair    width 360  pos [15, 22.58, 52.70]
 *     AFTER   pitch 20  mode ground  width 150  pos [15,  6.74, 59.02]
 *
 * — the camera drops 15.8 m and pulls 6.3 m back, and `_cam20.png` is plainly a
 * shallow near-ground view. The re-pitch works.
 *
 * ⚠️ **AND THE SIMILAR AREAS ARE THE REAL ANSWER, NOT A FAULT.** At this framing the
 * subject scale is close to the match camera's, so a shallow-camera area is comparable
 * in magnitude — the lobby analogue's value is the ANGLE it exposes defects from, not
 * magnification. Do not read "the numbers barely moved" as "the camera barely moved";
 * this file exists because those two are indistinguishable from a table.
 *
 *   node tools/tmp/wv_camcheck.mjs <snapshot-url>
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const U=process.argv[2];
const b=await chromium.launch({args:A});
const p=await b.newPage({viewport:{width:1600,height:900}});
p.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await p.route('**/@vite/client*', r=>r.fulfill({status:200,contentType:'text/javascript',body:'export const createHotContext=()=>({accept(){},dispose(){},on(){},prune(){},invalidate(){},send(){},decline(){},acceptExports(){},data:{}});export const injectQuery=u=>u;export const updateStyle=()=>{};export const removeStyle=()=>{};export const ErrorOverlay=class{};export default {};'}));
await p.goto(U+'/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__gameReady===true,null,{timeout:120000});
await p.waitForFunction(()=>!!window.__vfxLayer&&!!window.__stage,null,{timeout:120000});
await p.waitForTimeout(1500);
await p.evaluate(()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation-play-state:paused!important;transition:none!important}';document.head.appendChild(s);for(const a of document.getAnimations()){try{a.currentTime=0;a.pause();}catch{}}});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
await p.waitForTimeout(300);
const read=()=>p.evaluate(()=>{const r=window.__stage.rig;const c=r.camera;return{pitch:r.pitchDeg,mode:r.frameMode,width:r.viewWidthUnits,fov:c.fov,pos:[+c.position.x.toFixed(2),+c.position.y.toFixed(2),+c.position.z.toFixed(2)]};});
console.log('BEFORE',JSON.stringify(await read()));
await p.evaluate(()=>{const r=window.__stage.rig;r.shakeAmount=0;r.shakeOffset?.set(0,0,0);window.__stage.render(0);});
await writeFile('shots/wv/proj/_cam58.png',Buffer.from((await p.evaluate(()=>window.__stage.canvas.toDataURL('image/png'))).split(',')[1],'base64'));
await p.evaluate(()=>{const r=window.__stage.rig;r.pitchDeg=20;r.frameMode='ground';r.viewWidthUnits=150;r.apply();});
console.log('AFTER ',JSON.stringify(await read()));
await p.evaluate(()=>{const r=window.__stage.rig;r.shakeAmount=0;r.shakeOffset?.set(0,0,0);window.__stage.render(0);});
console.log('AFTER RENDER',JSON.stringify(await read()));
await writeFile('shots/wv/proj/_cam20.png',Buffer.from((await p.evaluate(()=>window.__stage.canvas.toDataURL('image/png'))).split(',')[1],'base64'));
await b.close();
