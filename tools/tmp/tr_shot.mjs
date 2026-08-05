/** Screenshot the trophy road with a seeded profile, so the road shows real state
 *  (claimed nodes behind the pin, a claim badge ahead of it, chests in hand) rather
 *  than the all-locked view a brand-new profile gives. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const a={};for(let i=2;i<process.argv.length;i++){const k=process.argv[i];if(k.startsWith('--')){a[k.slice(2)]=process.argv[i+1];i++;}}
const b=await chromium.launch({args:ARGS});
const p=await b.newPage({viewport:{width:+(a.w??1600),height:+(a.h??900)},deviceScaleFactor:1});
await p.addInitScript((trophies)=>{
  localStorage.setItem('food-arena.profile.v1', JSON.stringify({
    name:'Amit', wins:23, losses:14, xp:1180, selected:'hamburger',
    economy:{ trophies:+trophies, bestTrophies:+trophies, coins:3480, gems:62,
      containers:{chest:2,hamburgerBox:1,pineappleBox:0,redBox:0,fireBox:0},
      claimed:[10,25,42,60,85,107,130,160], unlocked:['hamburger','donut','taco'],
      winsTowardChest:2, lastMatch:{won:true,trophies:15,coins:60,chests:0,seen:false},
      seed:424242, rolls:3 },
  }));
}, a.trophies ?? '205');
await p.goto(a.url,{waitUntil:'networkidle',timeout:60000});
await p.waitForFunction('window.__previewReady === true',null,{timeout:60000});
await p.waitForTimeout(900);
if (a.sheet) { await p.click(`[data-el="${a.sheet}"]`); await p.waitForTimeout(450); }
await mkdir(dirname(resolve(a.out)),{recursive:true});
await p.screenshot({path:a.out});
console.log('✓ '+a.out);
await b.close();
