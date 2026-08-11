#!/usr/bin/env node
/**
 * §49f — DOES THE CHIP LAYOUT ACTUALLY EXIST, AND IS IT A DESIGN RATHER THAN A CONSEQUENCE?
 *
 * `h49_ab.mjs` proves a two-fighter match cannot tell this pass happened. That is the
 * safety half. This is the other half: above two seats, does the top bar do the thing Uri
 * asked for — *"Local seat full, others as chips"* — and does it do it at a landscape phone
 * as well as at a desktop.
 *
 * ── 🚨 IT IS ALSO `h49_ab`'s MISSING POSITIVE CONTROL, AND THAT IS ITS MAIN JOB ──
 *
 * Every field `h49_ab` compares comes back IDENTICAL, which is the result this pass wants
 * — and is therefore exactly the result an overlay that silently did nothing would also
 * produce. `np_identity --swap` cannot tell those apart: it permutes two URL parameters,
 * so it moves under a pristine tree just as happily. **Run this file against BOTH arms.**
 *
 *   node tools/tmp/headserve.mjs --ref <sha> --overlay src/ui/hud.ts -- node tools/tmp/h49_chips.mjs
 *       -> must PASS
 *   node tools/tmp/headserve.mjs --ref <sha>                          -- node tools/tmp/h49_chips.mjs
 *       -> must FAIL, on the grid, the rail and the chip count
 *
 * That pair is the deliberate break. A run that passes on both is measuring nothing.
 * `--expect-fail` inverts the exit code so the pristine arm can be scripted.
 *
 * ── WHAT IT ASSERTS, AND WHY EACH ONE IS NOT TAUTOLOGICAL ───────────────────
 *
 *  1. **THE TOP BAR IS A GRID ABOVE TWO SEATS AND A FLEX ROW AT TWO.** Read off
 *     `getComputedStyle`, not off the class list: a class that no rule selects is this
 *     project's recorded "the state never reaches the screen" failure, and a className
 *     check would pass straight through it.
 *  2. **THE RAIL EXISTS IFF n > 2**, and holds exactly n-1 chips. A HUD that built the
 *     rail at two fighters would break `h49_ab`; one that built it and left it empty
 *     would pass a count of `.hud-fighter`.
 *  3. **THE LOCAL SEAT IS NOT A CHIP AND IS NOT SQUEEZED.** Its width at n=6 is compared
 *     against its own width at n=2 ON THE SAME VIEWPORT. That is the whole complaint in
 *     §49f expressed as a number: today it is ~45% of design width, and the claim being
 *     made is that it is 100%.
 *  4. 🚨 **THE CLOCK IS CENTRED**, |centre - viewport centre| <= 2px. This is the
 *     assertion the old layout FAILS — measured, the clock's centre sat at x=288 of 1280
 *     at six fighters — so it is the one check here that a pristine tree cannot satisfy by
 *     accident, and it is why it is stated in pixels rather than as "looks centred".
 *  5. 🚨 **NO TWO HUD LANDMARKS OVERLAP AND NONE LEAVES THE VIEWPORT** — the same pairwise
 *     test `menu_accept_portrait` runs, with two extensions that are the reason this check
 *     earns its keep rather than restating that one:
 *       * PER CHIP, not per first-match. `querySelector('.hud-fighter--enemy')` sees one
 *         member of a rail whose whole point is that its members do not collide.
 *       * `.hud-radar` AND `.hud-weapons` ARE IN THE SET, and BOTH DOM STATES ARE WALKED.
 *         `html.fa-touch-capable` moves the radar into the TOP-RIGHT CORNER — the corner
 *         the rail grows from — and the radar is a SIBLING of the top bar, so a probe
 *         walking only the bar's own children cannot see the collision at all. This found
 *         a real one: the rail overlapped the radar at all three portrait widths and at
 *         none of them in the plain state, i.e. entirely inside the state nobody watched.
 *  6. **EVERY CHIP CARRIES ITS OWN SLOT'S PORTRAIT AND ITS OWN SLOT'S HP FRACTION.**
 *     The chip drops the name text and the numeric HP (48px holds neither at a weight this
 *     HUD would ship), so the portrait and the fill ARE the readout and they are what has
 *     to be checked. `np_nfighter` still checks the name and the number, but above two
 *     seats those are now assertions about the DOM's wiring rather than about something a
 *     player reads — this closes that gap rather than leaving it implied.
 *  7. **THE GUARD SELECTOR FAMILIES STILL SELECT WHAT THEY THINK THEY DO**, counted at
 *     n=2 and n=6: `menu_accept_portrait`'s `.hud-fighter--player` / `.hud-fighter--enemy`
 *     / `.hud-clock`, and `cw_conceal_view`'s `[data-el="radar-enemy"]` /
 *     `[data-el="float-enemy"]`. A guard that silently stops matching is this project's
 *     most expensive recurring failure.
 *
 *   node tools/tmp/h49_chips.mjs --url http://127.0.0.1:1234
 *   node tools/tmp/h49_chips.mjs --shots-only        # plates, no verdict
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/h49`));
const EXPECT_FAIL = has('--expect-fail');
const SHOTS_ONLY = has('--shots-only');
const FRAMES = Number(arg('--frames', 45));
/**
 * 🚨 `--warm`: RENDER THE PORTRAITS BEFORE THE PLATE, BECAUSE THE CHIP IS ITS PORTRAIT.
 *
 * This probe deep-links straight into a match through `?fighters=`, which is the right
 * fixture for the layout and the WRONG one for judging the chip: `hud.ts:setCharacters`
 * calls `hydratePortraits(root, { generate: false })` — a cache READ, deliberately, so a
 * match start never stands up an offscreen renderer — and nothing has warmed that cache,
 * so every portrait falls back to the generic fighter mark. The first plate this file
 * produced showed five identical grey silhouettes, and a chip that has dropped its name
 * text is then carrying NO identity at all. Read as a design judgement, that plate is a
 * lie about the shipped game.
 *
 * In the shipped flow it cannot happen: every route to a match goes through character
 * select, `thumbs.ts:demandedIds` returns the WHOLE roster while `window.__screen ===
 * 'characters'`, and `requestThumbnails` fills the cache for all eleven — verified in the
 * source, not assumed. `--warm` reproduces that state the cheap way: it calls the shipped
 * `hydratePortraits(document)` (generate defaults to TRUE) from the match screen, where
 * `demandedIds` resolves to exactly the `[data-portrait]` hosts on the page — i.e. the six
 * fighters in this HUD — and waits on `window.__thumbsReady`, never on a timeout. A fixed
 * wait here once manufactured a "blank roster card" bug that a critic scored twice.
 *
 * Off by default: it costs ~20-40 s per capture under SwiftShader and changes no assertion.
 */
