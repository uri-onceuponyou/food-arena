#!/usr/bin/env node
/**
 * RCW_FIT — DOES THE RESULT CARD FIT THE SCREEN, AND DOES EVERY FIGHTER'S NAME STAY WITH
 * ITS OWN PORTRAIT?
 *
 * ## The defect this exists to measure
 *
 * `DECISIONS §70`, the one thing that pass stopped short of: at **430x932 the six-fighter
 * card is 705 px wide with its left edge at -138 px** — the winner's portrait and name are
 * entirely off-screen on the one screen whose whole job is to say who won. The mechanism is
 * three CSS facts, and this file measures all three rather than reading them:
 *
 *   * `.hud-gameover-subtitle` is `display: flex` with no `flex-wrap`, so the fighter row
 *     lays out on one line and grows without bound;
 *   * `.hud-gameover-card` is a centred flex column with no `max-width`, so it grows to its
 *     widest child and the overflow is SYMMETRIC — which is what a -138 px left edge on a
 *     430 px viewport is;
 *   * `named()` emits the portrait span and the name as SIBLINGS with no wrapper, so the
 *     moment wrapping is allowed a line break can land BETWEEN a fighter's portrait and that
 *     fighter's name. That is a worse defect than the one being fixed, and it is silent.
 *
 * ## 🚨 WHAT MAKES EACH ROW MEAN SOMETHING
 *
 * `docs/AGENT-BRIEF.md` §4.4 — *"a guard that has not been shown to FAIL on the bug it
 * guards against is not a guard"*, and *"ask of every assertion: what implementation would
 * fail this?"* Every section below names the arm that turns it red and `--selftest` runs
 * them and fails if an expected-red row comes back green:
 *
 *   §1 FIT    every rect is inside the viewport, and every flex row's children are inside
 *             their CONTAINER's content box.        RED under `--arm nowrap`.
 *   §2 PAIR   every fighter's name shares a flex line with that fighter's portrait and sits
 *             immediately after it.                 RED under `--arm split`.
 *   §3 COUNT  the number of (portrait, name) pairs found EQUALS the seat count.
 *                                                   RED under `--arm empty`.
 *
 * ⚠️ **§3 IS NOT A NICETY — IT IS WHAT STOPS §1 AND §2 GOING VACUOUS.** Both iterate over a
 * derived set of pairs, and `[].every()` is `true`: an empty subtitle passes "everything is
 * on screen" and "nothing is separated" perfectly. `CLAUDE.md` #6 records that exact vacuity
 * firing three times in three files in one session. `--arm empty` blanks the subtitle and
 * §3 is the only row that notices.
 *
 * ⚠️ **AND THE FIT BUDGET IS THE CONTAINER'S CONTENT BOX, NOT THE ITEMS THEMSELVES.**
 * `lu_sudden.mjs`'s fit arms record that `scrollWidth - clientWidth` **never moves for a
 * `nowrap` run** and that flex items measured against THEMSELVES can never overflow. Both
 * traps were walked into here before they were avoided, and both are now printed as `note`
 * lines with nothing asserted on them:
 *
 *   * `pageOverflow` reads **0 on all 126 cards, before and after** — `.hud-root` is
 *     `position: fixed`, and a fixed box contributes no scrollable overflow to the document,
 *     so the metric is structurally blind to a card hanging 138px off the left edge;
 *   * the first version of the row-overflow check measured each flex row against ITS OWN
 *     content box and stayed green under `--arm nowrapin`, because a row that cannot wrap
 *     takes its min-content width and overflows its PARENT while still containing its own
 *     children. It measures against the CARD now, which is the box whose width is fixed.
 *
 * Every surviving row compares a child rect against either the viewport or the card's
 * content box, never against a sibling.
 *
 * ## The DOM shapes this has to work on, and why the pairing is a TreeWalker
 *
 * Before the fix the subtitle's children are `[emoji, #text NAME, .hud-go-vs, emoji, #text,
 * ...]`; after it they are `[.hud-go-fighter(emoji, #text), .hud-go-vs, ...]`. A walker that
 * finds each `.hud-go-emoji` and takes the next non-empty text node in document order pairs
 * both shapes identically — which is exactly what makes the pre/post A/B a comparison rather
 * than two different measurements. `--arm split` (`display: contents` on the wrapper) puts
 * the post-fix DOM back into the pre-fix LAYOUT, so §2's known-bad is the real defect.
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/rcw_fit.mjs --url '{URL}' [--json out.json] [--shots dir]
 *   node tools/tmp/rcw_fit.mjs --url <base> --selftest
 *
 * ⚠️ `--url` must be a SNAPSHOT, never `:5173` (CLAUDE.md #2).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
// 🚨 IS_MAIN GUARD — `docs/AGENT-BRIEF.md` §3: three tools here made a function importable
// and silently made the whole CLI path run on import; one launched Chromium.
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const has = (name) => argv.includes(`--${name}`);

const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const ARM = flag('arm', 'base');
const JSON_OUT = flag('json', null);
const SHOTS = flag('shots', null);
const ONLY_VP = flag('vp', null);          // substring filter over viewport names
const SEATS = (flag('seats', '2,3,4,5,6')).split(',').map(Number);

/**
 * The viewports `menu_accept.mjs` and `menu_accept_portrait.mjs` use, verbatim, because the
 * task's definition of "fixed" is those two lists. 430x932 is the one `DECISIONS §70`
 * measured the -138 px on, so it is named rather than merely present.
 */
