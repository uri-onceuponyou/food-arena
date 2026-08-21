#!/usr/bin/env node
/**
 * LK3 — IS THE FIGHTER'S LEVEL ON THE IN-MATCH NAMEPLATE, AND IS IT THE FIGHTER'S OWN?
 *
 * Uri, playing the deployed build: *"In the gameplay add player level on player data."*
 *
 * ── WHAT MAKES THIS HARD, AND WHY THE FIXTURE IS SPLIT IN TWO ────────────────
 *
 * The obvious assertion — *"every nameplate shows its own slot's level"* — is VACUOUS on
 * every state the shipped game can produce, and that is the whole design problem here:
 *
 *   * `tuning.ts:ENEMY_LEVEL_MODE` is `'mirror'`, so `economy/levels.ts:enemyLevelFor(n)`
 *     returns `n` and `match.ts:newMatch` hands `this.levels.enemy` to EVERY non-local
 *     seat. Every fighter in a shipped match therefore carries the SAME level.
 *   * the QA `?fighters=` transport (`match.ts:fightersFromQuery`) sets no level at all,
 *     so every seat there is `LEVEL_MIN` = 1.
 *
 * A HUD that wrote slot 0's level into all six plates passes both. That is the
 * `[].every()` vacuity class CLAUDE.md #6 lists three instances of, wearing a third
 * disguise: not an empty set, but a set whose members are indistinguishable.
 *
 * So there are two arms and they prove different halves:
 *
 *   ARM H (harness, `tools/tmp/lk3_harness.html`) — builds a REAL `MatchState` through the
 *     shipped `createMatch` with a DISTINCT level per seat, which nothing in `src/` can
 *     currently ask for. Proves PER-SLOT WIRING. Asserts the levels are distinct BEFORE it
 *     asserts anything about them, so the anti-vacuity check cannot itself go vacuous.
 *
 *   ARM G (the real game, seeded through the PERSISTED PROFILE) — proves the SHIPPED PATH
 *     carries a varying level all the way to the screen, over N ∈ {1, 7, 15} plus the two
 *     clamp ends (0 → 1, 99 → 15). A HUD printing a constant fails this.
 *     🚨 It does NOT use `?level=`, which `match.ts:738` advertises for exactly this job
 *     and which this file MEASURED AS DEAD — see `armG`'s header for the two-line reason.
 *     Every level cell also carries an INDEPENDENT cross-check: `maxHpFor` scales the HP
 *     pool by `levelHealthMultiplier(level)`, so the denominator of the HP run has to move
 *     with the badge. Without it, "everything reads 1" passes as "level 1 renders right".
 *
 * ── KNOWN-BAD INPUTS (CLAUDE.md #6 — a guard not shown to FAIL is not a guard) ─
 *
 *   `--expect-fail`   run against a tree WITHOUT the badge. Every arm must go red.
 *                     A run that passes on both trees is measuring nothing.
 *   `--selftest`      validates the FIT detector in-process against a planted overflow:
 *                     the badge is given 300px of padding, and the detector must go from
 *                     0 overflowing children to a non-zero count and then back.
 *                     ⚠️ This is deliberately NOT `scrollWidth - clientWidth`. That metric
 *                     never moves for a `nowrap` run and a flex item measured against
 *                     ITSELF cannot overflow (`lu_sudden`'s structural blindness). The
 *                     budget asserted here is THE PILL'S CONTENT BOX.
 *
 * ⚠️ `--selftest` validates this tool's LOGIC and never validates where it is POINTED.
 * The station list is one URL and one harness; both are checked for a JS exception and
 * for a non-empty plate set before any verdict is taken.
 *
 * ── PLATES ───────────────────────────────────────────────────────────────────
 * Two per game cell: the shipped match pitch (58) and the LOBBY pitch (20), because
 * CLAUDE.md #3 says the shallow camera is the better DETECTOR. For a DOM overlay the
 * thing that changes with pitch is the PIXELS BEHIND THE TEXT — a shallow camera puts
 * distant floor and sky under the top bar where a steep one puts near floor — so both
 * are captured and `hud_accept.mjs` is the instrument that scores the contrast.
 * The shake is zeroed before every render (`AGENT-BRIEF` §3: a frozen frame is not a
 * frozen camera) and CSS animations are disabled in the shot.
 *
 *   node tools/tmp/lk3_level.mjs --url http://127.0.0.1:1234
 *   node tools/tmp/lk3_level.mjs --url … --json out.json      # machine-readable summary
 *   node tools/tmp/lk3_level.mjs --url … --expect-fail        # against a pristine tree
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/tools/tmp/lk3_shots`));
const JSON_OUT = arg('--json', null);
const EXPECT_FAIL = has('--expect-fail');
const SELFTEST = has('--selftest');
const FRAMES = Number(arg('--frames', 45));

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

/**
 * `rules.ts`'s level constants, re-derived from the source rather than retyped — a
 * hardcoded 15 here is a number that agrees today and is stale the day the ladder moves,
 * which is the exact class CLAUDE.md's gate-count rule exists for. It THROWS if it cannot
 * find them, rather than defaulting: a silent fallback would make every expectation below
 * a statement about this file instead of about the game.
 */
