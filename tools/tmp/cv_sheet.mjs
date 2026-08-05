#!/usr/bin/env node
/**
 * CV SHEET — the four rendered panels, annotated, on one page Uri can decide from.
 *
 * Every pixel coordinate this file draws with came out of `cv_render.mjs`, projected by
 * the SHIPPED camera's own matrices (`Vector3.project`). Nothing here re-derives a
 * transform, because `docs/LESSONS.md` §6 records two agents getting exactly that
 * arithmetic wrong on this camera. The dimension arrows therefore land on the rendered
 * white footprint outline; if a label and its outline ever disagree in the output, the
 * projection is wrong and the sheet says so by simply looking wrong.
 *
 *   node tools/tmp/cv_sheet.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const OUT = 'shots/conceal';
const D = JSON.parse(readFileSync(`${OUT}/panels.json`, 'utf8'));
const ARENA = JSON.parse(readFileSync('tools/arena.gameplay.json', 'utf8'));

const K = 0.75;                       // panel render scale, 1600x900 -> 1200x675
const PW = Math.round(D.W * K), PH = Math.round(D.H * K);
const CAP = 104;                      // caption bar height above each panel
const GUT = 22;
const SHEET_W = PW * 2 + GUT * 3;
const HEAD = 268;
const FOOT = 552;
const SHEET_H = HEAD + (CAP + PH + GUT) * 2 + FOOT;

const BG = '#0C0D14';
const INK = '#F4F6FB';
const DIM = '#98A0B4';
const OK = '#3BE08A';
const WARN = '#FFC24A';
const BAD = '#FF5560';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svg = (w, h, body) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  + `<style>text{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}</style>${body}</svg>`);

// The field's total ground area against the single 300 mass. Computed, not asserted:
// an earlier draft's caption said "the same hiding area" and it is 80%, not 100%.
/**
 * The largest axis-aligned square in the shipped kitchen that is clear of cover AND
 * outside the endgame keep-out, on a 5 wu lattice. Computed here rather than quoted,
 * because it is the fact that decides whether the AI's 168 wu limit costs anything:
 * if the map already caps a patch below the limit, the limit is free.
 */
function largestLegalSquare() {
  const step = 5;
  const halfDiag = Math.hypot(ARENA.width / 2, ARENA.height / 2);
  const maxSafe = Math.round(halfDiag / (1 - 6000 / 45000));   // arena/shared.ts formula
  const keepout = Math.max(120, maxSafe * 0.25);               // rules.ts concealmentKeepoutRadius
  const nx = Math.floor(ARENA.width / step) + 1;
  const ny = Math.floor(ARENA.height / step) + 1;
  const blocked = (x, y) => ARENA.cover.some((c) => Math.abs(x - c.x) < c.w / 2 && Math.abs(y - c.y) < c.h / 2)
    || Math.hypot(x - ARENA.center.x, y - ARENA.center.y) < keepout;
  const dp = [];
  let best = 0, bi = 0, bj = 0;
  for (let i = 0; i < nx; i++) {
    dp.push(new Int32Array(ny));
    for (let j = 0; j < ny; j++) {
      if (blocked(i * step, j * step)) { dp[i][j] = 0; continue; }
      dp[i][j] = (i === 0 || j === 0) ? 1 : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      if (dp[i][j] > best) { best = dp[i][j]; bi = i; bj = j; }
    }
  }
  const side = (best - 1) * step;
  return { side, cx: Math.round(bi * step - side / 2), cy: Math.round(bj * step - side / 2), keepout };
}
const LEGAL = largestLegalSquare();

const fieldPct = Math.round(D.results.d.patches.reduce((a, p) => a + p.s * p.s, 0) / (300 * 300) * 100);
const f = D.results.a.fair;
const FRAME_W_WU = f.halfWidthUnits * 2;
const FRAME_D_WU = f.nearUnits + f.farUnits;

// ─────────────────────────────────────────────────────────────────────────────
// Per-panel annotation, drawn over the resized render
// ─────────────────────────────────────────────────────────────────────────────

