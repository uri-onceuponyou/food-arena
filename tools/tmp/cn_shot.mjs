#!/usr/bin/env node
/**
 * CN_SHOT — SIX SEATS, SHIPPED REGIONS, RENDERED PIXELS, AT BOTH CAMERAS.
 *
 * ── WHAT URI SAID, AND WHY THIS IS NOT `cw_conceal_view` ────────────────────
 *
 * *"the bushes are to transparent, players are visible through them, so it makes no
 * point."* — the fourth report on this feature.
 *
 * `cw_conceal_view` proves the WIRE: inject a synthetic whole-playfield region at two
 * seats and the opponent's model, blip and pill all go. That is necessary and it is not
 * what Uri is describing. He is describing **the shipped racks in the shipped arena, with
 * more than two people in it**, and this repo's dominant defect class is exactly the one
 * that cannot express itself at two seats.
 *
 * So this places SIX fighters on the SHIPPED geometry — some standing inside a real
 * `addConceal` region, some on open ground, at distances either side of
 * `CONCEAL_REVEAL_RADIUS` — and answers three questions on pixels rather than on argument:
 *
 *   1. **IS EACH MODEL'S `visible` FLAG WHAT THE SIM SAYS IT SHOULD BE**, per slot? A
 *      per-slot table, because "the enemy is hidden" is one ordered pair and there are
 *      thirty of them at six seats.
 *   2. **DOES THE FRAME AGREE?** The model flag is `match.ts`'s claim; the pixels are the
 *      evidence. A control frame with `concealment` cleared is captured and diffed per
 *      body box, so "gone" is a measured signal against a measured drift floor and not a
 *      screenshot somebody looked at once.
 *   3. **WHAT DOES A CONCEALED PLAYER SEE OF HIS OWN CONCEALMENT?** Slot 0 is the local
 *      seat and is deliberately placed INSIDE a region. `match.ts` skips `LOCAL_SLOT`
 *      when hiding, correctly — deleting your own character reads as a crash — so the
 *      question is what feedback he gets instead. Answered by looking at the frame.
 *
 * ── BOTH CAMERAS, AND THE REASON IS URI'S ───────────────────────────────────
 *
 * `CLAUDE.md` rule 3: the match rig is `opts.pitchDeg ?? 58` (steep, far) and the lobby is
 * `charStage.ts`'s `pitchDeg: 20` (close, shallow). The lobby is the better DETECTOR — it
 * shows things foreshortening hides at 58° — and *"a change that only looks right at 58°
 * is a cheat"*. A concealment rack is a canopy: how much of the ground it covers is
 * exactly the kind of fact a steep camera flattens away. So the same frozen scene is shot
 * at BOTH pitches through `stage.rig.pitchDeg`, the way `fc_pix` and `ar2_frame` do it.
 *
 * ⚠️ The lobby camera is a CHARACTER stage and never draws the arena, so a 20° pass here
 * is *the lobby's pitch applied to the match rig*, not the lobby screen. It is the same
 * distinction `limbcheck`'s caveat turned out to be making. Said plainly so nobody quotes
 * it as "shot in the lobby".
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/cn_shot.mjs --url "{URL}"
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/cn`));
const W = Number(arg('--w', 1280));
const H = Number(arg('--h', 720));
const PITCHES = String(arg('--pitches', '58,20')).split(',').map(Number);

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

let pass = 0, fail = 0, skipped = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};
/**
 * A VISIBLE skip, with its reason printed — never a silently dropped row.
 * `gatecount` prints its browser rows this way for the same reason: a row that vanishes
 * is indistinguishable from a row that passed, and this repo has been caught by that.
 */
const skip = (name, why) => { skipped++; console.log(`  SKIP - ${name}\n         ${why}`); };

/** The pitch the game actually ships at (`camera.ts`, `opts.pitchDeg ?? 58`). Only this
 *  arm is REQUIRED to produce pixel evidence; the others are diagnostic viewing angles. */
