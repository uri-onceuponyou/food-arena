#!/usr/bin/env node
/**
 * LK1_AREA — DELIVERED PIXEL AREA of a named part of a character, at BOTH shipped
 * cameras, by same-frame ablation.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `docs/AGENT-BRIEF.md` §4.6 and `pj_probe`'s own record: *"the tomato was not a hue
 * collision but an AREA one — 36 px against 686"*. A garnish can be authored, correct,
 * committed, and effectively invisible. Nothing in this repo reported the delivered
 * area of one named mesh on one character at the LOBBY camera, which is where Uri
 * looks; `valuescan` measures pitch 58 and `docs/TOOLS.md` records it as *"structurally
 * blind to anything the lobby frames"*.
 *
 * It is also the diagnosis instrument: soup's broth carried a `BROTH_DARK` depth ring
 * and three green garnish specks whose comment says they stop the broth reading as
 * *"a flat orange disc"*, and the shipped lobby capture is a flat orange disc.
 * "Is it there?" and "is it DELIVERING PIXELS?" are different questions.
 *
 * ── Method ───────────────────────────────────────────────────────────────────
 * One page, one frozen frame per arm. Capture shipped -> hide the target set ->
 * capture again -> the differing pixels ARE the target's delivered area, and their
 * colour is read out of the SHIPPED frame (never the ablated one), so what is
 * reported is the pixels a player sees, under the shipped lighting and post chain.
 * Same ablation shape `pj_probe` / `p2_bgcross` / `n2_probe` use.
 *
 * `--hidemat` exists because an UNNAMED mesh is invisible to every diagnostic here
 * (`AGENT-BRIEF` §3) and soup's garnish specks shipped unnamed — so the BEFORE arm
 * cannot address them by name. Matching on the material's own hex addresses them
 * without editing the tree being measured.
 *
 * ── CONTROLS (an instrument not shown to FAIL on a known input is not an instrument)
 *   PAIR      two captures of one frozen station must differ by EXACTLY 0 px. Camera
 *             shake re-randomises on every render (`AGENT-BRIEF` §3); if this station
 *             drifts, every area below is noise.
 *   NONEMPTY  the character mask must be > 0 px BEFORE any per-part number is quoted.
 *             `[].every()` returns true and a ratio over an empty set is not a result.
 *   MATCHED   🚨 THE LOAD-BEARING ONE. A selector that matched ZERO objects delivers
 *             zero pixels, and that is indistinguishable from a mesh that renders
 *             nothing — the exact vacuity `CLAUDE.md` §6 lists three times. Every row
 *             prints `matched`, and a row with matched=0 is reported NO-MATCH, never
 *             `0 px`.
 *   KB-MISS   known-bad: a selector that cannot match (`lk1_no_such_mesh`) must be
 *             reported NO-MATCH and must NOT be reported as an area of 0.
 *   KB-SEEN   known-bad: `soup_broth` — a mesh known to cover most of the bowl — must
 *             deliver > 1000 px at the lobby. If the ablation cannot see THAT, it
 *             cannot see anything, and a garnish reading 0 px means nothing.
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- \
 *     node tools/tmp/lk1_area.mjs --url {URL} --id soup --hide soup_broth,soup_broth_ring
 *   node tools/tmp/lk1_area.mjs --url $U --id soup --selftest
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', '')).replace(/\/$/, '');
const ID = get('--id', 'soup');
/** `--hide a,b;c;d` — SEMICOLON separates independent target sets, comma groups one. */
const HIDE = get('--hide', '').split(';').map((g) => g.split(',').map((s) => s.trim()).filter(Boolean)).filter((g) => g.length);
const HIDEMAT = get('--hidemat', '').split(',').map((s) => s.trim().replace(/^#/, '').toLowerCase()).filter(Boolean);
const SELFTEST = a.includes('--selftest');
const JSON_OUT = get('--json', null);
const W = 900, H = 1150;

if (!BASE) { console.error('lk1_area: need PREVIEW_BASE or --url'); process.exit(2); }

/**
 * The two shipped cameras, and the third is the lobby three-quarter where every one
 * of Uri's reject sheets was framed. `charStage.ts:451` is pitch 20; `camera.ts`
 * defaults the match to 58 and the shipped spawn facing is yaw 90.
 */
const STATIONS = [
  { tag: 'lobby_yaw0', pitch: 20, yaw: 0 },
  { tag: 'lobby_yaw35', pitch: 20, yaw: 35 },
  { tag: 'match_yaw90', pitch: 58, yaw: 90 },
];

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });

