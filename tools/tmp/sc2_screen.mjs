#!/usr/bin/env node
/**
 * sc2_screen — HOW MUCH OF THE PHONE'S SCREEN DOES THE GAME GET, BEFORE AND AFTER?
 *
 * `ph_chrome.mjs` established the BEFORE (`docs/PHONE.md` §1): 34.5% in portrait, 75-78%
 * in landscape, with two independent losses — browser chrome (20-25%, not ours) and
 * `SUPPORTED_ASPECT.min = 4/3` (a further 43% in portrait, ours). This tool answers the
 * two questions that follow from it and that `ph_chrome` cannot:
 *
 *   1. **What does the manifest actually buy?** A home-screen launch changes exactly one
 *      thing a probe can emulate — the VIEWPORT the page is handed. So each device is run
 *      twice: at Safari's tab viewport (the descriptor) and at the full screen (standalone).
 *      ⚠️ That is an emulation of the ONE consequence, not of iOS. It is exact for the
 *      canvas geometry, because the canvas rect is computed by our own `Stage.resize()`
 *      from the viewport, and it says nothing about anything else standalone changes.
 *
 *   2. **What would widening the mask buy, and cost?** A second build with
 *      `SUPPORTED_ASPECT.min` patched, so the two arms differ in exactly one constant.
 *      The COST is the number nobody has: how much extra arena a portrait player would
 *      see that a landscape player does not. `tools/aspect.mjs` cannot answer this — it
 *      checks the SPREAD of `guaranteedRadiusUnits`, which is a FLOOR, and the floor is
 *      held at every aspect by construction (`computeFairDistance` solves for it). So
 *      aspect.mjs passes at 0.00 wu whatever `min` is set to. That is not a bug in
 *      aspect.mjs; it is the wrong instrument for this question, and this file records
 *      that rather than quoting its PASS as evidence.
 *
 * 🚨 The BLEED is the fairness quantity, not the guarantee. `camera.ts`'s own header says
 * so: cosmetic bleed "is only *fair* while the bleed stays small, so it is CAPPED". The
 * cap IS `SUPPORTED_ASPECT`. Widening it does not break the guarantee — it removes the cap.
 *
 * Usage:
 *   node tools/tmp/sc2_screen.mjs                  # both arms, every profile
 *   node tools/tmp/sc2_screen.mjs --arms shipped   # skip the second build
 *   node tools/tmp/sc2_screen.mjs --wide 0.46      # a different candidate min
 *   node tools/tmp/sc2_screen.mjs --shots          # PNGs into shots/sc2/
 */
import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { freeze, build, serve, ROOT } from './sc2_lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const has = (k) => argv.includes(`--${k}`);
const ARMS = arg('arms', 'both');
const WIDE = Number(arg('wide', '0.46'));
const SHOTS = has('shots');
const OUT = join(ROOT, 'shots', 'sc2');
if (SHOTS) mkdirSync(OUT, { recursive: true });

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'];

/** The same profiles `docs/PHONE.md` §1 tabulates, so the BEFORE column is comparable. */
const PROFILES = [
  'iPhone 14', 'iPhone 15', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'Pixel 7',
  'iPhone 14 landscape', 'iPhone 15 landscape', 'iPhone 16 Pro landscape',
  'iPhone 16 Pro Max landscape', 'Pixel 7 landscape',
];

/**
 * The screen as the player is HOLDING it. iOS reports `screen` portrait-oriented in both
 * orientations — the same quirk `quality.ts` handles by taking the min of the two edges.
 */
function heldScreen(d, land) {
  return land
    ? { width: Math.max(d.screen.width, d.screen.height), height: Math.min(d.screen.width, d.screen.height) }
    : { ...d.screen };
}

