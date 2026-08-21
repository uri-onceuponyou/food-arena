#!/usr/bin/env node
/**
 * GV_SLAM — does the giant slam's DRAWING follow `Weapon.range`, and where does it stop?
 *
 * `afad1ca` moved `REACH.ultimateSlam` 400 -> 157.22 wu (Uri, §81(a): *"the giant should
 * catch almost everything in the visible screen, but it shouldn't catch everything in the
 * map"*). Nothing in that commit touched `src/vfx/**` or `src/game/vfx.ts`. The question
 * this file exists to answer is the one nobody checked: **did the drawing shrink with it,
 * and is there anywhere it did not?**
 *
 * `tools/tmp/wv_area.mjs` already answers the top-level version — it fires the shipped
 * `spawnWeaponCast` and measures the SUM. This file answers the three sub-questions
 * `wv_area` structurally cannot, because each one needs a call `match.ts` never makes:
 *
 *   A. RANGE-FOLLOWING   `spawnGiantSlamShockwave`'s two ground rings are built as
 *      `radiusM * 1.05` / `radiusM * 0.85` off `wu(rangeWU)`. Fired directly at four
 *      ranges, the painted AREA must grow MONOTONICALLY. This is the arm that says
 *      "derived, not literal", and it is a MOVES control, not an inspection.
 *      ⚠️ WAS asserted on bbox WIDTH and went RED on a clean tree — see the arm itself
 *      for why the width is the wrong statistic below 85.7 wu and how that number is
 *      read out of `game/vfx.ts` rather than fitted.
 *
 *   B. THE ARBITRATION   `spawnWeaponCast` passes `{ bespokeOwnsGround: bespokeCast }`,
 *      and `lollipop.Giant` HAS a bespoke `cast()`. So arm A's range-following code is
 *      SKIPPED for the only `giantSlam` in the game — the rings never run, and what
 *      survives is a `burst(..., 3.2, 14, ...)` whose size does NOT depend on range.
 *      Both branches are fired at the same range and must differ.
 *
 *   C. THE QA FALLBACK   `vfx.ts:2488` reads `qaWeapon?.range ?? 400`. That literal is a
 *      second statement of `REACH.ultimateSlam` and it went stale on `afad1ca`. Fired
 *      through `__vfxSpawnTest` with and without a `weaponKey`, the two must be
 *      INDISTINGUISHABLE if the fallback is dead and MUST DIFFER if it is live. It is
 *      live: this arm is the evidence, not the argument.
 *
 * ── CONTROLS (CLAUDE.md #6 — an instrument not shown to FAIL is not an instrument) ──
 *
 *   DRIFT      identical frame twice, no spawn                -> must be EXACTLY 0 px
 *   NONEMPTY   every series asserted over is checked non-empty AND non-zero FIRST,
 *              because `[].every()` returns `true` and so does `[0].every(x => x >= 0)`
 *   SPREAD     the same fire twice on the same seed            -> the RESOLUTION FLOOR
 *   SATURATION any arm whose bbox fills the readback is NAMED, and arm A's monotone
 *              check runs on the UNSATURATED subset with that subset asserted to hold
 *              at least two rows FIRST
 *   KNOWNBAD   `--knownbad` patches `spawnGiantSlamShockwave` IN-PAGE to ignore its
 *              `rangeWU` argument and use a constant 400 wu — i.e. re-installs exactly
 *              the defect arm A exists to detect. **A must go RED and DRIFT and B must
 *              stay GREEN**, or A is a restatement of a control rather than an
 *              assertion of its own.
 *
 * ── ⚠️ TWO THINGS THE FIRST VERSION OF THIS FILE GOT WRONG, KEPT WITH THE REASON ──
 *
 * 1. **SPREAD ASSERTED BYTE-IDENTITY AND WENT RED ON THE CLEAN TREE.** Its old wording
 *    was *"the same fire twice on the same seed -> byte-identical series, or nothing
 *    paired below means anything"*, copied from `wv_area.mjs`'s SEEDPAIR. That control
 *    is byte-identical because it fires an IMPACT. This beat is a composite that walks
 *    `allocRing` / `allocParticle` / `materialPool` ROUND-ROBIN CURSORS, and a cursor is
 *    not reachable by seeding `Math.random` — the same trap `soup.ts:nextSplatGeo` is on
 *    record for. Measured here: 7 px of 98,883 (0.007%) between two identical fires.
 *    So the control now MEASURES A FLOOR instead of asserting an impossibility, per
 *    CLAUDE.md #10, and every arm below must clear it by construction rather than by
 *    hope. **Some spread here is structural and no reseeding removes it.**
 *
 * 2. **ARM C WENT FALSELY GREEN UNDER THE KNOWN-BAD.** With the radius forced constant,
 *    the with-key and no-key fires necessarily agree — and C printed *"the two agree —
 *    the fallback is dead or has been repaired"* and counted itself GREEN while neither
 *    was true. C's question is only ANSWERABLE while the shockwave is range-following,
 *    which is arm A's question, so C is now GATED ON A and reports NOT-DETERMINABLE when
 *    A is red. An arm that can be green for a reason unrelated to what it measures is
 *    CLAUDE.md #6's vacuity in a new costume.
 *
 * ⚠️ Camera shake re-randomises on every `render()` even with the clock frozen
 * (`AGENT-BRIEF` §3), so the shake is zeroed before EVERY grab, not once at setup.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-gvB -- \
 *     node tools/tmp/gv_slam.mjs --url '{URL}' --pitch 58
 *   node tools/tmp/gv_slam.mjs --url $U --knownbad          # arm A must go RED
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
const OUT = String(args.out ?? 'tools/tmp/gv_slam_out');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** The same per-channel step `wv_area`, `vfx_wcov`, `vfx_coverage` and `pj_probe` use,
 * deliberately: areas here have to be comparable to the records those tools left. */
