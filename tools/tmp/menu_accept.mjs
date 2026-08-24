#!/usr/bin/env node
/**
 * Acceptance test for the screen layer (`src/ui/screens/`).
 *
 * Defined BEFORE the critic loop so "better" is a measurement, not a mood. Five
 * checks, all of which must pass on every supported viewport:
 *
 *  1. NO PAGE SCROLL. `document.documentElement` must not overflow in either axis.
 *     Anything that can overflow has to scroll inside its own box.
 *  2. TOUCH TARGETS. Every enabled control is >= 44x44 CSS px.
 *  3. SAFE AREAS. With simulated notch insets injected on <html>, no control's
 *     bounding rect enters the inset band on any edge.
 *  4. HERO IN FRAME. The 3D portrait's bounding box projects fully inside [0,1] on
 *     both axes — no cropped characters.
 *  5. FLOW. boot -> home -> character select -> match (window.__gameReady) ->
 *     back to home, with zero console errors along the way.
 *  6a. HERO FILL. The hero has to be a real presence in the frame, asserted on the
 *     fraction of frame HEIGHT it occupies. It used to be asserted on WIDTH, which is
 *     a function of the panel's aspect and not of the hero at all — and which refused
 *     the reference plate's own composition. See `MIN_HERO_HEIGHT_FRAC` for the
 *     measurements that reversed it; the old wording is kept there.
 *  6b. NOTHING IS DEAD. Every control on the settings screen is asserted to move the
 *     thing it names, read back off the audio engine rather than off the UI that drew
 *     it, and the title card is asserted to unlock audio and to never trap a probe.
 *  7. INPUT PASSTHROUGH. This one exists because of a shipped regression: the
 *     full-viewport `#screens` layer defaulted to `pointer-events: auto` and became
 *     the hit target for every pointer event, so the game canvas received ZERO
 *     mousemove and ZERO mousedown during a match. That silently disabled firing
 *     and froze the fighter's aim-facing, and it is invisible to tsc, to the sim
 *     tests and to screenshots — only a human trying to play finds it. So it is
 *     asserted here with real (not synthetic) mouse events routed through the
 *     browser's own hit testing, in BOTH directions: the canvas must receive events
 *     during a match, and the menus' own buttons must still receive theirs.
 *  8. THE SHOP IS HONEST WHILE IT CANNOT SELL. Added with `src/ui/screens/shop.ts`.
 *     Every box is currently a strict loss (its best possible payout is below its own
 *     price, in all four), so no purchase control may be live — and the screen has to
 *     say so. Both halves are asserted, the same way the gem store's are.
 *  9. THE SCREEN LIST IS DERIVED, AND THE SCREEN THAT MOUNTED IS THE ONE ASKED FOR.
 *     ⚠️ **This file used to iterate a HARDCODED SIX**, and `lobby` (`2d4840e`) and
 *     `admin` (`eb3e44d`) both shipped without joining it: **a screen does not join a
 *     gate by existing.** The list now comes off the router — `tools/tmp/mc_routes.mjs`
 *     parses `types.ts`'s `Route` union and reconciles it against `shell.ts:ROUTE_NAMES`
 *     and `main.ts`'s `?screen=` ladder — so a new screen is IN unless someone writes
 *     down why it is out. And because an unknown `?screen=` value silently lands on the
 *     TITLE CARD rather than erroring, every navigation now asserts `window.__screen`
 *     is the screen it requested. Without that, a route missing from `main.ts`'s ladder
 *     produces a full green row measured on `opening`.
 *
 * Usage: node tools/tmp/menu_accept.mjs [--flow-only]
 *
 * ── WHY EVERY WAIT HERE GOES THROUGH `settle.mjs` ───────────────────────────
 * This file measures GEOMETRY, and `getBoundingClientRect()` INCLUDES transforms.
 * `.fa-screen` runs `fa-screen-in 0.26s`, whose first keyframe is
 * `translateY(10px) scale(0.992)`. Neither `window.__screenReady` nor
 * `window.__previewReady` means that animation is over: measured, the first fires at
 * animation time 0 ms of 260 on 4/4 screens with the screen at opacity 0.000, and the
 * second at 0-26 ms — so the 250 ms sleep that used to follow it expired somewhere
 * between 10 ms BEFORE and 16 ms after the animation ended. That is a coin flip, not
 * a margin.
 *
 * MEASURED CONSEQUENCE (`tools/tmp/settle_geom_ab.mjs`, 3 viewports x 3 screens, the
 * simulated-notch pass, reading the same two assertions this file makes):
 *   tap-target height   43.648 px vs 44.000 settled — 0.352 px of error against the
 *                       0.5 px margin this file's own 43.5 floor leaves. 70% eaten.
 *   screen top          up to +11.84 px against a +/-1 px safe-area tolerance.
 *   verdict flipped     1 of 9 cells. `settings @ 844x390` reports `Done` 18.34 px
 *                       above the bottom edge — inside the 21 px home-bar band, a
 *                       FAILED `inside-safe-area` — and 0 violations once settled.
 *                       A FALSE FAILURE, the direction that sends someone hunting a
 *                       layout bug that does not exist (`docs/LESSONS.md` §10).
 *   flag caught mid-fade on 5 of 9 first mounts, and on 2 of 2 curtained navigations.
 *
 * Playwright `click({force:true})` also SKIPS its own stability check, so a forced
 * click issued mid-animation aims at a coordinate the button has already left; and an
 * UNforced click waits for stability instead, which is why the pre-fix run of this
 * file died at "pick a different fighter" with a 30 s `page.click` timeout.
 *
 * `settleScreen()` waits for the page's own rendered state instead of a flag or a
 * clock. See `tools/tmp/settle.mjs` and `tools/tmp/settle_validate.mjs`.
 */

import { chromium } from 'playwright';
import { readdir, readFile } from 'node:fs/promises';
import { settleScreen } from './settle.mjs';
import { routeChecks, selftest as routeSelftest, CONDITIONAL_SCREENS } from './mc_routes.mjs';

/**
 * How long a screen is allowed to take to paint.
 *
 * NOT a margin on an animation — `fa-screen-in` is 260 ms and `settleScreen` watches
 * it directly. This is the budget for the whole first paint, which on this project
 * means `index.html`'s `#boot` overlay coming down after the 3D stage builds. Measured
 * under SwiftShader with other agents' batteries on the same cores: 23 ms for
 * settings, 7.7 s for character select, 11.9 s for the trophy road. 60 s is ~5x the
 * worst observed, and it is a CEILING rather than a wait — a fast machine still
 * proceeds in 23 ms, which is the entire point of a state condition over a sleep.
 */
const SETTLE_MS = 60_000;

/**
 * Wait for a route AND for it to be on screen.
 *
 * The flag alone is not enough — see the header. Every `__screenReady` wait in this
 * file goes through here so there is one condition, not fourteen.
 */
async function atScreen(page, screen, timeout = 20000) {
  await page.waitForFunction(
    `window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`,
    null, { timeout },
  );
  return settleScreen(page, { label: screen, timeout: Math.max(timeout, SETTLE_MS) });
}

/**
 * Settle, and turn a failure into a RECORDED FAILURE rather than a crashed battery.
 *
 * The viewport x screen loop runs 30 settles with no `try` around it, so an
 * unhandled `CaptureRefused` used to abort `run()` before it printed anything at
 * all — 348 assertions replaced by a stack trace. That is a bad failure mode for a
 * guard: the cheapest way to make a red battery green is to delete the thing that
 * made it red, and a guard that destroys the report invites exactly that.
 *
 * It records only when it FAILS, so a healthy run's assertion count is unchanged and
 * a sick one gains a line that names the screen and the reason.
 */
async function settled(page, vpName, screen, label) {
  try {
    await settleScreen(page, { label, timeout: SETTLE_MS });
    return true;
  } catch (err) {
    record(vpName, screen, 'screen-painted', false,
      String(err.message ?? err).split('\n')[0].slice(0, 150));
    return false;
  }
}

/**
 * Static guard, run before the browser starts.
 *
 * THE TRAP. Several modules build their markup and their CSS as template literals. A
 * stray backtick inside one — writing `.fa-screen` in a CSS comment, or naming a
 * module in an HTML comment — silently terminates the string and turns the whole file
 * into a syntax error. That presents as a Vite 500 and a blank page for EVERY agent in
 * the repo, and as nothing at all in a screenshot. It has now cost five round-trips.
 *
 * WHY THIS IS NO LONGER A REGEX. The first version matched `const CSS = ` + literal
 * and scanned its lines for a backtick. That guard was standing right next to the
 * hole it did not cover: the very next backtick to break `hud.ts` went into its
 * `root.innerHTML = ` markup literal instead. Widening the regex to `innerHTML` then
 * immediately produced FALSE positives, because `characterSelect.ts` legitimately
 * nests template literals inside `${...}` interpolations — and a lint that cries wolf
 * on valid code gets ignored, which is worse than the hole.
 *
 * Both failures are the same mistake: pattern-matching a language instead of parsing
 * it. So it parses. `ts.createSourceFile` yields `parseDiagnostics` directly, which is
 * exactly and only "would this file compile", with no notion of what a backtick is —
 * so it catches every variant of the trap AND every other syntax error, and cannot
 * false-positive on valid nesting. Measured: 88 files in ~95 ms, which is why it can
 * cover all of `src/` rather than a hand-maintained list that would go stale the first
 * time someone adds a module.
 *
 * `tsc` also catches this, but only if it is run BEFORE the file is saved — by the
 * time anyone runs it the dev server is already down. This runs first, before the
 * browser even launches. Still ONE `record()` call, so the total check count does not
 * move.
 */
