#!/usr/bin/env node
/**
 * ch_burrito_shots — the burrito review sheet, ONE browser, BOTH shipped cameras.
 *
 * Read-only on `src/`. Owned by the burrito character agent.
 *
 * ── WHY ITS OWN TOOL AND NOT `tools/shoot.mjs --char` ────────────────────────
 * Two reasons, and both are measurements rather than preferences.
 *
 * 1. `shoot.mjs --char` fires 13 shots and never names a pitch, so every panel lands
 *    on `preview.ts:185`'s default 22deg. `305d813` records that this project ships
 *    TWO cameras — `charStage.ts:451` pitchDeg 20 (the LOBBY, which is what every one
 *    of Uri's seven reject sheets is a capture of) and `camera.ts:265` 58 (the match).
 *    Neither is "the true one": 20deg EXPOSES limb attachment, interpenetration and
 *    face construction that 58deg foreshortens away, and a real geometric fix has to
 *    improve BOTH. So this sheet shoots the same pose at both pitches, side by side.
 * 2. Peers are on the GPU. 13 shots in 13 page boots is the wrong cost for a pass that
 *    needs six. One browser, one page, one URL change per shot.
 *
 * Every capture goes through `captureSettled`, not `window.__previewReady` — the flag
 * is set in the same tick the curtain drops and measured opacity is 0.000 when it flips
 * (`docs/LESSONS.md`; a faded frame compresses contrast and silently flatters or damns
 * a value judgement).
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ch_burrito_shots.mjs \
 *     --url {URL} --out shots/ch/burrito/before
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { captureSettled } from './settle.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const outDir = get('--out', 'shots/ch/burrito/now');
const id = get('--id', 'burrito');

// pitch 20 is the LOBBY (charStage.ts:451). pitch 58 is the MATCH (camera.ts:265).
// The face panels are the same pose at both, because the whole point of this pass is a
// face and a silhouette, and the lobby is where Uri judges one.
const SHOTS = [
  { name: 'lobby_front', pitch: 20, yaw: 0, anim: 'idle', t: 1.5, w: 900, h: 1100 },
  { name: 'lobby_q45', pitch: 20, yaw: 45, anim: 'idle', t: 1.5, w: 900, h: 1100 },
  { name: 'lobby_side', pitch: 20, yaw: 90, anim: 'idle', t: 1.5, w: 900, h: 1100 },
  { name: 'lobby_back', pitch: 20, yaw: 180, anim: 'idle', t: 1.5, w: 900, h: 1100 },
  { name: 'match_front', pitch: 58, yaw: 0, anim: 'idle', t: 1.5, w: 900, h: 1100 },
  { name: 'match_run', pitch: 58, yaw: 45, anim: 'run', t: 1.07, w: 900, h: 1100 },
];

// ⚠️ TWO THINGS LEARNED THE EXPENSIVE WAY ON THIS RUN, BOTH ABOUT THE HARNESS AND
// NEITHER ABOUT THE CHARACTER.
//
// 1. A PEER'S BROKEN FILE LANDS IN *MY* SNAPSHOT. `tools/snapshot.mjs` copies the
//    WORKING tree, so "frozen" is not "clean": a peer's half-saved `home.ts` (a legacy
//    octal escape in a template literal) made Vite serve an HMR ERROR OVERLAY, and the
//    first capture of this run is a screenshot of that overlay with two green legs
//    visible underneath it. `preview.html` does not import `home.ts` — the overlay is
//    injected by `@vite/client` into every page regardless. Stubbing that client, the
//    way `head_shot.mjs` already does, makes this tool immune to any peer's syntax
//    error. It also removes HMR, which is what makes the frame stationary.
// 2. TIMEOUTS HERE ARE LOAD, NOT BUGS. A second run failed 6/6 on
//    `waitForFunction(__previewReady)` at 120 s with NO pageerror, which reads exactly
//    like a character that throws on construction. Measured at that moment: **load
//    average 84, 60 Chromium processes, 37 concurrent `node tools/` runs.** The
//    identical code had rendered 5/6 twenty minutes earlier. `docs/LESSONS.md` §16 is
//    the same shape (0.0% parent CPU under SwiftShader is expected, not a hang), so the
//    timeout is generous and the console is echoed to tell the two cases apart.
const VITE_CLIENT_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,'
  + 'acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,'
  + 'decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;'
  + 'export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
let bad = 0;
for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('PAGEERROR', String(e)); bad++; });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`CONSOLE ${m.type()}: ${m.text()}`); });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: VITE_CLIENT_STUB }));
  const url = `${base}/preview.html?piece=character&id=${id}&anim=${s.anim}`
    + `&yaw=${s.yaw}&pitch=${s.pitch}&t=${s.t}&shot=1`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 300_000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 300_000 });
    await page.waitForTimeout(400);
    const r = await captureSettled(page, {
      path: `${outDir}/${s.name}.png`, label: `burrito ${s.name}`, tool: 'ch_burrito_shots.mjs',
      settleTimeout: 180_000, timeout: 300_000,
    });
    console.log(`${s.name.padEnd(12)} pitch=${String(s.pitch).padStart(2)} yaw=${String(s.yaw).padStart(3)} `
      + `mean=${r.stats.mean.toFixed(2)} stdev=${r.stats.stdev.toFixed(2)} -> ${outDir}/${s.name}.png`);
  } catch (e) {
    bad++;
    console.error(`FAIL ${s.name}: ${String(e).split('\n')[0]}`);
  }
  await page.close();
}
await browser.close();
console.log(bad ? `\n${bad} shot(s) failed` : `\n${SHOTS.length}/${SHOTS.length} shots captured`);
process.exit(bad ? 1 : 0);
