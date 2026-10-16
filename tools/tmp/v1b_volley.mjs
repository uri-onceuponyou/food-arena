#!/usr/bin/env node
/**
 * V1B_VOLLEY — does one multi-pellet volley on one fighter stack N copies of the hit's rings?
 * (Graphics campaign V1b, docs/REVAMP.md §8 w5: "overlapping translucent rings" sit on the
 * fighters in 5 of 8 cast notes. `hit-landed` fires per PELLET at the victim's own position, so
 * Sprinkle Spray's five pellets drew five full generic bursts — ten ground rings, five star
 * decals — and Candy Barrage's three drew three sets of the donut's four hoops.)
 *
 * Fires impacts through the SHIPPED `window.__vfxLayer.spawnImpactBurst` on a frozen live match
 * and counts what each arm SPAWNS (allocations wrapped on the instance, so expiry cannot hide a
 * count): generic rings (`allocRing`), star decals (`spawnImpactStarDecal`), impact flashes
 * (`impactFlash` particles, V1b tag — on a tree without the tag, the `burst()` flash is counted by
 * wrapping `burst` and reading its `skipFlash`), and the donut's hoops (transients built on a
 * `RingGeometry`).
 *
 *   A  Sprinkle Spray volley: 5 impacts, one victim, one frame      -> rings, decals, flashes
 *   B  Candy Barrage volley: 3 impacts, one victim, one frame        -> donut hoops
 *   C  CONTROL: one Sprinkles impact on each of TWO victims 120 wu apart, one frame
 *                                                                    -> both fully marked
 *   D  CONTROL: one victim, two Sprinkles impacts 200 ms apart       -> both fully marked
 *
 * PASS (the fix): A rings <= 2 and decals <= 1, with one flash PER PELLET (5 — the pop is
 * kept); B hoops <= 4; C rings = 4 and decals = 2; D rings = 4. A tree that stacks a volley
 * fails A/B; a fix that coalesces too much fails C/D (the controls are the known-bad for an
 * over-eager window).
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/v1b_volley.mjs --url '{URL}'
 */
