#!/usr/bin/env node
/**
 * RC_CARD — THE RESULT CARD, MEASURED: FINISHING ORDER, THE PAYOUT, AND THE ONE BANK.
 *
 * ## What it is for
 *
 * `DECISIONS §64` defect 3, in two halves:
 *
 *   * the loser list was `roster.filter((_, i) => i !== winnerSlot)` — **slot order** — so a
 *     six-way read `SUSHI defeated HAMBURGER DONUT TACO PIZZA EGG` **whichever way the match
 *     went**, and `resolvePlaces`' own numbers say slot order names the wrong runner-up in
 *     **100% of six-seat matches**;
 *   * the card showed **no money at all**, two commits after `bb00d66` made a 3rd-of-6 finish
 *     pay +9 trophies / 44 coins / 74 XP.
 *
 * ## 🚨 THE RULE THIS FILE IS BUILT AROUND
 *
 * `docs/AGENT-BRIEF.md` §4.4 — *"a guard that has not been shown to FAIL on the bug it guards
 * against is not a guard"* — and the session that produced **seven** controls which could not
 * distinguish their own two arms. So **every section below names the arm that turns it red**,
 * and `--selftest` runs them and fails if an expected-red row comes back green.
 *
 * ⚠️ **AND ONE SECTION IS DECLARED TAUTOLOGICAL, BECAUSE IT IS.** A two-seat card cannot
 * distinguish "slot order" from "finishing order": remove the winner from a two-element
 * permutation and exactly one fighter is left, in every order. **That is not a weakness of
 * the test — it is the reason the two-seat card is safe** — but it means §A cannot be
 * satisfied by comparing the two branches to each other. §A therefore compares the rendered
 * card against a **frozen oracle recorded from a pre-change commit**, which CAN move, and
 * `--arm payout2` proves it moves.
 *
 * ## Sections
 *
 *   §A  24 two-seat end states, rendered through the real `hud.ts`, byte-identical to an
 *       oracle recorded at the pre-change commit. RED under `--arm payout2`.
 *   §B  six seats: the loser list is in FINISHING order, including the dead/alive split.
 *       RED under `--arm noorder`.
 *   §C  a malformed order falls back WHOLESALE and drops nobody — plus the counterfactual
 *       count for the `.filter(Boolean)` form, which drops three fighters silently.
 *   §D  the payout chips render exactly what they are handed, signed, and nothing at all
 *       when handed nothing. RED under `--arm nopay`.
 *   §E  a real six-fighter match through the shipped screens: the BANKED delta equals the
 *       number on the card, and the banked total is FROZEN while the card renders.
 *       RED under `--arm poison`.
 *   §F  static: `game/match.ts` and `ui/hud.ts` import nothing from the economy or the
 *       profile, and the tree has exactly one payout call site, inside the `banked` guard.
 *       RED under `--arm fakeimport`.
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/rc_card.mjs --url '{URL}' --emit tools/tmp/rc_oracle.json --only A
 *   node tools/tmp/sx_snap.mjs --root . -- \
 *     node tools/tmp/rc_card.mjs --url '{URL}' --oracle tools/tmp/rc_oracle.json
 *   node tools/tmp/rc_card.mjs --url <base> --selftest
 *
 * ⚠️ `--url` is required and must be a SNAPSHOT, never `:5173` (CLAUDE.md #2).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
// 🚨 IS_MAIN GUARD. `docs/AGENT-BRIEF.md` §3: three tools here made a function importable and
// silently made the whole CLI path run on import — one of them printed a live sweep report,
// another launched Chromium. Exports stay; the main path is guarded.
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
const ONLY = flag('only', null);            // e.g. "A" or "ABC" — restrict to those sections
const EMIT = flag('emit', null);
const ORACLE = flag('oracle', `${ROOT}/tools/tmp/rc_oracle.json`);
const SHOT = flag('shot', null);
const MATCH_WALL_MS = Number(flag('wall', '240000'));

/** The six-seat roster. Distinct characters so a name IS a slot identity. */
const IDS6 = ['sushi', 'hamburger', 'donut', 'taco', 'pizza', 'egg'];
const IDS2 = ['sushi', 'hamburger'];
/** Deliberately NOT slot order once the winner is removed: [5,0,4,1,2] vs [0,1,2,4,5]. */
const ORDER6 = [3, 5, 0, 4, 1, 2];