async function lintCssLiterals() {
  const { default: ts } = await import('typescript');
  const roots = ['src'];
  const paths = [];
  const walk = async (dir) => {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${ent.name}`;
      if (ent.isDirectory()) await walk(p);
      else if (ent.name.endsWith('.ts')) paths.push(p);
    }
  };
  for (const r of roots) await walk(r);

  const offenders = [];
  for (const p of paths) {
    const src = await readFile(p, 'utf8').catch(() => null);
    if (src === null) continue;
    const sf = ts.createSourceFile(p, src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    for (const d of sf.parseDiagnostics ?? []) {
      const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
      offenders.push(`${p}:${line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    }
  }
  // A guard that silently matches nothing is worse than no guard — that is how the
  // innerHTML hole stayed open. Assert it actually looked at something.
  const ok = offenders.length === 0 && paths.length >= 20;
  record('static', '-', 'no-backtick-in-css', ok,
    offenders.length ? offenders.slice(0, 3).join(' | ') : `${paths.length} modules parsed clean`);
}

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const VIEWPORTS = [
  { name: 'desktop-16:9', width: 1600, height: 900 },
  { name: 'laptop-16:10', width: 1280, height: 800 },
  { name: 'tablet-4:3', width: 1024, height: 768 },
  { name: 'phone-19.5:9', width: 844, height: 390 },
  { name: 'ultrawide-21:9', width: 2560, height: 1080 },
];

/** Simulated notch. Landscape iPhone: 44/44 on the long edges, 21 for the home bar. */
const SAFE = { t: 0, r: 44, b: 21, l: 44 };

const MIN_TAP = 44;

/**
 * ── THE TAP FLOOR IS PER SCREEN NOW, AND ONLY ONE SCREEN MOVES IT ───────────
 *
 * 44 px is the TOUCH floor (WCAG 2.2 SC 2.5.5 *Target Size (Enhanced)*), and it is the
 * right bar for every screen of a game that is played with a thumb.
 *
 * `admin` is the exception, and it is an exception by MEASUREMENT rather than by
 * assertion. Measured on a snapshot (`tools/tmp/mc_smoke.mjs`, 2026-08-18), its eight
 * controls are **31–38 px tall at 1280×800 and exactly 44.0 px at 390×844** — because
 * `src/admin/styles.ts` carries one flat `@media (max-width: 760px)` that raises
 * `.adm-btn`/`.adm-tab`/`.adm-input`/`.adm-search` to `min-height: 44px`. All five
 * viewports in this file are ≥ 844 wide, so none of them meets that query; all three in
 * `menu_accept_portrait.mjs` are ≤ 430, so all of them do.
 *
 * So the touch floor **is** asserted on this screen — at 44, in the portrait battery,
 * where a thumb is what is holding it. `adminScreen.ts` states the decision the CSS
 * encodes: *"it is a tuning tool, not a place the game is played… this is used on a
 * laptop beside the game"*, and narrow *"gets every control to a 44 px tap target"*.
 *
 * ⚠️ **This is a LOWER floor, not a removed one, and lowering it needs a reason that is
 * not "otherwise it goes red".** 24 px is WCAG 2.2 SC 2.5.8 *Target Size (Minimum)*, the
 * published POINTER bar — a real standard, not a number chosen to fit today's rects. It
 * is not vacuous: the smallest control on the screen is 31 px, so 7 px of shrink fails
 * it. And every run prints how many controls sit below the GAME floor beside the
 * verdict, so the cost of the exemption is visible in the log rather than implied by a
 * missing row.
 *
 * 🔴 **Do NOT add a screen here to make it green.** The alternative on the table was to
 * exclude `admin` from the battery entirely; that was refused because an unexamined
 * exclusion is exactly the hole that let `lobby` and `admin` sit outside this gate for
 * five days. A screen that fails at 44 because its controls are genuinely too small for
 * a finger is a DEFECT and belongs in the report, not in this map.
 */
const TAP_FLOOR = { admin: 24 };

/**
 * ── THE SIMULATED NOTCH CANNOT REACH `admin`, SO ITS NOTCH ROW WOULD BE A FALSE FAILURE ──
 *
 * MEASURED FIRST, 2026-08-18, with `admin` under the full battery and no exemption at
 * all: **482/487, and every one of the five failures was `admin+notch inside-safe-area`,
 * one per landscape viewport, all reading `adm-tab[Combat…] L0`.** `L0` is the finding:
 * with `--fa-safe-l: 44px` injected, the tab bar had not moved a pixel.
 *
 * The cause is one line of `src/admin/styles.ts`:
 *
 *     .adm { padding: env(safe-area-inset-top) env(safe-area-inset-right) … ; }
 *
 * against `src/ui/screens/theme.ts`, whose `--fa-safe-*` are declared on `:root`
 * **precisely so a test can override them** — its own comment says so — and whose
 * `.fa-screen` pads with `calc(var(--fa-safe-l) + var(--gutter))`. `.adm` reads the raw
 * `env()` instead, and **`env(safe-area-inset-*)` is 0 in headless Chromium and cannot be
 * set by any test.** So on a real notched device `.adm` insets correctly, and in this
 * battery the injection is a no-op.
 *
 * 🚨 That makes the unexempted row a **FALSE FAILURE** — `docs/LESSONS.md` §10's
 * direction, the one that sends someone hunting a layout bug that does not exist. It also
 * would have made the repo's most-run gate permanently red for every peer, which is the
 * documented reason `menu_accept_portrait` was made opt-in in the first place.
 *
 * ⚠️ **THE EXEMPTION IS NOT A FREE PASS — IT IS RE-EARNED ON EVERY RUN, AND IT
 * SELF-DESTRUCTS.** A row that always passes is a comment with a tick next to it
 * (`docs/AGENT-BRIEF.md` §4.4), so what is asserted in its place is the exemption's own
 * PRECONDITION: that injecting `--fa-safe-*` provably does not move this screen. Every
 * control's rect is hashed in the zero-inset pass and re-hashed in the notch pass, and
 * they must be IDENTICAL. The implementation that fails it is the FIX: swap `env(...)`
 * for `var(--fa-safe-*)` in `src/admin/styles.ts` and the hash moves, this row goes red,
 * and its message says to delete the entry below and restore the assertion.
 *
 * ⚠️ `admin`'s ZERO-inset `inside-safe-area` row is untouched and still asserted — the
 * exemption is one pass on one screen, not a screen-wide waiver.
 *
 * Remedy, one line, NOT in this agent's owned file set → reported for routing.
 */
const SAFE_AREA_EXEMPT = {
  admin: 'src/admin/styles.ts pads with raw env(safe-area-inset-*), not var(--fa-safe-*), '
    + 'and env() is 0 in headless Chromium — the injection cannot reach this screen',
};

const results = [];
let failures = 0;

function record(vp, screen, check, ok, detail = '') {
  results.push({ vp, screen, check, ok, detail });
  if (!ok) failures++;
}

/**
 * How many controls a screen must draw for its layout to be a screen at all.
 *
 * Per-screen, not a global 3, because the OPENING title card legitimately has exactly
 * one control — that is the whole design of a title card, and asserting three would be
 * asserting a house style rather than a defect.
 */
const MIN_CONTROLS = { opening: 1, default: 3 };

