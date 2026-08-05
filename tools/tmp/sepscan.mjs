#!/usr/bin/env node
/**
 * sepscan — INTERNAL SEPARATION, measured in the LIVE MATCH and on the REFERENCE PLATES.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Two character passes hit their metric and lost score (value ladder 3.6 -> 3.25;
 * silhouette 3.0 and 2.0), both rounds valid. The cast is now at the Brawl Stars
 * MEDIAN for hull deficiency and 11 of 11 clear the weakest plate — and the character
 * that scored LOWEST (burrito, 2.0) has the BEST measured outline in the cast
 * (hullDef 0.3340). Two independent blind critics then named the same missing thing,
 * unprompted, on two different characters:
 *
 *   egg      "no head/body separation ... a 4-6 px pinch at the neck"
 *   burrito  "head as a distinct sphere proud of a real shoulder line, with a hard
 *             dark occlusion notch under the chin"
 *
 * The cast has no neck. That is an INTERNAL break rather than an outline event, and
 * `silhlib` provably cannot see it — see `seplib.mjs`'s header for the arithmetic.
 *
 * ── The contract this tool keeps, which is why the last finding was trustworthy ──
 * Every number is a property of the MASK (+ the luma inside it), so the IDENTICAL
 * code runs on a Brawl Stars plate. The bands are MEASURED, not chosen.
 *
 * ── Modes ────────────────────────────────────────────────────────────────────
 *   --selftest     assertions on shapes whose answers are derivable by hand. No browser.
 *   --mode ref     the six hand-verified BS plates -> the band we are aiming at.
 *   --mode chars   the cast, in the match, at the shipped camera and shipped facing.
 *   --mode control THE INSTRUMENT VALIDATION, in the live game: lift and shrink the
 *                  head by known amounts and assert the metric moves the known way.
 *                  An instrument that cannot see a neck it was TOLD to make has no
 *                  business ranking eleven characters that have none.
 *
 * The capture is IMPORTED from `limbmatch.mjs`, never copied: `docs/LESSONS.md` §5 —
 * one stale copy of `match-sim`'s driver contaminated ten instruments and the audit's
 * own count of them was wrong by 2x.
 *
 * Usage (always under a frozen tree):
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/sepscan.mjs --mode chars --url {URL}
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { VL } from './valuelib.mjs';
import * as S from './silhlib.mjs';
import * as SEP from './seplib.mjs';
import { CAPTURE, bootMatch, LAUNCH_ARGS, STATIONS, JOINTS, MASS_PARTS, b64ToBytes } from './limbmatch.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const MODE = get('--mode', 'chars');
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const OUT = get('--out', 'shots/sepscan');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
const YAWS = get('--yaws', '90,0').split(',').map(Number);
const STATION = get('--station', 'pot_south');
const TARGET_H = Number(get('--targetH', 136));
/** The SIX hand-verified Brawl Stars plates. Zooba is excluded on purpose — its
 *  camera and its cast are not ours, and the last pass's band was BS-only. */
const REF_DIR = get('--ref', 'reference/images/curated/fullbody_fair');
const REF_PREFIX = get('--refPrefix', 'bs_');

// ─────────────────────────────────────────────────────────────────────────────
function fmt(v, w = 6) { return String(v == null ? '—' : v).padStart(w); }

function line(tag, s, extra = '') {
  return `${tag.padEnd(22)} h ${fmt(s.heightPx, 3)}px  ` +
    `neckPinch ${fmt(s.neckPinch)}@${fmt(s.neckRow01, 5)}  ` +
    `corePinch ${fmt(s.corePinch)}@${fmt(s.coreRow01, 5)}  parts ${s.coreParts}  ` +
    `chinNotch ${fmt(s.chinNotch)}@${fmt(s.notchRow01, 5)}  atNeck ${fmt(s.notchAtNeck)}  ` +
    `hbArea ${fmt(s.headBodyArea, 5)}  hbW ${fmt(s.headBodyRowWidth, 5)}  clip ${fmt(s.clipShare)}  p95 ${fmt(s.p95)}  edge ${fmt(s.interiorEdgeDensity)}` +
    `${s.pinchValid ? '' : '  ⚠ INVALID: the "pinch" row is EMPTY — a gap, not a neck'}${extra}`;
}

