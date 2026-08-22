#!/usr/bin/env node
/**
 * FX_CORE — IS THE UNION CORE RENDERING AND INVISIBLE?
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 *
 * `CLAUDE.md` rule 4: *"when something isn't there, assume it is rendering and
 * INVISIBLE"* — true eighteen times in this project. Round 2's blind critic said the
 * union core *"IS additive but renders at runtime opacity 0.183 and is invisible in
 * every 4x crop"*, and `vfx.ts`'s own pool comment records the same element having been
 * *"configured, allocated, counted by `FX_UNION_STATS.cores`, and invisible"* once
 * before, because `depthTest` was on.
 *
 * `FX_UNION_STATS.cores` counts ALLOCATIONS. It cannot distinguish a core that drew a
 * hot centre from one that drew nothing, and both round 2 and the round before it were
 * misled by exactly that gap. So this asks the frame instead:
 *
 *   1. fire one bespoke impact on a frozen clock and a seeded RNG,
 *   2. read every `vfx_union_core` sprite's LIVE state — visible, opacity, world scale,
 *      colour, screen position,
 *   3. ABLATE just those sprites and re-render: the differing pixels are, by
 *      construction, the ones the core owns. A core that owns 0 px is invisible
 *      whatever its opacity says.
 *
 * ── Controls, because every number here can be vacuous ────────────────────────
 *
 *   NULL      two captures with no change between them must differ by EXACTLY 0 px.
 *             Camera shake re-randomises inside `render()` at dt = 0 and CSS keyframes
 *             run off the document timeline; both are stilled and the null is the proof.
 *   NONEMPTY  the core list is asserted non-empty BEFORE its ablation is believed.
 *             `[].every()` is true and a 0-px mask over an empty selection reads
 *             exactly like "the core costs nothing".
 *   SELF-PAIR the sprites are made visible again and the frame must return
 *             BIT-IDENTICAL, or the ablation itself moved something.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/fx_core.mjs --url '{URL}' --cid hamburger --key Tomato --slice 160
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; }
}
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('fx_core: --url or PREVIEW_BASE required'); process.exit(2); }
if (BASE.includes(':5173')) { console.error('fx_core: that is the shared dev server'); process.exit(2); }
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const PITCH = Number(args.pitch ?? 58);
const CID = String(args.cid ?? 'hamburger');
const KEY = String(args.key ?? 'Tomato');
const OUT = resolve(String(args.out ?? 'shots/fx3/core'));
const SLICES = String(args.slices ?? '40,100,160,240').split(',').map(Number);
mkdirSync(OUT, { recursive: true });

let fail = 0;
const bad = (m) => { console.log(`  🔴 ${m}`); fail++; };

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 240)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
  await page.addInitScript(() => {
    let st = 1;
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = { seed(v) { st = ((v >>> 0) || 1); } };
  });
  await page.goto(`${BASE}/?pointerLock=0&player=hamburger&enemy=donut`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.waitForFunction(() => !!window.__vfxLayer && !!window.__vfxDebugFighters && !!window.__stage);
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-el="countdown"]');
    return !c || c.style.display === 'none';
  }, null, { timeout: 120_000 });

  // Freeze: rAF parked, CSS animations stilled, camera shake zeroed, pitch pinned.
  const frozen = await page.evaluate((p) => {
    window.requestAnimationFrame = () => 0;
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{animation:none !important;transition:none !important}';
    document.head.appendChild(st);
    const rig = window.__stage.rig;
    if (rig) {
      rig.shakeAmount = 0;
      if (rig.shakeOffset && rig.shakeOffset.set) rig.shakeOffset.set(0, 0, 0);
      if ('pitchDeg' in rig) rig.pitchDeg = p;
    }
    return { hasRig: !!rig, pitch: rig && rig.pitchDeg };
  }, PITCH);
  console.log(`frozen ${JSON.stringify(frozen)}  pitch=${PITCH}  case=${CID}.${KEY}`);

  const shot = async (name) => {
    const b = await page.locator('canvas').screenshot(name ? { path: join(OUT, name) } : {});
    const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
  };
  const diff = (a, b, d = 0) => {
    let n = 0; let sum = 0;
    for (let i = 0; i < a.w * a.h; i++) {
      const k = i * 4;
      const dd = Math.max(Math.abs(a.data[k] - b.data[k]),
        Math.abs(a.data[k + 1] - b.data[k + 1]), Math.abs(a.data[k + 2] - b.data[k + 2]));
      if (dd > d) { n++; sum += dd; }
    }
    return { n, mean: n ? sum / n : 0 };
  };

  console.log(`\nslice  cores  visible  opacity   scaleM   colour     worldXZ           ownedPx  meanDelta`);
  for (const slice of SLICES) {
    // eslint-disable-next-line no-await-in-loop
    const st = await page.evaluate(([cid, key, ms]) => (async () => {
      const rules = await import('/src/game/rules.ts');
      const weapon = rules.CHARACTERS[cid].weapons.find((x) => x.key === key);
      if (!weapon) return { err: `no weapon ${cid}.${key}` };
      const fi = window.__vfxDebugFighters;
      window.__vfxLayer.clear();
      window.__vfxLayer.updateEffects(0);
      window.__rng.seed(777);
      window.__vfxLayer.spawnImpactBurst(fi.player.x, fi.player.y, weapon.color, weapon.damage,
        { weapon, characterId: cid, fromXWU: fi.player.x - 60, fromYWU: fi.player.y });
      window.__vfxLayer.updateEffects(ms / 1000);
      const grp = window.__stage.scene.getObjectByName('vfx_layer');
      const cores = [];
      grp.traverse((o) => {
        if (o.name !== 'vfx_union_core') return;
        if (!o.visible) return;
        o.updateWorldMatrix(true, false);
        cores.push({
          opacity: Number(o.material.opacity.toFixed(4)),
          scale: Number(o.scale.x.toFixed(3)),
          color: `#${o.material.color.getHexString()}`,
          blending: o.material.blending,
          depthTest: o.material.depthTest,
          wx: Number(o.position.x.toFixed(2)),
          wz: Number(o.position.z.toFixed(2)),
        });
      });
      window.__coreSprites = [];
      grp.traverse((o) => { if (o.name === 'vfx_union_core' && o.visible) window.__coreSprites.push(o); });
      window.__stage.render(0);
      return { cores, n: cores.length };
    })(), [CID, KEY, slice]);
    if (st.err) { bad(st.err); break; }

    // eslint-disable-next-line no-await-in-loop
    const on1 = await shot(null);
    // eslint-disable-next-line no-await-in-loop
    const on2 = await shot(null);
    // eslint-disable-next-line no-await-in-loop
    const nul = diff(on1, on2, 0);
    if (nul.n !== 0) bad(`NULL control at slice ${slice}: ${nul.n} px (must be 0) — the frame is not frozen`);
    if (st.n === 0) { bad(`slice ${slice}: ZERO visible union cores — the ablation below would be VACUOUS, not run`); continue; }

    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(() => { window.__coreSprites.forEach((o) => { o.visible = false; }); window.__stage.render(0); });
    // eslint-disable-next-line no-await-in-loop
    const off = await shot(`core_off_${slice}.png`);
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(() => { window.__coreSprites.forEach((o) => { o.visible = true; }); window.__stage.render(0); });
    // eslint-disable-next-line no-await-in-loop
    const back = await shot(`core_on_${slice}.png`);
    // eslint-disable-next-line no-await-in-loop
    const owned = diff(on1, off, 0);
    // eslint-disable-next-line no-await-in-loop
    const selfPair = diff(on1, back, 0);
    if (selfPair.n !== 0) bad(`SELF-PAIR at slice ${slice}: ${selfPair.n} px differ after restore (must be 0)`);
    const c = st.cores[0];
    console.log(`${String(slice).padStart(5)}  ${String(st.n).padStart(5)}  ${String(st.n).padStart(7)}  `
      + `${String(c.opacity).padStart(7)}  ${String(c.scale).padStart(7)}  ${c.color}  `
      + `${String(c.wx).padStart(6)},${String(c.wz).padEnd(6)}  ${String(owned.n).padStart(9)}  ${owned.mean.toFixed(1)}`);
    if (owned.n === 0) bad(`slice ${slice}: the core is VISIBLE, allocated and owns ZERO PIXELS — rendering and invisible`);
  }
} finally {
  await browser.close();
}
if (fail) { console.log(`\n🔴 fx_core: ${fail} fault(s)`); process.exit(1); }
console.log('\n✅ fx_core: no faults');