/**
 * ── HOW MUCH OF THE FRAME THE HERO ACTUALLY OCCUPIES ────────────────────────
 *
 * The objective acceptance test for the home screen's largest defect, added because
 * `PROGRESS.md` is explicit that an element with no measurable test oscillates at its
 * own noise floor — which is exactly what happened here: two blind critics reversed
 * each other and the loop stopped rather than converged.
 *
 * ── THE ORIGINAL ASSERTION, AND WHY IT IS KEPT HERE ─────────────────────────
 * It read, and this wording is preserved verbatim because the rule it encodes has been
 * REVERSED rather than deleted:
 *
 *   > "The defect was that the hero panel spanned the full width of the middle row, and
 *   > `charStage.applyFraming()` sizes the subject off whichever axis BINDS — always
 *   > height on a panel wider than it is tall. So every extra pixel of panel width was
 *   > guaranteed to be empty backdrop, and the character measured ~26% of its own
 *   > panel's width."
 *   >
 *   > `const MIN_HERO_WIDTH_FRAC = 0.42;`  — asserted on `|right.x - left.x|`.
 *
 * That was CORRECT for a hero standing in a PANEL, and it becomes a CATEGORY ERROR the
 * moment the panel is the screen — which is the composition the reference plates
 * themselves use. `applyFraming()` caps the fit at `V_FILL = 0.62` of frame HEIGHT, so
 * for any panel wider than ~1:1 the height binds and the identity is exact:
 *
 *     wFrac = hFrac * (subjectW / subjectH) / panelAspect
 *
 * The width fraction is therefore divided by the aspect change while the PICTURE of the
 * hero does not change at all. Measured, on one viewport, widening only the panel's CSS
 * (`tools/tmp/up_herofill.mjs --aspect-sweep`):
 *
 *     panel width   panel aspect   hFrac   wFrac
 *     40vw          0.711          0.533   0.725
 *     56vw (ships)  0.996          0.540   0.506
 *     70vw          1.244          0.546   0.393   <- already refused by the 0.42 floor
 *     85vw          1.511          0.550   0.316
 *     100vw         1.778          0.553   0.263
 *
 * The hero is the same size on screen in all five. The old number falls 2.76x. So the
 * assertion was a statement about the PANEL'S SHAPE wearing the costume of a statement
 * about the hero's size, and at full bleed it refused a composition that is not a defect.
 *
 * ── AND IT REFUSED ITS OWN REFERENCE ────────────────────────────────────────
 * Measured on `reference/images/curated/menus/bs_home.png` (2556x1179, 21.7:9) by
 * masking the hero off the backdrop: the fighter spans **0.486 of screen HEIGHT** and
 * **0.217 of screen WIDTH** — 0.265 once normalised to 16:9. Against a 0.42 floor the
 * reference plate fails its own guard by nearly 2x, on both readings. A guard that
 * refuses the thing it exists to imitate is measuring the wrong quantity.
 *
 * ── WHAT IS GUARDED NOW, STATED PLAINLY ─────────────────────────────────────
 * The property has CHANGED, deliberately. It is no longer "the panel is not wider than
 * the hero needs" (a panel much wider than the hero is now the intended composition); it
 * is **"the hero is not small in the frame"** — which is the half of the original defect
 * that is still a defect, and the half a full-bleed lobby cannot make go away.
 *
 * ── THE FLOOR, AND WHERE IT COMES FROM ──────────────────────────────────────
 * From the REFERENCE, not from what we happen to score: `bs_home`'s hero occupies 0.486
 * of frame height. 0.47 is that number, and a hero less present than the genre's own is
 * under-framed by definition. What we score is reported rather than used:
 *
 *     shipped, 5 viewports x {home, opening}   hFrac 0.531 - 0.591
 *     whole cast x home's panel aspects        worst 0.543 (hotdog; the only fighter
 *                                              whose width binds at all)
 *     a full-bleed lobby at 16:9               0.553
 *
 * so the floor clears the cast's worst case by 0.073 and the reference by 0.016.
 *
 * ⚠️ PROVEN TO FAIL, because a guard that has not been shown to fail is not a guard
 * (CLAUDE.md non-negotiable #6). Known-bad input: `charStage.ts`'s `V_FILL` cut from
 * 0.62 to 0.34 — one constant, the single thing that decides the hero's presence, and
 * the exact regression class this exists for. All 20 cells report hFrac 0.30-0.31 and
 * FAIL. Restored, all 20 pass. See the commit that changed this line for the two runs.
 */
const MIN_HERO_HEIGHT_FRAC = 0.47;

/**
 * Everything measured off rects, in one `page.evaluate`.
 *
 * Top-level and named — not an inline closure — so the POSITIVE and NEGATIVE controls in
 * `safeAreaProbeFires()` can run the SAME code path they are validating. A control that
 * exercises a copy of the logic validates the copy.
 */
