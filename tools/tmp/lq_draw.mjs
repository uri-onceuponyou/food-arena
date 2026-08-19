#!/usr/bin/env node
/**
 * lq_draw — WHAT DID THE SOUP LIQUID COST IN DRAW CALLS? An exact, per-frame census.
 *
 * ## Why this exists
 *
 * `c9a2ed0` gave soup's bowl real solids (noodles, scallion, carrot) and its own commit
 * comment states the cost as a DERIVATION, not a measurement:
 *
 *   > *"+20 meshes per soup fighter, i.e. +20 draw calls, derived from `lk1_area`'s own
 *   > `matched` counts rather than by counting the source … Draw counts are an EXACT
 *   > metric (CLAUDE.md rule 10) and this one has NOT been measured against a frame
 *   > budget — `tools/perf.mjs` was not run."*
 *
 * Three things in that sentence are assumptions rather than facts, and they do not all
 * point the same way:
 *
 *   1. **"+20 meshes ⇒ +20 draw calls" ignores OUTLINE HULLS.** `render/toon.ts` gives a
 *      mesh a second, back-faced hull unless its name carries `__no_outline`. A solid that
 *      gets one costs **two** draws, not one. → up.
 *   2. **It ignores the SHADOW MAP pass.** A caster is drawn again into the depth map.
 *      `stage.ts` measured that pass at **302 of 692 draws — 43.6% of a whole frame**. → up.
 *   3. **It ignores FRUSTUM CULLING.** A fighter off-camera costs nothing at all, and at six
 *      seats most of the roster is off-camera most of the time. → down, and this one is
 *      large enough to swallow the other two (measured below).
 *
 * `tools/perf.mjs` is the right instrument for a whole frame, but its scene table is fixed
 * (`hamburger` vs `donut`), has no soup in it and no six-seat form, and it is not this
 * agent's file to extend. This tool asks the narrower question exactly.
 *
 * ## How it gets an EXACT number
 *
 * `renderer.info.render.calls` is the renderer's own counter. Three resets it at the top of
 * every `WebGLRenderer.render()`, and `Stage.render()` drives a post chain that calls
 * `render()` several times — so read naively it reports the LAST pass, not the frame.
 * `autoReset = false` plus one explicit `info.reset()` immediately before `stage.render(0)`
 * makes the number the whole frame: scene + shadow map + every post pass. (`stage.ts:784`
 * documents the same technique for the same reason.)
 *
 * Four things had to be pinned before the number stopped lying, and each was caught by the
 * measurement contradicting itself rather than by review:
 *
 *   * **A FROZEN CLOCK.** Without it the two arms sampled different moments of the match —
 *     the countdown had expired in one and the AI was firing. Read 263 vs 411..417.
 *   * **A ZEROED SHAKE.** `CameraRig.update()` re-randomises shake on every `render()`
 *     (`AGENT-BRIEF` §3) and a moved camera CULLS DIFFERENTLY.
 *   * **A FORCED SHADOW PASS.** `shadowMap.autoUpdate` is false and `scheduleShadowUpdate`
 *     fires on a scene fingerprint — so *hiding meshes for an ablation changes the
 *     fingerprint and buys a shadow re-render*, which ADDED 152 draws and made the ablated
 *     arm read HIGHER than the live one. Both arms now force it, every frame.
 *   * **FIGHTERS ACTUALLY IN FRAME.** With the shipped ring spawns, seats=1 and seats=6
 *     returned byte-identical `calls` AND `triangles` — five fighters outside the frustum
 *     cost exactly nothing. `--pack` puts them in one visible cluster so the worst case can
 *     be priced; `--spread` keeps the shipped spawns so the typical case can be too.
 *
 * ## The known-bad input (`--selftest`)
 *
 * A draw-call counter that measured nothing would return the same number for every arm, and
 * a null A/B result reads exactly like "the change was free" — the most dangerous outcome
 * here, because a null result is a normal one. So the selftest ABLATES: it hides every
 * `soup_broth_top` group and requires the count to **drop**. It also requires the soup
 * census to be **NON-EMPTY** before asserting over it — `[].every()` is `true`, and that
 * vacuity has fired three times in this repo in one session (`CLAUDE.md` rule 6).
 *
 * ## Usage
 *
 *   node tools/tmp/lq_draw.mjs --url <base> [--seats 1,6] [--pack|--spread] [--json out]
 *   node tools/tmp/lq_draw.mjs --url <base> --selftest
 *
 * `--url` may be omitted inside a `with_snapshot`/`sx_snap` child (`PREVIEW_BASE`).
 * ⚠️ Measure a DETACHED WORKTREE, never the working tree: `snapshot.mjs` freezes whatever
 * is on disk, peers' half-saved edits included (`CLAUDE.md` rule 2).
 */

