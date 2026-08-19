#!/usr/bin/env node
/**
 * WI_GUARD — the impact beat's anchor, guarded. Three assertions, each with a
 * known-bad that makes it go RED.
 *
 * ── WHAT IT GUARDS ──────────────────────────────────────────────────────────────
 *
 * `209e270` measured all 33 weapons x 3 beats x {shipped, generic control} and found
 * sixteen weapons short — **every one of them on the IMPACT beat**, because a bespoke
 * `impact()` hook took the branch in `vfx.ts:spawnImpactBurst` and RETURNED, leaving
 * nothing underneath it. `burrito.Swarm` delivered 139 px against its own generic
 * control's 1367. `vfx.ts:impactAnchor` fixes it the way `castMuzzle` fixed the same
 * bug on the cast beat: the shared beat is unconditional, spawned UNDER the bespoke
 * hook, subordinate by SIZE.
 *
 *   A. FLOOR      every weapon carrying a bespoke `impact()` must deliver >= 300 px.
 *                 That bar is `vfx.ts:castMuzzle`'s and is derived there — 282 px is
 *                 *"inside measurement noise of the floor"*, 18 px is *"a cast the
 *                 player cannot see fire"*. This is the assertion Uri's question is
 *                 actually about.
 *   B. ANCHOR     with the bespoke hook replaced by one that DRAWS NOTHING, the frame
 *                 must still change by >= 0.25 of what the generic burst delivers for
 *                 that same weapon. This is the one that catches a REGRESSION of the
 *                 early return: A can be satisfied by a fat sculpt, B cannot be
 *                 satisfied by anything except the anchor actually running.
 *                 0.25 is not a guess: `tools/tmp/wi_derive.mjs` measured the anchor at
 *                 0.323-0.423 of the generic burst at pitch 58 and 0.352-0.501 at
 *                 pitch 20, over all sixteen short rows.
 *   C. SUBORDINATE the same ratio must stay <= 0.55. `impactAnchor`'s derivation is
 *                 two-sided — the anchor is bounded BELOW by the 300 px floor and
 *                 ABOVE by "subordinate has to mean minority", and k = 0.60 already
 *                 puts 10 of 16 rows over half. Without C, the cheapest way to make A
 *                 and B green forever is to raise `IMPACT_ANCHOR_K` until the anchor
 *                 IS the hit, which is the defect the bespoke system exists to avoid.
 *
 * ── THE KNOWN-BAD (CLAUDE.md #6: a guard not shown to FAIL is not a guard) ───────
 *
 * Two independent ones, because they fail for different reasons:
 *
 *   `--knownbad`  re-installs the two ORIGINAL defects IN-PAGE, on the fixed tree:
 *                   · `impactAnchor` returns early for `role === 'subordinate'`
 *                     — literally the pre-fix `return` after the bespoke branch
 *                   · `spawnImpactBurst` has `fromXWU`/`fromYWU` stripped off its
 *                     `source` argument — literally the pre-fix `__vfxSpawnTest`
 *                 A, B and D must go RED. Self-contained: no second checkout needed,
 *                 so the guard can demonstrate itself anywhere.
 *
 *   `--knownbad loud`  the OTHER direction, because arms have to be shown to fail
 *                 SEPARATELY. The bug above cannot make C red — C guards the upper
 *                 bound, and an arm with no known-bad of its own is a comment with a
 *                 tick next to it. This mode scales the subordinate anchor's arguments
 *                 by 1.5, i.e. it reproduces `IMPACT_ANCHOR_K = 0.75` — the exact
 *                 mistake `impactAnchor`'s header exists to prevent, which is copying
 *                 `castMuzzle`'s factor across. **C must go RED and A/B must stay
 *                 GREEN**, which is also the check that C is not just a restatement
 *                 of B.
 *
 *   a pre-fix WORKTREE, which is the real thing rather than a reproduction:
 *     git worktree add --detach /tmp/fa-wi <sha-before>
 *     ln -s "$PWD/node_modules" /tmp/fa-wi/node_modules   # omit either symlink and
 *     ln -s "$PWD/reference"    /tmp/fa-wi/reference      # gates die on a missing
 *                                                        # import, looking exactly broken
 *     node tools/tmp/sx_snap.mjs --root /tmp/fa-wi -- node tools/tmp/wi_guard.mjs --url '{URL}'
 *
 * ── D. THE QA HOOK'S DIRECTION ──────────────────────────────────────────────────
 *
 * `window.__vfxSpawnTest('impact', ...)` used to pass `{ weapon, characterId }` and
 * nothing else, so a bespoke hook received `ctx.direction === (0,0,0)` — a state
 * `match.ts` never produces for a weapon hit, and the state `vfx_wcov`, `vfx_ablate`,
 * `vfx_hue` and `vfx_coverage` all measured. Guarded by planting a recorder hook and
 * reading the vector back. Cheap: one fire, no pixels.
 *
 * ── CONTROLS ────────────────────────────────────────────────────────────────────
 *
 *   NULL         frozen frame vs itself                 -> 0 px, not "small"
 *   FORCED       a garish oversized generic impact       -> >> 0, or the counter is blind
 *   REACH        the planted no-op hook must be CALLED   -> otherwise arm B measures the
 *                REAL sculpt and passes for the wrong reason
 *   RESTORE      hook set read back after every case
 *   NON-VACUITY  every filtered set is checked NON-EMPTY before anything is asserted
 *                over it — `[].every()` returns true, and that vacuity has fired at
 *                least seven times in this repo, always because a fix emptied the set.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean -- node tools/tmp/wi_guard.mjs --url '{URL}'
 *   ... --pitch 20        the lobby-analogue detector (CLAUDE.md #3 — verify at BOTH)
 *   ... --knownbad        must exit 1
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('wi_guard: --url or PREVIEW_BASE required (never the shared dev server)'); process.exit(2); }
const OUT = String(args.out ?? 'shots/wi');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
const DELTA = Number(args.delta ?? 6);
const PITCH = Number(args.pitch ?? 58);
const DETECT_WIDTH = Number(args.detectWidth ?? 150);
const KNOWNBAD = !!args.knownbad;
/** `--knownbad` -> 'missing' (the shipped bug); `--knownbad loud` -> the opposite one. */
const KB_KIND = typeof args.knownbad === 'string' ? args.knownbad : 'missing';
const SEED = Number(args.seed ?? 777);
const ONLY = args.only ? String(args.only).split(',') : null;
/**
 * `wv_area`'s schedule minus its last slice. Not a corner cut — measured: across all
 * 66 impact rows of `209e270`/`dce15bb`, at BOTH pitches, **zero** peaked at 620 ms
 * (58: 13@260 10@160 5@400 4@80 1@16; 20: 14@260 7@160 7@400 4@80 1@16). Dropping a
 * slice that never carried a peak buys 17% of a run that fires three arms per weapon.
 */