const SHIPPED_PITCH = 58;
/** Ground-framed width for a shallow diagnostic pass. Wide enough to hold a 120–130 wu
 *  region and a fighter beside it, narrow enough that the rack fills a useful part of the
 *  frame — the whole point of a shallow look is to see the canopy against the character. */
const SHALLOW_WIDTH_UNITS = Number(arg('--shallow-width', 260));
mkdirSync(OUT, { recursive: true });

const ROSTER = ['hamburger', 'egg', 'donut', 'lollipop', 'burrito', 'taco'];

/**
 * THE SEATING, AND EVERY COORDINATE IS DERIVED FROM A SHIPPED REGION AT RUN TIME.
 *
 * ⚠️ **NOTHING HERE IS TYPED AS A WORLD COORDINATE.** `np_nfighter`'s header records the
 * seventh fixture in one session that was wrong because a literal outlived the thing it
 * described — and the ×4 map made every stale coordinate a still-LEGAL one, which is why
 * no check caught any of them. The anchor region is picked out of the live
 * `__matchArena.concealment` list by SIZE and POSITION rules, and every seat is an offset
 * from that region's own centre and extents.
 *
 * The layout, and what each seat is FOR:
 *
 *   slot 0  LOCAL. Inside the anchor region. The camera's subject. Question 3.
 *   slot 1  Inside the anchor, > CONCEAL_REVEAL_RADIUS from slot 0 → MUST BE HIDDEN.
 *   slot 2  Inside the anchor, > CONCEAL_REVEAL_RADIUS from slot 0 → MUST BE HIDDEN.
 *   slot 3  Open ground, > CONCEAL_REVEAL_RADIUS from slot 0     → MUST BE DRAWN.
 *   slot 4  Inside the anchor, <= CONCEAL_REVEAL_RADIUS          → MUST BE DRAWN.
 *           🚨 THIS IS THE KNOWN-BAD SEAT. Without it, a renderer that hid every
 *           in-region fighter unconditionally would pass every other row here.
 *   slot 5  Open ground, <= CONCEAL_REVEAL_RADIUS                → MUST BE DRAWN.
 */
function seatsFor(region, revealRadius) {
  const hw = region.w / 2, hh = region.h / 2;
  // 🚨 THE FIRST LAYOUT PUT SLOT 0 ON THE SOUTH EDGE AND THE "IN REGION, FAR" SEATS
  // `revealRadius + 40` NORTH OF IT — WHICH IS OUTSIDE THE REGION. A 120 wu box cannot
  // hold two points 124 wu apart on one axis. The run produced **0 expected-hidden slots
  // and 5 expected-visible**, and the two `.every()` arms below would have passed over an
  // empty set. The NON-VACUITY row is what caught it, before it could print green.
  //
  // The fix is DIAGONAL: the longest segment inside an axis-aligned box is its diagonal,
  // `hypot(w, h)` = 170 wu at 120×120, which is the only way to clear an 84 wu radius
  // twice over while staying inside. Slot 0 takes the SW corner, the far seats take the
  // NE half, and the whole thing is asserted rather than trusted — `seatsFor` refuses a
  // region too small to express both classes instead of silently producing one.
  const inset = 6;
  const diag = Math.hypot(region.w - 2 * inset, region.h - 2 * inset);
  if (diag <= revealRadius) {
    throw new Error(`cn_shot: the anchor region is ${region.w}×${region.h} wu; its longest `
      + `interior segment is ${diag.toFixed(0)} wu, which cannot exceed the ${revealRadius} wu `
      + `reveal radius. There is no seating that produces an expected-HIDDEN slot in it, and a `
      + `run that proceeded would assert over an empty set.`);
  }
  const p0 = { x: region.x - hw + inset, y: region.y - hh + inset };   // SW corner, inside
  const near = Math.min(revealRadius - 30, region.w * 0.35);
  return [
    { slot: 0, x: p0.x, y: p0.y, tag: 'LOCAL, in region' },
    { slot: 1, x: region.x + hw - inset, y: region.y + hh - inset, tag: 'in region, FAR (NE corner)' },
    { slot: 2, x: region.x + hw - inset, y: region.y + 0.33 * hh, tag: 'in region, FAR' },
    { slot: 3, x: p0.x - (revealRadius + 46), y: p0.y + 10, tag: 'open ground, far' },
    { slot: 4, x: p0.x + near, y: p0.y + near * 0.4, tag: 'in region, NEAR — known-bad' },
    { slot: 5, x: p0.x - (revealRadius - 40), y: p0.y - 24, tag: 'open ground, near' },
  ];
}