import { chromium } from 'playwright';
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const argv = process.argv;
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const flag = (k) => argv.includes(k);

const BASE = (arg('--url', null) ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) {
  console.error('lq_draw: no --url and no PREVIEW_BASE. Refusing to guess an origin — :5173 is\n'
    + 'the shared dev server and measuring on it is banned (CLAUDE.md rule 2).');
  process.exit(2);
}
const SAMPLES = Number(arg('--samples', 4));
const FRAMES = Number(arg('--frames', 60));      // virtual frames advanced before sampling
const JSON_OUT = arg('--json', null);
const SELFTEST = flag('--selftest');
const PACK = !flag('--spread');
/**
 * `--mobile` is the tier Uri actually plays, and getting it wrong is a documented trap.
 *
 * `perf.mjs` records that `--device mobile` measured the WRONG TIER for its whole life:
 * `detectTier()` (`render/quality.ts`) gates on `matchMedia('(pointer: coarse)')` **and**
 * `navigator.maxTouchPoints > 0` **and** a screen short edge ≤ 500 px, and without
 * `hasTouch`/`isMobile` Chromium reports a fine pointer and zero touch points — so every
 * run labelled "mobile" resolved `high`, the one tier a phone never gets. Both options are
 * needed and they do different jobs: `hasTouch` moves the pointer/touch gates, `isMobile`
 * makes `window.screen` phone-sized.
 *
 * PORTRAIT, not landscape: `DECISIONS §74` — both of Uri's captures are 384×848, and
 * *"portrait is evidently how he actually plays"*.
 * The resolved tier is read back out of the page and printed, so this is not assumed.
 */
const MOBILE = flag('--mobile');
const W = Number(arg('--w', MOBILE ? 390 : 1300));
const H = Number(arg('--h', MOBILE ? 844 : 740));

// ── Arena geometry is DERIVED from `src/arena/shared.ts`, never retyped ──────────────
// `CLAUDE.md`: "Dozens of files hold a hardcoded 2800/1985, so today's correct literals are
// the next generation's stale ones. Derive from `shared.ts`. Never retype a coordinate."
// A stale literal here would still be a LEGAL coordinate (the 1× playfield is exactly the
// NW quadrant of the ×4 one), so nothing downstream could catch it — `al_guard.mjs` exists
// because that class is invisible to every legality check.
const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = await readFile(resolve(HERE, '../../src/arena/shared.ts'), 'utf8');
const constOf = (name) => {
  const m = SHARED.match(new RegExp(`export const ${name}\\s*=\\s*(-?[0-9.]+)`));
  if (!m) throw new Error(`lq_draw: could not read ${name} from src/arena/shared.ts`);
  return Number(m[1]);
};
const ARENA_W = constOf('ARENA_W');
const ARENA_H = constOf('ARENA_H');
const CX = ARENA_W / 2;
const CY = ARENA_H / 2;

/**
 * Six soup fighters.
 *
 * `--spread` (shipped-like): no explicit spawns at all, so `sim.ts:defaultSpawn` resolves
 * slots 2+ from the arena's six declared points. This tool carries NO placement policy of
 * its own — `match.ts:fightersFromQuery` is deliberately a transport for coordinates the
 * probe chose, because spawn layout is a competitive-fairness question (§48).
 *
 * `--pack` (default, worst case): one visible cluster. The match camera shows halfWidth
 * 289.4 wu at 16:9 (`arena-scan`'s own measurement against `window.__fairView()`), so a
 * ring of radius 110 wu about the arena centre is comfortably inside one frame. This is a
 * MEASUREMENT FIXTURE, not a spawn proposal.
 */
const RING_R = 110;
const rosterPacked = (n) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return `soup@${Math.round(CX + Math.cos(a) * RING_R)},${Math.round(CY + Math.sin(a) * RING_R)}`;
}).join(';');
const rosterSpread = (n) => Array.from({ length: n }, () => 'soup').join(';');
const roster = (n) => (PACK ? rosterPacked(n) : rosterSpread(n));

// ⚠️ `seats` here counts SOUP FIGHTERS, not seats in the match. At `--seats 1` the match
// still has two fighters; the opponent is a `donut`, so exactly one soup rig is in the
// scene and `soupBowls` in the output proves it rather than asserting it.
// Two and below take the LEGACY path: `fightersFromQuery` refuses fewer than 3 on purpose
// ("at two seats the legacy form is the measured-identical path").
const urlFor = (seats) => (seats <= 2
  ? `${BASE}/?player=soup&enemy=${seats === 1 ? 'donut' : 'soup'}&px=${CX}&py=${CY}&fogRadius=900&pointerLock=0`
  : `${BASE}/?fighters=${encodeURIComponent(roster(seats))}&fogRadius=900&pointerLock=0`);

