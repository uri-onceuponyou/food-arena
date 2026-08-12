#!/usr/bin/env node
/**
 * wj_render — dump every RENDERED string that comes from an ability blurb, on every
 * screen that shows one, for all 11 characters. The A/B oracle for the weapon/ability
 * join change.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-wj-<sha> -- \
 *     node tools/tmp/wj_render.mjs --url '{URL}' --out tools/tmp/wj_before.json
 *
 *   node tools/tmp/wj_render.mjs --compare a.json b.json     # offline, no browser
 *
 * ── WHAT THIS COMPARISON CAN EXPRESS, AND WHAT IT CANNOT ────────────────────
 * This is the question `rc_card` got wrong (a two-seat card cannot distinguish slot
 * order from finishing order, so its comparison could not express the defect it was
 * meant to catch). So, stated up front:
 *
 *   CAN express  a changed ability NAME, DESC or GLYPH on either screen; a changed
 *                ORDER of the ability list on either screen; a changed set of WEAPON
 *                FACTS beside any ability on character select — which is the only
 *                place the join is visible at all; an ability row appearing or
 *                disappearing; the passive note on character select.
 *   CANNOT       anything about the HUD (no ability strings there — grepped), colour,
 *                layout, or the match screen. Those are out of scope by construction.
 *
 * THE KNOWN-BAD IT MUST MOVE ON: joining `abilities[i]` to `weapons[i]`. On the shipped
 * roster that is wrong for exactly ONE character — hamburger, 3 of its 4 rows — and the
 * three mis-joined weapons carry different damage/reach/effect chips from the right
 * ones, so the fact strings move. `wj_guard.mjs --selftest` proves that with the join
 * swapped in Node; this file proves it on real pixels' worth of DOM. **A run of this
 * file that reports IDENTICAL without the known-bad ever having been shown to move is
 * worth nothing** — `CLAUDE.md` rule 6.
 *
 * Read-only against the app. Writes only the JSON it is told to.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { settleScreen } from './settle.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

/** Roster order is `CHARACTER_IDS`; read it from the source of truth, not retyped. */
const { CHARACTER_IDS, CHARACTERS } = await import('../../src/game/rules.ts');

const SEED = {
  name: 'QA', wins: 9, losses: 3, xp: 400, selected: 'hamburger',
  economy: {
    trophies: 200, bestTrophies: 240, coins: 1000, gems: 40,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger', 'pineapple', 'donut'], winsTowardChest: 1,
    lastMatch: null, seed: 987654, rolls: 0,
  },
};

// ── the offline half: compare two dumps ──────────────────────────────────────