const SLICES = (args.slices ? String(args.slices).split(',').map(Number) : [16, 80, 160, 260, 400]);
/** `vfx.ts:castMuzzle`'s floor, derived there. Not invented here. */
const FLOOR_PX = Number(args.floor ?? 300);
/** Measured band for anchor/generic — `wi_derive.mjs`: 0.323-0.423 at pitch 58,
 * 0.352-0.501 at pitch 20. The bars sit outside both, on either side. */
const ANCHOR_MIN_RATIO = Number(args.anchorMin ?? 0.25);
const ANCHOR_MAX_RATIO = Number(args.anchorMax ?? 0.55);

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'wi-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
    + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

async function boot(page) {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; let base = realNow();
    window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
    performance.now = () => (paused ? virt : realNow() - base);
    // Seeded LCG: these bursts randomise shard directions, so unchanged code measured
    // twice disagrees by ~15% (`wv_area.mjs`'s header). Every arm of a row is fired on
    // the same seed, which makes anchor/generic a PAIRED ratio (CLAUDE.md #10).
    let st = 1;
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = {
      seed(v) { st = ((v >>> 0) || 1); },
      selftest() {
        window.__rng.seed(7); const a = [Math.random(), Math.random(), Math.random()];
        window.__rng.seed(7); const b = [Math.random(), Math.random(), Math.random()];
        return a.every((v, i) => v === b[i]) && a[0] !== a[1];
      },
    };
  });
}