const WARM = has('--warm');

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/**
 * VIEWPORTS. `desk` is the width §49f was photographed at, so the before/after is a
 * like-for-like. `land` is a landscape phone above the 720px breakpoint and `narrow` is one
 * below it — the two sides of the media query the chip rail is re-sized in, which is the
 * only place its arithmetic can be wrong.
 */
const ALL_VIEWPORTS = [
  { tag: 'desk', width: 1280, height: 720 },
  { tag: 'land', width: 844, height: 390 },
  { tag: 'narrow', width: 667, height: 375 },
  // 🚨 THE THREE WIDTHS `menu_accept_portrait` MEASURES, AND THE HARDEST CASE FOR A
  // RIGHT-HAND RAIL BY A LONG WAY. At 390 the side track is (390 - 28 - 156 - 20)/2 =
  // 93px against five 40px chips, so the rail CANNOT fit on one row and the question is
  // what it does instead. Measured rather than assumed — see the wrap assertions.
  { tag: 'p360', width: 360, height: 800 },
  { tag: 'p390', width: 390, height: 844 },
  { tag: 'p430', width: 430, height: 932 },
];
/** `--vp desk,land` / `--sizes 3,4,6` — for a plate run, which is 12 captures otherwise.
 *  ⚠️ Filtering DISABLES the local-bar comparison, which needs n=2 on the same viewport.
 *  It says so rather than silently comparing against `undefined`. */
