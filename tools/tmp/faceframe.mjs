#!/usr/bin/env node
/**
 * FACE FRAMING SOLVER — the cheap instrument that lets the crop rule be SWEPT.
 *
 * `tools/tmp/chars_metrics.mjs` is the acceptance test and stays the acceptance test.
 * It is also 28.9 s of SwiftShader per viewport before it can report anything, because
 * it waits on `window.__thumbsReady` (never a clock — a fixed 2.5 s AND a fixed 15 s
 * both captured emoji placeholders, and a critic scored the blanks twice). Three
 * viewports is ~5 minutes per candidate. A crop rule with six constants in it cannot be
 * tuned at five minutes a probe, and `docs/LESSONS.md` §2 is explicit that the way out
 * of that is an instrument, not more rounds.
 *
 * So this computes the SAME answer without rendering anything:
 *
 *   * FACE-OUT is decided entirely by geometry — the rig's own `face` joint box, the
 *     camera the framing rule solves for, and the card's object-fit window. Not one
 *     pixel is involved. That also makes it immune to the cast-wide ALBEDO pass a peer
 *     is running right now: a colour-keyed measurement would move under it, a
 *     joint-box projection cannot.
 *   * `CameraRig` is pure trigonometry with no renderer in it, so the exact camera
 *     `thumbs.ts` will use can be solved in a page with no WebGL context at all.
 *   * The card's own geometry is read from the REAL screen at the REAL viewport, with a
 *     dummy 416x496 render injected so `has-render` is on — that class hides the emoji
 *     placeholder and bottom-anchors the content, and the row heights differ without it.
 *
 * Two things it measures that `chars_metrics` does not:
 *
 *   1. **FACE-BEHIND-NAMEPLATE.** The first version of this framing anchored on the head
 *      and put Lollipop's eyes at 91% of the frame — measured FACE-OUT: none, because
 *      they were inside the card and merely underneath the type. Overlap of the face
 *      rect with `.chars-card-name` / `.chars-card-rarity` is computed here explicitly.
 *   2. A whole parameter set at once (`--sweep`), so a clamp can be chosen from a table
 *      instead of from three renders.
 *
 * ⚠️ VALIDATE BEFORE BELIEVING (LESSONS §13). `--validate` re-runs the SHIPPED constants
 * and prints its FACE-OUT verdicts next to the ones `chars_metrics` recorded in its own
 * JSON, per character per viewport. If the two disagree anywhere, this file is wrong and
 * nothing it says about a candidate means anything.
 *
 *   node tools/tmp/faceframe.mjs --url <snap> --cards shots/roster/cards.json
 *   node tools/tmp/faceframe.mjs --url <snap> --cards ... --validate shots/roster/before.json
 *   node tools/tmp/faceframe.mjs --url <snap> --cards ... --sweep
 */

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { settleScreen } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
];

const VIEWPORTS = [
  { name: 'desktop', w: 1600, h: 900 },
  { name: 'phone-land', w: 844, h: 390 },
  { name: 'phone-portrait', w: 430, h: 932 },
];

const SEED_PROFILE = {
  name: 'Chef', wins: 40, losses: 22, xp: 4180, selected: 'hamburger',
  economy: {
    trophies: 3170, bestTrophies: 3170, coins: 4210, gems: 96,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], winsTowardChest: 1, lastMatch: null,
    seed: 12345, rolls: 7,
  },
};

/** The constants `src/ui/screens/thumbs.ts` currently ships. Keep in step with that file:
 *  `--validate` is only a check on THIS probe if the two are solving the same rule. */
const SHIPPED = {
  SIZE_W: 416, SIZE_H: 496,
  WAIST_FRAC: 0.42, FACE_PAD: 0.07, TOP_PAD: 0.08,
  FACE_FLOOR: 0.66, HEAD_CROP: 0.08, FILL_V: 0.92, WIDTH_ALLOW: 1.15,
  // SOLVE off = the shipped world-Y clamp. On = the projected solve, with these.
  SOLVE: true, FACE_FLOOR_PX: 0.70, HEAD_CROP_MAX: 0.18,
  SAFE_X0: 0.035, SAFE_X1: 0.965, SAFE_Y0: 0.045, SAFE_Y1: 0.725,
};

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}

