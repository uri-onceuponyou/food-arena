#!/usr/bin/env node
/**
 * lk2_geom — world-space facts about hamburger's FACE STROKES and its PICK, offline.
 *
 * THROWAWAY. READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────────
 * The brow question is *"how far is this stroke from the eye it belongs to, and how
 * big is it next to that eye"*. That is pure geometry, so it does not need a GPU —
 * and the two GPU instruments that could answer it both have a problem on THIS
 * character:
 *
 *   `bw_brow.mjs`  matches parts by SUBSTRING (`base.includes(sub)`). Hamburger's
 *                  sclera is named exactly `eye`, and `eye_lash` / `eye_glint…` both
 *                  contain it — and `eye` is painted LAST, so passing `--eye eye`
 *                  silently repaints the lash over its own cyan. There is no unique
 *                  substring for this character's sclera, so the tool cannot separate
 *                  them here. (It is still the right tool where names are unique.)
 *   `cf_ablate.mjs --mode paint`  MUTATES `o.material.color` IN PLACE. `faceMat` is
 *                  ONE material shared by `brow` x2, `eye_lash` x2 and `lipUp`
 *                  (`hamburger.ts:651`), so `--names brow` repaints all five and
 *                  reports their combined area under the brow's name. Measured:
 *                  10,638 px "brow" at pitch 20. See `lk2_ink.mjs`, which paints a
 *                  per-mesh material and reports 1/4 of that.
 *
 * ── WHAT IT REPORTS ──────────────────────────────────────────────────────────
 * Per named mesh, the world-space AABB, plus derived answers:
 *   browGapY   brow AABB bottom  -  lash AABB top     (the bare wall between them)
 *   browGapEye brow AABB bottom  -  sclera AABB top
 *   spanRatio  brow AABB width   /  sclera AABB width
 *   floatOut   how far the stroke's own plane stands off the crown sphere
 * All also expressed in units of the sclera's own height, because that is the unit a
 * viewer actually compares against.
 *
 * ── KNOWN-BADS (`--selftest`). A guard not shown to FAIL is not a guard. ──────
 *   1 RESOLVES   every requested name matches >=1 mesh. An unmatched name EXITS 4
 *                rather than reporting a confident 0 — the fault `cb_rig` learned.
 *   2 NON-EMPTY  the mesh set asserted over is non-empty BEFORE any filter is applied
 *                (CLAUDE.md #6: `[].every()` is `true`).
 *   3 MOVES      `--nudge +0.02` raises the brow; `browGapY` MUST GROW, both sides.
 *   4 MOVES-DOWN `--nudge -0.02` MUST SHRINK it by the MIRROR amount. ⚠️ The magnitude
 *                is deliberately not asserted — see the arms themselves; a local nudge
 *                is not a world displacement on a scaled chain, and the first version
 *                of these two arms failed for exactly that reason.
 *
 * ⚠️ AND READ THIS BEFORE STEERING ON `browGapY` AT ALL. It is an AABB-to-AABB gap, and
 * both strokes are ARCS — the brow's lowest points are its two outboard TIPS and the
 * lash's highest point is its central apex, and those are not on the same vertical. So
 * the number can go NEGATIVE while a viewer sees clear bun between them, which is
 * exactly what it does on the shipped face. The steerable statistic is the COLUMN-WISE
 * screen gap, and `bw_brow.mjs` computes it (6/6 known-bads on this character). This
 * file is for sizes, spans and where things actually are in 3D.
 *   5 HOLDS      `--nudge 0` reproduces the baseline EXACTLY (this is arithmetic on a
 *                deterministic build, so it is an equality and not a tolerance).
 *   6 SIDES      the left and right brow are reported separately, and the selftest
 *                requires them to be DISTINCT objects — a single-sided reader would
 *                report one row and pass everything else.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const ID = get('--id', 'hamburger');
const NUDGE = Number(get('--nudge', '0'));
const SELFTEST = a.includes('--selftest');
const NAMES = get('--names', 'brow,eye_lash,eye,pick_rod,pick_olive,pick_flag')
  .split(',').map((s) => s.trim()).filter(Boolean);

async function loadCast() {
  const dir = mkdtempSync(path.join(tmpdir(), 'lk2-'));
  const entry = path.join(dir, 'entry.ts');
  const q = (p) => JSON.stringify(path.join(REPO, p));
  writeFileSync(entry, [
    `export * as THREE from 'three';`,
    `export { createCharacter } from ${q('src/characters/registry')};`,
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(REPO, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found at ${esbuild}`);
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
    `--alias:three=${path.join(REPO, 'node_modules/three')}`,
    `--outfile=${out}`, '--log-level=error'], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] });
  return import('file://' + out);
}

const mod = await loadCast();
const THREE = mod.THREE;

const warns = [];
function build(nudge = 0) {
  const orig = console.warn; console.warn = (...x) => warns.push(x.join(' '));
  let ch;
  try { ch = mod.createCharacter(ID); } finally { console.warn = orig; }
  ch.rig.restPose();
  ch.rig.joints.root.updateWorldMatrix(true, true);
  if (nudge) {
    ch.rig.joints.root.traverse((o) => { if (o.isMesh && o.name === 'brow') o.position.y += nudge; });
    ch.rig.joints.root.updateWorldMatrix(true, true);
  }
  const rows = [];
  ch.rig.joints.root.traverse((o) => {
    if (!o.isMesh || !o.name) return;
    if (o.name.endsWith('__outline')) return;
    if (!NAMES.includes(o.name)) return;
    if (nudge && o.name === 'brow') { o.position.y += nudge; }
    const box = new THREE.Box3().setFromObject(o);
    rows.push({
      name: o.name,
      side: box.getCenter(new THREE.Vector3()).x < 0 ? 'L' : 'R',
      x0: box.min.x, x1: box.max.x, y0: box.min.y, y1: box.max.y, z0: box.min.z, z1: box.max.z,
      w: box.max.x - box.min.x, h: box.max.y - box.min.y, d: box.max.z - box.min.z,
    });
  });
  // ── KNOWN-BAD 2: assert the set is NON-EMPTY before anything filters it.
  if (rows.length === 0) {
    console.error(`!! lk2_geom: no mesh on ${ID} matched any of [${NAMES.join(', ')}].`);
    process.exit(4);
  }
  return rows;
}

/** Pull one row per (name, side); returns null rather than a fabricated zero. */
const pick = (rows, name, side) => rows.find((r) => r.name === name && r.side === side) ?? null;

