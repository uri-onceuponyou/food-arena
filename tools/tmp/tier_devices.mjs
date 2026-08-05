#!/usr/bin/env node
/**
 * What does `auto` actually pick, on every real device Playwright ships a profile for?
 *
 * `docs/LESSONS.md` §10 is final on the thing everyone wants to ask here: **frame time
 * cannot be measured in this repo.** SwiftShader is a CPU rasteriser, so "does an
 * iPhone 13 hold 60 at `medium`?" is unanswerable and no number produced here would
 * mean anything. `quality.ts` says so itself, and calls the phone default a judgement
 * call rather than a measurement.
 *
 * But there is a second question hiding underneath it that IS answerable, and it had
 * never been asked: **`detectTier()` is a classifier, and nobody had run it over a
 * corpus.** `tools/tmp/quality_api.mjs` asserts the tier on ONE emulated phone. One
 * sample cannot find a class of device that lands in the wrong bucket — and the
 * classifier's whole load-bearing signal is a single threshold, `screenShortEdgeCssPx
 * <= 500`, chosen from the sentence "a phone is ~360-430; a tablet is 768-1024".
 *
 * So this runs the SHIPPING `detectTier()` — imported from the served tree, never
 * copied — against every descriptor in `playwright.devices`, and reports every device
 * whose bucket disagrees with what the device plainly is.
 *
 * ── How it stays fast, and why that matters ─────────────────────────────────
 * `src/render/quality.ts` has NO imports (deliberately — see its header), so the whole
 * module can be dynamically imported into a page that never booted the game. The app's
 * entry script is stubbed out at the network layer, so no three.js, no WebGL context,
 * no 40 s SwiftShader boot: ~130 devices in a couple of minutes instead of a couple of
 * hours.
 *
 * ── The one signal this harness CANNOT exercise, stated up front ────────────
 * `navigator.deviceMemory` reports the HOST's memory under Chromium device emulation —
 * `quality.ts` records that trap and is built to survive it (memory may only ever LOWER
 * a tier, never raise one). So the `deviceMemory <= 4` demotion branch is unreachable
 * here and every tablet below is scored on the no-admission-of-weakness path. That is a
 * harness limit, not a result.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/tier_devices.mjs
 *   node tools/tmp/tier_devices.mjs --url <u> [--verbose]
 */

import { chromium, devices } from 'playwright';

const argv = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) argv[a.slice(2)] = true;
  else { argv[a.slice(2)] = n; i++; }
}
const BASE = String(argv.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');

/**
 * What the device PLAINLY IS, from its own descriptor — independent of the classifier
 * under test. A tablet is called out by name because no numeric signal available before
 * a GL context can separate a 9.7" iPad from a 6.7" phone reliably, which is exactly the
 * boundary being probed.
 */
function truth(name, d) {
  if (!d.isMobile && !d.hasTouch) return 'desktop';
  // Foldables are AMBIGUOUS BY CONSTRUCTION and are scored separately rather than
  // counted, and that is a finding rather than a convenience. A Fold 7 is one device
  // with two screens — a 984 px unfolded panel that is wider than an iPad mini, and a
  // 360 px cover panel that is a small phone — so the correct tier differs between two
  // faces of the same hardware and no name-based expectation can be right for both.
  // Two earlier versions of this probe got this wrong in OPPOSITE directions (calling
  // the unfolded panel a phone, then calling the cover panel a tablet) and blamed the
  // classifier both times. What matters is that the tier tracks the PANEL, which the
  // table below shows it does.
  if (/fold|flip/i.test(name)) return 'foldable';
  if (/ipad|tab |tablet|nexus 10|nexus 7|galaxy tab|kindle|playbook|touchpad|xoom|w3c/i.test(name)) return 'tablet';
  return 'phone';
}
/** What `auto` SHOULD pick for each, from `quality.ts`'s own stated policy. */
const EXPECTED = { desktop: 'high', tablet: 'medium', phone: 'low' };

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const rows = [];
const names = Object.keys(devices);
for (const name of names) {
  const d = devices[name];
  let ctx;
  try {
    ctx = await browser.newContext({ ...d });
  } catch {
    continue; // a descriptor this Playwright build cannot instantiate
  }
  const page = await ctx.newPage();
  // Stub the app entry so nothing boots. index.html still loads, so the dynamic import
  // below resolves against the dev server's origin and Vite transforms the module.
  await page.route('**/src/main.ts*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export const createHotContext=()=>({accept(){},dispose(){},on(){},send(){},prune(){},invalidate(){},data:{}});export const injectQuery=(u)=>u;export const updateStyle=()=>{};export const removeStyle=()=>{};export const ErrorOverlay=class{};export default {};' }));
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const got = await page.evaluate(async (b) => {
      const m = await import(`${b}/src/render/quality.ts`);
      return { tier: m.detectTier(), signals: m.qualitySignals(), cap: m.TIERS[m.detectTier()].pixelRatioCap };
    }, BASE);
    rows.push({
      name, kind: truth(name, d), tier: got.tier, cap: got.cap,
      vw: d.viewport?.width ?? 0, vh: d.viewport?.height ?? 0,
      dpr: d.deviceScaleFactor ?? 1,
      short: got.signals.screenShortEdgeCssPx,
      coarse: got.signals.coarsePointer,
      touch: got.signals.maxTouchPoints,
      mem: got.signals.deviceMemoryGb,
    });
  } catch (e) {
    rows.push({ name, kind: truth(name, d), tier: 'ERROR', err: String(e).slice(0, 80) });
  }
  await ctx.close();
}
await browser.close();