async function openStation(st) {
  const url = `${BASE}/preview.html?piece=character&id=${ID}&pitch=${st.pitch}&yaw=${st.yaw}`
    + `&t=1.5&anim=idle&shot=1`;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });
  await page.evaluate(() => {
    // Freeze deterministically: the shipped stage may keep a rAF loop, and a second
    // render with camera shake live is a DIFFERENT camera (AGENT-BRIEF §3).
    const s = window.__stage;
    if (s.rig && s.rig.shake) { try { s.rig.shake.set(0, 0, 0); } catch { /* not a vector */ } }
    s.scene.updateMatrixWorld(true);
    s.render(0);
  });
  return page;
}

/** Hide by stripped base NAME or by material hex. Returns how many objects matched. */
async function setHidden(page, names, mats, hidden) {
  return page.evaluate(({ names, mats, hidden }) => {
    const s = window.__stage;
    const base = (n) => String(n || '').replace(/__(no_)?outline$/, '');
    let matched = 0;
    s.scene.traverse((o) => {
      if (!o.isMesh) return;
      const byName = names.length && names.includes(base(o.name));
      const hex = o.material && o.material.color ? o.material.color.getHexString().toLowerCase() : null;
      const byMat = mats.length && hex && mats.includes(hex);
      if (!byName && !byMat) return;
      o.visible = !hidden;
      matched++;
    });
    s.scene.updateMatrixWorld(true);
    s.render(0);
    return matched;
  }, { names, mats, hidden });
}

async function shot(page) { return page.locator('canvas').first().screenshot(); }
const raw = (buf) => sharp(buf).raw().toBuffer({ resolveWithObject: true });