const VP_FILTER = arg('--vp', null);
const VIEWPORTS = VP_FILTER
  ? ALL_VIEWPORTS.filter((v) => String(VP_FILTER).split(',').includes(v.tag))
  : ALL_VIEWPORTS;
const SIZES = String(arg('--sizes', '2,3,4,6')).split(',').map(Number);
/** `--touch` also runs every cell with `html.fa-touch-capable`. See `shoot`. */
const TOUCH = has('--touch');

/**
 * The fixture, lifted verbatim from `np_nfighter.mjs` so the two probes photograph the same
 * match. ⚠️ The coordinates live in the PROBE — `DECISIONS §49d` says 4-6 fighter placement
 * is the arena pass's call and `sim.ts` throws rather than inventing a ring. A measuring
 * fixture, not a spawn policy; nothing shipped reads it.
 */
/**
 * ⚠️ WAS `const CENTER = { x: 700, y: 500 };` — **the 1× map's centre**, 1,077 wu from the
 * shipped one.
 *
 * 🚨 This is `np_nfighter`'s defect, in the file that says on the line above that it was
 * *"lifted verbatim from `np_nfighter.mjs`"*. That tool was fixed (DECISIONS §65: *"62
 * passed, 0 failed with its measuring ring 1,077 wu off centre"*); **the copy was not**,
 * and this file is a REGISTERED GATE, so it has been green the whole time.
 *
 * The consequence is not cosmetic. `rosterParam` lays the cast on a 190 wu ring about
 * this point and the probe loads `?fogRadius=900`; measured against the shipped arena,
 * **two of the six seats land 1,021 and 1,036 wu from the true centre — outside the
 * requested ring, taking 50 HP/s from the first tick**, with the death-zone wash over
 * the frame this tool exists to photograph. Re-centred, all six are inside the ring and
 * clear of every `CoverBox`.
 */
const CENTER = { x: 1400, y: 1000 };   // tools/arena.gameplay.json `center`
const RING = 190;
const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'pizza'];
const rosterParam = (n) => CAST.slice(0, n).map((id, i) => {
  const a = (i / n) * Math.PI * 2;
  return `${id}@${Math.round(CENTER.x + Math.cos(a) * RING)},${Math.round(CENTER.y + Math.sin(a) * RING)}`;
}).join(';');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

/**
 * ⚠️ THE TWO DOM STATES, BECAUSE THEY ARE LAID OUT BY DIFFERENT RULES — the same split
 * `menu_accept_portrait` makes. `html.fa-touch-capable` is a real phone and moves the
 * radar into the TOP-RIGHT CORNER, which is the corner this pass just filled with a chip
 * rail. Plain is a desktop browser at a portrait window, and every headless probe in
 * `tools/`. Measuring only the plain state would mean the collision that can actually
 * happen is the one nothing looks at.
 */