// ─────────────────────────────────────────────────────────────────────────────
// Page-side harness. Stringified because it runs in the browser, where the real
// `src/ui/hud.ts` lives — `docs/AGENT-BRIEF.md`: no Node instrument can import
// `src/ui/**`, because extension-less imports resolve only under Vite/tsc.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SETUP = async () => {
  const H = await import('/src/ui/hud.ts');
  const sim = await import('/src/game/sim.ts');
  const arena = window.__matchArena;
  if (!arena) throw new Error('rc_card: window.__matchArena is absent — the page has no live match');
  window.__rc = { H, sim, arena, insts: {} };
  return true;
};

/**
 * Render one card through the REAL hud module and hand back its markup.
 *
 * A detached HUD, not the live one: the live HUD is driven by `match.ts` every frame and
 * would overwrite anything written into it before it could be read.
 */
const PAGE_RENDER = (spec) => {
  const { H, sim, arena, insts } = window.__rc;
  const key = spec.ids.join(',');
  let inst = insts[key];
  if (!inst) {
    const root = document.createElement('div');
    // Off-screen: this must never land in a screenshot of the live card.
    root.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:720px;';
    document.body.appendChild(root);
    const hud = H.createHud(root, { onRestart() {}, onSelectWeapon() {} });
    hud.setCharacters(spec.ids);
    inst = insts[key] = { root, hud };
  }
  const state = sim.createMatch(arena, spec.ids.map((c) => ({ characterId: c })));
  state.phase = 'ended';
  state.timeRemaining = 12_000;
  const roster = state.fighters;
  roster.forEach((f, i) => {
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
  const card = inst.root.querySelector('.hud-gameover-card');
  const sub = card.querySelector('.hud-gameover-subtitle');
  const pay = card.querySelector('.hud-gameover-payout');
  // 🚨 WHAT THE PLAYER ACTUALLY SEES, not what the markup says. `innerHTML` carries this
  // file's own HTML comments and every `display: none` element, so a card that gained an
  // empty hidden div would read as "changed" while rendering identically — and a card that
  // lost a VISIBLE row would read as changed by the same amount. This digest walks only the
  // subtree that renders, so the two are not the same number.
  const visible = [];
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).filter(Boolean).join(' ');
    visible.push(`${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? '-'}${own ? `|${own}` : ''}`);
    for (const c of el.children) walk(c);
  };
  walk(card);
  // Names are the bare TEXT NODES of the subtitle: `named()` emits
  // `<span class="hud-go-emoji">…</span>NAME` and `group()` emits a `.hud-go-vs` verb span,
  // so filtering to text nodes yields [winner, ...losers] in DOM order and nothing else.
  const names = [...sub.childNodes]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent.trim())
    .filter(Boolean);
  return {
    html: card.innerHTML,
    visible: visible.join('\n'),
    names,
    verbs: [...sub.querySelectorAll('.hud-go-vs')].map((e) => e.textContent.trim()),
    payChips: pay ? [...pay.querySelectorAll('.hud-go-pay b')].map((e) => e.textContent) : null,
    payLabels: pay ? [...pay.querySelectorAll('.hud-go-pay i')].map((e) => e.textContent) : null,
    // ⚠️ THE ICONS ARE MEASURED, NOT ASSUMED. `icon()` emits `width="1em" height="1em"` as
    // ATTRIBUTES; anything that sets only one axis in CSS, or lets flex shrink the box,
    // produces a squashed glyph that still passes every text assertion on this card. Read
    // at 4x in shots/rc/pay_crop.png before this row existed: the trophy was a sliver.
    payIcons: pay ? [...pay.querySelectorAll('.hud-go-pay .fa-ic')].map((e) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
    }) : null,
    payDisplay: pay ? pay.style.display : 'absent',
    payHtmlLen: pay ? pay.innerHTML.length : -1,
  };
};

