// What is a "mid-value character"? Measure the cast's own body pixels, using the
// silhouette render as an exact mask. The acceptance test's CHAR_L must come from
// this, not from a guess.
import { chromium } from 'playwright';
import sharp from 'sharp';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const URL = process.argv[2] ?? 'http://localhost:5190';
const b = await chromium.launch({ args: ARGS });
const p = await b.newPage({ viewport: { width: 1600, height: 500 }, deviceScaleFactor: 1 });
await p.route('**/@vite/client*', (r)=>r.fulfill({status:200,contentType:'text/javascript',body:'export const createHotContext=()=>({accept:()=>{},dispose:()=>{},prune:()=>{},invalidate:()=>{},on:()=>{},off:()=>{},send:()=>{},data:{}});export const injectQuery=(u)=>u;export const updateStyle=()=>{};export const removeStyle=()=>{};export const ErrorOverlay=class{};export default {};'}));
async function shot(url){ await p.goto(url,{waitUntil:'networkidle',timeout:60000}); await p.waitForFunction('window.__previewReady === true',null,{timeout:60000}); return p.screenshot(); }
const colour = await shot(`${URL}/preview.html?piece=roster&t=1.5&shot=1`);
const sil    = await shot(`${URL}/preview.html?piece=roster&t=1.5&shot=1&silhouette=1`);
const C = (await sharp(colour).removeAlpha().raw().toBuffer({resolveWithObject:true}));
const S = (await sharp(sil).removeAlpha().raw().toBuffer({resolveWithObject:true}));
const n = C.info.width*C.info.height;
const vals=[];
for(let i=0;i<n;i++){
  if(S.data[i*3] > 100) continue;              // silhouette: subject is black
  vals.push((0.2126*C.data[i*3]+0.7152*C.data[i*3+1]+0.0722*C.data[i*3+2])/255);
}
vals.sort((a,b)=>a-b);
const q=(f)=>vals[Math.round((vals.length-1)*f)].toFixed(3);
const mean=(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(3);
console.log(`cast body pixels n=${vals.length}  mean=${mean}  p05=${q(0.05)} p25=${q(0.25)} MEDIAN=${q(0.5)} p75=${q(0.75)} p95=${q(0.95)}`);
await b.close();
