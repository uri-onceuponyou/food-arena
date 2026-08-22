#!/usr/bin/env node
/**
 * FX_DRAWS — WHAT DOES THE VFX SHADING PASS COST IN DRAW CALLS? Exact, per frame.
 *
 * `CLAUDE.md` rule 10: **draw counts are EXACT** — there is no resolution floor to hide
 * behind. Uri plays an **iPhone 15 Pro**; `5aa4655` took a frame from 928 to **423**
 * draws, and a peer measured SSAO at **+80.6% draws at N=6**. Particle-heavy VFX is the
 * other easy way to give that back, so any VFX change ships with this number or it does
 * not ship.
 *
 * ## How the number stops lying (the technique is `lq_draw.mjs`'s and `stage.ts:784`'s)
 *
 * `renderer.info.render.calls` is reset by three at the TOP of every
 * `WebGLRenderer.render()`, and `Stage.render()` drives a post chain that calls
 * `render()` several times — so read naively it reports the LAST PASS, not the frame.
 * `info.autoReset = false` plus one explicit `info.reset()` immediately before
 * `stage.render(0)` makes it the whole frame: scene + shadow map + every post pass.
 *
 * Pinned, because each of these has produced a wrong number in this repo before:
 *   · **a frozen clock** — otherwise the two arms sample different moments of a match
 *   · **a zeroed shake** — `CameraRig.update()` re-randomises it on every `render()`,
 *     and at `dt = 0` a "frozen" frame still moves the camera and re-culls
 *   · **rAF parked** — otherwise the game loop re-syncs under the measurement
 *   · **the same VFX population in both arms**, fired from the same seed
 *
 * ## The known-bad (`--selftest`)
 *
 * A counter that has not been shown to MOVE is not a counter. `--selftest` hides the
 * whole `vfx_layer` group and requires the count to FALL, then restores it and requires
 * the count to return EXACTLY. A tool reading the last post pass reads the same number
 * either way and goes red here.
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-fx1 -- \
 *     node tools/tmp/fx_draws.mjs --url '{URL}' --seats 2,3,6
 *
 * ⚠️ **N = 1 IS NOT CONSTRUCTIBLE** — `match.ts:fightersFromQuery` refuses fewer than 3
 * entries and falls back to the shipped two-fighter path, so `--seats 1` would silently
 * measure 2. The parser below rejects it rather than reporting a wrong label.
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const argv = process.argv;
const arg = (k, d) => { const i = argv.indexOf(k); return i > 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);
const BASE = (arg('--url', null) ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('fx_draws: --url or PREVIEW_BASE required'); process.exit(2); }
const SEATS = String(arg('--seats', '2,3,6')).split(',').map(Number);
const W = Number(arg('--w', 390));
const H = Number(arg('--h', 844));
const SEED = Number(arg('--seed', 777));
const SLICE = Number(arg('--slice', 160));
const LABEL = arg('--label', 'run');
const JSON_OUT = arg('--json', null);
const SELFTEST = flag('--selftest');
if (SEATS.some((n) => n !== 2 && n < 3)) {
  console.error('fx_draws: N=1 is not constructible — match.ts refuses a `fighters=` list under 3 and falls back to two seats.');
  process.exit(2);
}
const ROSTER = ['hamburger', 'donut', 'pizza', 'soup', 'egg', 'taco'];
const log = (...a) => console.log(...a);

async function boot(page) {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`,
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; let base = realNow();
    window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
    performance.now = () => (paused ? virt : realNow() - base);
    let st = 1;
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = { seed(v) { st = ((v >>> 0) || 1); } };
  });
}

async function measure(page, n) {
  return page.evaluate(async ([seats, seed, slice]) => {
    const rules = await import('/src/game/rules.ts');
    const stage = window.__stage;
    const renderer = stage.renderer ?? stage.composer?.renderer;
    if (!renderer || !renderer.info) return { err: 'no renderer.info reachable off __stage' };
    renderer.info.autoReset = false;
    const still = () => {
      const r = stage.rig; if (!r) return;
      r.shakeAmount = 0;
      if (r.shakeOffset && r.shakeOffset.set) r.shakeOffset.set(0, 0, 0);
    };
    const draws = () => { still(); renderer.info.reset(); stage.render(0); return renderer.info.render.calls; };

    const fi = window.__vfxDebugFighters;
    const slots = fi.slots ?? [fi.player, fi.enemy];
    window.__vfxLayer.clear();
    const idle = draws();

    // Same population in both arms, from the same seed: one impact burst + one live
    // projectile per seat, i.e. the busiest instant a real six-seat fight produces.
    window.__rng.seed(seed);
    const projectiles = [];
    let id = 1;
    for (let i = 0; i < slots.length; i++) {
      const cid = ['pizza', 'hamburger', 'soup', 'lollipop', 'egg', 'waterbottle'][i % 6];
      const c = rules.CHARACTERS[cid];
      const w = c.weapons.find((x) => x.type === 'ranged') ?? c.weapons[0];
      window.__vfxLayer.spawnImpactBurst(slots[i].x, slots[i].y, w.color, w.damage,
        { weapon: w, characterId: cid, fromXWU: slots[i].x - 60, fromYWU: slots[i].y });
      projectiles.push({
        id: id++, x: slots[i].x + 40, y: slots[i].y, vx: 1, vy: 0,
        color: w.color, damage: w.damage, weapon: w, ownerRole: i === 0 ? 'player' : 'enemy', arrived: false,
      });
    }
    const mk = (s, i) => ({
      characterId: 'hamburger', x: s.x, y: s.y, hp: 100, maxHp: 100, alive: true,
      facing: { x: 1, y: 0 }, terrainSlowFactor: 1, status: { slowedUntil: 0, stunnedUntil: 0 },
    });
    window.__vfxLayer.sync({
      elapsed: 1000, projectiles, splats: [], trailMarks: [],
      player: mk(slots[0]), enemy: mk(slots[1] ?? slots[0]),
    });
    window.__clk.advance(slice);
    window.__vfxLayer.updateEffects(slice / 1000);
    const busy = draws();

    // The known-bad: hide the layer, the count must FALL; restore, it must return EXACTLY.
    const root = stage.scene.children.find((o) => o.name === 'vfx_layer');
    let hidden = null; let back = null;
    if (root) { root.visible = false; hidden = draws(); root.visible = true; back = draws(); }
    window.__vfxLayer.clear();
    return { seats, idle, busy, hidden, back, liveSlots: slots.length, vfxChildren: root ? root.children.length : -1 };
  }, [n, SEED, SLICE]);
}

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let fail = 0;
  const rows = [];
  try {
    for (const n of SEATS) {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      await boot(page);
      const q = n === 2 ? '' : `&fighters=${ROSTER.slice(0, n).join(';')}`;
      await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0${q}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
      await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage && !!window.__vfxDebugFighters, null, { timeout: 120000 });
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.__clk.pause());
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      await page.waitForTimeout(200);
      const r = await measure(page, n);
      if (r.err) { console.log(`  🔴 N=${n}: ${r.err}`); fail++; await page.close(); continue; }
      // §SUBJECT: the seat count the page actually built, never the one asked for.
      if (r.liveSlots !== n) { console.log(`  🔴 N=${n}: page built ${r.liveSlots} seats — the label would have been wrong`); fail++; }
      log(`N=${String(r.liveSlots).padStart(2)}  idle ${String(r.idle).padStart(4)}  vfx-busy ${String(r.busy).padStart(4)}`
        + `  delta ${String(r.busy - r.idle).padStart(4)}  (layer hidden ${r.hidden}, restored ${r.back}, ${r.vfxChildren} children)`);
      if (SELFTEST || true) {
        if (r.hidden === null) { console.log('  🔴 vfx_layer group not found — the known-bad could not run'); fail++; }
        else {
          if (!(r.hidden < r.busy)) { console.log(`  🔴 known-bad: hiding vfx_layer did not LOWER the count (${r.hidden} vs ${r.busy}) — the counter is reading one post pass, not the frame`); fail++; }
          if (r.back !== r.busy) { console.log(`  🔴 known-bad RESTORE: ${r.back} != ${r.busy}`); fail++; }
        }
      }
      rows.push(r);
      await page.close();
    }
    if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify({ base: BASE, label: LABEL, viewport: [W, H], seed: SEED, slice: SLICE, rows }, null, 1));
  } finally { await browser.close(); }
  if (fail) { log(`\n🔴 fx_draws: ${fail} fault(s)`); process.exit(1); }
  log(`\n✅ fx_draws: no faults`);
}
const IS_MAIN = process.argv[1] && process.argv[1].endsWith('fx_draws.mjs');
if (IS_MAIN) await main();