function collectMenu({ MIN_TAP, TAP, safe }) {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const vh = de.clientHeight;

    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // Controls the player is expected to be able to hit.
    const controls = [...document.querySelectorAll(
      '.fa-root button:not([disabled]), .fa-root .fa-menuitem:not([disabled])',
    )].filter(visible);
    // 🚨 **A SCROLL REGION IS COMPUTED OVERFLOW, NOT A CLASS NAME — AND THIS USED TO
    // TEST FOR THE CLASS.** The rule below was written correctly and implemented as
    // `.closest('.fa-scroll')`, which is only the game screens' own scroller. `admin`'s
    // tab bar is `.adm-tabs { overflow-x: auto }` (`src/admin/styles.ts`), so at 360–430
    // px its 3rd–5th tabs are SCROLLED AWAY, exactly like a trophy-road node — and the
    // class test reported all three as safe-area violations on the ZERO-inset pass,
    // where there is no inset to violate. Measured: 6 such rows across the three
    // portrait viewports, every one a FALSE FAILURE.
    // ⚠️ Its two neighbours in the portrait battery (`layout-fits-viewport`,
    // `nothing-clipped-by-frame`) already walked computed overflow and already passed on
    // the same elements — so the three checks disagreed about what a scroller is, and the
    // odd one out was this one. Same model everywhere now: `.fa-scroll` is a SPECIAL CASE
    // of "an ancestor whose overflow is auto/scroll", not the definition.
    const scrollAxes = (el) => {
      let x = false; let y = false; let node = null;
      for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
        const ps = getComputedStyle(p);
        const sx = ps.overflowX === 'auto' || ps.overflowX === 'scroll';
        const sy = ps.overflowY === 'auto' || ps.overflowY === 'scroll';
        if ((sx || sy) && !node) node = p;
        if (sx) x = true;
        if (sy) y = true;
      }
      return { x, y, node };
    };
    // Scroll viewports must themselves be inside the safe area — the scrolled-away
    // children are the scroller's business, the scroller is the layout's.
    const scrollers = [...new Set([
      ...document.querySelectorAll('.fa-root .fa-scroll'),
      ...controls.map((el) => scrollAxes(el).node).filter(Boolean),
    ])].filter(visible);

    const rects = controls.map((el) => ({ el, r: el.getBoundingClientRect() }));
    const small = rects
      .filter(({ r }) => r.width < TAP - 0.5 || r.height < TAP - 0.5)
      .map(({ el, r }) => `${el.className.split(' ')[0]}[${el.textContent.trim().slice(0, 14)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    // Always measured against the GAME's 44 px floor as well, whatever this screen's own
    // floor is, so an exemption costs a printed number instead of a missing row.
    const belowGame = rects
      .filter(({ r }) => r.width < MIN_TAP - 0.5 || r.height < MIN_TAP - 0.5).length;

    // Elements inside a scrolling region are clipped by it, so their own rect can
    // legitimately sit outside the viewport. The thing that has to respect the safe
    // area is the SCROLLER, not its scrolled-away children.
    //
    // ⚠️ PER AXIS, deliberately. A horizontally scrolling tab bar does not license its
    // children to sit under the status bar; it only excuses them on x. The old
    // `.closest('.fa-scroll')` test excused BOTH axes wholesale, so it was simultaneously
    // too narrow (missed `.adm-tabs`) and too wide (excused y for anything inside a
    // horizontal scroller).
    const outside = controls
      .map((el) => ({ el, r: el.getBoundingClientRect(), ax: scrollAxes(el) }))
      .filter(({ r, ax }) =>
        (!ax.x && (r.left < safe.l - 1 || r.right > vw - safe.r + 1)) ||
        (!ax.y && (r.top < safe.t - 1 || r.bottom > vh - safe.b + 1)))
      .map(({ el, r }) => `${el.className.split(' ')[0]}[${el.textContent.trim().slice(0, 14)}] L${Math.round(r.left)} T${Math.round(r.top)} R${Math.round(vw - r.right)} B${Math.round(vh - r.bottom)}`)
      .concat(scrollers
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) =>
          r.left < safe.l - 1 || r.top < safe.t - 1 ||
          r.right > vw - safe.r + 1 || r.bottom > vh - safe.b + 1)
        .map(({ el, r }) => `scroller.${el.className.split(' ').pop()} L${Math.round(r.left)} T${Math.round(r.top)} R${Math.round(vw - r.right)} B${Math.round(vh - r.bottom)}`));

    // 🚨 NON-EMPTY BEFORE THE ASSERTION (CLAUDE.md #6). `outside` is a FILTERED set, and
    // widening the scroller exclusion widens what can be filtered out of it — so a screen
    // whose every control sits inside some scroller would report `0 violations` while
    // having checked nothing, and `[].every()` is `true`. This is the count of elements
    // the safe-area rule actually ran over, and the verdict requires it to be > 0.
    const checked = controls.filter((el) => {
      const ax = scrollAxes(el);
      return !ax.x || !ax.y;
    }).length + scrollers.length;

    return {
      scrollW: de.scrollWidth, clientW: vw,
      scrollH: de.scrollHeight, clientH: vh,
      controlCount: controls.length,
      small, belowGame, outside, checked,
      // A layout fingerprint over every control's rect. Used only by SAFE_AREA_EXEMPT,
      // to prove the injected insets DID NOT MOVE an exempt screen — the precondition
      // that earns the exemption, re-measured on every run.
      sig: rects.reduce((h, { r }) => {
        for (const v of [r.left, r.top, r.width, r.height]) {
          h = (Math.imul(h ^ Math.round(v), 0x01000193) >>> 0);
        }
        return h;
      }, 0x811c9dc5),
      hero: window.__charStage?.() ?? null,
    };
}

/**
 * ── POSITIVE **AND** NEGATIVE CONTROL FOR THE SAFE-AREA RULE ────────────────
 *
 * The scroller exclusion just went from a class name to computed overflow, i.e. it got
 * WIDER — and a widened exclusion is how an assertion quietly stops asserting. Both
 * directions therefore have to be proved on the live screen, with the real `collectMenu`:
 *
 *   MOVES  a plain in-flow button pinned into the inset band, with no scrolling
 *          ancestor, must be REPORTED. An exclusion that swallowed everything fails here.
 *   HOLDS  the same button inside an `overflow-x: auto` wrapper, pushed off to the right,
 *          must NOT be reported — it is scrolled away, not clipped by the frame. A rule
 *          that reports everything fails here, and that is the false failure this change
 *          removed (6 of them on `admin`).
 *
 * ⚠️ The HOLDS arm is deliberately x-only: the wrapper scrolls horizontally, so its child
 * is excused on x and still asserted on y. A both-axes waiver would pass this control and
 * still be wrong.
 *
 * Runs once, on the first viewport, against whatever screen is mounted — it plants its own
 * subject, so it does not depend on the screen having anything in particular.
 */
async function safeAreaProbeFires(page, vp) {
  const SAFE_PROBE = { t: 60, r: 60, b: 60, l: 60 };
  const plant = (mode) => page.evaluate((m) => {
    document.querySelector('.qa-safe-probe')?.remove();
    const frame = document.querySelector('.fa-root');
    if (!frame) return;
    const btn = document.createElement('button');
    btn.className = 'qa-safe-probe';
    btn.textContent = 'probe';
    if (m === 'plain') {
      // Top-left corner: inside a 60px inset band on both axes, no scrolling ancestor.
      btn.style.cssText = 'position: absolute; left: 2px; top: 2px; width: 48px; height: 48px;';
      frame.appendChild(btn);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'qa-safe-probe';
      wrap.style.cssText = 'position: absolute; left: 100px; top: 100px; width: 120px;'
        + ' height: 60px; overflow-x: auto; overflow-y: hidden; white-space: nowrap;';
      btn.className = 'qa-safe-probe-child';
      btn.style.cssText = 'display: inline-block; margin-left: 4000px; width: 48px; height: 48px;';
      wrap.appendChild(btn);
      frame.appendChild(wrap);
    }
  }, mode);
  const named = (d, cls) => d.outside.some((s) => s.startsWith(cls));

  await plant('plain');
  await page.waitForTimeout(60);
  const seen = await page.evaluate(collectMenu, { MIN_TAP, TAP: MIN_TAP, safe: SAFE_PROBE });
  record(vp.name, 'instrument', 'safe-area-rule-reports-a-planted-violation',
    named(seen, 'qa-safe-probe['),
    named(seen, 'qa-safe-probe[') ? 'planted a 48px button at 2,2 inside a 60px band — reported'
      : `PLANTED VIOLATION NOT SEEN — the rule is blind (${seen.checked} checked)`);

  await plant('scrolled');
  await page.waitForTimeout(60);
  const hid = await page.evaluate(collectMenu, { MIN_TAP, TAP: MIN_TAP, safe: SAFE_PROBE });
  record(vp.name, 'instrument', 'safe-area-rule-excuses-a-scrolled-away-child',
    !named(hid, 'qa-safe-probe-child'),
    named(hid, 'qa-safe-probe-child')
      ? 'a child scrolled 4000px inside an overflow-x:auto box was reported — the FALSE FAILURE is back'
      : 'scrolled-away child not reported; its scroller still is');

  await page.evaluate(() => document.querySelectorAll('.qa-safe-probe, .qa-safe-probe-child')
    .forEach((n) => n.remove()));
}

/** Every check that can run against a mounted menu screen. */
async function auditScreen(page, vp, screen, { safe, baseline = null }) {
  // Per-screen tap floor — see TAP_FLOOR. `screen` can be `admin+notch`.
  const base = screen.split('+')[0];
  const floor = TAP_FLOOR[base] ?? MIN_TAP;
  const data = await page.evaluate(collectMenu, { MIN_TAP, TAP: floor, safe });

  record(vp.name, screen, 'no-page-scroll',
    data.scrollW <= data.clientW + 1 && data.scrollH <= data.clientH + 1,
    `${data.scrollW}x${data.scrollH} vs ${data.clientW}x${data.clientH}`);

  // The check NAME carries the floor, so a lowered floor is visible in the log rather
  // than hidden behind a row that reads the same as everyone else's.
  record(vp.name, screen, `tap-targets>=${floor}`,
    data.small.length === 0,
    `${data.belowGame}/${data.controlCount} below the ${MIN_TAP}px game floor`
      + (data.small.length ? `; ${data.small.slice(0, 4).join(' | ')}` : ''));

  // The notch pass is the one with insets injected; the zero-inset pass is always
  // asserted normally, on every screen, exemption or not.
  const notchPass = safe.t + safe.r + safe.b + safe.l > 0;
  const exemptWhy = SAFE_AREA_EXEMPT[base];
  if (exemptWhy && notchPass) {
    const unmoved = baseline !== null && data.sig === baseline;
    record(vp.name, screen, 'safe-area-exemption-earned', unmoved,
      baseline === null ? 'no zero-inset baseline was captured — cannot earn the exemption'
        : unmoved
          ? `layout bit-identical with --fa-safe-* injected (sig ${data.sig}) — ${exemptWhy}`
          : `LAYOUT MOVED (sig ${baseline} -> ${data.sig}): "${base}" now honours --fa-safe-*, `
            + `so the exemption is STALE — delete SAFE_AREA_EXEMPT['${base}'] and let `
            + 'inside-safe-area assert it again');
  } else {
    record(vp.name, screen, 'inside-safe-area',
      data.outside.length === 0 && data.checked > 0,
      data.checked === 0 ? 'VACUOUS: every element was excluded, so nothing was checked'
        : `${data.checked} elements checked${data.outside.length ? `; ${data.outside.slice(0, 4).join(' | ')}` : ''}`);
  }

  const h = data.hero;
  if (h && h.feet) {
    const pts = [h.feet, h.crown, h.left, h.right];
    const inFrame = pts.every((p) => p && p.x >= -0.005 && p.x <= 1.005 && p.y >= -0.005 && p.y <= 1.005);
    record(vp.name, screen, 'hero-in-frame', inFrame && h.cameraOk === true,
      `fill=${h.fill} feet=${JSON.stringify(h.feet)} crown=${JSON.stringify(h.crown)} L=${JSON.stringify(h.left)} R=${JSON.stringify(h.right)}`);

    // See MIN_HERO_HEIGHT_FRAC. Home and the title card are the two screens whose whole
    // point is the hero; character select frames its own column and is not this
    // screen's business.
    //
    // The width fraction is still PRINTED — it is the thing that used to be asserted,
    // and keeping it visible is what lets anyone re-derive the reversal from a log
    // instead of taking this comment's word for it. It is no longer a verdict.
    if (screen.startsWith('home') || screen.startsWith('opening')) {
      const wFrac = Math.abs(h.right.x - h.left.x);
      const hFrac = Math.abs(h.feet.y - h.crown.y);
      record(vp.name, screen, 'hero-fills-its-panel', hFrac >= MIN_HERO_HEIGHT_FRAC,
        `height=${hFrac.toFixed(3)} (min ${MIN_HERO_HEIGHT_FRAC}) width=${wFrac.toFixed(3)} panelAspect=${h.aspect}`);
    }
  }

  const minControls = MIN_CONTROLS[base] ?? MIN_CONTROLS.default;
  record(vp.name, screen, 'controls-present', data.controlCount >= minControls,
    `${data.controlCount} controls (min ${minControls})`);
  return data.sig;
}

/**
 * ── Economy acceptance, added with the trophy road ──────────────────────────
 *
 * The model itself is asserted 172 ways under plain Node in
 * `src/game/economy/economy.test.mjs`. What CANNOT be asserted there — and is
 * therefore asserted here, in a real browser — is that the screen is wired to the
 * model at all, and that the three states the road can be in each produce honest UI:
 *
 *  1. CLAIM. A player with unclaimed trophies sees claimable nodes, tapping one pops
 *     the reveal card, and the balance actually moves. This is the check that would
 *     have caught "the button renders but nothing happens", which is the single
 *     defect both menu critics punished.
 *  2. OPEN. A held chest opens and pays out; an empty inventory draws NO open button
 *     (a control that cannot work must not be drawn).
 *  3. STORE. Every real-money product is DISABLED and the sheet says purchases are
 *     unavailable. This is the one place a "coming soon" claim can be verified rather
 *     than trusted, and it is deliberately asserted in both directions: the buttons
 *     must be disabled AND the copy must say so.
 *  4. ODDS. The published drop rates render, and the 0.01% row is not rounded to 0% —
 *     which is a compliance statement, not a formatting preference.
 *
 * State is seeded through localStorage before boot rather than played into, because
 * reaching 200 trophies through the UI is 14 real matches.
 */
async function auditEconomy(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  // A player at 200 trophies with two chests in hand and nothing claimed.
  //
  // The `if (!existing)` guard is load-bearing, not defensive: `addInitScript` runs on
  // EVERY navigation, so an unguarded seed would silently restore this blob on the
  // reload below and the persistence check would pass no matter how broken saving was.
  await page.addInitScript(() => {
    if (localStorage.getItem('food-arena.profile.v1')) return;
    localStorage.setItem('food-arena.profile.v1', JSON.stringify({
      name: 'QA', wins: 9, losses: 3, xp: 400, selected: 'hamburger',
      economy: {
        trophies: 200, bestTrophies: 200, coins: 1000, gems: 40,
        containers: { chest: 2, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
        claimed: [], unlocked: ['hamburger'], winsTowardChest: 1,
        lastMatch: null, seed: 987654, rolls: 0,
      },
    }));
  });

  let step = 'boot';
  try {
    await page.goto(`${BASE}/?screen=trophies`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__screen === "trophies"', null, { timeout: 45000 });
    await settleScreen(page, { label: 'economy/trophies', timeout: SETTLE_MS });
    await page.waitForTimeout(300);

    step = 'seeded state renders';
    const seeded = await page.evaluate(() => ({
      trophies: document.querySelector('[data-el="trophies"]')?.textContent,
      coins: document.querySelector('[data-el="coins"]')?.textContent,
      claimable: document.querySelectorAll('.tr-node.is-claimable').length,
      nodes: document.querySelectorAll('.tr-node').length,
      pins: document.querySelectorAll('.tr-pin').length,
      opens: document.querySelectorAll('[data-open]').length,
    }));
    record('economy', 'trophies', 'model-drives-screen', seeded.trophies === '200', `showed "${seeded.trophies}"`);
    record('economy', 'trophies', 'road-renders-every-node', seeded.nodes >= 30, `${seeded.nodes} nodes`);
    record('economy', 'trophies', 'exactly-one-you-are-here-pin', seeded.pins === 1, `${seeded.pins} pins`);
    record('economy', 'trophies', 'reached-nodes-are-claimable', seeded.claimable >= 5, `${seeded.claimable} claimable`);
    record('economy', 'trophies', 'held-chests-draw-an-open-button', seeded.opens === 1, `${seeded.opens} open buttons`);

    step = 'claim a milestone';
    const coinsBefore = await page.evaluate(() =>
      Number((document.querySelector('[data-el="coins"]')?.textContent ?? '0').replace(/,/g, '')));
    await page.click('.tr-node.is-claimable');
    await page.waitForSelector('.tr-sheet.is-open .tr-reveal', { timeout: 5000 });
    record('economy', 'trophies', 'claim-opens-the-reveal', true, '');
    await page.click('.tr-sheet .fa-btn--primary', { force: true }); // force: the CTA pulses forever, so it is never 'stable'
    await page.waitForTimeout(150);
    const afterClaim = await page.evaluate(() => ({
      open: document.querySelector('.tr-sheet')?.classList.contains('is-open'),
      claimable: document.querySelectorAll('.tr-node.is-claimable').length,
      claimed: document.querySelectorAll('.tr-node.is-claimed').length,
      coins: Number((document.querySelector('[data-el="coins"]')?.textContent ?? '0').replace(/,/g, '')),
    }));
    record('economy', 'trophies', 'reveal-closes', afterClaim.open === false);
    record('economy', 'trophies', 'claimed-node-changes-state', afterClaim.claimed >= 1
      && afterClaim.claimable === seeded.claimable - 1,
      `${afterClaim.claimed} claimed / ${afterClaim.claimable} left`);

    step = 'claim the rest';
    await page.click('[data-el="claimall"]', { force: true });
    await page.waitForSelector('.tr-sheet.is-open .tr-reveal', { timeout: 5000 });
    await page.click('.tr-sheet .fa-btn--primary', { force: true }); // force: the CTA pulses forever, so it is never 'stable'
    await page.waitForTimeout(150);
    const afterAll = await page.evaluate(() => ({
      claimable: document.querySelectorAll('.tr-node.is-claimable').length,
      coins: Number((document.querySelector('[data-el="coins"]')?.textContent ?? '0').replace(/,/g, '')),
      claimAllVisible: (document.querySelector('[data-el="claimall"]')?.getBoundingClientRect().height ?? 0) > 0,
    }));
    record('economy', 'trophies', 'claim-all-clears-the-road', afterAll.claimable === 0,
      `${afterAll.claimable} left`);
    record('economy', 'trophies', 'claiming-moves-the-balance', afterAll.coins > coinsBefore,
      `${coinsBefore} -> ${afterAll.coins}`);
    // The one control that must NOT linger once it has nothing to do.
    record('economy', 'trophies', 'claim-all-hides-when-empty', afterAll.claimAllVisible === false);

    step = 'open a chest';
    // Claiming the road handed over more chests, so the count is read rather than
    // assumed — asserting a literal here would be asserting the milestone table.
    const chestsHeld = await page.evaluate(() =>
      Number(document.querySelector('.tr-open-count')?.textContent ?? '0'));
    await page.click('[data-open="chest"]');
    await page.waitForSelector('.tr-sheet.is-open .tr-reveal', { timeout: 5000 });
    await page.click('.tr-sheet .fa-btn--primary', { force: true }); // force: the CTA pulses forever, so it is never 'stable'
    await page.waitForTimeout(150);
    const afterOpen = await page.evaluate(() => ({
      count: Number(document.querySelector('.tr-open-count')?.textContent ?? '0'),
      coins: Number((document.querySelector('[data-el="coins"]')?.textContent ?? '0').replace(/,/g, '')),
    }));
    record('economy', 'trophies', 'opening-consumes-exactly-one-chest',
      chestsHeld > 0 && afterOpen.count === chestsHeld - 1, `${chestsHeld} -> ${afterOpen.count}`);
    record('economy', 'trophies', 'opening-pays-out', afterOpen.coins >= afterAll.coins,
      `${afterAll.coins} -> ${afterOpen.coins}`);

    step = 'empty inventory draws no open button';
    // Drain whatever is held, of any kind — the road hands out boxes as well as
    // chests, so a chest-only loop leaves the inventory non-empty and tests nothing.
    for (let guard = 0; guard < 20; guard++) {
      const remaining = await page.evaluate(() => document.querySelectorAll('[data-open]').length);
      if (remaining === 0) break;
      await page.click('[data-open]');
      await page.waitForSelector('.tr-sheet.is-open', { timeout: 5000 });
      await page.click('.tr-sheet .fa-btn--primary', { force: true });
      await page.waitForTimeout(110);
    }
    const empty = await page.evaluate(() => ({
      opens: document.querySelectorAll('[data-open]').length,
      hint: document.querySelector('.tr-inv-empty')?.textContent?.trim() ?? '',
    }));
    record('economy', 'trophies', 'no-open-button-with-nothing-to-open', empty.opens === 0,
      `${empty.opens} still drawn`);
    record('economy', 'trophies', 'empty-inventory-explains-itself', /win/i.test(empty.hint), empty.hint);

    step = 'the gem store is honest';
    await page.click('[data-el="storebtn"]');
    await page.waitForSelector('.tr-sheet.is-open .tr-skus', { timeout: 5000 });
    const store = await page.evaluate(() => {
      const buys = [...document.querySelectorAll('.tr-sku-buy')];
      return {
        products: buys.length,
        enabled: buys.filter((b) => !b.disabled).length,
        notice: document.querySelector('.tr-soon')?.textContent?.trim() ?? '',
        prices: buys.filter((b) => /\$/.test(b.textContent)).length,
      };
    });
    record('economy', 'store', 'products-are-listed', store.products >= 4, `${store.products} SKUs`);
    record('economy', 'store', 'NO-purchase-button-is-live', store.enabled === 0,
      `${store.enabled} enabled`);
    record('economy', 'store', 'unavailability-is-stated-in-words',
      /not available|coming soon/i.test(store.notice), store.notice.slice(0, 80));
    record('economy', 'store', 'prices-are-still-shown', store.prices === store.products);
    await page.click('.tr-sheet [data-el="close"]');
    await page.waitForTimeout(120);

    step = 'drop rates are published';
    await page.click('[data-el="oddsbtn"]');
    await page.waitForSelector('.tr-sheet.is-open .tr-odds-list', { timeout: 5000 });
    const odds = await page.evaluate(() => {
      const pct = [...document.querySelectorAll('.tr-odds-pct')].map((n) => n.textContent.trim());
      return {
        blocks: document.querySelectorAll('.tr-odds-block').length,
        rows: pct.length,
        zeroRows: pct.filter((p) => p === '0%').length,
        hasTinyRow: pct.includes('0.01%'),
      };
    });
    record('economy', 'odds', 'every-container-publishes-its-table', odds.blocks === 5, `${odds.blocks} blocks`);
    record('economy', 'odds', 'rows-render', odds.rows >= 15, `${odds.rows} rows`);
    // A real 0.01% chance published as "0%" is a false statement about a paid
    // randomised item, not a rounding choice.
    record('economy', 'odds', 'no-real-chance-is-rounded-to-zero', odds.zeroRows === 0, `${odds.zeroRows} rows read 0%`);
    record('economy', 'odds', 'sub-tenth-percent-rows-survive', odds.hasTinyRow === true);
    await page.click('.tr-sheet [data-el="close"]');

    step = 'progress survives a reload';
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction('window.__screen === "trophies"', null, { timeout: 30000 });
    await settleScreen(page, { label: 'economy/trophies-reload', timeout: SETTLE_MS });
    await page.waitForTimeout(250);
    const persisted = await page.evaluate(() => ({
      claimable: document.querySelectorAll('.tr-node.is-claimable').length,
      claimed: document.querySelectorAll('.tr-node.is-claimed').length,
      opens: document.querySelectorAll('[data-open]').length,
    }));
    record('economy', 'trophies', 'claims-persist-across-a-reload',
      persisted.claimable === 0 && persisted.claimed >= 5,
      `${persisted.claimed} claimed, ${persisted.claimable} claimable`);
    record('economy', 'trophies', 'spent-chests-stay-spent', persisted.opens === 0);

    record('economy', '-', 'economy-flow', true, 'claim / open / store / odds / reload');
  } catch (err) {
    record('economy', '-', 'economy-flow', false, `failed at "${step}": ${String(err).split('\n')[0]}`);
  }
  record('economy', '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await page.close();
}

/**
 * ── The title card ──────────────────────────────────────────────────────────
 *
 * Three properties, and two of them are safety properties rather than design ones:
 *
 *  1. A bare `/` shows it. That is a change to the boot route, so it is asserted
 *     rather than assumed.
 *  2. **It cannot trap anything.** With no input at all it continues to home on its
 *     own. This is the check that stops a title card from hanging every probe in
 *     `tools/` that navigates to `/` — including this file's own flow test.
 *  3. It collects the gesture that unlocks Web Audio. Before the tap the engine is
 *     `idle` by browser policy; after it, it must not be. `running` OR `failed` both
 *     count: headless Chromium has no audio device, and asserting `running` would be
 *     asserting the CI machine's hardware rather than this screen's behaviour.
 */
async function auditOpening(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  let step = 'boot';
  try {
    step = 'a bare / shows the title card';
    await page.goto(`${BASE}/?hold=120000`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__screen === "opening"', null, { timeout: 45000 });
    await settleScreen(page, { label: 'opening', timeout: SETTLE_MS });
    record('opening', 'opening', 'bare-slash-shows-the-title-card', true, '');

    step = 'audio is locked before the gesture';
    const before = await page.evaluate(() => window.__audio?.stats().state ?? 'no-engine');

    step = 'tapping start enters the game';
    await page.click('[data-el="start"]', { force: true });
    await atScreen(page, "home", 20000);
    record('opening', 'opening', 'start-enters-the-game', true, '');

    const after = await page.evaluate(() => window.__audio?.stats().state ?? 'no-engine');
    record('opening', 'opening', 'the-tap-unlocks-audio', after !== 'idle',
      `${before} -> ${after}`);

    step = 'it continues on its own with no input';
    // The anti-hang guarantee, at a real (short) duration. Nothing is clicked, no key
    // is pressed: the screen has to leave by itself or this times out.
    await page.goto(`${BASE}/?hold=600`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__screen === "opening"', null, { timeout: 45000 });
    await page.waitForFunction('window.__screen === "home"', null, { timeout: 15000 });
    await settleScreen(page, { label: 'opening->home', timeout: SETTLE_MS });
    record('opening', 'opening', 'auto-continues-with-no-input', true, 'no click, no key');

    step = 'an explicit screen request still wins';
    await page.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__screen === "home"', null, { timeout: 20000 });
    await settleScreen(page, { label: 'screen-param-home', timeout: SETTLE_MS });
    record('opening', 'opening', 'screen-param-skips-it', true, '?screen=home');

    record('opening', '-', 'opening-flow', true, 'boot / tap / auto / bypass');
  } catch (err) {
    record('opening', '-', 'opening-flow', false, `failed at "${step}": ${String(err).split('\n')[0]}`);
  }
  record('opening', '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await page.close();
}

/**
 * ── Settings ────────────────────────────────────────────────────────────────
 *
 * The screen exists to make audio reachable, so what is asserted is that each control
 * MOVES THE THING IT CLAIMS TO MOVE, read back off `window.__audio` (the engine's own
 * QA handle) rather than off the UI that just drew it. Both menu critics punished
 * dead UI; this is the only way to prove a control is not dead, and it is the same
 * shape as the trophy road's "the balance actually moves" check.
 *
 * `M` is asserted in the other direction too: the hotkey belongs to `game/input.ts`,
 * so a settings screen that did not subscribe to `audio.onChange` would sit there
 * showing a stale toggle. That is a lie about the mix, not a cosmetic bug.
 *
 * The reset button is opened and CANCELLED, never confirmed: confirming reloads the
 * page, and a suite that wipes its own state mid-run is a suite that cannot be
 * trusted about what it measured.
 */
async function auditSettings(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  const stats = () => page.evaluate(() => ({
    volume: window.__audio?.stats().volume ?? -1,
    muted: window.__audio?.stats().muted ?? null,
  }));
  const switchOn = (name) => page.evaluate(
    (n) => document.querySelector(`[data-toggle="${n}"]`)?.getAttribute('aria-checked') === 'true',
    name,
  );

  let step = 'boot';
  try {
    await page.goto(`${BASE}/?screen=settings`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__screen === "settings"', null, { timeout: 45000 });
    await settleScreen(page, { label: 'settings', timeout: SETTLE_MS });

    step = 'the volume slider moves the bus';
    const v0 = (await stats()).volume;
    await page.evaluate(() => {
      const el = document.querySelector('[data-range="sfx"]');
      el.value = '0.31';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const v1 = (await stats()).volume;
    record('settings', 'settings', 'volume-slider-moves-the-bus', Math.abs(v1 - 0.31) < 0.02,
      `${v0} -> ${v1}`);
    // And the UI reads the engine back rather than its own input event.
    const shown = await page.evaluate(() => document.querySelector('[data-el="sfxval"]')?.textContent);
    record('settings', 'settings', 'volume-readout-matches', shown === '31%', `showed "${shown}"`);

    step = 'the mute toggle mutes';
    const m0 = (await stats()).muted;
    await page.click('[data-toggle="mute"]');
    const m1 = (await stats()).muted;
    record('settings', 'settings', 'mute-toggle-mutes', m1 === !m0, `${m0} -> ${m1}`);
    record('settings', 'settings', 'mute-toggle-reflects-state', (await switchOn('mute')) === m1);

    step = 'the M hotkey moves the toggle';
    // The other direction: `game/input.ts` owns M, and a screen that did not
    // subscribe to audio.onChange would show a stale switch after this.
    await page.evaluate(() => window.__audio.engine.toggleMuted());
    await page.waitForTimeout(80);
    const m2 = (await stats()).muted;
    record('settings', 'settings', 'external-mute-updates-the-ui', (await switchOn('mute')) === m2,
      `engine muted=${m2}`);
    if (m2) { await page.click('[data-toggle="mute"]'); }

    step = 'the music toggle is independent of the master';
    const musicWas = await switchOn('music');
    await page.click('[data-toggle="music"]');
    await page.waitForTimeout(60);
    record('settings', 'settings', 'music-toggle-flips', (await switchOn('music')) === !musicWas);
    await page.click('[data-toggle="music"]');

    step = 'reduce motion applies and persists';
    const motionWas = await switchOn('motion');
    await page.click('[data-toggle="motion"]');
    await page.waitForTimeout(60);
    const applied = await page.evaluate(() =>
      document.documentElement.classList.contains('fa-reduce-motion'));
    record('settings', 'settings', 'reduce-motion-applies', applied === !motionWas,
      `html.fa-reduce-motion = ${applied}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction('window.__screen === "settings"', null, { timeout: 30000 });
    await settleScreen(page, { label: 'settings-return', timeout: SETTLE_MS });
    const survived = await page.evaluate(() =>
      document.documentElement.classList.contains('fa-reduce-motion'));
    record('settings', 'settings', 'reduce-motion-persists', survived === applied,
      `after reload = ${survived}`);
    // Put it back, so this test does not silently change what every later screenshot
    // in the repo looks like.
    if (survived !== motionWas) {
      await page.click('[data-toggle="motion"]');
      await page.waitForTimeout(60);
    }

    step = 'the controls reference names the mute key';
    // The stated reason this section exists: M mutes the whole game and, before this
    // screen, nothing in the product said so.
    const caps = await page.evaluate(() =>
      [...document.querySelectorAll('.set-cap')].map((n) => n.textContent.trim()));
    record('settings', 'settings', 'controls-list-the-mute-key', caps.includes('M'),
      caps.join(' '));
    record('settings', 'settings', 'controls-list-movement', ['W', 'A', 'S', 'D'].every((k) => caps.includes(k)));

    step = 'reset is behind a confirm';
    const openBefore = await page.evaluate(() => !document.querySelector('[data-el="confirm"]').hidden);
    await page.click('[data-el="reset"]');
    const openAfter = await page.evaluate(() => !document.querySelector('[data-el="confirm"]').hidden);
    record('settings', 'settings', 'reset-asks-first', openBefore === false && openAfter === true);
    await page.click('[data-el="cancel"]');
    const closed = await page.evaluate(() => document.querySelector('[data-el="confirm"]').hidden);
    record('settings', 'settings', 'reset-can-be-cancelled', closed === true);

    step = 'NO control on this screen is dead';
    // Every button must either be a toggle, a navigation, or the reset pair. A
    // control that matches none of those is one nobody wired up — which is the exact
    // defect both menu critics named, in the one place a settings screen invites it.
    const orphans = await page.evaluate(() => [...document.querySelectorAll('.fa-settings button')]
      .filter((b) => !b.hasAttribute('data-toggle') && !b.hasAttribute('data-el'))
      .map((b) => b.className));
    record('settings', 'settings', 'no-unwired-controls', orphans.length === 0, orphans.join(' | '));

    step = 'back returns home';
    await page.click('[data-el="back"]', { force: true });
    await atScreen(page, "home", 20000);
    record('settings', '-', 'settings-flow', true, 'audio / motion / reset / back');
  } catch (err) {
    record('settings', '-', 'settings-flow', false, `failed at "${step}": ${String(err).split('\n')[0]}`);
  }
  record('settings', '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await page.close();
}

