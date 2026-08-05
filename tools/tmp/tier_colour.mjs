#!/usr/bin/env node
/**
 * Does a quality tier cost COLOUR?
 *
 * `docs/LESSONS.md` §7 and `docs/STATE.md` both flag cumulative desaturation as a live
 * concern — the game measures mean saturation 0.324 against a reference 0.493, and two
 * independently-correct passes overshot because each only measured itself. A tier that
 * drops the bloom pass changes highlights, so it has to be checked against that budget
 * rather than assumed neutral.
 *
 * ── Why this is not just three `arena-scan` runs ────────────────────────────
 * Three separate page loads are three separate sim states, and the difference between
 * two tiers here is ~1/255 — well inside the noise of a fighter standing somewhere
 * slightly different. So this loads each station ONCE, freezes `requestAnimationFrame`,
 * and then drives the live tier API (`window.__quality.force`) between captures. The
 * three frames are therefore byte-identical except for the renderer configuration, and
 * a control capture (force the tier it is already on) proves the freeze holds.
 *
 * Output is one directory per tier of `*.canvas.png`, in exactly the layout
 * `tools/tmp/chroma.mjs` consumes — so the numbers come out of the SAME code that
 * produced every colour figure recorded on this project, rather than a second opinion.
 *
 *   node tools/tmp/tier_colour.mjs --url http://localhost:5188 --out shots/tier/colour
 *   node tools/tmp/chroma.mjs shots/tier/colour-high shots/tier/colour-medium shots/tier/colour-low
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', 'http://localhost:5188').replace(/\/$/, '');
const out = get('--out', 'shots/tier/colour');

// A subset of `arena-scan.mjs`'s station list, coordinates copied verbatim: two lanes,
// the hub, a pantry, an edge and a hazard. Six is enough to see a colour shift that is
// global to the post chain, which is the only kind a tier can cause.
const STATIONS = [
  { id: 'spawn_west', x: 160, y: 500, fog: 850 },
  { id: 'west_lane', x: 340, y: 500, fog: 850 },
  { id: 'pot_diagonal', x: 570, y: 430, fog: 850 },
  { id: 'pantry_ne', x: 1150, y: 330, fog: 850 },
  { id: 'edge_west', x: 70, y: 500, fog: 850 },
  { id: 'fryer_south', x: 560, y: 790, fog: 850 },
];
const TIERS = ['high', 'medium', 'low'];

for (const t of TIERS) await mkdir(`${out}-${t}`, { recursive: true });
await mkdir(`${out}-control`, { recursive: true });

const browser = await chromium.launch({ args: LAUNCH_ARGS });
for (const s of STATIONS) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await page.goto(`${base}/?player=hamburger&enemy=donut&px=${s.x}&py=${s.y}&fogRadius=${s.fog}&simSpeed=0.02&pointerLock=0&tier=high`,
    { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90_000 });
  await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(600);
  // Freeze: from here the only thing that may change the frame is the tier.
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(200);

  const canvas = page.locator('canvas').first();
  for (const t of [...TIERS, 'control']) {
    await page.evaluate((tier) => {
      window.__quality.force(tier === 'control' ? 'low' : tier);
      window.__stage.render(1 / 60);
    }, t);
    await page.waitForTimeout(120);
    await canvas.screenshot({ path: `${out}-${t}/${s.id}.canvas.png`, timeout: 90_000 });
  }
  console.log(`captured ${s.id}`);
  await page.close();
}
await browser.close();
console.log(`\n${STATIONS.length} stations x ${TIERS.length + 1} captures -> ${out}-{high,medium,low,control}`);
console.log(`now: node tools/tmp/chroma.mjs ${TIERS.map((t) => `${out}-${t}`).join(' ')} ${out}-control`);