async function shoot(browser, n, vp, { shot = true, touch = false } = {}) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  // Same frozen clock and seeded RNG as `np_identity`/`np_nfighter`: paused at zero from
  // the first instruction, so every millisecond the match sees is one this file handed it.
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = true; let virt = 0; const base = realNow();
    performance.now = () => (paused ? virt : realNow() - base);
    window.__clk = { advance(ms) { virt += ms; } };
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.goto(`${BASE}/?fighters=${encodeURIComponent(rosterParam(n))}&fogRadius=900&simSpeed=1&pointerLock=0`,
    { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
  // ⚠️ THE MATCH'S OWN STAGE, PINNED BEFORE ANYTHING ELSE CAN BUILD ONE. `window.__stage`
  // is a single slot overwritten by the last `Stage` constructed, and `--warm` below asks
  // `thumbs.ts` to stand up an offscreen renderer. Suppressing the shake on, and rendering,
  // whatever happened to be built last is how a probe photographs a different scene.
  await page.evaluate(() => { window.__h49Stage = window.__stage; });
  if (WARM) {
    await page.evaluate(async () => {
      const p = await import('/src/ui/icons/portraits.ts');
      p.hydratePortraits(document);
    });
    await page.waitForFunction(() => window.__thumbsReady === true, null, { timeout: 600_000 });
  }
  await page.evaluate(async (frames) => {
    for (let i = 0; i < frames; i++) {
      window.__clk.advance(16.667);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
  }, FRAMES);
  await page.evaluate(() => {
    const stage = window.__h49Stage;
    const rig = stage.rig;
    rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
    stage.render(0);
  });
  // Toggled the same way `menu_accept_portrait` does it — after load, then a settle beat —
  // rather than through `addInitScript`, whose `document.documentElement` is not reliably
  // there at document-creation time.
  if (touch) {
    await page.evaluate(() => {
      document.documentElement.classList.add('fa-touch-capable', 'fa-touch');
    });
    await page.waitForTimeout(180);
  }

  let png = null;
  if (shot) {
    png = `${OUT}/n${n}-${vp.tag}${WARM ? '-warm' : ''}.png`;
    // ⚠️ `animations: 'disabled'`. CSS animations run on the DOCUMENT timeline, not rAF, so
    // freezing the clock does NOT still `hud-lowhp-pulse` or `hud-zone-alarm` — and a chip's
    // low-HP pulse is a box-shadow that would land differently in every plate.
    await page.screenshot({ path: png, animations: 'disabled' });
  }

  const data = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
    };
    const topbar = document.querySelector('.hud-topbar');
    const chips = [...document.querySelectorAll('.hud-fighter--chip')];
    const plates = [...document.querySelectorAll('.hud-fighter')];
    const de = document.documentElement;
    const sel = (s) => document.querySelectorAll(s).length;

    // The pairwise overlap test, per CHIP rather than per first-match — the whole point of
    // a rail is that its members do not collide, and `querySelector` would see one of them.
    // 🚨 `.hud-radar` IS IN THIS LIST AND IT IS THE REASON THE TOUCH DOM STATE EXISTS.
    // `html.fa-touch-capable` moves the radar to the TOP-RIGHT (`top: safe-t + 96px`, and
    // `safe-t + 118px` below 400px wide) — i.e. into the corner the chip rail grows from.
    // A rail that wraps to three rows on a portrait phone lands on it, and no probe that
    // only walks `.hud-topbar`'s own children can see that: the radar is a sibling.
    // `.hud-weapons` is here for the same reason at the other end of the frame.
    const landmarks = [
      ['.hud-fighter--player', box(document.querySelector('.hud-fighter--player'))],
      ['.hud-clock', box(document.querySelector('.hud-clock'))],
      ['.hud-radar', box(document.querySelector('.hud-radar'))],
      ['.hud-weapons', box(document.querySelector('.hud-weapons'))],
      ...chips.map((c, i) => [`chip[${i + 1}]`, box(c)]),
    ].filter(([, b]) => b && b.w > 2 && b.h > 2);
    const pairs = [];
    for (let i = 0; i < landmarks.length; i++) {
      for (let j = i + 1; j < landmarks.length; j++) {
        const [na, a] = landmarks[i]; const [nb, b] = landmarks[j];
        const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
        const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
        if (ox > 0.5 && oy > 0.5) pairs.push(`${na} x ${nb} ${Math.round(ox)}x${Math.round(oy)}`);
      }
    }
    const outside = landmarks
      .filter(([, z]) => z.x < -1 || z.y < -1 || z.r > de.clientWidth + 1 || z.b > de.clientHeight + 1)
      .map(([nm, z]) => `${nm} L${Math.round(z.x)} T${Math.round(z.y)} R${Math.round(de.clientWidth - z.r)}`);

    return {
      vw: de.clientWidth,
      vh: de.clientHeight,
      topbarDisplay: topbar ? getComputedStyle(topbar).display : null,
      topbarClass: topbar ? topbar.className : null,
      topbarBottom: topbar ? Math.round(topbar.getBoundingClientRect().bottom) : null,
      rail: box(document.querySelector('.hud-chips')),
      railCount: document.querySelectorAll('.hud-chips').length,
      chips: chips.length,
      plates: plates.length,
      localIsChip: document.querySelector('.hud-fighter--player')?.classList.contains('hud-fighter--chip') ?? null,
      local: box(document.querySelector('.hud-fighter--player')),
      clock: box(document.querySelector('.hud-clock')),
      pairs,
      outside,
      // Per chip, in document order = slot order: which character it shows, and how full
      // its bar is. The portrait id comes off `portraitMarkup`'s own `data-portrait`.
      chipPortraits: chips.map((c) => c.querySelector('[data-portrait]')?.getAttribute('data-portrait') ?? null),
      chipFills: chips.map((c) => c.querySelector('.hud-healthbar-fill')?.style.width ?? null),
      chipNameShown: chips.map((c) => getComputedStyle(c.querySelector('.hud-fighter-name')).display),
      chipHpShown: chips.map((c) => getComputedStyle(c.querySelector('.hud-healthbar-text')).display),
      // The chip's HP text is present and NOT drawn (see the CSS), so it is the only place
      // the denominator survives: `VfxFighterSnapshot` publishes `hp` but no `maxHp`.
      chipHpText: chips.map((c) => c.querySelector('.hud-healthbar-text')?.textContent ?? null),
      // What the sim says, so the fills above can be checked against something.
      slots: window.__vfxDebugFighters?.slots ?? null,
      selectors: {
        'hud-fighter--player': sel('.hud-fighter--player'),
        'hud-fighter--enemy': sel('.hud-fighter--enemy'),
        'hud-clock': sel('.hud-clock'),
        'hud-radar-dot--player': sel('.hud-radar-dot--player'),
        'hud-radar-dot--enemy': sel('.hud-radar-dot--enemy'),
        'data-el=player-name': sel('[data-el="player-name"]'),
        'data-el=enemy-name': sel('[data-el="enemy-name"]'),
        'data-el=player-hp': sel('[data-el="player-hp"]'),
        'data-el=enemy-hp': sel('[data-el="enemy-hp"]'),
        'data-el=radar-enemy': sel('[data-el="radar-enemy"]'),
        'data-el=float-enemy': sel('[data-el="float-enemy"]'),
        'data-el=float-player': sel('[data-el="float-player"]'),
        'hud-float': sel('.hud-float'),
        'hud-weapon-slot': sel('.hud-weapon-slot'),
      },
    };
  });
  await page.close();
  return { ...data, png, errors, n, vp: vp.tag };
}

