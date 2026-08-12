#!/usr/bin/env node
/**
 * RCW_PIXELS — THE TWO-SEAT RESULT CARD, PIXEL FOR PIXEL, BEFORE AND AFTER.
 *
 * ## Why this exists, and what it replaces
 *
 * `tools/tmp/rc_card.mjs` §A is the standing guard on the two-seat card: 24 end states
 * rendered through the real `hud.ts` and compared byte-for-byte against an oracle recorded
 * on a detached worktree of the pre-change commit. Wrapping each fighter in a
 * `.hud-go-fighter` span **changes that markup at every seat count**, so §A goes red — and
 * that is correct rather than a failure. But "the markup moved by exactly one wrapper per
 * fighter" is a statement about the DOM, and **the claim that matters to a player is about
 * the PIXELS**: two seats is what ships today, and it must look exactly the same.
 *
 * So this file answers the other half. It screenshots the two-seat card on a tree, and
 * `--compare A B` diffs two such runs channel-for-channel.
 *
 * ## 🚨 WHAT WOULD FAIL THIS — three arms, because "0 differing pixels" has three ways of
 * being a lie
 *
 *   1. **The differ is blind.** `--compare` also diffs one case against a DIFFERENT case in
 *      the same run and requires that to be non-zero. A comparator that returns 0 for two
 *      files it has never opened returns 0 here too, and this catches it.
 *   2. **The change is smaller than the comparison.** `--arm nudge` moves the wrapper's
 *      internal gap by ONE pixel. A run against it must show a non-zero diff, which is what
 *      makes "0" mean "identical" rather than "within tolerance". Threshold is EXACT — 0.
 *   3. **There was nothing to compare.** Every row asserts its case list is non-empty and
 *      that the two runs cover the same case IDs before it subtracts anything.
 *      `[].every()` is `true`; `CLAUDE.md` #6 records that vacuity firing three times in one
 *      session.
 *
 * ## ⚠️ AND THE CLAIM IS SCOPED, BECAUSE IT HAS TO BE
 *
 * `max-width: 100%` on the card can only bite where the card was ALREADY overflowing the
 * viewport. At 430x932 a two-seat card carrying a four-chip payout measured **453.1px wide
 * with its left edge at -11.5px** before this change — so that case is *supposed* to move,
 * and a test demanding zero everywhere would be demanding the bug back. Each case is
 * therefore classified from the BASELINE run's own measured card rect:
 *
 *   FITTED  — the pre-change card was inside the viewport  -> MUST be pixel-identical
 *   OVER    — the pre-change card hung off the edge        -> MUST have changed, and the
 *             new card must fit
 *
 * Both directions are asserted. A fix that changed nothing would fail the second.
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean-<sha> -- \
 *     node tools/tmp/rcw_pixels.mjs --url '{URL}' --out <dir>/before
 *   node tools/tmp/sx_snap.mjs --root . -- \
 *     node tools/tmp/rcw_pixels.mjs --url '{URL}' --out <dir>/after
 *   node tools/tmp/rcw_pixels.mjs --compare <dir>/before <dir>/after
 *
 * ⚠️ `--url` must be a SNAPSHOT, never `:5173` (CLAUDE.md #2).
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// 🚨 IS_MAIN GUARD — `docs/AGENT-BRIEF.md` §3.
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const ARM = flag('arm', 'base');
const OUT = flag('out', null);
const CMP = argv.indexOf('--compare');

const IDS2 = ['sushi', 'hamburger'];

/** Three viewports: rc_card's own, the phone §70 measured on, and the shortest one. */
const VIEWPORTS = [
  { name: 'w1280x720', width: 1280, height: 720 },
  { name: 'w430x932', width: 430, height: 932 },
  { name: 'w844x390', width: 844, height: 390 },
];

/**
 * Two-seat end states. Both winners, both loser states, and three payout shapes — including
 * the FOUR-chip one, which is the case that is expected to move at 430x932.
 */