const DELTA = Number(args.delta ?? 6);
const PITCH = Number(args.pitch ?? 58);
const DETECT_WIDTH = Number(args.detectWidth ?? 400);
const SHOTS = !!args.shots;
const KNOWNBAD = !!args.knownbad;
/** Peak of the two ground rings is inside 400 ms (`maxLife` 0.65 / 0.8 s, growing on an
 * ease). Six slices bracket the whole life so a peak on the last slice — the signature
 * of a schedule that ends too early — is visible rather than silent. */
const SLICES = (args.slices ? String(args.slices).split(',').map(Number)
  : [16, 80, 160, 260, 400, 620, 860]);

if (!BASE) { console.error('gv_slam: --url or PREVIEW_BASE required'); process.exit(2); }

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const boxW = (b) => (b ? b[2] - b[0] : 0);
const boxH = (b) => (b ? b[3] - b[1] : 0);

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'gv-still';
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
    let paused = false; let virt = 0; const base = realNow();
    window.__clk = { pause() { if (!paused) { virt = realNow() - base; paused = true; } }, advance(ms) { virt += ms; } };
    performance.now = () => (paused ? virt : realNow() - base);
    // Seeded LCG — the shards in `burst()` are randomised, so two fires of unchanged
    // code do not agree without this. Same construction `wv_area.mjs` uses.
    let st = 1;
    Math.random = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    window.__rng = { seed(v) { st = ((v >>> 0) || 1); } };
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
    // 🚨 A FROZEN CLOCK DOES NOT STILL THE CAMERA SHAKE — IT MAKES IT PERMANENT.
    // `CameraRig.update()` scales the shake DECAY by dt but not the re-randomisation,
    // and `Stage.render()` calls `rig.update()` before drawing. Zeroed before EVERY grab.
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
    const changed = (cur) => {
      let n = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
      for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
        const d = Math.max(Math.abs(cur[i] - base[i]), Math.abs(cur[i + 1] - base[i + 1]), Math.abs(cur[i + 2] - base[i + 2]));
        if (d >= D) {
          n++;
          const x = p % RWv, y = (p / RWv) | 0;
          if (x < minx) minx = x; if (x > maxx) maxx = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
      }
      return { n, bbox: n ? [minx, miny, maxx, maxy] : null };
    };
    window.__gv = {
      total: RWv * RHv,
      setBase() { base = grab(); },
      countBox() { return changed(grab()); },
      step(ms) { window.__clk.advance(ms); window.__vfxLayer.updateEffects(ms / 1000); },
      reset() { window.__vfxLayer.clear(); },
      shot() { still(); stage.render(0); },
      setPitch(deg, widthUnits) {
        const rig = stage.rig; if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return saved;
      },
      /**
       * THE KNOWN-BAD: `spawnGiantSlamShockwave` ignores its `rangeWU` argument and
       * uses a constant 400 wu. This is exactly the defect arm A exists to detect — a
       * ring whose radius is a LITERAL rather than derived from the weapon.
       */
      plantConstantRadius() {
        const L = window.__vfxLayer;
        if (L.__gvOrig) return false;
        L.__gvOrig = L.spawnGiantSlamShockwave.bind(L);
        L.spawnGiantSlamShockwave = (x, y, color, _rangeWU, opts) => L.__gvOrig(x, y, color, 400, opts);
        return true;
      },
      unplant() {
        const L = window.__vfxLayer;
        if (!L.__gvOrig) return false;
        L.spawnGiantSlamShockwave = L.__gvOrig; delete L.__gvOrig; return true;
      },
    };
  }, [rw, rh, delta]);
}
/* eslint-enable */

