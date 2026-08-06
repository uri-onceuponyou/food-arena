#!/usr/bin/env node
/**
 * CONCEALMENT, ON RENDERED PIXELS — is a concealed enemy actually gone from all THREE
 * surfaces, and is the player still there?
 *
 * ── WHY A RENDER PROBE AND NOT A UNIT TEST ──────────────────────────────────
 *
 * Uri, `docs/DECISIONS-FOR-URI.md` §30: *"it's supposed to be plates and other kitchen
 * objects you can hide under — FULLY HIDDEN."* Three surfaces carry the opponent's
 * position — the radar blip (`ui/hud.ts`), the floating HP pill and the 3D model
 * (`game/match.ts`) — and this project's most-repeated failure is judging a description
 * instead of an image. Two of the three are DOM and could be asserted cheaply; the model
 * cannot, and it is the one Uri actually asked for. So all three are measured on the same
 * frames.
 *
 * ── THE THREE THINGS IT REFUSES TO ASSUME ───────────────────────────────────
 *
 *   1. **THE ASYMMETRY.** The sim is symmetric — either fighter can conceal — while the
 *      renderer is one human's client. Hiding "the concealed one" instead of "the
 *      opponent, from this viewer" deletes your own character, which reads as a crash.
 *      So the player's blip, pill and pixels are measured on every frame too, and the
 *      player's region must be UNCHANGED.
 *   2. **THE REVEAL RADIUS.** `CONCEAL_REVEAL_RADIUS` (84 wu) says concealment does not
 *      hide you from someone already inside melee reach. A probe that only proved
 *      "concealed -> hidden" would pass just as happily against a wire that hid the enemy
 *      unconditionally. Case R puts the player 60 wu away with the SAME whole-arena
 *      region and requires the enemy to stay VISIBLE. That is the known-bad input.
 *   3. **DRIFT.** `docs/LESSONS.md` §1: the eighteenth "it isn't there" rendered
 *      plausibly and wrongly. The region is removed again and a third frame captured, so
 *      "the enemy came back and everything else returned to where it was" is measured
 *      rather than hoped for.
 *
 * ── HOW IT PLACES THE FIGHTERS ──────────────────────────────────────────────
 *
 * `?px=/?py=` (QA player placement) puts the player a chosen distance from the enemy's
 * spawn; `?fogRadius=` skips the countdown into `playing`; `?simSpeed=0.02` all but
 * freezes the sim so the three captures are the same instant. The concealment region is
 * injected through `window.__matchArena` — the live `ArenaDefinition`, by reference —
 * because no arena declares one yet.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/cw_conceal_view.mjs --url {URL}
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/conceal-wiring`));
const W = Number(arg('--w', 1280));
const H = Number(arg('--h', 720));

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/**
 * The kitchen's enemy spawn. Both cases place the player due WEST of it, on points
 * measured clear of every CoverBox and hazard.
 *
 * ⚠️ WEST, not north or south, and it was a real failure first: at 140 wu NORTH the
 * enemy projected to y=765 in a 720-high frame — off the bottom edge — and the probe
 * happily reported the model "gone" from a body box that was 30% clipped. The camera
 * pitches 58 deg, so the visible world reaches much further along +y (up-screen) than
 * -y; only the horizontal axis is symmetric about the player.
 */
const ENEMY = { x: 1240, y: 610 };
/**
 * 170 wu, and it is pinned between two numbers rather than picked:
 *
 *   > `REACH.rangedMax` (140) — the longest reach in the roster, ultimates aside — so
 *     NEITHER FIGHTER CAN ATTACK. At 140 wu the Egg opened with Hatch! and the pecking
 *     chick projectile (a world entity in `vfx.ts`, not part of the character model)
 *     stayed on screen after the model went, dropping the measured signal to 27.8%
 *     against a 9.0% drift floor. No combat, no confound.
 *   < `FAIR_PLAY.radiusUnits` (199.2) — the disc every supported device is guaranteed to
 *     show — so the enemy is on screen at every aspect ratio, not just this one.
 */