function cases() {
  const out = [];
  const payouts = [
    ['nopay', null],
    ['pay3', { trophies: 3, coins: 28, xp: 48 }],
    ['pay3neg', { trophies: -5, coins: 20, xp: 35 }],
    ['pay4', { trophies: 15, coins: 160, xp: 100, chests: 1 }],
  ];
  for (const winnerSlot of [0, 1]) {
    for (const [aName, alive] of [['dead', [true, false]], ['alive', [true, true]]]) {
      for (const [pName, payout] of payouts) {
        out.push({
          id: `w${winnerSlot}-${aName}-${pName}`,
          ids: IDS2,
          winnerSlot,
          alive: winnerSlot === 0 ? alive : [alive[1], alive[0]],
          order: null,
          place: { place: winnerSlot === 0 ? 1 : 2, of: 2 },
          payout,
        });
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page side
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SETUP = async () => {
  const H = await import('/src/ui/hud.ts');
  const sim = await import('/src/game/sim.ts');
  const arena = window.__matchArena;
  if (!arena) throw new Error('rcw_pixels: window.__matchArena is absent');
  window.__rcwp = { H, sim, arena, inst: null };
  await document.fonts.ready;
  return { fonts: document.fonts.size };
};

/** Inline copy of `sc_fogstill.mjs`'s stiller — CSS keyframes run on the document
 *  timeline, not rAF, so freezing the loop does not still them. */
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'rcwp-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
                + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* done */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

/** One-pixel known-bad. If a run against this shows 0 differing pixels, the comparison is
 *  not a comparison. */
const PAGE_ARM = (arm) => {
  const css = arm === 'nudge' ? '.hud-go-fighter{gap:9px!important}'
    // `noover` is not a known-bad — it is the ABLATION that identified why 16 of 28
    // layout-identical two-seat cards still differed by 18-412 antialiased pixels at a max
    // channel delta of 6/255, all of them on CURVES (portrait discs, chip pills, the Play
    // Again corners) and none on text or straight edges. Turning the card back into a
    // non-scroll container drops those to zero: `overflow-y: auto` makes the card a scroll
    // container, and Chromium rasterises its rounded edges through a different path.
    : arm === 'noover' ? '.hud-gameover-card{overflow:visible!important;max-height:none!important}'
    : '';
  if (css) {
    const s = document.createElement('style');
    s.id = 'rcwp-arm';
    s.textContent = css;
    document.head.appendChild(s);
  }
  return css;
};

const PAGE_BUILD = () => {
  const { H, sim, arena } = window.__rcwp;
  if (!window.__rcwp.inst) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const hud = H.createHud(host, { onRestart() {}, onSelectWeapon() {} });
    hud.setCharacters(['sushi', 'hamburger']);
    window.__rcwp.inst = { host, hud };
  }
  // Everything but this card, hidden — the capture is a full-viewport page shot, so the
  // live HUD, the screens layer and the WebGL canvas must not be in it. A solid backdrop
  // makes the card's own 55% scrim deterministic.
  let hidden = 0;
  for (const r of document.querySelectorAll('.hud-root')) {
    if (window.__rcwp.inst.host.contains(r)) continue;
    r.style.display = 'none'; hidden++;
  }
  for (const e of document.querySelectorAll('#screens, canvas')) { e.style.visibility = 'hidden'; hidden++; }
  document.documentElement.style.background = '#101010';
  document.body.style.background = '#101010';
  return { hidden, cached: document.querySelectorAll('.fa-ic-portrait.has-render').length };
};

const PAGE_RENDER = (spec) => {
  const { sim, arena, inst } = window.__rcwp;
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
    selectedWeapon: 0, safeArrow: null, aim: null,
    place: spec.place ?? null, order: spec.order ?? null, payout: spec.payout ?? null,
  });
  const card = inst.host.querySelector('.hud-gameover-card');
  const b = card.getBoundingClientRect();
  return {
    card: { l: +b.left.toFixed(2), t: +b.top.toFixed(2), r: +b.right.toFixed(2), b: +b.bottom.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) },
    vw: window.innerWidth, vh: window.innerHeight,
    // Whether any portrait is a real render rather than the neutral mark. Recorded so the
    // two arms can be shown to have been in the SAME state — a thumbnail landing in one
    // run and not the other would be a difference this tool did not cause.
    rendered: card.querySelectorAll('.fa-ic-portrait.has-render').length,
    wrappers: card.querySelectorAll('.hud-go-fighter').length,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

async function capture() {
  if (!BASE) { console.error('rcw_pixels: --url (or PREVIEW_BASE) is required.'); process.exit(2); }
  if (!OUT) { console.error('rcw_pixels: --out <dir> is required.'); process.exit(2); }
  const dir = resolve(OUT);
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const meta = { arm: ARM, at: new Date().toISOString(), cards: {} };
  try {
    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
        + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
        + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
        + 'export const ErrorOverlay=class{};export default {};',
    }));
    await page.goto(`${BASE}/?fighters=${IDS2.join(';')}&pointerLock=0&simSpeed=1`,
      { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
    const setup = await page.evaluate(PAGE_SETUP);
    const armCss = await page.evaluate(PAGE_ARM, ARM);
    await page.evaluate(PAGE_STILL_HUD);
    const built = await page.evaluate(PAGE_BUILD);
    console.log(`  fonts=${setup.fonts} hidden=${built.hidden} arm=${ARM}${armCss ? ` (${armCss})` : ''}`);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.evaluate(PAGE_BUILD);
      for (const c of cases()) {
        const m = await page.evaluate(PAGE_RENDER, c);
        if (m.vw !== vp.width || m.vh !== vp.height) {
          throw new Error(`rcw_pixels: viewport did not take (${m.vw}x${m.vh} != ${vp.width}x${vp.height})`);
        }
        const key = `${vp.name}-${c.id}`;
        meta.cards[key] = m;
        await page.screenshot({ path: `${dir}/${key}.png` });
      }
    }
    if (errors.length) console.log(`  (page errors: ${errors.slice(0, 2).join(' | ')})`);
    await page.close();
  } finally {
    await browser.close();
  }
  writeFileSync(`${dir}/meta.json`, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`  wrote ${Object.keys(meta.cards).length} shots + meta.json to ${dir}`);
  return 0;
}

