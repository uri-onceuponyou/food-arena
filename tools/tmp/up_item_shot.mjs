#!/usr/bin/env node
/**
 * PHOTOGRAPH THE TWO ITEM-BUTTON STATES A STILL FRAME CANNOT REACH.
 *
 * EMPTY / AUTO / NEED n / WAIT / READY are all reachable by loading a URL, so
 * `up_item_hud.mjs` captures them. `is-winding` and `is-cooling` are NOT: they only exist
 * after a press that the sim accepted, so they need the routed `match.ts` hunk (see
 * `up_item_press.mjs`'s header) and a detached worktree that carries it.
 *
 * ⚠️ IT POLLS FOR THE STATE, IT DOES NOT SLEEP TOWARD IT. Same reason `up_item_press.mjs`
 * does: under SwiftShader the sim advances at ~0.167x wall-clock, so any fixed wait is a
 * statement about the renderer dressed up as a statement about the game.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree+hunk> -- node tools/tmp/up_item_shot.mjs '{URL}'
 *
 * Writes tools/tmp/up_shots/final-winding.png and final-cooling.png at deviceScaleFactor 2,
 * 844x390, fa-touch on — i.e. the landscape-phone corner cluster at the size Uri holds.
 */
import { chromium } from 'playwright';
const BASE=(process.argv[2]).replace(/\/$/,'');
const A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const b=await chromium.launch({args:A});
const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const p=await ctx.newPage();
await p.goto(`${BASE}/?screen=match&pointerLock=0&seats=6&player=hamburger&items=shiitake,disposal`,{waitUntil:'domcontentloaded',timeout:90000});
await p.waitForFunction('window.__gameReady === true',null,{timeout:120000});
await p.waitForFunction('window.__matchDebug && window.__matchDebug.phase === "playing"',null,{timeout:60000});
await p.evaluate(()=>document.documentElement.classList.add('fa-touch'));
await p.waitForTimeout(1500);
await p.keyboard.press('KeyQ');
for(let i=0;i<80;i++){await p.waitForTimeout(250);
  const st=await p.evaluate(()=>[...document.querySelectorAll('.hud-item-slot')].map(n=>n.className));
  if(st[0].includes('is-winding')) break;}
await p.screenshot({path:'/Users/uribishansky/claude-code/food-arena/tools/tmp/up_shots/final-winding.png'});
for(let i=0;i<160;i++){await p.waitForTimeout(250);
  const st=await p.evaluate(()=>[...document.querySelectorAll('.hud-item-slot')].map(n=>n.className));
  if(st[0].includes('is-cooling')) break;}
await p.screenshot({path:'/Users/uribishansky/claude-code/food-arena/tools/tmp/up_shots/final-cooling.png'});
console.log(await p.evaluate(()=>[...document.querySelectorAll('.hud-item-slot')].map(n=>n.className+' | '+n.querySelector('.hud-item-badge').textContent)));
await b.close();
