#!/usr/bin/env node
/**
 * Acceptance battery for the SHOP screen (`src/ui/screens/shop.ts`).
 *
 * Defined before the screen was built, in the shape `docs/LESSONS.md` §3 demands: an
 * element with no measurable test oscillates at its own noise floor.
 *
 * Four groups, and the first is the one that matters most:
 *
 *  1. NO SECOND SOURCE OF TRUTH. Every number on the screen is re-derived HERE, in
 *     Node, straight off `CONTAINERS[kind].entries` — the raw weight table — and NOT
 *     through `containerOdds()`. So this does not check that one function agrees with
 *     itself; it checks that the pixels a player reads agree with the array the roller
 *     rolls against. A hand-typed percentage, a stale price or a rounded 0.01% row all
 *     fail here.
 *
 *  2. THE GATED STATE IS HONEST. While `ownedSet()` is the whole roster, every box is
 *     a strict loss (best outcome below price, in all four), so nothing may be
 *     purchasable: every Buy control must carry the DOM `disabled` attribute — not a
 *     class, not a pointer-events trick — and the screen must say so in words.
 *
 *  3. THE FLIP IS ONE LINE, PROVEN. The snapshot is a disposable copy of the tree, so
 *     this rewrites `ROSTER_GATED = true` INSIDE THE SNAPSHOT, reloads, and asserts the
 *     same screen now offers every box for sale with no other edit anywhere. The shared
 *     working tree is never touched. Requires SNAPSHOT_DIR, which
 *     `tools/tmp/with_snapshot.mjs` exports.
 *
 *  4. LAYOUT, at menu_accept's five landscape viewports plus notch, plus the portrait
 *     phone that all five of them miss. Measured on ELEMENT RECTS, never on
 *     `document.scrollWidth`: `.fa-root` is `overflow: hidden`, so a row laid out 70px
 *     too wide reports a perfectly clean scrollWidth while the player's gem count is
 *     amputated at the right edge. That is how three portrait bugs reached HEAD.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/shop_accept.mjs --url {URL} --dir {DIR}
 */

import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { settleScreen, captureSettled } from './settle.mjs';
import {
  CONTAINERS,
  CONTAINER_KINDS,
  DUPLICATE_COINS,
  CHARACTERS_BY_RARITY,
  RARITY_MEANING,
  LEVEL_UP,
} from '../../src/game/economy/index.ts';
import { CHARACTERS, CHARACTER_IDS } from '../../src/game/rules.ts';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** menu_accept's five, verbatim, plus the portrait phone none of them covers. */
const VIEWPORTS = [
  { name: 'desktop-16:9', w: 1600, h: 900 },
  { name: 'laptop-16:10', w: 1280, h: 800 },
  { name: 'tablet-4:3', w: 1024, h: 768 },
  { name: 'phone-19.5:9', w: 844, h: 390 },
  { name: 'ultrawide-21:9', w: 2560, h: 1080 },
  { name: 'phone-portrait', w: 430, h: 932 },
];

/** Landscape iPhone notch, same figures menu_accept uses. */
const SAFE = { t: 0, r: 44, b: 21, l: 44 };
const MIN_TAP = 44;

/** A mid-progression player who holds containers, so the inventory block renders. */
const SEED = {
  name: 'Chef', wins: 40, losses: 22, xp: 4180, selected: 'hamburger',
  economy: {
    trophies: 3170, bestTrophies: 3170, coins: 4210, gems: 96,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], winsTowardChest: 1,
    lastMatch: null, seed: 12345, rolls: 7,
  },
};

/** Same player, able to afford everything — used for the gate-flip proof, where the
 *  question is "is it offered", not "can they pay". */
const SEED_RICH = {
  ...SEED,
  economy: { ...SEED.economy, coins: 40000, gems: 2000 },
};

const results = [];
let failures = 0;
function record(group, check, ok, detail = '') {
  results.push({ group, check, ok, detail });
  if (!ok) failures++;
}

// ─────────────────────────────────────────────────────────────────────────────
// The independent derivation. Nothing below imports containers.ts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The published table for one container, computed from the weights by hand.
 *
 * This is deliberately a SECOND implementation of `containerOdds()` — merge by label,
 * normalise against the real weight total, sort descending — written from the data
 * rather than from that function. If the two ever disagree, one of them is wrong and
 * this says which rows.
 */