/** Read one whole frame's draw calls. Runs page-side. */
const SAMPLE = ({ hideLiquid }) => {
  const stage = window.__stage;
  if (!stage) return { error: 'no __stage' };
  const rig = stage.rig;
  if (rig) { rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply(); }

  // Census FIRST, and the caller asserts it non-empty before concluding anything from it.
  // A filtered set that came back empty would make every later `every()` vacuous.
  const liquidGroups = [];
  const soupBowls = [];
  stage.scene.traverse((o) => {
    if (o.name === 'soup_broth_top') liquidGroups.push(o);
    if (o.name === 'soup_bowl') soupBowls.push(o);
  });

  let meshes = 0;
  stage.scene.traverse((o) => { if (o.isMesh) meshes++; });
  const liquidMeshes = liquidGroups.map((g) => { let n = 0; g.traverse((o) => { if (o.isMesh) n++; }); return n; });

  if (hideLiquid) for (const g of liquidGroups) g.visible = false;

  const info = stage.renderer.info;
  info.autoReset = false;

  // Arm 1: the shadow map is left alone (shipped steady state — `shadowMap.autoUpdate` is
  // false and `scheduleShadowUpdate` only fires when the scene fingerprint moves).
  info.reset();
  stage.render(0);
  const noShadowPass = { calls: info.render.calls, triangles: info.render.triangles };

  // Arm 2: the shadow map is FORCED. In a live match the fighters move every frame, so this
  // is the realistic frame, and it is also the only way an ablation is comparable at all —
  // hiding meshes changes the fingerprint and buys a shadow re-render by itself.
  stage.renderer.shadowMap.needsUpdate = true;
  info.reset();
  stage.render(0);
  const withShadowPass = { calls: info.render.calls, triangles: info.render.triangles };

  if (hideLiquid) for (const g of liquidGroups) g.visible = true;
  return {
    noShadowPass,
    withShadowPass,
    sceneMeshes: meshes,
    liquidGroups: liquidGroups.length,
    liquidMeshes,
    soupBowls: soupBowls.length,
    // Read back rather than assumed — see the `--mobile` note above.
    tier: stage.profile?.tier ?? null,   // `private profile: TierProfile` — TS-private only
    shadowsOn: !!stage.shadowsOn,
    pixelRatio: stage.renderer.getPixelRatio(),
  };
};

async function measure(browser, seats, { hideLiquid = false } = {}) {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: MOBILE ? 2 : 1,
    hasTouch: MOBILE,
    isMobile: MOBILE,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Frozen clock + seeded `Math.random`, the same construction as `np_nfighter.mjs` /
  // `np_identity.mjs`: every millisecond the match sees is one this file handed it, so both
  // arms see the identical one. See the header for what this was fixing.
  await page.addInitScript(() => {
    let virt = 0;
    performance.now = () => virt;
    window.__lqclk = { advance(ms) { virt += ms; } };
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  // Vite's HMR client is stubbed: a reload mid-measurement silently restarts the match.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,'
      + 'prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;'
      + 'export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await page.goto(urlFor(seats), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
  // Advance the virtual clock so the camera rig converges on the player — with `dt` pinned
  // at 0 the damped follow never moves and the frame would be framed on nothing. 60 frames
  // is 1.0 s, still inside the countdown, so no projectile or impact VFX exists yet and the
  // number describes the RIGS, which is what `c9a2ed0` changed.
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i++) {
      window.__lqclk.advance(16.667);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
  }, FRAMES);

  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    // eslint-disable-next-line no-await-in-loop
    samples.push(await page.evaluate(SAMPLE, { hideLiquid }));
  }
  await page.close();
  const pick = (k) => samples.map((s) => s[k].calls);
  const spread = (a) => ({ min: Math.min(...a), max: Math.max(...a), stable: Math.min(...a) === Math.max(...a) });
  return {
    seats,
    hideLiquid,
    shipped: spread(pick('noShadowPass')),
    forced: spread(pick('withShadowPass')),
    last: samples[samples.length - 1],
    errors,
  };
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});

/**
 * ⚠️ THE FIRST CLIENT OF A FRESH SNAPSHOT IS NOT COMPARABLE TO THE SECOND — Vite optimises
 * dependencies on the first request and reloads the page under you (`AGENT-BRIEF` §3). This
 * warm-up absorbs it so every measured arm is a steady-state one.
 */
async function warm() {
  const p = await browser.newPage({ viewport: { width: 400, height: 300 } });
  try {
    await p.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle', timeout: 120000 });
    await p.waitForTimeout(1500);
  } finally { await p.close(); }
}

