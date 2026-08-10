#!/usr/bin/env node
/**
 * DELIVERED PIXEL BOX — what size does each icon actually SHIP at?
 *
 * ── Why this exists, and why it is NOT a second legibility instrument ────────
 * `tools/tmp/icon_legibility.mjs` + `icon_score.mjs` are the acceptance instrument for
 * `src/ui/icons/` and nothing here replaces them. They render a blind plate at a box
 * size given by a `--box` flag whose three CSS classes were transcribed BY HAND out of
 * `hud.ts` and `characterSelect.ts` (`slot26` 26px, `slot20` 20px, `ability` 21.6px).
 *
 * A transcribed CSS value is not a delivered pixel. Three things sit between them:
 *   - `font-size` is inherited and `clamp()`-ed, so the authored rule is an upper bound;
 *   - every icon is `width:1em; height:1em`, so the box is whatever the CASCADE settled
 *     on at that node, not whatever the nearest rule says;
 *   - the SVG is a 24-unit viewBox drawn with `meet`, so the INK inside the box is
 *     smaller than the box by however much margin the path leaves.
 *
 * So this walks the REAL screens on a snapshot and reads, per rendered icon node:
 *   box_css     getBoundingClientRect() of the <svg>            — the CSS box
 *   box_dev     the same times devicePixelRatio                 — actual device pixels
 *   ink_css     getBBox() in viewBox units, scaled into the box — the DRAWN extent
 * plus which screen it was on and whether it was actually visible.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ic_delivered.mjs --url {URL}
 *   ... --out shots/ic/delivered.json --vp phone
 *
 * ⚠️ Reads nothing from CSS source. If a rule changes, this changes with it.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { settleScreen } from './settle.mjs';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}
const BASE = (a.url ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = a.out ?? 'shots/ic/delivered.json';

/** Desktop is where the shop/trophy cards are biggest; phone is where the HUD is
 *  smallest (`hud.ts` drops the weapon slot to 20px under 720px). Both ship. */
const VIEWPORTS = {
  desk: { width: 1280, height: 800, dsf: 2 },
  phone: { width: 390, height: 844, dsf: 3 },
  land: { width: 844, height: 390, dsf: 3 },
};
const want = (a.vp ?? 'desk,phone,land').split(',');

/** In-page collector. Returns one row per rendered `.fa-ic` node.
 *
 *  ⚠️ It also records POLARITY, which the plate harness has never modelled. A blind
 *  plate that draws every glyph dark-on-cream is not the delivered condition for any
 *  icon inside `.chars-fact`, whose rule sets `--fa-ic-ink: #FFF3DE` on an ink plate —
 *  i.e. the `range` arrows ship CREAM ON DARK, inverted from every plate ever judged. */