/** Double-headed dimension arrow between two projected points, label offset along it. */
function dimArrow(a, b, label, colour, dy, labelT) {
  const ax = a[0] * K, ay = a[1] * K + dy;
  const bx = b[0] * K, by = b[1] * K + dy;
  const t = labelT ?? 0.5;
  const lx = ax + (bx - ax) * t, ly = ay + (by - ay) * t;
  const nx = (by - ay), ny = -(bx - ax);
  const nl = Math.hypot(nx, ny) || 1;
  const tick = 13;
  return `
    <g stroke="${colour}" stroke-width="3.4" fill="none" stroke-linecap="round">
      <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>
      <line x1="${ax - nx / nl * tick}" y1="${ay - ny / nl * tick}" x2="${ax + nx / nl * tick}" y2="${ay + ny / nl * tick}"/>
      <line x1="${bx - nx / nl * tick}" y1="${by - ny / nl * tick}" x2="${bx + nx / nl * tick}" y2="${by + ny / nl * tick}"/>
    </g>
    <g>
      <rect x="${lx - 62}" y="${ly - 21}" width="124" height="40" rx="9" fill="#0C0D14" opacity="0.86"/>
      <text x="${lx}" y="${ly + 8}" text-anchor="middle" font-size="26" font-weight="700" fill="${colour}">${esc(label)}</text>
    </g>`;
}

function calloutBox(x, y, w, lines, colour, leader) {
  const lh = 27;
  const h = 20 + lines.length * lh;
  let t = '';
  lines.forEach((ln, i) => {
    t += `<text x="${x + 16}" y="${y + 31 + i * lh}" font-size="${i === 0 ? 22 : 20}" `
      + `font-weight="${i === 0 ? 700 : 400}" fill="${i === 0 ? colour : INK}">${esc(ln)}</text>`;
  });
  const line = leader
    ? `<line x1="${x + w}" y1="${y + 14}" x2="${leader[0]}" y2="${leader[1]}" stroke="${colour}" stroke-width="2.4" stroke-dasharray="7 5"/>`
      + `<circle cx="${leader[0]}" cy="${leader[1]}" r="5" fill="${colour}"/>` : '';
  return `${line}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#0C0D14" opacity="0.92" stroke="${colour}" stroke-width="2"/>${t}`;
}