/**
 * Did `?screen=X` actually mount X?
 *
 * 🚨 **`bootRoute` DOES NOT ERROR ON AN UNKNOWN `?screen=` — IT RETURNS THE TITLE CARD.**
 * So a route that is in `types.ts` and in `ROUTE_NAMES` but missing a branch in
 * `main.ts`'s ladder mounts `opening`, sets `__previewReady`, and every assertion below
 * runs green against the wrong screen under the right label. `main.ts`'s own comment
 * names this trap — *"the trap that once made a capture labelled `home` photograph a
 * different screen entirely."*
 *
 * It is also the honest failure for a CONDITIONAL screen. `admin` is reachable only
 * where `src/admin/gate.ts` says so (`DEV || VITE_FA_ADMIN=1`); every snapshot this file
 * is pointed at is a Vite **dev** server (`tools/snapshot.mjs` spawns `vite`), so admin
 * unreachable here is a real defect — either the gate or the ladder — and this row says
 * which build made it one instead of quietly measuring the title card.
 *
 * ⚠️ The audit still RUNS after a mismatch, deliberately: skipping would make the
 * battery's total a function of which screens happened to mount, and a count that moves
 * for a reason other than coverage is a count nobody can check. The row is red; the
 * rows beside it are measurements of whatever did mount, and this one names it.
 */