/** Per-pixel |Δ| inside axis-aligned regions, exactly as `cw_conceal_view` computes it. */
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
const bodyBox = (pt) => ({ x0: pt.x - 70, x1: pt.x + 70, y0: pt.y - 215, y1: pt.y + 25 });

/**
 * Pick the anchor region off the LIVE arena, and refuse rather than fall back.
 *
 * Rules, in order: big enough that four fighters fit inside with room either side of the
 * reveal radius; and as close to the arena's own centre as such a region gets, so the
 * camera has arena on all sides of it rather than the apron.
 */
async function resolveAnchor(page) {
  return page.evaluate(() => {
    const a = window.__matchArena;
    if (!a || !Array.isArray(a.concealment) || a.concealment.length === 0) return null;
    const c = a.center;
    const big = a.concealment.filter((b) => b.w >= 110 && b.h >= 110);
    const pool = big.length ? big : a.concealment;
    let best = null, bestD = Infinity;
    for (const b of pool) {
      const d = Math.hypot(b.x - c.x, b.y - c.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return { region: { x: best.x, y: best.y, w: best.w, h: best.h, kind: best.kind ?? null },
      total: a.concealment.length, centre: c };
  });
}

const browser = await chromium.launch({ args: LAUNCH });
const summary = { base: BASE, pitches: PITCHES, arms: {} };
try {
  // ── A throwaway page, only to read the shipped geometry ──────────────────
  const scout = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await scout.goto(`${BASE}/?fogRadius=900&simSpeed=0.01&pointerLock=0`, { waitUntil: 'networkidle' });
  await scout.waitForFunction(() => window.__gameReady === true, null, { timeout: 60000 });
  const anchorInfo = await resolveAnchor(scout);
  const revealRadius = await scout.evaluate(() => window.__concealRevealRadius ?? null);
  await scout.close();
  if (!anchorInfo) throw new Error('cn_shot: the live arena publishes no concealment regions — '
    + 'refusing to invent one. Every seat below is an offset from a real region.');
  // `CONCEAL_REVEAL_RADIUS` is not published to the page, so it is stated here ONCE and
  // then CHECKED against the sim's own behaviour by slot 4 (in region, inside the radius,
  // must be drawn) and slots 1/2 (in region, outside it, must not be). If the constant
  // moved, those three rows disagree with each other and the run goes red — which is the
  // point of having a known-bad seat rather than trusting a number typed in a probe.
  const R = revealRadius ?? 84;
  const { region } = anchorInfo;
  const seats = seatsFor(region, R);

  console.log(`\ncn_shot — ${BASE} @ ${W}x${H} · pitches ${PITCHES.join('/')}`);
  console.log(`  anchor region ${region.kind} at (${region.x},${region.y}) ${region.w}×${region.h} wu`
    + `  ·  ${anchorInfo.total} shipped regions  ·  R = ${R} wu`
    + `${revealRadius === null ? ' (not published by the page; cross-checked by slot 4)' : ''}`);
  check('NON-VACUITY: the live arena publishes concealment regions to place seats in',
    anchorInfo.total > 0, `${anchorInfo.total} regions`);

  const fighters = seats.map((s, i) => `${ROSTER[i]}@${Math.round(s.x)},${Math.round(s.y)}`).join(';');
  const url = `${BASE}/?fighters=${encodeURIComponent(fighters)}`
    + `&fogRadius=900&simSpeed=0.005&pointerLock=0`;

  for (const pitch of PITCHES) {
    console.log(`\n── PITCH ${pitch}° ${pitch === 58 ? '(the MATCH rig)' : '(the LOBBY\'s pitch, on the match rig)'}`);
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 60000 });
    await page.evaluate(([p, widthUnits]) => {
      const w = window;
      const st = (w.__stages ? [...w.__stages].find((s) => !s.offscreen) : null) || w.__stage;
      if (!st) throw new Error('no Stage');
      st.rig.pitchDeg = p;
      // 🚨 **SETTING THE PITCH ALONE RENDERS AN EMPTY FRAME, AND THE FIRST DRAFT DID.**
      // A match rig is `frameMode: 'fair'` — it SOLVES its distance so the fair-play disc
      // fits at the current aspect (`camera.ts:computeFairDistance`). Re-solving that at
      // 20° pushes the camera so far back and so low that the whole arena leaves the
      // frustum and the frame is nothing but the fog plane. The 20° arm produced exactly
      // that: a flat orange rectangle with a HUD on it, and it would have been reported as
      // "verified at both cameras".
      // `an_probe.mjs:setPitch` already knew this — `if (deg !== 58) { rig.frameMode =
      // 'ground'; rig.viewWidthUnits = widthUnits; }` — and the fix is copied from it.
      if (p !== 58) { st.rig.frameMode = 'ground'; st.rig.viewWidthUnits = widthUnits; }
      st.rig.apply();
      return { pitch: st.rig.pitchDeg, mode: st.rig.frameMode, width: st.rig.viewWidthUnits };
    }, [pitch, SHALLOW_WIDTH_UNITS]);
    // 🚨 **2.5 s, AND THE FIRST DRAFT WAITED 900 ms AND MEASURED A 75% "DRIFT FLOOR".**
    // Setting `rig.pitchDeg` makes `CameraRig` re-solve its distance and look-ahead from
    // scratch (`fairSolveAt`), and `follow()` LERPS to the new solution over many frames.
    // At 900 ms the camera was still travelling, so every pixel in every body box moved
    // between captures and signal and floor were both ~75% — an instrument with no
    // discrimination at all, which would have read as "concealment does nothing".
    // The wait is long AND the settle is then MEASURED below rather than assumed.
    await page.waitForTimeout(2500);

    /**
     * Everything about who is drawn, read off the SHIPPED objects, per slot.
     *
     * ⚠️ **`Fighter.concealed` IS NOT PUBLISHED TO THE PAGE, AND THE FIRST DRAFT OF THIS
     * TOOL READ IT ANYWAY.** `vfx.ts:VfxFighterSnapshot` is `{x, y, hp, alive,
     * terrainSlowFactor}` — no `concealed` — so `s.concealed` was `undefined` for every
     * slot, `expectHidden` was `false` for every slot, and the two `.every()` arms below
     * would have run over a set with nothing in it and printed green. `[].every()` is
     * `true`, three times in three files in one session. Caught before it ran, by checking
     * the published interface instead of assuming the field was there.
     *
     * So the EXPECTATION is derived from geometry — region membership and distance, the
     * two things `movement.ts:isVisibleFrom` is made of — and the OBSERVATION is the
     * pixel diff. Two independent sources, which is the only way the comparison means
     * anything. The two mechanisms geometry cannot see (`CONCEAL_ATTACK_REVEAL_MS` and
     * `breakConcealment`) are held off by `?simSpeed=0.005`, and if one of them fires
     * anyway an expected-hidden slot is DRAWN and its row goes red — a visible failure,
     * not a silent pass.
     */
    const readSlots = () => {
      const w = window;
      const st = (w.__stages ? [...w.__stages].find((s) => !s.offscreen) : null) || w.__stage;
      const f = w.__vfxDebugFighters?.slots ?? [];
      const scr = w.__vfxDebugScreen?.slots ?? [];
      const boxes = w.__matchArena?.concealment ?? [];
      return {
        n: f.length,
        conceal: boxes.length,
        phase: w.__matchDebug?.phase ?? null,
        pitch: st?.rig?.pitchDeg ?? null,
        slots: f.map((s, i) => {
          // `roster.ts:slotKey` — slots 0 and 1 keep the historical `player`/`enemy`
          // names, 2..5 are `slotN`. Read from the DOM rather than retyped, so a naming
          // change surfaces as a missing element instead of a silently wrong answer.
          const key = i === 0 ? 'player' : i === 1 ? 'enemy' : `slot${i}`;
          const q = (n) => document.querySelector(`[data-el="${n}"]`);
          const dsp = (n) => { const e = q(n); return e ? getComputedStyle(e).display : 'MISSING'; };
          return {
          i, key, x: s.x, y: s.y, alive: s.alive ?? null,
          float: dsp(`float-${key}`), radar: dsp(`radar-${key}`),
          // `movement.ts:isConcealed`'s membership rule — the fighter's CENTRE against the
          // box's full extents, via `boxesOverlap(x, y, 0, 0, ...)`. Restated because a
          // probe cannot import TypeScript; if the rule moves, slot 4 disagrees with
          // slots 1/2 and the run goes red.
          inRegion: boxes.some((b) => Math.abs(s.x - b.x) < b.w / 2 && Math.abs(s.y - b.y) < b.h / 2),
          screen: scr[i] ?? null,
          };
        }),
      };
    };
    /**
     * 🚨 **THE DRIFT FLOOR WAS 81% AND THE SIGNAL WAS 79%, ON TWO CAPTURES OF AN IDENTICAL
     * WORLD 700 ms APART. AN INSTRUMENT WITH NO DISCRIMINATION AT ALL.**
     *
     * Six fighters seated 45–153 wu apart are inside each other's reach, so the frame is
     * full of live combat VFX — a Giant Lollipop disc, melee arcs, damage numbers — and
     * `?simSpeed=` slows the SIM while the render loop keeps animating in real time. Any
     * two captures separated by wall clock differ almost everywhere, and reporting the
     * signal against that floor would have said "concealment does nothing" from an
     * instrument that could not have said anything else.
     *
     * So the loop is FROZEN and STEPPED. `match.ts`'s loop re-arms itself with
     * `requestAnimationFrame`, so stubbing rAF stops it after the current frame; restoring
     * it for a fixed slice runs a known number of frames and re-stubbing halts it again.
     * Every pair below is then **exactly one step apart** — the treatment pair and the
     * drift pair alike — which is what makes the comparison mean something.
     *
     * ⚠️ The concealment toggle is applied WHILE FROZEN and takes effect on the next
     * stepped frame, because `model.root.visible` is written inside the loop. Toggling and
     * screenshotting without a step would capture the previous frame's decision and read
     * as "concealment does nothing" for a second, entirely different reason.
     */
    /**
     * ⚠️ **STUBBING rAF TO A NO-OP KILLS THE LOOP DEAD, AND THAT DRAFT MEASURED 0.00%
     * EVERYWHERE — SIGNAL AND FLOOR ALIKE.** `match.ts`'s loop re-arms itself on its own
     * last line (`this.raf = requestAnimationFrame(this.loop)`). A stub that returns 0
     * without storing the callback means nothing ever calls the loop again, so restoring
     * the real rAF later restores nothing: there is no pending callback to fire. The
     * frames were byte-identical because the renderer had stopped, which is a perfect
     * imitation of "concealment changes nothing".
     *
     * A QUEUE keeps the loop alive and hands the stepping to us. `THREE.Clock.getDelta()`
     * then returns the real gap, clamped to 1/20 s and multiplied by `simSpeed`, so a
     * frame run after a long pause still advances almost nothing — which is exactly the
     * property wanted: the loop REDECIDES every model's `visible` flag while the animation
     * barely moves.
     */
    const freeze = () => page.evaluate(() => {
      const w = window;
      if (w.__cnQueue) return w.__cnQueue.length;
      w.__cnQueue = [];
      w.__cnRaf = w.requestAnimationFrame.bind(w);
      w.requestAnimationFrame = (cb) => { w.__cnQueue.push(cb); return w.__cnQueue.length; };
      return 0;
    });
    /** Run `k` queued frames, and RETURN THE QUEUE DEPTH so liveness is asserted rather
     *  than assumed — an empty queue after a step means the loop stopped re-arming, which
     *  is the failure the no-op stub produced silently. */
    const stepFrames = (k) => page.evaluate((n) => {
      const w = window;
      for (let i = 0; i < n; i++) {
        const q = w.__cnQueue.splice(0, w.__cnQueue.length);
        for (const cb of q) cb(performance.now());
      }
      return w.__cnQueue.length;
    }, k);
    const STEP = 2;   // two queued frames: one for the loop to redecide, one to be sure.

    await freeze();
    await page.waitForTimeout(200);
    const armed = await stepFrames(STEP);
    check(`[${pitch}°] LIVENESS: the render loop is still re-arming under the frame queue `
      + `(a dead loop makes every diff below 0.00% and reads as "nothing changed")`,
      armed > 0, `${armed} frames queued after stepping`);
    const live0 = await page.evaluate(readSlots);
    const shot = `${OUT}/p${pitch}-1-live.png`;
    await page.screenshot({ path: shot });

    // DRIFT PAIR — one step, same world. This is the floor, and it is measured on the
    // treatment arm's own world rather than on the control's, so nothing about the two
    // pairs differs except the thing under test.
    await stepFrames(STEP);
    const driftShot = `${OUT}/p${pitch}-2-live-drift.png`;
    await page.screenshot({ path: driftShot });

    // TREATMENT — regions cleared, one step, so the loop redecides every model's
    // `visible` flag with the new arena.
    await page.evaluate(() => {
      window.__cnShipped = window.__matchArena.concealment;
      window.__matchArena.concealment = [];
    });
    await stepFrames(STEP);
    const all = await page.evaluate(readSlots);
    const ctl = `${OUT}/p${pitch}-3-nocover.png`;
    await page.screenshot({ path: ctl });

    // RESTORE, and assert it — a restore that silently left the arena empty would make
    // every later run measure a world the game never ships.
    await page.evaluate(() => { window.__matchArena.concealment = window.__cnShipped; });
    await stepFrames(STEP);
    const back = await page.evaluate(readSlots);
    const live = live0;

    check(`[${pitch}°] the page seated all six fighters`, live.n === 6, `got ${live.n}`);
    check(`[${pitch}°] the rig is actually at ${pitch}°`, Math.abs((live.pitch ?? -1) - pitch) < 0.01,
      `rig.pitchDeg = ${live.pitch}`);
    check(`[${pitch}°] the control really removed the regions and the restore put them back`,
      all.conceal === 0 && back.conceal === live0.conceal && live0.conceal > 0,
      `live ${live0.conceal} → control ${all.conceal} → restored ${back.conceal}`);

    // ── Per-slot expectation, from the sim's own `concealed` flag + distance ──
    check(`[${pitch}°] the match is in the PLAYING phase (a countdown frame moves nobody, `
      + `which is how a wrong-base demo passed by having nothing to measure)`,
      live.phase === 'playing', `phase=${live.phase}`);
    const me = live.slots[0];
    const boxes = {};
    const rows = [];
    for (const s of live.slots.slice(1)) {
      const d = Math.hypot(s.x - me.x, s.y - me.y);
      const expectHidden = s.inRegion && d > R;
      rows.push({ ...s, d, expectHidden });
      if (all.slots[s.i]?.screen) boxes[`s${s.i}`] = bodyBox(all.slots[s.i].screen);
    }
    // Slot 0 is the LOCAL seat. `match.ts` skips `LOCAL_SLOT` when hiding — deleting your
    // own character reads as a crash — so it must be drawn no matter what, and it is
    // measured rather than assumed. This is the asymmetry arm.
    if (all.slots[0]?.screen) boxes.s0 = bodyBox(all.slots[0].screen);
    // ⚠️ NON-VACUITY BEFORE THE FILTER. Both arms below are `.every()` over a filtered
    // set, and `[].every()` is `true`. If the layout ever stops producing both classes,
    // the run must go RED rather than quietly green.
    const shouldHide = rows.filter((r) => r.expectHidden);
    const shouldShow = rows.filter((r) => !r.expectHidden);
    check(`[${pitch}°] NON-VACUITY: the seating produced BOTH classes to assert over`,
      shouldHide.length > 0 && shouldShow.length > 0,
      `${shouldHide.length} expected-hidden · ${shouldShow.length} expected-visible`);

    const diff = Object.keys(boxes).length ? await diffRegions(ctl, shot, boxes) : {};
    const drift = Object.keys(boxes).length ? await diffRegions(shot, driftShot, boxes) : {};

    console.log(`     slot  world          d(wu)  inRegion  onCam  expect    pill    blip   seat`);
    for (const r of rows) {
      console.log(`      ${r.i}   (${String(Math.round(r.x)).padStart(4)},${String(Math.round(r.y)).padStart(4)})`
        + `   ${r.d.toFixed(0).padStart(4)}   ${String(r.inRegion).padStart(7)}`
        + `  ${String(r.screen !== null).padStart(5)}`
        + `  ${(r.expectHidden ? 'HIDDEN' : 'drawn').padStart(6)}`
        + `  ${String(r.float).padStart(6)}  ${String(r.radar).padStart(6)}`
        + `   ${seats[r.i].tag}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  🚨 THE PER-SLOT CLAIM IS MADE ON THE DOM, NOT ON THE PIXEL DIFF, AND
    //     THE REASON IS A MEASUREMENT, NOT A PREFERENCE.
    // ═══════════════════════════════════════════════════════════════════════
    //
    // THE OLD ROWS, kept per house style because they are the reason for the new ones:
    //
    //     check(`every EXPECTED-HIDDEN slot's body box changed far more than drift`,
    //       hidPix.every((r) => diff[k].pct > 20 && diff[k].pct > 4 * drift[k].pct), …)
    //     check(`the frame SETTLED: the two same-world captures agree`,
    //       Math.max(...floors) < 8, …)
    //
    // Three drafts tried to make a pixel diff carry the per-slot claim and all three
    // failed the same way — **the DRIFT FLOOR CAME OUT THE SIZE OF THE SIGNAL**: 75%, then
    // 81%, then 63% between two captures one stepped frame apart, against a signal of 78%.
    // Six fighters seated 45–153 wu apart are inside each other's reach, so the frame
    // carries live combat VFX — a Giant Lollipop disc, melee arcs, damage numbers — and
    // those repaint a body box faster than concealment does. `docs/LESSONS.md` §7 is the
    // same finding in a different costume: three VFX passes that each looked reasonable
    // alone together repainted 85.3% of a player.
    //
    // Reporting a 78% signal against a 63% floor would have been reporting NOISE.
    // `CLAUDE.md` rule 10 says state the floor before acting on the number; here the floor
    // eats the number, so the number is PRINTED AND NOT ASSERTED. Deleting it would hide
    // that this instrument has a blind spot.
    //
    // The floating pill and the radar blip are two of concealment's three surfaces, and
    // `match.ts` drives BOTH from the same `fighterVisibleTo(state, observer, f)` call
    // that writes `model.root.visible`. They are per-slot DOM elements whose `display` is
    // exactly on or off — no noise floor exists. The third surface, the model itself, is
    // proven on PIXELS by `cw_conceal_view` at S/N 11.3× in a two-seat scene with nothing
    // else moving, which is where a pixel claim belongs.
    //
    // ⚠️ **AND A MISSING PILL IS AMBIGUOUS ON ITS OWN.** `projectToScreen` returns null for
    // an off-camera fighter too, so "no pill" means *concealed OR off screen*. It is
    // disambiguated with `__vfxDebugScreen.slots[i]`, which projects the GROUND POINT
    // regardless of visibility: non-null means the fighter is on camera, so a missing pill
    // there can only be concealment. Slots with no screen point are excluded and COUNTED.
    const onCamera = rows.filter((r) => r.screen !== null);
    if (onCamera.length === 0 && pitch !== SHIPPED_PITCH) {
      // 🚨 AT 20° NOTHING PROJECTS, AND THAT IS THE RIG BEING CORRECT, NOT A DEFECT.
      // `CameraRig` re-solves distance and look-ahead from the pitch (`fairSolveAt`), so a
      // 20° rig frames a different patch of ground than the 58° one, and
      // `match.ts:groundOnScreen` rejects every seat as outside NDC. This arm's job is the
      // LOOK — does the rack read as something you get under — which is a judgement on the
      // PNG. Required at the SHIPPED pitch, a printed SKIP elsewhere; deleting the
      // requirement everywhere would be turning a red gate green by removing the check.
      skip(`[${pitch}°] visibility arms`, `no seat projects at ${pitch}° — the rig re-solves `
        + `its framing from the pitch, so this arm is a LOOK at ${OUT}/p${pitch}-1-live.png`);
      summary.arms[pitch] = { region, R, rows, diff, drift, shots: { shot, driftShot, ctl }, skipped: true };
      await page.close();
      continue;
    }
    check(`[${pitch}°] NON-VACUITY: at least one non-local slot is ON CAMERA, so "no pill" `
      + `can be told apart from "off screen"`,
      onCamera.length > 0, `${onCamera.length} of ${rows.length} slots project`);
    const hid = onCamera.filter((r) => r.expectHidden);
    const vis = onCamera.filter((r) => !r.expectHidden);
    check(`[${pitch}°] NON-VACUITY: BOTH classes survived the on-camera filter`,
      hid.length > 0 && vis.length > 0,
      `${hid.length} expected-hidden · ${vis.length} expected-visible, on camera`);
    if (hid.length && vis.length) {
      check(`[${pitch}°] every EXPECTED-HIDDEN slot has NO floating pill and NO radar blip`,
        hid.every((r) => r.float === 'none' && r.radar === 'none'),
        hid.map((r) => `s${r.i} float=${r.float} radar=${r.radar}`).join(' · '));
      check(`[${pitch}°] 🚨 KNOWN-BAD: every EXPECTED-VISIBLE slot STILL HAS both — a `
        + `renderer that hid every in-region fighter, or hid everyone unconditionally, `
        + `passes the row above and fails this one`,
        vis.every((r) => r.float !== 'none' && r.radar !== 'none'),
        vis.map((r) => `s${r.i} float=${r.float} radar=${r.radar}`).join(' · '));
      check(`[${pitch}°] CONTROL: with the regions REMOVED, every hidden slot comes back`,
        hid.every((r) => all.slots[r.i].float !== 'none' && all.slots[r.i].radar !== 'none'),
        hid.map((r) => `s${r.i} float=${all.slots[r.i].float} radar=${all.slots[r.i].radar}`).join(' · '));
      check(`[${pitch}°] …and RESTORING them hides it again — not a one-way latch`,
        hid.every((r) => back.slots[r.i].float === 'none' && back.slots[r.i].radar === 'none'),
        hid.map((r) => `s${r.i} float=${back.slots[r.i].float} radar=${back.slots[r.i].radar}`).join(' · '));
    }
    check(`[${pitch}°] ⚠️ ASYMMETRY: the LOCAL seat, standing INSIDE a region, keeps its own `
      + `pill — hiding "the concealed fighter" instead of "the opponent, from this viewer" `
      + `would delete your own character`,
      live.slots[0].inRegion && live.slots[0].float !== 'none',
      `inRegion=${live.slots[0].inRegion} float=${live.slots[0].float}`);

    console.log(`     pixel diff, REPORTED AND NOT ASSERTED (floor ≈ signal, see the note above):`);
    console.log('      ' + rows.map((r) => {
      const k = `s${r.i}`;
      return `s${r.i} Δ${diff[k] ? diff[k].pct.toFixed(0) : 'n/a'}%/drift${drift[k] ? drift[k].pct.toFixed(0) : 'n/a'}%`;
    }).join('  '));
    summary.arms[pitch] = { region, R, rows, diff, drift, shots: { shot, driftShot, ctl } };
    await page.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/cn_shot.json`, JSON.stringify(summary, null, 2));
console.log(`\nshots -> ${OUT}`);
console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);
process.exit(fail === 0 ? 0 : 1);