const VIEWPORTS = [
  { name: 'phone-360x800', width: 360, height: 800 },
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'phone-430x932', width: 430, height: 932 },   // ← DECISIONS §70's viewport
  { name: 'phone-844x390', width: 844, height: 390 },   // landscape phone: HEIGHT is scarce
  // ...and 667x375 is SHORTER still. It is the width the chip-rail rules in hud.ts derive
  // their arithmetic against ("at 667x375 the track is 231px"), so it is a viewport this
  // sheet already reasons about — and it was missing from the first version of this list,
  // which would have let the height budget be signed off against the wrong worst case.
  { name: 'phone-667x375', width: 667, height: 375 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'laptop-1280x800', width: 1280, height: 800 },
  { name: 'desktop-1600x900', width: 1600, height: 900 },
  { name: 'ultrawide-2560x1080', width: 2560, height: 1080 },
];

/** Distinct characters so a name IS a slot identity. HAMBURGER is the longest name. */
const IDS6 = ['sushi', 'hamburger', 'donut', 'taco', 'pizza', 'egg'];

// ─────────────────────────────────────────────────────────────────────────────
// Page-side. Stringified because it runs in the browser, where the real `src/ui/hud.ts`
// lives — no Node instrument can import `src/ui/**` (extension-less imports).
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SETUP = async () => {
  const H = await import('/src/ui/hud.ts');
  const sim = await import('/src/game/sim.ts');
  const arena = window.__matchArena;
  if (!arena) throw new Error('rcw_fit: window.__matchArena is absent — the page has no live match');
  window.__rcw = { H, sim, arena, insts: {} };
  await document.fonts.ready;
  return { fonts: document.fonts.size };
};

/**
 * Pause the DOM HUD's CSS keyframes. Inline copy of `sc_fogstill.mjs`'s `PAGE_STILL_HUD`,
 * for the same reason `arena-scan.mjs` inlines it: `tools/tmp` is mid-edit by peers and a
 * gate that imports a scratch probe inherits its owner.
 *
 * 🚨 CSS ANIMATIONS RUN ON THE DOCUMENT TIMELINE, NOT rAF, so freezing the loop does not
 * still them and `locator.screenshot()` is a page capture clipped to the element box.
 */
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'rcw-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
                + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

/**
 * Everything BUT the card under measurement, hidden — so a screenshot of the card is the
 * card, and so exactly one `.hud-gameover` is on screen. Returns what it hid, because
 * "it hid nothing" and "there was nothing to hide" must not be the same report.
 */
