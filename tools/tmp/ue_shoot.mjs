#!/usr/bin/env node
/**
 * ue_shoot — capture OUR menu screens at the reference plates' EXACT device-pixel
 * size, and read every UI element's rect off the DOM.
 *
 * THROWAWAY, read-only on `src/`. Writes only under `shots/uielem/`.
 *
 * ── WHY 852x393 AT deviceScaleFactor 3 ──────────────────────────────────────
 * Every plate in `reference/images/curated/menus/` is **2556x1179**. 852*3 = 2556 and
 * 393*3 = 1179, so this capture is pixel-for-pixel the same canvas as the reference.
 * That matters more here than it did for the character pass: a UI element's quality is
 * partly its SIZE ON THE DEVICE (a 4 px bar is a different object from a 12 px bar), so
 * pairing at matched canvas means "the same fraction of the screen" is also "the same
 * number of pixels". `docs/LESSONS.md` §6: judge at shipped framing.
 *
 * ── WHY THE RECTS COME FROM THE DOM AND NOT FROM AN EYE ─────────────────────
 * `pp_ref_parts.mjs` had to author its boxes by hand because a screenshot has no rig to
 * read. OUR side has one: `getBoundingClientRect()`. So our half of every pair is exact
 * and reproducible, and only the reference half is authored. That asymmetry is stated
 * rather than hidden — it is also why the reference boxes live in their own file with
 * their reasoning next to them (`ue_ref_boxes.mjs`).
 *
 * ── THE UNION SELECTOR ──────────────────────────────────────────────────────
 * Several "elements" in the brief are GROUPS with no wrapper node — the three currency
 * chips are three siblings of a flex header, the chest rows are three sibling buttons.
 * A group is captured as the union of its members' rects, which is what a player sees
 * as one object.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ue_shoot.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { settleScreen, captureSettled } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/**
 * `plate` is the measurement viewport: 852*3 = 2556, 393*3 = 1179.
 *
 * `tall` exists for ONE reason and it is a finding, not a convenience. At
 * `max-height: 460px` — which the plate viewport is inside — `home.ts:1482` hides
 * `.home-kit`, `.home-record`, `.home-track-sub` and `.home-mode-sub` deliberately.
 * So on the screen a phone player actually sees, the brief's `weapon-buttons` element
 * DOES NOT EXIST on home. `tall` is 87 CSS px taller, which is the smallest change
 * that clears that breakpoint, and everything measured on it is labelled off-plate:
 * its canvas is 2556x1440, so its native-pixel numbers are NOT comparable to the
 * plates' and only its craft pairing is.
 */
const VIEWPORTS = [
  { name: 'plate', w: 852, h: 393, dsf: 3 },
  { name: 'tall', w: 852, h: 480, dsf: 3 },
];

/**
 * A POPULATED profile. `docs/LESSONS.md`: an empty save costs ~1 point, and the
 * elements under test here are mostly progression chrome — an XP bar at 0, a chest row
 * with no chests and a coin chip reading 0 are not the objects a player looks at.
 * Same numbers as `screen_metrics.mjs`'s seed so the two tools describe one player.
 */
const SEED_PROFILE = {
  name: 'Chef', wins: 40, losses: 22, xp: 4180, selected: 'hamburger',
  economy: {
    trophies: 3170, bestTrophies: 3170, coins: 4210, gems: 96,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [
      10, 25, 42, 60, 85, 107, 130, 160, 190, 220, 260, 300, 345, 400, 455, 510, 580,
      650, 725, 815, 905, 1000, 1105, 1220, 1340, 1485, 1630, 1780, 1980, 2190, 2400,
    ],
    unlocked: ['hamburger', 'hotdog', 'pizza', 'sushi', 'taco', 'donut'],
    winsTowardChest: 1, lastMatch: null, seed: 12345, rolls: 7,
  },
};

/**
 * The elements, by screen. `sel` is a CSS selector; when it matches several nodes the
 * rect is their UNION (see the header note). `all:true` forces the union even for one
 * match, and is how a single-member group stays honest if the markup changes.
 */