import { chromium } from 'playwright';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]; if (!a.startsWith('--')) continue;
  const nx = process.argv[i + 1]; if (nx === undefined || nx.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = nx; i++; }
}
const BASE = args.url ?? process.env.PREVIEW_BASE;
if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
const W = 1280, H = 720, STEP_MS = 1000 / 60;
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(240_000);
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance); const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow(); let manual = false; let virt = 0; const q = [];
    window.__clk = { manual() { if (!manual) { virt = realNow() - base; manual = true; } }, qlen: () => q.length,
      pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } } } } };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
  });
  await page.goto(`${BASE}/?screen=match&pointerLock=0&player=donut&enemy=taco&px=1560&py=1000`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.evaluate(() => {
    window.__clk.manual();
    const layer = window.__vfxLayer; const orig = layer.sync.bind(layer);
    layer.sync = (s) => { window.__st = s; return orig(s); };
    const st = window.__stage; st.render = (dt) => st.rig.update(dt);
  });
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  for (let i = 0; i < 400; i++) {
    const ph = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
    if (ph === 'playing') break;
  }
  await page.evaluate((ms) => window.__clk.pump(6, ms), STEP_MS);

  // Install counters on the INSTANCE (methods are prototype methods; private only to TS).
  await page.evaluate(() => {
    const L = window.__vfxLayer;
    const c = window.__cnt = { rings: 0, decals: 0, flashes: 0, hoops: 0 };
    const oRing = L.allocRing.bind(L); L.allocRing = () => { c.rings++; return oRing(); };
    const oDecal = L.spawnImpactStarDecal.bind(L); L.spawnImpactStarDecal = (...a) => { c.decals++; return oDecal(...a); };
    const oBurst = L.burst.bind(L); L.burst = (o, col, sf, sh, opts) => { if (!opts?.skipFlash) c.flashes++; return oBurst(o, col, sf, sh, opts); };
    const oT = L.spawnTransientObject.bind(L);
    L.spawnTransientObject = (obj, ...rest) => { if (obj?.geometry?.type === 'RingGeometry') c.hoops++; return oT(obj, ...rest); };
  });
  const reset = () => page.evaluate(() => { const c = window.__cnt; c.rings = 0; c.decals = 0; c.flashes = 0; c.hoops = 0; });
  const read = () => page.evaluate(() => ({ ...window.__cnt }));
  const fire = (calls) => page.evaluate((calls) => {
    const L = window.__vfxLayer; const f = window.__st.fighters; const ids = Object.fromEntries((window.__st.fighters.map((x) => [x.characterId, x])));
    const donut = ids.donut;
    for (const k of calls) {
      const weapon = window.__rules?.CHARACTERS?.donut?.weapons?.find((w) => w.key === k.key)
        ?? donut?.def?.weapons?.find?.((w) => w.key === k.key);
      L.spawnImpactBurst(k.x, k.y, weapon?.color ?? '#4FC3F7', k.amount, weapon ? { weapon, characterId: 'donut', fromXWU: k.x - 100, fromYWU: k.y } : undefined);
    }
    return { haveWeapon: !!(window.__rules?.CHARACTERS?.donut || donut?.def), f: f.length };
  }, calls);
  // Weapon objects: read them out of the page's own rules module through the roster.
  const haveRules = await page.evaluate(async () => {
    try { const m = await import('/src/game/rules.ts'); window.__rules = m; return !!m.CHARACTERS?.donut; } catch (e) { return String(e); }
  });
  const X = 1500, Y = 900;
  const out = { haveRules };
  // A — Sprinkles volley
  await reset(); await fire([0, 1, 2, 3, 4].map(() => ({ key: 'Sprinkles', x: X, y: Y, amount: 1 }))); out.A = await read();
  await page.evaluate((ms) => window.__clk.pump(30, ms), STEP_MS);   // let A's window close
  // B — Candy volley
  await reset(); await fire([0, 1, 2].map(() => ({ key: 'Candy', x: X + 300, y: Y, amount: 4 }))); out.B = await read();
  await page.evaluate((ms) => window.__clk.pump(30, ms), STEP_MS);
  // C — two victims, one frame
  await reset(); await fire([{ key: 'Sprinkles', x: X, y: Y + 300, amount: 1 }, { key: 'Sprinkles', x: X + 120, y: Y + 300, amount: 1 }]); out.C = await read();
  await page.evaluate((ms) => window.__clk.pump(30, ms), STEP_MS);
  // D — one victim, 200 ms apart
  await reset(); await fire([{ key: 'Sprinkles', x: X, y: Y - 300, amount: 1 }]);
  await page.evaluate((ms) => window.__clk.pump(12, ms), STEP_MS);   // 200 ms
  await fire([{ key: 'Sprinkles', x: X, y: Y - 300, amount: 1 }]); out.D = await read();
  await browser.close();

  const fails = [];
  if (out.haveRules !== true) fails.push(`could not load the page's rules module (${out.haveRules}) — the weapon objects are the hooks' input`);
  if (out.A.flashes !== 5) fails.push(`A: ${out.A.flashes} impact flashes for 5 pellets (want 5 — the per-pellet pop is the hit read)`);
  if (out.A.rings > 2) fails.push(`A: one Sprinkles volley spawned ${out.A.rings} ground rings (want <= 2)`);
  if (out.A.decals > 1) fails.push(`A: one Sprinkles volley spawned ${out.A.decals} star decals (want <= 1)`);
  if (out.B.hoops > 4) fails.push(`B: one Candy volley spawned ${out.B.hoops} donut hoops (want <= 4)`);
  if (out.B.hoops < 1) fails.push('B: no donut hoops at all — the bespoke impact did not run (nothing measured)');
  if (out.C.rings !== 4 || out.C.decals !== 2) fails.push(`C (control, two victims): rings ${out.C.rings} decals ${out.C.decals} (want 4 / 2 — a window that eats a SECOND fighter's hit is wrong)`);
  if (out.D.rings !== 4) fails.push(`D (control, 200 ms apart): rings ${out.D.rings} (want 4 — the window must close)`);
  console.log(JSON.stringify(out));
  console.log(fails.length ? `FAIL: ${fails.join('; ')}` : 'PASS — one set of hit marks per volley, one pop per pellet, other hits untouched');
  process.exitCode = fails.length ? 1 : 0;
}
await main().catch((e) => { console.error(e); process.exitCode = 1; });