const COLLECT = () => {
  /** ⚠️ CSS INFERENCE ONLY, AND IT IS KNOWN TO BE WRONG. Kept because the plate needs
   *  a fallback and because the failure is worth naming: a `background-image` gradient
   *  leaves `background-color: rgba(0,0,0,0)`, so this walk sails past the plate the
   *  icon is actually sitting on and returns some dark ancestor. It reported `check` on
   *  `.fa-btn--primary` and `play` on `.fa-btn--green` as INK ON INK, which drew both
   *  as solid dark blobs on the first delivered-size plate and looked exactly like this
   *  project's fourth dark-on-dark shipment. `tools/tmp/ic_contrast.mjs` ablated them
   *  and measured inkFrac 0.177 and 0.250 at maxΔ 229/191 — i.e. both are perfectly
   *  visible and the INSTRUMENT was wrong, not the screen.
   *  `bgPix` below supersedes this; it is a SAMPLE of the delivered pixels. */
  const bgOf = (node) => {
    for (let n = node; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(c)) return c;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const rows = [];
  for (const el of document.querySelectorAll('svg.fa-ic')) {
    const name = [...el.classList].find((c) => c.startsWith('fa-ic--'))?.slice(7) ?? '?';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    // Visible = painted and inside the viewport. A node in a closed sheet is neither.
    const vis = cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.02
      && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    // ⚠️ IN THE DOM AND ON SCREEN IS NOT THE SAME AS VISIBLE TO A PLAYER. The trophy
    // road keeps every node mounted behind the odds sheet, and the character panel
    // keeps a placeholder `avatar` mounted under each loaded portrait. Those rows
    // sampled their "plate" through a scrim and returned colours the screen does not
    // have — `shards` on brown, `heal` on gold, `boxBurger` on near-black — which is
    // how a plate ends up drawing a glyph against a background it never ships on.
    // `elementFromPoint` answers it directly: if the topmost element at the icon's own
    // centre is not the icon or an ancestor of it, something is on top.
    // ── OCCLUSION, IN TWO PARTS — because one test cannot answer both questions ──
    //
    // ⚠️ WAS: `!(hit === el || el.contains(hit) || hit === p1 || hit === p2)`, with the
    // reason *"`hit.contains(el)` is NOT an acceptable pass — when an icon is scrolled
    // out of a clipping container, `elementFromPoint` returns the SCREEN ROOT, which
    // contains the icon, so the test said 'not occluded' and the sample returned the
    // page's warm brown."* That diagnosis was right and the remedy over-fired: capping
    // the accepted ancestor at TWO levels made the predicate a proxy for DOM DEPTH.
    //
    // It excluded THE ENTIRE MATCH HUD. Every `.hud-weapon-emoji` row — desk, land and
    // phone, both fighters — came back `occluded: true`, so the weapon glyphs were
    // dropped from the delivered spec at the one site where a player meets them
    // mid-fight. `shots/ic/context/hud-waterbottle-phone.png` shows four slots with
    // nothing over them, and all seven rows agreed on rgb(239, 234, 247), which is
    // `#EFEAF7` — the documented HUD plate, i.e. the "occluded" sample was RIGHT.
    //
    // The cause is that `elementFromPoint` is a HIT TEST, not a paint query.
    // `pointer-events: none` on a wrapper makes it invisible to the hit test while it
    // goes on painting perfectly, so the topmost hit walks up to the slot button —
    // three levels above the `<svg>`. This project's standing lesson is that a thing
    // that "isn't there" is usually there and invisible; here the instrument declared a
    // painted element absent because it declines pointer events.
    //
    // So the two questions are separated and each is answered by the right instrument:
    //
    //   1. CLIPPED OUT — geometry. Intersect the client rects of every ancestor whose
    //      overflow is not `visible`. If the icon's centre falls outside that
    //      intersection it has been scrolled out of a scroller, and nothing on the
    //      screen is showing it. This is the case the old comment describes, and it is
    //      now caught WITHOUT the hit test.
    //   2. COVERED — the hit test, but only for what it can actually tell you. A hit on
    //      an unrelated element means something else paints over this point. A hit on an
    //      ANCESTOR at any depth means the hit test passed through non-interactive
    //      children and found the box the icon lives in — which is not an occluder.
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let clip = { l: 0, t: 0, rr: innerWidth, b: innerHeight };
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (o.overflow === 'visible' && o.overflowX === 'visible' && o.overflowY === 'visible') continue;
      const q = n.getBoundingClientRect();
      clip = { l: Math.max(clip.l, q.left), t: Math.max(clip.t, q.top), rr: Math.min(clip.rr, q.right), b: Math.min(clip.b, q.bottom) };
    }
    const clipped = !(cx > clip.l && cx < clip.rr && cy > clip.t && cy < clip.b);
    const hit = clipped ? null : document.elementFromPoint(
      Math.min(innerWidth - 1, Math.max(0, cx)), Math.min(innerHeight - 1, Math.max(0, cy)),
    );
    // ⚠️ AND ALLOWING ANY ANCESTOR WAS STILL NOT ENOUGH — the HUD came back covered by
    // the WebGL CANVAS. `pointer-events: none` on the HUD overlay means the hit test
    // falls THROUGH it to the element painted UNDERNEATH, and an element underneath is
    // the opposite of an occluder. Measured: `hit=canvas.` on all 27 `.hud-weapon-emoji`
    // rows across three viewports, every one sampling rgb(239, 234, 247) — the correct
    // `#EFEAF7` HUD plate — while `shots/ic/context/hud-waterbottle-phone.png` shows four
    // unobstructed slots.
    //
    // Document order is the discriminator, and it is the right one: within a stacking
    // context, later siblings paint over earlier ones. The odds sheet, its scrim and its
    // rows are all appended AFTER the trophy-road nodes they cover (measured: `hit` is
    // `div.tr-sheet-scrim`, `li.tr-odds-row`, `h3.tr-odds-title`, `section.tr-odds-block`
    // — every one FOLLOWING). The canvas PRECEDES the HUD. So a hit that follows is on
    // top; a hit that precedes is beneath and is not an occluder.
    const FOLLOWING = 4;    // Node.DOCUMENT_POSITION_FOLLOWING
    const related = !hit || hit === el || el.contains(hit) || hit.contains(el);
    const hitFollows = !!hit && !related && Boolean(el.compareDocumentPosition(hit) & FOLLOWING);
    const covered = !clipped && !related && hitFollows;
    const occluded = clipped || covered;
    let ink = null;
    try {
      const b = el.getBBox();               // viewBox units; 24-unit box, `meet` scale
      const s = Math.min(r.width, r.height) / 24;
      ink = { w: +(b.width * s).toFixed(2), h: +(b.height * s).toFixed(2) };
    } catch { /* getBBox throws on a detached node */ }
    rows.push({
      name,
      w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      ink, vis, occluded, clipped, covered, hitFollows,
      hitTag: hit && hit !== el ? `${hit.tagName.toLowerCase()}.${String(hit.className || '').split(' ')[0]}` : '',
      host: el.parentElement?.className || '',
      bg: bgOf(el),
      // ⚠️ SAMPLED FROM THE BOX'S OWN INTERIOR, WITH THE ICONS ABLATED — not from
      // outside it. The first cut probed 2 px beyond each corner, on the theory that
      // the surround is the plate. It is not: `.chars-fact` has `padding: 1px 6px`, so
      // 2 px above a `range` icon is already OUTSIDE the ink pill and on the white card
      // behind it. The plate therefore came back white while the outline stayed
      // `#FFF3DE`, and `range`, `stun` and `trophy` were drawn cream-on-cream —
      // invisible on the plate, and invisible for a reason that had nothing to do with
      // the game. Sampling the box interior off a screenshot taken with
      // `svg.fa-ic { visibility: hidden }` cannot make that mistake: whatever is there
      // is, by construction, exactly what the icon is drawn on top of.
      probe: [[r.left + r.width * 0.5, r.top + r.height * 0.5],
        [r.left + r.width * 0.15, r.top + r.height * 0.15],
        [r.left + r.width * 0.85, r.top + r.height * 0.15],
        [r.left + r.width * 0.15, r.top + r.height * 0.85],
        [r.left + r.width * 0.85, r.top + r.height * 0.85]]
        .map(([x, y]) => [Math.round(x), Math.round(y)]),
      outline: (cs.getPropertyValue('--fa-ic-ink') || '#1a1224').trim(),
      filter: cs.filter === 'none' ? '' : cs.filter,
    });
  }
  return { rows, dpr: devicePixelRatio };
};

