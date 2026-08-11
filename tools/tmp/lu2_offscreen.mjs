#!/usr/bin/env node
/**
 * lu2_offscreen.mjs — IS A FLOATING HP PILL EVER DRAWN FOR A FIGHTER WHO IS NOT IN FRAME?
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 * `hud.ts:updateFloatingBars` CLAMPS a pill's position into the viewport rather than
 * hiding it, and `spawnDamageNumber` shares the clamp. That clamp is correct for the
 * case its own comment describes — a fighter above the top of the frame, where their HP
 * matters most — and at TWO seats that is the only case it can ever see, because the
 * opponent is nearly always on screen or dead.
 *
 * At SIX seats it becomes a permanent free read on every opponent's HP and BEARING: the
 * six-player acceptance pass measured 63.7-82.9% of drawn opponent pills belonging to a
 * fighter whose projected point was outside a 1280x720 viewport, at a mean separation of
 * 1 534 wu (max 2 470) against a guaranteed view radius of 199.2 wu. That undoes the fog
 * of war and the concealment feature (`DECISIONS §29c`) at the same time.
 *
 * ── WHAT THIS ASSERTS, AND WHY IT IS NOT TAUTOLOGICAL ───────────────────────
 * For every seat it reads THREE independent things and cross-checks them:
 *   * the fighter's world position, from the sim (`__vfxDebugFighters`);
 *   * whether that fighter's GROUND point is inside the camera frustum, computed in the
 *     page from the live camera — not from the HUD, and not from the same code the fix
 *     touches;
 *   * whether the pill element is actually displayed, from `getComputedStyle`.
 * The assertion is the implication `pill displayed => ground point on screen`. An
 * implementation that hid EVERY pill would pass that vacuously, so a second row requires
 * the local seat's own pill to be drawn, and a third requires at least one opponent to be
 * off screen — i.e. that the scenario can express the bug at all (`CLAUDE.md` §6: a
 * control placed where the bug cannot express itself is not a control).
 *
 * ── KNOWN-BAD ──────────────────────────────────────────────────────────────
 * The known-bad is not synthesised: it is the UNFIXED TREE. Run it on both.
 *   node tools/tmp/headserve.mjs --ref <sha> -- node tools/tmp/lu2_offscreen.mjs
 *       -> must FAIL
 *   node tools/tmp/headserve.mjs --ref <sha> --overlay src/game/match.ts -- node tools/tmp/lu2_offscreen.mjs
 *       -> must PASS
 * `--expect-fail` inverts the exit code so the unfixed arm can be scripted.
 *
 *   node tools/tmp/lu2_offscreen.mjs --selftest
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const EXPECT_FAIL = has('--expect-fail');

/** The verdict, kept out of the browser so it can be selftested offline. */
export function verdict(seats) {
  const drawn = seats.filter((s) => s.pillShown);
  const leaks = drawn.filter((s) => !s.local && !s.onScreen);
  const offScreenOpponents = seats.filter((s) => !s.local && s.alive && !s.onScreen);
  return {
    leaks,
    drawn: drawn.length,
    offScreenOpponents: offScreenOpponents.length,
    localDrawn: seats.some((s) => s.local && s.pillShown),
  };
}