/* eslint-disable */
async function installHarness(page, rw, rh, delta) {
  await page.evaluate(([RWv, RHv, D]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = RWv; cv.height = RHv;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    let base = null;
    // A frozen clock does not still the camera shake, it makes it PERMANENT
    // (`docs/AGENT-BRIEF.md` §3). Zeroed before every grab, not once at setup.
    const still = () => {
      const r = stage.rig; if (!r) return;
      r.shakeAmount = 0;
      if (r.shakeOffset && r.shakeOffset.set) r.shakeOffset.set(0, 0, 0);
    };
    const grab = () => {
      still(); stage.render(0);
      c2.clearRect(0, 0, RWv, RHv); c2.drawImage(stage.canvas, 0, 0, RWv, RHv);
      return c2.getImageData(0, 0, RWv, RHv).data;
    };
    window.__wi = {
      total: RWv * RHv,
      setBase() { base = grab(); },
      count() {
        const cur = grab(); let n = 0;
        for (let i = 0; i < cur.length; i += 4) {
          const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
          if (d >= D) n++;
        }
        return n;
      },
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      reset() { window.__vfxLayer.clear(); },
      setPitch(deg, widthUnits) {
        const rig = stage.rig; if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return saved;
      },
    };
  }, [rw, rh, delta]);
}
/* eslint-enable */

/**
 * ── THE KNOWN-BAD, INSTALLED IN-PAGE ────────────────────────────────────────────
 *
 * Both defects, exactly as they were written, on the FIXED tree — so `--knownbad` is a
 * demonstration that these assertions can fail, not a second implementation of them.
 *
 *   1. `impactAnchor` returns before drawing anything when it is subordinate. That is
 *      the pre-fix control flow verbatim: the bespoke branch ran and returned, and no
 *      anchor was ever reached. Arms B and C go red.
 *   2. `spawnImpactBurst` has `fromXWU`/`fromYWU` deleted off its `source` argument
 *      before the real method sees them. That is the pre-fix `__vfxSpawnTest` verbatim:
 *      `ctx.direction` comes out (0,0,0). Arm D goes red.
 */
async function installKnownBad(page, kind) {
  return page.evaluate((k) => {
    const proto = Object.getPrototypeOf(window.__vfxLayer);
    if (typeof proto.impactAnchor !== 'function') {
      return { ok: false, why: 'impactAnchor is not on the prototype — nothing to regress' };
    }
    const realAnchor = proto.impactAnchor;

    if (k === 'loud') {
      // `IMPACT_ANCHOR_K = 0.75` reproduced from outside: scale the two arguments the
      // anchor scales by 0.75/0.50 = 1.5, and ONLY while a subordinate anchor is being
      // drawn, so the primary path and the bespoke sculpt are untouched.
      // ⚠️ Not exact at the bottom of the shard range — a 2-shard chip comes out at 3
      // here and at 2 on a real k=0.75 tree, because `Math.max(2, ...)` is applied
      // twice. Stated rather than hidden: it makes this known-bad marginally LOUDER
      // than the tree it imitates, never quieter, so a green C here would still be a
      // real failure of C.
      proto.impactAnchor = function (origin, color, amount, role) {
        if (role !== 'subordinate') return realAnchor.call(this, origin, color, amount, role);
        const realBurst = proto.burst;
        proto.burst = function (o, c, sf, sc, opts) {
          return realBurst.call(this, o, c, sf * 1.5, Math.max(2, Math.round(sc * 1.5)), opts);
        };
        try { return realAnchor.call(this, origin, color, amount, role); }
        finally { proto.burst = realBurst; }
      };
      return { ok: true, kind: k };
    }

    proto.impactAnchor = function (origin, color, amount, role) {
      if (role === 'subordinate') return;          // ← the pre-fix early return
      return realAnchor.call(this, origin, color, amount, role);
    };
    const realImpact = proto.spawnImpactBurst;
    proto.spawnImpactBurst = function (x, y, color, amount, source) {
      const stripped = source ? { weapon: source.weapon, characterId: source.characterId } : source;
      return realImpact.call(this, x, y, color, amount, stripped);
    };
    return { ok: true, kind: k };
  }, kind);
}

