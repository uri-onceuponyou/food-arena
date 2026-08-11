#!/usr/bin/env node
/**
 * pf_look.mjs — render the SAME FRAME with and without a candidate patch, so the
 * ranked list carries a LOOK cost as well as a millisecond saving.
 *
 * `docs/AGENT-BRIEF.md` §4.1 — judging a description instead of an image is this
 * project's most common failure, and "take the static props out of the shadow
 * pass" is a 52.5%-of-draw-calls saving that is also a visible art change. The
 * two frames are captured from ONE page with the sim frozen between them, so the
 * only difference is the patch. Output goes to `shots/`, which is gitignored.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const st = JSON.parse(readFileSync(join(process.env.PH_SCRATCH ?? '/tmp', 'ph-serve.json'), 'utf8'));
const out = 'shots/pf'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--disable-gpu-sandbox'] });
const ctx = await b.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(st.url + '/?player=hamburger&enemy=donut', { waitUntil: 'domcontentloaded' });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
await p.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`, null, { timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(2500);
// Freeze the sim clock so the two frames differ ONLY by the patch. Camera shake
// re-randomises on every render() at dt=0 (AGENT-BRIEF §3), so zero it explicitly.
await p.evaluate(`(() => {
  const s = window.__stage;
  if (s.rig && s.rig.shakeOffset) s.rig.shakeOffset.set(0,0,0);
  if (window.__matchDebug) window.__matchDebug.paused = true;
})()`);
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/shadow_A_shipped.png` });
const n = await p.evaluate(`(() => {
  const s = window.__stage, r = s.renderer;
  let n = 0;
  s.scene.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    let c = o, under = false;
    while (c) { if ((c.name || '') === 'arena_props') { under = true; break; } c = c.parent; }
    if (!under) return;
    o.castShadow = false; n++;
  });
  r.shadowMap.needsUpdate = true;
  return n;
})()`);
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/shadow_B_props_noshadow.png` });
console.log(`props taken out of the shadow pass: ${n} casters → ${out}/shadow_{A_shipped,B_props_noshadow}.png`);
await b.close();