try {
  await warm();
  if (SELFTEST) {
    let fails = 0;
    const ok = (name, cond, detail = '') => {
      if (cond) console.log(`  ok   - ${name}`);
      else { fails++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
    };
    const live6 = await measure(browser, 6);
    const abl6 = await measure(browser, 6, { hideLiquid: true });
    const live1 = await measure(browser, 1);

    // §A — the set the later assertions run over is NOT EMPTY.
    ok('A1 the scene contains at least one soup liquid group',
      live6.last.liquidGroups > 0, `liquidGroups=${live6.last.liquidGroups}`);
    ok('A2 six seats really produced six soup bowls',
      live6.last.soupBowls === 6, `soupBowls=${live6.last.soupBowls}`);
    ok('A3 every liquid group holds at least one mesh',
      live6.last.liquidMeshes.length > 0 && live6.last.liquidMeshes.every((n) => n > 0),
      JSON.stringify(live6.last.liquidMeshes));

    // §B — the counter MOVES when the thing it counts is removed.
    ok('B1 hiding the liquid groups LOWERS the forced-shadow draw count',
      abl6.forced.min < live6.forced.min, `live=${live6.forced.min} ablated=${abl6.forced.min}`);
    ok('B2 the drop is at least one draw per hidden group',
      live6.forced.min - abl6.forced.min >= live6.last.liquidGroups,
      `drop=${live6.forced.min - abl6.forced.min} groups=${live6.last.liquidGroups}`);

    // §C — the counter HOLDS across repeated frames of the same scene, or nothing read off
    //      it is exact and every delta below is noise.
    ok('C1 the live arm is frame-stable', live6.forced.stable && live6.shipped.stable,
      `forced ${live6.forced.min}..${live6.forced.max} shipped ${live6.shipped.min}..${live6.shipped.max}`);
    ok('C2 the ablated arm is frame-stable', abl6.forced.stable, `${abl6.forced.min}..${abl6.forced.max}`);

    // §D — the counter can TELL SIX FIGHTERS FROM ONE. This is the arm that caught the
    //      frustum-culling problem: with the shipped ring spawns it read byte-identical
    //      `calls` AND `triangles` at 1 and 6 seats, which is what a probe pointed at
    //      nothing looks like.
    ok('D1 six seats draw more than one seat',
      live6.forced.min > live1.forced.min, `1=${live1.forced.min} 6=${live6.forced.min}`);

    // §E — the count is a whole frame, not one post pass.
    ok('E1 the count is a whole frame', live6.forced.min > 100, `calls=${live6.forced.min}`);
    ok('E2 forcing the shadow pass costs draws', live6.forced.min > live6.shipped.min,
      `shipped=${live6.shipped.min} forced=${live6.forced.min}`);
    ok('E3 no page errors', live6.errors.length === 0, live6.errors.join('\n'));

    console.log(`\n  6 seats: shipped ${live6.shipped.min} · forced-shadow ${live6.forced.min}`);
    console.log(`  6 seats, liquid hidden: forced-shadow ${abl6.forced.min}  (drop ${live6.forced.min - abl6.forced.min})`);
    console.log(`  1 seat:  shipped ${live1.shipped.min} · forced-shadow ${live1.forced.min}`);
    console.log(fails === 0 ? '\nlq_draw --selftest: PASS' : `\nlq_draw --selftest: ${fails} FAIL`);
    process.exitCode = fails === 0 ? 0 : 1;
  } else {
    const seatsArg = arg('--seats', '1,6').split(',').map(Number);
    const out = [];
    for (const s of seatsArg) {
      // eslint-disable-next-line no-await-in-loop
      const r = await measure(browser, s);
      out.push(r);
      const l = r.last;
      console.log(`seats=${s} ${PACK ? 'packed' : 'spread'}${MOBILE ? ` mobile[tier=${l.tier} dpr=${l.pixelRatio} shadows=${l.shadowsOn}]` : ''}  calls shipped ${r.shipped.min}${r.shipped.stable ? '' : `..${r.shipped.max} UNSTABLE`}`
        + `  forced-shadow ${r.forced.min}${r.forced.stable ? '' : `..${r.forced.max} UNSTABLE`}`
        + `  tris ${l.withShadowPass.triangles}  sceneMeshes ${l.sceneMeshes}  soupBowls ${l.soupBowls}`
        + `  liquidMeshes ${JSON.stringify(l.liquidMeshes)}`);
      if (r.errors.length) console.log(`  page errors: ${r.errors.join(' | ')}`);
    }
    if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify({ base: BASE, packed: PACK, out }, null, 2));
  }
} finally {
  await browser.close();
}
