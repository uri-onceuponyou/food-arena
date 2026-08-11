#!/usr/bin/env node
/**
 * SX_FOG — DOES THE SUDDEN-DEATH CANOPY ACTUALLY REACH THE WHOLE ×4 ARENA?
 *
 * `779dc62` fixed the fog rendering as literally nothing at radius 0 (`> 0` → `>= 0`), proved
 * against the old build as a known-bad by `mg_fog.mjs`. That fix is not in question here and is
 * re-confirmed below as this file's POSITIVE CONTROL.
 *
 * The question is the one its own commit message answers by arithmetic rather than by pixels:
 *
 *   > *"the canopy's outer ring is `max(FIELD_OUTER_UNITS, r + 200)` = 1500 wu, which covers
 *   > every corner of a 2800x2000 map."*
 *
 * 🚨 **A 2800×2000 rectangle has a half-diagonal of 1720.5 wu.** `fogRing.ts:207` still says, in
 * the constant's own comment, *"The arena's half-diagonal is ~860, so this covers every corner"*
 * — 860.2 is the **1400×1000** half-diagonal. The constant and its justification are one map
 * generation old, which is `DECISIONS §60`'s "a green fixture testing something nobody chose",
 * except in shipped source rather than in a test.
 *
 * ── HOW IT ASKS ─────────────────────────────────────────────────────────────
 *
 * A 2×3 grid: {sudden death, wide ring} × {centre, mid, corner}, with `?px=/?py=` placing the
 * LOCAL seat — the seat the camera follows — at a chosen distance from the arena centre. Mean
 * luma of the **canvas only** (`renderer.domElement.toDataURL`, so no HUD, no CSS keyframe:
 * `AGENT-BRIEF` §3's "a `position: fixed` HUD keyframe lands inside every PNG you think is the
 * canvas").
 *
 * ⚠️ **`&simSpeed=0.05` is load-bearing, not tidiness**, and it is `779dc62`'s own hard-won
 * lesson: sudden death does 50 HP/s to everyone, so at real speed the match ENDS within ~2 s —
 * and the boundary's `active` flag is `phase === 'playing'`, so it correctly fades out. A
 * harness that captures too late measures an ENDED match and agrees with itself about the wrong
 * frame. `__matchDebug.paused` is also set before the capture.
 *
 * ── THE CONTROLS ────────────────────────────────────────────────────────────
 *
 *   POSITIVE  `centre`: sudden death must be dramatically darker than the wide ring. This is the
 *             proof the instrument can see the canopy at all. If it fails, every other row here
 *             is void and is printed as such.
 *   NEGATIVE  the wide-ring arm at every position must be BRIGHT and roughly equal, i.e. the
 *             three positions are not intrinsically different in brightness. Without it, "the
 *             corner is dark/bright" could be about the apron rather than about the fog.
 *
 *   node tools/tmp/sx_fog.mjs --url '{URL}' --out shots/sx/fog
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('--out', `${ROOT}/shots/sx/fog`));

const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'pizza'];
const FIGHTERS = encodeURIComponent(CAST.join(';'));

/** Positions for the LOCAL seat, by distance from the arena centre (1400,1000) on the ×4 map.
 *  `corner` is the extreme a fighter can actually reach: the bounds clamp is the arena rect
 *  inset by PLAYER_SIZE/2, so (40,40) is legal ground and 1691.4 wu from centre. */
const POS = [
  { id: 'centre', px: 1400, py: 1400 },   //  400.0 wu — deep inside FIELD_OUTER_UNITS
  { id: 'mid', px: 400, py: 400 },        // 1166.2 wu — still inside
  { id: 'corner', px: 40, py: 40 },       // 1691.4 wu — OUTSIDE 1500
];
const FOG = [
  { id: 'sd', q: '&fogRadius=0' },        // sudden death: the ring is 0, everything is lethal
  { id: 'wide', q: '&fogRadius=1900' },   // a ring beyond every one of these positions
];