const errs = rows.filter((r) => r.tier === 'ERROR');
const ok = rows.filter((r) => r.tier !== 'ERROR');
const scored = ok.filter((r) => EXPECTED[r.kind]);
const wrong = scored.filter((r) => r.tier !== EXPECTED[r.kind]);

const byKind = {};
for (const r of ok) {
  byKind[r.kind] ??= {};
  byKind[r.kind][r.tier] = (byKind[r.kind][r.tier] ?? 0) + 1;
}

if (argv.verbose) {
  for (const r of ok.sort((a, b) => a.kind.localeCompare(b.kind) || a.short - b.short)) {
    console.log(`${r.tier === EXPECTED[r.kind] ? '   ' : ' ! '}${r.kind.padEnd(8)} ${r.tier.padEnd(7)} ` +
      `cap${String(r.cap).padEnd(5)} short=${String(r.short).padEnd(5)} vp=${r.vw}x${r.vh}@${r.dpr} ` +
      `coarse=${r.coarse} touch=${r.touch} mem=${r.mem}  ${r.name}`);
  }
  console.log('');
}

console.log(`devices classified: ${ok.length}${errs.length ? ` (${errs.length} failed to load)` : ''}`);
for (const [k, v] of Object.entries(byKind)) {
  console.log(`  ${k.padEnd(8)} -> ${Object.entries(v).map(([t, n]) => `${t}:${n}`).join(' ')} ` +
    `(${EXPECTED[k] ? `expected ${EXPECTED[k]}` : 'AMBIGUOUS — scored per panel below, not counted'})`);
}
// The threshold under test, and how much daylight it actually has on real hardware.
const phones = ok.filter((r) => r.kind === 'phone');
const tablets = ok.filter((r) => r.kind === 'tablet');
const folds = ok.filter((r) => r.kind === 'foldable');
if (phones.length && tablets.length) {
  const pMax = Math.max(...phones.map((r) => r.short));
  const tMin = Math.min(...tablets.map((r) => r.short));
  console.log(`\nthe 500px threshold, measured against real hardware: largest handset short edge ` +
    `${pMax}px, smallest tablet ${tMin}px — the threshold has ${Math.min(500 - pMax, tMin - 500)}px ` +
    `of clearance on its tighter side`);
  const top = [...phones].sort((a, b) => b.short - a.short).slice(0, 3);
  console.log(`  closest handsets to it: ${top.map((r) => `${r.name} ${r.short}px`).join(', ')}`);
}
if (folds.length) {
  console.log(`\nfoldables — one device, two panels, so the tier must track the PANEL:`);
  const seen = new Map();
  for (const r of folds) if (!seen.has(`${r.short}`)) seen.set(`${r.short}`, r);
  for (const r of [...seen.values()].sort((a, b) => a.short - b.short)) {
    console.log(`  ${String(r.short).padStart(4)}px -> ${r.tier.padEnd(7)} ${r.name}`);
  }
}
if (wrong.length) {
  console.log(`\nMISCLASSIFIED (${wrong.length}):`);
  for (const r of wrong) {
    console.log(`  ${r.name} — a ${r.kind}, short edge ${r.short}px, coarse=${r.coarse} ` +
      `touch=${r.touch} -> ${r.tier}, expected ${EXPECTED[r.kind]}`);
  }
}
console.log(`\n${scored.length - wrong.length}/${scored.length} unambiguous devices land in the bucket ` +
  `the device plainly is${folds.length ? `, plus ${folds.length} foldable panels scored above` : ''}`);
console.log('⚠️ navigator.deviceMemory reports the HOST under emulation, so the <=4GB demotion ' +
  'branch is unreachable here — a harness limit quality.ts already records, not a result.');
process.exit(wrong.length > 0 || errs.length > 0 ? 1 : 0);