/** Exact channel-for-channel difference. Returns -1 if the two images differ in SIZE. */
async function diff(a, b) {
  const [ra, rb] = await Promise.all([
    sharp(a).raw().toBuffer({ resolveWithObject: true }),
    sharp(b).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) return -1;
  const ch = ra.info.channels;
  let px = 0, maxd = 0;
  for (let i = 0; i < ra.data.length; i += ch) {
    let d = 0;
    for (let k = 0; k < ch; k++) d = Math.max(d, Math.abs(ra.data[i + k] - rb.data[i + k]));
    if (d > 0) { px++; if (d > maxd) maxd = d; }
  }
  return { px, maxd, total: ra.info.width * ra.info.height };
}

const rows = [];
const check = (name, pass, evidence) => {
  rows.push({ name, pass: !!pass, evidence });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${evidence ? ` — ${evidence}` : ''}`);
  return !!pass;
};

async function compare(dirA, dirB) {
  const A = resolve(dirA), B = resolve(dirB);
  const ma = JSON.parse(readFileSync(`${A}/meta.json`, 'utf8'));
  const mb = JSON.parse(readFileSync(`${B}/meta.json`, 'utf8'));
  const keysA = Object.keys(ma.cards).sort();
  const keysB = Object.keys(mb.cards).sort();

  // ── PRECONDITIONS, ASSERTED BEFORE ANYTHING IS SUBTRACTED ────────────────────
  if (!check('both runs are non-empty and cover the same cases',
    keysA.length > 0 && keysA.join() === keysB.join(),
    `${keysA.length} vs ${keysB.length} cases`)) return 1;
  const shotsA = readdirSync(A).filter((f) => f.endsWith('.png'));
  check('every case has a shot on disk in both runs',
    shotsA.length === keysA.length
      && readdirSync(B).filter((f) => f.endsWith('.png')).length === keysA.length,
    `${shotsA.length} png`);
  check('the two runs had the same portrait-cache state',
    keysA.every((k) => ma.cards[k].rendered === mb.cards[k].rendered),
    `baseline rendered=${[...new Set(keysA.map((k) => ma.cards[k].rendered))].join(',')}`
      + ` / candidate rendered=${[...new Set(keysA.map((k) => mb.cards[k].rendered))].join(',')}`);
  check('the two runs are the two DOM shapes (0 wrappers vs 2)',
    keysA.every((k) => ma.cards[k].wrappers === 0) && keysB.every((k) => mb.cards[k].wrappers === 2),
    `baseline ${[...new Set(keysA.map((k) => ma.cards[k].wrappers))].join(',')}`
      + ` -> candidate ${[...new Set(keysB.map((k) => mb.cards[k].wrappers))].join(',')}`);

  // 🚨 THE DIFFER IS NOT BLIND — prove it on two files that MUST differ before believing a
  // zero anywhere below. Two different cases from the SAME baseline run.
  const control = await diff(`${A}/${keysA[0]}.png`, `${A}/${keysA.find((k) => k !== keysA[0] && k.startsWith(keysA[0].split('-')[0]))}.png`);
  check('the differ can see a difference at all (two different cases, same run)',
    control !== -1 && control.px > 0, `${control === -1 ? 'size mismatch' : `${control.px} px`}`);

  // ── THREE CLASSES, NOT TWO, AND THE THIRD IS A DECLARED INTENTIONAL CHANGE ───
  // The first version of this file had two, demanded pixel identity of everything that
  // already fitted, and went red on 16 cards at 844x390 — correctly, because the change
  // ALSO adds a max-height:640px block that deliberately shrinks the card's chrome on a
  // landscape phone (48px title -> 30px, 38x56 padding -> 18x28). That is not a regression
  // and it is not an accident: it is what buys the height the wrapped six-fighter card
  // needs there. A test that hid it inside a tolerance would be worse than one that fails,
  // so it gets its own class and its own assertion.
  const SHORT = (k) => ma.cards[k].vh <= 640;
  const short = keysA.filter(SHORT);
  const rest = keysA.filter((k) => !SHORT(k));
  const fitted = rest.filter((k) => ma.cards[k].card.l >= -0.5 && ma.cards[k].card.r <= ma.cards[k].vw + 0.5);
  const over = rest.filter((k) => !fitted.includes(k));
  check('the case matrix contains ALL THREE classes (so no row below is vacuous)',
    fitted.length > 0 && over.length > 0 && short.length > 0,
    `${fitted.length} FITTED, ${over.length} OVER, ${short.length} SHORT`);

  let identical = 0; const moved = [];
  for (const k of fitted) {
    const d = await diff(`${A}/${k}.png`, `${B}/${k}.png`);
    if (d !== -1 && d.px === 0) identical++;
    else moved.push(`${k} (${d === -1 ? 'size' : `${d.px}px, max delta ${d.maxd}`})`);
  }
  check('FITTED two-seat cards are pixel-identical, exactly',
    moved.length === 0,
    moved.length ? `${moved.length}/${fitted.length} moved: ${moved.slice(0, 3).join('; ')}`
      : `${identical}/${fitted.length} identical at 0 px`);

  const stillOver = []; const unchanged = [];
  for (const k of over) {
    const c = mb.cards[k];
    if (c.card.l < -0.5 || c.card.r > c.vw + 0.5) stillOver.push(`${k} (l=${c.card.l} r=${c.card.r} vw=${c.vw})`);
    const d = await diff(`${A}/${k}.png`, `${B}/${k}.png`);
    if (d !== -1 && d.px === 0) unchanged.push(k);
  }
  check('OVERFLOWING two-seat cards now fit', stillOver.length === 0,
    stillOver.length ? stillOver.join('; ') : `${over.length} cards, all inside the viewport`);
  check('...and they actually CHANGED (a no-op fix would fail here)',
    unchanged.length === 0,
    unchanged.length ? `${unchanged.length} identical despite overflowing: ${unchanged.join(' ')}`
      : `${over.length} cards moved`);

  // ── SHORT: the declared intentional change, asserted in BOTH directions ───────
  const shortGrew = short.filter((k) => mb.cards[k].card.h >= ma.cards[k].card.h);
  check('SHORT viewports (<=640px tall) got the declared chrome shrink, every case',
    short.length > 0 && shortGrew.length === 0,
    shortGrew.length ? `${shortGrew.length} did not shrink: ${shortGrew.slice(0, 3).map((k) => `${k} ${ma.cards[k].card.h}->${mb.cards[k].card.h}`).join('; ')}`
      : `${short.length} cards shorter, e.g. ${short[0]} h ${ma.cards[short[0]].card.h}->${mb.cards[short[0]].card.h}`);
  const shortOff = short.filter((k) => {
    const B = mb.cards[k];
    return B.card.l < -0.5 || B.card.r > B.vw + 0.5 || B.card.t < -0.5 || B.card.b > B.vh + 0.5;
  });
  check('...and the shrunk card is inside the viewport on both axes',
    shortOff.length === 0, shortOff.length ? shortOff.join('; ') : `${short.length} cards`);

  const failed = rows.filter((r) => !r.pass);
  console.log(`\nrcw_pixels --compare: ${rows.length - failed.length}/${rows.length} checks passed`);
  return failed.length;
}

if (IS_MAIN) {
  let code;
  if (CMP >= 0) code = await compare(argv[CMP + 1], argv[CMP + 2]);
  else code = await capture();
  process.exit(code === 0 ? 0 : 1);
}

export { cases, diff };