function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** Differing pixels between two frames, plus the SHIPPED frame's stats over them. */
async function delta(shipped, ablated) {
  const [A, B] = await Promise.all([raw(shipped), raw(ablated)]);
  const ch = A.info.channels;
  let n = 0, sr = 0, sg = 0, sb = 0, sl = 0, shl = 0;
  const hx = [], hy = [];
  for (let i = 0; i < A.data.length; i += ch) {
    if (A.data[i] === B.data[i] && A.data[i + 1] === B.data[i + 1] && A.data[i + 2] === B.data[i + 2]) continue;
    const r = A.data[i] / 255, g = A.data[i + 1] / 255, b = A.data[i + 2] / 255;
    n++; sr += r; sg += g; sb += b;
    sl += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // HSL lightness as well as luma, and they are NOT interchangeable here: the
    // p2_bgcross correlation that governs projectile legibility (-0.738) is against
    // HSL LIGHTNESS, while fusion against the cream rim is a LUMA question. For a
    // yellow the two differ by ~0.2.
    shl += (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    const h = hueOf(r, g, b) * Math.PI / 180;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    hx.push(Math.cos(h) * sat); hy.push(Math.sin(h) * sat);
  }
  if (!n) return { n: 0 };
  const HX = hx.reduce((p, c) => p + c, 0) / n, HY = hy.reduce((p, c) => p + c, 0) / n;
  let hue = Math.atan2(HY, HX) * 180 / Math.PI; if (hue < 0) hue += 360;
  const to8 = (v) => Math.round((v / n) * 255);
  return {
    n,
    hex: '#' + [to8(sr), to8(sg), to8(sb)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(),
    luma: +(sl / n).toFixed(4),
    hsl: +(shl / n).toFixed(4),
    hue: +hue.toFixed(1),
    sat: +(Math.hypot(HX, HY)).toFixed(4),
  };
}

/** Byte-exact difference count, for PAIR. */
async function diffPx(A, B) {
  const [ra, rb] = await Promise.all([raw(A), raw(B)]);
  const ch = ra.info.channels;
  let d = 0;
  for (let i = 0; i < ra.data.length; i += ch) {
    if (ra.data[i] !== rb.data[i] || ra.data[i + 1] !== rb.data[i + 1] || ra.data[i + 2] !== rb.data[i + 2]) d++;
  }
  return d;
}

const rows = [];
let fails = 0;
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const pass = (m) => console.log(`  ✓ ${m}`);

for (const st of STATIONS) {
  console.log(`\n── ${st.tag}  pitch ${st.pitch} yaw ${st.yaw} ──`);
  const page = await openStation(st);

  // PAIR — one frozen station, two captures, byte-exact.
  const s1 = await shot(page);
  const s2 = await shot(page);
  const pair = await diffPx(s1, s2);
  if (pair === 0) pass(`PAIR  0 px drift`); else fail(`PAIR  ${pair} px of drift — every area below is noise`);

  // NONEMPTY — the character mask, by hiding the whole rig root.
  const nChar = await page.evaluate(() => {
    let k = 0; window.__stage.scene.traverse((o) => { if (o.name === 'rig_root') { o.visible = false; k++; } });
    window.__stage.scene.updateMatrixWorld(true); window.__stage.render(0); return k;
  });
  const noChar = await shot(page);
  await page.evaluate(() => {
    window.__stage.scene.traverse((o) => { if (o.name === 'rig_root') o.visible = true; });
    window.__stage.scene.updateMatrixWorld(true); window.__stage.render(0);
  });
  const charStats = await delta(s1, noChar);
  if (nChar > 0 && charStats.n > 0) pass(`NONEMPTY  character = ${charStats.n} px (${(100 * charStats.n / (W * H)).toFixed(3)}% of frame)`);
  else fail(`NONEMPTY  character mask is ${charStats.n} px — nothing below is a ratio`);

  // KB-MISS — a selector that cannot match.
  const kbMiss = await setHidden(page, ['lk1_no_such_mesh'], [], true);
  if (kbMiss === 0) pass('KB-MISS  a selector matching nothing is reported NO-MATCH, not 0 px');
  else fail(`KB-MISS  'lk1_no_such_mesh' matched ${kbMiss} objects`);

  // KB-SEEN — the broth disc must be visible to the ablation.
  const nBroth = await setHidden(page, ['soup_broth'], [], true);
  const brothShot = await shot(page);
  await setHidden(page, ['soup_broth'], [], false);
  const brothD = await delta(s1, brothShot);
  if (nBroth > 0 && brothD.n > 1000) pass(`KB-SEEN  soup_broth = ${brothD.n} px`);
  else fail(`KB-SEEN  soup_broth matched ${nBroth} objects, delivered ${brothD.n} px`);

  const targets = [];
  for (const g of HIDE) targets.push({ label: g.join('+'), names: g, mats: [] });
  for (const m of HIDEMAT) targets.push({ label: `mat#${m}`, names: [], mats: [m] });
  if (SELFTEST) { await page.close(); continue; }

  for (const t of targets) {
    const matched = await setHidden(page, t.names, t.mats, true);
    const ab = await shot(page);
    await setHidden(page, t.names, t.mats, false);
    if (matched === 0) {
      console.log(`  NO-MATCH  ${t.label}  (selector matched 0 objects — NOT an area of 0)`);
      rows.push({ station: st.tag, label: t.label, matched: 0, n: null });
      fails++;
      continue;
    }
    const d = await delta(s1, ab);
    const pctFrame = (100 * d.n / (W * H)).toFixed(4);
    const pctChar = charStats.n ? (100 * d.n / charStats.n).toFixed(2) : 'n/a';
    console.log(`  ${t.label.padEnd(34)} matched ${String(matched).padStart(2)}  ${String(d.n).padStart(6)} px  ${pctFrame}% frame  ${pctChar}% char  ${d.hex ?? '—'}  L ${d.luma ?? '—'}  hslL ${d.hsl ?? '—'}  hue ${d.hue ?? '—'}`);
    rows.push({ station: st.tag, label: t.label, matched, ...d, pctFrame: +pctFrame, pctChar: pctChar === 'n/a' ? null : +pctChar, charPx: charStats.n });
  }
  await page.close();
}

await browser.close();
if (JSON_OUT) { await mkdir(dirname(JSON_OUT), { recursive: true }); await writeFile(JSON_OUT, JSON.stringify(rows, null, 2)); }
console.log(`\n[lk1_area] ${fails ? `${fails} FAIL` : 'all controls PASS'}`);
process.exit(fails ? 1 : 0);