/** mask | core | luma-rows | notch+pinch marks. LOOK AT THIS before believing a row. */
async function overlay(sep, mask, luma, W, H, dir, tag) {
  await mkdir(dir, { recursive: true });
  const P = 4;
  const out = Buffer.alloc(W * P * H * 3, 16);
  const put = (p, x, y, r, g, b) => {
    const k = (y * W * P + p * W + x) * 3;
    out[k] = r; out[k + 1] = g; out[k + 2] = b;
  };
  const nRow = sep._raw && sep._raw.rowAbs;
  const cRow = sep._cor && sep._cor.rowAbs;
  const tRow = sep._notch && sep._notch.rowAbs;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x;
    const v = Math.round(Math.max(0, Math.min(1, luma ? luma[j] : 0)) * 255);
    // 0: silhouette
    if (mask[j]) put(0, x, y, 210, 210, 210); else put(0, x, y, 16, 12, 20);
    // 1: core (opening) — what corePinch is measured on
    if (sep._core[j]) put(1, x, y, 120, 200, 255);
    else if (mask[j]) put(1, x, y, 60, 60, 70);
    else put(1, x, y, 16, 12, 20);
    // 2: luma inside the mask
    if (mask[j]) put(2, x, y, v, v, v); else put(2, x, y, 16, 12, 20);
    // 3: marks
    if (mask[j]) put(3, x, y, v, v, v); else put(3, x, y, 16, 12, 20);
    if (y === nRow) put(3, x, y, 255, 70, 70);
    if (y === cRow) put(3, x, y, 90, 255, 120);
    if (y === tRow) put(3, x, y, 90, 160, 255);
  }
  await sharp(out, { raw: { width: W * P, height: H, channels: 3 } })
    .resize(W * P * 3, H * 3, { kernel: 'nearest' }).png().toFile(join(dir, `${tag}.png`));
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE ref — the band. Same segmentation pipeline `limbmatch --mode ref` uses.
// ─────────────────────────────────────────────────────────────────────────────
async function modeRef() {
  if (!existsSync(REF_DIR)) { console.error(`${REF_DIR} not present (reference/ is gitignored)`); process.exit(2); }
  const dir = join(OUT, 'ref');
  const rows = [];
  for (const f of readdirSync(REF_DIR).filter((x) => x.startsWith(REF_PREFIX) && /\.(png|jpe?g)$/i.test(x)).sort()) {
    const { data, info } = await sharp(join(REF_DIR, f)).resize(700, null).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const seg = VL.segmentAuto(data, W, H, {});
    const big = VL.largestComponent(seg.mask, W, H).mask;
    const filled = S.bbox(big, W, H) ? VL.fillHoles(big, W, H) : big;
    const luma = new Float32Array(W * H);
    for (let j = 0; j < W * H; j++) luma[j] = SEP.luma8(data[j * 3], data[j * 3 + 1], data[j * 3 + 2]);
    // GEOMETRY on the hole-filled mask (so hull deficiency and the pinch see the same
    // silhouette `limbmatch --mode ref` measured); LUMA only on pixels the segmenter
    // actually called character, because a filled hole is BACKGROUND and averaging it
    // in would manufacture a dark band out of the backdrop.
    const rs = SEP.resamplePair(filled, luma, W, H, TARGET_H, big);
    if (!rs) { console.error(`✗ ${f}: nothing segmented`); continue; }
    const sep = SEP.separation(rs.mask, rs.luma, rs.W, rs.H, { valid: rs.valid });
    const sil = S.silhouette(rs.mask, rs.W, rs.H, {});
    rows.push({ file: f, tol: seg.tol, scale: +rs.scale.toFixed(3), hullDeficiency: sil.hullDeficiency, appendages: sil.appendages,
      ...Object.fromEntries(Object.entries(sep).filter(([k]) => !k.startsWith('_'))) });
    console.log(line(f, sep, `  hullDef ${sil.hullDeficiency}`));
    await overlay(sep, rs.mask, rs.luma, rs.W, rs.H, dir, f.replace(/\.\w+$/, ''));
  }
  const q = (arr, p) => { const s = [...arr].filter((v) => v != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : null; };
  // A plate whose winning "pinch" row is EMPTY is measuring a gap in the mask, not a
  // neck. Excluded by RULE, not by hand-picking, and the identical rule runs on our
  // own render (where 0 detached px is already a hard gate, so a failure there would
  // be a real regression rather than a segmentation artefact).
  const valid = rows.filter((r) => r.pinchValid);
  const dropped = rows.filter((r) => !r.pinchValid);
  const band = (key) => {
    const v = valid.map((r) => r[key]);
    return { min: q(v, 0), p25: q(v, 0.25), median: q(v, 0.5), max: q(v, 1) };
  };
  const summary = { n: valid.length, nDropped: dropped.length, dropped: dropped.map((r) => r.file), targetH: TARGET_H, dir: REF_DIR, prefix: REF_PREFIX };
  for (const k of ['neckPinch', 'corePinch', 'chinNotch', 'notchAtNeck', 'headBodyWidth', 'headBodyArea',
    'headBodyRowWidth', 'clipShare', 'p95', 'p05', 'interiorEdgeDensity', 'coreParts', 'neckRow01']) summary[k] = band(k);
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'ref.json'), JSON.stringify({ summary, rows }, null, 2));
  console.log(`\nREFERENCE BAND over ${valid.length} of ${rows.length} plates at ${TARGET_H}px` +
    `${dropped.length ? ` (dropped ${dropped.map((r) => r.file).join(', ')} — mask in pieces)` : ''}:`);
  for (const k of Object.keys(summary)) {
    const b = summary[k];
    if (!b || typeof b !== 'object' || Array.isArray(b)) continue;
    console.log(`  ${k.padEnd(20)} min ${fmt(b.min)}  p25 ${fmt(b.p25)}  median ${fmt(b.median)}  max ${fmt(b.max)}`);
  }
  console.log(`wrote ${OUT}/ref.json — LOOK AT ${dir}/*.png before believing any of it.`);
}

