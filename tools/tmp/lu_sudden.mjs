#!/usr/bin/env node
/**
 * SUDDEN-DEATH HUD ACCEPTANCE — the screen stops instructing the player to reach a
 * place that no longer exists, and the ring floor stops being a constant.
 *
 * ── The two defects ─────────────────────────────────────────────────────────
 * `DECISIONS §2`, in Uri's words: *"after 30 seconds reduce the fog to all screen and
 * the one who has more HP wins. (Sudden Death)"* — shipped in `f87d407`. When it fires
 * `SUDDEN_DEATH_RADIUS` is **0**, so every fighter is outside and everyone burns.
 *
 *   1. COPY. The HUD kept its normal wording: "OUTSIDE THE ZONE", "GET INSIDE",
 *      "RUN TO THE ZONE", plus a 140px chevron pointing at the arena centre. Three
 *      instructions and an arrow, all aimed at a safe zone of radius zero.
 *   2. THE RING FLOOR. `zoneInfo`'s `holds` compared against the bare `MIN_SAFE_RADIUS`
 *      constant, which stopped being the floor twice over — `4bb64e4` made it scale
 *      with the seat count (140 at N<=4, 187.42 at N=5, **237.00 at N=6**) and
 *      `f87d407` collapses it to 0. The two break it in OPPOSITE directions:
 *        * in sudden death, `dist <= 140` still says "FINAL RING" — *the edge will
 *          never reach you* — while the fog burns at 50 HP/s;
 *        * at N=6, 140 < dist <= 237 says NOT-holds, so the pill counts down to an
 *          arrival that never happens.
 *      Both are `DECISIONS §13`'s class: a screen showing a number the model does not
 *      compute.
 *
 * ── KNOWN-BAD INPUT (`CLAUDE.md` §6) ────────────────────────────────────────
 * `--known-bad` re-runs every arm with the PRE-FIX predicate restored page-side: the
 * copy branch is disabled and `holds` is recomputed against the flat 140. Every arm
 * below must FAIL there. An arm that passes on the pre-fix behaviour is testing nothing,
 * and the run exits non-zero naming it.
 *
 * ⚠️ `?fogRadius=` BELOW 661.67 wu NOW SNAPS TO THE SUDDEN-DEATH FRAME with a console
 * warning (`f87d407`). That is how this probe reaches the state at all — `fogRadius=0` —
 * and it is also a migration trap for every older HUD station that requested 260-300.
 *
 *   node tools/tmp/headserve.mjs --ref <sha> --overlay src/ui/hud.ts -- node tools/tmp/lu_sudden.mjs
 *   node tools/tmp/lu_sudden.mjs --url <snapshot> --known-bad
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv.slice(2);
const has = (k) => a.includes(k);
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (get('--url', process.env.PREVIEW_BASE) ?? 'http://localhost:5188').replace(/\/$/, '');
const SAVE = get('--save', null);
const KNOWN_BAD = has('--known-bad');
/**
 * 🚨 A SECOND KNOWN-BAD, BECAUSE THE FIRST ONE CANNOT REACH TWO OF THE ARMS.
 * `--known-bad` restores the PRE-FIX WORDING, which is the right negative for the copy,
 * the cap and the chevron. It is the wrong negative for the two OVERFLOW arms: the old
 * strings fit too, so those arms passed on it and the verdict called them tautological.
 * They were not — they guard against a string that is too LONG, and the pre-fix string
 * is not one. So they get the negative they are actually about: an over-long run written
 * into the same three elements, which every fit check must REFUSE.
 */
const KNOWN_BAD_LONG = has('--known-bad-long');
const LONG = 'SUDDEN DEATH IN THE KITCHEN ARENA RIGHT NOW';

/** The narrowest landscape phone this project measures, the common one, and portrait. */
const VPS = [
  { tag: 'ph-667', w: 667, h: 375 },
  { tag: 'ph-844', w: 844, h: 390 },
  { tag: 'p-360', w: 360, h: 800 },
];
/**
 * 🚨 THE ARENA CENTRE IS READ FROM THE LIVE ARENA, NOT WRITTEN DOWN HERE — and the first
 * version of this file wrote it down. It copied `np_nfighter`'s fixture, `{700, 500}`,
 * which was the kitchen's centre until the x4 map landed (`DECISIONS §53`). It is now
 * **{1400, 1000}**, so a fighter placed 180 wu from `{700, 500}` is really **721 wu**
 * from the ring's actual centre. The FLOOR arm then read "REACHES YOU 0:05" and looked
 * exactly like the bug it was written to catch — a fixture fault wearing the costume of
 * a regression, which is the most expensive kind of wrong answer this project produces.
 * Derived per run through `window.__matchArena`, so the next arena resize cannot do it
 * again, and the arm asserts the distance it actually achieved before scoring anything.
 */