/** Everything §E reads out of the page, in one call. */
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
    title: card?.querySelector('.hud-gameover-title')?.textContent ?? null,
    place: card?.querySelector('.hud-gameover-place')?.textContent ?? null,
    names: card
      ? [...card.querySelector('.hud-gameover-subtitle').childNodes]
        .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean)
      : null,
    chips: pay ? [...pay.querySelectorAll('.hud-go-pay b')].map((e) => e.textContent) : null,
    frames: window.__matchDebug?.frames ?? null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────────────

const rows = [];
const check = (section, name, pass, evidence) => {
  rows.push({ section, name, pass: !!pass, evidence });
  const tag = pass ? 'ok  ' : 'FAIL';
  console.log(`  ${tag} §${section} ${name}${evidence ? ` — ${evidence}` : ''}`);
  return !!pass;
};
const wanted = (section) => !ONLY || ONLY.includes(section);

/** The 24 two-seat end states §A is exhaustive over. */
function twoSeatMatrix() {
  const out = [];
  for (const winnerSlot of [0, 1]) {
    for (const alive of [[true, true], [true, false], [false, true], [false, false]]) {
      for (const order of [null, [0, 1], [1, 0]]) {
        out.push({
          id: `w${winnerSlot}-a${alive.map((a) => (a ? 1 : 0)).join('')}-o${order ? order.join('') : 'null'}`,
          ids: IDS2,
          winnerSlot,
          alive,
          order,
          place: { place: winnerSlot === 0 ? 1 : 2, of: 2 },
        });
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  if (!BASE) {
    console.error('rc_card: --url (or PREVIEW_BASE) is required, and it must be a snapshot.');
    process.exit(2);
  }
  const browser = await chromium.launch();
  try {
    await runSections(browser);
  } finally {
    await browser.close();
  }
  const failed = rows.filter((r) => !r.pass);
  console.log(`\nrc_card: ${rows.length - failed.length}/${rows.length} checks passed (arm=${ARM})`);
  return failed.length;
}

async function newPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // A peer's save must not be able to reload the page mid-run. The snapshot already
  // freezes the tree; this closes the HMR socket as well.
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

async function runSections(browser) {
  // ── The harness page: a live six-fighter match, only so `window.__matchArena` and the
  // real modules exist. Nothing in §A–§D reads the live HUD.
  const emit = {};
  if (wanted('A') || wanted('B') || wanted('C') || wanted('D')) {
    const { page } = await newPage(
      browser,
      `${BASE}/?fighters=${IDS6.join(';')}&pointerLock=0&simSpeed=1`,
    );
    await page.evaluate(PAGE_SETUP);

    // ── §A ────────────────────────────────────────────────────────────────────
    if (wanted('A')) {
      const cases = twoSeatMatrix();
      const got = {};
      for (const c of cases) {
        const spec = { ...c };
        // KNOWN-BAD: a payout on a two-seat card. The card MUST move, or §A is an oracle
        // comparison that cannot see a change to the thing it is guarding.
        if (ARM === 'payout2') spec.payout = { trophies: 11, coins: 52, xp: 87 };
        const r = await page.evaluate(PAGE_RENDER, spec);
        got[c.id] = { html: r.html, visible: r.visible };
      }
      emit.twoSeat = got;
      if (EMIT) {
        console.log(`  §A recording oracle: ${cases.length} two-seat cards`);
      } else {
        let ref = null;
        try { ref = JSON.parse(readFileSync(ORACLE, 'utf8')).twoSeat; } catch { /* below */ }
        if (!ref) {
          check('A', 'oracle present', false, `no twoSeat oracle at ${ORACLE} — record it with --emit`);
        } else {
          const keys = Object.keys(got);
          // 🚨 NON-EMPTY BEFORE ASSERTING OVER IT. Three controls went vacuous in one
          // session because a filtered set was empty and `[].every()` returned true.
          check('A', 'matrix non-empty', keys.length === 24, `${keys.length} states`);
          // ── ROW 1: what RENDERS is byte-identical. ──────────────────────────
          const vDiff = keys.filter((k) => got[k].visible !== ref[k].visible);
          check('A', 'two-seat card byte-identical to the pre-change oracle',
            keys.length === 24 && vDiff.length === 0,
            vDiff.length
              ? `${vDiff.length}/${keys.length} moved, first: ${vDiff[0]}`
              : `${keys.length}/${keys.length} identical`);
          // ── ROW 2: and the MARKUP moved by exactly one additive, hidden element. ──
          // Stated as a subtraction rather than waved away: strip HTML comments and the
          // one new element, and the remaining markup must be the oracle's, character for
          // character. Anything else that had moved — a class, an attribute, the subtitle's
          // own shape — survives the strip and turns this red.
          const norm = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').trim();
          const strip = (s) => norm(s).replace(/<div class="hud-gameover-payout"[^>]*>(?:(?!<\/div>).)*<\/div>/, '');
          const hDiff = keys.filter((k) => strip(got[k].html) !== norm(ref[k].html));
          check('A', 'the only markup delta is the additive hidden payout element',
            hDiff.length === 0,
            hDiff.length ? `${hDiff.length} cards differ beyond it, first: ${hDiff[0]}` : `${keys.length} cards`);
          // ── ROW 3: an order-fed card and an order-free card agree at two seats. ──
          // ⚠️ DECLARED TAUTOLOGICAL in the header and kept anyway: it is the sentence the
          // fix claims, and a permutation guard that wrongly REJECTED a valid order — or
          // wrongly accepted a malformed one — would break it.
          const pairs = keys.filter((k) => k.endsWith('-onull'));
          check('A', 'order-fed === order-free at two seats',
            pairs.length === 8 && pairs.every((k) => got[k].html === got[k.replace('-onull', '-o01')].html
              && got[k].html === got[k.replace('-onull', '-o10')].html),
            `${pairs.length} pairs x2 orders`);
        }
      }
    }

    // ── §B ────────────────────────────────────────────────────────────────────
    if (wanted('B')) {
      const order = ARM === 'noorder' ? null : ORDER6;
      const winnerSlot = ORDER6[0];
      const nameOf = (slot) => IDS6[slot].toUpperCase();
      // (a) every loser dead — one "defeated" group, so DOM order IS finishing order.
      const allDead = await page.evaluate(PAGE_RENDER, {
        ids: IDS6, winnerSlot, order,
        alive: IDS6.map((_, i) => i === winnerSlot),
        place: { place: 1, of: 6 },
      });
      const expectDead = [winnerSlot, ...ORDER6.filter((s) => s !== winnerSlot)].map(nameOf);
      check('B', 'six-seat loser list is in FINISHING order',
        allDead.names.length === 6 && allDead.names.every((n, i) => n.toUpperCase() === expectDead[i]),
        `${allDead.names.join(' ')} | want ${expectDead.join(' ')}`);
      // The control that makes the row above mean something: slot order is a DIFFERENT
      // answer here, so a card that ignored `order` cannot accidentally pass.
      const slotOrder = [winnerSlot, ...IDS6.map((_, i) => i).filter((s) => s !== winnerSlot)].map(nameOf);
      check('B', 'and slot order is a different list (so the row can fail)',
        slotOrder.join(' ') !== expectDead.join(' '),
        `slot ${slotOrder.join(' ')}`);
      // (b) mixed dead/alive — the card splits into two groups and each must still be in
      // finishing order. This is where a naive `sort` would show up.
      const aliveSlots = new Set([1, 2]);
      const mixed = await page.evaluate(PAGE_RENDER, {
        ids: IDS6, winnerSlot, order,
        alive: IDS6.map((_, i) => i === winnerSlot || aliveSlots.has(i)),
        place: { place: 1, of: 6 },
      });
      const losers = ORDER6.filter((s) => s !== winnerSlot);
      const expectMixed = [winnerSlot,
        ...losers.filter((s) => !aliveSlots.has(s)),
        ...losers.filter((s) => aliveSlots.has(s))].map(nameOf);
      check('B', 'dead/alive split keeps finishing order inside each group',
        mixed.names.length === 6 && mixed.names.every((n, i) => n.toUpperCase() === expectMixed[i]),
        `${mixed.names.join(' ')} | want ${expectMixed.join(' ')}`);
      check('B', 'both verbs present on a mixed card',
        mixed.verbs.join(',') === 'defeated,outlasted', mixed.verbs.join(','));
    }

    // ── §C ────────────────────────────────────────────────────────────────────
    if (wanted('C')) {
      const winnerSlot = 3;
      const malformed = {
        short: [0, 1, 2],
        duplicate: [0, 0, 1, 2, 3, 4],
        outOfRange: [0, 1, 2, 3, 4, 9],
        fractional: [0, 1, 2, 3, 4, 5.5],
      };
      const slotOrderNames = [winnerSlot, ...IDS6.map((_, i) => i).filter((s) => s !== winnerSlot)]
        .map((s) => IDS6[s].toUpperCase());
      for (const [label, order] of Object.entries(malformed)) {
        const r = await page.evaluate(PAGE_RENDER, {
          ids: IDS6, winnerSlot, order,
          alive: IDS6.map((_, i) => i === winnerSlot),
          place: { place: 1, of: 6 },
        });
        check('C', `malformed order (${label}) falls back WHOLESALE, drops nobody`,
          r.names.length === 6 && r.names.every((n, i) => n.toUpperCase() === slotOrderNames[i]),
          `${r.names.length} names: ${r.names.join(' ')}`);
      }
      // The counterfactual, computed rather than claimed: the `.filter(Boolean)` form that
      // was proposed for this line indexes into the roster with whatever it is handed, so a
      // three-entry order silently prints a THREE-fighter card for a six-fighter match.
      // ⚠️ THE EXPECTED COUNT IS DERIVED, NOT PINNED. It was written as a literal `2` first
      // and the row went red: `[0,1,2]` does not contain the winner's slot 3, so nothing is
      // filtered out and it lists 3. The defect is "fewer than five", not "exactly two".
      const naive = malformed.short.filter((s) => s !== winnerSlot).map((s) => IDS6[s]).filter(Boolean);
      check('C', 'counterfactual: `.filter(Boolean)` would have dropped fighters',
        naive.length < IDS6.length - 1,
        `it lists ${naive.length} of ${IDS6.length - 1} losers on the short order`);
    }

    // ── §D ────────────────────────────────────────────────────────────────────
    if (wanted('D')) {
      const spec = {
        ids: IDS6, winnerSlot: 0, order: ORDER6,
        alive: IDS6.map((_, i) => i === 0),
        place: { place: 3, of: 6 },
      };
      // KNOWN-BAD: hand it nothing where chips are expected.
      const payout = ARM === 'nopay' ? null : { trophies: -5, coins: 20, xp: 35 };
      const paid = await page.evaluate(PAGE_RENDER, { ...spec, payout });
      check('D', 'payout chips render exactly what they are handed, signed',
        paid.payChips?.join('|') === '-5|+20|+35', `chips ${paid.payChips?.join('|')}`);
      check('D', 'XP carries a label and the currencies do not',
        paid.payLabels?.join('|') === 'xp', `labels ${paid.payLabels?.join('|')}`);
      check('D', 'the payout row is shown when there is a payout',
        paid.payDisplay === 'flex', `display:${paid.payDisplay}`);
      const boxes = paid.payIcons ?? [];
      check('D', 'every payout icon is square and drawn at the same size',
        boxes.length === 3
          && boxes.every((b) => b.w >= 16 && Math.abs(b.w - b.h) < 0.5 && Math.abs(b.w - boxes[0].w) < 0.5),
        boxes.map((b) => `${b.w}x${b.h}`).join(' '));
      const chest = await page.evaluate(PAGE_RENDER, {
        ...spec, payout: { trophies: 15, coins: 60, xp: 100, chests: 1 },
      });
      check('D', 'a chest credit adds a fourth chip and nothing else does',
        chest.payChips?.join('|') === '+15|+60|+100|+1', `chips ${chest.payChips?.join('|')}`);
      const none = await page.evaluate(PAGE_RENDER, { ...spec, payout: null });
      check('D', 'no payout draws nothing at all',
        none.payChips?.length === 0 && none.payDisplay === 'none' && none.payHtmlLen === 0,
        `display:${none.payDisplay} html:${none.payHtmlLen}`);
    }
    await page.close();
  }

  // ── §E ──────────────────────────────────────────────────────────────────────
  if (wanted('E')) await sectionE(browser);

  // ── §F ──────────────────────────────────────────────────────────────────────
  if (wanted('F')) sectionF();

  if (EMIT) {
    mkdirSync(dirname(resolve(EMIT)), { recursive: true });
    writeFileSync(resolve(EMIT), `${JSON.stringify({ recordedAt: new Date().toISOString(), ...emit }, null, 2)}\n`);
    console.log(`  wrote ${EMIT}`);
  }
}

/**
 * §E — A REAL SIX-FIGHTER MATCH THROUGH THE SHIPPED SCREENS.
 *
 * 🚨 THE POINT IS THE SIDE EFFECT, NOT THE PICTURE. `profile.recordPlacement` MUTATES the
 * economy and commits it, so "render the payout" and "bank the payout again" differ by one
 * import. Two independent statements are measured:
 *
 *   E1  the banked delta over the whole match EQUALS the number on the card — not twice it;
 *   E2  the banked total does not move WHILE the card is rendering, over ≥2 s and ≥60 frames.
 *       A render-side bank would not double the total, it would multiply it by the frame
 *       count, so this is the sensitive half.
 */
async function sectionE(browser) {
  const url = `${BASE}/?fighters=${IDS6.join(';')}&pointerLock=0&simSpeed=8`;
  const { page, errors } = await newPage(browser, url);
  // ⚠️ SEED A REAL, APP-PRODUCED PROFILE FIRST, AND THIS WAS A MEASURED FAULT IN THIS TOOL.
  // `profile.ts` only writes to `localStorage` when something CHANGES, so on a fresh browser
  // the store is absent until the first bank — and the first version of this section read
  // `before` off a missing blob, got `null`, and reported the coin delta as **528 against a
  // card saying 28**. That is not a double-bank, it is a fresh economy's 500 starting coins
  // measured against zero: a manufactured regression, exactly `AGENT-BRIEF` §4.7's
  // *"a baseline is itself a measurement"*. The blob is built by the economy's OWN
  // `serialize(createEconomy())` rather than hand-written, so it cannot drift from the shape
  // `load()` accepts.
  await page.evaluate(async () => {
    const eco = await import('/src/game/economy/state.ts');
    localStorage.setItem('food-arena.profile.v1', JSON.stringify({
      name: 'QA', wins: 0, losses: 0, xp: 0, selected: 'sushi',
      economy: eco.serialize(eco.createEconomy()),
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
  const before = await page.evaluate(PAGE_BANKED);
  // 🚨 THE PRECONDITION, ASSERTED BEFORE ANYTHING IS SUBTRACTED FROM IT.
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
    await page.waitForTimeout(250);
  }
  if (!check('E', 'the match reached a result card', ended, `${((Date.now() - t0) / 1000).toFixed(1)}s`)) {
    await page.close();
    return;
  }
  // One read as soon as the card is up...
  await page.waitForTimeout(400);
  const at = await page.evaluate(PAGE_BANKED);
  const dTrophies = at.trophies - before.trophies;
  const dCoins = at.coins - before.coins;
  const dXp = at.xp - before.xp;
  const chips = (at.chips ?? []).map((c) => Number(c.replace('+', '')));
  check('E', 'the card is showing a payout at all',
    chips.length >= 3, `chips ${JSON.stringify(at.chips)}`);
  check('E', 'banked trophy delta === the trophy chip (not twice it)',
    chips[0] === dTrophies, `card ${chips[0]} vs banked ${dTrophies}`);
  check('E', 'banked coin delta === the coin chip',
    chips[1] === dCoins, `card ${chips[1]} vs banked ${dCoins}`);
  check('E', 'banked XP delta === the XP chip',
    chips[2] === dXp, `card ${chips[2]} vs banked ${dXp}`);
  // ⚠️ THE ONE-BASED/ZERO-BASED JOIN, ASSERTED AS ARITHMETIC RATHER THAN AS A SUBSTRING.
  // `MatchOutcome.localPlace` is 0-based because `recordPlacement` takes it that way; the
  // card is 1-based because that is what a human reads, and `match.ts:hudPlace` says the
  // single `+ 1` is "the shape that pays 6th place a 5th-place cheque". So this compares the
  // NUMBER on the card with the number that was banked, not merely the seat count.
  const cardPlace = Number((at.place ?? '').match(/^(\d+)/)?.[1] ?? NaN);
  check('E', 'the place on the card is the place that was banked, +1',
    at.lastMatch !== null && cardPlace === at.lastMatch.place + 1
      && at.place?.toLowerCase().includes(`of ${at.lastMatch.seats}`),
    `card "${at.place}" vs banked place ${at.lastMatch?.place} of ${at.lastMatch?.seats}`);

  // ...and one after the card has rendered for a while. KNOWN-BAD: `--arm poison` writes
  // the store between the two samples, which is what a render-side bank would look like.
  if (ARM === 'poison') {
    await page.evaluate(() => {
      const blob = JSON.parse(localStorage.getItem('food-arena.profile.v1'));
      blob.economy.trophies += 999;
      localStorage.setItem('food-arena.profile.v1', JSON.stringify(blob));
    });
  }
  // ⚠️ WAIT ON FRAMES, NOT ON A CLOCK, AND THAT WAS A MEASURED FAULT TOO. A fixed 2.2 s
  // dwell got **7 frames**: SwiftShader with six rigs on screen renders the card at ~3 fps,
  // so a wall-clock dwell silently decides how much evidence this row has. `AGENT-BRIEF`:
  // *"judge progress by a tool's own per-row output"*, and 0 fps here is a property of the
  // rasteriser, not of the loop. Poll until the loop has drawn the card DWELL_FRAMES times.
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
    frames >= DWELL_FRAMES,
    `${frames} frames over ${((Date.now() - dwellStart) / 1000).toFixed(1)}s`
      + ` — a render-side bank would have moved the total ${frames}x`);
  check('E', 'the banked total is FROZEN while the card renders',
    after.trophies === at.trophies && after.coins === at.coins && after.xp === at.xp,
    `trophies ${at.trophies}->${after.trophies}, coins ${at.coins}->${after.coins}, xp ${at.xp}->${after.xp}`);
  check('E', 'no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  if (SHOT) {
    mkdirSync(dirname(resolve(SHOT)), { recursive: true });
    await page.screenshot({ path: resolve(SHOT) });
    console.log(`  wrote ${SHOT}`);
  }
  await page.close();
}

/**
 * §F — THE STRUCTURAL HALF OF "IT CANNOT DOUBLE-BANK".
 *
 * §E proves this build does not. This proves the NEXT one cannot start to by accident: the
 * carrier files import nothing that can move money, and the tree has exactly one payout call
 * site, inside `matchScreen.ts`'s `banked` guard.
 */
function sectionF() {
  /**
   * 🚨 CODE ONLY. THIS FILE'S FIRST VERSION MATCHED PROSE AND SAID `match.ts` MAKES **4
   * PAYOUT CALLS** — every one of them the words `profile.recordPlacement(place, seats)`
   * inside a comment explaining why it must never do that. A checker that cannot tell a
   * doc-comment from a statement is a checker that will one day certify the reverse, so
   * comments come out before any of the regexes below run.
   */
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const src = (p) => strip(readFileSync(`${ROOT}/${p}`, 'utf8'));
  const MONEY = /from\s+['"][^'"]*(economy\/state|economy\/trophyRoad|screens\/profile)['"]/;
  const APPLY = /\b(recordPlacement|recordResult|applyMatchPlacement|applyMatchResult)\s*\(/g;
  // The strip must not be able to hide the thing it is stripping for: prove on a known-bad
  // that a real statement survives it and a comment does not.
  check('F', 'the comment strip keeps code and drops prose',
    /recordPlacement\s*\(/.test(strip('x.recordPlacement(1, 2);'))
      && !/recordPlacement\s*\(/.test(strip('// x.recordPlacement(1, 2);'))
      && !/recordPlacement\s*\(/.test(strip('/* x.recordPlacement(1, 2); */')),
    'code kept, line- and block-comments dropped');
  for (const f of ['src/game/match.ts', 'src/ui/hud.ts']) {
    const body = ARM === 'fakeimport'
      ? `import { applyMatchPlacement } from '../game/economy/state';\n${src(f)}`
      : src(f);
    check('F', `${f} imports nothing that can move money`, !MONEY.test(body),
      MONEY.exec(body)?.[0] ?? 'clean');
    check('F', `${f} calls no payout function`, (body.match(APPLY) ?? []).length === 0,
      `${(body.match(APPLY) ?? []).length} calls`);
  }
  // The one call site, and it is inside the guard. `banked` is set true on the line above
  // the calls, so "between `if (!banked)` and the closing of that block" is the test.
  const ms = src('src/ui/screens/matchScreen.ts');
  const calls = [...ms.matchAll(/\b(recordPlacement|recordResult)\s*\(/g)];
  check('F', 'the tree banks from exactly one place, in two arms of one branch',
    calls.length === 2, `${calls.length} call sites in matchScreen.ts`);
  const guardAt = ms.indexOf('if (!banked)');
  const bankedTrue = ms.indexOf('banked = true');
  check('F', 'both arms sit behind the `banked` guard',
    guardAt > 0 && bankedTrue > guardAt && calls.every((c) => c.index > bankedTrue),
    `guard@${guardAt} set@${bankedTrue} calls@${calls.map((c) => c.index).join(',')}`);
  // And the whole rest of the tree does not bank at all — a census, because a second call
  // site is exactly how "banked exactly once" stops being true without anything going red.
  const others = ['src/ui/screens/home.ts', 'src/ui/screens/trophyRoad.ts', 'src/ui/screens/shop.ts',
    'src/ui/screens/characterSelect.ts', 'src/ui/screens/shell.ts', 'src/main.ts']
    .filter((f) => /\b(recordPlacement|recordResult)\s*\(/.test(src(f)));
  check('F', 'no other screen banks a match result', others.length === 0, others.join(' ') || 'none');
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest: run every known-bad arm and require the row it targets to be RED.
// ─────────────────────────────────────────────────────────────────────────────

const SELFTEST = [
  { arm: 'payout2', only: 'A', mustFail: 'two-seat card byte-identical' },
  { arm: 'noorder', only: 'B', mustFail: 'six-seat loser list is in FINISHING order' },
  { arm: 'nopay', only: 'D', mustFail: 'payout chips render exactly what they are handed' },
  { arm: 'fakeimport', only: 'F', mustFail: 'imports nothing that can move money' },
  { arm: 'poison', only: 'E', mustFail: 'banked total is FROZEN' },
];

async function selftest() {
  const self = resolve(new URL(import.meta.url).pathname);
  const { spawnSync } = await import('node:child_process');
  let bad = 0;
  for (const t of SELFTEST) {
    const args = [self, '--url', BASE, '--arm', t.arm, '--only', t.only];
    if (ORACLE) args.push('--oracle', ORACLE);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
    const out = r.stdout ?? '';
    const line = out.split('\n').find((l) => l.includes(t.mustFail));
    const red = !!line && line.trim().startsWith('FAIL');
    console.log(`  ${red ? 'ok  ' : 'FAIL'} known-bad --arm ${t.arm}: "${t.mustFail}" is ${red ? 'RED' : 'GREEN'}`);
    if (!red) bad++;
  }
  console.log(`\nrc_card --selftest: ${SELFTEST.length - bad}/${SELFTEST.length} known-bads turned their row red`);
  return bad;
}

if (IS_MAIN) {
  const code = has('selftest') ? await selftest() : await run();
  process.exit(code === 0 ? 0 : 1);
}

export { PAGE_RENDER, PAGE_SETUP, twoSeatMatrix };