export function compare(a, b) {
  const faults = [];
  const ids = [...new Set([...Object.keys(a.byCharacter), ...Object.keys(b.byCharacter)])];
  // 🔴 NON-VACUITY FIRST. `[].every()` is `true`, and this repo has had that exact
  // trap fire three times in three files in one session. Assert the corpus is
  // non-empty and the RIGHT SIZE before comparing anything inside it.
  if (ids.length === 0) faults.push('VACUOUS: no characters in either dump');
  if (ids.length !== a.expect.characters || ids.length !== b.expect.characters) {
    faults.push(`SIZE: ${ids.length} characters, expected ${a.expect.characters}/${b.expect.characters}`);
  }
  if (a.expect.abilityRows !== b.expect.abilityRows) {
    faults.push(`SIZE: ability rows ${a.expect.abilityRows} vs ${b.expect.abilityRows}`);
  }
  // Reported FIELD BY FIELD rather than as two JSON blobs. The blob form was
  // unreadable — one hamburger diff ran to 8 KB of inlined SVG — and an unreadable
  // fault is one nobody checks the shape of.
  let rows = 0;
  const FIELDS = ['emojiHTML', 'name', 'desc', 'facts', 'hasFacts', 'passive'];
  for (const id of ids) {
    const A = a.byCharacter[id], B = b.byCharacter[id];
    if (!A || !B) { faults.push(`${id}: present in only one dump`); continue; }
    rows += (A.chars?.length ?? 0) + (A.home?.tiles?.length ?? 0);
    const brief = (v) => {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return s && s.length > 90 ? s.slice(0, 87) + '…' : s;
    };
    const na = A.chars?.length ?? 0, nb = B.chars?.length ?? 0;
    if (na !== nb) faults.push(`${id}: character-select row count ${na} vs ${nb}`);
    for (let i = 0; i < Math.min(na, nb); i++) {
      for (const f of FIELDS) {
        const x = JSON.stringify(A.chars[i][f]), y = JSON.stringify(B.chars[i][f]);
        if (x !== y) faults.push(`${id} chars[${i}] '${A.chars[i].name}' .${f}\n      A ${brief(x)}\n      B ${brief(y)}`);
      }
    }
    const ha = A.home?.tiles ?? [], hb2 = B.home?.tiles ?? [];
    if (ha.length !== hb2.length) faults.push(`${id}: home tile count ${ha.length} vs ${hb2.length}`);
    for (let i = 0; i < Math.min(ha.length, hb2.length); i++) {
      for (const f of ['emHTML', 'name']) {
        if (JSON.stringify(ha[i][f]) !== JSON.stringify(hb2[i][f])) {
          faults.push(`${id} home tile[${i}] .${f}\n      A ${brief(ha[i][f])}\n      B ${brief(hb2[i][f])}`);
        }
      }
    }
    const ca = A.home?.caps ?? [], cb = B.home?.caps ?? [];
    if (ca.length !== cb.length) faults.push(`${id}: home caption count ${ca.length} vs ${cb.length}`);
    for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
      if (ca[i] !== cb[i]) faults.push(`${id} home caption[${i}]\n      A ${brief(ca[i])}\n      B ${brief(cb[i])}`);
    }
  }
  if (rows === 0) faults.push('VACUOUS: zero rows compared');
  return { faults, ids: ids.length, rows };
}

// ── the browser half ─────────────────────────────────────────────────────────

/**
 * IN-PAGE. Reads the character-select detail panel. Captures the emoji span's
 * innerHTML rather than its text, because `abilityIcon()` may render an SVG — a
 * glyph swap is invisible to `textContent`.
 */
function readCharsFn() {
  const pills = [...document.querySelectorAll('.chars-abilities .chars-ability')];
  return pills.map((p) => ({
    passive: p.classList.contains('chars-ability--passive'),
    emojiHTML: p.querySelector('.chars-ability-em')?.innerHTML ?? null,
    name: p.querySelector('.chars-ability-name')?.textContent ?? null,
    desc: p.querySelector('.chars-ability-desc')?.textContent ?? null,
    // The join, made visible: these chips are derived from the WEAPON the pill is
    // paired with. This is the field a positional join moves.
    facts: [...p.querySelectorAll('.chars-ability-facts .chars-fact')].map((f) => f.textContent),
    hasFacts: !!p.querySelector('.chars-ability-facts'),
  }));
}

/** IN-PAGE. Reads the home kit grid and the caption for the tile at `i`. */
function readHomeTilesFn() {
  return [...document.querySelectorAll('.home-kit-tile')].map((t) => ({
    emHTML: t.querySelector('.home-kit-em')?.innerHTML ?? null,
    name: t.querySelector('.home-kit-name')?.textContent ?? null,
    on: t.classList.contains('is-on'),
  }));
}