const FAR_GAP = 170;
/** <= 84, so the reveal radius must override concealment. */
const NEAR_GAP = 60;

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

mkdirSync(OUT, { recursive: true });

/** Everything the page can tell us about who is drawn, in one round trip. */
const readSurfaces = () => ({
  radarEnemy: getComputedStyle(document.querySelector('[data-el="radar-enemy"]')).display,
  radarPlayer: getComputedStyle(document.querySelector('[data-el="radar-player"]')).display,
  floatEnemy: getComputedStyle(document.querySelector('[data-el="float-enemy"]')).display,
  floatPlayer: getComputedStyle(document.querySelector('[data-el="float-player"]')).display,
  radarRect: document.querySelector('[data-el="radar"]').getBoundingClientRect().toJSON(),
  screen: window.__vfxDebugScreen ?? null,
  hasArenaHook: !!window.__matchArena,
  concealCount: (window.__matchArena?.concealment ?? []).length,
});

/** Per-pixel |Δ| between two PNGs, plus the count of pixels that moved by more than
 *  `thresh` inside an axis-aligned region. A region rather than a whole-frame number
 *  because "something changed" is not the claim — "the ENEMY changed and the PLAYER did
 *  not" is. */
async function diffRegions(pathA, pathB, regions, thresh = 18) {
  const [a, b] = await Promise.all([
    sharp(pathA).raw().ensureAlpha().toBuffer({ resolveWithObject: true }),
    sharp(pathB).raw().ensureAlpha().toBuffer({ resolveWithObject: true }),
  ]);
  const { width, height } = a.info;
  const out = {};
  for (const [name, r] of Object.entries(regions)) {
    const x0 = Math.max(0, Math.round(r.x0)), x1 = Math.min(width, Math.round(r.x1));
    const y0 = Math.max(0, Math.round(r.y0)), y1 = Math.min(height, Math.round(r.y1));
    let changed = 0, total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        const d = Math.max(
          Math.abs(a.data[i] - b.data[i]),
          Math.abs(a.data[i + 1] - b.data[i + 1]),
          Math.abs(a.data[i + 2] - b.data[i + 2]),
        );
        total++;
        if (d > thresh) changed++;
      }
    }
    out[name] = { changed, total, pct: total ? (changed / total) * 100 : 0 };
  }
  return out;
}

/** A character occupies roughly a 130x210 px box above its projected GROUND point at
 *  1280x720 (FAIR_PLAY fixes wu-per-px, so this does not drift with the viewport it is
 *  run at — but it is recomputed from the projection, never hardcoded to a screen spot). */
const bodyBox = (pt) => ({ x0: pt.x - 70, x1: pt.x + 70, y0: pt.y - 215, y1: pt.y + 25 });