const { LEVEL_MIN, LEVEL_MAX, HEALTH_PER_LEVEL } = await (async () => {
  const src = await import('node:fs').then((fs) => fs.promises.readFile(`${ROOT}/src/game/rules.ts`, 'utf8'));
  const min = /export const LEVEL_MIN = (\d+)/.exec(src);
  const max = /export const LEVEL_MAX = (\d+)/.exec(src);
  const hpl = /export const LEVEL_HEALTH_PER_LEVEL = ([\d.]+)/.exec(src);
  if (!min || !max || !hpl) throw new Error('could not read the level constants out of rules.ts');
  return { LEVEL_MIN: Number(min[1]), LEVEL_MAX: Number(max[1]), HEALTH_PER_LEVEL: Number(hpl[1]) };
})();
const clampLevel = (n) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(n)));

/**
 * THE MEASUREMENT, PAGE-SIDE. One `evaluate`, run LAST in every cell, because
 * `page.evaluate()` grants transient user activation (`AGENT-BRIEF` §3) and this file
 * must not hand the page a gesture it never received.
 *
 * ⚠️ FIT IS MEASURED AGAINST THE PILL'S CONTENT BOX, never `scrollWidth - clientWidth`.
 */
const READ = () => {
  const px = (v) => parseFloat(v) || 0;
  const contentBox = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      left: r.left + px(s.borderLeftWidth) + px(s.paddingLeft),
      right: r.right - px(s.borderRightWidth) - px(s.paddingRight),
      top: r.top + px(s.borderTopWidth) + px(s.paddingTop),
      bottom: r.bottom - px(s.borderBottomWidth) - px(s.paddingBottom),
    };
  };
  const shown = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.01;
  };
  const plates = [...document.querySelectorAll('.hud-fighter')];
  const de = document.documentElement;
  const topbar = document.querySelector('.hud-topbar');

  const rows = plates.map((plate, i) => {
    const pill = plate.querySelector('.hud-fighter-pill');
    const lvl = plate.querySelector('.hud-fighter-level');
    // ⚠️ THE NUMERAL, NOT THE BADGE. `update()` writes `.hud-fighter-level-n`; the `LV`
    // label beside it is static markup that the <=720px media query drops, so reading the
    // badge's own `textContent` would compare "LV15" on a desktop against "15" on a phone
    // and turn a responsive rule into a false failure.
    const lvlN = plate.querySelector('.hud-fighter-level-n');
    const lvlTag = plate.querySelector('.hud-fighter-level-tag');
    const name = plate.querySelector('.hud-fighter-name');
    const cb = pill ? contentBox(pill) : null;
    // Every pill child's border box against the pill's CONTENT box, with 0.5px of
    // slack for sub-pixel layout. A child that leaves it is drawn on raw world pixels.
    const over = [];
    if (cb && pill) {
      for (const c of pill.children) {
        if (!shown(c)) continue;
        const r = c.getBoundingClientRect();
        const dx = Math.max(cb.left - r.left, r.right - cb.right);
        const dy = Math.max(cb.top - r.top, r.bottom - cb.bottom);
        if (dx > 0.5 || dy > 0.5) over.push(`${c.className}:${Math.max(dx, dy).toFixed(1)}px`);
      }
    }
    const lr = lvl ? lvl.getBoundingClientRect() : null;
    return {
      slot: i,
      isChip: plate.classList.contains('hud-fighter--chip'),
      levelPresent: !!lvl && !!lvlN,
      levelShown: shown(lvl) && shown(lvlN),
      levelText: lvlN ? lvlN.textContent : null,
      levelTagShown: shown(lvlTag),
      levelW: lr ? +lr.width.toFixed(1) : null,
      levelH: lr ? +lr.height.toFixed(1) : null,
      pillH: pill ? +pill.getBoundingClientRect().height.toFixed(1) : null,
      plateW: +plate.getBoundingClientRect().width.toFixed(1),
      // The name's own clip. Valid here (and ONLY here) because `.hud-fighter-name`
      // carries `overflow: hidden`, so its own box really does clip its own run.
      nameShown: shown(name),
      nameClipped: name ? name.scrollWidth - name.clientWidth : null,
      nameText: name ? name.textContent : null,
      // The HP run's DENOMINATOR is the independent channel: `maxHpFor` multiplies by
      // `levelHealthMultiplier(level)`, so a level that really reached the sim moves it.
      // See armG — the badge alone cannot prove the level got past the URL.
      hpText: plate.querySelector('.hud-healthbar-text')?.textContent ?? null,
      overflow: over,
    };
  });

  // 🚨 THE CSS-PARSE CANARY. `hud.ts`'s whole stylesheet is ONE template literal and this
  // block is authored inside a comment run; a stray `*/` closes the comment early, the
  // next paragraph is then parsed as a SELECTOR, and the browser silently drops the rule
  // that follows it. That happened once during this pass and nothing rendered visibly
  // differently — which is exactly why it needs a check rather than an eyeball.
  //   badge.*   can only come from `.hud-fighter-level` itself
  //   afterBar.* comes from `.hud-healthbar`, the rule DECLARED IMMEDIATELY AFTER it, so
  //             an over-long error recovery that swallowed the next rule is visible too.
  const anyBadge = document.querySelector('.hud-fighter-level');
  const anyBar = document.querySelector('.hud-fighter:not(.hud-fighter--chip) .hud-healthbar');
  const css = {
    badgeBg: anyBadge ? getComputedStyle(anyBadge).backgroundColor : null,
    badgeRadius: anyBadge ? getComputedStyle(anyBadge).borderTopLeftRadius : null,
    afterBarOverflow: anyBar ? getComputedStyle(anyBar).overflow : null,
    afterBarPosition: anyBar ? getComputedStyle(anyBar).position : null,
  };

  return {
    css,
    vw: de.clientWidth,
    vh: de.clientHeight,
    topbarBottom: topbar ? +topbar.getBoundingClientRect().bottom.toFixed(1) : null,
    plates: rows.length,
    rows,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — the fit detector, against a planted overflow.
// ─────────────────────────────────────────────────────────────────────────────
async function selftest(browser) {
  console.log('── selftest: the fit detector ──────────────────────────────');
  const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
  await page.setContent(`<!doctype html><style>
    *{box-sizing:border-box}
    .hud-fighter{width:220px}
    .hud-fighter-pill{display:flex;align-items:center;gap:6px;border:2px solid #000;padding:3px 12px 3px 4px;max-width:100%}
    .hud-fighter-emoji{flex:0 0 auto;width:24px;height:24px}
    .hud-fighter-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .hud-fighter-level{flex:0 0 auto;height:20px;padding:0 7px}
  </style><div class="hud-fighter"><div class="hud-fighter-pill">
    <div class="hud-fighter-emoji"></div><div class="hud-fighter-name">HAMBURGER</div>
    <div class="hud-fighter-level">LV 15</div></div></div>`);
  const clean = await page.evaluate(READ);
  const cleanOver = clean.rows.reduce((n, r) => n + r.overflow.length, 0);
  check('[selftest] the detector reads ZERO overflowing children on a pill that fits',
    clean.plates === 1 && cleanOver === 0, JSON.stringify(clean.rows[0]?.overflow));

  // KNOWN-BAD: a badge that cannot possibly fit. The detector MUST move.
  await page.addStyleTag({ content: '.hud-fighter-level{padding:0 300px !important}' });
  const bad = await page.evaluate(READ);
  const badOver = bad.rows.reduce((n, r) => n + r.overflow.length, 0);
  check('[selftest] KNOWN-BAD: a 300px-padded badge is REPORTED as overflowing its pill',
    badOver > 0, `overflowing children = ${badOver}`);
  check('[selftest] and the two arms DIFFER (the detector is not stuck)',
    cleanOver !== badOver, `${cleanOver} vs ${badOver}`);
  await page.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// ARM H — the harness. Per-slot wiring, on levels that are distinct by construction.
// ─────────────────────────────────────────────────────────────────────────────
const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'pizza'];
/** Distinct, spanning both clamp ends and both digit widths. */
const LEVELS = [15, 1, 9, 2, 11, 4];

async function armH(browser, vp, touch) {
  const tag = `[H n=%d ${vp.tag}${touch ? ' TOUCH' : ''}]`;
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await page.goto(`${BASE}/tools/tmp/lk3_harness.html${touch ? '?touch=1' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lk3Ready === true, null, { timeout: 60000 });

  const out = [];
  for (const n of [2, 6]) {
    const t = tag.replace('%d', String(n));
    const ids = CAST.slice(0, n);
    const want = LEVELS.slice(0, n);
    const sim = await page.evaluate(([i, l]) => window.__lk3Set(i, l), [ids, want]);
    const dom = await page.evaluate(READ);
    out.push({ n, touch, vp: vp.tag, sim, dom });

    check(`${t} no JS exception`, errors.length === 0, errors.slice(0, 2).join(' | '));

    // 🚨 THE ANTI-VACUITY GUARDS, ASSERTED BEFORE ANYTHING THEY GUARD.
    check(`${t} the plate set is NON-EMPTY and is ${n} plates`, dom.plates === n, `plates=${dom.plates}`);
    check(`${t} the sim really seated ${n} DISTINCT levels`,
      sim.levels.length === n && new Set(sim.levels).size === n,
      JSON.stringify(sim.levels));
    check(`${t} the sim's levels are the ones asked for`,
      JSON.stringify(sim.levels) === JSON.stringify(want),
      `${JSON.stringify(sim.levels)} != ${JSON.stringify(want)}`);

    // THE ASSERTION. Against the SIM's levels, not against this file's array.
    const got = dom.rows.map((r) => r.levelText);
    const expect = sim.levels.map((l) => String(l));
    check(`${t} every nameplate carries ITS OWN slot's level`,
      JSON.stringify(got) === JSON.stringify(expect),
      `${JSON.stringify(got)} != ${JSON.stringify(expect)}`);

    // The element exists on EVERY slot, chip or not — the trade below is a CSS one.
    check(`${t} the badge element exists on all ${n} slots`,
      dom.rows.every((r) => r.levelPresent), JSON.stringify(dom.rows.map((r) => r.levelPresent)));

    // THE CHIP DECISION, ASSERTED SO IT IS RECORDED RATHER THAN DISCOVERED.
    const local = dom.rows[0];
    const chips = dom.rows.filter((r) => r.isChip);
    check(`${t} the LOCAL seat draws its badge`, local.levelShown === true, String(local.levelShown));
    if (n > 2) {
      check(`${t} there are ${n - 1} chips and every one HIDES the badge`,
        chips.length === n - 1 && chips.every((r) => r.levelShown === false),
        `${chips.length} chips, shown=${JSON.stringify(chips.map((r) => r.levelShown))}`);
    } else {
      check(`${t} at two seats NOTHING is a chip and BOTH plates draw the badge`,
        chips.length === 0 && dom.rows.every((r) => r.levelShown === true),
        `chips=${chips.length} shown=${JSON.stringify(dom.rows.map((r) => r.levelShown))}`);
    }

    // THE CSS-PARSE CANARY — see READ. Cheap, and it is the only check here that would
    // have caught the malformed comment run this pass actually shipped for ten minutes.
    check(`${t} the badge's own CSS rule parsed (gold plate, rounded)`,
      dom.css.badgeBg === 'rgb(255, 201, 60)' && dom.css.badgeRadius !== '0px',
      JSON.stringify(dom.css));
    check(`${t} and the rule DECLARED AFTER it still applies (.hud-healthbar)`,
      dom.css.afterBarOverflow === 'hidden' && dom.css.afterBarPosition === 'relative',
      JSON.stringify(dom.css));

    // THE RESPONSIVE LABEL. Asserted in BOTH directions, because a media query that never
    // fires and one that always fires both produce a self-consistent set of measurements.
    // 🚨 THE `.filter(...).every(...)` HERE IS GUARDED BY ITS OWN NON-EMPTY CHECK, and it
    // is not theoretical: on the pristine tree this file's `--expect-fail` arm has NO
    // badges at all, `levelShown` is false everywhere, the filtered set is empty and
    // `[].every()` returns TRUE. It passed green on the known-bad tree until this line
    // was written. CLAUDE.md #6: if you FILTER a set before asserting over it, assert the
    // set is NON-EMPTY FIRST.
    const wantTag = vp.width > 720;
    const drawnBadges = dom.rows.filter((r) => r.levelShown);
    check(`${t} the LV label is ${wantTag ? 'drawn' : 'dropped'} at ${vp.width}px (over ${drawnBadges.length} drawn badge(s))`,
      drawnBadges.length > 0 && drawnBadges.every((r) => r.levelTagShown === wantTag),
      JSON.stringify(dom.rows.map((r) => [r.levelShown, r.levelTagShown])));

    // THE NAME-YIELD RULE, ALSO ASSERTED IN BOTH DIRECTIONS AND ALSO GUARDED. A rule
    // keyed at 560px is only a rule if something above it keeps its name; a blanket
    // `display: none` would satisfy the narrow half on its own.
    const wantName = vp.width > 560;
    const fullPlates = dom.rows.filter((r) => !r.isChip);
    check(`${t} the character NAME is ${wantName ? 'drawn' : 'dropped'} at ${vp.width}px (over ${fullPlates.length} full plate(s))`,
      fullPlates.length > 0 && fullPlates.every((r) => r.nameShown === wantName),
      JSON.stringify(dom.rows.map((r) => [r.isChip, r.nameShown])));

    // FIT — against the pill's CONTENT box. Validated by --selftest above.
    const over = dom.rows.flatMap((r) => r.overflow.map((o) => `slot${r.slot}:${o}`));
    check(`${t} nothing in any pill crosses the pill's content box`, over.length === 0, over.join(' | '));

    // HEIGHT BUDGET — the badge must be SHORTER than the portrait beside it, which is
    // what keeps the pill (and therefore the published top-bar height) where it was.
    const drawn = dom.rows.filter((r) => r.levelShown);
    check(`${t} every drawn badge is shorter than its own pill (pill height is set by the portrait)`,
      drawn.length > 0 && drawn.every((r) => r.levelH < r.pillH - 1),
      JSON.stringify(drawn.map((r) => [r.levelH, r.pillH])));

    console.log(`  info - ${t} top bar bottom ${dom.topbarBottom}px · pill heights ${JSON.stringify(dom.rows.map((r) => r.pillH))}`);
    console.log(`  info - ${t} name clip px ${JSON.stringify(dom.rows.map((r) => r.nameClipped))} · badge w ${JSON.stringify(dom.rows.map((r) => r.levelW))}`);
  }
  await page.close();
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// ARM G — the real game, through the PROFILE.
//
// 🚨 IT DOES NOT USE `?level=`, AND THAT IS A MEASURED FINDING, NOT A PREFERENCE.
// `match.ts:738` documents `?level=` as *"what lets a screenshot pass reach a levelled
// fighter with no upgrade UI in the way"*. It cannot: the read is
// `opts.playerLevel ?? numberFromQuery('level')` and `matchScreen.ts:153` ALWAYS supplies
// `playerLevel: ctx.profile.characterLevel(route.player)`, so the `??` never falls
// through on any shipped route. Measured: `?level=7|15|99` all render LV 1.
// (`level` is also absent from `main.ts:MATCH_ONLY_PARAMS`, so it does not even boot a
// match on its own.) Both files are outside this pass's owned set — reported, not fixed.
//
// So the level is seeded where the product actually reads it: the persisted profile.
// `economy/state.ts:deserialize` clamps into 1..LEVEL_MAX and DROPS a stored LEVEL_MIN,
// which is why the level-0 cell below expects LV 1 rather than a rejection.
// ─────────────────────────────────────────────────────────────────────────────
const HERO = 'hamburger';
async function armG(browser, cell) {
  const { level, vp, shots } = cell;
  const tag = `[G level=${level} ${vp.tag}]`;
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let virt = 0;
    performance.now = () => virt;
    window.__clk = { advance(ms) { virt += ms; } };
    void realNow;
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  // Written before ANY page script runs, so the very first `new PlayerProfile()` reads it.
  await page.addInitScript(([key, id, lv]) => {
    localStorage.setItem(key, JSON.stringify({ selected: id, economy: { levels: { [id]: lv } } }));
  }, ['food-arena.profile.v1', HERO, level]);
  const q = cell.fighters
    ? `?fighters=${encodeURIComponent(cell.fighters)}&fogRadius=900&simSpeed=1&pointerLock=0`
    : `?screen=match&player=${HERO}&enemy=donut&simSpeed=1&pointerLock=0`;
  await page.goto(`${BASE}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
  await page.evaluate(() => { window.__lk3Stage = window.__stage; });
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i++) {
      window.__clk.advance(16.667);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
  }, FRAMES);

  const pngs = [];
  for (const pitch of (shots ? [58, 20] : [])) {
    // AGENT-BRIEF §3: shake re-randomises on every render(), so a frozen frame is not a
    // frozen camera. Zero it, set the pitch, apply, draw.
    await page.evaluate((p) => {
      const stage = window.__lk3Stage;
      const rig = stage.rig;
      rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0);
      rig.pitchDeg = p; rig.apply();
      stage.render(0);
    }, pitch);
    const png = `${OUT}/${cell.tag}-p${pitch}.png`;
    await page.screenshot({ path: png, animations: 'disabled' });
    pngs.push(png);
  }

  const dom = await page.evaluate(READ);
  await page.close();

  check(`${tag} no JS exception`, errors.length === 0, errors.slice(0, 2).join(' | '));
  check(`${tag} the plate set is NON-EMPTY`, dom.plates > 0, `plates=${dom.plates}`);

  if (!cell.fighters) {
    // The profile stores 1..LEVEL_MAX; `deserialize` clamps and drops a stored LEVEL_MIN,
    // so 0 and 1 both land on LEVEL_MIN. Both seats mirror (`ENEMY_LEVEL_MODE`).
    const want = String(clampLevel(level));
    check(`${tag} both nameplates read ${want}`,
      dom.rows.length === 2 && dom.rows.every((r) => r.levelText === want),
      JSON.stringify(dom.rows.map((r) => r.levelText)));
    check(`${tag} both badges are DRAWN`, dom.rows.every((r) => r.levelShown), JSON.stringify(dom.rows.map((r) => r.levelShown)));
  } else {
    const chips = dom.rows.filter((r) => r.isChip);
    check(`${tag} six plates, five chips`, dom.plates === 6 && chips.length === 5,
      `plates=${dom.plates} chips=${chips.length}`);
    check(`${tag} the local badge is drawn and every chip's is not`,
      dom.rows[0].levelShown === true && chips.every((r) => r.levelShown === false),
      JSON.stringify(dom.rows.map((r) => r.levelShown)));
    // ⚠️ `?fighters=` carries NO level, so every seat here is LEVEL_MIN. Stated, not
    // asserted as a wiring result — see the header on why this state is vacuous for that.
    check(`${tag} every seat reads level ${LEVEL_MIN} (the ?fighters= transport sets no level)`,
      dom.rows.every((r) => r.levelText === String(LEVEL_MIN)),
      JSON.stringify(dom.rows.map((r) => r.levelText)));
  }
  const over = dom.rows.flatMap((r) => r.overflow.map((o) => `slot${r.slot}:${o}`));
  check(`${tag} nothing in any pill crosses the pill's content box`, over.length === 0, over.join(' | '));
  console.log(`  info - ${tag} top bar bottom ${dom.topbarBottom}px · pills ${JSON.stringify(dom.rows.map((r) => r.pillH))} · name clip ${JSON.stringify(dom.rows.map((r) => r.nameClipped))}`);
  if (pngs.length) console.log(`  info - ${tag} wrote ${pngs.join(' , ')}`);
  return { ...cell, dom, pngs };
}