async function at(page, screen, extra = '') {
  await page.goto(`${BASE}/?screen=${screen}${extra}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(`window.__screen === ${JSON.stringify(screen)}`, null, { timeout: 60000 });
  try { await settleScreen(page, { label: screen, timeout: 60000 }); } catch { /* record anyway */ }
  await page.waitForTimeout(250);
}

const browser = await chromium.launch();
const all = [];
const errs = [];

/**
 * Collect, then RESOLVE each icon's plate colour from the rendered pixels.
 *
 * The CSS walk above is an inference and it was measured wrong (see `bgOf`). This
 * screenshots the settled screen and reads the four points 2 px outside each icon's
 * corners, taking the per-channel MEDIAN so one corner landing on a border or a
 * neighbour cannot move the answer. That is a measurement of the delivered plate, and
 * it is what `ic_plate.mjs` builds its tiles from.
 */
async function grab(page, vp, screen, dsf) {
  const { rows, dpr } = await page.evaluate(COLLECT);
  // ── TWO ablated shots, and they have to AGREE. ─────────────────────────────
  // Character select repaints while it is being measured — `ic_contrast.mjs` put the
  // drift at up to 0.9998 of a box between two identical shots 300 ms apart. A single
  // sample off a moving panel is a confident wrong answer: it put `shards` on a GOLD
  // plate and `heal` in cream-on-gold, when both sit on surfaces the screenshots show
  // plainly are white and ink. So sample twice and keep the value only where the two
  // agree; anything else falls back to the CSS walk and is flagged.
  const shoot = async () => {
    const tag = await page.addStyleTag({ content: 'svg.fa-ic { visibility: hidden !important; }' });
    await page.waitForTimeout(180);
    const png = await page.screenshot({ type: 'png' });
    await page.evaluate((el) => el.remove(), tag).catch(() => {});
    return sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  };
  let img = null, img2 = null;
  try {
    img = await shoot();
    await page.waitForTimeout(400);
    img2 = await shoot();
  } catch { /* fall back to the CSS inference */ }
  const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const sample = (buf, r) => {
    const { width: W, height: H } = buf.info;
    const chans = [[], [], []];
    for (const [px, py] of r.probe) {
      const x = Math.round(px * dsf), y = Math.round(py * dsf);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 3;
      chans[0].push(buf.data[i]); chans[1].push(buf.data[i + 1]); chans[2].push(buf.data[i + 2]);
    }
    return chans[0].length ? [med(chans[0]), med(chans[1]), med(chans[2])] : null;
  };
  for (const r of rows) {
    if (img && img2) {
      const p = sample(img, r), q = sample(img2, r);
      if (p && q && Math.max(...p.map((v, i) => Math.abs(v - q[i]))) <= 8) {
        r.bgPix = `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
      } else r.bgUnstable = true;
    }
    delete r.probe;
    all.push({ vp, dpr, screen, ...r });
  }
}