function annotate(id) {
  const r = D.results[id];
  const p = r.patches[0];
  let s = '';

  // The dimension arrow runs along the patch's NEAR (south) edge — the edge the
  // character is standing on — so the label sits on the geometry it measures.
  s += dimArrow(p.quad[3], p.quad[2], `${p.s} wu`, id === 'c' ? BAD : (id === 'b' ? WARN : OK), 34, 0.26);

  // The character, at its real size, is the only scale reference that needs no words.
  const feet = D.results.a.charBox
    ? [D.results.a.charBox.bbox[0] * K, D.results.a.charBox.bbox[3] * K]
    : [r.player.feet[0] * K, r.player.feet[1] * K];
  const cb = D.results.a.charBox;
  if (cb) {
    const x0 = cb.bbox[0] * K - 8, y0 = cb.bbox[1] * K - 6;
    const w = (cb.bbox[2] - cb.bbox[0]) * K + 16, h = (cb.bbox[3] - cb.bbox[1]) * K + 12;
    const lx = x0 + w + 74;
    s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="6" fill="none" stroke="${INK}" stroke-width="2.4" stroke-dasharray="6 5"/>`;
    s += `<line x1="${x0 + w}" y1="${y0 + h / 2}" x2="${lx}" y2="${y0 + h / 2}" stroke="${INK}" stroke-width="2"/>`;
    s += `<rect x="${lx - 2}" y="${y0 + h / 2 - 27}" width="252" height="54" rx="9" fill="#0C0D14" opacity="0.9"/>`;
    s += `<text x="${lx + 12}" y="${y0 + h / 2 - 4}" font-size="21" font-weight="700" fill="${INK}">the player</text>`;
    s += `<text x="${lx + 12}" y="${y0 + h / 2 + 19}" font-size="19" fill="${DIM}">42 wu wide · 2.1 m tall</text>`;
  }

  // All four callouts sit in the same empty bottom-left corner, so the eye finds them
  // in the same place in every panel and none of them covers the thing it describes.
  const CY = PH - 200, CX = 18, CW = 560;
  if (id === 'c') {
    const q = p.coreQuad;
    s += calloutBox(CX, CY, CW, [
      `RED = DEAD GROUND, ${p.core} × ${p.core} wu`,
      'Every point in it is more than 84 wu from an edge, so an',
      'enemy that walks in can never see it. Stand there and stay',
      'still and the AI is broken for the rest of the match.',
    ], BAD, [(q[3][0] + q[2][0]) / 2 * K, (q[3][1] + q[2][1]) / 2 * K]);
  }
  if (id === 'b') {
    s += calloutBox(CX, CY, CW, [
      'AT THE LIMIT — the dead square is exactly zero',
      'No point in a 168 wu patch is further than 84 wu from an',
      'edge, so every part of it is still reachable by the AI.',
    ], WARN);
  }
  if (id === 'a') {
    s += calloutBox(CX, CY, CW, [
      'COMFORTABLY INSIDE THE LIMIT',
      'Just under 3 characters wide. Big enough to duck into,',
      'small enough that the AI always works out where you went.',
    ], OK);
  }
  if (id === 'd') {
    s += calloutBox(CX, CY, CW, [
      `FIVE SMALL PATCHES — ${fieldPct}% of the 300's area`,
      'Every one is AI-legal, and the reference game delivers its',
      'cover exactly this way: dozens of small objects rather than',
      'two or three big masses. Our arena has ~2 per frame today.',
    ], OK);
  }
  return svg(PW, PH, s);
}