async function run(gap, tag) {
  const px = ENEMY.x - gap;
  const py = ENEMY.y;
  // `simSpeed=0.01` all but freezes the SIM while the render loop keeps running at full
  // rate, so the three captures are ~1.2 s apart in wall clock and ~12 ms apart in match
  // time. That is what makes a before/after on one page load legitimate.
  const url = `${BASE}/?px=${px}&py=${py}&fogRadius=900&simSpeed=0.01&player=hamburger&enemy=egg&pointerLock=0`;
  const browser = await chromium.launch({ args: LAUNCH });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 60000 });
    await page.waitForTimeout(600);

    const before = await page.evaluate(readSurfaces);
    check(`[${tag}] the QA arena hook is published (without it nothing here is measurable)`,
      before.hasArenaHook);
    check(`[${tag}] no arena ships a concealment list, so the baseline has 0 regions`,
      before.concealCount === 0, `got ${before.concealCount}`);
    // `!== 'none'` rather than `=== 'block'`: the pill is a flex row, and pinning the
    // exact display value made this assertion fail on a HUD that was working perfectly.
    check(`[${tag}] BASELINE: the enemy is drawn on the radar and as a floating pill`,
      before.radarEnemy !== 'none' && before.floatEnemy !== 'none',
      `radar=${before.radarEnemy} float=${before.floatEnemy}`);
    if (!before.screen?.enemy) {
      check(`[${tag}] the enemy projects into the frame at ${gap} wu`, false, 'no projection');
      return null;
    }
    const onScreen = before.screen.enemy.x > 0 && before.screen.enemy.x < W
      && before.screen.enemy.y > 0 && before.screen.enemy.y < H;
    check(`[${tag}] the enemy is inside the viewport at ${gap} wu separation`,
      onScreen, JSON.stringify(before.screen.enemy));

    const shown = `${OUT}/${tag}-1-shown.png`;
    await page.screenshot({ path: shown });

    // ── Inject one region covering the whole playfield ──────────────────────
    // Whole-arena rather than a box placed on the enemy, deliberately: it needs no
    // knowledge of the enemy's world position, and it makes the ONLY thing separating
    // case F from case R the separation itself.
    await page.evaluate(() => {
      window.__matchArena.concealment = [{ x: 700, y: 500, w: 4000, h: 4000, kind: 'probe_region' }];
    });
    await page.waitForTimeout(300);
    const during = await page.evaluate(readSurfaces);
    const hidden = `${OUT}/${tag}-2-region.png`;
    await page.screenshot({ path: hidden });

    // ── Remove it again: the drift control ─────────────────────────────────
    await page.evaluate(() => { window.__matchArena.concealment = []; });
    await page.waitForTimeout(300);
    const after = await page.evaluate(readSurfaces);
    const restored = `${OUT}/${tag}-3-restored.png`;
    await page.screenshot({ path: restored });

    const regions = {
      enemy: bodyBox(before.screen.enemy),
      player: bodyBox(before.screen.player ?? { x: W / 2, y: H / 2 }),
      radar: {
        x0: before.radarRect.x, x1: before.radarRect.x + before.radarRect.width,
        y0: before.radarRect.y, y1: before.radarRect.y + before.radarRect.height,
      },
    };
    const d = await diffRegions(shown, hidden, regions);
    const drift = await diffRegions(shown, restored, regions);
    return { before, during, after, d, drift, regions, shots: { shown, hidden, restored } };
  } finally {
    await browser.close();
  }
}

