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
 * injected through `window.__matchArena` — the live `ArenaDefinition`, by reference.
 *
 * ⚠️ **THIS SENTENCE USED TO END *"…because no arena declares one yet"* AND IT IS FALSE.**
 * Kept, per house style, because the whole of this file was written under that premise and
 * two of its assertions encoded it. `kitchen.ts` declares **20** regions (10 mirror pairs).
 * The injection is still the right technique — a whole-playfield region needs no knowledge
 * of where either fighter is standing — but the shipped list is now STASHED and RESTORED
 * rather than replaced with `[]`, and the baseline is asserted CLEAN rather than EMPTY.
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
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  🚨 THIS WAS A TYPED CONSTANT AND IT WENT STALE WHEN THE MAP WENT ×4.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE OLD LINE, kept because the class is this repo's most expensive one:
 *
 *     const ENEMY = { x: 1240, y: 610 };   // "the kitchen's enemy spawn"
 *
 * `6631446` took the arena from 1400×1000 to **2800×2000** and `kitchen.ts` now reads
 * `enemySpawn = { x: ARENA_W - 300, y: ARENA_H - 810 }` = **(2500, 1190)**. The 1×
 * playfield is exactly the NW quadrant of the ×4 one, so (1240, 610) stayed a perfectly
 * **LEGAL** point on the map — no legality check anywhere in this repo can see the class
 * (`CLAUDE.md`, "STALE MAP LITERALS ARE INVISIBLE TO EVERY LEGALITY CHECK").
 *
 * What it actually did: `?px=`/`?py=` placed the player at `(1240 − gap, 610)` while the
 * enemy sat at (2500, 1190) — **1,543 wu away** in the far case. `match.ts`'s
 * `projectPointToScreen` returns `null` for a ground point outside NDC, so the probe read
 * `no projection`, bailed out of `run()` and skipped **every one of its twelve real
 * assertions**, in both cases, while reporting only "2 passed, 6 failed".
 *
 * ⚠️ **AND THAT IS NOT THE `np_nfighter` DEFECT** — measured, not assumed. `ce0c665`
 * found a fighter at **176 wu**, INSIDE the ~199.22 wu view guarantee, failing to
 * project; that is a real bug in `match.ts`/`camera.ts` with another owner. 1,543 wu is
 * **7.7× the guarantee**, so `null` there is `projectPointToScreen` behaving exactly as
 * documented. Two different causes wearing the same "no projection" message.
 *
 * ⚠️ **AND RETYPING `{2500, 1190}` WOULD BE THE SAME BUG ONE MAP-CHANGE LATER.** Same
 * remedy `np_nfighter.mjs:resolveCenter` took: read it off the LIVE `ArenaDefinition` the
 * renderer is drawing, and THROW rather than fall back — a fixture that silently defaults
 * is a fixture that silently measures the wrong place.
 */