// ── Phase 1: the card's own geometry, from the real screen ───────────────────
/**
 * A 416x496 PNG of flat colour, as a data URL. Injected so `has-render` is on before
 * the (28.9 s) real generation finishes: that class sets `display:none` on the emoji
 * placeholder and `justify-content:flex-end`, and the grid rows resolve differently
 * without it — so reading the card box off a pre-render screen measures the wrong box.
 */
const DUMMY =
  'data:image/svg+xml;base64,' +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="416" height="496"><rect width="416" height="496" fill="#808080"/></svg>').toString('base64');

function readCards(dummy) {
  const imgs = document.querySelectorAll('.chars-card[data-char] .chars-card-render');
  for (const img of imgs) {
    img.src = dummy;
    img.closest('.chars-card').classList.add('has-render');
  }
  return imgs.length;
}

function measureCards() {
  const out = [];
  const NW = 416, NH = 496;
  for (const card of document.querySelectorAll('.chars-card[data-char]')) {
    const id = card.dataset.char;
    const cr = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const bw = (v) => parseFloat(v) || 0;
    const pad = {
      l: cr.left + bw(cs.borderLeftWidth), t: cr.top + bw(cs.borderTopWidth),
      r: cr.right - bw(cs.borderRightWidth), b: cr.bottom - bw(cs.borderBottomWidth),
    };
    const img = card.querySelector('.chars-card-render');
    const er = img.getBoundingClientRect();
    const istyle = getComputedStyle(img);
    const fit = istyle.objectFit;
    const toks = istyle.objectPosition.trim().split(/\s+/);
    const frac = (t) => t.endsWith('%') ? parseFloat(t) / 100
      : t === 'left' || t === 'top' ? 0
        : t === 'right' || t === 'bottom' ? 1
          : t === 'center' ? 0.5 : null;
    const sc = fit === 'cover' ? Math.max(er.width / NW, er.height / NH)
      : Math.min(er.width / NW, er.height / NH);
    const dw = NW * sc, dh = NH * sc;
    const fx = frac(toks[0] ?? '50%'), fy = frac(toks[1] ?? '50%');
    const dx = er.left + (fx === null ? (parseFloat(toks[0]) || 0) : fx * (er.width - dw));
    const dy = er.top + (fy === null ? (parseFloat(toks[1]) || 0) : fy * (er.height - dh));

    // Type that the art must not hide behind: the name plate and the rarity chip.
    const type = [];
    for (const sel of ['.chars-card-name', '.chars-card-rarity']) {
      const n = card.querySelector(sel);
      if (!n) continue;
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = n.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      type.push({ sel, x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
    }

    out.push({
      id,
      pad: { l: +pad.l.toFixed(2), t: +pad.t.toFixed(2), r: +pad.r.toFixed(2), b: +pad.b.toFixed(2) },
      inner: { w: +(pad.r - pad.l).toFixed(2), h: +(pad.b - pad.t).toFixed(2), aspect: +((pad.r - pad.l) / (pad.b - pad.t)).toFixed(3) },
      fit, objectPosition: istyle.objectPosition,
      dx: +dx.toFixed(3), dy: +dy.toFixed(3), sc: +sc.toFixed(5),
      type,
    });
  }
  const roster = document.querySelector('.chars-roster');
  return {
    cards: out,
    cols: roster ? getComputedStyle(roster).gridTemplateColumns.split(' ').length : 0,
  };
}

async function collectCardGeometry(base, outPath) {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const geo = {};
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.addInitScript((p) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private mode */ }
    }, SEED_PROFILE);
    // ⚠️ RETRIED, and the reason is recorded because it reads exactly like a bug in this
    // probe and is not one: the first version died on "Execution context was destroyed,
    // most likely because of a navigation". `--swap` symlinks two files back to the live
    // tree, Vite's watcher can decide a change there needs a FULL RELOAD, and a full
    // reload lands between `waitForFunction` and `evaluate`. `docs/LESSONS.md` §5 records
    // the same symptom being filed as a regression in `menu_accept` when it was a peer's
    // save. Re-reading is the correct response; the numbers are unaffected.
    let measured = null;
    for (let attempt = 0; attempt < 4 && !measured; attempt++) {
      try {
        await page.goto(`${base}/?screen=characters&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 120000 });
        // The card/image rects below are compared against each other as FRACTIONS, so the
        // 0.992 entry scale largely cancels — but the safe-area and absolute-px checks in
        // the same battery do not cancel, and a metric that is right for one column of a
        // table and wrong for another is worse than one that is wrong for all of it.
        await settleScreen(page, { label: 'faceframe:characters' });
        const n = await page.evaluate(readCards, DUMMY);
        // Two rAFs: the class change has to reach layout before the boxes are read.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        measured = { injected: n, ...(await page.evaluate(measureCards)) };
      } catch (e) {
        console.log(`  [faceframe] ${vp.name} attempt ${attempt + 1} lost the context (${String(e).split('\n')[0]}) — retrying`);
      }
    }
    if (!measured) throw new Error(`could not measure card geometry at ${vp.name}`);
    geo[vp.name] = { viewport: `${vp.w}x${vp.h}`, ...measured };
    await page.close();
  }
  await browser.close();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(geo, null, 2));
  return geo;
}

// ── Phase 2: the framing rule, solved in a page with no renderer ─────────────
/**
 * Runs inside the page. Imports `three`, `CameraRig` and the character registry, builds
 * each character exactly as `thumbs.ts` does, and re-solves the framing for every
 * parameter set handed to it. No `Stage`, no WebGL context, no render.
 */
async function solveInPage(paramSets) {
  // `three` is a BARE specifier, which only Vite's own transform can resolve — a plain
  // `import('three')` from a page it did not transform throws. So the specifier is read
  // out of a module Vite HAS transformed, which is exact and survives a version bump of
  // the dep-optimiser's cache-busting query.
  const src = await (await fetch('/src/render/camera.ts')).text();
  const m = /from\s+"([^"]*three[^"]*)"/.exec(src) ?? /from\s+'([^']*three[^']*)'/.exec(src);
  if (!m) throw new Error('could not find the three specifier in the transformed camera.ts');
  const THREE = await import(m[1]);
  const { CameraRig } = await import('/src/render/camera.ts');
  const { createCharacter } = await import('/src/characters/registry.ts');
  const { CHARACTER_IDS } = await import('/src/game/rules.ts');

  const projectBox = (box, camera, w, h) => {
    const v = new THREE.Vector3();
    const centreZ = box.getCenter(v.clone()).applyMatrix4(camera.matrixWorldInverse).z;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .applyMatrix4(camera.matrixWorldInverse);
      v.z = centreZ;
      v.applyMatrix4(camera.projectionMatrix);
      const px = (v.x * 0.5 + 0.5) * w;
      const py = (1 - (v.y * 0.5 + 0.5)) * h;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x: +x0.toFixed(2), y: +y0.toFixed(2), w: +(x1 - x0).toFixed(2), h: +(y1 - y0).toFixed(2) };
  };

  const jointBox = (root, name) => {
    const j = root.getObjectByName(name);
    if (!j) return null;
    const b = new THREE.Box3().setFromObject(j);
    return b.isEmpty() ? null : b;
  };

  /** Every world vertex, cached once per character: the sweep re-uses it per param set. */
  const collectVerts = (root) => {
    const verts = [];
    const v = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const pos = o.geometry?.getAttribute('position');
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        verts.push(v.x, v.y, v.z);
      }
    });
    return new Float64Array(verts);
  };

  const halfWidthAbove = (verts, yCut, right) => {
    let maxAbs = 0;
    for (let i = 0; i < verts.length; i += 3) {
      if (verts[i + 1] < yCut) continue;
      const a = Math.abs(verts[i] * right.x + verts[i + 1] * right.y + verts[i + 2] * right.z);
      if (a > maxAbs) maxAbs = a;
    }
    return maxAbs;
  };

  const out = {};
  for (const id of CHARACTER_IDS) {
    const model = createCharacter(id);
    model.play('idle');
    model.update({ dt: 0.4, elapsed: 0.4, moveSpeed01: 0, health01: 1 });
    model.root.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(model.root);
    const headBox = jointBox(model.root, 'head');
    const faceBox = jointBox(model.root, 'face');
    const verts = collectVerts(model.root);
    const H = Math.max(0.5, box.max.y - box.min.y);
    const yTop = box.max.y;

    out[id] = { params: {}, world: {
      minY: +box.min.y.toFixed(4), maxY: +box.max.y.toFixed(4), H: +H.toFixed(4),
      headY: headBox ? [+headBox.min.y.toFixed(4), +headBox.max.y.toFixed(4)] : null,
      faceY: faceBox ? [+faceBox.min.y.toFixed(4), +faceBox.max.y.toFixed(4)] : null,
      faceX: faceBox ? [+faceBox.min.x.toFixed(4), +faceBox.max.x.toFixed(4)] : null,
      faceZ: faceBox ? [+faceBox.min.z.toFixed(4), +faceBox.max.z.toFixed(4)] : null,
    } };

    for (const P of paramSets) {
      const rig = new CameraRig({
        pitchDeg: 12, yawDeg: 24, frameMode: 'subject',
        subjectHeight: 2.1, subjectFill: 1, targetHeight: 1.05, followLerp: 1,
      });
      rig.setAspect(P.SIZE_W / P.SIZE_H);
      const ASPECT = P.SIZE_W / P.SIZE_H;

      const faceBottom = (faceBox ?? headBox)?.min.y ?? (box.min.y + 0.45 * H);
      const yCut = Math.max(box.min.y, Math.min(box.min.y + P.WAIST_FRAC * H, faceBottom - P.FACE_PAD * H));
      const framedH = Math.max(0.4, yTop - yCut);

      const cam = rig.camera;
      const right = new THREE.Vector3();
      /** Point the rig, then do what `WebGLRenderer.render` does before `thumbs.ts` reads
       *  these matrices — without it `matrixWorldInverse` is one frame stale and every
       *  projected rect silently describes the previous camera. */
      const place = (visibleH, frameTop, pan) => {
        rig.subjectFill = 1;
        rig.subjectHeight = visibleH;
        rig.targetHeight = frameTop - visibleH / 2;
        rig.snapTo(pan * right.x, pan * right.z);
        cam.updateMatrixWorld(true);
        cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      };

      place(framedH / P.FILL_V, yTop + P.TOP_PAD * (framedH / P.FILL_V), 0);
      right.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      const upperHalfW = halfWidthAbove(verts, yCut, right);
      // The ZOOM. Identical in both modes, which is the point: it is the only expression
      // that sets scale, so a difference in FILL between the two can only come from what
      // enters or leaves the frame, never from a different camera distance.
      const visibleH = Math.max(
        framedH / P.FILL_V,
        (2 * upperHalfW) / (ASPECT * P.WIDTH_ALLOW),
        faceBox ? (yTop - faceBox.min.y) / (P.FACE_FLOOR + P.HEAD_CROP) : 0,
      );

      let frameTop = yTop + P.TOP_PAD * visibleH;
      let pan = 0;
      let zoom = visibleH;
      if (faceBox && !P.SOLVE) {
        // The SHIPPED rule: clamp on the world-space bottom of the face box, no pan.
        frameTop = Math.max(
          Math.min(frameTop, faceBox.min.y + P.FACE_FLOOR * visibleH),
          yTop - P.HEAD_CROP * visibleH,
        );
      } else if (faceBox) {
        // The PROJECTED solve: slide down, then sideways, then (never, in practice) zoom.
        for (let pass = 0; pass < 4; pass++) {
          frameTop = yTop + P.TOP_PAD * zoom;
          for (let i = 0; i < 3; i++) {
            place(zoom, frameTop, pan);
            const f = projectBox(faceBox, cam, P.SIZE_W, P.SIZE_H);
            const over = (f.y + f.h) / P.SIZE_H - P.FACE_FLOOR_PX;
            if (over <= 0) break;
            const room = Math.max(0, (f.y / P.SIZE_H - P.SAFE_Y0) * zoom);
            const next = Math.max(yTop - P.HEAD_CROP_MAX * zoom, frameTop - Math.min(over * zoom, room));
            if (Math.abs(next - frameTop) < 1e-4) break;
            frameTop = next;
          }
          place(zoom, frameTop, pan);
          const f = projectBox(faceBox, cam, P.SIZE_W, P.SIZE_H);
          const overR = (f.x + f.w) - P.SAFE_X1 * P.SIZE_W;
          const overL = P.SAFE_X0 * P.SIZE_W - f.x;
          const metresPerPx = (zoom * ASPECT) / P.SIZE_W;
          if (overR > 0 && overL < 0) pan += Math.min(overR, -overL) * metresPerPx;
          else if (overL > 0 && overR < 0) pan -= Math.min(overL, -overR) * metresPerPx;
          const tooWide = f.w / ((P.SAFE_X1 - P.SAFE_X0) * P.SIZE_W);
          const bottom = (f.y + f.h) / P.SIZE_H;
          const tooLow = bottom > P.SAFE_Y1 ? (bottom + P.HEAD_CROP_MAX) / (P.SAFE_Y1 + P.HEAD_CROP_MAX) : 1;
          const grow = Math.max(tooWide, tooLow);
          if (grow <= 1.001) break;
          zoom *= grow;
        }
      }
      place(zoom, frameTop, pan);

      out[id].params[P.name] = {
        subject: projectBox(box, cam, P.SIZE_W, P.SIZE_H),
        head: headBox ? projectBox(headBox, cam, P.SIZE_W, P.SIZE_H) : null,
        face: faceBox ? projectBox(faceBox, cam, P.SIZE_W, P.SIZE_H) : null,
        yCut: +yCut.toFixed(4),
        upperHalfWidth: +upperHalfW.toFixed(4),
        subjectHeight: +rig.subjectHeight.toFixed(4),
        targetHeight: +rig.targetHeight.toFixed(4),
        headroom: +((frameTop - yTop) / zoom).toFixed(4),
        pan: +pan.toFixed(4),
      };
    }
    model.dispose?.();
  }
  return out;
}

async function solve(base, paramSets) {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  // A blank page ON THE SNAPSHOT'S ORIGIN, so `import('/src/...')` resolves through
  // Vite. Going to `/` instead would boot the whole game (a Stage, a WebGL context and
  // the 28.9 s thumbnail batch) purely to get an origin.
  await page.route('**/__faceframe.html', (route) => route.fulfill({
    status: 200, contentType: 'text/html',
    body: '<!doctype html><meta charset="utf-8"><title>faceframe</title><body></body>',
  }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/__faceframe.html`, { waitUntil: 'domcontentloaded' });
  const res = await page.evaluate(solveInPage, paramSets);
  await browser.close();
  if (errors.length) console.error('page errors:', errors.slice(0, 3));
  return res;
}

// ── Combine: source-pixel rects -> card space -> verdicts ────────────────────
function toCard(r, g) {
  return { x: g.dx + r.x * g.sc, y: g.dy + r.y * g.sc, w: r.w * g.sc, h: r.h * g.sc };
}
function outside(r, pad) {
  return {
    left: +Math.max(0, pad.l - r.x).toFixed(1),
    right: +Math.max(0, (r.x + r.w) - pad.r).toFixed(1),
    top: +Math.max(0, pad.t - r.y).toFixed(1),
    bottom: +Math.max(0, (r.y + r.h) - pad.b).toFixed(1),
  };
}
const fmtOut = (v) => [v.left && `L${v.left}`, v.right && `R${v.right}`, v.top && `T${v.top}`, v.bottom && `B${v.bottom}`]
  .filter(Boolean).join(' ') || 'none';

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function evaluate(geo, solved, setName) {
  const rows = [];
  for (const [vpName, g] of Object.entries(geo)) {
    for (const card of g.cards) {
      const s = solved[card.id];
      if (!s) continue;
      const p = s.params[setName];
      if (!p) continue;
      const subj = toCard(p.subject, card);
      const face = p.face ? toCard(p.face, card) : null;
      const head = p.head ? toCard(p.head, card) : null;
      const pad = card.pad;
      const cardArea = card.inner.w * card.inner.h;
      const typeHit = face ? card.type.reduce((a, t) => a + overlapArea(face, t), 0) : 0;
      rows.push({
        vp: vpName, id: card.id,
        inner: card.inner,
        subjOut: outside(subj, pad),
        faceOut: face ? outside(face, pad) : null,
        headOut: head ? outside(head, pad) : null,
        facePx: face ? +face.h.toFixed(1) : null,
        faceWPx: face ? +face.w.toFixed(1) : null,
        headPx: head ? +head.h.toFixed(1) : null,
        bboxFill: +((subj.w * subj.h) / cardArea).toFixed(4),
        // Fraction of the face rect hidden under the name / rarity type.
        faceUnderType: face ? +(typeHit / (face.w * face.h)).toFixed(3) : null,
        faceBottomFrac: face ? +(((face.y + face.h) - pad.t) / card.inner.h).toFixed(3) : null,
      });
    }
  }
  return rows;
}

function summarise(rows, label) {
  const bad = rows.filter((r) => r.faceOut && fmtOut(r.faceOut) !== 'none');
  const typed = rows.filter((r) => (r.faceUnderType ?? 0) > 0.02);
  const byVp = {};
  for (const r of rows) (byVp[r.vp] ??= []).push(r);
  console.log(`\n══ ${label} ══`);
  for (const [vp, rs] of Object.entries(byVp)) {
    const mb = rs.reduce((a, r) => a + r.bboxFill, 0) / rs.length;
    const mf = rs.filter((r) => r.facePx).reduce((a, r) => a + r.facePx, 0) / Math.max(1, rs.filter((r) => r.facePx).length);
    console.log(`  ${vp.padEnd(15)} card ${rs[0].inner.w}x${rs[0].inner.h} (${rs[0].inner.aspect})  bboxFill ${(mb * 100).toFixed(1)}%  face ${mf.toFixed(1)}px mean`);
    for (const r of rs) {
      const fo = r.faceOut ? fmtOut(r.faceOut) : 'no-face';
      const flag = fo !== 'none' && fo !== 'no-face' ? ' <<< FACE-OUT' : '';
      const ut = (r.faceUnderType ?? 0) > 0.02 ? `  UNDER-TYPE ${(r.faceUnderType * 100).toFixed(0)}%` : '';
      console.log(`    ${r.id.padEnd(12)} bbox ${(r.bboxFill * 100).toFixed(1).padStart(5)}%  face ${String(r.facePx).padStart(5)}x${String(r.faceWPx).padStart(5)}  faceBot ${String(r.faceBottomFrac).padStart(5)}  FACE-OUT[${fo}]${flag}${ut}`);
    }
  }
  console.log(`  -> FACE-OUT rows ${bad.length}/${rows.length}   UNDER-TYPE rows ${typed.length}/${rows.length}`);
  return { faceOut: bad.length, underType: typed.length, rows: rows.length };
}

async function run() {
  const args = parseArgs(process.argv);
  const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
  const cardsPath = args.cards ?? 'shots/roster/cards.json';

  let geo;
  if (existsSync(cardsPath) && !args.recards) {
    geo = JSON.parse(await readFile(cardsPath, 'utf8'));
    console.log(`[faceframe] card geometry from ${cardsPath}`);
  } else {
    console.log('[faceframe] measuring card geometry from the real screen...');
    geo = await collectCardGeometry(base, cardsPath);
  }

  const sets = [{ name: 'shipped', ...SHIPPED }];
  if (args.sweep) {
    const cand = JSON.parse(await readFile(args.sweep === true ? 'tools/tmp/faceframe.sweep.json' : args.sweep, 'utf8'));
    for (const c of cand) sets.push({ ...SHIPPED, ...c });
  }

  const solved = await solve(base, sets);
  if (args.out) await writeFile(args.out, JSON.stringify({ geo, solved }, null, 2));

  const results = {};
  for (const s of sets) results[s.name] = summarise(evaluate(geo, solved, s.name), s.name);

  if (args.validate) {
    const ref = JSON.parse(await readFile(args.validate, 'utf8'));
    console.log('\n══ VALIDATION: this probe vs chars_metrics on the SAME (shipped) rule ══');
    let agree = 0, disagree = 0;
    const mine = evaluate(geo, solved, 'shipped');
    for (const rep of ref.reports) {
      for (const c of rep.grid.cards) {
        if (!c.faceOverflow) continue;
        const m = mine.find((r) => r.vp === rep.vp && r.id === c.id);
        if (!m) continue;
        const a = fmtOut(c.faceOverflow), b = fmtOut(m.faceOut);
        const same = (a === 'none') === (b === 'none');
        if (same) agree++; else { disagree++; console.log(`   X ${rep.vp}/${c.id}: chars_metrics [${a}] vs faceframe [${b}]`); }
        const dh = Math.abs((c.facePx ?? 0) - (m.facePx ?? 0));
        if (dh > 1.5) console.log(`   ~ ${rep.vp}/${c.id}: face height ${c.facePx} vs ${m.facePx} (d ${dh.toFixed(1)}px)`);
      }
    }
    console.log(`   FACE-OUT verdicts: ${agree} agree, ${disagree} disagree`);
    if (disagree) { console.log('   !! INSTRUMENT DISAGREES — do not act on any sweep from this run.'); process.exitCode = 1; }
  }

  console.log('');
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k.padEnd(18)} FACE-OUT ${String(v.faceOut).padStart(3)}   UNDER-TYPE ${String(v.underType).padStart(3)}   of ${v.rows}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