mkdirSync(OUT, { recursive: true });
console.log(`\nh49_chips — ${BASE}\n`);
const browser = await chromium.launch({ args: LAUNCH });
const seen = {};
try {
  for (const vp of VIEWPORTS) {
    for (const n of SIZES) {
     for (const touch of (TOUCH ? [false, true] : [false])) {
      const r = await shoot(browser, n, vp, { touch, shot: !touch });
      if (!touch) seen[`${n}|${vp.tag}`] = r;
      if (SHOTS_ONLY) { console.log(`   wrote ${r.png}`); continue; }
      const tag = `[n=${n} ${vp.tag} ${r.vw}x${r.vh}${touch ? ' TOUCH' : ''}]`;
      console.log(`── ${tag} ──────────────────────────────────`);
      // Printed, never scored: the top bar's own height is what a wrapped rail costs the
      // play area, and it is the number a future portrait gate would be pinned to. It is
      // reported rather than asserted because no shipped path seats more than two yet, so
      // there is no budget to hold it against that would not be invented here.
      console.log(`  info - ${tag} top bar is ${r.topbarBottom}px tall (${((r.topbarBottom / r.vh) * 100).toFixed(1)}% of the frame)`);
      check(`${tag} no JS exception`, r.errors.length === 0, r.errors.slice(0, 2).join(' | '));

      // 1 + 2 — the layout is SELECTED, not merely classed.
      const want = n > 2 ? 'grid' : 'flex';
      check(`${tag} the top bar computes to ${want}`, r.topbarDisplay === want, `got ${r.topbarDisplay}`);
      check(`${tag} the rail exists iff n>2`, r.railCount === (n > 2 ? 1 : 0), `railCount=${r.railCount}`);
      check(`${tag} ${n - 1} chip(s), ${n} plates`, r.chips === (n > 2 ? n - 1 : 0) && r.plates === n,
        `chips=${r.chips} plates=${r.plates}`);
      check(`${tag} the local seat is not a chip`, r.localIsChip === false, String(r.localIsChip));

      // 4 — the clock is CENTRED. The assertion the squeeze cannot satisfy.
      const clockCx = r.clock ? r.clock.x + r.clock.w / 2 : NaN;
      const off = Math.abs(clockCx - r.vw / 2);
      if (n > 2) {
        check(`${tag} the clock is centred (off by ${off.toFixed(1)}px)`, off <= 2, `centre ${clockCx.toFixed(1)} of ${r.vw}`);
      } else {
        console.log(`  info - ${tag} clock centre off by ${off.toFixed(1)}px (two-seat flex row — NOT asserted)`);
      }

      // 5 — no collisions, nothing off screen.
      check(`${tag} no two HUD landmarks overlap (rail, clock, local bar, radar, tray)`,
        r.pairs.length === 0, r.pairs.join(' | '));
      check(`${tag} no HUD landmark leaves the viewport`, r.outside.length === 0, r.outside.join(' | '));

      if (n > 2) {
        // 6 — the chip's two REAL readouts.
        const wantIds = CAST.slice(1, n);
        check(`${tag} every chip shows ITS OWN slot's portrait, in order`,
          JSON.stringify(r.chipPortraits) === JSON.stringify(wantIds),
          `${JSON.stringify(r.chipPortraits)} != ${JSON.stringify(wantIds)}`);
        // ⚠️ TWO LINKS, AND THE SPLIT IS FORCED BY WHAT THE PAGE PUBLISHES.
        // `VfxFighterSnapshot` (`vfx.ts:116`) carries `x, y, hp, alive, terrainSlowFactor`
        // and NO `maxHp`, so the fraction cannot be rebuilt from the sim alone. The chain
        // asserted instead is:
        //   (a) the chip's own hidden HP text carries ITS OWN slot's sim hp, and
        //   (b) the chip's fill width is the fraction that text states.
        // Together those say "this chip's bar shows this fighter's health". Reading the
        // denominator off the DOM makes (b) a DOM-internal consistency check, which is why
        // (a) — the link to the sim, and the one a pooled HUD would break — is separate.
        const hpTextOk = r.chipHpText.every((t, i) => {
          const f = r.slots?.[i + 1];
          return f && typeof t === 'string' && t.startsWith(`${Math.max(0, Math.ceil(f.hp))} /`);
        });
        check(`${tag} every chip's HP readout carries ITS OWN slot's sim hp`, hpTextOk,
          `${JSON.stringify(r.chipHpText)} vs ${JSON.stringify((r.slots ?? []).slice(1).map((f) => f && Math.ceil(f.hp)))}`);
        // ⚠️ ONE HP OF SLACK, AND IT IS A STATED FLOOR RATHER THAN A GUESSED TOLERANCE.
        // `setBar` writes the width from the RAW hp and the text from `Math.ceil(hp)`, so
        // on a fighter mid-tick the two legitimately disagree by up to one HP — i.e. by
        // `100 / maxHp` percentage points, which is 0.93 pp on a 108-pool fighter. An
        // exact-equality check here would fail on arithmetic the HUD is doing correctly.
        const fillOk = r.chipFills.every((w, i) => {
          const m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(String(r.chipHpText[i] ?? '').trim());
          if (!m || typeof w !== 'string' || !w.endsWith('%')) return false;
          const maxHp = Number(m[2]);
          const wantPct = Math.max(0, Math.min(1, Number(m[1]) / maxHp)) * 100;
          return Math.abs(Number(w.slice(0, -1)) - wantPct) <= 100 / maxHp + 0.05;
        });
        check(`${tag} every chip's fill width is that same fraction (±1 HP)`, fillOk,
          `${JSON.stringify(r.chipFills)} vs ${JSON.stringify(r.chipHpText)}`);
        // The two readouts the chip DROPS — asserted, so the trade is recorded rather than
        // discovered later by someone reading a screenshot.
        check(`${tag} the chip drops the name text and the numeric HP`,
          r.chipNameShown.every((d) => d === 'none') && r.chipHpShown.every((d) => d === 'none'),
          `${JSON.stringify(r.chipNameShown)} / ${JSON.stringify(r.chipHpShown)}`);
      }
     }
    }

    // 3 — the local seat is NOT SQUEEZED: its width at n=6 against its own width at n=2.
    if (!SHOTS_ONLY && seen[`2|${vp.tag}`] && seen[`6|${vp.tag}`]) {
      const a = seen[`2|${vp.tag}`]; const b = seen[`6|${vp.tag}`];
      // ⚠️ "FULL SIZE" IS ASSERTED AS EXACT, NOT AS "BIG ENOUGH". A ratio threshold is a
      // dial someone lowers; §49f's whole complaint is a ratio (~45%), so the answer has to
      // be the number that ratio cannot be argued down from. A first cut capped the local
      // plate at 300px and scored 79% here — passing a 0.75 threshold while being a squeeze.
      const ratio = b.local.w / a.local.w;
      check(`[${vp.tag}] the local bar at six seats is EXACTLY its 1v1 width (${b.local.w.toFixed(0)}px vs ${a.local.w.toFixed(0)}px, ${(ratio * 100).toFixed(1)}%)`,
        Math.abs(b.local.w - a.local.w) <= 0.5, `${b.local.w} / ${a.local.w}`);
    }
  }

  // 7 — the guard selector families, at both ends of the range.
  if (!SHOTS_ONLY && seen['2|desk'] && seen['6|desk']) {
    console.log('── guard selectors ─────────────────────────────────────');
    const at2 = seen['2|desk'].selectors; const at6 = seen['6|desk'].selectors;
    const EXPECT_2 = {
      'hud-fighter--player': 1, 'hud-fighter--enemy': 1, 'hud-clock': 1,
      'hud-radar-dot--player': 1, 'hud-radar-dot--enemy': 1,
      'data-el=player-name': 1, 'data-el=enemy-name': 1, 'data-el=player-hp': 1,
      'data-el=enemy-hp': 1, 'data-el=radar-enemy': 1, 'data-el=float-enemy': 1,
      'data-el=float-player': 1, 'hud-float': 2, 'hud-weapon-slot': 4,
    };
    for (const [k, v] of Object.entries(EXPECT_2)) {
      check(`[n=2] ${k} selects ${v}`, at2[k] === v, `got ${at2[k]}`);
    }
    // At six seats the singletons stay singletons and only the families that are MEANT to
    // grow do. `--enemy` counting 5 is the contract from `3980e6e`: every non-zero slot
    // wears it, and `querySelector` therefore still returns slot 1.
    const EXPECT_6 = {
      'hud-fighter--player': 1, 'hud-fighter--enemy': 5, 'hud-clock': 1,
      'hud-radar-dot--player': 1, 'hud-radar-dot--enemy': 5,
      'data-el=player-name': 1, 'data-el=enemy-name': 1, 'data-el=player-hp': 1,
      'data-el=enemy-hp': 1, 'data-el=radar-enemy': 1, 'data-el=float-enemy': 1,
      'data-el=float-player': 1, 'hud-float': 6, 'hud-weapon-slot': 4,
    };
    for (const [k, v] of Object.entries(EXPECT_6)) {
      check(`[n=6] ${k} selects ${v}`, at6[k] === v, `got ${at6[k]}`);
    }
    check('[n=2] the top bar carries NO chip class', seen['2|desk'].topbarClass === 'hud-topbar',
      JSON.stringify(seen['2|desk'].topbarClass));
  }
} finally {
  await browser.close();
}

if (SHOTS_ONLY) { console.log('\nshots only — no verdict\n'); process.exit(0); }
console.log(`\n${pass} passed, ${fail} failed\n`);
if (EXPECT_FAIL) {
  console.log(fail > 0
    ? '✅ --expect-fail: it failed, as it must on a tree without the chip layout.\n'
    : '🚨 --expect-fail: IT PASSED. This probe cannot tell the two trees apart — it is measuring nothing.\n');
  process.exit(fail > 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