// ⚠️ SKIPS EVERY [data-rcw] HOST, NOT JUST THE CURRENT ONE, AND THAT WAS A MEASURED FAULT
// IN THIS TOOL. The first version hid every `.hud-root` outside the instance being measured
// — including the instances for OTHER seat counts, permanently, on their own element rather
// than on the host this file toggles. The next viewport then re-showed the host while the
// `.hud-root` inside it stayed `display: none`, so 406 of 464 pairs measured as zero-size
// boxes and the widest card in the run read 336px instead of 825px. It looked exactly like
// a real layout regression. Visibility is the HOST's business (PAGE_MEASURE); this function
// only removes things that are not ours.
const PAGE_ISOLATE = () => {
  let hidden = 0;
  for (const r of document.querySelectorAll('.hud-root')) {
    if (r.closest('[data-rcw]')) continue;
    r.style.display = 'none'; hidden++;
  }
  for (const sel of ['#screens', 'canvas']) {
    for (const e of document.querySelectorAll(sel)) { e.style.visibility = 'hidden'; hidden++; }
  }
  document.documentElement.style.background = '#101010';
  document.body.style.background = '#101010';
  return hidden;
};

/** Inject the known-bad CSS for `--arm`. Returns the rule text so a run records its own arm. */
const PAGE_ARM = (arm) => {
  // 🚨 EVERY ARM HERE IS A FULL REVERT OF ONE HALF OF THE FIX, AND THE FIRST DRAFT WAS NOT —
  // it reverted `max-width` while leaving `overflow-y: auto` in place, and the row it
  // targeted stayed GREEN. The reason is a real property of the shipped fix and is worth
  // more than the arm: a flex item whose `overflow` is anything but `visible` has its
  // AUTOMATIC MINIMUM SIZE resolve to 0 instead of to its min-content width. So with
  // `overflow-y: auto` on the card (and CSS forcing `overflow-x` to `auto` with it), the
  // card is squeezed to the scrim's content box by `flex-shrink` and its content is CLIPPED
  // rather than hung off the edge — 406px, not 705px. A control that leaves that in place is
  // measuring a third layout that neither commit ships.
  const rules = {
    // The PRE-FIX geometry, restored EXACTLY: no gutter, no bound on either axis, visible
    // overflow, and neither row wrapping. This is what `DECISIONS §70` measured at 705px.
    nowrap: '.hud-gameover{padding:0!important}'
          + '.hud-gameover-card{max-width:none!important;max-height:none!important;overflow:visible!important}'
          + '.hud-gameover-subtitle{flex-wrap:nowrap!important}'
          + '.hud-gameover-payout{flex-wrap:nowrap!important}',
    // HALF the fix: the card is bounded but the rows inside it still refuse to wrap. This
    // is the shape a "just add max-width" patch produces, and it is the ONLY thing that can
    // turn the container-content-box row red — while the card is unbounded, every row is
    // shrink-to-fit and therefore contains its own children by construction. That row would
    // otherwise be a comment with a tick next to it (AGENT-BRIEF §4.4).
    nowrapin: '.hud-gameover-subtitle{flex-wrap:nowrap!important}'
            + '.hud-gameover-payout{flex-wrap:nowrap!important}',
    // The wrapper's BOX removed, so its children become direct flex items of the subtitle
    // again — the pre-fix arrangement, with wrapping still on. A break can then land
    // between a portrait and its name.
    split: '.hud-go-fighter{display:contents!important}',
    // The short-viewport shrink UNDONE, back to the desktop chrome a 390px-tall screen was
    // being handed before this pass. This is what makes the vertical row falsifiable, and it
    // is the arm the sheet's own comment cites: the six-fighter card at 844x390 goes from
    // 265px to 399px against a 390px viewport, i.e. 9px past the bottom.
    tallcard: '@media (max-height:640px){'
            + '.hud-gameover-card{padding:38px 56px!important;gap:18px!important}'
            + '.hud-gameover-title{font-size:48px!important}'
            + '.hud-gameover-place{font-size:26px!important}}',
    // ⚠️ SYNTHETIC, AND SAID OUT LOUD. The Play Again row is the one statement here that no
    // REVERT of this change can falsify, and that is geometry rather than luck: the card is
    // centred, so it overflows symmetrically, and the button sits one padding above the
    // card's bottom edge. The button only leaves a 390px viewport once the card exceeds
    // 390 + 2x38 = 466px, and the fully-reverted card at 844x390 reaches 399. So the arm
    // that falsifies it is a card with A ROW THAT DOES NOT EXIST YET — which is exactly the
    // implementation the row is guarding against, since every previous version of this card
    // was one row shorter than the next.
    tallrow: '@media (max-height:640px){'
           + '.hud-gameover-card{padding:38px 56px!important;gap:18px!important}'
           + '.hud-gameover-stats{min-height:220px!important}}',
    base: '',
    empty: '',
  };
  const css = rules[arm] ?? '';
  if (css) {
    const s = document.createElement('style');
    s.id = 'rcw-arm';
    s.textContent = css;
    document.head.appendChild(s);
  }
  return css;
};

