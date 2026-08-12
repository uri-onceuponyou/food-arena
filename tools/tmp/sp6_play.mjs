#!/usr/bin/env node
/**
 * SP6_PLAY — THE FLAG, DRIVEN THROUGH THE SHIPPED SCREENS IN A REAL BROWSER.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/sp6_play.mjs --url '{URL}'
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/sp6_play.mjs --url '{URL}'
 *   node tools/tmp/sp6_play.mjs --url <base> --arm leak      # a known-bad; §A must go RED
 *
 * ⚠️ `--url` is required and must be a SNAPSHOT, never `:5173` (`CLAUDE.md` #2).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS BESIDE `sp6_seats.mjs`
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * `sp6_seats` is offline and can reach the policy module, the sim and the economy. It
 * **cannot reach `match.ts` or `matchScreen.ts` at all** — `src/ui/**` and the render layer
 * use extension-less specifiers and pull in Three.js plus a module-scope
 * `document.createElement('canvas')`, so `node` cannot load them (measured: an esbuild
 * bridge bundles 1.2 MB and dies on `ReferenceError: document is not defined`). Its §D is a
 * SOURCE census of those two files, which is evidence about the text, not about the running
 * program.
 *
 * This is the row that closes it: the flag goes in at the URL, the shipped shell routes it,
 * `matchScreen` seats it, the real HUD renders it, and the real economy banks it. **Nothing
 * here is stubbed and nothing is re-implemented.**
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  SECTIONS — and the arm that turns each one RED
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   §A  THE FLAG IS OFF. `?player=&enemy=` with no `seats` seats exactly TWO, exactly as it
 *       does today. **RED under `--arm leak`**, which appends `&seats=6` — i.e. the control
 *       is falsified by the on-state, which is the only thing that proves it is measuring
 *       the flag rather than the number 2.
 *   §B  `?seats=2` is REFUSED — the duel keeps one code path. RED under `--arm leak2`.
 *   §C  THE FLAG IS ON. `?seats=N` for N=3..6 seats N, and the roster on screen is exactly
 *       `brawl.ts:brawlRoster`'s — read from the module in the page, never retyped here.
 *       RED under `--arm wrongroster`.
 *   §D  `?seats=6` ALONE boots into a MATCH, not the title card. This is `main.ts`'s
 *       `MATCH_ONLY_PARAMS` defect one parameter after `fighters` — it presents as a 90 s
 *       timeout that reads exactly like the sim refusing to seat the match.
 *   §E  A REAL SIX-SEAT MATCH, PLAYED TO THE END: the card reads *"Nth of 6"*, the banked
 *       place is the card's minus one, `lastMatch.seats === 6`, and the money on the card
 *       equals the money banked — **not twice it**. RED under `--arm poison`.
 *
 * ⚠️ **§E's identity is `rc_card.mjs` §E's, deliberately restated on THIS entry point rather
 * than reused.** `rc_card` drives `?fighters=` — the QA transport that carries its own
 * coordinates — so it cannot see anything about the product path. Same assertion, different
 * subject.
 *
 * ⚠️ **RESOLUTION FLOOR: NONE.** Every asserted row is an integer equality, a set equality
 * or a string match. §E's dwell is counted in FRAMES rather than milliseconds, because
 * SwiftShader renders a six-rig card at ~3 fps and a wall-clock dwell silently decides how
 * much evidence the "frozen while rendering" row has.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// 🚨 IS_MAIN GUARD — `docs/AGENT-BRIEF.md` §3: making a function importable silently made a
// tool's whole CLI path run on import, and one of those launched Chromium.
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const ARM = flag('arm', 'base');
const ONLY = flag('only', null);
const MATCH_WALL_MS = Number(flag('wall', '300000'));
const SHOT = flag('shot', null);

/** The pair every section drives. Distinct characters, so a NAME is a slot identity. */
const PLAYER = 'hamburger';
const ENEMY = 'donut';