for (const vp of want) {
  const { width, height, dsf } = VIEWPORTS[vp];
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dsf });
  page.on('pageerror', (e) => errs.push(`${vp}: ${e}`));

  for (const screen of (a.screens ?? 'home,characters,trophies,shop,settings').split(',').filter(Boolean)) {
    try {
      await at(page, screen);
      await grab(page, vp, screen, dsf);
    } catch (e) { errs.push(`${vp}/${screen}: ${e.message}`); }
  }

  // ── EVERY CHARACTER, one at a time. ────────────────────────────────────────
  // A single visit to `characters` renders ONE fighter's ability pills, so a
  // screen-level sweep sees 4 of the 33 weapon glyphs and silently reports the other
  // 29 as never-rendered. `shards` is one of the 29: it belongs to Water Bottle, and
  // it is the glyph this whole pass is about. `docs/LESSONS.md` §9 — an icon that is
  // never routed to is never rendered, and a sweep that never routes to it cannot
  // tell "unrouted" from "unvisited".
  try {
    await at(page, 'characters');
    const ids = await page.$$eval('.chars-card[data-char]', (ns) => ns.map((n) => n.dataset.char));
    for (const id of ids) {
      await page.click(`.chars-card[data-char="${id}"]`, { timeout: 15000 });
      await page.waitForTimeout(450);
      await grab(page, vp, `characters/${id}`, dsf);
    }
  } catch (e) { errs.push(`${vp}/chars-sweep: ${e.message}`); }

  // The trophy road's ODDS sheet is where `containerIcon` ships at its largest, and it
  // is closed on mount — a screen-level sweep would miss all four boxes there.
  try {
    await at(page, 'trophies');
    await page.click('[data-el="oddsbtn"]', { timeout: 15000 });
    await page.waitForTimeout(600);
    await grab(page, vp, 'trophies/odds', dsf);
  } catch (e) { errs.push(`${vp}/odds: ${e.message}`); }

  // The MATCH HUD carries the weapon glyphs. `waterbottle` is not an arbitrary pick —
  // it is the ONLY fighter that carries `shards`, so it is the only route by which that
  // glyph ever reaches a player mid-fight.
  for (const who of (a.match ?? 'waterbottle,hotdog').split(',')) {
    try {
      await page.goto(`${BASE}/?screen=match&player=${who}&enemy=pizza`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction('window.__screen === "match"', null, { timeout: 60000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await grab(page, vp, `match/${who}`, dsf);
    } catch (e) { errs.push(`${vp}/match/${who}: ${e.message}`); }
  }

  await page.close();
}
await browser.close();

// ── Roll-up: per icon, the size range it actually ships at. ──────────────────
const byName = new Map();
for (const r of all.filter((x) => x.vis && !x.occluded)) {
  const p = byName.get(r.name) ?? { name: r.name, n: 0, min: Infinity, max: 0, where: new Map(), inkMin: Infinity };
  p.n++;
  const px = Math.min(r.w, r.h);
  p.min = Math.min(p.min, px); p.max = Math.max(p.max, px);
  if (r.ink) p.inkMin = Math.min(p.inkMin, Math.max(r.ink.w, r.ink.h));
  const k = `${r.vp}/${r.screen}`;
  p.where.set(k, Math.min(p.where.get(k) ?? Infinity, px));
  byName.set(r.name, p);
}

// ── AUTHORED BUT NEVER RENDERED. ─────────────────────────────────────────────
// Its own bug, and one a screenshot can never catch: `docs/LESSONS.md` §9's amendment
// says a screenshot catches only what is ON SCREEN, and an icon nothing routes to is
// never on any screen. Registry keys are read from the source, not from the page, so
// an icon that fails to render for ANY reason still shows up as missing here.
const src = readFileSync('src/ui/icons/ui.ts', 'utf8') + readFileSync('src/ui/icons/food.ts', 'utf8');
const registry = new Set();
for (const m of src.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s*(`|box\()/gm)) registry.add(m[1]);
const rendered = new Set(all.map((r) => r.name));
const neverRendered = [...registry].filter((n) => !rendered.has(n)).sort();

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  base: BASE, viewports: want, errs, neverRendered,
  rows: all,
  perIcon: [...byName.values()].map((p) => ({
    name: p.name, n: p.n,
    minCssPx: +p.min.toFixed(2), maxCssPx: +p.max.toFixed(2),
    minInkPx: p.inkMin === Infinity ? null : +p.inkMin.toFixed(2),
    where: Object.fromEntries([...p.where].map(([k, v]) => [k, +v.toFixed(2)])),
  })).sort((x, y) => x.minCssPx - y.minCssPx),
}, null, 2));

console.log(`DELIVERED PIXEL BOX  (${all.length} rendered nodes, ${byName.size} distinct icons)\n`);
console.log('ICON'.padEnd(15) + 'min'.padStart(7) + 'max'.padStart(8) + '  ink@min'.padStart(9) + '  n'.padStart(4) + '   smallest site');
for (const p of [...byName.values()].sort((x, y) => x.min - y.min)) {
  const site = [...p.where].sort((x, y) => x[1] - y[1])[0];
  console.log(
    p.name.padEnd(15) +
    p.min.toFixed(1).padStart(7) + p.max.toFixed(1).padStart(8) +
    (p.inkMin === Infinity ? '—' : p.inkMin.toFixed(1)).padStart(9) +
    String(p.n).padStart(4) + '   ' + `${site[0]} @${site[1].toFixed(1)}`,
  );
}
console.log(`\nAUTHORED BUT NEVER RENDERED (${neverRendered.length} of ${registry.size}): ${neverRendered.join(', ') || 'none'}`);

// ── THE OCCLUSION PREDICATE, CHECKED AGAINST BOTH ANSWERS IT MUST GET RIGHT ──
// This is the whole of `CLAUDE.md` #6 for this instrument. The predicate was rewritten
// because its old form excluded the match HUD; a rewrite that simply stopped calling
// anything occluded would "fix" that and silently reintroduce the bug it replaced — the
// drop-rates sheet sampling the trophy road's warm brown through a scrim. So both
// directions are asserted on the live sweep, and the run FAILS if either goes quiet.
//
//   MUST STILL FIRE   the trophy-road nodes are behind the odds sheet while it is open
//   MUST NOT FIRE     the HUD weapon slots, which are painted and merely non-interactive
//   AND THE SAMPLES MUST AGREE — an unoccluded row's own plate colour has to match what
//                     its co-sited siblings measured, or "unoccluded" means nothing
const occl = [];
const behind = all.filter((r) => /trophies\/odds/.test(r.screen) && r.host === 'tr-node-em');
occl.push([`odds sheet still hides the trophy-road nodes (${behind.length} rows)`,
  behind.length > 0 && behind.every((r) => r.occluded), true]);
const hud = all.filter((r) => r.host === 'hud-weapon-emoji');
occl.push([`the match HUD weapon slots are NOT occluded (${hud.length} rows)`,
  hud.length > 0 && hud.every((r) => !r.occluded), true]);
occl.push(['at least one row IS occluded, so the test is not a no-op',
  all.some((r) => r.occluded), true]);
// ⚠️ WAS: *"co-sited samples agree — worst spread <= 24"*. That assertion was WRONG,
// not merely strict: `desk/characters::chars-card-art` is eleven different character
// portraits behind eleven placeholder icons, so its spread is 191 BY DESIGN. A site that
// spans several plates is a real thing and it is `ic_spec.mjs`'s job to refuse to lend a
// plate there (it does, above a spread of 16). Asserting agreement here made a correct
// measurement fail its own gate, which is how a usable sweep gets thrown away.
// Replaced by two claims this tool can actually own:
// ⚠️ AND THE FIRST VERSION OF THIS ROW WAS ALSO A GUESS: *"stable — under 5% of rows
// disagreed"*. Measured on a desk sweep, 111 of 586 rows (19%) disagree between two
// ablated shots 400 ms apart, because character select genuinely repaints while it is
// being measured — this file's own `grab()` comment says so and puts the drift at up to
// 0.9998 of a box. So the 5% was a threshold invented to be passed, and it failed a
// sweep that was correct. What actually matters is not the RATE but that an unstable row
// LENDS NOTHING, which is a structural invariant and can be asserted exactly.
const unstable = all.filter((r) => r.bgUnstable).length;
occl.push([`an unstable row carries no plate sample (${unstable} of ${all.length} rows unstable, ${(unstable / Math.max(1, all.length) * 100).toFixed(1)}%)`,
  all.every((r) => !(r.bgUnstable && r.bgPix)), true]);
// The new predicate's own known-bad direction: nothing may be called covered by an
// element that PRECEDES it in the document, because that element paints underneath.
// This is the canvas fault, asserted rather than remembered.
const beneath = all.filter((r) => r.covered && !r.hitFollows);
occl.push([`nothing is "covered" by an element painted BENEATH it (${beneath.length} rows)`,
  beneath.length === 0, true]);
console.log('\nOCCLUSION PREDICATE — both directions, on this sweep:');
let occlFail = 0;
for (const [label, got, want] of occl) {
  const ok = got === want;
  if (!ok) occlFail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
}
if (errs.length) console.log('\nERRORS:\n' + errs.join('\n'));
console.log(`\nwrote ${OUT}`);
if (occlFail) { console.log(`\n🔴 OCCLUSION PREDICATE: ${occlFail} of ${occl.length} FAILED — this sweep is not usable.`); process.exit(1); }