// ─────────────────────────────────────────────────────────────────────────────
function analyse(res) {
  const [, , cw, ch] = res.crop;
  const mask = b64ToBytes(res.maskb64);
  const rgb = b64ToBytes(res.cropRGBb64);
  const deliv = res.charDeliveredb64 ? b64ToBytes(res.charDeliveredb64) : null;
  const luma = new Float32Array(cw * ch);
  for (let j = 0; j < cw * ch; j++) luma[j] = SEP.luma8(rgb[j * 3], rgb[j * 3 + 1], rgb[j * 3 + 2]);
  const rs = SEP.resamplePair(mask, luma, cw, ch, TARGET_H, deliv);
  const sep = SEP.separation(rs.mask, rs.luma, rs.W, rs.H, { valid: rs.valid });
  return { sep, rs };
}

async function modeChars() {
  if (!BASE) { console.error('PREVIEW_BASE unset'); process.exit(2); }
  const st = STATIONS[STATION];
  if (!st) { console.error(`no station ${STATION}`); process.exit(2); }
  const dir = join(OUT, 'chars');
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const out = {};
  try {
    for (const id of IDS) {
      out[id] = {};
      let page = null;
      try {
        page = await bootMatch(browser, id, st);
        for (const yawDeg of YAWS) {
          const res = await page.evaluate(CAPTURE, { yawDeg, playerId: id, jointNames: JOINTS, massParts: MASS_PARTS, control: 'none' });
          if (res.error) { console.error(`✗ ${id} yaw${yawDeg}: ${res.error}`); out[id][yawDeg] = { error: res.error }; continue; }
          const { sep, rs } = analyse(res);
          await overlay(sep, rs.mask, rs.luma, rs.W, rs.H, dir, `${id}.yaw${yawDeg}`);
          const clean = Object.fromEntries(Object.entries(sep).filter(([k]) => !k.startsWith('_')));
          clean.nativeHeightPx = res.charHeightPx;
          clean.shippedDeliveredPct = res.shippedDeliveredPct;
          out[id][yawDeg] = clean;
          const warn = res.shippedDeliveredPct != null && res.shippedDeliveredPct < 97
            ? `  ⚠ OCCLUDED ${(100 - res.shippedDeliveredPct).toFixed(1)}% — luma row invalid` : '';
          console.log(line(`${id} yaw${yawDeg}`, sep, `  deliv ${res.shippedDeliveredPct}%${warn}`));
        }
      } catch (e) {
        console.error(`✗ ${id}: ${e}`); out[id].error = String(e);
      } finally { if (page) await page.close(); }
    }
  } finally { await browser.close(); }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'chars.json'), JSON.stringify(out, null, 2));
  console.log(`\nwrote ${OUT}/chars.json and ${dir}/*.png`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE control — THE INSTRUMENT VALIDATION, in the live game.
//
// A known input with a known answer, applied to the SAME capture path the cast is
// measured through. `limbmatch --mode control` earns its keep by having caught a
// WRONG assertion of its own; this one is built the same way, on things the
// transform GUARANTEES rather than on what a subject happens to do.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PRICE THE MECHANISM BEFORE WRITING IT INTO `rig.ts`.
 *
 * `docs/LESSONS.md` §2 is eight for eight here, and the previous pass's pose sweep is
 * the worked example of what this avoids: it was worth 0.00-0.01 because at 58deg a
 * vertical metre buys 0.53 of a screen-metre. A NECK is a vertical device, so it is
 * exposed to exactly that arithmetic and must be measured before it is built.
 *
 * Sweeps head lift x head scale live, in the real match, at the shipped facing, and
 * writes the shipped RGB of every variant so the answer can be LOOKED AT rather than
 * inferred from a number.
 */
const HEADMOD = (opts) => {
  const stage = window.__stage;
  const scene = stage.scene;
  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  const t = casts.find((c) => c.name === `character:${opts.playerId}`) ?? casts[0];
  const head = t.getObjectByName('head');
  if (!head) return { error: 'no head joint' };
  if (!window.__sepSaved) window.__sepSaved = { pos: head.position.clone(), scl: head.scale.clone() };
  const sv = window.__sepSaved;
  head.position.copy(sv.pos); head.scale.copy(sv.scl);
  head.position.y += opts.lift ?? 0;
  head.scale.multiplyScalar(opts.shrink ?? 1);
  t.updateMatrixWorld(true);
  return { ok: true };
};

async function modeControl() {
  if (!BASE) { console.error('PREVIEW_BASE unset'); process.exit(2); }
  // ⚠️ THE SUBJECT IS PART OF THE CONTROL, and the first choice here was wrong.
  //
  // This ran on `egg` and came back 5 pass / 4 fail. The instrument was right and the
  // HARNESS was wrong: egg is a STUB, so its `head` joint carries the ENTIRE food mass
  // and there is no torso underneath. "Shrink the head" therefore shrinks the whole
  // character — measured `areaPx` 6303 -> 4057, a 36% loss — and "lift the head" lifts
  // the character off its own legs. Neither transform means what the assertions say it
  // means on that subject, so three of the four failures were the control describing a
  // different experiment from the one it claimed.
  //
  // This is `limbmatch --mode control`'s own lesson repeating: its failing assertion
  // ("burying lowers hull deficiency") likewise encoded an assumption about the
  // SUBJECT rather than a property of the transform. The degeneracy guard below —
  // silhouette area must not move more than 35% — is kept and promoted, because it is
  // the assertion that CAUGHT this, and it now fails loudly on any subject where the
  // head is the whole character.
  const id = get('--id', 'burrito');
  const st = STATIONS[STATION];
  const dir = join(OUT, 'control');
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = {};
  try {
    const page = await bootMatch(browser, id, st);
    const variants = [
      ['none', { lift: 0, shrink: 1 }],
      ['shrink0.72', { lift: 0, shrink: 0.72 }],
      ['lift0.22', { lift: 0.22, shrink: 1 }],
      ['neck', { lift: 0.22, shrink: 0.72 }],
    ];
    for (const [name, mod] of variants) {
      const m = await page.evaluate(HEADMOD, { playerId: id, ...mod });
      if (m.error) { console.error(`✗ ${name}: ${m.error}`); continue; }
      const res = await page.evaluate(CAPTURE, { yawDeg: 90, playerId: id, jointNames: JOINTS, massParts: MASS_PARTS, control: 'none' });
      if (res.error) { console.error(`✗ ${name}: ${res.error}`); continue; }
      const { sep, rs } = analyse(res);
      await overlay(sep, rs.mask, rs.luma, rs.W, rs.H, dir, `${id}.${name}`);
      rows[name] = Object.fromEntries(Object.entries(sep).filter(([k]) => !k.startsWith('_')));
      console.log(line(`${id} ${name}`, sep));
    }
    await page.close();
  } finally { await browser.close(); }

  let pass = 0, fail = 0;
  const check = (n, ok, d) => { if (ok) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };
  console.log('\nVALIDATION (known input -> known answer):');
  const N = rows.none, SH = rows['shrink0.72'], LI = rows['lift0.22'], NK = rows.neck;
  if (!N || !SH || !LI || !NK) { console.error('a variant failed to render — cannot validate'); process.exit(1); }
  // Lifting a head off a torso and narrowing it are the two halves of a neck. Each
  // alone must not LOWER the pinch, and the two together must raise it — those are
  // properties of the transform, not of the egg.
  // FIRST, because it is the one that decides whether the rest MEAN anything: on a
  // subject whose `head` is its whole body, every row below is answering a different
  // question. Dropped from last place to first after it caught exactly that.
  check('the subject has a head DISTINCT from its body', Math.abs(NK.areaPx - N.areaPx) / N.areaPx < 0.35,
    `silhouette areaPx ${N.areaPx} -> ${NK.areaPx} — if this fails the subject is a STUB and the rest is meaningless`);
  // ── "lifting the head cannot lower the pinch" WAS HERE AND WAS WRONG ────────
  // Measured on burrito: 0.4545 -> 0.3600 on a pure lift, and the instrument was
  // right. `neckPinch` is a MAX over rows; burrito's base maximum sits at row 0.618,
  // a waist at the HIPS, and lifting the head introduces a genuine neck at row 0.412
  // that is shallower than that hip waist. So the number went down while the thing it
  // is for went up. A lift guarantees a break EXISTS, not that it is the DEEPEST one
  // on the figure — that is a property of the subject, and this is the third
  // assertion in this project's two control harnesses to have encoded one. Replaced
  // with a consequence the transform actually forces.
  check('shrinking the head lowers head/body AREA', SH.headBodyArea <= N.headBodyArea + 1e-9,
    `${N.headBodyArea} -> ${SH.headBodyArea}`);
  check('shrink+lift RAISES the pinch', NK.neckPinch > N.neckPinch + 0.03, `${N.neckPinch} -> ${NK.neckPinch}`);
  check('the pinch it finds is in the upper body', NK.neckRow01 != null && NK.neckRow01 <= 0.62, `row01 ${NK.neckRow01}`);
  check('shrinking the head lowers head/body width', SH.headBodyWidth < N.headBodyWidth + 1e-9, `${N.headBodyWidth} -> ${SH.headBodyWidth}`);
  check('shrink+lift raises the CORE pinch too', NK.corePinch > N.corePinch - 1e-9, `${N.corePinch} -> ${NK.corePinch}`);
  check('a bigger gap cannot reduce core parts', NK.coreParts >= N.coreParts, `${N.coreParts} -> ${NK.coreParts}`);
  check('every variant is a VALID measurement, not a gap', [N, SH, LI, NK].every((r) => r.pinchValid),
    `pinchValid ${[N, SH, LI, NK].map((r) => r.pinchValid).join(',')}`);
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'control.json'), JSON.stringify(rows, null, 2));
  console.log(`\n${pass} pass, ${fail} fail · overlays in ${dir}/ — LOOK AT THEM`);
  process.exit(fail ? 1 : 0);
}