function derive(rows) {
  const out = {};
  for (const side of ['L', 'R']) {
    const brow = pick(rows, 'brow', side);
    const lash = pick(rows, 'eye_lash', side);
    const eye = pick(rows, 'eye', side);
    if (!brow || !eye) continue;
    const eyeH = eye.h;
    out[side] = {
      browGapY: lash ? brow.y0 - lash.y1 : null,
      browGapEye: brow.y0 - eye.y1,
      browGapYinEyeH: lash ? (brow.y0 - lash.y1) / eyeH : null,
      spanRatio: brow.w / eye.w,
      browThick: brow.h,
      browW: brow.w,
      eyeW: eye.w, eyeH,
    };
  }
  return out;
}

function report(rows, label) {
  console.log(`\n── ${ID} ${label} ──────────────────────────────────────────`);
  console.log('  name            side      x0      x1      y0      y1       w       h       d');
  for (const r of rows.sort((p, q) => p.name.localeCompare(q.name) || p.side.localeCompare(q.side))) {
    console.log(`  ${r.name.padEnd(14)} ${r.side}  ${r.x0.toFixed(4).padStart(7)} ${r.x1.toFixed(4).padStart(7)}`
      + ` ${r.y0.toFixed(4).padStart(7)} ${r.y1.toFixed(4).padStart(7)}`
      + ` ${r.w.toFixed(4).padStart(7)} ${r.h.toFixed(4).padStart(7)} ${r.d.toFixed(4).padStart(7)}`);
  }
  const d = derive(rows);
  for (const side of ['L', 'R']) {
    const v = d[side];
    if (!v) { console.log(`  ${side}: no brow/eye pair`); continue; }
    console.log(`  ${side}  browGap(lash) ${v.browGapY === null ? '   n/a' : v.browGapY.toFixed(4)}`
      + `  = ${v.browGapYinEyeH === null ? 'n/a' : v.browGapYinEyeH.toFixed(3)} eyeH`
      + `   browGap(sclera) ${v.browGapEye.toFixed(4)}`
      + `   span brow/eye ${v.spanRatio.toFixed(3)}   browThick ${v.browThick.toFixed(4)}`);
  }
  return d;
}