const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'pizza'];
let CENTRE = { x: 1400, y: 1000 };   // replaced by a live read before any arm runs
const roster = (n, radius) => CAST.slice(0, n).map((id, i) => {
  const ang = (i / n) * Math.PI * 2;
  return `${id}@${Math.round(CENTRE.x + Math.cos(ang) * radius)},${Math.round(CENTRE.y + Math.sin(ang) * radius)}`;
}).join(';');

let pass = 0, fail = 0;
const armed = [];
const check = (name, ok, detail = '') => {
  if (ok) pass++; else fail++;
  armed.push({ name, ok });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${name}${detail ? `   ${detail}` : ''}`);
};

async function open(browser, vp, query) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120_000 });
  await page.evaluate(() => document.documentElement.classList.add('fa-touch-capable', 'fa-touch'));
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

/**
 * 🚨 THE KNOWN-BAD ARM RESTORES THE PRE-FIX BEHAVIOUR IN THE PAGE, not a mutant of it.
 * The copy branch is undone by writing the old strings back over the live elements and
 * re-showing the chevron; `holds` is undone by recomputing it against the flat 140 the
 * way `zoneInfo` used to, from the same live sim state, and rewriting the value cell.
 * Anything that still passes after this is not reading the change.
 */
async function applyKnownBadLong(page) {
  await page.evaluate((long) => {
    for (const sel of ['[data-el="zone-label"]', '[data-el="zone-value"]', '[data-el="radar-cap"]']) {
      const e = document.querySelector(sel);
      if (e) e.textContent = long;
    }
  }, LONG);
  await page.waitForTimeout(150);
}

async function applyKnownBad(page) {
  await page.evaluate(() => {
    const st = window.__matchDebug ? window.__vfxDebugFighters : null;
    const zl = document.querySelector('[data-el="zone-label"]');
    const zv = document.querySelector('[data-el="zone-value"]');
    const cap = document.querySelector('[data-el="radar-cap"]');
    const arrow = document.querySelector('[data-el="safearrow"]');
    const alab = document.querySelector('[data-el="safearrow-label"]');
    if (zl) zl.textContent = '▲ OUTSIDE THE ZONE';
    if (cap) cap.textContent = 'GET INSIDE';
    if (arrow) arrow.style.display = 'block';
    if (alab) alab.style.display = 'block';
    // The pre-fix `holds`: the flat 140 constant, against the live local fighter.
    const me = st?.slots?.[0] ?? st?.player;
    const c = window.__matchArena?.center;
    if (zv && me && c) {
      const d = Math.hypot(me.x - c.x, me.y - c.y);
      zv.textContent = d <= 140 ? 'FINAL RING' : 'REACHES YOU 0:07';
    }
    window.__luKnownBad = true;
  });
  await page.waitForTimeout(150);
}

async function read(page) {
  return page.evaluate(() => {
    const txt = (s) => document.querySelector(s)?.textContent?.trim() ?? null;
    const shown = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).display !== 'none' : false; };
    // 🚨 `scrollWidth - clientWidth` IS BLIND HERE, AND `--known-bad-long` PROVED IT.
    // A 43-character run written into these three elements produced **over = 0 at 12 of
    // 12** cells: the runs are `white-space: nowrap` inside a fixed-width pill, so the
    // text paints outside the box without the box's scroll metrics ever moving. The
    // check was a tautology in the harmful sense — it could not fail, and it would have
    // shipped green under any wording. Measure the TEXT instead: a Range over the
    // element's own contents reports where the glyphs actually are, and that is compared
    // against the pill's content box by the caller.
    const fit = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const rng = document.createRange();
      rng.selectNodeContents(e);
      const t = rng.getBoundingClientRect();
      return { textW: t.width, textX: t.x, textRight: t.x + t.width, w: r.width, x: r.x, right: r.x + r.width };
    };
    // ⚠️ AND THE ROOM IS THE ANCESTOR'S, NOT THE ELEMENT'S OWN. Second blind spot found
    // by `--known-bad-long`: these runs are FLEX ITEMS, so a 292px string simply makes
    // the item 292px wide and it overflows the 156px pill AROUND it while its own
    // `clientWidth` matches its own text exactly. Measuring a child against itself can
    // never fail. The container's CONTENT box is the budget, so that is what is returned
    // and what every caller compares against.
    const inner = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const l = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.borderLeftWidth || '0');
      const rt = parseFloat(cs.paddingRight || '0') + parseFloat(cs.borderRightWidth || '0');
      return { x: r.x + l, right: r.x + r.width - rt };
    };
    const radar = document.querySelector('.hud-radar')?.getBoundingClientRect() ?? null;
    return {
      label: txt('[data-el="zone-label"]'), value: txt('[data-el="zone-value"]'),
      cap: txt('[data-el="radar-cap"]'),
      arrow: shown('[data-el="safearrow"]'), arrowLabel: shown('[data-el="safearrow-label"]'),
      labelFit: fit('[data-el="zone-label"]'), valueFit: fit('[data-el="zone-value"]'),
      capFit: fit('[data-el="radar-cap"]'),
      zoneFit: fit('[data-el="zone"]'),
      zoneInner: inner('[data-el="zone"]'),
      radar: radar ? { x: radar.x, right: radar.x + radar.width, w: radar.width } : null,
      // ⚠️ THE BUDGET IS THE MAP, NOT THE CARD. `--known-bad-long` caught this too: a
      // 300px cap made `.hud-radar` 300px wide, so "the cap fits inside the card" was
      // true at 355..655 vs 355..655 — the card had simply grown to fit it. `.hud-radar-map`
      // is the fixed part (105px at <=720) and the only thing here with a width of its own.
      map: (() => { const m = document.querySelector('.hud-radar-map')?.getBoundingClientRect(); return m ? { w: m.width } : null; })(),
      vw: window.innerWidth,
    };
  });
}

const browser = await chromium.launch({ args: LAUNCH });
if (KNOWN_BAD) console.log('⚠️  --known-bad: the PRE-FIX WORDING is restored page-side. Every COPY arm must FAIL.\n');
if (KNOWN_BAD_LONG) console.log(`⚠️  --known-bad-long: "${LONG}" is written into all three runs. Every FIT arm must FAIL.\n`);

// Read the live arena before building any fixture. One cheap load; everything below
// depends on it, so it is not an optimisation to skip.
{
  const { ctx, page } = await open(browser, VPS[1], 'player=hamburger&enemy=donut&fogRadius=900&simSpeed=0.02&pointerLock=0');
  const arena = await page.evaluate(() => ({
    c: window.__matchArena?.center ?? null, maxR: window.__matchArena?.maxSafeRadius ?? null,
  }));
  await ctx.close();
  if (!arena.c) { console.log('lu_sudden: could not read window.__matchArena — aborting'); process.exit(1); }
  CENTRE = arena.c;
  console.log(`[lu_sudden] live arena centre ${CENTRE.x},${CENTRE.y}  maxSafeRadius ${arena.maxR}\n`);
}

// ── A. SUDDEN DEATH, N=2 and N=6, at three viewports ────────────────────────
for (const n of [2, 6]) {
  for (const vp of VPS) {
    const t = `[SD n=${n} ${vp.tag}]`;
    const q = n === 2
      ? 'player=hamburger&enemy=donut&px=760&py=500&fogRadius=0&simSpeed=0.02&pointerLock=0'
      : `fighters=${encodeURIComponent(roster(6, 60))}&fogRadius=0&simSpeed=0.02&pointerLock=0`;
    const { ctx, page, errs } = await open(browser, vp, q);
    if (KNOWN_BAD) await applyKnownBad(page);
    if (KNOWN_BAD_LONG) await applyKnownBadLong(page);
    const r = await read(page);
    if (errs.length) console.log(`       ⚠️ page errors: ${errs.slice(0, 2).join(' | ')}`);
    check(`${t} the zone pill names SUDDEN DEATH, not "OUTSIDE THE ZONE"`,
      /SUDDEN DEATH/.test(r.label ?? ''), `label = ${JSON.stringify(r.label)}`);
    check(`${t} the value says how it resolves, not a burn rate`,
      r.value === 'MOST HP WINS', `value = ${JSON.stringify(r.value)}`);
    check(`${t} the radar cap stops saying GET INSIDE`,
      r.cap === 'SUDDEN DEATH', `cap = ${JSON.stringify(r.cap)}`);
    check(`${t} the "run this way" chevron and its label are HIDDEN`,
      !r.arrow && !r.arrowLabel, `chevron ${r.arrow}, label ${r.arrowLabel}`);
    // Overflow: the pill's own runs must not be clipped, and the cap must stay inside
    // the radar card it hangs off — neither has a width of its own to clip against.
    const zi = r.zoneInner;
    const within = (f) => !!f && !!zi && f.textX >= zi.x - 0.5 && f.textRight <= zi.right + 0.5;
    check(`${t} neither new run overflows the zone pill`,
      within(r.labelFit) && within(r.valueFit),
      `label ${Math.round(r.labelFit?.textW ?? 0)}px, value ${Math.round(r.valueFit?.textW ?? 0)}px, `
      + `pill content ${Math.round(zi?.x ?? 0)}..${Math.round(zi?.right ?? 0)} (${Math.round((zi?.right ?? 0) - (zi?.x ?? 0))}px)`);
    // +8 is the cap's own chrome: a 2px border each side plus a pixel of rounding. The
    // cap is a shrink-to-fit pill, so this is the one number that decides whether it can
    // widen the card it hangs off.
    check(`${t} the cap pill fits the radar map's width and stays on screen`,
      !!r.capFit && !!r.map && r.capFit.x >= -0.5 && r.capFit.right <= r.vw + 0.5
        && r.capFit.w <= r.map.w + 8.5,
      `cap ${Math.round(r.capFit?.w ?? 0)}px against a ${Math.round(r.map?.w ?? 0)}px map `
      + `(card is ${Math.round(r.radar?.w ?? 0)}px)`);
    if (SAVE) { await mkdir(SAVE, { recursive: true }); await page.screenshot({ path: `${SAVE}/sd-n${n}-${vp.tag}${KNOWN_BAD ? '-knownbad' : ''}.png` }); }
    await ctx.close();
  }
}

