#!/usr/bin/env node
/**
 * BASELINE PACKETS — build every sheet of the baseline re-score in one deterministic
 * pass, one distinct reference plate per critic.
 *
 * ── The design, and why it is not the design this project has used before ────
 * Every previous round was ONE critic shown N sheets that all carried the SAME image of
 * ours. The audit measured what that buys: the two panels of a round are n = 1, not
 * n = 2, because one critic scores both and gave both the same number in 4 of 4 cases.
 * So N sheets to one critic is still one observation, and the resolution floor stays at
 * ~1.4 points — larger than every difference this project has ever acted on.
 *
 * Here, instead:
 *
 *   OUR SIDE IS ONE FIXED IMAGE PER ELEMENT, seen by every critic of that element. Its
 *   spread is therefore pure critic noise and is directly comparable to the measured
 *   sd of 0.50.
 *
 *   THE REFERENCE SIDE IS A DIFFERENT PLATE FOR EVERY CRITIC (`--plates`, added to
 *   review.mjs for exactly this). Its spread is critic noise PLUS plate-to-plate
 *   variation, which is the honest thing to compare a single frame of ours against —
 *   and it means the 7-9 validity gate is tested against the whole library rather than
 *   against whichever plate the random draw happened to like.
 *
 *   EVERY CRITIC IS FRESH AND SEES EXACTLY ONE SHEET. k critics is k observations.
 *
 * ── Controls, because sixteen instruments have returned confident wrong answers ──
 * Two, run under the identical rubric and mixed in with the real rounds:
 *
 *   ctl_high  our panel IS a Brawl Stars plate (a different one from the reference).
 *             If the rubric cannot return ~8 for shipped work, every low score it
 *             produces is a property of the rubric, not of the game.
 *   ctl_low   our panel is our own arena frame, deliberately degraded (blur +
 *             desaturate + lift). It must score BELOW the clean original. If it does
 *             not, the instrument is not discriminating and the round is void.
 *
 * Usage:
 *   node tools/tmp/baseline_packets.mjs --critics 6 --out shots/review/baseline
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import sharp from 'sharp';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const ROOT = resolve(process.argv[1], '../../..');
const K = Number(args.critics ?? 6);
const OUT = resolve(args.out ?? join(ROOT, 'shots/review/baseline'));
const STAGE = join(ROOT, 'shots/baseline2');

const TD = ['bs_01.png', 'bs_02.png', 'bs_03.png', 'bs_04.png', 'bs_05.png', 'bs_06.png'];
const MENU_LOBBY = ['zb_01.png', 'zb_02.png', 'zb_03.png', 'zb_04.png'];
const MENU_SELECT = ['zb_01.png', 'zb_02.png', 'zb_03.png', 'zb_04.png'];

/** Round-robin so every plate is used as evenly as k allows. */
const cycle = (arr, k) => Array.from({ length: k }, (_, i) => arr[i % arr.length]);

const ELEMENTS = [
  {
    id: 'arena', ours: join(STAGE, 'match_donut_taco_03.png'),
    category: 'gameplay_topdown', plates: cycle(TD, K),
    what: 'the whole match frame mid-fight: arena, both fighters, VFX, full HUD',
  },
  {
    id: 'cast', ours: join(STAGE, 'ours_cast.png'),
    category: 'topdown_cast', plates: cycle(TD, K),
    what: 'the cast at gameplay scale — 45% of frame height, 16:9, centred on the fighters',
  },
  {
    id: 'hud', ours: join(STAGE, 'ours_hud.png'),
    category: 'topdown_hud', plates: cycle(TD, K),
    what: 'the interface band — the top 30% of frame height, full width',
  },
  {
    id: 'home', ours: join(ROOT, 'shots/baseline/home.png'),
    category: 'menu_lobby', plates: cycle(MENU_LOBBY, K),
    what: 'PASS 1, SUPERSEDED — home at 16:9 on a FIRST-RUN profile, against menu plates '
      + 'curated out of raw Zooba App Store composites. Kept because it is the only arm '
      + 'that isolates the profile/aspect change.',
  },
  {
    id: 'select', ours: join(ROOT, 'shots/baseline/select.png'),
    category: 'menu_select', plates: cycle(MENU_SELECT, K),
    what: 'PASS 1, SUPERSEDED — see `home`.',
  },

  // ── PASS 2: real menu plates, phone landscape, populated profile ───────────
  // `docs/DECISIONS-FOR-URI.md` §6 is closed: six genuine menu screenshots landed
  // mid-run, two of them Brawl Stars. Both changes below are content-matching, and
  // both are the same defect the arena side had (an idle frame against peak-action
  // plates, priced at ~1 point by a critic who named it unprompted):
  //   * 852x393 CSS at deviceScaleFactor 3 -> 2556x1179, byte-for-byte the plates'
  //     frame size, so aspect and effective UI scale are matched rather than argued.
  //   * a mid-progression profile, so our counters are not all zero against plates
  //     showing a played account.
  {
    id: 'home2', ours: join(ROOT, 'shots/baseline3/home.png'),
    category: 'menus_home', plates: cycle(['bs_home.png', 'zb_home.png'], K),
    what: 'PRIMARY — the home screen at phone landscape, populated profile.',
  },
  {
    id: 'select2', ours: join(ROOT, 'shots/baseline3/select.png'),
    category: 'menus_select',
    plates: cycle(['bs_roster_grid.png', 'bs_character_detail.png', 'zb_character_detail.png'], K),
    what: 'PRIMARY — character select at phone landscape, populated profile. Our screen '
      + 'carries BOTH a roster grid and a detail panel, so all three plates apply.',
  },
];