console.log(`\ncw_conceal_view — ${BASE} @ ${W}x${H}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// CASE F — separation 140 wu. Concealment applies. FULLY HIDDEN.
// ─────────────────────────────────────────────────────────────────────────────
console.log(`CASE F — player ${FAR_GAP} wu from the enemy (> CONCEAL_REVEAL_RADIUS 84)`);
const far = await run(FAR_GAP, 'far');
if (far) {
  // SIGNAL vs NOISE, never a bare threshold. `d` is (no region -> region); `drift` is
  // (no region -> region removed again), i.e. the same wall-clock gap with the mechanic
  // switched off — idle animation, ambient props, the fog ring's real-time pulse. Every
  // pixel claim below is stated against that measured floor rather than a guessed
  // tolerance, which is `docs/LESSONS.md` §1's drift-control rule.
  const sig = far.d.enemy.pct, noise = far.drift.enemy.pct;
  check('[far] SURFACE 1/3 — the enemy RADAR BLIP is not drawn',
    far.during.radarEnemy === 'none', `display=${far.during.radarEnemy}`);
  check('[far] SURFACE 2/3 — the enemy FLOATING HP PILL is not drawn',
    far.during.floatEnemy === 'none', `display=${far.during.floatEnemy}`);
  check('[far] SURFACE 3/3 — the enemy MODEL is gone from the rendered pixels',
    sig > 25 && sig > 4 * noise,
    `signal ${sig.toFixed(1)}% of the enemy's body box vs drift floor ${noise.toFixed(2)}%`);
  check('[far] …and the RADAR CARD changed too, so the blip really left the widget',
    far.d.radar.changed > 0, `${far.d.radar.changed}px`);

  // ⚠️ THE ASYMMETRY. If this fails, the wire is hiding "the concealed fighter" rather
  // than "the opponent, from this viewer", and the player has just deleted themselves.
  check('[far] ⚠️ ASYMMETRY: the PLAYER is still on the radar and still has a pill',
    far.during.radarPlayer !== 'none' && far.during.floatPlayer !== 'none',
    `radar=${far.during.radarPlayer} float=${far.during.floatPlayer}`);
  check('[far] ⚠️ ASYMMETRY: the PLAYER\'s own pixels are unchanged by concealment',
    far.d.player.pct < 3.0, `${far.d.player.pct.toFixed(2)}% of the player's body box changed`);

  // DRIFT CONTROL — remove the region and the frame must come back to where it was.
  check('[far] DRIFT: with the region removed the enemy is drawn again',
    far.after.radarEnemy !== 'none' && far.after.floatEnemy !== 'none',
    `radar=${far.after.radarEnemy} float=${far.after.floatEnemy}`);
  check('[far] DRIFT: the restored frame matches the original (this is not a slow fade)',
    noise < 0.25 * sig && far.drift.player.pct < 3.0,
    `enemy ${noise.toFixed(2)}%  player ${far.drift.player.pct.toFixed(2)}%  signal ${sig.toFixed(1)}%`);
  console.log(`       enemy box ${far.d.enemy.changed}/${far.d.enemy.total} px changed (${sig.toFixed(1)}%)`
    + ` · drift floor ${noise.toFixed(2)}% · S/N ${(noise ? sig / noise : Infinity).toFixed(1)}x`
    + ` · player box ${far.d.player.pct.toFixed(2)}% · radar ${far.d.radar.changed} px`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE R — separation 60 wu. THE KNOWN-BAD INPUT: the same region, and the enemy
// must NOT be hidden. A wire that hid unconditionally passes case F and fails here.
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\nCASE R — player ${NEAR_GAP} wu from the enemy (<= CONCEAL_REVEAL_RADIUS 84): the KNOWN-BAD input`);
const near = await run(NEAR_GAP, 'near');
if (near) {
  const sig = near.d.enemy.pct, noise = near.drift.enemy.pct;
  check('[near] KNOWN-BAD: inside the reveal radius the blip is STILL DRAWN',
    near.during.radarEnemy !== 'none', `display=${near.during.radarEnemy}`);
  check('[near] KNOWN-BAD: …and so is the floating pill',
    near.during.floatEnemy !== 'none', `display=${near.during.floatEnemy}`);
  // ⚠️ SIGNAL-RELATIVE, and it HAS to be: at 60 wu the enemy is inside its own melee
  // reach, so it attacks, and an attack cone repaints most of the body box on its own.
  // An absolute "< 4% changed" assertion would fail on a perfectly correct build for a
  // reason that has nothing to do with concealment. The claim is that switching the
  // region on changes the enemy's pixels NO MORE than the same wall-clock gap does with
  // it switched off.
  check('[near] KNOWN-BAD: …and injecting the region moves no more pixels than time alone',
    sig <= 1.6 * noise + 5,
    `region ${sig.toFixed(1)}% vs time-only ${noise.toFixed(1)}%`);
  console.log(`       enemy box ${near.d.enemy.changed}/${near.d.enemy.total} px changed (${sig.toFixed(1)}%)`
    + ` · time-only floor ${noise.toFixed(1)}% (both frames draw the enemy; the churn is its attack cone)`);
}

const summary = { base: BASE, far: far && { d: far.d, drift: far.drift }, near: near && { d: near.d } };
writeFileSync(`${OUT}/cw_conceal_view.json`, JSON.stringify(summary, null, 2));
console.log(`\nshots -> ${OUT}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