/**
 * ONE ROW: three arms of the same weapon on the same seed.
 *
 *   shipped  registry untouched                       -> the composite that ships
 *   anchor   `impact()` replaced by a hook that draws NOTHING, but IS CALLED
 *            -> whatever is left underneath it
 *   generic  `impact()` deleted off the registry object -> the shipped fallback,
 *            provoked rather than re-implemented (`wv_area.mjs`'s ablation)
 *
 * The hook set is read back after every arm and returned, so each row carries its own
 * proof that the ablation did not leak.
 */
async function fireRow(page, { id, key, arm, at, seed, slices }) {
  return page.evaluate(async ([w, sl]) => {
    const rules = await import('/src/game/rules.ts');
    const reg = await import('/src/vfx/weapons/index.ts');
    const weapon = rules.CHARACTERS[w.id].weapons.find((x) => x.key === w.key);
    if (!weapon) return { err: `no weapon ${w.id}.${w.key}` };
    const v = reg.getWeaponVfx(w.id, w.key);
    const before = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];

    const real = v && typeof v.impact === 'function' ? v.impact : null;
    let noopCalls = 0;
    if (w.arm === 'generic' && real) delete v.impact;
    if (w.arm === 'anchor' && real) v.impact = () => { noopCalls++; };

    window.__wi.reset();
    window.__wi.step(0);
    window.__wi.setBase();
    window.__rng.seed(w.seed);
    // The shipped call `match.ts:handleEvents` makes for a weapon hit, attacker
    // position included — NOT `__vfxSpawnTest`, which substitutes a synthetic weapon
    // when `weaponKey` is dropped and so would differ in four ways at once.
    window.__vfxLayer.spawnImpactBurst(w.x, w.y, weapon.color, weapon.damage,
      { weapon, characterId: w.id, fromXWU: w.x - 60, fromYWU: w.y });

    const series = [];
    let prev = 0;
    for (const t of sl) { window.__wi.step(t - prev); prev = t; series.push(window.__wi.count()); }
    window.__wi.reset();

    if (real) v.impact = real;
    const after = v ? Object.keys(v).filter((k) => typeof v[k] === 'function').sort() : [];
    return {
      series, noopCalls, damage: weapon.damage,
      restored: before.join(',') === after.join(',') && (!real || v.impact === real),
    };
  }, [{ id, key, arm, x: at.x, y: at.y, seed }, slices]);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const t0 = Date.now();
  let fail = 0;
  const failMsg = [];
  const bad = (m) => { failMsg.push(m); fail++; log(`  🔴 ${m}`); };

  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await boot(page);
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
    await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage && !!window.__vfxDebugFighters, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const running = await page.evaluate(PAGE_STILL_HUD);
    await page.evaluate(() => window.__clk.pause());
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(200);
    await installHarness(page, RW, RH, DELTA);
    if (PITCH !== 58) {
      const saved = await page.evaluate(([p, w]) => window.__wi.setPitch(p, w), [PITCH, DETECT_WIDTH]);
      log(`camera: re-pitched ${saved.pitch} -> ${PITCH} deg, frameMode ${saved.mode} -> ground, width ${saved.width} -> ${DETECT_WIDTH} wu`);
    }
    if (KNOWNBAD) {
      const kb = await installKnownBad(page, KB_KIND);
      log(`\n🧪 KNOWN-BAD MODE '${KB_KIND}': ${KB_KIND === 'loud'
        ? 'the subordinate anchor re-scaled to castMuzzle\'s 0.75'
        : 'the pre-fix early return + the pre-fix QA hook'} re-installed in-page (${kb.ok ? 'ok' : kb.why}).`);
      log(`   This run MUST go red. A green run here means the assertions below cannot see the bug.`);
      log(`   expected red: ${KB_KIND === 'loud' ? 'C only (A and B must stay GREEN, or C is just a restatement of B)' : 'A, B and D'}`);
      if (!kb.ok) bad(`known-bad could not be installed: ${kb.why}`);
    }
    log(`\nviewport ${W}x${H}  readback ${RW}x${RH}  delta>=${DELTA}  pitch ${PITCH}  seed ${SEED}  slices ${SLICES.join(',')}`);
    log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);

    const at = await page.evaluate(() => {
      const p = window.__vfxDebugFighters.player;
      return { x: p.x, y: p.y };
    });

    // ── The set under test, read off the registry ────────────────────────────────
    const roster = await page.evaluate(async () => {
      const rules = await import('/src/game/rules.ts');
      const reg = await import('/src/vfx/weapons/index.ts');
      const rows = [];
      for (const [id, c] of Object.entries(rules.CHARACTERS)) {
        for (const w of c.weapons) {
          const v = reg.getWeaponVfx(id, w.key);
          rows.push({
            id, key: w.key, damage: w.damage,
            hasImpact: !!(v && typeof v.impact === 'function'),
          });
        }
      }
      return rows;
    });
    const bespoke = roster.filter((w) => w.hasImpact && (!ONLY || ONLY.includes(`${w.id}.${w.key}`) || ONLY.includes(w.id)));
    log(`\nroster: ${roster.length} weapons, ${roster.filter((w) => w.hasImpact).length} carrying a bespoke impact() hook`);

    // ══ NON-VACUITY, FIRST ═════════════════════════════════════════════════════
    // `[].every()` returns true. Every set asserted over below is checked non-empty
    // BEFORE it is filtered or asserted over (CLAUDE.md #6).
    if (!roster.length) bad('roster is EMPTY — every assertion below would be vacuously green');
    if (!bespoke.length) bad('NO weapon carries a bespoke impact() hook — arms A/B/C would be vacuously green');

    // ══ CONTROLS ═══════════════════════════════════════════════════════════════
    log(`\n══ CONTROLS ═══════════════════════════════════════════════════════════`);
    const nulls = await page.evaluate(() => {
      window.__wi.setBase();
      return [window.__wi.count(), window.__wi.count(), window.__wi.count()];
    });
    log(`NULL      frozen frame vs itself x3: ${nulls.join(', ')} px  (want 0,0,0)`);
    if (nulls.some((n) => n !== 0)) bad(`NULL control non-zero (${nulls.join(',')}) — every area below is a difference of two different frames`);

    const rngOk = await page.evaluate(() => window.__rng.selftest());
    log(`RNG       seeded LCG reproducible and non-constant: ${rngOk}`);
    if (!rngOk) bad('RNG control failed — the anchor/generic ratios below are unpaired');

    const forced = await page.evaluate(async ([f]) => {
      window.__wi.reset(); window.__wi.step(0); window.__wi.setBase();
      window.__vfxSpawnTest('impact', f.x, f.y, 30, '#FF00FF');
      window.__wi.step(160);
      const n = window.__wi.count();
      window.__wi.reset();
      return n;
    }, [at]);
    log(`FORCED    garish 30-damage generic impact: ${forced} px  (want >> 0)`);
    if (forced < 400) bad(`FORCED control ${forced} px — this instrument cannot see a deliberately enormous effect`);

    // ══ D. THE QA HOOK'S ctx.direction ═════════════════════════════════════════
    // One fire, no pixels: plant a recorder as the bespoke hook and read the vector.
    const dirProbe = bespoke[0];
    let dir = null;
    if (!dirProbe) bad('D: no weapon with a bespoke impact() — the direction probe would be vacuous');
    else {
      dir = await page.evaluate(async ([w, f]) => {
        const reg = await import('/src/vfx/weapons/index.ts');
        const v = reg.getWeaponVfx(w.id, w.key);
        const real = v.impact;
        let calls = 0; let vec = null;
        v.impact = (ctx) => { calls++; vec = { x: ctx.direction.x, y: ctx.direction.y, z: ctx.direction.z }; };
        window.__vfxSpawnTest('impact', f.x, f.y, w.damage, '#FFC93C', w.id, w.key);
        v.impact = real;
        return { calls, vec, restored: v.impact === real };
      }, [dirProbe, at]);
      const len = dir.vec ? Math.hypot(dir.vec.x, dir.vec.y, dir.vec.z) : 0;
      log(`\n══ D. __vfxSpawnTest('impact') -> ctx.direction ════════════════════════`);
      log(`D         ${dirProbe.id}.${dirProbe.key}: hook called ${dir.calls}x, direction (${dir.vec ? [dir.vec.x, dir.vec.y, dir.vec.z].map((n) => n.toFixed(3)).join(', ') : 'never received'})  |d| = ${len.toFixed(3)}`);
      // REACH first: a zero |d| means nothing if the hook was never entered.
      if (!dir.calls) bad('D REACH: the planted recorder was never called — |d| below describes nothing');
      else if (len < 0.99) bad(`D: __vfxSpawnTest('impact') hands the bespoke hook |direction| = ${len.toFixed(3)} — the shipped game always supplies a unit vector (match.ts populates fromXWU/fromYWU unconditionally for a weapon hit), so every measurement through this hook is of a frame the game does not draw`);
      if (dir && !dir.restored) bad('D: the recorder did not restore the real hook');
    }

    // ══ A / B / C ══════════════════════════════════════════════════════════════
    log(`\n══ A/B/C. per weapon: composite, anchor-only, generic control ═════════`);
    log(`${pad('weapon', 22)}${rpad('dmg', 4)}${rpad('shipped', 9)}${rpad('anchor', 8)}${rpad('generic', 9)}${rpad('a/g', 7)}  verdict`);
    const rows = [];
    for (const w of bespoke) {
      const shipped = await fireRow(page, { ...w, arm: 'shipped', at, seed: SEED, slices: SLICES });
      const anchor = await fireRow(page, { ...w, arm: 'anchor', at, seed: SEED, slices: SLICES });
      const generic = await fireRow(page, { ...w, arm: 'generic', at, seed: SEED, slices: SLICES });
      if (shipped.err || anchor.err || generic.err) { bad(`${w.id}.${w.key}: ${shipped.err ?? anchor.err ?? generic.err}`); continue; }
      if (!shipped.restored || !anchor.restored || !generic.restored) bad(`${w.id}.${w.key}: RESTORE failed — a later row is measuring a leaked ablation`);
      // REACH: the no-op arm's hook must actually have been entered, or arm B is
      // measuring the real sculpt and passes for entirely the wrong reason.
      if (!anchor.noopCalls) bad(`${w.id}.${w.key}: REACH — the planted no-op hook was never called, so the anchor arm is not measuring the anchor`);
      const s = Math.max(...shipped.series);
      const a = Math.max(...anchor.series);
      const g = Math.max(...generic.series);
      const ratio = g ? a / g : 0;
      const notes = [];
      if (s < FLOOR_PX) { notes.push(`A: ${s} px < ${FLOOR_PX}`); bad(`A ${w.id}.${w.key}: composite ${s} px is under the ${FLOOR_PX} px floor (generic control ${g} px)`); }
      if (ratio < ANCHOR_MIN_RATIO) { notes.push(`B: a/g ${ratio.toFixed(3)} < ${ANCHOR_MIN_RATIO}`); bad(`B ${w.id}.${w.key}: with the hook drawing nothing the frame moved ${a} px against a ${g} px generic burst (${ratio.toFixed(3)}) — there is no anchor under this hook`); }
      if (ratio > ANCHOR_MAX_RATIO) { notes.push(`C: a/g ${ratio.toFixed(3)} > ${ANCHOR_MAX_RATIO}`); bad(`C ${w.id}.${w.key}: the anchor alone is ${ratio.toFixed(3)} of the generic burst — it has stopped being subordinate and the bespoke sculpt is a garnish on it`); }
      rows.push({ id: w.id, key: w.key, damage: w.damage, shipped: s, anchor: a, generic: g, ratio: +ratio.toFixed(3), notes });
      log(`${pad(`${w.id}.${w.key}`, 22)}${rpad(w.damage, 4)}${rpad(s, 9)}${rpad(a, 8)}${rpad(g, 9)}${rpad(ratio.toFixed(3), 7)}  ${notes.length ? `🔴 ${notes.join('; ')}` : 'ok'}`);
    }

    // A last non-vacuity check on the MEASURED set, not the intended one: a run where
    // every row errored out would print no 🔴 above and would otherwise exit 0.
    if (!rows.length) bad('no row was measured — the table above is empty, so A/B/C asserted over nothing');
    else if (rows.length !== bespoke.length) bad(`${rows.length} rows measured of ${bespoke.length} intended — the missing ones were never asserted over`);

    await writeFile(`${OUT}/wi_guard.p${PITCH}${KNOWNBAD ? '.knownbad' : ''}.json`, JSON.stringify({
      pitch: PITCH, seed: SEED, slices: SLICES, delta: DELTA, knownbad: KNOWNBAD,
      floorPx: FLOOR_PX, anchorMinRatio: ANCHOR_MIN_RATIO, anchorMaxRatio: ANCHOR_MAX_RATIO,
      direction: dir, rows, failures: failMsg,
    }, null, 1));

    log(`\n${'─'.repeat(72)}`);
    if (KNOWNBAD) {
      // The known-bad run INVERTS the exit code: green here is the failure. And it is
      // not enough that SOMETHING went red — the arm the mode targets has to be the one
      // that went red, or a bug in an unrelated arm would certify this file forever.
      // `[ :]` and not `' '` — the D messages are written both ways ("D REACH:" and
      // "D: __vfxSpawnTest..."), and a classifier that missed one would have reported
      // the direction arm as unproven while it was going red on every run.
      const armCount = (a) => failMsg.filter((m) => new RegExp(`^${a}[ :]`).test(m)).length;
      const want = KB_KIND === 'loud' ? ['C'] : ['A', 'B', 'D'];
      const quiet = KB_KIND === 'loud' ? ['A', 'B'] : [];
      log(`arms red: A ${armCount('A')} · B ${armCount('B')} · C ${armCount('C')} · D ${armCount('D')}`);
      const missing = want.filter((a) => armCount(a) === 0);
      const noisy = quiet.filter((a) => armCount(a) > 0);
      if (!fail) {
        log(`🔴 KNOWN-BAD PASSED. The defect was re-installed and every assertion stayed green,`);
        log(`   so this file is a comment with a tick next to it (CLAUDE.md #6).`);
        process.exitCode = 1;
      } else if (missing.length) {
        log(`🔴 KNOWN-BAD went red, but NOT on ${missing.join('/')} — the arm this mode targets did not fire,`);
        log(`   so it is still unproven and something else is carrying the red.`);
        process.exitCode = 1;
      } else if (noisy.length) {
        log(`🔴 KNOWN-BAD made ${noisy.join('/')} red too. This mode is supposed to leave them green;`);
        log(`   if they cannot stay green the targeted arm is not measuring anything of its own.`);
        process.exitCode = 1;
      } else {
        log(`✅ KNOWN-BAD '${KB_KIND}' went RED on ${want.join('/')} (${fail} assertion(s)) and left ${quiet.join('/') || 'nothing else'} green`);
        log(`   — these guards can see the bug they exist for.`);
        process.exitCode = 0;
      }
    } else {
      log(`${fail ? `🔴 wi_guard: ${fail} FAILURE(S)` : `✅ wi_guard: ${rows.length} bespoke impacts, all >= ${FLOOR_PX} px, anchor ${ANCHOR_MIN_RATIO}-${ANCHOR_MAX_RATIO} of generic`}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      process.exitCode = fail ? 1 : 0;
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