async function resolveEnemySpawn() {
  const browser = await chromium.launch({ args: LAUNCH });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    await page.goto(`${BASE}/?fogRadius=900&simSpeed=0.01&pointerLock=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 60000 });
    const s = await page.evaluate(() => window.__matchArena?.enemySpawn ?? null);
    if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) {
      throw new Error('resolveEnemySpawn: __matchArena.enemySpawn is not readable — refusing to '
        + 'guess. Every coordinate in this probe is relative to it.');
    }
    return { x: s.x, y: s.y };
  } finally {
    await browser.close();
  }
}
/** Filled by `resolveEnemySpawn()` below the banner. `run()` only READS it, and only
 *  after that await has resolved, so there is no temporal-dead-zone hazard here — but a
 *  `const` referenced above its initialiser is exactly the shape `node --check` cannot
 *  see, so it is called out rather than left to be discovered. */
let ENEMY = null;
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
  // The whole list, not just its length, because the baseline assertion below is now
  // "the SHIPPED regions leave both probe points clear", which a count cannot answer.
  concealBoxes: (window.__matchArena?.concealment ?? []).map(
    (b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, kind: b.kind ?? null })),
});

/**
 * `movement.ts:isConcealed`'s membership rule, restated here for the ONE reason a probe
 * may restate a sim rule: this file cannot import TypeScript. It is the fighter's CENTRE
 * against the box's full extents — **not** AABB overlap and **not** full containment; the
 * sim's header spells out why both were rejected on measurement. If that rule ever
 * changes, this copy is wrong and the planted known-bad below is what says so.
 */
const centreInBox = (x, y, b) =>
  Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2;
/** Every region in `boxes` whose rectangle contains (x, y). */
const boxesCovering = (x, y, boxes) => boxes.filter((b) => centreInBox(x, y, b));

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
    // ═══════════════════════════════════════════════════════════════════════
    //  🚨 THIS ARM WENT RED BECAUSE THE WORLD WAS FIXED. THE TRIPWIRE WAS
    //     RIGHT AND THE REMEDY WAS WRONG — SAME SHAPE AS `gatecount` §G7.
    // ═══════════════════════════════════════════════════════════════════════
    //
    // THE OLD ASSERTION, kept verbatim per `CLAUDE.md`'s rule about an assertion that
    // encodes a premise which has been reversed:
    //
    //     check(`[${tag}] no arena ships a concealment list, so the baseline has 0 regions`,
    //       before.concealCount === 0, `got ${before.concealCount}`);
    //
    // It was TRUE when written — `movement.ts` shipped the mechanic before any arena had a
    // region to act on, and this file's own header still says *"no arena declares one
    // yet"*. `kitchen.ts` then declared **20** (10 mirror pairs, `grep -c 'addConceal(
    // concealGroup' src/arena/kitchen.ts`), which is the DESIRED end state, and this arm
    // reported it as a failure. A control that reads the LIVE world can only stay honest
    // while the world keeps the defect alive; `c471efe` retired exactly that shape.
    //
    // ── WHAT THE ARM WAS ACTUALLY FOR, AND WHAT REPLACES IT ────────────────
    //
    // It was never really about the number 0. Everything below compares a BASELINE frame
    // (enemy drawn) against an INJECTED frame (enemy concealed), so what it needs is that
    // **no shipped region already covers either probe point** — otherwise the baseline is
    // the treatment and the whole before/after is confounded. That is now asserted
    // directly, against the same centre-in-box rule the sim uses.
    //
    // ── AND IT IS NON-VACUOUS BY CONSTRUCTION, NOT BY HOPE ─────────────────
    //
    // `boxesCovering(...) .length === 0` is exactly the `[].every()` shape this repo has
    // been bitten by three times in one session: it passes just as happily against a
    // membership test that can never fire, or against an empty region list. So a region is
    // PLANTED on the enemy point in a COPY of the shipped list and the same predicate is
    // required to FIRE on it, while the real list stays clean. A known-bad you construct
    // beats a control you hope the tree still satisfies.
    const shippedBoxes = before.concealBoxes;
    check(`[${tag}] NON-VACUITY: the arena ships a concealment list at all `
      + `(an empty list makes every membership assertion below vacuous)`,
      shippedBoxes.length > 0, `got ${shippedBoxes.length} regions`);
    const pOver = boxesCovering(px, py, shippedBoxes);
    const eOver = boxesCovering(ENEMY.x, ENEMY.y, shippedBoxes);
    check(`[${tag}] BASELINE IS CLEAN: neither probe point stands in a SHIPPED region, so `
      + `the baseline frame is a genuine "visible" control`,
      pOver.length === 0 && eOver.length === 0,
      `player (${px},${py}) in [${pOver.map((b) => b.kind).join(',')}] · `
      + `enemy (${ENEMY.x},${ENEMY.y}) in [${eOver.map((b) => b.kind).join(',')}]`);
    const planted = [...shippedBoxes, { x: ENEMY.x, y: ENEMY.y, w: 40, h: 40, kind: 'planted' }];
    check(`[${tag}] KNOWN-BAD, PLANTED: the membership predicate FIRES on a planted region `
      + `over the enemy while the real list is clean — so the arm above is not vacuous`,
      boxesCovering(ENEMY.x, ENEMY.y, planted).length === 1
      && boxesCovering(ENEMY.x, ENEMY.y, shippedBoxes).length === 0,
      `planted hits ${boxesCovering(ENEMY.x, ENEMY.y, planted).length}, `
      + `real hits ${boxesCovering(ENEMY.x, ENEMY.y, shippedBoxes).length}`);
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
    //
    // ⚠️ **THE SHIPPED LIST IS STASHED, NOT DISCARDED.** It used to be replaced and then
    // set to `[]`, which was harmless while no arena declared regions and is a confound
    // now that the kitchen declares 20: the "restored" frame would be the shipped world
    // MINUS its concealment, so the drift control would be measuring this probe's own
    // vandalism as drift. `window.__matchArena` is the live `ArenaDefinition` BY
    // REFERENCE — `match.ts:  window.__matchArena = this.arena` — so writing the field is
    // writing the object every reader in the sim sees.
    await page.evaluate(() => {
      window.__cwShipped = window.__matchArena.concealment;
      window.__matchArena.concealment = [{ x: 700, y: 500, w: 4000, h: 4000, kind: 'probe_region' }];
    });
    await page.waitForTimeout(300);
    const during = await page.evaluate(readSurfaces);
    const hidden = `${OUT}/${tag}-2-region.png`;
    await page.screenshot({ path: hidden });

    // ── Put the SHIPPED list back: the drift control ───────────────────────
    await page.evaluate(() => { window.__matchArena.concealment = window.__cwShipped; });
    await page.waitForTimeout(300);
    const after = await page.evaluate(readSurfaces);
    const restored = `${OUT}/${tag}-3-restored.png`;
    await page.screenshot({ path: restored });
    // The restore is itself asserted. Without this row a `__cwShipped` that came back
    // `undefined` would leave `concealment` undefined, `concealmentOf` would hand every
    // reader `NO_CONCEALMENT`, the enemy would reappear, and the drift control would go
    // green while measuring a world the game never ships.
    check(`[${tag}] the drift control RESTORES the shipped list, it does not delete it `
      + `(the old build set it to [] and called that "removed")`,
      after.concealCount === before.concealCount,
      `before ${before.concealCount} → after ${after.concealCount}`);

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

console.log(`\ncw_conceal_view — ${BASE} @ ${W}x${H}`);

ENEMY = await resolveEnemySpawn();
console.log(`enemy spawn, READ FROM THE LIVE ArenaDefinition: (${ENEMY.x}, ${ENEMY.y})`
  + `  — never typed; see resolveEnemySpawn's header for the ×4 map failure\n`);

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