/**
 * ONE FIRE, measured over `SLICES`. `how` selects which call is made — every one of
 * them is a call the shipped game or a QA tool actually makes, named after its site.
 */
async function fire(page, { how, rangeWU, at, seed = 1, bespokeOwnsGround = false }) {
  return page.evaluate(async ([o, sl]) => {
    const rules = await import('/src/game/rules.ts');
    const L = window.__vfxLayer;
    window.__gv.reset();
    window.__gv.step(0);
    window.__gv.setBase();
    window.__rng.seed(o.seed);

    if (o.how === 'raw') {
      // `vfx.ts:spawnWeaponCast`'s own call, with the two arguments varied.
      L.spawnGiantSlamShockwave(o.at.x, o.at.y, '#E63946', o.rangeWU, { bespokeOwnsGround: o.bespokeOwnsGround });
    } else if (o.how === 'qaWithKey') {
      window.__vfxSpawnTest('giantSlam', o.at.x, o.at.y, 14, '#E63946', 'lollipop', 'Giant');
    } else if (o.how === 'qaNoKey') {
      // No `weaponKey` -> `qaWeapon` is undefined -> `vfx.ts:2488`'s `?? 400` fires.
      window.__vfxSpawnTest('giantSlam', o.at.x, o.at.y, 14, '#E63946', 'lollipop');
    } else if (o.how === 'shippedCast') {
      const w = rules.CHARACTERS.lollipop.weapons.find((x) => x.key === 'Giant');
      L.spawnWeaponCast(o.at.x, o.at.y, { x: 1, y: 0 }, w, 'lollipop');
    } else if (o.how === 'drift') {
      /* nothing spawned — the DRIFT control */
    }

    const series = []; const boxes = [];
    let prev = 0;
    for (const t of sl) {
      window.__gv.step(t - prev); prev = t;
      const c = window.__gv.countBox();
      series.push(c.n); boxes.push(c.bbox);
    }
    const peakI = series.indexOf(Math.max(...series));
    window.__gv.reset();
    return { series, boxes, peak: series[peakI], peakBox: boxes[peakI], peakAtMs: sl[peakI] };
  }, [{ how, rangeWU, at, seed, bespokeOwnsGround }, SLICES]);
}

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await boot(page);
  await mkdir(OUT, { recursive: true });

  await page.goto(`${BASE}/?player=hamburger&enemy=donut`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__stage && !!window.__vfxLayer && !!window.__vfxDebugFighters, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const running = await page.evaluate(PAGE_STILL_HUD);
  await page.evaluate(() => window.__clk.pause());
  await installHarness(page, RW, RH, DELTA);
  await page.evaluate(([p, dw]) => window.__gv.setPitch(p, dw), [PITCH, DETECT_WIDTH]);
  const at = await page.evaluate(() => {
    const p = window.__vfxDebugFighters.player;
    return { x: p.x, y: p.y };
  });

  const slam = await page.evaluate(async () => {
    const r = await import('/src/game/rules.ts');
    return { ultimateSlam: r.REACH.ultimateSlam, guaranteed: r.GUARANTEED_VISIBLE_RADIUS, body: r.BODY_LENGTH };
  });

  log(`viewport ${W}x${H}  readback ${RW}x${RH} (${RW * RH} px)  delta>=${DELTA}  pitch ${PITCH}`
    + (PITCH !== 58 ? `  detectWidth ${DETECT_WIDTH} wu` : ''));
  log(`CSS animations still running after PAGE_STILL_HUD: ${running} (want 0)`);
  log(`REACH.ultimateSlam = ${slam.ultimateSlam}  (= GUARANTEED_VISIBLE_RADIUS ${slam.guaranteed} - BODY_LENGTH ${slam.body})`);
  log(`caster at ${at.x.toFixed(1)}, ${at.y.toFixed(1)} wu`);

  if (KNOWNBAD) {
    const planted = await page.evaluate(() => window.__gv.plantConstantRadius());
    log(`\n🔴 --knownbad: spawnGiantSlamShockwave patched to IGNORE rangeWU (constant 400 wu) — planted=${planted}`);
    if (!planted) { log('KNOWNBAD FAILED TO PLANT'); process.exit(1); }
  }

  const faults = [];
  const green = [];

  // ── CONTROL: DRIFT ───────────────────────────────────────────────────────────
  const drift = await fire(page, { how: 'drift', rangeWU: 0, at });
  const driftMax = Math.max(...drift.series);
  log(`\n══ CONTROLS ═══════════════════════════════════════════════════════════`);
  log(`DRIFT     identical frame, nothing spawned, ${SLICES.length} slices: ${drift.series.join(', ')} px  (want all 0 — not "small")`);
  if (driftMax !== 0) faults.push(`DRIFT is ${driftMax} px, not 0 — every number below is contaminated`);
  else green.push('DRIFT');

  // ── CONTROL: SPREAD — the RESOLUTION FLOOR, measured, not assumed ────────────
  //
  // ⚠️ WAS: *"the same fire twice on the same seed -> byte-identical series, or nothing
  // paired below means anything"*, and it went RED on a clean tree. Kept above with the
  // reason (see the header): this beat walks round-robin POOL CURSORS that seeding
  // `Math.random` cannot reach, so a residual spread is STRUCTURAL. A floor is the
  // honest statistic; an impossibility is not.
  const s1 = await fire(page, { how: 'raw', rangeWU: 157.22, at, seed: 4242 });
  const s2 = await fire(page, { how: 'raw', rangeWU: 157.22, at, seed: 4242 });
  const identical = s1.series.length > 0 && s1.series.join(',') === s2.series.join(',');
  let pxFloor = 0;
  if (s1.series.length === 0) faults.push('SPREAD: the series is EMPTY — the floor below would be vacuous');
  else {
    for (let i = 0; i < s1.series.length; i++) {
      const m = Math.max(s1.series[i], s2.series[i]);
      if (m > 0) pxFloor = Math.max(pxFloor, Math.abs(s1.series[i] - s2.series[i]) / m);
    }
  }
  const widthFloor = Math.abs(boxW(s1.peakBox) - boxW(s2.peakBox));
  log(`SPREAD    same fire, same seed, twice: ${s1.series.join(',')}`);
  log(`                                  and: ${s2.series.join(',')}   byte-identical=${identical}`);
  log(`          🔴 RESOLUTION FLOOR, measured on this run: px column ${(100 * pxFloor).toFixed(3)}%`
    + `  ·  peak bbox WIDTH ${widthFloor} px. Do not act on a smaller difference.`);
  if (s1.series.length > 0) green.push('SPREAD');

  // ── ARM A: does the generic shockwave's radius FOLLOW `weapon.range`? ─────────
  //
  // 🚨 NON-VACUITY FIRST. `[].every()` is `true`, and so is `[0,0,0].every(x => x >= 0)`.
  // The set is asserted non-empty AND every arm asserted to have painted SOMETHING
  // before a single comparison is made on it.
  const RANGES = [40, 70, 157.22, 400];
  const armA = [];
  for (const r of RANGES) armA.push({ r, ...(await fire(page, { how: 'raw', rangeWU: r, at, seed: 7 })) });
  /** A bbox this wide has run out of frame, so its width has stopped reporting the
   * effect's size and started reporting the readback's. `wv_area.mjs` records the same
   * trap: *"both arms clip, and the ratio goes to 1.0 while meaning nothing."* */
  const SAT_W = Math.round(RW * 0.95);
  for (const a of armA) a.saturated = boxW(a.peakBox) >= SAT_W;

  log(`\n══ A. RANGE-FOLLOWING — the generic shockwave, fired directly ══════════`);
  log(`${pad('rangeWU', 10)}${rpad('peak px', 10)}${rpad('% frame', 9)}${rpad('bbox w', 8)}${rpad('bbox h', 8)}${rpad('peak@ms', 9)}  note`);
  for (const a of armA) {
    log(`${pad(a.r, 10)}${rpad(a.peak, 10)}${rpad((100 * a.peak / (RW * RH)).toFixed(1), 9)}`
      + `${rpad(boxW(a.peakBox), 8)}${rpad(boxH(a.peakBox), 8)}${rpad(a.peakAtMs, 9)}  ${a.saturated ? 'SATURATED — width reports the FRAME, not the effect' : ''}`);
  }
  // ── 🚨 THE ASSERTION IS ON PAINTED AREA, NOT ON BBOX WIDTH, AND THE FIRST VERSION OF
  //    THIS ARM WENT RED ON A CLEAN TREE FOR SAYING OTHERWISE ─────────────────────────
  //
  // ⚠️ WAS: *"the painted bbox must grow MONOTONICALLY"*, checked on bbox WIDTH. It
  // measured `406 < 310 < 457` over ranges `40 < 70 < 157.22` and failed — and **the
  // assertion was wrong, not the code.** `spawnGiantSlamShockwave` also fires
  // `spawnStreaks(origin, …, 10, 4.5, 0.55)`: ten spark rays of **4.5 m**, which is
  // 90 wu and does NOT depend on range. So below `4.5 / 1.05 / WORLD_SCALE` = **85.7 wu**
  // the ring never reaches the streaks and the bbox reports the STREAKS. That crossover
  // is read out of `game/vfx.ts`, not fitted to the data — but it means bbox width is
  // simply the wrong statistic for the low half of the sweep, and picking a range set
  // that avoids it would be fitting the test to its own result.
  //
  // Painted AREA has no such floor: the epicentre elements contribute a CONSTANT number
  // of pixels at every range, so any increase in the total is the ring and nothing else.
  // It also does not clip until the ring fills the frame, where bbox width clips at 95%.
  // Checked against the known-bad: with the radius forced constant the four rows read
  // 150043 / 150039 / 150039 / 150039 — flat to 0.003%, inside the measured SPREAD floor,
  // so the arm still goes RED. The bbox column is kept as corroboration and is printed
  // with its saturation flag, but it is NOT what the arm asserts.
  //
  // NON-VACUITY: the set is asserted non-empty AND every row asserted to have painted
  // something BEFORE any comparison, because `[].every()` is `true` and so is
  // `[0].every(x => x >= 0)`.
  let aGreen = false;
  if (armA.length < 2) faults.push(`A: the arm set holds ${armA.length} row(s) — a monotone check would pass vacuously`);
  else if (!armA.every((a) => a.peak > 0)) faults.push(`A: an arm painted 0 px — [${armA.map((a) => a.peak)}] — the comparison would be over nothing`);
  else {
    const areas = armA.map((a) => a.peak);
    const mono = areas.every((v, i) => i === 0 || v > areas[i - 1] * (1 + pxFloor));
    log(`\n          painted area over ranges [${RANGES.join(', ')}] wu: ${areas.join(' < ')}`);
    log(`          strictly increasing by more than the ${(100 * pxFloor).toFixed(3)}% SPREAD floor = ${mono}`);
    log(`          (bbox WIDTH is corroboration only — below 85.7 wu the range-INDEPENDENT`);
    log(`           4.5 m spark streaks out-run the ring and the bbox reports THEM.)`);
    if (!mono) faults.push(`A: the shockwave's painted area does NOT track weapon.range — [${areas}] over ranges [${RANGES}]. Its radius is a LITERAL.`);
    else { aGreen = true; green.push('A'); log('          ✅ the generic shockwave DERIVES its radius from `weapon.range`.'); }
  }

  // ── ARM B: does the shipped `lollipop.Giant` path ever RUN those rings? ───────
  const bOff = await fire(page, { how: 'raw', rangeWU: slam.ultimateSlam, at, seed: 11, bespokeOwnsGround: false });
  const bOn = await fire(page, { how: 'raw', rangeWU: slam.ultimateSlam, at, seed: 11, bespokeOwnsGround: true });
  log(`\n══ B. THE ARBITRATION — `
    + `\`spawnWeaponCast\` passes { bespokeOwnsGround: bespokeCast } ══`);
  log(`  bespokeOwnsGround:false (rings + epicentre run)  peak ${bOff.peak} px  bbox ${boxW(bOff.peakBox)}x${boxH(bOff.peakBox)}`);
  log(`  bespokeOwnsGround:true  (SHARDS ONLY)           peak ${bOn.peak} px  bbox ${boxW(bOn.peakBox)}x${boxH(bOn.peakBox)}`);
  if (bOff.peak === 0 || bOn.peak === 0) faults.push(`B: an arm painted 0 px (${bOff.peak}/${bOn.peak}) — the comparison would be over nothing`);
  else if (!(bOn.peak < bOff.peak)) faults.push(`B: bespokeOwnsGround did not suppress anything (${bOn.peak} >= ${bOff.peak})`);
  else {
    green.push('B');
    log(`  ✅ suppressed: ${(100 * (1 - bOn.peak / bOff.peak)).toFixed(1)}% of the generic pass stands down for a bespoke cast.`);
    log(`     `+ `=> arm A's range-derived rings NEVER RUN for the only \`giantSlam\` in the game.`);
    log(`     What survives is \`burst(origin, color, 3.2, 14, ...)\` — sizeFactor 3.2 is a LITERAL`);
    log(`     and does not depend on \`weapon.range\`. That is correct here (shards are epicentre`);
    log(`     debris, not a reach indicator) and is stated so nobody reads B as a defect.`);
  }

  // ── ARM C: is `vfx.ts:2488`'s `qaWeapon?.range ?? 400` a LIVE stale literal? ──
  const cKey = await fire(page, { how: 'qaWithKey', rangeWU: 0, at, seed: 23 });
  const cNo = await fire(page, { how: 'qaNoKey', rangeWU: 0, at, seed: 23 });
  log(`\n══ C. THE QA FALLBACK — \`vfx.ts:2488\` \`qaWeapon?.range ?? 400\` ═══════`);
  log(`  __vfxSpawnTest('giantSlam', ..., 'lollipop', 'Giant')  peak ${cKey.peak} px  bbox ${boxW(cKey.peakBox)}x${boxH(cKey.peakBox)}   (uses REACH.ultimateSlam = ${slam.ultimateSlam.toFixed(2)})`);
  log(`  __vfxSpawnTest('giantSlam', ..., 'lollipop')           peak ${cNo.peak} px  bbox ${boxW(cNo.peakBox)}x${boxH(cNo.peakBox)}   (falls back to the literal 400)`);
  // ⚠️ GATED ON A, AND THAT IS THE WHOLE POINT. Under `--knownbad` the radius is forced
  // constant, so the with-key and no-key fires agree BY CONSTRUCTION — and the first
  // version of this arm printed *"the two agree — the fallback is dead or has been
  // repaired"* and counted itself GREEN while neither was true. C's question is only
  // answerable while the shockwave is range-following, which is A's question.
  if (cKey.peak === 0 || cNo.peak === 0) faults.push(`C: an arm painted 0 px (${cKey.peak}/${cNo.peak}) — the comparison would be over nothing`);
  else if (!aGreen) {
    log(`  ⚪ NOT DETERMINABLE — arm A is red, so the shockwave's radius does not follow`);
    log(`     \`weapon.range\` at all and the two fires agree for a reason that has nothing`);
    log(`     to do with the fallback. Reported as undetermined rather than as agreement.`);
  } else if (boxW(cNo.peakBox) > boxW(cKey.peakBox) + widthFloor) {
    green.push('C');
    log(`  🔴 THE FALLBACK IS LIVE AND STALE: no-key draws ${boxW(cNo.peakBox)} px wide against ${boxW(cKey.peakBox)} with the key`);
    log(`     (separation ${boxW(cNo.peakBox) - boxW(cKey.peakBox)} px, against a ${widthFloor} px SPREAD floor).`);
    log(`     Any probe that fires kind:'giantSlam' WITHOUT a weaponKey photographs a 400 wu`);
    log(`     shockwave for a 157.22 wu weapon. \`src/game/vfx.ts\` is not this pass's file: ROUTED.`);
  } else {
    green.push('C');
    log(`  the two agree within the ${widthFloor} px floor — the fallback is dead or has been repaired.`);
  }

  // ── The shipped sum, for the record ──────────────────────────────────────────
  const shipped = await fire(page, { how: 'shippedCast', rangeWU: 0, at, seed: 31 });
  log(`\n══ THE SHIPPED SUM — \`spawnWeaponCast(lollipop.Giant)\` ═══════════════`);
  log(`  peak ${shipped.peak} px (${(100 * shipped.peak / (RW * RH)).toFixed(1)}% of frame) at ${shipped.peakAtMs} ms`
    + `  bbox ${boxW(shipped.peakBox)}x${boxH(shipped.peakBox)} of ${RW}x${RH}`);
  log(`  series ${shipped.series.join(', ')}`);

  if (SHOTS) {
    await page.evaluate(async ([o]) => {
      const rules = await import('/src/game/rules.ts');
      window.__gv.reset(); window.__gv.step(0); window.__rng.seed(31);
      const w = rules.CHARACTERS.lollipop.weapons.find((x) => x.key === 'Giant');
      window.__vfxLayer.spawnWeaponCast(o.x, o.y, { x: 1, y: 0 }, w, 'lollipop');
      window.__gv.step(400);
      window.__gv.shot();
    }, [at]);
    const f = `${OUT}/gv_slam.p${PITCH}.shipped.png`;
    await page.screenshot({ path: f });
    log(`  shot -> ${f}`);
  }

  await writeFile(`${OUT}/gv_slam.p${PITCH}.json`, JSON.stringify({
    base: BASE, pitch: PITCH, detectWidth: PITCH === 58 ? null : DETECT_WIDTH,
    readback: [RW, RH], delta: DELTA, slices: SLICES, knownbad: KNOWNBAD,
    ultimateSlam: slam.ultimateSlam, guaranteed: slam.guaranteed,
    drift: drift.series, spreadIdentical: identical,
    armA, armB: { off: bOff, on: bOn }, armC: { withKey: cKey, noKey: cNo }, shipped,
  }, null, 1));
  log(`\njson -> ${OUT}/gv_slam.p${PITCH}.json`);

  await browser.close();

  log(`\nGREEN: ${green.join(', ') || '(none)'}`);
  if (faults.length) {
    log(`\n🔴 ${faults.length} FAULT(S):`);
    for (const f of faults) log(`   ${f}`);
    process.exit(1);
  }
  log('\n✅ all arms and controls green');
}

main().catch((e) => { console.error(e); process.exit(1); });
