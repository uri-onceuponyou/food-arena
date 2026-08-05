#!/usr/bin/env node
/**
 * How much of `charStage`'s COOL SET survives the title card's mask — and what any
 * candidate mask costs the fighter.
 *
 * ── The question ────────────────────────────────────────────────────────────
 * `opening.ts` masks the shared 3D character stage to an ellipse so the deep-blue
 * cyclorama and its horizon do not read as "a video player pasted onto a title card".
 * Its own comment prices the trade honestly — *"the part no mask can remove without
 * cutting the fighter too"* — but the trade has never been MEASURED, and at 430x932
 * the horizon is plainly visible behind the fighter's chest.
 *
 * ── Why a probe and not a critic round ──────────────────────────────────────
 * `docs/LESSONS.md` §2, now eight for eight. And this one has the shape a critic is
 * worst at: two quantities that move in OPPOSITE directions under the same knob, so a
 * single "better?" verdict cannot separate "the blue is gone" from "the arms are gone".
 *
 *   coolShare      share of the stage box that is cyclorama-coloured. LOWER is better.
 *   fighterPx      pixels of the fighter that reach the screen. MUST NOT FALL.
 *
 * `fighterPx` is the control, and it is the whole point: every previous attempt at this
 * was reasoned about rather than measured, and `docs/LESSONS.md` §1 has eighteen entries
 * of things that were "fixed" without checking that pixels still arrived.
 *
 * The cool test is `home_metrics.mjs`'s own backdrop rule (b > r+20, b >= 70, g > r),
 * reused verbatim rather than invented, so the number means the same thing it means on
 * the two other screens that mount this stage.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/openglare.mjs --url {URL}
 *   ... --variants   also prices candidate masks by overriding the CSS in the page
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { settleScreen } from './settle.mjs';

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const VIEWPORTS = [
  { name: 'desktop', w: 1600, h: 900 },
  { name: 'phone-portrait', w: 430, h: 932 },
  { name: 'phone-land', w: 844, h: 390 },
];

/**
 * Candidate masks, as CSS to override `.open-stage-3d`'s own.
 *
 * `shipped` is first and is a CONTROL: it re-states the shipped value, so if the harness
 * ever reports it differently from the no-override run the harness is wrong, not the CSS.
 */
const VARIANTS = [
  { name: 'shipped', mask: 'radial-gradient(62% 58% at 50% 54%, #000 46%, rgba(0,0,0,0.40) 64%, transparent 80%)' },
  { name: 'tight', mask: 'radial-gradient(56% 54% at 50% 54%, #000 38%, rgba(0,0,0,0.35) 56%, transparent 74%)' },
  { name: 'tighter', mask: 'radial-gradient(50% 50% at 50% 55%, #000 30%, rgba(0,0,0,0.30) 50%, transparent 70%)' },
  { name: 'steep', mask: 'radial-gradient(62% 58% at 50% 54%, #000 40%, rgba(0,0,0,0.18) 52%, transparent 64%)' },
];

/**
 * The OTHER lever, and the only one that does not cut geometry: the warm rim that beds
 * the patch into the card. It ships at `mix-blend-mode: soft-light`, which barely moves
 * a near-black navy.
 *
 * These need their own guard. Warming the set moves pixels from `cool` to `warm`, which
 * is the SAME signature as a good mask — so `fighterShift` is reported beside them: the
 * mean channel move, over pixels that were fighter-coloured in the LIVE frame. A glow
 * that warms the backdrop without touching the fighter shows a low shift; one that
 * repaints the character shows a high one.
 */
const GLOWS = [
  { name: 'glow: shipped', css: 'mix-blend-mode: soft-light;' },
  { name: 'glow: overlay', css: 'mix-blend-mode: overlay;' },
  {
    name: 'glow: warm veil .18',
    css: 'mix-blend-mode: normal; background: radial-gradient(64% 60% at 50% 54%, rgba(255,150,60,0.18) 30%,'
      + ' rgba(255,150,60,0.16) 70%, transparent 92%);',
  },
  {
    name: 'glow: warm veil .30',
    css: 'mix-blend-mode: normal; background: radial-gradient(64% 60% at 50% 54%, rgba(255,150,60,0.30) 30%,'
      + ' rgba(255,150,60,0.26) 70%, transparent 92%);',
  },
];