function selftest() {
  let pass = 0, fail = 0;
  const t = (name, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };
  const local = { local: true, alive: true, onScreen: true, pillShown: true };
  const near = { local: false, alive: true, onScreen: true, pillShown: true };
  const farDrawn = { local: false, alive: true, onScreen: false, pillShown: true };
  const farHidden = { local: false, alive: true, onScreen: false, pillShown: false };

  t('a pill over an ON-screen opponent is not a leak', verdict([local, near]).leaks.length === 0);
  t('a pill over an OFF-screen opponent IS a leak', verdict([local, farDrawn]).leaks.length === 1);
  t('an off-screen opponent with no pill is not a leak', verdict([local, farHidden]).leaks.length === 0);
  t('the LOCAL seat is never a leak, even if its own point leaves the frame',
    verdict([{ ...local, onScreen: false }]).leaks.length === 0);
  // 🚨 THE TWO ROWS THAT STOP THIS BEING PASSABLE BY HIDING EVERYTHING, AND THE ONE THAT
  // STOPS IT BEING PASSABLE BY A SCENARIO WHERE THE BUG CANNOT HAPPEN.
  t('hiding every pill is caught by the local-seat row', verdict([{ ...local, pillShown: false }]).localDrawn === false);
  t('a scenario with no off-screen opponent is reported as such, not as a pass',
    verdict([local, near]).offScreenOpponents === 0);
  t('a scenario WITH one is counted', verdict([local, farHidden]).offScreenOpponents === 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

if (has('--selftest')) selftest();

/**
 * The fixture: six seats on the shipped 2800x2000 map, spread on a 900 wu ring about the
 * real centre. ⚠️ THE CENTRE IS 1400,1000 AND IS WRITTEN OUT RATHER THAN COPIED — the
 * ×4 map left `np_nfighter` and `h49_chips` holding a stale `{700,500}`, which cost a
 * false failure elsewhere in this session. 900 wu is above the 892 wu minimum pairwise
 * separation the shipped six-seat layout achieves, so this is not a harder case than the
 * real one; it is the same case, placed deterministically.
 */
const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'pizza'];
const RING = 900;
const roster = CAST.map((id, i) => {
  const a = (i / CAST.length) * Math.PI * 2;
  return `${id}@${Math.round(1400 + Math.cos(a) * RING)},${Math.round(1000 + Math.sin(a) * RING)}`;
}).join(';');

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${BASE}/?screen=match&fighters=${roster}&pointerLock=0&fogRadius=1600&simSpeed=0.05`,
  { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120_000 });
await page.waitForTimeout(1500);

const seats = await page.evaluate(`(() => {
  const st = (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
  const cam = st.rig.camera;
  const dbg = window.__vfxDebugFighters;
  const slots = dbg.slots || [dbg.player, dbg.enemy];
  const V = Object.getPrototypeOf(cam.position).constructor;
  const v = new V();
  const S = 0.05;                       // world units -> metres, the same scale groundPos uses
  const me = slots[0];
  const pills = [...document.querySelectorAll('.hud-float')];
  return slots.map((f, i) => {
    // The frustum test, computed HERE from the live camera — deliberately not from the
    // module under test, so the assertion has two independent sources.
    v.set(f.x * S, 0, f.y * S).project(cam);
    const el = pills[i];
    const cs = el ? getComputedStyle(el) : null;
    return {
      i,
      local: i === 0,
      alive: !!f.alive,
      x: f.x, y: f.y,
      distWu: Math.hypot(f.x - me.x, f.y - me.y),
      ndc: { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) },
      onScreen: v.z <= 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
      pillShown: !!cs && cs.display !== 'none' && cs.visibility !== 'hidden',
      transform: el ? el.style.transform : null,
    };
  });
})()`);
await browser.close();

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

console.log(`\nlu2_offscreen — ${BASE}  (six seats, 1280x720)\n`);
for (const s of seats) {
  console.log(`  slot ${s.i}${s.local ? ' (LOCAL)' : '       '}  at (${Math.round(s.x)},${Math.round(s.y)})  `
    + `${Math.round(s.distWu).toString().padStart(5)} wu away   ndc ${JSON.stringify(s.ndc)}   `
    + `onScreen=${String(s.onScreen).padEnd(5)}  pill=${s.pillShown}`);
}
console.log('');

const v = verdict(seats);
check('no JS exception', errors.length === 0, errors.slice(0, 2).join(' | '));
// The scenario check FIRST: a green below is worthless if this one is 0.
check(`the scenario can express the bug — ${v.offScreenOpponents} living opponent(s) are off screen`,
  v.offScreenOpponents > 0, 'every opponent is in frame, so nothing here can distinguish clamp from hide');
check('the LOCAL seat still draws its own pill (hiding everything would be a false pass)', v.localDrawn);
check(`no HP pill is drawn for an off-screen opponent (${v.leaks.length} leak(s))`, v.leaks.length === 0,
  v.leaks.map((s) => `slot ${s.i} at ${Math.round(s.distWu)} wu, ndc ${JSON.stringify(s.ndc)}, transform ${s.transform}`).join('\n         '));

console.log(`\n${pass} passed, ${fail} failed`);
if (EXPECT_FAIL) {
  console.log(fail > 0 ? '  (--expect-fail: the known-bad arm FAILED as required)' : '  🚨 (--expect-fail: it PASSED — this arm is not the known-bad)');
  process.exit(fail > 0 ? 0 : 1);
}
process.exit(fail ? 1 : 0);