async function assertRequestedScreen(page, vp, screen) {
  const landed = await page.evaluate(() => window.__screen ?? '(none)');
  const gate = CONDITIONAL_SCREENS[screen];
  record(vp.name, screen, 'screen-is-the-one-requested', landed === screen,
    landed === screen ? `?screen=${screen}` : `?screen=${screen} mounted "${landed}"`
      + (gate ? ` — this screen is gated on ${gate}` : ''));
  return landed === screen;
}

async function run() {
  const flowOnly = process.argv.includes('--flow-only');
  await lintCssLiterals();

  // The screen list, derived from the router rather than typed. See mc_routes.mjs and
  // header note 9 — a hardcoded six is how `lobby` and `admin` shipped outside this gate.
  const { checks: routeRows, screens: SCREENS } = await routeChecks();
  for (const r of routeRows) record('static', 'routes', r.check, r.ok, r.detail);

  // ── The derivation's OWN known-bad battery, run inside the gate that depends on it ──
  // `mc_routes.mjs` is not in `gatecount`'s registry (that file is another owner's), so
  // without this its `--selftest` would only ever run when somebody remembered to type
  // it — which is the exact failure mode that put `lobby` and `admin` outside this
  // battery for five days. Each row drives a parser against a source carrying the defect
  // it exists for, plus a REPAIRED control, so "the guard fired" is distinguished from
  // "everything fired". ~0.2 s, no browser.
  for (const r of await routeSelftest()) {
    record('static', 'routes-selftest', r.name, r.ok, r.detail);
  }

  const browser = await chromium.launch({ args: LAUNCH_ARGS });

  if (!flowOnly) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

      let probedSafeArea = false;
      for (const screen of SCREENS) {
        // `hold` pins the title card open. Without it the screen navigates itself to
        // home after 4.5s and every measurement below races that timer — see the
        // comment on `holdMs()` in `opening.ts`. The auto-continue is asserted at its
        // real duration in `auditOpening()`.
        const hold = screen === 'opening' ? '&hold=120000' : '';
        await page.goto(`${BASE}/?screen=${screen}${hold}`, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
        await assertRequestedScreen(page, vp, screen);
        // NOT a 250ms sleep. Measured: `__previewReady` fires 0-26 ms into a 260 ms
        // entry animation, so the sleep expired somewhere between 10 ms BEFORE and
        // 16 ms after the animation ended — a coin flip, not a margin. Every rect
        // asserted below includes the animation's `scale(0.992) translateY(10px)`.
        // This waits for the rendered state instead. See tools/tmp/settle_geom_ab.mjs.
        await settled(page, vp.name, screen, `${vp.name}/${screen}`);

        // Pass 1: real (zero) insets.
        await page.evaluate(() => {
          for (const k of ['t', 'r', 'b', 'l']) document.documentElement.style.removeProperty(`--fa-safe-${k}`);
        });
        await page.waitForTimeout(80);
        // Once per viewport: prove the safe-area rule can still both FIRE and HOLD.
        if (!probedSafeArea) { probedSafeArea = true; await safeAreaProbeFires(page, vp); }
        // The zero-inset layout fingerprint. Only SAFE_AREA_EXEMPT screens use it, and
        // it is what makes their exemption a measurement instead of a waiver.
        const zeroSig = await auditScreen(page, vp, screen, { safe: { t: 0, r: 0, b: 0, l: 0 } });

        // Pass 2: simulated notch. `--fa-safe-*` are declared on :root precisely so
        // this is testable without a device.
        await page.evaluate((safe) => {
          const s = document.documentElement.style;
          s.setProperty('--fa-safe-t', `${safe.t}px`);
          s.setProperty('--fa-safe-r', `${safe.r}px`);
          s.setProperty('--fa-safe-b', `${safe.b}px`);
          s.setProperty('--fa-safe-l', `${safe.l}px`);
        }, SAFE);
        await page.waitForTimeout(160);
        await auditScreen(page, vp, `${screen}+notch`, { safe: SAFE, baseline: zeroSig });
      }

      record(vp.name, '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await page.close();
    }
  }

  // ── Flow: home -> characters -> match -> home ────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    let step = 'boot';
    try {
      // Through the front door: a bare `/` is the title card now, and the flow test is
      // the one place that should exercise the same path a player takes rather than
      // jumping past it with `?screen=`.
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForFunction('window.__screen === "opening"', null, { timeout: 45000 });
      // Before a FORCED click: force SKIPS Playwright's own stability check, so a
      // click issued during fa-screen-in aims where the button no longer is.
      await settleScreen(page, { label: 'flow/opening', timeout: SETTLE_MS });
      await page.click('[data-el="start"]', { force: true });
      await atScreen(page, "home", 45000);

      step = 'the gear reaches settings';
      // It said "Settings coming soon" for two review rounds. A dead control on the
      // lobby is the defect both menu critics named, so its liveness is asserted.
      await page.click('[data-el="settings"]', { force: true });
      await atScreen(page, "settings", 20000);
      await page.click('[data-el="done"]', { force: true });
      await atScreen(page, "home", 20000);
      record('flow', 'home', 'gear-opens-settings', true, 'home -> settings -> home');

      step = 'home->characters';
      await page.click('[data-el="start"]', { force: true });
      await atScreen(page, "characters", 20000);

      step = 'pick a different fighter';
      await page.click('.chars-card[data-char="lollipop"]');
      await page.waitForTimeout(200);

      step = 'characters->match';
      await page.click('[data-el="fight"]', { force: true });
      await page.waitForFunction('window.__screen === "match"', null, { timeout: 20000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });

      step = 'input reaches the canvas';
      {
        const box = await page.evaluate(() => {
          const c = document.querySelector('#game canvas');
          const r = c.getBoundingClientRect();
          window.__probeMove = 0;
          window.__probeDown = 0;
          c.addEventListener('mousemove', () => { window.__probeMove++; }, true);
          c.addEventListener('mousedown', () => { window.__probeDown++; }, true);
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        // Real mouse events: Playwright dispatches these through the browser's hit
        // testing, so an overlay that steals them WILL make this fail — which a
        // synthetic dispatchEvent on the canvas would not.
        await page.mouse.move(box.x - 60, box.y - 40);
        await page.mouse.move(box.x + 40, box.y + 30);
        await page.mouse.down();
        await page.mouse.up();
        const hit = await page.evaluate(() => ({
          move: window.__probeMove, down: window.__probeDown,
          topAtCentre: document.elementFromPoint(
            Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2))?.tagName ?? '?',
        }));
        record('flow', 'match', 'canvas-gets-mousemove', hit.move > 0, `${hit.move} events`);
        record('flow', 'match', 'canvas-gets-mousedown', hit.down > 0, `${hit.down} events`);
        record('flow', 'match', 'canvas-is-top-at-centre', hit.topAtCentre === 'CANVAS', hit.topAtCentre);
      }

      step = 'pause';
      await page.click('[data-el="pause"]');
      await page.waitForSelector('.match-sheet.is-open', { timeout: 5000 });
      await page.click('[data-el="resume"]', { force: true });

      // ── 🚨 QUIT IS TWO CLICKS NOW, AND THIS STEP ENCODED THE OLD CONTRACT ─────
      // Kept above the change per `CLAUDE.md`'s reversal rule, because the old wording
      // is the evidence of what the product used to do:
      //
      //     await page.click('[data-el="pause"]');
      //     await page.click('[data-el="quit"]');
      //     await atScreen(page, "home", 20000);
      //
      // `matchScreen.ts` now routes BOTH pause-sheet exits — Quit to Home and Change
      // Fighter — through a confirm, because both abandon a live match and a match
      // abandoned mid-play banks NOTHING (the profile write is gated on
      // `phase === 'ended'`), while the top one sits one 10px gap under Resume. So the
      // click on `[data-el="quit"]` opens the confirm and `[data-el="leave"]` performs
      // it. The `waitForSelector` between them is load-bearing rather than tidy: the
      // destructive button is deliberately DISABLED for `LEAVE_ARM_MS` (350ms) after
      // the confirm appears, to defeat a double-tap punching through at the same
      // coordinate — measured at 6,623px² of overlap at 390x844. Playwright's
      // actionability wait covers exactly that, so this step also proves the button
      // arms; a `{ force: true }` here would skip the wait and hide a button that never
      // became clickable.
      step = 'match->home';
      await page.click('[data-el="pause"]');
      await page.click('[data-el="quit"]');
      await page.waitForSelector('[data-el="leave"]:not([disabled])', { timeout: 5000 });
      await page.click('[data-el="leave"]');
      await atScreen(page, "home", 20000);

      step = 'equipped fighter persisted';
      const equipped = await page.evaluate(() =>
        document.querySelector('[data-el="heroname"]')?.textContent ?? '');
      record('flow', '-', 'selection-persists', equipped === 'Lollipop', `home hero = "${equipped}"`);

      step = 'menu buttons still receive their own clicks';
      {
        const top = await page.evaluate(() => {
          const btn = document.querySelector('[data-el="start"]');
          const r = btn.getBoundingClientRect();
          const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
          return el === btn || btn.contains(el);
        });
        record('flow', 'home', 'cta-is-hit-target', top, 'elementFromPoint over START GAME');
      }

      step = 'home -> trophy road';
      await page.click('[data-go="trophies"]', { force: true });
      await atScreen(page, "trophies", 20000);

      step = 'no stale celebration for a match that never finished';
      {
        // The flow QUITS from the pause menu, so no result was ever banked. The
        // road must therefore show no trophy delta — a screen that congratulates
        // you for a match you abandoned is worse than one that says nothing, and
        // the `lastMatch.seen` flag is the only thing standing between them.
        const state = await page.evaluate(() => ({
          delta: document.querySelector('[data-el="delta"]')?.textContent ?? '',
          trophies: document.querySelector('[data-el="trophies"]')?.textContent ?? '',
        }));
        record('flow', 'trophies', 'no-delta-for-an-abandoned-match', state.delta === '',
          `delta = "${state.delta}"`);
        record('flow', 'trophies', 'trophy-count-renders', /^[\d,]+$/.test(state.trophies),
          `trophies = "${state.trophies}"`);
      }

      step = 'trophies -> home';
      await page.click('[data-el="back"]', { force: true });
      await atScreen(page, "home", 20000);

      step = 'home -> shop';
      // ── The shop, and why it is asserted HERE rather than trusted ─────────────
      // It is reachable from the lobby, and while it cannot sell it has to be honest
      // about that. `ROSTER_GATED` is false, so `ownedSet()` is the whole roster, so
      // every character pull in every box resolves to its duplicate coin value — and
      // every box's BEST possible payout is below its own price (900 in / 520 best,
      // 3200 / 900, 5600 / 2200, 12000 / 2200). Nothing may therefore be purchasable.
      //
      // Asserted in both directions, exactly like the gem store above: every purchase
      // control must be DISABLED at the DOM level, and the copy must say so in words.
      // A live-looking Buy button that no-ops is the defect both menu critics punished.
      await page.click('[data-go="shop"]', { force: true });
      await atScreen(page, "shop", 20000);
      {
        const shop = await page.evaluate(() => {
          const buys = [...document.querySelectorAll('[data-buy]')];
          return {
            cards: document.querySelectorAll('.shop-card').length,
            odds: document.querySelectorAll('.shop-odds-row').length,
            buys: buys.length,
            live: buys.filter((b) => !b.disabled).length,
            priced: buys.filter((b) => /\d/.test(b.textContent)).length,
            notice: document.querySelector('.shop-notice')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          };
        });
        record('flow', 'shop', 'lobby-tab-reaches-the-shop', true, 'home -> shop');
        record('flow', 'shop', 'every-container-has-a-card', shop.cards === 5, `${shop.cards} cards`);
        // The drop table sits ON the cards rather than behind a tap, so a compliance
        // surface is never one modal away from every screenshot and every battery.
        record('flow', 'shop', 'drop-rates-are-published', shop.odds >= 15, `${shop.odds} odds rows`);
        record('flow', 'shop', 'NO-purchase-button-is-live', shop.buys > 0 && shop.live === 0,
          `${shop.live} of ${shop.buys} enabled`);
        record('flow', 'shop', 'prices-are-still-shown', shop.priced === shop.buys,
          `${shop.priced}/${shop.buys} carry a number`);
        record('flow', 'shop', 'unavailability-is-stated-in-words',
          /\b(not|nothing|no)\b[^.]{0,40}\bfor sale\b/i.test(shop.notice), shop.notice.slice(0, 90));
      }

      step = 'shop -> home';
      await page.click('[data-el="back"]', { force: true });
      await atScreen(page, "home", 20000);

      record('flow', '-', 'round-trip', true, 'home -> characters -> match -> home -> trophies -> home -> shop -> home');
    } catch (err) {
      record('flow', '-', 'round-trip', false, `failed at "${step}": ${String(err).split('\n')[0]}`);
    }
    record('flow', '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await page.close();
  }

  await auditOpening(browser);
  await auditSettings(browser);
  await auditEconomy(browser);

  await browser.close();

  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  for (const r of results) {
    if (r.ok && process.argv.includes('--quiet')) continue;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.vp, 16)} ${pad(r.screen, 18)} ${pad(r.check, 20)} ${r.detail}`);
  }
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