const ELEMENTS = {
  home: {
    'nav-tabs':          { sel: '.fa-tabs' },
    // The 2-up unit — one ACTIVE tab beside one inactive one. The whole 4-tab bar is
    // 6.06:1 and the only tab control in the supplied plates is 2.0:1, a 3.0x aspect
    // mismatch that would make the pair a measurement of the crop. Two tabs is 3.03:1
    // and is the same compositional statement: this is the selected one, that is not.
    'nav-tab-2up':       { sel: '.fa-tabs .fa-tab:nth-child(-n+2)', all: true },
    'currency-chips':    { sel: '.fa-topbar .fa-chip', all: true },
    'panel-progress':    { sel: '.home-progress' },
    'panel-fighter':     { sel: '.home-fighter' },
    'xp-bar':            { sel: '.home-level' },
    'stat-bars':         { sel: '.home-stats' },
    'chest-rows':        { sel: '.home-track', all: true },
    'chest-row-single':  { sel: '.home-track--road' },
    'weapon-buttons':    { sel: '.home-kit' },
    'primary-button':    { sel: '.home-bottom .fa-btn--primary' },
    'secondary-button':  { sel: '.home-change' },
    'mode-chip':         { sel: '.home-mode' },
    'type-scale':        { sel: '.home-nameplate' },
    'rarity-badge':      { sel: '.home-nameplate .fa-rarity' },
    'progress-track':    { sel: '.home-track--road .home-bar' },
  },
  characters: {
    'currency-chips':    { sel: '.fa-topbar .fa-chip', all: true },
    'stat-bars':         { sel: '.chars-stats' },
    'panel-fighter':     { sel: '.chars-detail' },
    'primary-button':    { sel: '.chars-bottom .fa-btn--primary' },
    'secondary-button':  { sel: '.chars-equip' },
    'xp-bar':            { sel: '.chars-level' },
    'weapon-buttons':    { sel: '.chars-abilities' },
    'type-scale':        { sel: '.chars-hero-plate' },
    'rarity-badge':      { sel: '.chars-hero-plate .fa-rarity' },
    'roster-card':       { sel: '.chars-card.is-on, .chars-card:not(.is-locked)' },
  },
};

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[k] = true; else { o[k] = n; i++; }
  }
  return o;
}

/** Read the union rect of a selector, in CSS px, with per-node detail. */
function readRects(spec) {
  const out = {};
  for (const [name, s] of Object.entries(spec)) {
    const nodes = [...document.querySelectorAll(`.fa-root ${s.sel}`)].filter((n) => {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (n.hasAttribute('hidden')) return false;
      const r = n.getBoundingClientRect();
      return r.width >= 4 && r.height >= 4;
    });
    if (!nodes.length) { out[name] = { found: 0 }; continue; }
    const use = s.all ? nodes : [nodes[0]];
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const n of use) {
      const q = n.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top);
      r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    // Everything the shared-chrome question needs, read from the SAME nodes the crop
    // will show: 19 border-radii / 71 box-shadows / 40 font-sizes across src/ui is the
    // structural cause already in hand, so each element records its own contribution.
    const styles = use.map((n) => {
      const cs = getComputedStyle(n);
      return {
        cls: n.className && n.className.baseVal !== undefined ? n.className.baseVal : String(n.className || ''),
        tag: n.tagName.toLowerCase(),
        radius: cs.borderRadius, shadow: cs.boxShadow, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
        bg: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 120) : cs.backgroundColor,
        font: `${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight} ${cs.fontFamily.split(',')[0]}`,
        letterSpacing: cs.letterSpacing, textTransform: cs.textTransform,
        color: cs.color, textShadow: cs.textShadow === 'none' ? null : cs.textShadow.slice(0, 120),
        pad: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      };
    });
    // Descendant type + geometry census, so "40 distinct font-sizes" can be attributed.
    const descend = [];
    for (const n of use) {
      for (const d of [n, ...n.querySelectorAll('*')]) {
        const cs = getComputedStyle(d);
        const q = d.getBoundingClientRect();
        if (q.width < 1 || q.height < 1) continue;
        descend.push({
          cls: (typeof d.className === 'string' ? d.className : '').split(' ')[0] || d.tagName.toLowerCase(),
          w: +q.width.toFixed(1), h: +q.height.toFixed(1),
          fs: cs.fontSize, fw: cs.fontWeight, ff: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
          radius: cs.borderRadius, shadow: cs.boxShadow === 'none' ? null : cs.boxShadow,
          text: (d.childNodes.length && [...d.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))
            ? [...d.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent.trim()).join(' ').slice(0, 40) : null,
          // TRUNCATION, measured rather than eyeballed. `text-overflow: ellipsis`
          // leaves no trace in the DOM text and no trace in a font-size census: the
          // string is complete in `textContent` and the loss is entirely in layout.
          // Home ships one visible ellipsis at this viewport and nothing in this repo
          // was looking for it.
          clipped: d.scrollWidth > d.clientWidth + 1
            ? { scrollW: d.scrollWidth, clientW: d.clientWidth, lostPx: d.scrollWidth - d.clientWidth, ellipsis: cs.textOverflow === 'ellipsis' }
            : null,
        });
      }
    }
    out[name] = {
      found: nodes.length, used: use.length, selector: s.sel,
      css: { x: +l.toFixed(2), y: +t.toFixed(2), w: +(r - l).toFixed(2), h: +(b - t).toFixed(2) },
      styles, descend,
    };
  }
  return out;
}