const rows = [];
function check(section, name, pass, evidence = '') {
  rows.push({ section, name, pass, evidence });
  console.log(`  ${pass ? '✓' : '✗'} §${section} ${name}${evidence ? `  — ${evidence}` : ''}`);
  return pass;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-side reads. Stringified because they run in the browser, which is the only
// place `src/ui/**` resolves.
// ─────────────────────────────────────────────────────────────────────────────

/** The seated roster, as the SHIPPED HUD shows it, plus the arena the renderer is drawing. */
const PAGE_SEATS = () => {
  const names = [...document.querySelectorAll('.hud-fighter-name')].map((e) => e.textContent.trim());
  return {
    plates: document.querySelectorAll('.hud-fighter').length,
    names,
    arenaSpawns: window.__matchArena?.spawns?.map((s) => ({ x: s.x, y: s.y })) ?? null,
    phase: window.__matchDebug?.phase ?? null,
  };
};

/**
 * The rule's OWN answer, read out of the shipped module in the page.
 *
 * 🚨 **NEVER A LITERAL LIST HERE.** A hard-coded `['hamburger','donut','taco',…]` would make
 * §C a test of this file's memory of the rule, and it would go green on the day the rule
 * changed and the game stopped matching it. This imports `brawl.ts` and asks it.
 */
const PAGE_RULE = async ([player, enemy, seats]) => {
  const B = await import('/src/ui/screens/brawl.ts');
  const R = await import('/src/game/rules.ts');
  const ids = B.brawlRoster(player, enemy, seats);
  // The HUD prints DISPLAY names, and `CHARACTERS[id].name` is where they come from — so the
  // id→name map is read from `rules.ts` too. Spelling one out here (`waterbottle` renders as
  // two words) would make this row a test of the tool's memory of the cast.
  return { ids, names: ids.map((id) => R.CHARACTERS[id].name) };
};

/** Everything §E reads out of the page, in one call. Mirrors `rc_card.mjs`'s `PAGE_BANKED`. */
const PAGE_BANKED = () => {
  const raw = localStorage.getItem('food-arena.profile.v1');
  const blob = raw ? JSON.parse(raw) : null;
  const card = document.querySelector('.hud-gameover-card');
  const pay = card ? card.querySelector('.hud-gameover-payout') : null;
  return {
    trophies: blob?.economy?.trophies ?? null,
    coins: blob?.economy?.coins ?? null,
    xp: blob?.xp ?? null,
    lastMatch: blob?.economy?.lastMatch ?? null,
    ended: !!(card && card.closest('.hud-gameover')?.style.display === 'flex'),
    place: card?.querySelector('.hud-gameover-place')?.textContent ?? null,
    chips: pay ? [...pay.querySelectorAll('.hud-go-pay b')].map((e) => e.textContent) : null,
    frames: window.__matchDebug?.frames ?? null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

async function newPage(browser, url, { ready = true } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // A peer's save must not be able to reload the page mid-run. The snapshot freezes the
  // tree; this closes the HMR socket as well.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
      + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
      + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
      + 'export const ErrorOverlay=class{};export default {};',
  }));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (ready) await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
  return { page, errors };
}

const qs = (extra) => `${BASE}/?player=${PLAYER}&enemy=${ENEMY}&pointerLock=0${extra}`;

