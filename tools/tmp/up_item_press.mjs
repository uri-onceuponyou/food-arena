#!/usr/bin/env node
/**
 * DOES A PRESS REACH THE SIM? — the end-to-end arm of the item-button pass.
 *
 * `up_item_hud.mjs` measures what the buttons SAY. This measures whether pressing one
 * does anything, on the only observable a player has: the sim's own cooldown.
 *
 * ── WHY THE COOLDOWN IS THE RIGHT OBSERVABLE ────────────────────────────────
 * `Fighter.item.lastUsed[slot]` is written in exactly ONE place — `combat.ts:attemptItem`,
 * after `itemUsable` has accepted the press — and `ui/hud.ts` renders the remaining time
 * off it. So a slot that flips from `is-ready` to `is-cooling` with a counting badge is
 * proof of the WHOLE chain: key or finger → `input.ts:pressItem` → `match.ts:buildInput`
 * → `MatchInput.useItem` → `sim.ts` → `attemptItem` → `lastUsed` → the button. Nothing
 * short of the sim accepting the press can produce it, which is what makes it an
 * observable rather than an instrumentation field this pass added to measure itself
 * (`docs/AGENT-BRIEF.md` §4b: *"measure the observable, not the field you added"*).
 *
 * ── 🔴 ON HEAD THIS TOOL IS EXPECTED TO FAIL, AND `--expect-dead` SAYS SO ────
 * `game/match.ts` belongs to another owner this run. Two lines there are the last hop:
 *
 *     onSelectWeapon: (index) => this.input.selectWeapon(index),
 *   +  onUseItem: (slot) => this.input.pressItem(slot),
 *
 *   - return { move, aim, selectedWeapon: this.input.selectedWeapon, attack };
 *   + return { move, aim, selectedWeapon: this.input.selectedWeapon, attack,
 *   +   useItem: playing ? this.input.takeItemPress() : null };
 *
 * Run it BOTH ways and the difference between the two runs IS that hunk:
 *   --expect-dead   every press must be INERT. Green here means the routed lines are
 *                   genuinely still missing, i.e. this tool is pointed at something real
 *                   rather than passing because it cannot see a press either.
 *   (default)       every press must LAND. Run in a worktree with the hunk applied.
 *
 * ── ARMS ────────────────────────────────────────────────────────────────────
 *   1 KEY      `Q` fires slot 0, `E` fires slot 1, independently.
 *   2 TOUCH    a tap on the button does the same thing on a phone.
 *   3 CONTROL  the same wait with NO press leaves the slot ready. Without this arm,
 *              "the slot is cooling" is also what a clock running produces.
 *   4 REFUSED  `Q` on a PASSIVE slot changes nothing — `itemUsable` refuses anything
 *              whose kind is not 'active', and a button that fired one would be the
 *              copy-of-the-rule defect `combat.ts` warns about.
 *   5 WIND-UP  Shiitake goes `is-winding` on the press and `is-cooling` after
 *              `ITEM_TUNING.shiitake.windupMs`, so the one telegraphed item in the set
 *              is legible as spending time rather than waiting it out.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/up_item_press.mjs --url '{URL}' --expect-dead
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/up_item_press.mjs --url '{URL}'
 */

import { chromium } from 'playwright';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1] ?? true;
}
const BASE = (a.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const EXPECT_DEAD = a['expect-dead'] === true || a['expect-dead'] === 'true';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass: !!pass, detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });

async function session(query, { touch = false } = {}) {
  const ctx = await browser.newContext({
    viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 800 },
    deviceScaleFactor: 1, hasTouch: touch, isMobile: touch,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?screen=match&pointerLock=0&${query}`,
    { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
  await page.waitForFunction('window.__matchDebug && window.__matchDebug.phase === "playing"',
    null, { timeout: 60000 });
  if (touch) {
    // `game/touch.ts` sets `fa-touch` on the FIRST real finger, and the HUD's buttons
    // only claim pointer events under it — so the very first tap of a match always lands
    // on the canvas by design. Arm 2 proves that natural path separately; this forces the
    // flag so the tap under test is the SECOND one without spending a frame on it.
    await page.evaluate(() => document.documentElement.classList.add('fa-touch'));
  }
  await page.waitForTimeout(200);
  return { page, ctx };
}
const shut = async ({ page, ctx }) => { await page.close(); await ctx.close(); };

/** The class + badge of every item slot, which is the whole observable. */
const slots = (page) => page.evaluate(() => [...document.querySelectorAll('.hud-item-slot')]
  .map((n) => ({ cls: n.className.replace('hud-item-slot ', ''),
    badge: n.querySelector('.hud-item-badge')?.textContent ?? '' })));

const fired = (s) => s.cls.includes('is-cooling') || s.cls.includes('is-winding');

/**
 * POLL FOR A TRANSITION, NEVER SLEEP A GUESSED NUMBER OF MILLISECONDS.
 *
 * 🚨 THE FIRST CUT SLEPT 300ms AFTER THE PRESS AND CALLED THE RESULT A FAILURE. Under
 * SwiftShader with two other probes on the machine the rAF loop was running at roughly
 * 1 Hz, and `match.ts` consumes a queued press in `buildInput()` ONCE PER STEPPING FRAME
 * — so the press was correct, queued, and simply had not been collected yet. The frame
 * that did arrive said `is-winding "2.3"`, i.e. exactly the behaviour under test, three
 * seconds after the row that had already been recorded as red.
 *
 * A wall-clock wait is a statement about the RENDERER's speed dressed up as a statement
 * about the GAME. This polls the observable instead and reports how long it took, so a
 * loaded machine costs seconds rather than a wrong answer. The window is the same in both
 * modes: a live press exits it early on the transition, and a dead one has to burn all of
 * it before "nothing happened" means anything.
 */
const WATCH_MS = 9000;
async function watch(page, pred) {
  const t0 = Date.now();
  let last = await slots(page);
  while (Date.now() - t0 < WATCH_MS) {
    if (pred(last)) return { hit: true, last, ms: Date.now() - t0 };
    await page.waitForTimeout(150);
    last = await slots(page);
  }
  return { hit: pred(last), last, ms: Date.now() - t0 };
}
/** In `--expect-dead` a press must do NOTHING; otherwise it must land. */
const wanted = (didFire) => (EXPECT_DEAD ? !didFire : didFire);
const verb = EXPECT_DEAD ? 'is INERT (no useItem hop on this tree)' : 'LANDS';

console.log(`\n${EXPECT_DEAD ? 'EXPECTING A DEAD CHAIN' : 'EXPECTING A LIVE CHAIN'} — base ${BASE}`);

// ── 1. KEY ─────────────────────────────────────────────────────────────────
{
  const s = await session('seats=6&player=hamburger&items=springform,warm_milk');
  const before = await slots(s.page);
  ok('1. both slots start ready', before.length === 2 && before.every((r) => r.cls.includes('is-ready')),
    before.map((r) => r.cls).join(' | '));
  await s.page.keyboard.press('KeyQ');
  const q = await watch(s.page, (r) => fired(r[0]));
  ok(`1. Q ${verb} — and only slot 0`, wanted(q.hit) && !fired(q.last[1]),
    `after ${q.ms}ms: slot0 ${q.last[0].cls} "${q.last[0].badge}" · slot1 ${q.last[1].cls} "${q.last[1].badge}"`);
  await s.page.keyboard.press('KeyE');
  const e = await watch(s.page, (r) => fired(r[1]));
  ok(`1. E ${verb} — slot 1`, wanted(e.hit),
    `after ${e.ms}ms: slot1 ${e.last[1].cls} "${e.last[1].badge}"`);
  await shut(s);
}

// ── 2. TOUCH ───────────────────────────────────────────────────────────────
{
  const s = await session('seats=6&player=hamburger&items=springform,warm_milk', { touch: true });
  const before = await slots(s.page);
  ok('2. both slots start ready on a phone', before.every((r) => r.cls.includes('is-ready')),
    before.map((r) => r.cls).join(' | '));
  await s.page.locator('.hud-item-slot').first().tap();
  const t = await watch(s.page, (r) => fired(r[0]));
  ok(`2. a TAP ${verb}`, wanted(t.hit), `after ${t.ms}ms: slot0 ${t.last[0].cls} "${t.last[0].badge}"`);
  ok('2. the tap did not also fire the other slot', !fired(t.last[1]),
    `slot1 ${t.last[1].cls}`);
  await shut(s);
}

// ── 3. CONTROL ─────────────────────────────────────────────────────────────
// ⚠️ WITHOUT THIS ARM ARM 1 IS NOT A MEASUREMENT. "The slot is cooling 400 ms later" is
// also what a slot that cools itself looks like. This waits the same time and presses a
// key that is bound to nothing.
{
  const s = await session('seats=6&player=hamburger&items=springform,warm_milk');
  await s.page.keyboard.press('KeyP');
  // Burns the WHOLE window on purpose: this arm is the one that must find nothing, and
  // an early exit would only prove it had not looked long enough.
  const c = await watch(s.page, () => false);
  ok('3. CONTROL: no press, and both slots are still ready',
    c.last.every((r) => r.cls.includes('is-ready') && r.badge === ''),
    `after ${c.ms}ms: ${c.last.map((r) => `${r.cls} "${r.badge}"`).join(' | ')}`);
  await shut(s);
}

// ── 4. REFUSED ─────────────────────────────────────────────────────────────
{
  const s = await session('seats=6&player=hamburger&items=tenderiser,blue_cheese');
  const before = await slots(s.page);
  await s.page.keyboard.press('KeyQ');
  await s.page.keyboard.press('KeyE');
  const p = await watch(s.page, () => false);
  ok('4. a PASSIVE slot is unchanged by its key — the sim refuses, and the button agrees',
    p.last.every((r, i) => r.cls === before[i].cls && r.badge === 'AUTO'),
    `after ${p.ms}ms: ${p.last.map((r) => `${r.cls} "${r.badge}"`).join(' | ')}`);
  await shut(s);
}

// ── 5. WIND-UP ─────────────────────────────────────────────────────────────
{
  const s = await session('seats=6&player=hamburger&items=shiitake');
  await s.page.keyboard.press('KeyQ');
  const w = await watch(s.page, (r) => r[0].cls.includes('is-winding'));
  ok(`5. Shiitake's press ${EXPECT_DEAD ? 'is INERT' : 'opens a WIND-UP, not a cooldown'}`,
    EXPECT_DEAD ? !w.hit : w.hit, `after ${w.ms}ms: ${w.last[0].cls} "${w.last[0].badge}"`);
  // `ITEM_TUNING.shiitake.windupMs` is SUPER_MIN_COOLDOWN_MS = 2500, but WALL-CLOCK is not
  // the unit that matters — the wind-up resolves on a SIM tick, and this machine's tick
  // rate is whatever SwiftShader can manage. Poll for the next state instead.
  const cool = await watch(s.page, (r) => r[0].cls.includes('is-cooling'));
  ok(`5. ...and after the wind-up it is ${EXPECT_DEAD ? 'still inert' : 'cooling'}`,
    EXPECT_DEAD ? !cool.hit : cool.hit,
    `after ${cool.ms}ms: ${cool.last[0].cls} "${cool.last[0].badge}"`);
  await shut(s);
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (EXPECT_DEAD && failed.length === 0) {
  console.log('  → The chain is DEAD on this tree, as documented. The two routed lines in');
  console.log('    src/game/match.ts are what close it; see this file\'s header.');
}
process.exit(failed.length === 0 ? 0 : 1);