/**
 * Render ONE card at the current viewport and measure it.
 *
 * A detached HUD, not the live one: the live HUD is driven by `match.ts` every frame and
 * would overwrite anything written into it before it could be read. Note `.hud-root` is
 * itself `position: fixed; inset: 0` and no ancestor here establishes a containing block for
 * fixed descendants, so the detached card lays out at VIEWPORT coordinates — which is the
 * whole point, and is why the outer host is not parked off-screen.
 */
const PAGE_MEASURE = (spec) => {
  const { H, sim, arena, insts } = window.__rcw;
  const key = spec.ids.join(',');
  let inst = insts[key];
  if (!inst) {
    const host = document.createElement('div');
    host.setAttribute('data-rcw', key);
    document.body.appendChild(host);
    const hud = H.createHud(host, { onRestart() {}, onSelectWeapon() {} });
    hud.setCharacters(spec.ids);
    inst = insts[key] = { host, hud };
  }
  for (const other of Object.values(insts)) {
    other.host.style.display = other === inst ? '' : 'none';
  }
  window.__rcw.mineRoot = inst.host;

  const state = sim.createMatch(arena, spec.ids.map((c) => ({ characterId: c })));
  state.phase = 'ended';
  state.timeRemaining = 12_000;
  state.fighters.forEach((f, i) => {
    f.alive = !!spec.alive[i];
    if (!f.alive) { f.hp = 0; f.deaths = 1; }
  });
  state.winnerId = spec.winnerSlot;
  state.winner = spec.winnerSlot === 0 ? 'player' : 'enemy';
  inst.hud.update(state, {
    selectedWeapon: 0,
    safeArrow: null,
    aim: null,
    place: spec.place ?? null,
    order: spec.order ?? null,
    payout: spec.payout ?? null,
  });

  const card = inst.host.querySelector('.hud-gameover-card');
  const sub = card.querySelector('.hud-gameover-subtitle');
  const pay = card.querySelector('.hud-gameover-payout');
  // KNOWN-BAD `empty`: blank the subtitle AFTER update() so §1 and §2 have nothing left to
  // iterate over. Only §3 can see this.
  if (spec.arm === 'empty') sub.innerHTML = '';

  const W = window.innerWidth, Hh = window.innerHeight;
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { l: +b.left.toFixed(2), t: +b.top.toFixed(2), r: +b.right.toFixed(2), b: +b.bottom.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
  };

  // ── The (portrait, name) pairs, found the same way in BOTH DOM shapes ──────────
  // A TreeWalker over the subtitle: each `.hud-go-emoji`, then the next non-empty text
  // node in document order. Wrapped or unwrapped, that is the same pair.
  const walker = document.createTreeWalker(sub, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const seq = [];
  while (walker.nextNode()) seq.push(walker.currentNode);
  const pairs = [];
  for (let i = 0; i < seq.length; i++) {
    const n = seq[i];
    if (n.nodeType !== 1 || !n.classList.contains('hud-go-emoji')) continue;
    let name = null;
    for (let j = i + 1; j < seq.length; j++) {
      const m = seq[j];
      if (m.nodeType === 3 && m.textContent.trim()) { name = m; break; }
      if (m.nodeType === 1 && m.classList.contains('hud-go-emoji')) break;   // next fighter first
    }
    if (!name) { pairs.push({ text: null, portrait: r(n), name: null }); continue; }
    const range = document.createRange();
    range.selectNodeContents(name);
    const rects = [...range.getClientRects()];
    const box = range.getBoundingClientRect();
    pairs.push({
      text: name.textContent.trim(),
      portrait: r(n),
      name: { l: +box.left.toFixed(2), t: +box.top.toFixed(2), r: +box.right.toFixed(2), b: +box.bottom.toFixed(2), w: +box.width.toFixed(2), h: +box.height.toFixed(2) },
      nameLines: rects.length,
      firstLine: rects.length ? { l: +rects[0].left.toFixed(2), t: +rects[0].top.toFixed(2), r: +rects[0].right.toFixed(2), b: +rects[0].bottom.toFixed(2) } : null,
    });
  }

  // ── Container content boxes, which is what the fit budget actually is ──────────
  const contentBox = (el) => {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
    const bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth);
    return { l: b.left + bl + pl, r: b.right - br - pr, w: b.width - bl - br - pl - pr };
  };
  // 🚨 THE BUDGET IS THE CARD'S CONTENT BOX, NOT THE ROW'S OWN, AND THE FIRST DRAFT USED THE
  // ROW'S OWN — which is a tautology and behaved like one: `--arm nowrapin` (rows that
  // refuse to wrap inside a bounded card) left it GREEN. A flex row that cannot wrap simply
  // takes its min-content width and OVERFLOWS ITS PARENT, so it still contains its own
  // children by construction, exactly the shape `lu_sudden.mjs` records as "flex items
  // measured against THEMSELVES can never overflow". The card is the container whose width
  // is actually fixed, so the card is the budget.
  const rowOverflow = (el, budget) => {
    if (!el || getComputedStyle(el).display === 'none') return null;
    const kids = [...el.children];
    if (!kids.length) return { kids: 0, over: 0, box: +budget.w.toFixed(2) };
    let lo = Infinity, hi = -Infinity;
    for (const k of kids) { const b = k.getBoundingClientRect(); lo = Math.min(lo, b.left); hi = Math.max(hi, b.right); }
    return { kids: kids.length, box: +budget.w.toFixed(2), over: +Math.max(0, budget.l - lo, hi - budget.r).toFixed(2) };
  };
  const cardBox = contentBox(card);

  const btn = card.querySelector('.hud-gameover-btn');
  return {
    vw: W, vh: Hh,
    card: r(card),
    // Recorded, not asserted on — see the note where the rows are built for the measurement
    // that retired the row this used to feed.
    scroll: { sh: card.scrollHeight, ch: card.clientHeight },
    btn: btn ? r(btn) : null,
    subtitle: r(sub),
    subRow: rowOverflow(sub, cardBox),
    payRow: rowOverflow(pay, cardBox),
    pairs,
    verbs: [...sub.querySelectorAll('.hud-go-vs')].map((e) => e.textContent.trim()),
    wrappers: sub.querySelectorAll('.hud-go-fighter').length,
    // REPORTED, NEVER ASSERTED ON. `.hud-root` is `position: fixed`, and a fixed box
    // contributes no scrollable overflow to the document, so this is 0 whether the card
    // fits or hangs 138 px off the left edge. `lu_sudden.mjs` recorded the same blindness
    // for a `nowrap` run; it is kept only so a reader can see it never moves.
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────────────

const rows = [];
const check = (section, name, pass, evidence) => {
  rows.push({ section, name, pass: !!pass, evidence });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} §${section} ${name}${evidence ? ` — ${evidence}` : ''}`);
  return !!pass;
};

/** The cases: every seat count x two payout shapes x an all-dead and a mixed end state. */
function cases(seats) {
  const out = [];
  for (const n of seats) {
    const ids = IDS6.slice(0, n);
    const winnerSlot = 0;
    // Finishing order that is NOT slot order, so the card's own list is exercised.
    const order = [...Array(n).keys()].reverse();
    order.splice(order.indexOf(winnerSlot), 1);
    order.unshift(winnerSlot);
    // (a) every loser dead — one "defeated" group.
    out.push({
      id: `n${n}-dead-pay4`, ids, winnerSlot, order,
      alive: ids.map((_, i) => i === winnerSlot),
      place: { place: 1, of: n },
      payout: { trophies: 15, coins: 160, xp: 100, chests: 1 },
    });
    // (b) mixed dead/alive — BOTH verb spans present, which is the widest subtitle a card
    // of this seat count can produce. Only meaningful above two seats.
    if (n > 2) {
      out.push({
        id: `n${n}-mixed-pay4`, ids, winnerSlot, order,
        alive: ids.map((_, i) => i === winnerSlot || i % 2 === 1),
        place: { place: 1, of: n },
        payout: { trophies: 15, coins: 160, xp: 100, chests: 1 },
      });
    }
    // (c) no payout at all — the shipped two-seat card today.
    out.push({
      id: `n${n}-dead-nopay`, ids, winnerSlot, order,
      alive: ids.map((_, i) => i === winnerSlot),
      place: { place: 1, of: n },
      payout: null,
    });
  }
  return out;
}

async function newPage(browser, url, vp) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // A peer's save must not reload the page mid-run; the snapshot freezes the tree, this
  // closes the HMR socket as well.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
      + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
      + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
      + 'export const ErrorOverlay=class{};export default {};',
  }));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
  return { page, errors };
}

const TOL = {
  line: 3,      // px of vertical centre disagreement allowed between a portrait and its name
  gapMin: -1,   // the name may start no earlier than the portrait's right edge
  gapMax: 16,   // ...and no later than one flex gap after it
  edge: 0.5,    // sub-pixel slack on a viewport edge
};

async function run() {
  if (!BASE) {
    console.error('rcw_fit: --url (or PREVIEW_BASE) is required, and it must be a snapshot.');
    process.exit(2);
  }
  const browser = await chromium.launch();
  const all = [];
  try {
    const vps = VIEWPORTS.filter((v) => !ONLY_VP || v.name.includes(ONLY_VP));
    const { page, errors } = await newPage(
      browser, `${BASE}/?fighters=${IDS6.join(';')}&pointerLock=0&simSpeed=1`, vps[0],
    );
    const setup = await page.evaluate(PAGE_SETUP);
    console.log(`  (fonts loaded: ${setup.fonts})`);
    const armCss = await page.evaluate(PAGE_ARM, ARM);
    if (armCss) console.log(`  (arm ${ARM}: ${armCss})`);
    await page.evaluate(PAGE_STILL_HUD);

    for (const vp of vps) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const c of cases(SEATS)) {
        const m = await page.evaluate(PAGE_MEASURE, { ...c, arm: ARM });
        if (vp.width !== m.vw || vp.height !== m.vh) {
          throw new Error(`rcw_fit: viewport did not take — asked ${vp.width}x${vp.height}, page says ${m.vw}x${m.vh}`);
        }
        all.push({ vp: vp.name, case: c.id, seats: c.ids.length, m });
        if (SHOTS) {
          await page.evaluate(PAGE_ISOLATE);
          const dir = resolve(SHOTS);
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${vp.name}-${c.id}.png` });
        }
      }
    }
    await page.close();
    if (errors.length) console.log(`  (page errors: ${errors.slice(0, 2).join(' | ')})`);
  } finally {
    await browser.close();
  }

  // ── §3 first, because §1 and §2 are vacuous without it ────────────────────────
  const badCount = all.filter((a) => a.m.pairs.length !== a.seats);
  check('3', 'every card yielded exactly one (portrait, name) pair per seat',
    all.length > 0 && badCount.length === 0,
    badCount.length
      ? `${badCount.length}/${all.length} wrong, first ${badCount[0].vp}/${badCount[0].case}: ${badCount[0].m.pairs.length} pairs for ${badCount[0].seats} seats`
      : `${all.length} cards, ${all.reduce((s, a) => s + a.m.pairs.length, 0)} pairs`);
  check('3', 'and the case matrix is non-empty', all.length > 0, `${all.length} cases`);

  // ── §1 FIT ────────────────────────────────────────────────────────────────────
  const offCard = all.filter((a) => a.m.card.l < -TOL.edge || a.m.card.r > a.m.vw + TOL.edge);
  check('1', "the card's own box is inside the viewport horizontally",
    offCard.length === 0,
    offCard.length
      ? `${offCard.length}/${all.length} overflow, worst ${worst(offCard, (a) => Math.max(-a.m.card.l, a.m.card.r - a.m.vw))}`
      : `${all.length} cards, widest ${Math.max(...all.map((a) => a.m.card.w)).toFixed(0)}px`);

  const offCardV = all.filter((a) => a.m.card.t < -TOL.edge || a.m.card.b > a.m.vh + TOL.edge);
  check('1', "...and vertically",
    offCardV.length === 0,
    offCardV.length
      ? `${offCardV.length}/${all.length} overflow, worst ${worst(offCardV, (a) => Math.max(-a.m.card.t, a.m.card.b - a.m.vh))}`
      : `${all.length} cards, tallest ${Math.max(...all.map((a) => a.m.card.h)).toFixed(0)}px`);

  // 🚨 THERE IS DELIBERATELY NO "the card does not have to scroll" ROW HERE, AND ITS ABSENCE
  // IS A RESULT. One existed while the sheet carried max-height:100% + overflow-y:auto, and
  // it was the only falsifiable vertical row then, because the box row was true by
  // construction. With that removed, the pair swapped places: the card is a plain flex
  // column that sizes to its content, so its content box ALWAYS contains its children and
  // `scrollHeight === clientHeight` no matter how tall it gets. MEASURED, not assumed —
  // `--arm tallcard` at 844x390 produces a card with -17px of viewport slack and the row
  // stayed GREEN at 14/14. A row that cannot fail is worse than no row (AGENT-BRIEF §4.4),
  // so it was deleted and the box row above, which `--arm tallcard` does turn red, is the
  // vertical statement. `scroll` is still recorded in --json for a reader.
  const scrollSpread = [...new Set(all.map((a) => a.m.scroll.sh - a.m.scroll.ch))];
  console.log(`  note  scrollHeight-clientHeight over all ${all.length} cards: ${scrollSpread.join(',')}`
    + ` — REPORTED ONLY, see the comment above. Tightest vertical slack`
    + ` ${Math.min(...all.map((a) => a.m.vh - a.m.card.h)).toFixed(0)}px.`);
  const offBtn = all.filter((a) => a.m.btn && (a.m.btn.b > a.m.vh + TOL.edge || a.m.btn.t < -TOL.edge
    || a.m.btn.l < -TOL.edge || a.m.btn.r > a.m.vw + TOL.edge));
  check('1', 'the Play Again button is inside the viewport on every card',
    all.every((a) => a.m.btn) && offBtn.length === 0,
    offBtn.length ? `${offBtn.length} off, first ${offBtn[0].vp}/${offBtn[0].case} bottom=${offBtn[0].m.btn.b} vh=${offBtn[0].m.vh}`
      : `${all.length} buttons`);

  const offPart = [];
  for (const a of all) {
    for (const p of a.m.pairs) {
      for (const [what, b] of [['portrait', p.portrait], ['name', p.name]]) {
        if (!b) continue;
        if (b.l < -TOL.edge || b.r > a.m.vw + TOL.edge || b.t < -TOL.edge || b.b > a.m.vh + TOL.edge) {
          offPart.push({ a, what, who: p.text, b });
        }
      }
    }
  }
  check('1', "every fighter's portrait AND name is inside the viewport",
    offPart.length === 0,
    offPart.length
      ? `${offPart.length} off-screen, first ${offPart[0].a.vp}/${offPart[0].a.case} ${offPart[0].who} ${offPart[0].what} l=${offPart[0].b.l} r=${offPart[0].b.r}`
      : `${all.reduce((s, a) => s + a.m.pairs.length * 2, 0)} boxes`);

  const rowOver = all.flatMap((a) => [['subtitle', a.m.subRow], ['payout', a.m.payRow]]
    .filter(([, r]) => r && r.over > TOL.edge).map(([w, r]) => ({ a, w, r })));
  check('1', "no flex row's content escapes the CARD's content box",
    rowOver.length === 0,
    rowOver.length
      ? `${rowOver.length} rows, first ${rowOver[0].a.vp}/${rowOver[0].a.case} ${rowOver[0].w} +${rowOver[0].r.over}px over ${rowOver[0].r.box}px`
      : `${all.length * 2} rows`);

  // ── §2 PAIR ───────────────────────────────────────────────────────────────────
  const split = [];
  for (const a of all) {
    for (const p of a.m.pairs) {
      if (!p.name || !p.firstLine) { split.push({ a, p, why: 'no name' }); continue; }
      const pc = (p.portrait.t + p.portrait.b) / 2;
      const nc = (p.firstLine.t + p.firstLine.b) / 2;
      const dx = p.firstLine.l - p.portrait.r;
      if (Math.abs(pc - nc) > TOL.line) split.push({ a, p, why: `dy=${(nc - pc).toFixed(1)}` });
      else if (dx < TOL.gapMin || dx > TOL.gapMax) split.push({ a, p, why: `dx=${dx.toFixed(1)}` });
    }
  }
  check('2', "no fighter's name is separated from that fighter's portrait",
    split.length === 0,
    split.length
      ? `${split.length} split, first ${split[0].a.vp}/${split[0].a.case} ${split[0].p.text} (${split[0].why})`
      : `${all.reduce((s, a) => s + a.m.pairs.length, 0)} pairs on one line each`);

  // ── Reported, not asserted ────────────────────────────────────────────────────
  const po = [...new Set(all.map((a) => a.m.pageOverflow))];
  console.log(`  note  document scrollWidth-clientWidth over all ${all.length} cards: ${po.join(',')}`
    + ' — REPORTED ONLY: .hud-root is position:fixed and contributes no scrollable overflow,'
    + ' so this cannot see the defect (lu_sudden recorded the same blindness).');

  if (JSON_OUT) {
    mkdirSync(dirname(resolve(JSON_OUT)), { recursive: true });
    writeFileSync(resolve(JSON_OUT), `${JSON.stringify({ arm: ARM, at: new Date().toISOString(), all }, null, 2)}\n`);
    console.log(`  wrote ${JSON_OUT}`);
  }

  const failed = rows.filter((r) => !r.pass);
  console.log(`\nrcw_fit: ${rows.length - failed.length}/${rows.length} checks passed (arm=${ARM}, ${all.length} cards)`);
  return failed.length;
}

