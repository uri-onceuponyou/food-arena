#!/usr/bin/env node
/**
 * Identify-at-real-size — the acceptance instrument for `src/ui/icons/`.
 *
 * `docs/LESSONS.md` §3 names this test as the canonical good acceptance test for icons,
 * and §3 also lists icons as one of four elements where two critics REVERSED each other.
 * So: no critic loop. One instrument, run identically before and after.
 *
 * What it does: renders the icon set into its REAL shipped box at its REAL shipped px
 * size, in a deterministically shuffled order, with no labels — then writes the plate
 * plus a private answer key. A blind judge (a fresh subagent that has never seen the set
 * with names attached) names each tile; scoring happens here, never in the judge.
 *
 * ── Two things the previous round got wrong, both worth stating ──────────────
 * 1. It measured at 26px only. `hud.ts:1989` drops `.hud-weapon-emoji` to **20px** on
 *    `max-width: 720px` — i.e. on every phone, which is the platform the touch pillar
 *    was just built for. 20px is the smallest shipped size and is the headline number.
 * 2. Its plate was 1000x1218 = 1.22M px, above the ~1.15M a vision judge accepts before
 *    it downsamples — so the judge saw the icons ~3% SMALLER than shipped, and every
 *    plate had a different scale factor depending on how tall it happened to be. Plates
 *    here are ~500x300, far under any resize threshold, so "real pixel size" is literally
 *    true.
 *
 *   node tools/tmp/icon_legibility.mjs --url <snapshot> --out shots/icons/accept2/before
 *   node tools/tmp/icon_legibility.mjs --url <snapshot> --out ... --box slot26 --seed 7
 *   node tools/tmp/icon_legibility.mjs --score shots/icons/accept2/before/slot20.key.json \
 *        --answers <file with "1. name" per line>
 *
 * ── THREE ARMS, and which one to believe ────────────────────────────────────
 * All three were run identically on the before and after art. They disagree, and the
 * disagreement is the most useful thing here:
 *
 *   A. FREE-FORM — "name what you see", no options. Reproduces the historical figure
 *      exactly (before 14/14/11/9 = **12.0**, against the 12–13 recorded in commit
 *      6b4ff44), which is what validates the whole instrument. But it measures whether a
 *      glyph is DESCRIBABLE, not whether it is distinguishable, and at 20px almost
 *      nothing is describable — the ceiling is ~15/28 for art nobody has complained about.
 *   B. ONE-TO-ONE — 28 shuffled subjects, each used exactly once. This looks like the
 *      strictest arm and is actually the noisiest: the bijection turns one unreadable
 *      icon into a DISPLACEMENT CHAIN, so a single bad glyph costs two or three points
 *      and lands them on innocent neighbours. sd 3.8 across three judges on identical art.
 *   C. OPEN — same 28 subjects, but repeats allowed and each tile judged independently.
 *      Same information, no chain. sd **0.58** on the before art. **This is the arm to
 *      believe**, and it is the one that names defects reproducibly: before, three of its
 *      four zero-scoring icons were wrong the same way in all three judges
 *      (swirl->cap x3, rice->noodle x3, cap->cyclone x3).
 *
 * ── RESULT, at 20px, the smallest shipped size ──────────────────────────────
 *                       before            after           swaps
 *   OPEN (primary)      21.7 (21/22/22)   24.0 (28/23/21) 4 -> 0
 *   ONE-TO-ONE          21.7 (20/19/26)   24.3 (24/23/26) reproducible -> single-judge
 *   FREE-FORM           12.0              11.0            n/a
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}

/** Accepted synonyms, fixed BEFORE any judge ran, so scoring cannot drift. In the
 *  forced-choice arm the judge picks from the exact candidate strings, so this stays
 *  empty; it exists for the free-form arm. */
const ALIASES = {
  patty: ['burger patty', 'beef patty', 'grilled patty'],
  meat: ['meat on the bone', 'drumstick', 'ham', 'meat'],
  candy: ['wrapped candy', 'sweet', 'toffee'],
  swirl: ['cyclone', 'spiral', 'whirlwind', 'vortex'],
  burst: ['impact burst', 'starburst', 'explosion'],
  hammer: ['mallet', 'sledgehammer'],
  dough: ['dough balls', 'dough'],
  cheese: ['cheese wedge', 'cheese'],
  rice: ['rice bowl', 'bowl of rice'],
  seaweed: ['seaweed', 'kelp'],
  puffer: ['fish on a hook', 'hooked fish', 'pufferfish'],
  droplets: ['water droplets', 'droplets', 'water drops'],
  noodle: ['noodle bowl', 'bowl of noodles', 'ramen'],
  shards: ['glass shards', 'shards', 'ice shards'],
  cap: ['bottle cap', 'cap'],
  mustardblast: ['mustard bottle', 'mustard'],
  ketchupslip: ['ketchup bottle', 'ketchup'],
  slash: ['sword slash', 'blade slash', 'slash'],
  wrap: ['burrito', 'wrap', 'burrito wrap'],
  honey: ['honey pot', 'honey jar', 'honey'],
  chick: ['chick', 'baby chicken'],
};

// ── Scoring mode: never runs a browser, never sees a judge's reasoning. ───────
if (a.score) {
  const key = JSON.parse(readFileSync(a.score, 'utf8'));
  const raw = readFileSync(a.answers, 'utf8');
  const given = new Map();
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
    if (m) given.set(Number(m[1]), m[2].toLowerCase().trim());
  }
  const rows = [];
  let hit = 0;
  for (const { i, name } of key.tiles) {
    const ans = given.get(i) ?? '(none)';
    const ok = ans === name.toLowerCase() || (ALIASES[name] ?? []).includes(ans);
    if (ok) hit++;
    rows.push({ i, truth: name, answer: ans, ok });
  }
  console.log(JSON.stringify({ n: key.tiles.length, correct: hit, rows }, null, 2));
  process.exit(0);
}

const url = a.url ?? 'http://localhost:5173';
const out = a.out ?? 'shots/icons/accept2/run';
const box = a.box ?? 'slot20';
const set = a.set ?? 'food';
const seed = a.seed ?? '1';
const cols = a.cols ?? '7';
const dsf = Number(a.dsf ?? 1);
const only = a.only ?? '';

mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: dsf });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));

const qs = new URLSearchParams({ box, set, seed, cols });
if (only) qs.set('only', only);
if (a.idx === '0') qs.set('idx', '0');
const target = `${url}/tools/tmp/icon_legibility.html?${qs}`;
await page.goto(target, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
await page.waitForTimeout(300);

const tiles = await page.evaluate(() => window.__key);
const tag = a.tag ?? `${box}${dsf > 1 ? `@${dsf}x` : ''}-s${seed}`;
const png = join(out, `${tag}.png`);
await page.locator('#grid').screenshot({ path: png });
writeFileSync(join(out, `${tag}.key.json`), JSON.stringify({ url: target, box, set, seed, dsf, tiles }, null, 2));

const size = await page.locator('#grid').boundingBox();
console.log(`wrote ${png}  ${Math.round(size.width * dsf)}x${Math.round(size.height * dsf)}px  ${tiles.length} tiles`);
if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.join('\n'));
await browser.close();