function expectedRows(kind) {
  const entries = CONTAINERS[kind].entries;
  const total = entries.reduce((s, e) => s + e.weight, 0);
  const merged = new Map();
  for (const e of entries) {
    const label = e.characterRarity
      ? `${e.characterRarity} fighter`
      : [
        e.coins ? `${e.coins.toLocaleString()} coins` : null,
        e.gems ? `${e.gems.toLocaleString()} gems` : null,
      ].filter(Boolean).join(' + ') || 'Nothing';
    merged.set(label, (merged.get(label) ?? 0) + (e.weight / total) * 100);
  }
  return [...merged.entries()]
    .map(([label, percent]) => ({ label, percent }))
    .sort((a, b) => b.percent - a.percent);
}

/** `formatPercent`'s contract, re-implemented: full precision, trailing zeros only
 *  removed. 0.01 must never publish as "0.0%" — that is a false statement about the
 *  odds of a paid randomised item, not a rounding choice. */
function expectedPercentText(percent) {
  return `${percent.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

function expectedValue(kind, owned) {
  const entries = CONTAINERS[kind].entries;
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let best = 0; let ev = 0; let canGrantFighter = false;
  for (const e of entries) {
    let coins = e.coins ?? 0;
    if (e.characterRarity) {
      const pool = CHARACTERS_BY_RARITY[e.characterRarity] ?? [];
      if (pool.some((id) => !owned.has(id))) canGrantFighter = true;
      else coins += DUPLICATE_COINS[e.characterRarity];
    }
    best = Math.max(best, coins);
    ev += (e.weight / total) * coins;
  }
  return { best, ev, canGrantFighter };
}

const PRICED = CONTAINER_KINDS.filter((k) => CONTAINERS[k].price !== null);
const FREE = CONTAINER_KINDS.filter((k) => CONTAINERS[k].price === null);

// ─────────────────────────────────────────────────────────────────────────────
// Browser side
// ─────────────────────────────────────────────────────────────────────────────

/** Everything the assertions need, read out of one mounted shop screen. */
function readShop() {
  const root = document.querySelector('.fa-shop');
  if (!root) return null;
  const txt = (n) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();

  const cards = [...root.querySelectorAll('.shop-card')].map((card) => ({
    name: txt(card.querySelector('.shop-card-name')),
    guarantee: txt(card.querySelector('.shop-guarantee')),
    blurb: txt(card.querySelector('.shop-blurb')),
    rows: [...card.querySelectorAll('.shop-odds-row')].map((r) => ({
      label: txt(r.querySelector('.shop-odds-what')),
      pct: txt(r.querySelector('.shop-odds-pct')),
      swatch: r.querySelector('.shop-odds-dot') ? getComputedStyle(r.querySelector('.shop-odds-dot')).backgroundColor : null,
    })),
    pools: [...card.querySelectorAll('.shop-pool-line')].map((p) => txt(p)),
    buys: [...card.querySelectorAll('[data-buy]')].map((b) => ({
      kind: b.dataset.buy,
      currency: b.dataset.currency,
      text: txt(b),
      disabled: b.disabled === true,
      // A control that LOOKS unavailable but is still clickable is the exact defect
      // being guarded against, so the DOM attribute is what is read, not the class.
      hasAttr: b.hasAttribute('disabled'),
      w: Math.round(b.getBoundingClientRect().width),
      h: Math.round(b.getBoundingClientRect().height),
    })),
    why: txt(card.querySelector('.shop-why')),
  }));

  return {
    cards,
    notice: txt(root.querySelector('.shop-notice')),
    rarityLine: txt(root.querySelector('.shop-rarity')),
    footnote: txt(root.querySelector('[data-el="footnote"]')),
    held: [...root.querySelectorAll('.shop-held')].map((h) => txt(h)),
    coins: txt(root.querySelector('[data-el="coins"]')),
    gems: txt(root.querySelector('[data-el="gems"]')),
    fullText: txt(root),
  };
}

/** menu_accept's layout checks, plus the element-rect overflow test its five landscape
 *  viewports cannot perform. */
function readLayout({ MIN_TAP, safe }) {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = de.clientHeight;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const controls = [...document.querySelectorAll(
    '.fa-root button:not([disabled]), .fa-root .fa-menuitem:not([disabled])',
  )].filter(visible);
  const scrollers = [...document.querySelectorAll('.fa-root .fa-scroll')].filter(visible);

  const small = controls
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width < MIN_TAP - 0.5 || r.height < MIN_TAP - 0.5)
    .map(({ el, r }) => `${el.className.split(' ')[0]}[${el.textContent.trim().slice(0, 14)}] ${Math.round(r.width)}x${Math.round(r.height)}`);

  const outside = controls
    .filter((el) => !el.closest('.fa-scroll'))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.left < safe.l - 1 || r.top < safe.t - 1
      || r.right > vw - safe.r + 1 || r.bottom > vh - safe.b + 1)
    .map(({ el, r }) => `${el.className.split(' ')[0]}[${el.textContent.trim().slice(0, 14)}] L${Math.round(r.left)} R${Math.round(vw - r.right)}`)
    .concat(scrollers
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.left < safe.l - 1 || r.top < safe.t - 1
        || r.right > vw - safe.r + 1 || r.bottom > vh - safe.b + 1)
      .map(({ el, r }) => `scroller L${Math.round(r.left)} R${Math.round(vw - r.right)}`));

  // THE PORTRAIT TEST. Not scrollWidth: `.fa-root` clips, so a 70px-too-wide row
  // reports zero document overflow while being drawn off the edge of the screen.
  const CARES = '.fa-chip, .fa-iconbtn, .fa-btn, .fa-tab, .fa-panel, .fa-title, .shop-card, .shop-notice, .shop-bottom, .shop-buy, .shop-held, .shop-section-title';
  const clipped = [];
  for (const n of document.querySelectorAll(`.fa-root ${CARES}`)) {
    const r = n.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    let inX = false;
    for (let p = n.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') inX = true;
    }
    if (inX) continue;
    const lost = Math.max(r.right - vw, -r.left);
    if (lost > 1) {
      clipped.push(`${n.className.split(' ')[0]}[${n.textContent.trim().slice(0, 12)}] -${Math.round(lost)}px`);
    }
  }

  return {
    scrollW: de.scrollWidth, clientW: vw, scrollH: de.scrollHeight, clientH: vh,
    controlCount: controls.length, small, outside, clipped,
    contexts: (() => {
      let n = 0;
      for (const c of document.querySelectorAll('canvas')) {
        // Counting DOM canvases is the cheap half; perf.mjs --mode leak owns the real
        // context census. A menu screen with any canvas at all is worth reporting.
        n++;
      }
      return n;
    })(),
  };
}

/**
 * `__screenReady` is not the condition, and this battery is one of the ones it can
 * actually flip a verdict on: `tap-targets>=44` and `inside-safe-area` below are read
 * from `getBoundingClientRect()`, which INCLUDES transforms, and `fa-screen-in` starts
 * at `translateY(10px) scale(0.992)`. Measured in `cab4662`: 43.648px against a 44.000px
 * minimum (0.352px of error on a 0.5px margin) and up to +11.84px of screen top against
 * a +/-1px safe-area tolerance, which flipped 1 of 9 cells in `menu_accept` to a FALSE
 * FAILURE. The 500 ms sleep was never the condition; `settleScreen` is, and the sleep
 * stays as a floor for the shop's own timed content.
 */
async function open(page, base, profile) {
  await page.goto(`${base}/?screen=shop`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__screen === "shop" && window.__screenReady === true',
    null, { timeout: 60000 });
  await settleScreen(page, { label: 'shop' });
  await page.waitForTimeout(500);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}

async function run() {
  const args = parseArgs(process.argv);
  const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
  const snapDir = args.dir ?? process.env.SNAPSHOT_DIR ?? null;
  const shots = args.shots ?? 'shots/shop';

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const owned = new Set(CHARACTER_IDS); // what ownedSet() returns while ROSTER_GATED is false

  // ── 1 + 2: content, at desktop ───────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.addInitScript((p) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private mode */ }
    }, SEED);
    await open(page, base, SEED);

    const dom = await page.evaluate(readShop);
    if (!dom) {
      record('content', 'screen-mounts', false, 'no .fa-shop in the DOM');
    } else {
      record('content', 'screen-mounts', true, `${dom.cards.length} container cards`);
      record('content', 'every-container-has-a-card',
        dom.cards.length === CONTAINER_KINDS.length,
        `${dom.cards.length} of ${CONTAINER_KINDS.length}`);

      // ── THE DISCLOSURE SENTENCE, AT THE PIXEL ────────────────────────────
      //
      // ⚠️ THIS BATTERY PASSED 168/168 WITH A FALSE SENTENCE ON THE SCREEN. `RARITY_MEANING`
      // told players rarity sets "how much it costs to level up" for a full commit after
      // §26 flattened `LEVEL_UP.rarityCostMultiplier` to 1.0 — i.e. after that stopped
      // being true. Group 1's whole premise is "every number on the screen is re-derived
      // here", and this paragraph was the one piece of the disclosure that was PROSE, so
      // nothing re-derived it. A claim is as checkable as a percentage when the thing it
      // claims is a constant in the model.
      record('odds', 'the-rarity-sentence-is-the-models',
        dom.rarityLine === RARITY_MEANING,
        `shown ${JSON.stringify(dom.rarityLine)}`);
      {
        // And the claim it makes must match what the model actually charges. Flat
        // multiplier -> the sentence must DENY a levelling-cost effect; a ladder -> it must
        // state one. Same derivation as `economy.test.mjs` §13(b2), applied to the DOM.
        const varies = new Set(Object.values(LEVEL_UP.rarityCostMultiplier)).size > 1;
        const claims = /\band how much it costs to level/i.test(dom.rarityLine);
        const denies = /\bnot what it costs to level/i.test(dom.rarityLine);
        record('odds', 'the-rarity-sentence-agrees-with-the-cost-table',
          claims !== denies && (varies ? claims : denies),
          `multiplier ${varies ? 'VARIES' : 'is FLAT'}; sentence ${claims ? 'claims' : denies ? 'denies' : 'says neither'}`);
      }

      for (const kind of CONTAINER_KINDS) {
        const def = CONTAINERS[kind];
        const card = dom.cards.find((c) => c.name === def.name);
        if (!card) { record('content', `${kind}:card`, false, 'not rendered'); continue; }

        // ODDS — every row, in order, against the hand-derived table.
        const want = expectedRows(kind);
        const gotLabels = card.rows.map((r) => r.label);
        const wantLabels = want.map((r) => r.label);
        record('odds', `${kind}:rows-match-the-weight-table`,
          JSON.stringify(gotLabels) === JSON.stringify(wantLabels),
          `shown ${JSON.stringify(gotLabels)} vs derived ${JSON.stringify(wantLabels)}`);

        const gotPct = card.rows.map((r) => r.pct);
        const wantPct = want.map((r) => expectedPercentText(r.percent));
        record('odds', `${kind}:percentages-match-the-weight-table`,
          JSON.stringify(gotPct) === JSON.stringify(wantPct),
          `shown ${gotPct.join('/')} vs derived ${wantPct.join('/')}`);

        record('odds', `${kind}:no-real-chance-rounded-to-zero`,
          gotPct.every((p) => p !== '0%' && p !== '0.0%'), gotPct.join('/'));

        // The rarity channel must be a swatch, never the ink: every rarity colour in
        // RARITY_COLORS fails AA as type on white (Cyber 1.64, Legendary 2.08).
        const rarityRows = card.rows.filter((r) => /fighter$/.test(r.label));
        record('odds', `${kind}:rarity-is-a-swatch-not-ink`,
          rarityRows.length > 0 ? rarityRows.every((r) => r.swatch) : true,
          `${rarityRows.filter((r) => r.swatch).length}/${rarityRows.length} rows carry a swatch`);

        // POOLS — the characters each rarity row can produce, by name.
        const wantPools = want.filter((r) => /fighter$/.test(r.label)).map((r) => {
          const rarity = r.label.replace(' fighter', '');
          return (CHARACTERS_BY_RARITY[rarity] ?? []).map((id) => CHARACTERS[id].name).join(', ');
        }).filter(Boolean);
        record('odds', `${kind}:pools-are-named`,
          wantPools.every((p) => card.pools.some((shown) => shown === p)),
          `shown ${JSON.stringify(card.pools)}`);

        // BLURB comes from the model, unedited.
        record('content', `${kind}:blurb-is-the-model's`, card.blurb === def.blurb, card.blurb);

        if (def.price) {
          const want2 = [
            { currency: 'coins', cost: def.price.coins },
            { currency: 'gems', cost: def.price.gems },
          ];
          record('price', `${kind}:both-currencies-offered`,
            card.buys.length === 2, `${card.buys.length} buy controls`);
          for (const w of want2) {
            const b = card.buys.find((x) => x.currency === w.currency);
            record('price', `${kind}:${w.currency}-price-matches-the-model`,
              !!b && b.text.replace(/[^\d,]/g, '') === w.cost.toLocaleString(),
              `shown "${b?.text}" vs model ${w.cost.toLocaleString()}`);
          }

          // HONESTY — the gated state.
          const v = expectedValue(kind, owned);
          record('honesty', `${kind}:is-a-guaranteed-loss-right-now`,
            !v.canGrantFighter && v.best < def.price.coins,
            `best ${v.best} vs price ${def.price.coins}, fighter possible = ${v.canGrantFighter}`);
          record('honesty', `${kind}:NO-buy-control-is-live`,
            card.buys.every((b) => b.disabled && b.hasAttr),
            `${card.buys.filter((b) => !b.disabled).length} enabled`);
          record('honesty', `${kind}:price-is-still-shown-while-off`,
            card.buys.every((b) => /\d/.test(b.text)), card.buys.map((b) => b.text).join(' / '));
          // The refusal has to be arithmetic the player can check, not a shrug.
          record('honesty', `${kind}:refusal-quotes-the-best-case`,
            card.why.includes(v.best.toLocaleString()),
            `"${card.why}" (expected best ${v.best.toLocaleString()})`);
          record('honesty', `${kind}:refusal-quotes-the-average`,
            card.why.includes(Math.round(v.ev).toLocaleString()),
            `expected average ${Math.round(v.ev).toLocaleString()}`);
          record('honesty', `${kind}:does-not-claim-a-fighter`,
            !/Always a fighter/i.test(card.guarantee), `guarantee = "${card.guarantee}"`);
        } else {
          record('price', `${kind}:free-container-has-no-price`,
            card.buys.length === 0, `${card.buys.length} buy controls on a price:null container`);
          record('price', `${kind}:free-container-says-it-is-earned`,
            /earn/i.test(card.guarantee + ' ' + card.why), card.guarantee);
        }
      }

      // Screen-level honesty.
      // A NEGATION next to the words "for sale", not merely the phrase: "everything
      // here is for sale" must not be able to pass a check about unavailability.
      record('honesty', 'unavailability-is-stated-in-words',
        /\b(not|nothing|no)\b[^.]{0,40}\bfor sale\b/i.test(dom.notice), dom.notice.slice(0, 110));
      record('honesty', 'notice-explains-WHY',
        /already own/i.test(dom.notice) && /less than it costs/i.test(dom.notice),
        dom.notice.slice(0, 160));
      record('honesty', 'roster-size-is-counted-not-typed',
        dom.notice.includes(String(CHARACTER_IDS.length)), `roster = ${CHARACTER_IDS.length}`);
      const allBuys = dom.cards.flatMap((c) => c.buys);
      record('honesty', 'ZERO-live-purchase-controls-anywhere',
        allBuys.length > 0 && allBuys.every((b) => b.disabled),
        `${allBuys.filter((b) => !b.disabled).length} of ${allBuys.length} enabled`);

      // Balances come from the profile, not from a placeholder.
      record('content', 'balances-are-the-profile\'s',
        dom.coins === SEED.economy.coins.toLocaleString()
        && dom.gems === SEED.economy.gems.toLocaleString(),
        `${dom.coins} coins / ${dom.gems} gems`);

      // Held inventory.
      const heldKinds = CONTAINER_KINDS.filter((k) => (SEED.economy.containers[k] ?? 0) > 0);
      record('content', 'held-boxes-are-listed',
        heldKinds.every((k) => dom.held.some((h) => h.includes(CONTAINERS[k].name))),
        dom.held.join(' | '));

      // No raw glyphs. `emojiIcon()` falls through to the model's emoji when unmapped,
      // and CONTAINERS[*].emoji is exactly the class of token that has no mapping.
      const emoji = await page.evaluate(() => {
        const PICTO = /\p{Extended_Pictographic}/u;
        const out = [];
        const walk = document.createTreeWalker(document.querySelector('.fa-shop'), NodeFilter.SHOW_ELEMENT);
        for (let n = walk.currentNode; n; n = walk.nextNode()) {
          for (const c of n.childNodes) {
            if (c.nodeType !== 3) continue;
            for (const m of (c.textContent.match(/[^\x00-\x7F]/gu) ?? [])) {
              if (PICTO.test(m)) out.push(`${m}@${(n.className || n.tagName).toString().split(' ')[0]}`);
            }
          }
          for (const pseudo of ['::before', '::after']) {
            const cs = getComputedStyle(n, pseudo);
            if (!cs || cs.content === 'none' || cs.content === 'normal') continue;
            for (const m of (cs.content.replace(/"/g, '').match(/[^\x00-\x7F]/gu) ?? [])) {
              if (PICTO.test(m)) out.push(`${m}@${(n.className || n.tagName).toString().split(' ')[0]}${pseudo}`);
            }
          }
        }
        return out;
      });
      record('content', 'zero-raw-emoji', emoji.length === 0, emoji.slice(0, 5).join(', '));
    }

    record('content', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await page.close();
  }

  // ── 4: layout, six viewports x (bare, notch) ─────────────────────────────
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.addInitScript((p) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private mode */ }
    }, SEED);
    await open(page, base, SEED);

    for (const pass of ['bare', 'notch']) {
      const safe = pass === 'notch' ? SAFE : { t: 0, r: 0, b: 0, l: 0 };
      await page.evaluate((s) => {
        const st = document.documentElement.style;
        for (const k of ['t', 'r', 'b', 'l']) {
          if (s === null) st.removeProperty(`--fa-safe-${k}`);
          else st.setProperty(`--fa-safe-${k}`, `${s[k]}px`);
        }
      }, pass === 'notch' ? SAFE : null);
      await page.waitForTimeout(160);

      const lay = await page.evaluate(readLayout, { MIN_TAP, safe });

      const tag = `${vp.name}${pass === 'notch' ? '+notch' : ''}`;
      record('layout', `${tag}:no-page-scroll`,
        lay.scrollW <= lay.clientW + 1 && lay.scrollH <= lay.clientH + 1,
        `${lay.scrollW}x${lay.scrollH} vs ${lay.clientW}x${lay.clientH}`);
      record('layout', `${tag}:tap-targets>=44`, lay.small.length === 0, lay.small.slice(0, 3).join(' | '));
      record('layout', `${tag}:inside-safe-area`, lay.outside.length === 0, lay.outside.slice(0, 3).join(' | '));
      record('layout', `${tag}:nothing-drawn-off-frame`, lay.clipped.length === 0, lay.clipped.slice(0, 4).join(' | '));
      record('layout', `${tag}:controls-present`, lay.controlCount >= 3, `${lay.controlCount} enabled controls`);
      record('layout', `${tag}:no-webgl-canvas-on-a-dom-screen`, lay.contexts === 0, `${lay.contexts} canvases`);
    }

    // A diagnostic PNG, not a verdict — so `enforce: false`: this battery's 168
    // assertions must not turn on whether a screenshot succeeded. The guard still runs
    // and still writes the `.capture.json` sidecar, so anything downstream can see how
    // the frame was taken instead of guessing.
    await captureSettled(page, {
      path: `${shots}/shop-${vp.name}.png`, label: `shop@${vp.name}`, tool: 'shop_accept',
      wait: false, enforce: false,
    }).catch(() => {});
    record('layout', `${vp.name}:no-console-errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();
  }

  // ── 3: the gate flip, inside the snapshot only ───────────────────────────
  if (snapDir) {
    const tuning = `${snapDir}/src/game/economy/tuning.ts`;
    const before = await readFile(tuning, 'utf8');
    const after = before.replace('export const ROSTER_GATED = false;', 'export const ROSTER_GATED = true;');
    record('flip', 'the-flag-is-one-line', after !== before, 'ROSTER_GATED false -> true in the snapshot copy');
    if (after !== before) {
      await writeFile(tuning, after);
      // Vite watches the snapshot directory, so give it a moment to invalidate the
      // module graph before asking for the page again.
      await new Promise((r) => setTimeout(r, 1500));

      const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      await page.addInitScript((p) => {
        try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private mode */ }
      }, SEED_RICH);
      await open(page, base, SEED_RICH);

      const dom = await page.evaluate(readShop);
      if (!dom) record('flip', 'screen-still-mounts', false, 'no .fa-shop after the flip');
      else {
        record('flip', 'screen-still-mounts', true, `${dom.cards.length} cards`);
        const buys = dom.cards.flatMap((c) => c.buys);
        record('flip', 'every-box-is-now-for-sale',
          buys.length > 0 && buys.every((b) => !b.disabled),
          `${buys.filter((b) => !b.disabled).length}/${buys.length} enabled`);
        record('flip', 'the-not-for-sale-banner-is-gone', dom.notice === '', dom.notice.slice(0, 80));
        record('flip', 'guarantees-appear-now',
          dom.cards.filter((c) => /Always a fighter/i.test(c.guarantee)).length === PRICED.length,
          dom.cards.map((c) => c.guarantee).filter(Boolean).join(' | '));
        // The reason block is the one thing that has to be REWRITTEN for the ungated
        // state, so it is checked rather than assumed. Its first draft read "Average
        // return: 0 coins", which is what a stub looks like when it is arithmetically
        // correct: with nothing owned, no outcome converts to coins.
        record('flip', 'the-reason-block-is-rewritten-for-a-live-shop',
          dom.cards.filter((c) => c.buys.length > 0)
            .every((c) => !/not for sale/i.test(c.why) && !/\b0 coins\b/.test(c.why)),
          dom.cards.filter((c) => c.buys.length > 0).map((c) => c.why).slice(0, 1).join(''));
        record('flip', 'the-reason-block-counts-the-pool',
          dom.cards.filter((c) => c.buys.length > 0)
            .every((c) => /\d+ of the \d+/.test(c.why) && /still missing/i.test(c.why)),
          dom.cards.find((c) => c.buys.length > 0)?.why ?? '');
        // A duplicate is only possible once an entire rarity tier in the box is owned,
        // because `rollContainer()` prefers an unowned member. So a card must never
        // offer a trade-in beside an expected return of zero.
        record('flip', 'no-card-promises-a-payout-the-roller-cannot-make',
          dom.cards.every((c) => !/trades in for coins/i.test(c.why) || !/\b0 on average\b/.test(c.why)),
          dom.cards.map((c) => c.why).filter((w) => /trades in/i.test(w)).join(' | ').slice(0, 120));
        record('flip', 'prices-did-not-move',
          PRICED.every((k) => {
            const card = dom.cards.find((c) => c.name === CONTAINERS[k].name);
            return card && card.buys.some((b) => b.text.replace(/[^\d,]/g, '') === CONTAINERS[k].price.coins.toLocaleString());
          }), 'coin prices unchanged after the flip');

        // And buying actually works, end to end, through the real model.
        const kind = PRICED[0];
        const beforeBuy = await page.evaluate(() => ({
          coins: Number((document.querySelector('[data-el="coins"]').textContent ?? '0').replace(/,/g, '')),
          held: (document.querySelector('.shop-heldrow')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        }));
        await page.click(`[data-buy="${kind}"][data-currency="coins"]`);
        await page.waitForTimeout(220);
        const afterBuy = await page.evaluate(() => ({
          coins: Number((document.querySelector('[data-el="coins"]').textContent ?? '0').replace(/,/g, '')),
          held: (document.querySelector('.shop-heldrow')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        }));
        record('flip', 'buying-spends-exactly-the-price',
          beforeBuy.coins - afterBuy.coins === CONTAINERS[kind].price.coins,
          `${beforeBuy.coins} -> ${afterBuy.coins}, price ${CONTAINERS[kind].price.coins}`);
        record('flip', 'buying-adds-the-box-to-the-inventory',
          afterBuy.held !== beforeBuy.held, afterBuy.held.slice(0, 90));
      }
      record('flip', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await captureSettled(page, {
        path: `${shots}/shop-ungated-desktop.png`, label: 'shop-ungated', tool: 'shop_accept',
        wait: false, enforce: false,
      }).catch(() => {});
      await page.close();

      // Put the snapshot back the way it was, so anything chained after this measures
      // the shipped state.
      await writeFile(tuning, before);
      await new Promise((r) => setTimeout(r, 600));
    }
  } else {
    record('flip', 'gate-flip-proof', false, 'no --dir / SNAPSHOT_DIR: run under with_snapshot.mjs');
  }

  await browser.close();

  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.group, 9)} ${pad(r.check, 46)} ${r.detail}`);
  }
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