const CTL_K = Number(args.controlCritics ?? 3);
/**
 * `--only home2,select2` rebuilds just those packets and MERGES into the existing
 * assignments file. Load-bearing: `compare.mjs` coin-flips the A/B slot on every build,
 * so rebuilding a packet whose verdict has already been collected silently re-keys it
 * and the join in `baseline_score.mjs` would score the wrong panel as ours.
 */
const ONLY = typeof args.only === 'string' ? new Set(args.only.split(',').map((s) => s.trim())) : null;
const wanted = (id) => !ONLY || ONLY.has(id);

await mkdir(STAGE, { recursive: true });

// ── control fixtures ─────────────────────────────────────────────────────────
// ctl_high: a Brawl Stars plate standing in as "ours". Deliberately gets NO sidecar —
// it is not a capture of this game and must never be recorded as a verified one.
const CTL_HIGH_SRC = join(ROOT, 'reference/images/curated/gameplay_topdown/bs_05.png');
const ctlHigh = join(STAGE, 'ctl_high.png');
await copyFile(CTL_HIGH_SRC, ctlHigh);

// ctl_low: our arena frame, degraded on three axes at once so no single guard can catch
// it. Blur costs acuity, desaturation costs colour, the lift costs contrast — the three
// things the rubric names.
const CTL_LOW_SRC = join(STAGE, 'match_donut_taco_03.png');
const ctlLow = join(STAGE, 'ctl_low.png');
await sharp(CTL_LOW_SRC)
  .blur(3.5)
  .modulate({ saturation: 0.45, brightness: 1.12 })
  .linear(0.72, 40)
  .png().toFile(ctlLow);
{
  const sc = `${CTL_LOW_SRC}.capture.json`;
  const src = existsSync(sc) ? JSON.parse(await readFile(sc, 'utf8')) : null;
  await writeFile(`${ctlLow}.capture.json`, JSON.stringify({
    tool: 'baseline_packets', label: 'DEGRADED CONTROL — not a product image',
    takenAt: new Date().toISOString(),
    painted: src ? src.painted === true : false,
    enforced: false,
    derivedFrom: { path: CTL_LOW_SRC, degrade: 'blur 3.5 + saturation 0.45 + brightness 1.12 + linear(0.72,40)' },
    stats: null,
    before: src?.before ?? { ok: false, why: ['no source sidecar'] },
    after: src?.after ?? { ok: false, why: ['no source sidecar'] },
  }, null, 2));
}

const CONTROLS = [
  {
    id: 'ctl_high', ours: ctlHigh, category: 'gameplay_topdown',
    plates: ['bs_02.png', 'bs_04.png', 'bs_06.png'].slice(0, CTL_K),
    extra: ['--allow-unverified'],
    what: 'CONTROL: our panel is Brawl Stars bs_05. Both panels are shipped work.',
  },
  {
    id: 'ctl_low', ours: ctlLow, category: 'gameplay_topdown',
    plates: ['bs_01.png', 'bs_03.png', 'bs_05.png'].slice(0, CTL_K),
    extra: [],
    what: 'CONTROL: our panel is the arena frame degraded on three axes. Must score below `arena`.',
  },
];

// ── build ────────────────────────────────────────────────────────────────────
let assignments = [];
const existing = join(OUT, 'assignments.json');
if (ONLY && existsSync(existing)) {
  const prev = JSON.parse(await readFile(existing, 'utf8'));
  assignments = prev.assignments.filter((a) => !ONLY.has(a.element));
  console.log(`merging into ${existing}: keeping ${assignments.length} existing rows`);
}
for (const el of [...ELEMENTS, ...CONTROLS]) {
  if (!wanted(el.id)) continue;
  if (!existsSync(el.ours)) { console.error(`MISSING ours for ${el.id}: ${el.ours}`); process.exit(3); }
  el.plates.forEach((plate, i) => {
    const dir = join(OUT, `${el.id}-c${i + 1}`);
    execFileSync('node', [
      'tools/review.mjs',
      '--ours', el.ours,
      '--category', el.category,
      '--plates', plate,
      '--rubric', 'canonical',
      '--critics', '1',
      '--out', dir,
      ...(el.extra ?? []),
    ], { stdio: 'inherit', cwd: ROOT });
    assignments.push({
      element: el.id, critic: i + 1, dir, plate,
      category: el.category, ours: el.ours, what: el.what,
      sheet: join(dir, 'sheet_1.png'), key: join(dir, 'sheet_1.key.json'),
    });
  });
}

await writeFile(join(OUT, 'assignments.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  criticsPerElement: K, criticsPerControl: CTL_K,
  rubric: 'tools/review.rubric.txt (canonical v1)',
  assignments,
}, null, 2));

console.log(`\n${assignments.length} packets -> ${OUT}`);
for (const a of assignments) console.log(`  ${a.element.padEnd(9)} c${a.critic}  plate ${a.plate.padEnd(10)} ${a.sheet}`);