async function cell(browser, pos, fog) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const warn = [];
  page.on('console', (m) => { if (/QA|fog/i.test(m.text())) warn.push(m.text().slice(0, 140)); });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},decline(){},data:{}});export const injectQuery=(u)=>u;export const updateStyle=()=>{};export const removeStyle=()=>{};export const ErrorOverlay=class{};export default {};' }));
  const url = `${BASE}/?fighters=${FIGHTERS}&px=${pos.px}&py=${pos.py}&pointerLock=0&simSpeed=0.05${fog.q}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  await page.waitForTimeout(1400);
  const info = await page.evaluate(`(() => {
    const d = window.__matchDebug; if (d) d.paused = true;
    const st = (window.__stages || []).filter((s) => !s.disposed)[0];
    let fog = null; st.scene.traverse((o) => { if (!fog && o.name === 'fog_boundary') fog = o; });
    const f = window.__vfxDebugFighters?.slots?.[0] ?? null;
    const a = window.__matchArena;
    return {
      phase: d ? d.phase : null,
      fogInScene: !!fog, fogVisible: fog ? fog.visible : null,
      fogChildrenVisible: fog ? fog.children.filter((c) => c.visible).length : -1,
      me: f ? { x: Math.round(f.x), y: Math.round(f.y), hp: f.hp } : null,
      distFromCentre: f && a ? Math.round(Math.hypot(f.x - a.center.x, f.y - a.center.y)) : null,
      arena: a ? { w: a.width, h: a.height, cx: a.center.x, cy: a.center.y } : null,
      zone: document.querySelector('[data-el="zone-label"]')?.textContent ?? null,
    };
  })()`);
  const png = Buffer.from((await page.evaluate(`(() => {
    const st = (window.__stages || []).filter((s) => !s.disposed)[0];
    return st.renderer.domElement.toDataURL('image/png');
  })()`)).split(',')[1], 'base64');
  // A SECOND capture WITH the HUD, for a different question the canvas cannot answer:
  // what does the zone pill say during sudden death with a LIVING local seat? `renderZone`
  // gates its danger branch on `localFighter(state).alive`, and in a real match slot 0 is
  // usually dead by 30 s — so this QA path is the only reliable way to photograph it.
  const hudPng = await page.screenshot().catch(() => null);
  const hudText = await page.evaluate(`(() => ({
    label: document.querySelector('[data-el="zone-label"]')?.textContent ?? null,
    value: document.querySelector('[data-el="zone-value"]')?.textContent ?? null,
    danger: !!document.querySelector('[data-el="zone"]')?.classList.contains('is-danger'),
    timer: document.querySelector('[data-el="timer"]')?.textContent ?? null,
    barW: document.querySelector('[data-el="zone-bar"]')?.style.width ?? null,
  }))()`).catch(() => null);
  await ctx.close();
  return { info: { ...info, hud: hudText }, png, hudPng, warn };
}

async function meanLuma(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let s = 0;
  const px = info.width * info.height;
  for (let i = 0; i < px; i++) s += 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  return s / px;
}

if (IS_MAIN) {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const rows = [];
  try {
    for (const p of POS) for (const f of FOG) {
      const r = await cell(browser, p, f);
      const L = await meanLuma(r.png);
      const file = join(OUT, `${p.id}_${f.id}.png`);
      writeFileSync(file, r.png);
      if (r.hudPng) writeFileSync(join(OUT, `${p.id}_${f.id}_hud.png`), r.hudPng);
      rows.push({ pos: p.id, fog: f.id, luma: L, file, ...r.info });
    }
  } finally { await browser.close(); }

  console.log('\n══ SX_FOG — does the sudden-death canopy reach the ×4 arena\'s corners? ══');
  console.log(`arena ${rows[0].arena?.w}×${rows[0].arena?.h}  half-diagonal `
    + `${Math.hypot(rows[0].arena.w / 2, rows[0].arena.h / 2).toFixed(1)} wu  ·  fogRing FIELD_OUTER_UNITS = 1500 wu (source constant)`);
  console.log(`\n   position   dist   fog     mean luma   phase     fog children visible`);
  for (const r of rows) {
    console.log(`   ${r.pos.padEnd(9)} ${String(r.distFromCentre).padStart(5)}  ${r.fog.padEnd(5)}  `
      + `${r.luma.toFixed(1).padStart(9)}   ${String(r.phase).padEnd(9)} ${r.fogChildrenVisible}`);
  }
  console.log(`\n   WHAT THE HUD SAYS (local seat ALIVE — the state a real match rarely reaches at 30 s):`);
  for (const r of rows) {
    console.log(`   ${r.pos.padEnd(9)} ${r.fog.padEnd(5)}  clock ${String(r.hud?.timer).padEnd(6)} bar ${String(r.hud?.barW).padEnd(7)}`
      + ` danger ${String(r.hud?.danger).padEnd(6)} "${r.hud?.label} / ${r.hud?.value}"`);
  }
  let pass = 0, fail = 0, voided = false;
  const ok = (l, c, d = '') => { if (c) { pass++; console.log(`  ok   - ${l}${d ? `   ${d}` : ''}`); } else { fail++; console.log(`  FAIL - ${l}${d ? `\n         ${d}` : ''}`); } };
  const at = (p, f) => rows.find((r) => r.pos === p && r.fog === f);
  const drop = (p) => at(p, 'wide').luma - at(p, 'sd').luma;

  console.log('');
  const centreDrop = drop('centre');
  ok('POSITIVE CONTROL: at the centre, sudden death darkens the frame', centreDrop > 20,
    `luma ${at('centre', 'wide').luma.toFixed(1)} → ${at('centre', 'sd').luma.toFixed(1)} (drop ${centreDrop.toFixed(1)})`);
  if (centreDrop <= 20) { voided = true; console.log('         🚨 the instrument cannot see the canopy — every row below is VOID'); }
  const wideSpread = Math.max(...POS.map((p) => at(p.id, 'wide').luma)) - Math.min(...POS.map((p) => at(p.id, 'wide').luma));
  console.log(`  note   - NEGATIVE CONTROL: wide-ring luma spread across the three positions is ${wideSpread.toFixed(1)}`
    + ` (${POS.map((p) => `${p.id} ${at(p.id, 'wide').luma.toFixed(1)}`).join(', ')})`);
  ok('the corner is covered as thoroughly as the centre', drop('corner') > centreDrop * 0.8,
    `centre drop ${centreDrop.toFixed(1)} · mid ${drop('mid').toFixed(1)} · CORNER ${drop('corner').toFixed(1)}`);

  writeFileSync(join(OUT, 'fog.json'), JSON.stringify(rows, null, 1));
  console.log(`\n   PNGs in ${OUT} — READ THEM. ${voided ? '(void)' : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