// ─────────────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH });
const report = { base: BASE, harness: [], game: [] };
try {
  if (SELFTEST) {
    await selftest(browser);
  } else {
    if (!BASE) throw new Error('--url (or PREVIEW_BASE) is required');
    console.log(`\nlk3_level — ${BASE}\n`);
    await selftest(browser);

    console.log('── ARM H: per-slot wiring, on distinct levels ──────────────');
    // 1280 and 667 are ABOVE the 560px name-yield line, 390 is below it — so both
    // sides of that media query are measured rather than only the side that changed.
    for (const vp of [{ tag: 'desk', width: 1280, height: 720 },
                      { tag: 'land667', width: 667, height: 375 },
                      { tag: 'p390', width: 390, height: 844 }]) {
      for (const touch of [false, true]) {
        report.harness.push(...await armH(browser, vp, touch));
      }
    }

    console.log('── ARM G: the shipped path, seeded through the profile ────');
    const desk = { tag: 'desk', width: 1280, height: 720 };
    const p390 = { tag: 'p390', width: 390, height: 844 };
    // 🚨 WAS `{ x: 1400, y: 1000 }` — THE ARENA CENTRE, WHICH IS INSIDE `boiling_pot`
    // (104×104 at 1400,1000). `al_guard`'s "no fixture point inside a CoverBox" arm has
    // been failing on this line and getting reported as "pre-existing, not mine" by six
    // agents in a row, which is how a red gate becomes furniture.
    //
    // The six fighters sit on a ring of radius 190 and were always clear of the 52 wu
    // half-width, so nothing was measured wrong — but the guard cannot tell a construction
    // ORIGIN from a station, and it should not have to. Moved the origin off the prop
    // instead of teaching the guard an exception: an exemption is a thing to maintain, an
    // offset is not.
    //
    // ⚠️ Derived from `ARENA_W`/`ARENA_H` rather than retyped, per CLAUDE.md — the 1× map's
    // centre (700,500) is still a LEGAL point on the ×4 map, so a stale centre here would
    // be invisible to every legality check. Offset by one pot width, north-east, which is
    // open floor at every seat count.
    const ARENA_W = 2800, ARENA_H = 2000;   // mirrors src/arena/shared.ts; al_guard §A polices these
    const CENTER = { x: ARENA_W / 2 + 130, y: ARENA_H / 2 - 130 }, RING = 190;
    const six = CAST.map((id, i) => {
      const a = (i / CAST.length) * Math.PI * 2;
      return `${id}@${Math.round(CENTER.x + Math.cos(a) * RING)},${Math.round(CENTER.y + Math.sin(a) * RING)}`;
    }).join(';');
    const cells = [
      { tag: 'g-lv1-desk', level: 1, vp: desk, shots: true },
      { tag: 'g-lv7-desk', level: 7, vp: desk, shots: true },
      { tag: 'g-lv15-desk', level: 15, vp: desk, shots: true },
      { tag: 'g-lv0-desk', level: 0, vp: desk, shots: false },
      { tag: 'g-lv99-desk', level: 99, vp: desk, shots: false },
      { tag: 'g-lv15-p390', level: 15, vp: p390, shots: true },
      { tag: 'g-six-desk', level: 1, vp: desk, shots: true, fighters: six },
      { tag: 'g-six-p390', level: 1, vp: p390, shots: true, fighters: six },
    ];
    // `--cells g-lv15-desk,g-six-desk` — for a plate run or a smoke test. ⚠️ Filtering
    // DISABLES the HP cross-check below, which needs the level-1 cell; it says so rather
    // than comparing against `null` and reporting a pass.
    const CELLS = arg('--cells', null);
    const wanted = CELLS ? cells.filter((c) => String(CELLS).split(',').includes(c.tag)) : cells;
    for (const c of wanted) report.game.push(await armG(browser, c));

    // 🚨 THE INDEPENDENT CHANNEL. The badge on its own cannot separate "the HUD prints
    // the level correctly" from "the level never left the URL and everything reads 1" —
    // which is exactly the failure the first run of this file found. `maxHpFor` multiplies
    // the pool by `levelHealthMultiplier(level) = 1 + (level-1)*LEVEL_HEALTH_PER_LEVEL`, so
    // the DENOMINATOR of the HP run is a second, unrelated readout of the same number.
    // If it does not move, the badge agreeing with the fixture proves nothing.
    if (CELLS) console.log('  info - --cells was given, so the HP cross-check is SKIPPED (it needs the level-1 cell)');
    else {
    console.log('── cross-check: the HP pool moved with the level ──────────');
    const maxHpOf = (tag) => {
      const cell = report.game.find((c) => c.tag === tag);
      const m = /\/\s*(\d+(?:\.\d+)?)\s*$/.exec(String(cell?.dom?.rows?.[0]?.hpText ?? ''));
      return m ? Number(m[1]) : null;
    };
    const hp1 = maxHpOf('g-lv1-desk');
    for (const [tag, lv] of [['g-lv7-desk', 7], ['g-lv15-desk', 15], ['g-lv99-desk', LEVEL_MAX]]) {
      const got = maxHpOf(tag);
      const want = hp1 === null ? null : Math.round(hp1 * (1 + (clampLevel(lv) - LEVEL_MIN) * HEALTH_PER_LEVEL));
      check(`[X] level ${lv}: the local seat's HP POOL is ${want} (level 1 pool ${hp1} x levelHealthMultiplier)`,
        hp1 !== null && got !== null && got === want, `got ${got}`);
    }
    check('[X] and the pool at level 15 is strictly larger than at level 1 (the arm is not flat)',
      hp1 !== null && maxHpOf('g-lv15-desk') > hp1, `${maxHpOf('g-lv15-desk')} vs ${hp1}`);
    }
  }
} finally {
  await browser.close();
}

if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail) console.log(`failed: ${failures.join(' | ')}\n`);
if (EXPECT_FAIL) {
  console.log(fail > 0
    ? '✅ --expect-fail: it failed, as it must on a tree with no level badge.\n'
    : '🚨 --expect-fail: IT PASSED. This probe cannot tell the two trees apart — it is measuring nothing.\n');
  process.exit(fail > 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