async function modeProbe() {
  if (!BASE) { console.error('PREVIEW_BASE unset'); process.exit(2); }
  const st = STATIONS[STATION];
  const dir = join(OUT, 'probe');
  await mkdir(dir, { recursive: true });
  const variants = [['base', { lift: 0, shrink: 1 }]];
  for (const l of (get('--lifts', '0.06,0.12,0.18').split(',').map(Number))) variants.push([`lift${l}`, { lift: l, shrink: 1 }]);
  for (const s of (get('--shrinks', '0.88,0.78').split(',').map(Number))) variants.push([`shrink${s}`, { lift: 0, shrink: s }]);
  for (const l of [0.12, 0.18]) for (const s of [0.88, 0.78]) variants.push([`l${l}_s${s}`, { lift: l, shrink: s }]);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const out = {};
  try {
    for (const id of IDS) {
      let page = null;
      out[id] = {};
      try {
        page = await bootMatch(browser, id, st);
        const crops = [];
        for (const [name, mod] of variants) {
          const m = await page.evaluate(HEADMOD, { playerId: id, ...mod });
          if (m.error) { console.error(`✗ ${id} ${name}: ${m.error}`); continue; }
          const res = await page.evaluate(CAPTURE, { yawDeg: Number(get('--yaw', 90)), playerId: id, jointNames: JOINTS, massParts: MASS_PARTS, control: 'none' });
          if (res.error) { console.error(`✗ ${id} ${name}: ${res.error}`); continue; }
          const { sep } = analyse(res);
          out[id][name] = Object.fromEntries(Object.entries(sep).filter(([k]) => !k.startsWith('_')));
          const [, , cw, ch] = res.crop;
          crops.push({ name, cw, ch, rgb: b64ToBytes(res.cropRGBb64) });
          console.log(line(`${id} ${name}`, sep));
        }
        // one strip of the SHIPPED colour, every variant, so "is the neck visible at
        // 58deg" is answered by looking rather than by a number
        const HH = Math.max(...crops.map((c) => c.ch)), WW = crops.reduce((s2, c) => s2 + c.cw + 4, 0);
        const buf = Buffer.alloc(WW * HH * 3, 12);
        let ox = 0;
        for (const c of crops) {
          for (let y = 0; y < c.ch; y++) for (let x = 0; x < c.cw; x++) {
            const s3 = (y * c.cw + x) * 3, d = (y * WW + ox + x) * 3;
            buf[d] = c.rgb[s3]; buf[d + 1] = c.rgb[s3 + 1]; buf[d + 2] = c.rgb[s3 + 2];
          }
          ox += c.cw + 4;
        }
        await sharp(buf, { raw: { width: WW, height: HH, channels: 3 } })
          .resize(WW * 3, HH * 3, { kernel: 'nearest' }).png().toFile(join(dir, `${id}.strip.png`));
      } catch (e) { console.error(`✗ ${id}: ${e}`); } finally { if (page) await page.close(); }
    }
  } finally { await browser.close(); }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'probe.json'), JSON.stringify(out, null, 2));
  console.log(`\nwrote ${OUT}/probe.json and ${dir}/*.strip.png — LOOK AT THE STRIPS.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest — shapes whose answers are derivable by hand.
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want, eps) => {
    const ok = typeof want === 'number'
      ? (got != null && Math.abs(got - want) <= (eps ?? 1e-9))
      : JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else { fail++; console.log(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  };
  const W = 200, H = 240;
  const blank = () => new Uint8Array(W * H);
  const disc = (cx, cy, r, m = blank()) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m[y * W + x] = 1;
    return m;
  };
  const rect = (x0, y0, w, h, m = blank()) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && x < W && y >= 0 && y < H) m[y * W + x] = 1;
    return m;
  };

  // ── 1. A SINGLE CONVEX BLOB SCORES EXACTLY ZERO ────────────────────────────
  // The single most important property: the metric must not reward curvature. Any
  // convex lobe has `max above` = w(y) in its upper half and `max below` = w(y) in
  // its lower half, so the ratio is 1 everywhere.
  check('disc neckPinch', SEP.pinch(disc(100, 120, 60), W, H).pinch, 0);
  check('rect neckPinch', SEP.pinch(rect(60, 20, 80, 200), W, H).pinch, 0);
  // a TAPERED cone is still convex-ish and must score 0 rather than "narrowing"
  const cone = blank();
  for (let y = 20; y < 220; y++) { const half = Math.round(10 + (y - 20) * 0.25); rect(100 - half, y, half * 2, 1, cone); }
  check('monotone taper neckPinch', SEP.pinch(cone, W, H).pinch, 0);

  // ── 2. A SNOWMAN SCORES ITS OWN ARITHMETIC ────────────────────────────────
  // head w=40 (rows 20-59), neck w=8 (rows 60-67), body w=60 (rows 68-147).
  // pinch = 1 - 8/min(40,60) = 0.80, at row 60-67 -> row01 in (0.3,0.38).
  const snow = rect(70, 68, 60, 80, rect(96, 60, 8, 8, rect(80, 20, 40, 40)));
  const sp = SEP.pinch(snow, W, H);
  check('snowman neckPinch', sp.pinch, 0.8, 1e-4);
  check('snowman neckW', sp.neckW, 8);
  check('snowman upperW', sp.upperW, 40);
  check('snowman lowerW', sp.lowerW, 60);
  check('snowman headBodyWidth', sp.headBodyWidth, 0.667, 1e-3);
  check('snowman pinch row is at the neck', sp.rowAbs >= 60 && sp.rowAbs <= 67, true);

  // ── 3. SCALE-FREE. The same figure at 2x must give the SAME number. ────────
  const snow2 = rect(40, 116, 120, 160, rect(92, 100, 16, 16, rect(60, 20, 80, 80)));
  check('snowman at 2x is the same number', SEP.pinch(snow2, W, H).pinch, 0.8, 1e-3);

  // ── 3b. A THIN PROP ABOVE THE MASS IS NOT A HEAD ─────────────────────────
  // The defect this caught in the live cast, which is why it is pinned: soup's LADLE
  // HANDLE scored 0.7097 — the best pinch in the eleven — because a stick above a pot
  // is arithmetically a small lobe over a large one with a narrow join. Egg, a
  // featureless ball at the shipped facing, scored under one of its shell shards.
  // Both are excluded by requiring the narrower lobe to be >= 0.45 of the wider, a
  // bound the reference plates clear at 0.617 or better.
  const ladle = rect(70, 60, 60, 100, rect(96, 20, 8, 40));   // 8px stick over a 60px pot
  check('a thin prop above the mass is not a neck', SEP.pinch(ladle, W, H).pinch, 0);
  check('...and it is still a VALID measurement, not an error', SEP.separation(ladle, null, W, H, {}).pinchValid, true);
  // ...while a head only just above the 0.45 bound (32 wide over a 60 wide body =
  // 0.533) is measured normally, so the gate rejects props without rejecting heads.
  const withHead = rect(70, 60, 60, 100, rect(92, 52, 16, 8, rect(84, 20, 32, 32)));
  check('a real head just above the bound still scores', SEP.pinch(withHead, W, H).pinch, 0.5, 1e-4);

  // ── 4. THE SEARCH BAND. A pinch at the ANKLES is not a neck. ──────────────
  // block 20-160 w=60, waist at 170-177 w=8, feet 178-220 w=60. row01 ~0.75.
  const legs = rect(70, 178, 60, 42, rect(96, 170, 8, 8, rect(70, 20, 60, 150)));
  check('a pinch below the band is not reported', SEP.pinch(legs, W, H).pinch, 0);

  // ── 5. AN APPENDAGE ACROSS THE NECK MUST NOT ERASE THE PINCH ─────────────
  // A 36px bar laid across the 8px neck. `runWidthProfile` takes the widest
  // CONTIGUOUS run, so the bar does widen the neck rows to 36 and the pinch at those
  // rows collapses to 1 - 36/40 = 0.10 — which is CORRECT, because a mass that wide
  // between the two lobes is not a neck any more. What the metric must not do is
  // report the ORIGINAL 0.80: the eye does not see a pinch there either.
  //
  // (This test was first written expecting the morphological opening to remove the
  // bar and `corePinch` to hold 0.80. It does not, and the reason is worth keeping:
  // an opening is a 2-D operator, and a short WIDE bridge welded to a lobe above and
  // a lobe below is not thin in either direction — its distance-from-background is
  // set by its WIDTH, not its height. `corePinch` removes limb-calibre SPURS, not
  // bridges, and the header no longer claims otherwise.)
  const bridged = rect(82, 60, 36, 8, rect(70, 68, 60, 80, rect(80, 20, 40, 40)));
  check('a bar across the neck collapses the pinch to its own width', SEP.pinch(bridged, W, H).pinch, 0.1, 1e-4);

  // ── 6. A FULL SPLIT SATURATES AT 1 AND SHOWS UP AS TWO CORE PARTS ─────────
  const split = rect(70, 70, 60, 80, rect(80, 20, 40, 40));
  const sepS = SEP.separation(split, null, W, H, {});
  check('detached head neckPinch', sepS.neckPinch, 1);
  check('detached head coreParts', sepS.coreParts, 2);
  // ...and a detached head is reported INVALID rather than as a perfect score. This
  // is the assertion a real reference plate needed: bs_06's helmet segments away from
  // its body and scored 1.0000 before this existed.
  check('a detached head is NOT a valid pinch', sepS.pinchValid, false);
  // An 8px neck on a 128px figure is BELOW the opening diameter (2k = 11.5px), so the
  // core splits — the metric says "severed" and it is right to. A 20px neck is above
  // it and stays one part. Both are pinned so the threshold cannot drift unnoticed.
  check('an 8px neck on a 128px figure severs the core', SEP.separation(snow, null, W, H, {}).coreParts, 2);
  const wide = rect(70, 68, 60, 80, rect(90, 60, 20, 8, rect(80, 20, 40, 40)));
  const sepW = SEP.separation(wide, null, W, H, {});
  check('a 20px neck keeps ONE core part', sepW.coreParts, 1);
  check('wide-neck neckPinch', sepW.neckPinch, 0.5, 1e-4);
  check('corePinch agrees with the raw pinch when nothing bridges', Math.abs(sepW.corePinch - sepW.neckPinch) < 0.12, true);
  check('a joined neck IS a valid pinch', sepW.pinchValid, true);

  // ── 7. THE NOTCH. A uniform figure has none; a band of known depth measures it. ─
  const slab = rect(60, 20, 80, 200);
  const flat = new Float32Array(W * H).fill(0.8);
  check('uniform figure chinNotch', SEP.notch(slab, flat, W, H).notch, 0);
  const banded = new Float32Array(W * H).fill(0.8);
  for (let y = 90; y < 96; y++) for (let x = 0; x < W; x++) banded[y * W + x] = 0.3;
  const nb = SEP.notch(slab, banded, W, H);
  check('banded figure chinNotch', nb.notch, 0.5, 1e-6);
  check('notch row is in the band', nb.rowAbs >= 90 && nb.rowAbs <= 95, true);
  // A dark STRIPE down one side is not a notch — the row MEDIAN must reject it.
  const striped = new Float32Array(W * H).fill(0.8);
  for (let y = 0; y < H; y++) for (let x = 60; x < 85; x++) striped[y * W + x] = 0.0;
  check('a vertical stripe is not a notch', SEP.notch(slab, striped, W, H).notch, 0);
  // and the notch must be scale-free in VALUE: doubling contrast doubles it
  const banded2 = new Float32Array(W * H).fill(0.4);
  for (let y = 90; y < 96; y++) for (let x = 0; x < W; x++) banded2[y * W + x] = 0.15;
  check('notch tracks contrast', SEP.notch(slab, banded2, W, H).notch, 0.25, 1e-6);

  // ── 8. OCCLUSION VALIDITY. A masked-off region must not create a notch. ───
  // The luma under an occluder is the OCCLUDER's — `docs/LESSONS.md` §5. With the
  // region marked invalid the notch disappears; without the flag it is reported.
  const occl = new Float32Array(W * H).fill(0.8);
  for (let y = 100; y < 112; y++) for (let x = 0; x < W; x++) occl[y * W + x] = 0.05;
  const valid = new Uint8Array(W * H).fill(1);
  for (let y = 100; y < 112; y++) for (let x = 0; x < W; x++) valid[y * W + x] = 0;
  check('an occluder DOES fake a notch when unguarded', SEP.notch(slab, occl, W, H).notch > 0.7, true);
  check('the validity mask removes it', SEP.notch(slab, occl, W, H, { valid }).notch, 0);

  // ── 9. THE RESAMPLE IS A DELIBERATE DUPLICATE OF silhlib's — pin it. ──────
  const rsA = S.resampleMaskToHeight(snow, W, H, 60);
  const rsB = SEP.resamplePair(snow, flat, W, H, 60);
  check('resamplePair mask === silhlib resampleMaskToHeight', Array.from(rsB.mask).join('') === Array.from(rsA.mask).join(''), true);
  check('resample preserves the pinch', SEP.pinch(rsB.mask, rsB.W, rsB.H).pinch, 0.8, 0.06);
  check('resampled luma stays in range', rsB.luma.every((v) => v >= 0 && v <= 1), true);

  // ── 10. IT IS NOT hullDeficiency IN DISGUISE ─────────────────────────────
  // The claim in seplib's header — the last pass's metrics are blind to a neck — is
  // ASSERTED here rather than believed. The subject is the 20px-neck figure, not the
  // severed 8px one, because that is the case the cast is actually in: a neck a
  // player can see, well above the opening diameter.
  const nonecked = rect(70, 60, 60, 88, rect(80, 20, 40, 40));
  const silA = S.silhouette(wide, W, H, {}), silB = S.silhouette(nonecked, W, H, {});
  check('a real neck moves hullDeficiency by under 0.05', Math.abs(silA.hullDeficiency - silB.hullDeficiency) < 0.05,
    true);
  check('the same neck moves neckPinch by over 0.4', SEP.pinch(wide, W, H).pinch - SEP.pinch(nonecked, W, H).pinch > 0.4, true);
  check('the appendage count does not see it', silA.appendages, silB.appendages);

  // ── 11. Interior edge density on known inputs ────────────────────────────
  check('uniform interior has no edges', SEP.interiorEdge(slab, flat, W, H, 0.10).density, 0);
  check('a banded interior has some', SEP.interiorEdge(slab, banded, W, H, 0.10).density > 0.02, true);

  console.log(`\nselftest: ${pass} pass, ${fail} fail`);
  return fail ? 1 : 0;
}

if (has('--selftest')) process.exit(selftest());
else if (MODE === 'ref') await modeRef();
else if (MODE === 'chars') await modeChars();
else if (MODE === 'probe') await modeProbe();
else if (MODE === 'control') await modeControl();
else { console.error(`unknown --mode ${MODE}`); process.exit(2); }