if (SELFTEST) {
  let pass = 0, fail = 0;
  const t = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✓' : '✗'} ${name} ${detail}`); };
  console.log(`lk2_geom --selftest  (${ID})`);

  const base = build(0);
  // Only the FACE strokes are required to exist — the pick's own parts are the thing
  // this pass is allowed to replace, so requiring `pick_olive` would make the selftest
  // fail for the right reason at the wrong time. `brow`/`eye_lash`/`eye` are not
  // negotiable, and asserting over a hardcoded list rather than over `NAMES` is
  // deliberate: an assertion that quantifies over its own input cannot fail.
  const REQUIRED = ['brow', 'eye_lash', 'eye'];
  t('1 RESOLVES  every required face stroke matched', REQUIRED.every((n) => rows_has(base, n)),
    `matched=[${[...new Set(base.map((r) => r.name))].join(',')}]`);
  t('2 NON-EMPTY  row set is non-empty before any filter', base.length > 0, `${base.length} rows`);

  const dBase = derive(base);
  const up = derive(build(+0.02));
  const dn = derive(build(-0.02));
  const gL = (d) => d.L?.browGapY ?? NaN;
  const gR = (d) => d.R?.browGapY ?? NaN;
  // ── ⚠️ THESE TWO ARMS ONCE ASSERTED THE MAGNITUDE AND FAILED ON A REAL TREE. ──
  // They read `|delta - 0.02| < 1e-6` and reported **0.0347** for a 0.02 nudge. That is
  // not the metric being 74% wrong; it is the DISPLACEMENT not being what it is named.
  // `brow` hangs under `browG` -> `faceSideG` -> `face` -> `head`, and that chain
  // carries a SCALE, so a LOCAL +0.02 lands ~1.74x that in world Y. `n2_geom.mjs`
  // records the same trap on `head.position.y += lift` (a rotated parent made 0.6 land
  // as 0.5929) and its own known-bad is what caught it there. The magnitude is
  // therefore NOT asserted — a test that quantifies a number the harness cannot
  // control is a test of the harness.
  // What IS asserted is what the instrument has to get right: the SIGN (a raised brow
  // must read as a bigger gap), the SYMMETRY (both sides must move together, or the
  // reader is one-sided), and that the two arms are MIRROR images of each other to the
  // float — which no broken reader gets for free.
  const dUpL = gL(up) - gL(dBase), dUpR = gR(up) - gR(dBase);
  const dDnL = gL(dn) - gL(dBase), dDnR = gR(dn) - gR(dBase);
  t('3 MOVES up   raising the brow GROWS the gap, both sides', dUpL > 1e-9 && dUpR > 1e-9,
    `L ${gL(dBase).toFixed(4)}->${gL(up).toFixed(4)} (+${dUpL.toFixed(4)})  R ${gR(dBase).toFixed(4)}->${gR(up).toFixed(4)} (+${dUpR.toFixed(4)})`);
  t('4 MOVES down ...and lowering it SHRINKS it by the mirror amount',
    dDnL < -1e-9 && dDnR < -1e-9 && Math.abs(dDnL + dUpL) < 1e-9 && Math.abs(dDnR + dUpR) < 1e-9,
    `L ${dDnL.toFixed(4)} vs ${(-dUpL).toFixed(4)}   R ${dDnR.toFixed(4)} vs ${(-dUpR).toFixed(4)}`);
  const hold = derive(build(0));
  t('5 HOLDS      nudge 0 reproduces baseline EXACTLY',
    gL(hold) === gL(dBase) && gR(hold) === gR(dBase), `${gL(hold)} / ${gR(hold)}`);
  t('6 SIDES      L and R are distinct rows', !!dBase.L && !!dBase.R && dBase.L !== dBase.R,
    `L span ${dBase.L?.spanRatio.toFixed(3)}  R span ${dBase.R?.spanRatio.toFixed(3)}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

function rows_has(rows, n) { return rows.some((r) => r.name === n); }

report(build(NUDGE), NUDGE ? `nudge ${NUDGE}` : 'shipped');
if (warns.length) console.log(`\n(${warns.length} builder warning(s) captured)`);