/** Mean |ΔRGB| over pixels the LIVE frame classified as delivered-and-warm. */
function fighterShift(live, other, card, w, h, ch) {
  let n = 0;
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const p = i * ch;
    const dr = Math.abs(live[p] - card[p]);
    const dg = Math.abs(live[p + 1] - card[p + 1]);
    const db = Math.abs(live[p + 2] - card[p + 2]);
    if (Math.max(dr, dg, db) <= 24) continue;
    const r = live[p];
    const g = live[p + 1];
    const bl = live[p + 2];
    if (bl > r + 20 && bl >= 70 && g > r) continue;
    n++;
    sum += (Math.abs(live[p] - other[p]) + Math.abs(live[p + 1] - other[p + 1])
      + Math.abs(live[p + 2] - other[p + 2])) / 3;
  }
  return n === 0 ? 0 : sum / n;
}

/**
 * ⚠️ THE FIRST VERSION OF THIS FUNCTION WAS WRONG, AND ITS OWN CONTROL CAUGHT IT.
 *
 * It classified a pixel as "fighter" with `r > 110 && r > b + 40` — warm and lit. The
 * card behind the stage is a saturated ORANGE gradient, so every pixel the mask made
 * TRANSPARENT was counted as fighter. Result: the tighter the mask, the more "fighter"
 * it reported (266,591 -> 302,860 delivered pixels while deleting canvas), and the
 * verbatim-shipped control disagreed with the un-overridden page by 44%.
 *
 * `docs/LESSONS.md` §13 in one run: an instrument that lies plausibly is worse than
 * none, and the thing that exposed it was scoring a KNOWN input.
 *
 * What replaces it is a differential, with nothing to tune: shoot the box, hide the
 * canvas, shoot it again, and every pixel that MOVED is a pixel the stage delivered.
 * The card cannot be mistaken for the fighter because the card is in both frames.
 */
function diffClassify(a, b, w, h, ch) {
  let delivered = 0;
  let cool = 0;
  for (let i = 0; i < w * h; i++) {
    const p = i * ch;
    const dr = Math.abs(a[p] - b[p]);
    const dg = Math.abs(a[p + 1] - b[p + 1]);
    const db = Math.abs(a[p + 2] - b[p + 2]);
    if (Math.max(dr, dg, db) <= 24) continue;
    delivered++;
    const r = a[p];
    const g = a[p + 1];
    const bl = a[p + 2];
    // `home_metrics.mjs`'s own backdrop rule, reused verbatim so the number means the
    // same thing it means on the two other screens that mount this stage.
    if (bl > r + 20 && bl >= 70 && g > r) cool++;
  }
  return { delivered, cool, warm: delivered - cool, total: w * h };
}

async function shoot(page, box) {
  // capture-audit: allow — settleScreen ran above; the SUBJECT is a crop of one element
  const png = await page.screenshot({ clip: box });
  const img = sharp(png);
  const meta = await img.metadata();
  return { raw: await img.raw().toBuffer(), w: meta.width, h: meta.height, ch: meta.channels ?? 3 };
}

const setCanvasHidden = (page, hidden) =>
  page.evaluate((h) => {
    const el = document.querySelector('.open-stage-3d');
    if (el) el.style.visibility = h ? 'hidden' : '';
  }, hidden);

