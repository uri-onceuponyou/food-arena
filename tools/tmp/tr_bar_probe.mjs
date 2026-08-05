import { chromium } from 'playwright';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const b=await chromium.launch({args:ARGS});
const p=await b.newPage({viewport:{width:1600,height:900}});
await p.addInitScript(()=>{localStorage.setItem('food-arena.profile.v1', JSON.stringify({name:'Amit',wins:23,losses:14,xp:1180,selected:'hamburger',economy:{trophies:205,bestTrophies:205,coins:3480,gems:62,containers:{chest:2,hamburgerBox:1,pineappleBox:0,redBox:0,fireBox:0},claimed:[10,25,42,60,85,107,130,160],unlocked:['hamburger','donut','taco'],winsTowardChest:2,lastMatch:null,seed:424242,rolls:3}}));});
await p.goto('http://localhost:5173/?screen=trophies',{waitUntil:'networkidle'});
await p.waitForFunction('window.__previewReady === true');
await p.waitForTimeout(600);
console.log(await p.evaluate(()=>{
  const f=document.querySelector('[data-el="fill"]');
  const t=f.parentElement;
  return {inlineWidth:f.style.width, fillPx:f.getBoundingClientRect().width, trackPx:t.getBoundingClientRect().width,
          label:document.querySelector('[data-el="fillxp"]').textContent};
}));
await b.close();
