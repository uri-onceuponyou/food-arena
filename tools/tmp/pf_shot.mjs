#!/usr/bin/env node
/**
 * pf_shot.mjs — one frame of the SHIPPED bundle at iPhone-landscape/low, so the
 * perf findings get judged against pixels and not against a description.
 * `docs/AGENT-BRIEF.md` §4.1: judging a description instead of an image is this
 * project's most common failure. Writes into `shots/`, which is gitignored.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const st = JSON.parse(readFileSync(join(process.env.PH_SCRATCH ?? '/tmp', 'ph-serve.json'), 'utf8'));
const out = process.argv[2] ?? 'shots/pf';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--disable-gpu-sandbox'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(st.url + '/?player=hamburger&enemy=donut', { waitUntil: 'domcontentloaded' });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
await p.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`, null, { timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(1500);
const tier = await p.evaluate(`({t:window.__quality?.tier, buf:[window.__stage.renderer.domElement.width, window.__stage.renderer.domElement.height]})`);
await p.screenshot({ path: `${out}/match_iphone_${st.sha.slice(0,7)}.png` });
// and a second one a few seconds later, so it is not one lucky instant
await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/match_iphone_${st.sha.slice(0,7)}_b.png` });
console.log(`tier ${tier.t} buffer ${tier.buf.join('x')} → ${out}/match_iphone_${st.sha.slice(0,7)}{,_b}.png`);
await b.close();