const browser = await chromium.launch({ args: LAUNCH });
const rows = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/?screen=opening&hold=600000`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__screen === "opening"', null, { timeout: 60000 });
  await settleScreen(page, { label: `opening@${vp.name}`, timeout: 60000 });

  const box = await page.evaluate(() => {
    const el = document.querySelector('.open-stage');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  });
  if (!box) { console.log(`!! ${vp.name}: no .open-stage`); await page.close(); continue; }

  // The card alone, once per viewport. Everything below is measured against it.
  await setCanvasHidden(page, true);
  await page.waitForTimeout(180);
  const card = await shoot(page, box);
  await setCanvasHidden(page, false);
  await page.waitForTimeout(180);

  /** DRIFT CONTROL. Two identical-condition frames, so the sway's own noise is a number
   *  rather than an assumption — `docs/LESSONS.md` §1's eighteenth entry is exactly the
   *  case of a change judged without one. */
  const a1 = await shoot(page, box);
  await page.waitForTimeout(240);
  const a2 = await shoot(page, box);
  const m1 = diffClassify(a1.raw, card.raw, a1.w, a1.h, a1.ch);
  const m2 = diffClassify(a2.raw, card.raw, a2.w, a2.h, a2.ch);
  rows.push({ vp: vp.name, variant: 'LIVE', box: `${box.width}x${box.height}`, ...m1 });
  rows.push({ vp: vp.name, variant: 'LIVE (drift control)', box: `${box.width}x${box.height}`, ...m2 });

  if (args.variants) {
    for (const v of VARIANTS) {
      await page.addStyleTag({
        content: `.fa-opening .open-stage-3d { -webkit-mask-image: ${v.mask} !important; mask-image: ${v.mask} !important; }`,
      });
      await page.waitForTimeout(240);
      // eslint-disable-next-line no-await-in-loop
      const f = await shoot(page, box);
      rows.push({
        vp: vp.name,
        variant: v.name,
        box: `${box.width}x${box.height}`,
        ...diffClassify(f.raw, card.raw, f.w, f.h, f.ch),
        shift: fighterShift(a1.raw, f.raw, card.raw, f.w, f.h, f.ch),
      });
    }
    // Put the shipped mask back before pricing the glow, so the two levers are measured
    // one at a time rather than as a stack.
    await page.addStyleTag({
      content: `.fa-opening .open-stage-3d { -webkit-mask-image: ${VARIANTS[0].mask} !important; mask-image: ${VARIANTS[0].mask} !important; }`,
    });
    // The drift control, restated for the glow half: same frame, same conditions.
    await page.waitForTimeout(240);
    const g0 = await shoot(page, box);
    rows.push({
      vp: vp.name,
      variant: 'glow drift control',
      box: `${box.width}x${box.height}`,
      ...diffClassify(g0.raw, card.raw, g0.w, g0.h, g0.ch),
      shift: fighterShift(a1.raw, g0.raw, card.raw, g0.w, g0.h, g0.ch),
    });
    for (const g of GLOWS) {
      await page.addStyleTag({ content: `.fa-opening .open-glow { ${g.css} }` });
      await page.waitForTimeout(240);
      if (args.shot) {
        // capture-audit: allow — settled above; the SUBJECT is a CSS override under test
        await page.screenshot({ path: `shots/open/${vp.name}-${g.name.replace(/[^a-z0-9]+/gi, '-')}.png` });
      }
      // eslint-disable-next-line no-await-in-loop
      const f = await shoot(page, box);
      rows.push({
        vp: vp.name,
        variant: g.name,
        box: `${box.width}x${box.height}`,
        ...diffClassify(f.raw, card.raw, f.w, f.h, f.ch),
        shift: fighterShift(a1.raw, f.raw, card.raw, f.w, f.h, f.ch),
      });
    }
  }
  await page.close();
}
await browser.close();

let vp = '';
for (const r of rows) {
  if (r.vp !== vp) {
    vp = r.vp;
    console.log(`\n── opening @ ${vp} (stage box ${r.box}) ──`);
    console.log('  variant               coolShare    coolPx     warmPx  delivered  fighterShift');
  }
  const share = ((r.cool / r.total) * 100).toFixed(2);
  console.log(`  ${r.variant.padEnd(20)} ${String(share).padStart(7)}%  ${String(r.cool).padStart(8)}  ${String(r.warm).padStart(9)}  ${String(r.delivered).padStart(9)}  ${r.shift === undefined ? '     —' : r.shift.toFixed(2).padStart(6)}`);
}
console.log('\ncoolShare LOWER is better. warmPx MUST NOT FALL — a mask that wins the first by');
console.log('losing the second has cut the character, which is the trade the shipped comment');
console.log('says it refused to make. Judge both against the drift control above.');