// ── B. THE RING FLOOR AT N=6, WITHOUT sudden death ──────────────────────────
// The local fighter stands 180 wu from the centre: OUTSIDE the old flat 140 and INSIDE
// the real N=6 floor of 237.00. The edge stops at 237, so it can never reach 180 — the
// pill must say FINAL RING. Pre-fix it printed a countdown to an arrival that never
// happens, which is precisely what `holds` was written to prevent.
{
  const vp = VPS[1];
  const t = '[FLOOR n=6 180wu]';
  // fogRadius must stay ABOVE 661.67 or the station snaps into sudden death and this
  // arm silently becomes a second copy of arm A.
  // 180 wu: OUTSIDE the old flat 140 and INSIDE the real N=6 floor of ~237.
  const q = `fighters=${encodeURIComponent(roster(6, 180))}&fogRadius=900&simSpeed=0.02&pointerLock=0`;
  const { ctx, page, errs } = await open(browser, vp, q);
  if (KNOWN_BAD) await applyKnownBad(page);
  if (KNOWN_BAD_LONG) await applyKnownBadLong(page);
  const r = await read(page);
  if (errs.length) console.log(`       ⚠️ page errors: ${errs.slice(0, 2).join(' | ')}`);
  const guard = await page.evaluate(() => {
    const me = window.__vfxDebugFighters?.slots?.[0];
    const c = window.__matchArena?.center;
    return { dist: me && c ? Math.hypot(me.x - c.x, me.y - c.y) : null, n: window.__vfxDebugFighters?.slots?.length ?? 0 };
  });
  // The arm is only meaningful at the distance and seat count it claims.
  check(`${t} the fixture really seats 6 with the local fighter between 140 and 237 wu`,
    guard.n === 6 && guard.dist > 140 && guard.dist < 237,
    `n=${guard.n}, dist=${guard.dist?.toFixed(1)}`);
  check(`${t} the pill says FINAL RING, not a countdown to an edge that stops short`,
    r.value === 'FINAL RING', `value = ${JSON.stringify(r.value)}`);
  if (SAVE) await page.screenshot({ path: `${SAVE}/floor-n6${KNOWN_BAD ? '-knownbad' : ''}.png` });
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();

const FIT = /overflows the zone pill|fits the radar map/;
// The fixture guard is a property of the FIXTURE, not of the fix, so it survives every
// negative by design and is scored in neither verdict.
const FIXTURE = /the fixture really seats/;

if (KNOWN_BAD || KNOWN_BAD_LONG) {
  // Each negative scores only the arms it can actually reach. A verdict that demanded
  // every arm fail on every negative is what produced this file's first false
  // "TAUTOLOGICAL: 12 of 37" — the fit arms were correct and the VERDICT was wrong.
  const scored = armed.filter((r) => !FIXTURE.test(r.name) && (KNOWN_BAD_LONG ? FIT.test(r.name) : !FIT.test(r.name)));
  const which = KNOWN_BAD_LONG ? 'the over-long run' : 'the pre-fix wording';
  const survivors = scored.filter((r) => r.ok);
  if (!scored.length) { console.log(`\n🚨 this negative scored NOTHING — check the arm filter`); process.exit(1); }
  if (survivors.length) {
    console.log(`\n🚨 TAUTOLOGICAL: ${survivors.length} of ${scored.length} arms PASSED on ${which}:`);
    for (const s of survivors) console.log(`   ${s.name}`);
    process.exit(1);
  }
  console.log(`\n✓ all ${scored.length} arms in scope FAILED on ${which}, as they must`);
  process.exit(0);
}
process.exit(fail ? 1 : 0);
