/** The state a brand-new player actually sees: 0 trophies, nothing claimed,
 *  nothing held. The most common first impression, and the easiest to get wrong. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];
const a={};for(let i=2;i<process.argv.length;i++){const k=process.argv[i];if(k.startsWith('--')){a[k.slice(2)]=process.argv[i+1];i++;}}
const b=await chromium.launch({args:ARGS});
const p=await b.newPage({viewport:{width:+(a.w??1600),height:+(a.h??900)},deviceScaleFactor:1});
await p.goto(a.url,{waitUntil:'networkidle',timeout:60000});
await p.waitForFunction('window.__previewReady === true',null,{timeout:60000});
await p.waitForTimeout(700);
await mkdir(dirname(resolve(a.out)),{recursive:true});
await p.screenshot({path:a.out});
console.log('✓ '+a.out);
await b.close();
