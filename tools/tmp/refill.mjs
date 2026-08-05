#!/usr/bin/env node
/**
 * FIGURE / CARD AREA, recomputed offline from the dumped source renders.
 *
 * `chars_metrics.mjs` computes this number inside the page, which is right — it is the
 * acceptance test and it must measure the shipped screen. It also costs ~5 minutes for
 * three viewports, because it waits on `window.__thumbsReady` and that flag takes 28.9 s
 * per viewport under SwiftShader.
 *
 * This recomputes the identical quantity from `thumbdump.mjs`'s PNGs plus the card
 * geometry `faceframe.mjs` measured off the real screen — same key, same object-fit
 * window, same `visiblePx * scale^2 / cardArea`. Two things that buys:
 *
 *  1. **A like-for-like BEFORE.** The before-run keyed waterbottle's background off the
 *     top corner strips, which its own bottle cap was sitting in — std 46.4, threshold
 *     139.9 against everyone else's 26. Its 57.6% was measured with a five-times-looser
 *     key than the rest of the cast. Re-keying the SAME before-PNG against the correct
 *     background gives the number the comparison actually needs, without re-rendering
 *     anything and without the peer edits that land between two browser runs.
 *  2. **A cross-check on the acceptance test.** Two independent implementations of one
 *     number; if they disagree, one of them is wrong and neither should be quoted.
 *
 * The background per rarity is taken from characters whose strips ARE clean, which is why
 * `--bg` is a rarity map rather than a per-character one: the generator bakes one colour
 * per rarity, and Sushi and Water Bottle are both Legendary.
 *
 *   node tools/tmp/refill.mjs --dir shots/roster/src --label before --cards shots/roster/cards.json
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1]?.startsWith('--') === false ? process.argv[++i] : true;
}
const dir = args.dir ?? 'shots/roster/src';
const label = args.label ?? 'before';
const cardsPath = args.cards ?? 'shots/roster/cards.json';

/** id -> rarity, and the post-grade background each rarity bakes. */
const RARITY = {
  hamburger: 'Normal', donut: 'Normal', taco: 'Rare', burrito: 'Rare',
  egg: 'Neon', lollipop: 'Cyber', pizza: 'Neon', sushi: 'Legendary',
  soup: 'Epic', waterbottle: 'Legendary', hotdog: 'Cyber',
};
/** Measured off the clean-strip characters of each rarity in the BEFORE dump. */
const BG = {
  Normal: [203, 203, 203], Rare: [39, 147, 247], Neon: [246, 24, 38],
  Cyber: [5, 230, 246], Legendary: [249, 216, 26], Epic: [162, 95, 247],
};
const THR = 26;

const geo = JSON.parse(await readFile(cardsPath, 'utf8'));
const ids = Object.keys(RARITY);

const rows = {};
for (const id of ids) {
  const { data, info } = await sharp(`${dir}/${label}-${id}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const [br, bg, bb] = BG[RARITY[id]];
  // Subject mask once; the three viewports differ only in which window of it is shown.
  const mask = new Uint8Array(W * H);
  let total = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb) <= THR) continue;
      mask[y * W + x] = 1; total++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  rows[id] = { total, bbox: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, vps: {} };
  for (const [vp, g] of Object.entries(geo)) {
    const c = g.cards.find((k) => k.id === id);
    if (!c) continue;
    const win = {
      x0: (c.pad.l - c.dx) / c.sc, x1: (c.pad.r - c.dx) / c.sc,
      y0: (c.pad.t - c.dy) / c.sc, y1: (c.pad.b - c.dy) / c.sc,
    };
    let vis = 0;
    for (let y = Math.max(0, Math.floor(win.y0)); y <= Math.min(H - 1, Math.ceil(win.y1)); y++) {
      if (y < win.y0 || y > win.y1) continue;
      for (let x = Math.max(0, Math.floor(win.x0)); x <= Math.min(W - 1, Math.ceil(win.x1)); x++) {
        if (x < win.x0 || x > win.x1) continue;
        vis += mask[y * W + x];
      }
    }
    const cardArea = c.inner.w * c.inner.h;
    rows[id].vps[vp] = {
      fill: +((vis * c.sc * c.sc) / cardArea).toFixed(4),
      kept: +(vis / Math.max(1, total)).toFixed(3),
    };
  }
}

const vps = Object.keys(geo);
console.log(`\n══ FIGURE / CARD AREA recomputed from ${dir}/${label}-*.png (published-colour key, thr ${THR}) ══`);
console.log(`  ${'id'.padEnd(13)}${vps.map((v) => v.padStart(16)).join('')}`);
for (const id of ids) {
  console.log(`  ${id.padEnd(13)}` + vps.map((v) => {
    const r = rows[id].vps[v];
    return `${(r.fill * 100).toFixed(1)}% (k${(r.kept * 100).toFixed(0)}%)`.padStart(16);
  }).join(''));
}
console.log(`  ${'MEAN'.padEnd(13)}` + vps.map((v) => {
  const m = ids.reduce((a, id) => a + rows[id].vps[v].fill, 0) / ids.length;
  return `${(m * 100).toFixed(1)}%`.padStart(16);
}).join(''));
if (args.json) await (await import('node:fs/promises')).writeFile(args.json, JSON.stringify(rows, null, 2));