async function sectionA(browser) {
  // The OFF state, and the arm that falsifies it. `--arm leak` turns the flag on behind the
  // control's back: if this row cannot tell the two apart it is asserting the number 2, not
  // the flag.
  const url = qs(ARM === 'leak' ? '&seats=6' : '');
  const { page, errors } = await newPage(browser, url);
  const r = await page.evaluate(PAGE_SEATS);
  check('A', 'the flag OFF seats exactly two — shipped play is unchanged',
    r.plates === 2 && r.names.length === 2, `${r.plates} plates, names ${JSON.stringify(r.names)}`);
  check('A', 'no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function sectionB(browser) {
  const { page, errors } = await newPage(browser, qs(ARM === 'leak2' ? '&seats=6' : '&seats=2'));
  const r = await page.evaluate(PAGE_SEATS);
  check('B', '`?seats=2` is REFUSED — the duel keeps exactly one code path',
    r.plates === 2, `${r.plates} plates`);
  check('B', 'no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function sectionC(browser) {
  for (const n of [3, 4, 5, 6]) {
    const { page, errors } = await newPage(browser, qs(`&seats=${n}`));
    const r = await page.evaluate(PAGE_SEATS);
    check('C', `\`?seats=${n}\` seats ${n} fighters through the shipped screens`,
      r.plates === n && r.names.length === n, `${r.plates} plates, ${r.names.length} names`);

    // The rule's own answer, asked of the shipped module rather than remembered here.
    // `--arm wrongroster` reverses the EXPECTATION rather than the code: it is an
    // order-sensitivity control, and it exists because slot order is load-bearing here
    // (slot *i* takes `arena.spawns[i]`, which is interleaved into mirrored pairs) and a
    // set-equality row would have gone green on a re-ordered field.
    const want = await page.evaluate(PAGE_RULE, [PLAYER, ENEMY, n]);
    const expect = ARM === 'wrongroster' ? [...want.names].reverse() : want.names;
    check('C', `...and the roster is exactly \`brawlRoster\`'s, in slot order (N=${n})`,
      want.ids.length === n
        && JSON.stringify(r.names.map((s) => s.toUpperCase()))
          === JSON.stringify(expect.map((s) => s.toUpperCase())),
      `screen ${JSON.stringify(r.names)} vs rule ${JSON.stringify(want.names)}`);

    // The seats came from the ARENA, not from anything this path invented. The renderer
    // publishes the live `ArenaDefinition` on `window.__matchArena`, so this is the same
    // object the sim seated from — `np_nfighter` derives its centre the same way, after a
    // retyped `{700,500}` left 62 rows green in the wrong quadrant.
    check('C', `...and the arena still declares ${n} or more spawns to seat them from`,
      (r.arenaSpawns?.length ?? 0) >= n, `spawns ${r.arenaSpawns?.length}`);
    check('C', `no page errors (N=${n})`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }
}

async function sectionD(browser) {
  // 🚨 `?seats=6` ALONE. `main.ts:MATCH_ONLY_PARAMS` is what makes this boot into a match
  // rather than the title card, and the file's own comment records that `fighters` was
  // missing from that list and presented as a 90 s timeout. This is the row that stops the
  // same defect one parameter later — and `np_nfighter` never hit the first one because it
  // also passed `fogRadius`, which WAS on the list. So this passes NOTHING else.
  const { page, errors } = await newPage(browser, `${BASE}/?seats=6`, { ready: false });
  let booted = false;
  try {
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90_000 });
    booted = true;
  } catch { booted = false; }
  const r = booted ? await page.evaluate(PAGE_SEATS) : { plates: 0 };
  check('D', '`?seats=6` ALONE boots straight into a six-seat match, not the title card',
    booted && r.plates === 6, booted ? `${r.plates} plates` : 'never reached __gameReady');
  check('D', 'no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function sectionE(browser) {
  const url = qs('&seats=6&simSpeed=8');
  const { page, errors } = await newPage(browser, url);
  // ⚠️ SEED A REAL, APP-PRODUCED PROFILE FIRST. `profile.ts` only writes to `localStorage`
  // when something CHANGES, so on a fresh browser the store is absent until the first bank
  // and a `before` read off a missing blob reports a fresh economy's 500 starting coins as a
  // delta — a manufactured regression. `rc_card` §E records exactly this fault; the blob is
  // built by the economy's OWN `serialize(createEconomy())` so it cannot drift from `load()`.
  await page.evaluate(async () => {
    const eco = await import('/src/game/economy/state.ts');
    localStorage.setItem('food-arena.profile.v1', JSON.stringify({
      name: 'QA', wins: 0, losses: 0, xp: 0, selected: 'hamburger',
      economy: eco.serialize(eco.createEconomy()),
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });

  const seated = await page.evaluate(PAGE_SEATS);
  if (!check('E', 'the match under test really has six seats', seated.plates === 6, `${seated.plates}`)) {
    await page.close();
    return;
  }
  const before = await page.evaluate(PAGE_BANKED);
  // THE PRECONDITION, ASSERTED BEFORE ANYTHING IS SUBTRACTED FROM IT.
  if (!check('E', 'a banked baseline exists before the match',
    before.trophies !== null && before.coins !== null && before.xp !== null,
    `trophies=${before.trophies} coins=${before.coins} xp=${before.xp}`)) {
    await page.close();
    return;
  }

  const t0 = Date.now();
  let ended = false;
  while (Date.now() - t0 < MATCH_WALL_MS && !ended) {
    const r = await page.evaluate(PAGE_BANKED).catch(() => null);
    if (r?.ended) { ended = true; break; }
    await page.waitForTimeout(400);
  }
  if (!check('E', 'the six-seat match reached a result card',
    ended, `${((Date.now() - t0) / 1000).toFixed(1)}s`)) {
    await page.close();
    return;
  }

  await page.waitForTimeout(400);
  const at = await page.evaluate(PAGE_BANKED);
  const dT = at.trophies - before.trophies;
  const dC = at.coins - before.coins;
  const dX = at.xp - before.xp;
  const chips = (at.chips ?? []).map((c) => Number(c.replace('+', '')));

  check('E', 'the card shows a payout at all', chips.length >= 3, `chips ${JSON.stringify(at.chips)}`);
  check('E', 'banked trophy delta === the trophy chip (not twice it)',
    chips[0] === dT, `card ${chips[0]} vs banked ${dT}`);
  check('E', 'banked coin delta === the coin chip', chips[1] === dC, `card ${chips[1]} vs banked ${dC}`);
  check('E', 'banked XP delta === the XP chip', chips[2] === dX, `card ${chips[2]} vs banked ${dX}`);

  // 🚨 THE WHOLE POINT OF THE FLAG. `recordPlacement(place, SIX)`, not `recordResult(bool)`
  // which `profile.ts` forwards as `recordPlacement(won ? 0 : 1, MIN_FIGHTERS)`. If this
  // read 2 the match was paid as a duel — 9 trophies, 24 coins and 39 XP short at 3rd of 6 —
  // and every row above would still be green, because a duel payout is also self-consistent.
  check('E', 'the match was banked as a SIX-seat placement, not as a duel',
    at.lastMatch?.seats === 6, `lastMatch.seats = ${at.lastMatch?.seats}`);

  // The one-based/zero-based join, as arithmetic rather than as a substring: `match.ts`
  // calls the single `+ 1` "the shape that pays 6th place a 5th-place cheque".
  const cardPlace = Number((at.place ?? '').match(/^(\d+)/)?.[1] ?? NaN);
  check('E', 'the place on the card is the place that was banked, +1',
    at.lastMatch !== null && cardPlace === at.lastMatch.place + 1
      && (at.place ?? '').toLowerCase().includes('of 6'),
    `card "${at.place}" vs banked place ${at.lastMatch?.place} of ${at.lastMatch?.seats}`);

  if (ARM === 'poison') {
    await page.evaluate(() => {
      const blob = JSON.parse(localStorage.getItem('food-arena.profile.v1'));
      blob.economy.trophies += 999;
      localStorage.setItem('food-arena.profile.v1', JSON.stringify(blob));
    });
  }
  // ⚠️ DWELL IN FRAMES, NOT MILLISECONDS. SwiftShader draws a six-rig card at ~3 fps, so a
  // fixed wall-clock dwell silently decides how much evidence the row below has.
  const DWELL_FRAMES = 20;
  const dwellStart = Date.now();
  let after = at;
  while (Date.now() - dwellStart < 30_000) {
    await page.waitForTimeout(300);
    after = await page.evaluate(PAGE_BANKED);
    if ((after.frames ?? 0) - (at.frames ?? 0) >= DWELL_FRAMES) break;
  }
  const frames = (after.frames ?? 0) - (at.frames ?? 0);
  check('E', 'the loop really was rendering the card between the two samples',
    frames >= DWELL_FRAMES, `${frames} frames`);
  check('E', 'the banked total is FROZEN while the card renders — banked once, not per frame',
    after.trophies === at.trophies && after.coins === at.coins && after.xp === at.xp,
    `trophies ${at.trophies}->${after.trophies}, coins ${at.coins}->${after.coins}`);
  check('E', 'no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  // ⚠️ A PNG, BECAUSE `CLAUDE.md` #3 SAYS SO: every numeric row above can be green on a card
  // nobody has looked at, and judging a description instead of an image is this project's
  // most common failure. `--shot` is opt-in so the default run stays cheap.
  if (SHOT) {
    mkdirSync(dirname(resolve(SHOT)), { recursive: true });
    await page.screenshot({ path: resolve(SHOT) });
    console.log(`  wrote ${SHOT}`);
  }
  await page.close();
}

async function main() {
  if (!BASE || /:5173(\/|$)/.test(BASE)) {
    console.error('sp6_play: --url (or PREVIEW_BASE) is required, and it must be a SNAPSHOT, never :5173.');
    process.exit(2);
  }
  console.log(`\nsp6_play · ${BASE} · arm ${ARM}${ONLY ? ` · only ${ONLY}` : ''}\n`);
  const browser = await chromium.launch();
  try {
    const want = (s) => ONLY === null || ONLY.includes(s);
    if (want('A')) await sectionA(browser);
    if (want('B')) await sectionB(browser);
    if (want('C')) await sectionC(browser);
    if (want('D')) await sectionD(browser);
    if (want('E')) await sectionE(browser);
  } finally {
    // ⚠️ NOT inside a `try` that can `process.exit()` — `AGENT-BRIEF` §3: `process.exit()`
    // inside a `try` SKIPS the `finally`, and a frozen tree leaked on every run of a probe
    // that looked correct.
    await browser.close();
  }
  const failed = rows.filter((r) => !r.pass);
  console.log(`\n${failed.length === 0 ? '✅' : '🔴'} SP6_PLAY: ${rows.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) console.log(`   failing: ${failed.map((r) => `§${r.section} ${r.name}`).join(' · ')}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

export { PAGE_SEATS, PAGE_BANKED, PAGE_RULE };

if (IS_MAIN) main().catch((e) => { console.error(e); process.exit(1); });
