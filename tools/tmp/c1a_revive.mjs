#!/usr/bin/env node
/**
 * C1A_REVIVE — the POSE half of bug B4 (a Leftovers-revived fighter is drawn as a corpse),
 * routed from B1 to the characters owner (docs/REVAMP.md §5 B1: "pose half in rig.ts → C1").
 *
 * THE BUG: `BaseCharacter.play` (`src/characters/types.ts`) sets `deathT = 0` on 'death' and
 * nothing ever sets it back, so `applyBaseMotion` keeps drawing the topple (body roll 0.42π,
 * sunk 0.35) and every rig keeps `dead01 >= 1` for a fighter the sim has brought back.
 * `match.ts` calls `play('run'|'idle')` only for `roster[i]?.alive` fighters, so a revived
 * fighter receives `play('idle')` on its first live frame — the default branch is where the
 * reset belongs, and a corpse (never handed `play('run'|'idle')`) stays down.
 *
 * Revive needs a victim, its killer and the killer's killer, i.e. >= 3 seats; this runs at SIX
 * (AGENT-BRIEF §4b) with `?items=leftovers` on the local seat, killing through the sim's own
 * `combat.applyDamage` and feeding the events through `window.__feelEvent` (= GameSession's
 * handler), exactly as `b1_match.mjs` §R does.
 *
 * OBSERVABLE (what is DRAWN, not a field this test added): the world-space up-axis of the rig's
 * torso mesh (see POSE). Every character suppresses `applyBaseMotion` and drives the shared
 * `ChibiRig` with `dead01`, whose death branch lays the rig's own body joint down (~0.48π roll)
 * — so the base class's `body` group never moves and its roll reads 0 on a corpse (the first
 * draft of this test measured exactly that, and its MOVES row caught it).
 *
 * Rows (exit 0 iff all pass):
 *   NON-VACUITY  six seats; the local seat carries Leftovers; the kill lays it down (MOVES:
 *                up > 0.9 before, < 0.5 after — the measure can see a corpse); killing its
 *                killer revives it (alive + `item-revived`)
 *   BUG B4 pose  once the second corpse is down, +40 frames, the revived model stands: up > 0.9
 *                                                                             (RED on 58ef803)
 *   CORPSE       the seat killed second (no revive) still lies: up < 0.5 — the fix must not
 *                stand up the dead
 *   page errors  none
 *
 * Bots are slowed (`simSpeed=0.25`) so the live match cannot wander far in the test's few
 * seconds; every wait is on FRAMES or on the pose itself, bounded, never a long wall clock
 * (a 300 s timeout in the first draft let the 150 s match end under it).
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/c1a_revive.mjs --url '{URL}' --label base
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const A = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (!k.startsWith('--')) continue;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; }
}
const BASE = String(A.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE || /:5173(\/|$)/.test(BASE)) { console.error('c1a_revive: --url must be a SNAPSHOT (sx_snap), never :5173'); process.exit(2); }
const LABEL = String(A.label ?? 'run');
const OUT = String(A.out ?? `/tmp/c1a_revive_${LABEL}`);
mkdirSync(OUT, { recursive: true });
const ANGLE = String(A.angle ?? 'swiftshader');
const LAUNCH_ARGS = ANGLE === 'metal'
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const VITE_CLIENT_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
  + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
  + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
  + 'export const ErrorOverlay=class{};export default {};';

const rows = [];
function row(name, pass, detail) {
  rows.push({ name, pass: !!pass, detail });
  const d = detail === undefined ? '' : `  — ${JSON.stringify(detail)}`;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${d.length > 700 ? `${d.slice(0, 700)}…` : d}`);
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const wait = (page, fn, arg, ms = 600_000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });

/**
 * In-page: the drawn pose of the model in seat `slot` (scene order = slot order, match.ts) —
 * `up` is the world-space Y component of the rig's TORSO mesh's own up-axis (normalised): ~1
 * standing, ~0 laid on its side. Read off `torso_mesh` (rig.ts names it; built when the body
 * has a torso) else `pelvis_mesh`. Height is reported too, but it is NOT the observable: a
 * hamburger lying on its side is as wide (2.65 m, arms + spatula) as it was tall (2.54 m) —
 * the second draft of this test measured that and its MOVES row refused it.
 */
const POSE = (slot) => {
  const st = window.__stage;
  const roots = st.scene.children.filter((o) => /^character:/.test(o.name || ''));
  const root = roots[slot];
  if (!root) return { error: `no root for slot ${slot} (${roots.length} roots)` };
  root.updateMatrixWorld(true);
  let torso = null;
  for (const name of ['torso_mesh', 'pelvis_mesh']) { root.traverse((o) => { if (!torso && o.isMesh && o.name === name) torso = o; }); if (torso) break; }
  if (!torso) return { name: root.name, error: 'no torso_mesh / pelvis_mesh' };
  const e = torso.matrixWorld.elements;
  const up = e[5] / Math.hypot(e[4], e[5], e[6]);
  let lo = Infinity, hi = -Infinity;
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox; const m = o.matrixWorld.elements;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const wy = m[1] * x + m[5] * y + m[9] * z + m[13]; if (wy < lo) lo = wy; if (wy > hi) hi = wy;
    }
  });
  return { name: root.name, via: torso.name, up: +up.toFixed(4), height: +(hi - lo).toFixed(3) };
};

