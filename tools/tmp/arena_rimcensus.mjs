#!/usr/bin/env node
/**
 * RIM CENSUS, by the ONLY discriminator that cannot be fooled.
 *
 * ⚠️ Every existing rim census on this project tests `userData.rimUniforms` or
 * `userData.rim`. BOTH are wrong after `c90c9ea`'s second finding: `Material.copy()`
 * deep-JSON-copies `userData` (`three/src/materials/Material.js:974`), so a PLAIN
 * `.clone()` of a rimmed material comes back carrying `userData.rim` — and, if the
 * source had already rendered, a dead JSON-mangled `rimUniforms` object too — while
 * having NO rim, because `copy()` does not name `onBeforeCompile`. A census on either
 * key counts the corpse as a live rim. That is four instruments (`haloprobe`,
 * `matvar`, `rimcheck`, `p1_matresp`) and it is exactly the class `CLAUDE.md` #6 warns
 * about: an instrument returning a confident wrong answer.
 *
 * The ground truth is the compiled-shader hook itself. `applyRimLight` is the only
 * thing in `src/` that assigns `onBeforeCompile` with a `rimColor` uniform, and
 * `Material.copy()` provably does not carry it, so:
 *
 *     hasRim(m) === typeof m.onBeforeCompile === 'function'
 *                  && m.onBeforeCompile.toString().includes('rimColor')
 *
 * KNOWN-BAD VALIDATION, run every time before the count is printed (`--selftest` is
 * inline because the answer depends on the live scene): the probe takes the FIRST
 * rimmed material it finds, plain-`.clone()`s it, and asserts the clone reports
 * hasRim FALSE while `userData.rim` reports TRUE. If that assertion does not hold, the
 * discriminator is not discriminating and the census refuses to print.
 *
 *   node tools/tmp/arena_rimcensus.mjs --url http://localhost:PORT [--station 700:640]
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5173');
const STATION = arg('station', '700:640');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const [px, py] = STATION.split(':');
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const scene = window.__stage.scene;
  const hasRim = (m) => typeof m.onBeforeCompile === 'function'
    && m.onBeforeCompile.toString().includes('rimColor');
  const seen = new Set();
  const lit = [], arena = [], cast = [];
  let arenaRoot = null;
  scene.traverse((o) => { if (o.name === 'arena:kitchen') arenaRoot = o; });
  const collect = (root, bucket) => {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) continue;
        if (bucket.some((e) => e.uuid === m.uuid)) continue;
        bucket.push({ uuid: m.uuid, name: m.name || '(unnamed)', rim: hasRim(m),
          udRim: m.userData && m.userData.rim !== undefined,
          udUni: m.userData && m.userData.rimUniforms !== undefined });
      }
    });
  };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) continue;
      if (seen.has(m.uuid)) continue; seen.add(m.uuid);
      lit.push({ name: m.name || '(unnamed)', rim: hasRim(m), udRim: m.userData && m.userData.rim !== undefined });
    }
  });
  if (arenaRoot) collect(arenaRoot, arena);
  for (const o of scene.children) if (String(o.name).startsWith('character:')) collect(o, cast);

  // ── KNOWN-BAD CONTROL. A plain clone of a rimmed material MUST read rim:false
  //    and udRim:true, or this discriminator is not one.
  let control = null;
  scene.traverse((o) => {
    if (control || !o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (!m || !m.isMeshStandardMaterial || !hasRim(m)) continue;
      const c = m.clone();
      control = { cloneHasRim: hasRim(c), cloneUdRim: c.userData && c.userData.rim !== undefined,
                  srcHasRim: hasRim(m), src: m.name || '(unnamed)' };
      c.dispose();
      return;
    }
  });
  return { lit, arena, cast, control };
});
await page.close(); await browser.close();

const c = res.control;
if (!c) { console.error('✗ no rimmed material on screen — cannot validate the discriminator'); process.exit(2); }
const ok = c.srcHasRim === true && c.cloneHasRim === false && c.cloneUdRim === true;
console.log(`KNOWN-BAD CONTROL on '${c.src}': src rim=${c.srcHasRim}  plain-clone rim=${c.cloneHasRim}  clone userData.rim=${c.cloneUdRim}  ${ok ? 'VALID' : '✗ INVALID'}`);
if (!ok) { console.error('✗ the discriminator does not separate a plain clone from its source — refusing to print a census'); process.exit(1); }

const tally = (rows, label) => {
  const n = rows.length, r = rows.filter((x) => x.rim).length;
  const ghosts = rows.filter((x) => !x.rim && x.udRim).length;
  console.log(`${label.padEnd(22)} ${String(r).padStart(3)} / ${String(n).padStart(3)} carry a LIVE rim` +
    (ghosts ? `   (${ghosts} carry userData.rim with NO rim — the corpse a userData census would count)` : ''));
  return { n, r };
};
console.log('');
tally(res.lit, 'whole scene (lit)');
tally(res.arena, 'arena:kitchen');
tally(res.cast, 'characters');
const norim = res.arena.filter((x) => !x.rim).map((x) => x.name);
if (norim.length) console.log('\narena materials still WITHOUT a rim:\n  ' + norim.join('\n  '));