async function measure(browser, url, vp, dpr, label) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: dpr, hasTouch: true, isMobile: true,
  });
  let m = null;
  try {
    await page.goto(`${url}?player=hamburger&enemy=donut&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction('window.__gameReady === true && typeof window.__fairView === "function"', null, { timeout: 180_000 });
    await page.waitForTimeout(500);
    m = await page.evaluate(`(() => {
      const c = document.querySelector('#game canvas');
      const r = c ? c.getBoundingClientRect() : null;
      return {
        inner: [innerWidth, innerHeight],
        canvas: r ? [Math.round(r.width), Math.round(r.height)] : null,
        buf: c ? [c.width, c.height] : null,
        tier: window.__quality?.tier ?? null,
        view: window.__fairView(),
      };
    })()`);
    if (SHOTS) await page.screenshot({ path: join(OUT, `${label.replace(/[^a-z0-9]+/gi, '_')}.png`) });
  } catch (e) {
    m = { err: String(e.message).split('\n')[0] };
  } finally { await page.close(); }
  return m;
}

/** Build one arm: HEAD + this pass's files, optionally with `min` patched. */
function armDist(minOverride) {
  const tree = freeze();
  if (minOverride != null) {
    const f = join(tree, 'src/render/camera.ts');
    const before = readFileSync(f, 'utf8');
    const after = before.replace(/min:\s*4\s*\/\s*3,/, `min: ${minOverride},`);
    if (after === before) throw new Error('the SUPPORTED_ASPECT.min patch matched NOTHING — this arm would silently measure the shipped mask');
    writeFileSync(f, after);
  }
  return { tree, dist: build(tree, '/') };
}

const rows = [];
async function runArm(name, minOverride) {
  const { tree, dist } = armDist(minOverride);
  const host = await serve(dist, '/');
  const browser = await chromium.launch({ args: LAUNCH });
  try {
    for (const p of PROFILES) {
      const d = devices[p];
      const land = / landscape$/.test(p);
      const screen = heldScreen(d, land);
      // Landscape descriptors carry a viewport already rotated; portrait ones do not.
      const tabVp = { width: d.viewport.width, height: d.viewport.height };
      const arms = [
        ['tab', tabVp],
        ['standalone', { width: screen.width, height: screen.height }],
      ];
      for (const [mode, vp] of arms) {
        if (minOverride != null && mode === 'tab' && !land) { /* keep both: portrait is the case under test */ }
        const label = `${name}-${p}-${mode}`;
        const m = await measure(browser, host.url, vp, Math.min(d.deviceScaleFactor ?? 2, 2), label);
        rows.push({ arm: name, device: p, land, mode, screen, vp, ...m });
        process.stdout.write('.');
      }
    }
  } finally {
    await browser.close();
    await host.close();
    rmSync(tree, { recursive: true, force: true });
  }
}

console.log(`\nsc2_screen — screen fraction, tab vs standalone, at the shipped mask and at min=${WIDE}\n`);
await runArm('SHIPPED', null);
if (ARMS !== 'shipped') await runArm(`WIDE(${WIDE})`, WIDE);
console.log('\n');

const pct = (a, b) => `${((a / b) * 100).toFixed(1)}%`;
const arms = [...new Set(rows.map((r) => r.arm))];
for (const a of arms) {
  console.log(`── ${a} ${'─'.repeat(78 - a.length)}`);
  console.log('device                        mode         screen     viewport    canvas    game/screen  bind   near   far  GUARANT');
  for (const r of rows.filter((x) => x.arm === a)) {
    if (r.err) { console.log(`${r.device.padEnd(29)} ${r.mode.padEnd(12)} ERROR ${r.err}`); continue; }
    const g = r.canvas[0] * r.canvas[1];
    const s = r.screen.width * r.screen.height;
    console.log(
      `${r.device.padEnd(29)} ${r.mode.padEnd(12)} ${`${r.screen.width}x${r.screen.height}`.padEnd(10)} `
      + `${`${r.vp.width}x${r.vp.height}`.padEnd(11)} ${`${r.canvas[0]}x${r.canvas[1]}`.padEnd(9)} `
      + `${pct(g, s).padStart(6)}       ${r.view.binding.padEnd(6)}`
      + `${r.view.nearUnits.toFixed(0).padStart(5)} ${r.view.farUnits.toFixed(0).padStart(5)} ${r.view.guaranteedRadiusUnits.toFixed(2).padStart(7)}`,
    );
  }
  console.log('');
}

// ── the two verdicts, computed rather than eyeballed ────────────────────────
const find = (arm, device, mode) => rows.find((r) => r.arm === arm && r.device === device && r.mode === mode);
const checks = [];
const push = (n, ok, d) => checks.push([n, ok, d]);

for (const dev of ['iPhone 15', 'iPhone 16 Pro Max']) {
  const tab = find('SHIPPED', dev, 'tab');
  const sa = find('SHIPPED', dev, 'standalone');
  const tabL = find('SHIPPED', `${dev} landscape`, 'tab');
  const saL = find('SHIPPED', `${dev} landscape`, 'standalone');
  if (!tab || !sa || !tabL || !saL || tab.err || sa.err) continue;
  const area = (r) => r.canvas[0] * r.canvas[1];
  const scr = (r) => r.screen.width * r.screen.height;
  console.log(`  ${dev}`);
  console.log(`    PORTRAIT   tab ${pct(area(tab), scr(tab))}  ->  standalone ${pct(area(sa), scr(sa))}   `
    + `(viewport ${tab.vp.height} -> ${sa.vp.height} px of height, canvas ${tab.canvas.join('x')} -> ${sa.canvas.join('x')})`);
  console.log(`    LANDSCAPE  tab ${pct(area(tabL), scr(tabL))}  ->  standalone ${pct(area(saL), scr(saL))}   `
    + `(viewport ${tabL.vp.width}x${tabL.vp.height} -> ${saL.vp.width}x${saL.vp.height})`);
  push(`${dev}: standalone gains real game area in LANDSCAPE`, area(saL) > area(tabL) * 1.05, `${area(tabL)} -> ${area(saL)} px`);
  push(`${dev}: standalone gains NOTHING in portrait while the 4:3 mask stands (canvas is width-bound)`,
    area(sa) === area(tab), `${area(tab)} -> ${area(sa)} px`);
}
console.log('');

if (ARMS !== 'shipped') {
  const w = `WIDE(${WIDE})`;
  for (const dev of ['iPhone 15']) {
    const a = find('SHIPPED', dev, 'standalone');
    const b = find(w, dev, 'standalone');
    const land = find('SHIPPED', `${dev} landscape`, 'standalone');
    if (!a || !b || !land || a.err || b.err || land.err) continue;
    const areaA = a.canvas[0] * a.canvas[1];
    const areaB = b.canvas[0] * b.canvas[1];
    const depth = (r) => r.view.nearUnits + r.view.farUnits;
    console.log(`  WIDENING THE MASK, ${dev} portrait standalone:`);
    console.log(`    canvas            ${a.canvas.join('x')} -> ${b.canvas.join('x')}   (${(areaB / areaA).toFixed(2)}x the pixels)`);
    console.log(`    game / screen     ${pct(areaA, a.screen.width * a.screen.height)} -> ${pct(areaB, b.screen.width * b.screen.height)}`);
    console.log(`    guaranteed radius ${a.view.guaranteedRadiusUnits.toFixed(2)} -> ${b.view.guaranteedRadiusUnits.toFixed(2)} wu  (the FLOOR — unchanged by construction)`);
    console.log(`    visible DEPTH     ${depth(a).toFixed(0)} -> ${depth(b).toFixed(0)} wu   vs a landscape player's ${depth(land).toFixed(0)} wu`);
    console.log(`    => a portrait player would see ${(depth(b) / depth(land)).toFixed(2)}x the arena DEPTH of a landscape player on the same phone.`);
    push('WIDE: the guaranteed radius is UNCHANGED — so aspect.mjs cannot see this change',
      Math.abs(a.view.guaranteedRadiusUnits - b.view.guaranteedRadiusUnits) < 0.5,
      `${a.view.guaranteedRadiusUnits.toFixed(2)} vs ${b.view.guaranteedRadiusUnits.toFixed(2)} wu`);
    push('WIDE: and the BLEED is not — the portrait player sees materially more depth',
      depth(b) > depth(land) * 1.2, `${depth(b).toFixed(0)} vs ${depth(land).toFixed(0)} wu`);
    push('WIDE: the patch actually changed the canvas (not a silent no-op arm)', areaB > areaA * 1.2, `${areaA} -> ${areaB} px`);
  }
  console.log('');
}

let fails = 0;
for (const [n, ok, d] of checks) { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}   (${d})`); }
console.log(`\n  ${checks.length - fails}/${checks.length}\n`);
process.exitCode = fails ? 1 : 0;