// ─────────────────────────────────────────────────────────────────────────────
// The arena plan — the same geometry from above, so "how much of the map is this"
// has an answer that does not depend on the reader's imagination.
// ─────────────────────────────────────────────────────────────────────────────
function arenaPlan(w, h) {
  const sp = Math.min(w / ARENA.width, h / ARENA.height);
  const ox = (w - ARENA.width * sp) / 2, oy = (h - ARENA.height * sp) / 2;
  const X = (x) => ox + x * sp, Y = (y) => oy + y * sp;
  let s = `<rect x="${X(0)}" y="${Y(0)}" width="${ARENA.width * sp}" height="${ARENA.height * sp}" rx="6" fill="#1A1D28" stroke="#3A4054" stroke-width="2"/>`;
  for (const c of ARENA.cover) {
    s += `<rect x="${X(c.x - c.w / 2)}" y="${Y(c.y - c.h / 2)}" width="${c.w * sp}" height="${c.h * sp}" fill="#5A6180"/>`;
  }
  // The visible screen, centred on the player, in world units.
  s += `<rect x="${X(D.PX - FRAME_W_WU / 2)}" y="${Y(D.PY - FRAME_D_WU / 2)}" width="${FRAME_W_WU * sp}" height="${FRAME_D_WU * sp}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-dasharray="7 5"/>`;
  // Panel D's field (legal) and panel C's single mass (illegal), at their real sizes.
  for (const p of D.results.d.patches) {
    s += `<rect x="${X(p.x - p.s / 2)}" y="${Y(p.y - p.s / 2)}" width="${p.s * sp}" height="${p.s * sp}" fill="${OK}" opacity="0.55" stroke="${OK}" stroke-width="1.6"/>`;
  }
  const c = D.results.c.patches[0];
  s += `<rect x="${X(c.x - c.s / 2)}" y="${Y(c.y - c.s / 2)}" width="${c.s * sp}" height="${c.s * sp}" fill="none" stroke="${BAD}" stroke-width="2.6" stroke-dasharray="8 6"/>`;
  s += `<rect x="${X(c.x - c.core / 2)}" y="${Y(c.y - c.core / 2)}" width="${c.core * sp}" height="${c.core * sp}" fill="${BAD}" opacity="0.6"/>`;
  s += `<circle cx="${X(D.PX)}" cy="${Y(D.PY)}" r="4.5" fill="#FFD84A"/>`;
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemble
// ─────────────────────────────────────────────────────────────────────────────
const CAPTIONS = {
  a: ['120 wu — SAFE', 'Well inside the AI limit', OK],
  b: ['168 wu — THE LIMIT', 'The largest patch the AI can still work', WARN],
  c: ['300 wu — OVER THE LIMIT', 'Breaks the AI, and its far edge is off the top of the frame', BAD],
  d: ['A FIELD OF SMALL ONES', '5 × 110–130 wu — the recommended shape', OK],
};

const panels = [];
for (const id of ['a', 'b', 'c', 'd']) {
  const img = await sharp(`${OUT}/panel_${id}.png`).resize(PW, PH).composite([{ input: annotate(id), top: 0, left: 0 }]).png().toBuffer();
  const [t, sub, col] = CAPTIONS[id];
  const bar = svg(PW, CAP,
    `<rect width="${PW}" height="${CAP}" fill="#151824"/>`
    + `<rect width="9" height="${CAP}" fill="${col}"/>`
    + `<text x="30" y="45" font-size="34" font-weight="800" fill="${col}">${esc(t)}</text>`
    + `<text x="30" y="80" font-size="24" fill="${DIM}">${esc(sub)}</text>`
    + `<text x="${PW - 26}" y="45" text-anchor="end" font-size="22" fill="${DIM}">shipped match framing · 1600×900 · unmodified camera</text>`
    + `<text x="${PW - 26}" y="80" text-anchor="end" font-size="22" fill="${DIM}">visible ground ${FRAME_W_WU.toFixed(0)} × ${FRAME_D_WU.toFixed(0)} wu</text>`);
  panels.push(await sharp({ create: { width: PW, height: CAP + PH, channels: 4, background: BG } })
    .composite([{ input: bar, top: 0, left: 0 }, { input: img, top: CAP, left: 0 }]).png().toBuffer());
}

const header = svg(SHEET_W, HEAD,
  `<rect width="${SHEET_W}" height="${HEAD}" fill="${BG}"/>`
  + `<text x="${GUT}" y="62" font-size="50" font-weight="800" fill="${INK}">How big can a kitchen hiding place be?</text>`
  + `<text x="${GUT}" y="106" font-size="27" fill="${DIM}">Plates, trays and crates you can duck under — rendered in the real match, at the real camera, with the real character for scale.</text>`
  + `<text x="${GUT}" y="164" font-size="26" fill="${INK}">The enemy AI has <tspan font-weight="700">no search behaviour</tspan>. It walks to where it last saw you, stops, and can see <tspan font-weight="700" fill="${WARN}">84 wu</tspan> from there.</text>`
  + `<text x="${GUT}" y="200" font-size="26" fill="${INK}">So any patch wider than <tspan font-weight="700" fill="${WARN}">168 wu</tspan> has an interior it can never reach — stand still in there and the enemy is broken for the rest of the match.</text>`
  + `<text x="${GUT}" y="240" font-size="24" fill="${DIM}">Measured both ways: at half that radius the AI re-acquires; at double it never does (final separation 363 wu, never sighted).</text>`);

const plan = arenaPlan(470, 320);
const TX = GUT + 600;
const footer = svg(SHEET_W, FOOT,
  `<rect width="${SHEET_W}" height="${FOOT}" fill="${BG}"/>`
  + `<rect x="${GUT}" y="10" width="${SHEET_W - GUT * 2}" height="2" fill="#262B3A"/>`
  + `<g transform="translate(${GUT},26)">${plan}</g>`
  + `<text x="${GUT}" y="378" font-size="21" fill="${INK}">The whole kitchen, 1400 × 1000 wu.</text>`
  + `<text x="${GUT}" y="406" font-size="20" fill="${DIM}">Grey = solid cover · green = the five legal patches</text>`
  + `<text x="${GUT}" y="432" font-size="20" fill="${DIM}">dashed red = the 300 and its dead core</text>`
  + `<text x="${GUT}" y="458" font-size="20" fill="${DIM}">dashed white = what one screen shows</text>`
  + `<text x="${TX}" y="58" font-size="30" font-weight="800" fill="${INK}">What this image proves</text>`
  + `<text x="${TX}" y="98" font-size="23" fill="${INK}">· The scale is the renderer's, not mine. The camera sits at exactly px × WORLD_SCALE, and the</text>`
  + `<text x="${TX}" y="128" font-size="23" fill="${INK}">  character measures ${D.results.a.charBox.h} px of 900 = ${D.results.a.charBox.heightPct}% of frame height — the shipped band is 10.6–12.6%.</text>`
  + `<text x="${TX}" y="158" font-size="23" fill="${INK}">· The patches are real meshes at real world coordinates, projected by the game's own camera.</text>`
  + `<text x="${TX}" y="188" font-size="23" fill="${INK}">  Nothing is composited on: the dimension arrows land on the rendered white outlines.</text>`
  + `<text x="${TX}" y="218" font-size="23" fill="${INK}">· 120 wu = ${(120 / FRAME_W_WU * 100).toFixed(0)}% of the visible width · 168 wu = ${(168 / FRAME_W_WU * 100).toFixed(0)}% · 300 wu = ${(300 / FRAME_W_WU * 100).toFixed(0)}% of it and ${(300 / FRAME_D_WU * 100).toFixed(0)}% of the visible depth.</text>`
  + `<text x="${TX}" y="248" font-size="23" fill="${OK}">· AND THE MAP ALREADY CAPS YOU BELOW 300. The largest square anywhere in this kitchen that is</text>`
  + `<text x="${TX}" y="278" font-size="23" fill="${OK}">  clear of cover and outside the ${LEGAL.keepout.toFixed(0)} wu endgame keep-out is ${LEGAL.side} wu, jammed against the west wall.</text>`
  + `<text x="${TX}" y="308" font-size="23" fill="${OK}">  So the AI's 168 wu limit is giving up much less than the number makes it sound like.</text>`
  + `<text x="${TX}" y="360" font-size="30" font-weight="800" fill="${INK}">What it does not</text>`
  + `<text x="${TX}" y="400" font-size="23" fill="${INK}">· The plates, trays and crates are a MOCK built for this image — the arena's own materials and</text>`
  + `<text x="${TX}" y="430" font-size="23" fill="${INK}">  lighting, but no arena ships a concealment region yet, so this is not shipped art.</text>`
  + `<text x="${TX}" y="460" font-size="23" fill="${INK}">· It says nothing about whether hiding is FUN — only how much room the AI constraint leaves.</text>`
  + `<text x="${TX}" y="490" font-size="23" fill="${WARN}">· Attacking destroys the object you hid under (your §29c answer). That punishes a camper who</text>`
  + `<text x="${TX}" y="520" font-size="23" fill="${WARN}">  shoots — but a player who hides in the red square and never attacks still breaks the AI.</text>`);

await sharp({ create: { width: SHEET_W, height: SHEET_H, channels: 4, background: BG } })
  .composite([
    { input: header, top: 0, left: 0 },
    { input: panels[0], top: HEAD, left: GUT },
    { input: panels[1], top: HEAD, left: GUT * 2 + PW },
    { input: panels[2], top: HEAD + CAP + PH + GUT, left: GUT },
    { input: panels[3], top: HEAD + CAP + PH + GUT, left: GUT * 2 + PW },
    { input: footer, top: HEAD + (CAP + PH + GUT) * 2, left: 0 },
  ]).png().toFile(`${OUT}/concealment-scale.png`);

console.log(`wrote ${OUT}/concealment-scale.png  ${SHEET_W}x${SHEET_H}`);