const args = parseArgs(process.argv);
const base = args.url ?? process.env.PREVIEW_BASE;
if (!base) { console.error('need --url (use with_snapshot.mjs)'); process.exit(2); }
const OUT = args.out ?? 'shots/uielem';
await mkdir(`${OUT}/_raw`, { recursive: true });

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const result = { viewports: {} };
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dsf });
  await page.addInitScript((p) => { try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private */ } }, SEED_PROFILE);
  const vres = { canvas: { w: vp.w * vp.dsf, h: vp.h * vp.dsf, cssW: vp.w, cssH: vp.h, dsf: vp.dsf }, screens: {} };
  for (const screen of Object.keys(ELEMENTS)) {
    await page.goto(`${base}/?screen=${screen}&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(`window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`, null, { timeout: 60000 });
    await settleScreen(page, { label: `${screen}@${vp.name}` });
    await page.waitForTimeout(3400);   // past the hint fade and the bar tweens
    const shot = `${OUT}/_raw/${vp.name}-${screen}.png`;
    await captureSettled(page, { path: shot, label: `${screen}@${vp.name}`, tool: 'ue_shoot' });
    const rects = await page.evaluate(readRects, ELEMENTS[screen]);
    vres.screens[screen] = { png: shot, rects };
    const missing = Object.entries(rects).filter(([, v]) => !v.found).map(([k]) => k);
    console.log(`\n[${vp.name} ${vp.w}x${vp.h}] ${screen.padEnd(12)} ${Object.keys(rects).length} elements, ${missing.length} MISSING${missing.length ? ': ' + missing.join(', ') : ''}`);
    for (const [k, v] of Object.entries(rects)) {
      if (!v.found) continue;
      console.log(`   ${k.padEnd(18)} ${String(v.css.w).padStart(6)}x${String(v.css.h).padEnd(6)} css -> ${String(Math.round(v.css.w * vp.dsf)).padStart(5)}x${String(Math.round(v.css.h * vp.dsf)).padEnd(5)} device  ar ${(v.css.w / v.css.h).toFixed(2)}  [${v.used}/${v.found}]`);
    }
  }
  result.viewports[vp.name] = vres;
  await page.close();
}
await browser.close();
await writeFile(`${OUT}/_raw/ours.json`, JSON.stringify(result, null, 2));
console.log(`\nwrote ${OUT}/_raw/ours.json`);