async function run() {
  const base = arg('--url', process.env.PREVIEW_BASE);
  if (!base) { console.error('wj_render: --url or PREVIEW_BASE required'); process.exit(2); }
  const out = arg('--out', 'tools/tmp/wj_dump.json');

  const browser = await chromium.launch();
  const byCharacter = {};
  let abilityRows = 0;
  try {
    // ── character select: one page, click through all 11 cards ───────────────
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.addInitScript((seed) => {
      localStorage.setItem('food-arena.profile.v1', JSON.stringify(seed));
    }, SEED);
    await page.goto(`${base}/?screen=characters`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__screen === "characters"', null, { timeout: 60000 });
    await settleScreen(page, { label: 'characters' });

    for (const id of CHARACTER_IDS) {
      await page.click(`[data-char="${id}"]`);
      // The panel is rewritten synchronously in `view()`; wait for the hero name to
      // agree so we can never read the PREVIOUS character's pills. ⚠️ This is a REAL
      // wait, not a `.catch(() => {})` — a swallowed timeout here would let the dump
      // record the same character twice and still read "IDENTICAL" across the A/B.
      await page.waitForFunction(
        (want) => document.querySelector('[data-el="heroname"]')?.textContent === want,
        CHARACTERS[id].name,
        { timeout: 15000 },
      );
      const rows = await page.evaluate(readCharsFn);
      byCharacter[id] = { chars: rows };
      abilityRows += rows.length;
    }
    await page.close();

    // ── home: the kit grid, one reload per character (it renders `profile.selected`)
    for (const id of CHARACTER_IDS) {
      const p = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await p.addInitScript((s) => {
        localStorage.setItem('food-arena.profile.v1', JSON.stringify(s));
      }, { ...SEED, selected: id });
      await p.goto(`${base}/?screen=home`, { waitUntil: 'networkidle', timeout: 60000 });
      await p.waitForFunction('window.__screen === "home"', null, { timeout: 60000 });
      await settleScreen(p, { label: `home/${id}` });
      const tiles = await p.evaluate(readHomeTilesFn);
      const caps = [];
      for (let i = 0; i < tiles.length; i++) {
        await p.click(`[data-kit="${i}"]`);
        caps.push(await p.evaluate(() => document.querySelector('[data-el="kitcap"]')?.innerHTML ?? null));
      }
      byCharacter[id].home = { tiles, caps };
      abilityRows += tiles.length;
      await p.close();
    }
  } finally {
    await browser.close();
  }

  // 🚨 IS THE DUMP POINTED AT THE RIGHT THING? `--selftest` validates a tool's LOGIC,
  // never where it is POINTED (CLAUDE.md rule 6). A click that silently fails would
  // leave the PREVIOUS character's panel on screen; both arms would scrape the same
  // wrong panel and the comparison would read IDENTICAL. So every character's scraped
  // rows are checked to be ITS OWN, against the roster — a stale panel fails here.
  const misaimed = [];
  for (const id of CHARACTER_IDS) {
    const want = CHARACTERS[id].abilities.map((a) => a.name);
    const gotChars = (byCharacter[id].chars ?? []).filter((r) => !r.passive).map((r) => r.name);
    const gotHome = (byCharacter[id].home?.tiles ?? []).map((t) => t.name);
    if (JSON.stringify(gotChars) !== JSON.stringify(want)) misaimed.push(`${id} chars ${JSON.stringify(gotChars)} != ${JSON.stringify(want)}`);
    if (JSON.stringify(gotHome) !== JSON.stringify(want)) misaimed.push(`${id} home ${JSON.stringify(gotHome)} != ${JSON.stringify(want)}`);
  }
  if (misaimed.length) {
    for (const m of misaimed) console.error('  MISAIMED ' + m);
    console.error('wj_render: the dump does not describe the characters it claims to. Refusing to write.');
    process.exit(3);
  }

  const dump = {
    expect: { characters: CHARACTER_IDS.length, abilityRows },
    byCharacter,
  };
  writeFileSync(out, JSON.stringify(dump, null, 2));
  console.log(`wj_render: wrote ${out} — ${CHARACTER_IDS.length} characters, ${abilityRows} rendered ability rows`);
}

const IS_MAIN = import.meta.url === `file://${process.argv[1]}`;
if (IS_MAIN) {
  const ci = argv.indexOf('--compare');
  if (ci >= 0) {
    const a = JSON.parse(readFileSync(argv[ci + 1], 'utf8'));
    const b = JSON.parse(readFileSync(argv[ci + 2], 'utf8'));
    const r = compare(a, b);
    console.log(`wj_render --compare: ${r.ids} characters, ${r.rows} rows`);
    for (const f of r.faults) console.log('  FAULT ' + f);
    console.log(r.faults.length === 0 ? 'IDENTICAL' : `${r.faults.length} FAULT(S)`);
    process.exit(r.faults.length === 0 ? 0 : 1);
  } else {
    await run();
  }
}