try {
  // warm the fresh snapshot (the first client eats Vite's dep-optimisation reload)
  { const p = await browser.newPage(); await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: VITE_CLIENT_STUB })); await p.goto(`${BASE}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 180_000 }).catch(() => {}); await p.waitForTimeout(4000); await p.close(); }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: VITE_CLIENT_STUB }));
  await page.goto(`${BASE}/?screen=match&pointerLock=0&seats=6&player=hamburger&enemy=donut&items=leftovers&simSpeed=0.25`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await wait(page, () => window.__gameReady === true, null, 300_000);
  await wait(page, () => window.__matchDebug?.phase === 'playing', null, 300_000);
  // b1_match.mjs's hook: the live MatchState through VfxLayer.prototype.sync (calls straight through)
  await page.evaluate(async () => {
    const vfx = await import('/src/game/vfx.ts');
    const v = vfx.VfxLayer.prototype;
    if (!v.sync.__c1a) { const orig = v.sync; const f = function (...a) { window.__c1aState = a[0]; return orig.apply(this, a); }; f.__c1a = true; v.sync = f; }
  });
  await wait(page, () => !!window.__c1aState && Array.isArray(window.__c1aState.fighters), null, 120_000);
  const framesWait = async (n) => {
    const f0 = await page.evaluate(() => window.__feelDebug.frames);
    await wait(page, (a) => window.__feelDebug.frames - a.f0 >= a.n, { f0, n }, 120_000);
  };
  const kill = (victim, killer) => page.evaluate(async ({ victim, killer }) => {
    const combat = await import('/src/game/combat.ts');
    const rules = await import('/src/game/rules.ts');
    const st = window.__c1aState;
    const w = rules.CHARACTERS[st.fighters[killer].characterId].weapons[0];
    const evs = [];
    combat.applyDamage(st, st.fighters[victim], 9999, null, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: killer }, evs);
    for (const ev of evs) window.__feelEvent(ev);
    return { types: evs.map((e) => e.type), alive: st.fighters.map((f) => f.alive), phase: window.__matchDebug?.phase };
  }, { victim, killer });

  const seats = await page.evaluate(() => window.__c1aState.fighters.length);
  const loadout = await page.evaluate(() => window.__c1aState.fighters[0].item?.equipped ?? null);
  const upright = await page.evaluate(POSE, 0);
  const upright1 = await page.evaluate(POSE, 1);
  row('NON-VACUITY: six seats, the local seat carries Leftovers', seats === 6 && JSON.stringify(loadout).includes('leftovers'), { seats, loadout, upright, upright1 });

  const k1 = await kill(0, 1);
  const laid = await page.waitForFunction((src) => (0, eval)(src)(0).up < 0.5, POSE.toString(), { timeout: 60_000, polling: 100 }).then(() => true).catch(() => false);
  await framesWait(10);
  const toppled = await page.evaluate(POSE, 0);
  row('NON-VACUITY (MOVES): the kill lays the local model down — the measure can see a corpse',
    k1.types.includes('death') && laid && upright.up > 0.9 && toppled.up < 0.5, { k1, laid, upright, toppled });
  await page.screenshot({ path: `${OUT}/c1a_revive_${LABEL}_dead.png` });

  const k2 = await kill(1, 2);
  const revived = k2.alive[0] === true && k2.types.includes('item-revived');
  row('NON-VACUITY: killing the killer revives the local seat (alive + item-revived)', revived, k2);
  // The second death's topple runs on animation time (0.75 s at simSpeed 0.25 = ~3 s real):
  // wait on the corpse's own pose (bounded), then 40 more frames, then read both seats.
  const corpseDown = await page.waitForFunction((src) => (0, eval)(src)(1).up < 0.5, POSE.toString(), { timeout: 60_000, polling: 100 }).then(() => true).catch(() => false);
  await framesWait(40);
  const after = await page.evaluate(POSE, 0);
  const corpse = await page.evaluate(POSE, 1);
  const alive = await page.evaluate(() => window.__c1aState.fighters.map((f) => f.alive));
  await page.screenshot({ path: `${OUT}/c1a_revive_${LABEL}_revived.png` });
  row('BUG B4 (pose): the revived model is drawn standing (torso up > 0.9)',
    revived && alive[0] === true && after.up > 0.9, { upright, after, alive });
  row('CORPSE: the seat killed second (no revive) is still drawn lying down (torso up < 0.5)',
    alive[1] === false && corpseDown && upright1.up > 0.9 && corpse.up < 0.5, { upright1, corpse, corpseDown, alive });
  row('page errors', errors.length === 0, errors);
  await ctx.close();
} catch (e) {
  row('run completed', false, String(e).split('\n')[0]);
} finally {
  writeFileSync(`${OUT}/c1a_revive_${LABEL}.json`, JSON.stringify({ base: BASE, label: LABEL, rows }, null, 1));
  await browser.close();
}
const failed = rows.filter((r) => !r.pass);
console.log(`\n${rows.length - failed.length} passed, ${failed.length} failed (${LABEL})`);
process.exit(failed.length === 0 ? 0 : 1);
