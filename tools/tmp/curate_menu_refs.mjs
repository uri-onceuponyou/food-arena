#!/usr/bin/env node
/**
 * CURATE MENU REFERENCE PLATES — the images `docs/DECISIONS-FOR-URI.md` §6 says only
 * Uri can supply were already in the repo.
 *
 * §6 records: *"`reference/images/curated/` has no lobby / hero-select category, so
 * round 2 of the home work was scored against two in-match combat frames"*, and parks
 * the fix on Uri to screenshot Brawl Stars' lobby.
 *
 * That is true of the CURATED set and false of the RAW one. `reference/images/zooba/`
 * holds four distinct menu screens, each at both phone and tablet resolution, and they
 * have been sitting there since 2 Aug:
 *
 *   phone_4 / tablet_4   the hero-select CARD GRID ("CHOOSE YOUR CHARACTER")
 *   phone_5 / tablet_5   the hero screen — name, subtitle, pedestal, trophy bar — plus
 *                        a SKINS panel with an EQUIP button
 *   phone_6 / tablet_6   the GAME MODES screen: header bar, six mode cards, badges
 *   phone_7 / tablet_7   the adventure map with a modal over it
 *
 * `reference/images/brawlstars/` has none — all twelve files are the same six App Store
 * composites (one character render + one gameplay frame + promo text). So the menu
 * reference is Zooba-only, and that is a stated limitation of every menu score taken
 * against it, not a thing this script can fix.
 *
 * ── The curation rule, unchanged from `curated/INDEX.md` ────────────────────
 * Promo TEXT out; in-game chrome and in-game character art stay. Two of the four
 * screens (modes, adventure) carry pasted marketing renders of characters over the UI;
 * those are kept, because a character render over a menu is what these screens look
 * like in the products themselves and because the existing `character/` crops are
 * literally those renders. Crops that would cut a card in half are not taken.
 *
 * Coordinates below were read off downscaled previews and are recorded in SOURCE pixels
 * so the crop is reproducible if `reference/` is ever re-fetched.
 *
 * ⚠️ Everything this writes lands under `reference/images/`, which is GITIGNORED and
 * must never be committed or published. Nothing here adds to git.
 *
 * Usage:  node tools/tmp/curate_menu_refs.mjs [--check]
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.argv[1], '../../..');
const SRC = join(ROOT, 'reference/images/zooba');
const OUT = join(ROOT, 'reference/images/curated');

/**
 * `crop: null` means "the whole file is the screen" — true of the two GAME MODES
 * screenshots, which carry no promo text at all.
 */
const PLATES = [
  {
    cat: 'menu_select', name: 'zb_01.png', src: 'tablet_4.jpg',
    crop: { left: 30, top: 120, width: 1610, height: 1330 },
    note: 'hero-select card grid, 4 whole cards (tablet 2732x2048). The third column is '
      + 'excluded because the pasted penguin render overlaps it — a half-card would be a '
      + 'crop artefact scored as a design.',
  },
  {
    cat: 'menu_select', name: 'zb_02.png', src: 'phone_4.jpg',
    crop: { left: 25, top: 25, width: 1606, height: 824 },
    note: 'the same grid at phone resolution (2208x1242) — 6 whole cards; DONNA is cut '
      + 'by the pasted penguin and is excluded.',
  },
  {
    cat: 'menu_select', name: 'zb_03.png', src: 'tablet_5.jpg',
    crop: { left: 1330, top: 440, width: 1330, height: 925 },
    note: 'SKINS panel: three character cards, an EQUIPPED state and an EQUIP button. '
      + 'A card grid with a selection state, which is what a select screen is.',
  },
  {
    cat: 'menu_select', name: 'zb_04.png', src: 'tablet_5.jpg',
    crop: { left: 0, top: 0, width: 1560, height: 2048 },
    note: 'hero panel: name, subtitle, character on a pedestal, trophy bar. The '
      + '"selected fighter" half of a select screen.',
  },

  {
    cat: 'menu_lobby', name: 'zb_01.png', src: 'tablet_6.jpg', crop: null,
    note: 'GAME MODES, whole screen (tablet). Header bar with back button and title, six '
      + 'mode cards with art, RECOMMENDED/HOT badges, body copy, mode icons. No promo text.',
  },
  {
    cat: 'menu_lobby', name: 'zb_02.png', src: 'phone_6.png', crop: null,
    note: 'GAME MODES, whole screen (phone). No promo text.',
  },
  {
    cat: 'menu_lobby', name: 'zb_03.png', src: 'tablet_5.jpg',
    crop: { left: 0, top: 0, width: 1560, height: 2048 },
    note: 'hero panel — the closest thing in the set to our home screen: one character '
      + 'presented large with a name, a subtitle and a progress bar.',
  },
  {
    cat: 'menu_lobby', name: 'zb_04.png', src: 'tablet_7.jpg',
    crop: { left: 0, top: 0, width: 2732, height: 1250 },
    note: 'adventure-map modal: parchment header, node path, chest and next-node button, '
      + 'over the map. Cropped above the "COMPLETE CHALLENGES" promo line.',
  },
];

if (!existsSync(SRC)) {
  console.error(`No ${SRC} — reference/ is gitignored by design and this needs a working checkout of it.`);
  process.exit(77);
}

const rows = [];
for (const p of PLATES) {
  const src = join(SRC, p.src);
  if (!existsSync(src)) { console.error(`MISSING SOURCE ${src}`); process.exit(3); }
  const meta = await sharp(src).metadata();
  if (p.crop) {
    const { left, top, width, height } = p.crop;
    if (left + width > meta.width || top + height > meta.height) {
      console.error(`crop out of bounds for ${p.src} (${meta.width}x${meta.height}): ${JSON.stringify(p.crop)}`);
      process.exit(4);
    }
  }
  const dir = join(OUT, p.cat);
  await mkdir(dir, { recursive: true });
  const dst = join(dir, p.name);
  let img = sharp(src);
  if (p.crop) img = img.extract(p.crop);
  await img.png().toFile(dst);
  const out = await sharp(dst).metadata();
  rows.push({ ...p, srcSize: `${meta.width}x${meta.height}`, outSize: `${out.width}x${out.height}` });
  console.log(`${p.cat}/${p.name}  <- ${p.src} ${meta.width}x${meta.height} -> ${out.width}x${out.height}`);
}

for (const cat of ['menu_select', 'menu_lobby']) {
  const mine = rows.filter((r) => r.cat === cat);
  const lines = [
    `# ${cat} — curated menu reference plates`,
    '',
    'Built by `tools/tmp/curate_menu_refs.mjs` from the RAW Zooba App Store screenshots',
    'that have been in `reference/images/zooba/` since 2 Aug. `docs/DECISIONS-FOR-URI.md`',
    '§6 recorded that no lobby/hero-select reference existed; it did not exist in',
    '`curated/`, but the screens were in the raw set the whole time.',
    '',
    '⚠️ **Zooba only.** All twelve Brawl Stars raw files are the same six App Store',
    'composites (character render + gameplay frame + promo text) and contain no menu at',
    'all. Every score taken against this category is a comparison with ONE of the two',
    'reference products, and must say so.',
    '',
    '| File | Source | Size | What it is |',
    '|---|---|---|---|',
    ...mine.map((r) => `| ${r.name} | zooba/${r.src} (${r.srcSize}) | ${r.outSize} | ${r.note} |`),
    '',
  ];
  await writeFile(join(OUT, cat, 'INDEX.md'), `${lines.join('\n')}\n`);
}

console.log(`\n${rows.length} plates written under ${OUT} (gitignored — never commit these).`);