function worst(list, f) {
  let best = list[0], v = f(list[0]);
  for (const x of list) if (f(x) > v) { v = f(x); best = x; }
  return `${best.vp}/${best.case} by ${v.toFixed(1)}px (card ${best.m.card.w.toFixed(0)}px, left ${best.m.card.l.toFixed(0)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest: run every known-bad arm and require the row it targets to be RED.
// ⚠️ `--selftest` validates this tool's LOGIC. It never validates where it is POINTED —
// `valuescan` read a perfect selftest with 14 of 18 stations in the wrong quadrant.
// ─────────────────────────────────────────────────────────────────────────────

const SELFTEST = [
  { arm: 'nowrap', mustFail: "the card's own box is inside the viewport horizontally", vp: 'phone-430x932' },
  { arm: 'nowrap', mustFail: "every fighter's portrait AND name is inside the viewport", vp: 'phone-430x932' },
  { arm: 'nowrapin', mustFail: "no flex row's content escapes the CARD's content box", vp: 'phone-430x932' },
  { arm: 'tallcard', mustFail: '...and vertically', vp: 'phone-844x390' },
  { arm: 'tallrow', mustFail: 'the Play Again button is inside the viewport on every card', vp: 'phone-844x390' },
  { arm: 'split', mustFail: "no fighter's name is separated from that fighter's portrait", vp: 'phone-360x800' },
  { arm: 'empty', mustFail: 'every card yielded exactly one (portrait, name) pair per seat', vp: 'phone-430x932' },
];

async function selftest() {
  const self = resolve(new URL(import.meta.url).pathname);
  const { spawnSync } = await import('node:child_process');
  let bad = 0;
  for (const t of SELFTEST) {
    const args = [self, '--url', BASE, '--arm', t.arm, '--vp', t.vp];
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
    const line = (r.stdout ?? '').split('\n').find((l) => l.includes(t.mustFail));
    const red = !!line && line.trim().startsWith('FAIL');
    console.log(`  ${red ? 'ok  ' : 'FAIL'} --arm ${t.arm} @${t.vp}: "${t.mustFail}" is ${red ? 'RED' : 'GREEN'}`);
    if (!red) { bad++; console.log(`        ${(line ?? '(row absent)').trim()}`); }
  }
  console.log(`\nrcw_fit --selftest: ${SELFTEST.length - bad}/${SELFTEST.length} known-bads turned their row red`);
  return bad;
}

if (IS_MAIN) {
  const code = has('selftest') ? await selftest() : await run();
  process.exit(code === 0 ? 0 : 1);
}

export { PAGE_MEASURE, PAGE_SETUP, VIEWPORTS, cases };
