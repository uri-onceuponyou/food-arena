#!/usr/bin/env node
/**
 * pp_ours — isolate ONE character into named PARTS and emit one crop per part.
 *
 * THROWAWAY, READ-ONLY on src/. This is a measurement instrument; it changes no
 * game code.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * A blind critic scoring a WHOLE character has a measured +/-1.4 floor and cannot
 * localise: "the cast looks unfinished" tells nobody which part to fix. The
 * hypothesis is that one part per panel cuts the noise the other twelve parts
 * contribute. This tool makes that testable by producing, for each part, a crop
 * that contains that part AND NOTHING ELSE, on a field chosen so the crop cannot
 * itself be the difference being judged.
 *
 * ── THE FOUR THINGS THAT WOULD MAKE THIS WORTHLESS, AND WHAT IS DONE ABOUT THEM
 *
 * 1. POLARITY (docs/LESSONS.md §13). `src/preview.ts` once set a saturated cyan
 *    backdrop, so a character measured DARKER than its surround (-0.40) while the
 *    shipped match shows it LIGHTER (+0.27) — opposite sign, and every character
 *    packet ever judged here was judged against it. `preview.ts` has since been
 *    fixed to `0x3d2b21`; this tool does NOT take that on trust. It measures
 *    boundary figure/ground on every panel it emits, against the shipped view's
 *    OWN uncomposited control, and exits 3 if the whole-figure panel inverts.
 *    KNOWN-BAD: `--field 39b7e8` mats every panel onto the old cyan. The guard
 *    then reads 0/13 positive and the whole-figure delta goes from -0.003 to
 *    -0.257. A guard not shown to FAIL is not a guard.
 *
 * 2. PITCH. `limbcheck` measures the preview's 22 degrees while the MATCH camera
 *    is 58, and at 58 idle passes go 8/11 -> 0/11. Neither is right here. The
 *    reference plates for part-level work are character-DETAIL views shot at
 *    near-eye-level; our shipped analogue is `src/ui/screens/charStage.ts`, which
 *    is `pitchDeg: 20, yawDeg: 0, subjectFill: 0.60`. So the default is exactly
 *    that camera — a SHIPPED one, matched to the reference's view class. Findings
 *    here are about the character-detail screen and must be re-checked at 58
 *    before being credited to the cast-in-match score.
 *
 * 3. FRAMING. `docs/LESSONS.md` §6: isolation views sat at 265wu while the game
 *    showed ~578wu, so every arena loop was judged at ~3.5x the real zoom. This
 *    tool BLOWS PARTS UP — a hand is ~40 px tall on the shipped character-select
 *    screen and cannot be compared to anything at that size. That is a deliberate
 *    and different question from "does this part read at shipped size", so
 *    `pp_pack.mjs` emits `shippedSize.blowUpVsShipped` per part (x0.63 for the
 *    whole figure, x13.06 for the mouth) and nobody can confuse the two.
 *
 * 4. ID BUFFERS. Not used, and deliberately: `renderer.outputColorSpace` is sRGB,
 *    so linear-written IDs are transfer-encoded and quantise into the wrong slot —
 *    that once produced an entirely fictional list of zero-pixel meshes. Parts are
 *    separated by toggling `mesh.visible` per MESH (never per group: `visible` is
 *    inherited, which is why `occluder.mjs`/`detach.mjs` exist) and matting the
 *    result against a chroma clear colour, the same technique `limbcheck` uses.
 *
 * ── WHAT ELSE IS EMITTED, AND WHY ────────────────────────────────────────────
 * `delivered` — the hide-vs-base pixel diff from `limbcheck`. An isolated part is
 * shown IN FULL even when the shipped render buries it inside the body, so a part
 * with `delivered` near zero must not be judged as if the player can see it. That
 * distinction is exactly what found nine characters' limbs buried in their own
 * bodies, and isolation on its own destroys it.
 */
/**
 * capture-audit: css-immune — `gl.readPixels()` on `preview.html`, which mounts no
 * shell: no `#boot`, no curtain, no `.fa-screen`. There is no fade to be caught
 * inside. The paint guard used instead is `__previewReady` PLUS a frame-statistics
 * floor on the drawing buffer itself, asserted below.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  FIELD, flipY, cropRGBA, dilate, compositeOnField, bboxOf, figureGround,
  fieldStats, panelStats, writeRGBA, rgbDist,
} from './pp_lib.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173');
const ID = get('--id', 'hamburger');
const OUT = get('--out', 'shots/perpart');
const PITCH = get('--pitch', '20');      // charStage.ts's shipped character-detail pitch
const YAW = get('--yaw', '0');           // charStage.ts ships yaw 0
const FILL = get('--fill', '0.60');      // charStage.ts's subjectFill
const T = get('--t', '1.5');
const ANIM = get('--anim', 'idle');
const BG = get('--bg', '3d2b21');        // preview.ts's own default; overridable for the known-bad
const W = Number(get('--w', 900)), H = Number(get('--h', 1400));
const TAG = get('--tag', 'ours');
/** Extra px kept around a part's bbox so an outline hull / AA fringe is never clipped. */
const PAD = Number(get('--pad', 10));
/** Mask dilation before compositing — the outline hull sits OUTSIDE the lit mesh. */
const GROW = Number(get('--grow', 8));
/** Margin around a paired panel's part box, as a fraction of its larger side. */
const PAIR_MARGIN = Number(get('--pairMargin', 0.12));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/**
 * PART DECOMPOSITION for `hamburger`, derived from `src/characters/hamburger.ts`
 * and `src/characters/rig.ts` — a structural decomposition already exists, so it
 * is read rather than invented.
 *
 * `jointKey` is the nearest named rig joint above the mesh (`limbcheck`'s
 * `groupKey`); `name` is the mesh's own name with any `__outline` suffix stripped,
 * because `toon.ts:582` names an outline hull `<mesh>__outline` and parents it as
 * a SIBLING — isolating a mesh without its hull leaves the ink behind on the
 * others, and isolating a hull without its mesh emits a black shell.
 */
const CLASSIFY = `(jointKey, rawName) => {
  const n = rawName.replace(/__outline$/, '');
  if (n.startsWith('spatula')) return 'prop';          // parented to joints.handR
  if (jointKey === 'face') {
    if (n === 'mouth') return 'mouth';
    if (n === 'eye' || n === 'brow') return 'eyes';
    return 'face-other';                                // blush
  }
  if (jointKey === 'head') return (n === 'crown' || n === 'sesame_seed') ? 'crown' : 'foodstack';
  if (jointKey === 'torso') return n.startsWith('apron_') ? 'decoration' : 'torso';
  if (['shoulderL','shoulderR','elbowL','elbowR'].includes(jointKey)) return 'arms';
  if (jointKey === 'handL') return 'handL';
  if (jointKey === 'handR') return 'handR';   // the spatula hand — occluded by its own prop
  if (['hipL','hipR','kneeL','kneeR'].includes(jointKey)) return 'legs';
  if (['footL','footR'].includes(jointKey)) return 'feet';
  return 'unclassified:' + jointKey;
}`;

const ALL_LEAVES = ['foodstack', 'crown', 'eyes', 'mouth', 'face-other', 'torso', 'decoration', 'arms', 'handL', 'handR', 'legs', 'feet', 'prop'];

/**
 * PANEL SPEC per part. Two KINDS, and the distinction is not cosmetic.
 *
 * `standalone` — a body mass. Rendered alone against the field. The thing being
 *   judged is the part's own form, and its figure/ground against the backdrop is
 *   the same relationship the whole character has, so the §13 polarity guard
 *   applies directly.
 *
 * `inset` — a FEATURE that lives ON another surface: eyes, mouth, apron. Round 2
 *   of this tool rendered these alone against the field too, and the numbers
 *   caught it: the eyes read +0.088 against the field while in the real render
 *   they are -0.469 against the bun they sit on. Dark decals on a light head are
 *   SUPPOSED to be darker than what they sit on — rendering them against a dark
 *   backdrop flips that, and a critic would then be scoring a relationship the
 *   game does not contain. So an inset part is rendered WITH its substrate and
 *   cropped tight to the feature: still a ~15x noise reduction against the whole
 *   character, without inventing a figure/ground that does not exist.
 *   `pad` is a fraction of the feature's larger dimension.
 */
const PANELS = {
  'silhouette-whole': { kind: 'standalone', show: ALL_LEAVES, crop: ALL_LEAVES, binary: true },
  'figure-whole': { kind: 'standalone', show: ALL_LEAVES, crop: ALL_LEAVES },
  head: { kind: 'standalone', show: ['foodstack', 'crown', 'eyes', 'mouth', 'face-other'], crop: ['foodstack', 'crown', 'eyes', 'mouth', 'face-other'] },
  'face-overall': { kind: 'inset', show: ['crown', 'foodstack', 'eyes', 'mouth', 'face-other'], crop: ['eyes', 'mouth', 'face-other'], pad: 0.45 },
  eyes: { kind: 'inset', show: ['crown', 'foodstack', 'eyes'], crop: ['eyes'], pad: 0.60 },
  mouth: { kind: 'inset', show: ['crown', 'foodstack', 'mouth'], crop: ['mouth'], pad: 1.30 },
  crown: { kind: 'standalone', show: ['crown'], crop: ['crown'] },
  torso: { kind: 'standalone', show: ['torso'], crop: ['torso'] },
  arms: { kind: 'standalone', show: ['arms'], crop: ['arms'] },
  // ONE hand, not both: `handR` grips the spatula, so a both-hands panel is half
  // prop. The reference's free hand is its own clean crop for the same reason.
  hands: { kind: 'standalone', show: ['handL'], crop: ['handL'] },
  legs: { kind: 'standalone', show: ['legs'], crop: ['legs'] },
  feet: { kind: 'standalone', show: ['feet'], crop: ['feet'] },
  decoration: { kind: 'inset', show: ['torso', 'decoration'], crop: ['decoration'], pad: 0.30 },
  prop: { kind: 'standalone', show: ['prop'], crop: ['prop'] },
};

const TOOLKIT = (classifySrc) => {
  const stage = window.__stage, scene = stage.scene, renderer = stage.renderer;
  const gl = renderer.getContext(), cv = renderer.domElement;
  const W = cv.width, H = cv.height;
  const K = {}; window.__K = K;
  K.W = W; K.H = H; K.stage = stage; K.scene = scene;
  K.classify = eval(classifySrc);
  K.read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return Array.from(p); };
  K.readRaw = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };

  // The character root: the scene child that contains a mesh under a `head` joint.
  K.resolveRoot = () => {
    for (const c of scene.children) {
      if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
      let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
      if (has) return c;
    }
    return null;
  };
  K.root = K.resolveRoot();
  K.ground = scene.getObjectByName('preview_ground') ?? null;
  K.JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'rig_body', 'rig_root'];
  K.jointKey = (o) => {
    let n = o;
    while (n) { if (K.JOINTS.includes(n.name)) return n.name; if (n === K.root) break; n = n.parent; }
    return 'other';
  };
  K.meshes = () => { const out = []; K.root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };

  K.index = () => {
    const all = K.meshes();
    const byPart = new Map();
    const rows = [];
    all.forEach((m, i) => {
      const jk = K.jointKey(m);
      const p = K.classify(jk, m.name || '');
      if (!byPart.has(p)) byPart.set(p, []);
      byPart.get(p).push(i);
      rows.push({ i, name: m.name || '(unnamed)', joint: jk, part: p, outline: /__outline$/.test(m.name || '') });
    });
    K.all = all;
    K.byPart = byPart;
    return { rows, parts: [...byPart.entries()].map(([k, v]) => [k, v.length]) };
  };

  /** No-post chroma render — the MASK source. Same shape as `limbcheck`'s plain(). */
  K.plain = (clear) => {
    const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
    scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(null); renderer.setClearColor(clear, 1); renderer.clear();
    renderer.render(scene, stage.rig.camera);
    const px = K.readRaw();
    scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
    return px;
  };
  K.maskFromChroma = (px) => {
    const m = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) m[j] = (px[i] < 60 && px[i + 1] > 180 && px[i + 2] < 60) ? 0 : 1;
    return m;
  };
  /** Full shipped post chain into the default framebuffer, then read it back. */
  K.shipped = () => { stage.render(0); stage.render(0); return K.readRaw(); };

  K.setVisible = (idxs) => {
    const want = new Set(idxs);
    K.all.forEach((m, i) => { m.visible = want.has(i); });
  };
  K.showAll = () => { K.all.forEach((m) => { m.visible = true; }); };
  K.setGround = (v) => { if (K.ground) K.ground.visible = v; };
  K.shipBg = scene.background;   // the real charStage backdrop, restored after every panel
  K.panelBg = scene.background;  // replaced by the solve below
  K.b64 = (u8) => {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  };
};

async function main() {
  const url = `${BASE}/preview.html?piece=character&id=${ID}&pitch=${PITCH}&yaw=${YAW}&fill=${FILL}`
    + `&t=${T}&anim=${ANIM}&shot=1&bg=${BG}`;
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });

  await page.evaluate(TOOLKIT, CLASSIFY);
  const idx = await page.evaluate(() => window.__K.index());

  // ── PAINT FLOOR ────────────────────────────────────────────────────────────
  // `__previewReady` is a flag; a flag is not a paint. preview.html has no shell to
  // fade, but a lost-context or pre-first-draw buffer is still flat. The floor is
  // asserted on the drawing buffer, not on the DOM.
  const floor = await page.evaluate(() => {
    const K = window.__K; K.showAll(); K.setGround(true);
    const px = K.shipped();
    let s = 0, s2 = 0; const n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) { const L = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255; s += L; s2 += L * L; }
    return { mean: s / n, std: Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) };
  });
  if (!(floor.std > 0.02)) throw new Error(`frame-statistics floor FAILED: std ${floor.std.toFixed(4)} — the buffer is flat, nothing was drawn`);

  // ── The base frame, ground ON: the shipped character-detail view ───────────
  // Used ONLY for `delivered` (hide-vs-base) and for the shipped-polarity control.
  const shippedCtl = await page.evaluate(() => {
    const K = window.__K;
    K.showAll(); K.setGround(true);
    const post = K.shipped();
    const chroma = K.plain(0x00ff00);
    return { post: K.b64(post), chroma: K.b64(chroma) };
  });

  const decode = (b64) => ({ data: Buffer.from(b64, 'base64'), width: W, height: H });

  // ── THE FIELD IS MEASURED, NOT ASSUMED ─────────────────────────────────────
  // Round 1 of this tool composited onto the raw clear colour `0x3d2b21` and every
  // panel read figure/ground NEGATIVE (-0.07..-0.11) against a shipped +0.39 — the
  // exact inversion of docs/LESSONS.md §13, recreated by my own harness.
  //
  // Cause, and it is not the clear colour: `ToyGradeEffect`'s shadow toe
  // (0.28@0.60) plus a 0.20 vignette take that backdrop from luma 0.181 to ~0.08
  // by the time it reaches the screen. So the value a player actually sees behind
  // a character is the POST-GRADED backdrop, and pasting post-graded subject
  // pixels onto the PRE-grade colour puts the figure against a ground 0.10 luma
  // brighter than the game ever shows. The field is therefore read back off an
  // EMPTY shipped render — nothing visible, ground off — and its spatial spread is
  // reported so the residual is a number rather than an assumption.
  const emptyB64 = await page.evaluate(() => {
    const K = window.__K;
    K.setGround(false);
    K.setVisible([]);
    const px = K.shipped();
    K.showAll(); K.setGround(true);
    return K.b64(px);
  });
  const emptyImg = flipY(decode(emptyB64));
  const measuredField = (() => {
    // Median over the central 60% — where every part actually sits — so a corner
    // vignette cannot drag the value the parts are matted against.
    const rs = [], gs = [], bs = [];
    const x0 = Math.floor(W * 0.2), x1 = Math.ceil(W * 0.8);
    const y0 = Math.floor(H * 0.2), y1 = Math.ceil(H * 0.8);
    for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) {
      const i = (y * W + x) * 4;
      rs.push(emptyImg.data[i]); gs.push(emptyImg.data[i + 1]); bs.push(emptyImg.data[i + 2]);
    }
    const med = (v) => { v.sort((p, q) => p - q); return v[v.length >> 1]; };
    return { r: med(rs), g: med(gs), b: med(bs) };
  })();
  const fieldSpread = (() => {
    let n = 0, s = 0, s2 = 0, mn = 1, mx = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      const L = (0.2126 * emptyImg.data[i] + 0.7152 * emptyImg.data[i + 1] + 0.0722 * emptyImg.data[i + 2]) / 255;
      s += L; s2 += L * L; n++; if (L < mn) mn = L; if (L > mx) mx = L;
    }
    const m = s / n;
    return { lumaMean: +m.toFixed(4), lumaStd: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(4), lumaMin: +mn.toFixed(4), lumaMax: +mx.toFixed(4) };
  })();
  console.log(`measured field (empty SHIPPED render): rgb(${measuredField.r},${measuredField.g},${measuredField.b})`
    + ` luma ${fieldSpread.lumaMean} +/- ${fieldSpread.lumaStd} (range ${fieldSpread.lumaMin}..${fieldSpread.lumaMax})`);
  console.log(`  vs the pre-grade clear colour 0x${BG}: that is what round 1 used and it inverted every panel.`);
  const shipPost = flipY(decode(shippedCtl.post));

  // ── per-leaf-part delivered pixels (hide-vs-base), from the no-post render ──
  const delivered = await page.evaluate(() => {
    const K = window.__K;
    K.showAll(); K.setGround(false);
    const base = K.plain(0x00ff00);
    const out = {};
    for (const [part, idxs] of K.byPart) {
      const set = new Set(idxs);
      K.all.forEach((m, i) => { m.visible = !set.has(i); });
      const hid = K.plain(0x00ff00);
      let contrib = 0;
      for (let i = 0; i < base.length; i += 4) {
        const d = Math.abs(base[i] - hid[i]) + Math.abs(base[i + 1] - hid[i + 1]) + Math.abs(base[i + 2] - hid[i + 2]);
        if (d > 12) contrib++;
      }
      K.setVisible(idxs);
      const iso = K.plain(0x00ff00);
      const im = K.maskFromChroma(iso);
      let foot = 0; for (let j = 0; j < im.length; j++) foot += im[j];
      out[part] = { foot, contrib, ratio: foot ? +(contrib / foot).toFixed(3) : null };
      K.showAll();
    }
    return out;
  });

  // Base chroma with everything visible and the ground off — the reference frame
  // for "how much of this part actually reaches the screen".
  const baseChroma = flipY(decode(await page.evaluate(() => {
    const K = window.__K; K.showAll(); K.setGround(false);
    const px = K.plain(0x00ff00); K.setGround(true); return K.b64(px);
  })));

  // ── THE SHIPPED-VIEW POLARITY CONTROL ──────────────────────────────────────
  // The CHARACTER's mask (ground hidden in the chroma pass) evaluated on the FULL
  // shipped render (ground shown). Round 2 took the mask from a chroma pass with
  // the ground still visible, so `shipMask` was character UNION ground disc and
  // the "figure/ground" it reported (+0.3927) was the ground DISC's rim against
  // the sky — a number with nothing to do with the character. A mask from one
  // render and a value from another is a lie wherever they disagree
  // (docs/LESSONS.md §5), and here they disagreed about what the figure was.
  const charMask = new Uint8Array(W * H);
  for (let j = 0, i = 0; j < W * H; j++, i += 4) {
    charMask[j] = (baseChroma.data[i] < 60 && baseChroma.data[i + 1] > 180 && baseChroma.data[i + 2] < 60) ? 0 : 1;
  }
  const shippedFG = figureGround(shipPost, charMask, 4);
  let figurePostB64 = null;   // filled after the field is solved

  // ── AND THE FIELD IS THE SHIPPED SURROUND, NOT THE SKY ─────────────────────
  // Round 3 matted onto the empty backdrop (luma 0.079) and `figure-whole` then
  // separated at +0.316 against a shipped +0.068 — right SIGN, 4.6x the
  // MAGNITUDE. Sign alone is not "reproduces the shipped figure/ground"; a panel
  // that hands a critic five times the separation the player gets is still a
  // harness artefact, just a flattering one. So the field is the mean colour of
  // the pixels actually behind the character at its own boundary in the real
  // charStage render, and `figure-whole`'s panel contrast is asserted against
  // `shippedFG` below as this instrument's magnitude control.
  const surroundColour = (() => {
    const grown = dilate(charMask, W, H, 4);
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = 0, i = 0; j < W * H; j++, i += 4) {
      if (charMask[j] || !grown[j]) continue;
      r += shipPost.data[i]; g += shipPost.data[i + 1]; b += shipPost.data[i + 2]; n++;
    }
    return n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), n } : null;
  })();
  const FIELD_OVERRIDE = get('--field', null);
  const target = FIELD_OVERRIDE
    ? { r: parseInt(FIELD_OVERRIDE.slice(0, 2), 16), g: parseInt(FIELD_OVERRIDE.slice(2, 4), 16), b: parseInt(FIELD_OVERRIDE.slice(4, 6), 16) }
    : surroundColour;
  console.log(`field TARGET rgb(${target.r},${target.g},${target.b}) luma `
    + `${((0.2126 * target.r + 0.7152 * target.g + 0.0722 * target.b) / 255).toFixed(4)}`
    + (FIELD_OVERRIDE ? '  [FORCED via --field]' : `  [= the shipped surround, n=${surroundColour.n} px at the character's own boundary]`));

  // ── SOLVE THE CLEAR COLOUR SO THE RENDERED BACKDROP *IS* THE FIELD ─────────
  // Round 4 composited the field in afterwards and `figure-whole` still read
  // +0.252 against a shipped +0.068. Cause: the composite keeps the render's own
  // pixels inside a 3 px grown mask so the outline hull survives, and those 3 px
  // are the DARK post-graded backdrop (0.079). The 4 px surround band therefore
  // averaged (3x0.079 + 1x0.343)/4 = 0.146, not 0.343 — the same self-inflicted
  // contamination as round 1, mirrored.
  //
  // Compositing cannot fix that without inventing an alpha the aliased chroma pass
  // does not have. So the backdrop is made correct BEFORE the render instead:
  // Newton-solve the pre-grade clear colour whose POST-GRADED value equals the
  // target. Then the AA fringe, the bloom spill and the outline hull all blend
  // against the right colour because they were RENDERED against it.
  const solve = await page.evaluate(async ({ target }) => {
    const K = window.__K, THREEColor = K.scene.background?.constructor;
    K.setGround(false); K.setVisible([]);
    const centre = () => {
      const px = K.shipped();
      const x = (K.W >> 1), y = (K.H >> 1);
      const i = (y * K.W + x) * 4;
      return { r: px[i], g: px[i + 1], b: px[i + 2] };
    };
    // 1-D BISECTION along the target's own hue ray, NOT per-channel Newton.
    // Per-channel Newton was tried first and diverged to rgb(190,69,74) — a RED
    // field for a neutral target — because `ToyGradeEffect` extrapolates each
    // channel away from the arithmetic mean, so the three channels are COUPLED and
    // three independent 1-D solvers fight each other. Scaling one colour keeps the
    // hue fixed, which is the direction the grade leaves alone, and luma under the
    // grade is monotonic in that scalar. Bisection needs no derivative.
    const L = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    const targetL = L(target);
    const unit = { r: target.r / 255, g: target.g / 255, b: target.b / 255 };
    const at = (k) => ({ r: Math.max(0, Math.min(255, unit.r * 255 * k)), g: Math.max(0, Math.min(255, unit.g * 255 * k)), b: Math.max(0, Math.min(255, unit.b * 255 * k)) });
    let lo = 0, hi = 3.5;
    const trace = [];
    let c = at(1);
    for (let it = 0; it < 16; it++) {
      const k = (lo + hi) / 2;
      c = at(k);
      K.scene.background = new THREEColor(c.r / 255, c.g / 255, c.b / 255);
      const got = centre();
      trace.push({ it, k: +k.toFixed(4), clear: { ...c }, got, gotL: +L(got).toFixed(4) });
      if (L(got) < targetL) lo = k; else hi = k;
      if (Math.abs(L(got) - targetL) < 0.001) break;
    }
    K.panelBg = new THREEColor(c.r / 255, c.g / 255, c.b / 255);
    // How flat is the field the panels are actually rendered against? The vignette
    // is 0.20 at offset 0.42, so this is a number, not an assumption.
    K.scene.background = K.panelBg;
    const px = K.shipped();
    let n = 0, s = 0, s2 = 0, mn = 1, mx = 0;
    for (let y = 0; y < K.H; y += 2) for (let x = 0; x < K.W; x += 2) {
      const i = (y * K.W + x) * 4;
      const L = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      s += L; s2 += L * L; n++; if (L < mn) mn = L; if (L > mx) mx = L;
    }
    const m = s / n;
    K.scene.background = K.shipBg;
    K.showAll(); K.setGround(true);
    return {
      clear: c, trace, achieved: trace[trace.length - 1].got,
      spread: { lumaMean: +m.toFixed(4), lumaStd: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(4), lumaMin: +mn.toFixed(4), lumaMax: +mx.toFixed(4) },
    };
  }, { target });
  console.log(`  solved clear rgb(${solve.clear.r.toFixed(1)},${solve.clear.g.toFixed(1)},${solve.clear.b.toFixed(1)})`
    + ` -> post-graded rgb(${solve.achieved.r},${solve.achieved.g},${solve.achieved.b}) in ${solve.trace.length} iterations`);
  console.log(`  field flatness as RENDERED: luma ${solve.spread.lumaMean} +/- ${solve.spread.lumaStd}`
    + ` (range ${solve.spread.lumaMin}..${solve.spread.lumaMax}) — the vignette, quantified`);
  measuredField.r = solve.achieved.r; measuredField.g = solve.achieved.g; measuredField.b = solve.achieved.b;
  fieldSpread.rendered = solve.spread;
  figurePostB64 = await page.evaluate(() => {
    const K = window.__K;
    K.showAll(); K.setGround(false); K.scene.background = K.panelBg;
    const px = K.shipped();
    K.setGround(true); K.scene.background = K.shipBg;
    return K.b64(px);
  });

  // The whole figure as the paired panels crop out of it: the shipped render,
  // ground hidden, against the solved field, matted outside its own silhouette.
  const figureComposited = (() => {
    const grownChar = dilate(charMask, W, H, GROW);
    return compositeOnField(flipY(decode(figurePostB64)), grownChar, measuredField);
  })();

  // ── one isolated panel per part ────────────────────────────────────────────
  const results = [];
  for (const [partName, spec] of Object.entries(PANELS)) {
    const grab = await page.evaluate(({ show, crop }) => {
      const K = window.__K;
      const pick = (ls) => { const o = []; for (const l of ls) for (const i of (K.byPart.get(l) ?? [])) o.push(i); return o; };
      const showIdx = pick(show), cropIdx = pick(crop);
      if (!showIdx.length || !cropIdx.length) return null;
      K.setGround(false);           // flat field for every part, identically
      K.scene.background = K.panelBg;  // the solved backdrop — see the solve above
      // hide-vs-base, on the CROP set: how much of it reaches the shipped screen
      const hide = new Set(cropIdx);
      K.all.forEach((m, i) => { m.visible = !hide.has(i); });
      const hid = K.plain(0x00ff00);
      // the crop subject alone, for its bbox and for the delivered comparison
      K.setVisible(cropIdx);
      const cropChroma = K.plain(0x00ff00);
      // the panel itself: subject + (for an inset) its substrate
      K.setVisible(showIdx);
      const showChroma = K.plain(0x00ff00);
      const post = K.shipped();
      K.showAll(); K.setGround(true); K.scene.background = K.shipBg;
      return {
        cropChroma: K.b64(cropChroma), showChroma: K.b64(showChroma),
        post: K.b64(post), hid: K.b64(hid), nShow: showIdx.length, nCrop: cropIdx.length,
      };
    }, { show: spec.show, crop: spec.crop });
    if (!grab) { results.push({ part: partName, valid: false, why: 'no meshes classify into this part on this character' }); continue; }

    const post = flipY(decode(grab.post));
    const chromaMask = (b64) => {
      const c = flipY(decode(b64));
      const m = new Uint8Array(W * H);
      for (let j = 0, i = 0; j < W * H; j++, i += 4) {
        m[j] = (c.data[i] < 60 && c.data[i + 1] > 180 && c.data[i + 2] < 60) ? 0 : 1;
      }
      return m;
    };
    const subjMask = chromaMask(grab.cropChroma);   // the part itself
    const panelMask = chromaMask(grab.showChroma);  // part + substrate
    const box = bboxOf(subjMask, W, H);
    if (!box) { results.push({ part: partName, valid: false, why: 'isolated render delivered ZERO pixels' }); continue; }

    // Grow ONLY for the composite, so the outline hull and the post chain's AA /
    // bloom fringe survive. `figureGround` below runs on the UNGROWN mask: round 1
    // measured it on the GROWN mask, which put 3 px of backdrop inside the
    // "subject" band and reported the figure as darker than its ground on every
    // single part. That is the §13 inversion, self-inflicted.
    const grown = dilate(panelMask, W, H, GROW);
    const composited = compositeOnField(post, grown, measuredField);

    const padPx = spec.kind === 'inset'
      ? Math.round(Math.max(box.w, box.h) * (spec.pad ?? 0.5))
      : PAD;
    const x0 = Math.max(0, box.x0 - padPx), y0 = Math.max(0, box.y0 - padPx);
    const x1 = Math.min(W - 1, box.x1 + padPx), y1 = Math.min(H - 1, box.y1 + padPx);
    const crop = cropRGBA(composited, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    const sub = (m) => {
      const o = new Uint8Array(crop.width * crop.height);
      for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) o[y * crop.width + x] = m[(y0 + y) * W + (x0 + x)];
      return o;
    };
    const cropSubj = sub(subjMask), cropPanel = sub(panelMask);

    // `silhouette-whole` is a SHAPE-ONLY panel: colour, lighting and material are
    // removed by construction on BOTH sides, because the question is whether the
    // outline reads at all. Polarity is not applicable to it and is reported as
    // such rather than as a number that means nothing.
    if (spec.binary) {
      for (let j = 0, i = 0; j < crop.width * crop.height; j++, i += 4) {
        const v = cropSubj[j] ? 0 : 255;
        crop.data[i] = v; crop.data[i + 1] = v; crop.data[i + 2] = v; crop.data[i + 3] = 255;
      }
    }

    // ── IN-CONTEXT figure/ground, and the burial number ──────────────────────
    // What the part actually DELIVERS to the shipped screen (`limbcheck`'s
    // hide-vs-base diff), and its figure/ground over exactly those pixels in the
    // FULL render. A part whose isolated panel looks strong and whose
    // `deliveredRatio` is near zero is invisible in the game; judging its isolated
    // crop would repeat the mistake that buried nine characters' limbs.
    const hidChroma = flipY(decode(grab.hid));
    const deliveredMask = new Uint8Array(W * H);
    let deliveredPx = 0;
    for (let j = 0, i = 0; j < W * H; j++, i += 4) {
      const d = Math.abs(baseChroma.data[i] - hidChroma.data[i])
        + Math.abs(baseChroma.data[i + 1] - hidChroma.data[i + 1])
        + Math.abs(baseChroma.data[i + 2] - hidChroma.data[i + 2]);
      if (d > 12) { deliveredMask[j] = 1; deliveredPx++; }
    }
    const contextFG = deliveredPx > 50 ? figureGround(shipPost, deliveredMask, 4) : null;

    // PANEL figure/ground: the whole panel content against the field. This is the
    // §13 number and the polarity guard runs on it.
    const fg = spec.binary ? null : figureGround(crop, cropPanel, 4);
    // FEATURE figure/ground: for an inset, the feature against its own substrate —
    // the relationship the player actually sees. Must track `contextFG`, and the
    // gap between them is this instrument's own drift control.
    const featureFG = spec.kind === 'inset' ? figureGround(crop, cropSubj, 4) : fg;
    const drift = featureFG && contextFG ? +(featureFG.contrast - contextFG.contrast).toFixed(4) : null;

    const fs = fieldStats(crop, cropPanel);
    const ps = panelStats(crop, cropSubj);

    // ── THE PAIRED PANEL: a tight crop of the WHOLE figure ───────────────────
    // The geometric isolation above is a diagnostic and cannot be paired, because
    // a reference PLATE cannot be ablated: hiding a mesh is not an operation a
    // screenshot supports. Emitting our geometrically-isolated arm against a
    // reference crop that still contains a torso, a collar and a cape would be
    // exactly the failure this programme exists to avoid — a pair whose dominant
    // difference is what the isolation did, not what the art did.
    //
    // So the PAIRED panel is the one treatment both sides can receive
    // identically: crop the full shipped figure to the part's DELIVERED bbox plus
    // a margin, and replace everything outside the character's own silhouette
    // with the field. Shipped polarity, shipped occlusion, shipped neighbours —
    // and the critic still sees one part and nothing else.
    let paired = null;
    const dbox = bboxOf(deliveredMask, W, H);
    if (dbox) {
      // PER-AXIS margin, not `max(w,h)`. With a single margin, a wide-short part
      // (feet: 739x156) got a vertical margin 4.7x its own height and filled 0.465
      // of its crop while the reference's filled 0.715 — the packer would then have
      // been scaling one side's subject to 0.65 of the other's inside a panel pair
      // whose entire claim is matched scale. Per-axis makes
      // partHeightFracOfCrop = 1/(1+2m) on BOTH sides, identical by construction.
      const mx = Math.round(dbox.w * PAIR_MARGIN), my = Math.round(dbox.h * PAIR_MARGIN);
      const px0 = Math.max(0, dbox.x0 - mx), py0 = Math.max(0, dbox.y0 - my);
      const px1 = Math.min(W - 1, dbox.x1 + mx), py1 = Math.min(H - 1, dbox.y1 + my);
      const pw = px1 - px0 + 1, ph = py1 - py0 + 1;
      const pcrop = cropRGBA(figureComposited, px0, py0, pw, ph);
      const pmask = new Uint8Array(pw * ph);
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) pmask[y * pw + x] = deliveredMask[(py0 + y) * W + (px0 + x)];
      if (spec.binary) {
        for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
          const on = charMask[(py0 + y) * W + (px0 + x)];
          const d = (y * pw + x) * 4, v = on ? 0 : 255;
          pcrop.data[d] = v; pcrop.data[d + 1] = v; pcrop.data[d + 2] = v; pcrop.data[d + 3] = 255;
        }
      }
      await writeRGBA(`${OUT}/_raw/${TAG}.pair.${partName}.png`, pcrop);
      paired = {
        png: `${OUT}/_raw/${TAG}.pair.${partName}.png`,
        crop: { x0: px0, y0: py0, w: pw, h: ph },
        partBox: dbox,
        partHeightFracOfCrop: +(dbox.h / ph).toFixed(3),
        partAreaFracOfCrop: +(dbox.n / (pw * ph)).toFixed(3),
        figureGround: spec.binary ? null : figureGround(pcrop, pmask, 4),
      };
    }

    await writeRGBA(`${OUT}/_raw/${TAG}.${partName}.png`, crop);
    results.push({
      part: partName, valid: true, kind: spec.kind,
      meshesShown: grab.nShow, meshesCropped: grab.nCrop, show: spec.show, crop: spec.crop,
      raw: `${OUT}/_raw/${TAG}.${partName}.png`,
      bbox: { x0, y0, w: crop.width, h: crop.height }, subjectBox: box,
      figureGround: fg, featureFG, contextFG, contextDrift: drift, paired,
      field: fs, panel: ps,
      isolatedPx: box.n, deliveredPx, deliveredRatio: box.n ? +(deliveredPx / box.n).toFixed(3) : null,
      fieldDriftRGB: fs ? rgbDist(fs, measuredField) : null,
      leafDelivered: spec.crop.map((l) => ({ leaf: l, ...(delivered[l] ?? {}) })),
    });
    const sgn = (v) => (v === null || v === undefined ? '  n/a ' : (v >= 0 ? '+' : '') + v.toFixed(3));
    console.log(`  ${partName.padEnd(18)} ${spec.kind.padEnd(10)} box=${String(box.w).padStart(4)}x${String(box.h).padStart(4)}`
      + ` panelFG=${sgn(fg && fg.contrast)} featFG=${sgn(featureFG && featureFG.contrast)}`
      + ` ctxFG=${sgn(contextFG && contextFG.contrast)} drift=${sgn(drift)}`
      + ` delivered=${box.n ? (deliveredPx / box.n).toFixed(2) : 'n/a'}`);
  }

  const figure = results.find((r) => r.part === 'figure-whole');
  for (const r of results) {
    if (r.valid && figure) r.heightFracOfFigure = +(r.subjectBox.h / figure.subjectBox.h).toFixed(4);
  }
  const meta = {
    tool: 'pp_ours.mjs', id: ID, url, tag: TAG,
    camera: { pitchDeg: Number(PITCH), yawDeg: Number(YAW), subjectFill: Number(FILL), source: 'src/ui/screens/charStage.ts (the SHIPPED character-detail camera)' },
    anim: ANIM, t: Number(T), viewport: { W, H }, bg: `0x${BG}`,
    paintFloor: floor,
    field: { measured: measuredField, spread: fieldSpread, preGradeClear: FIELD, note: 'the field is the POST-GRADED backdrop, read off an empty shipped render' },
    shippedPolarity: shippedFG,
    index: idx,
    parts: results,
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/_raw/${TAG}.json`, JSON.stringify(meta, null, 2));
  console.log(`\nshipped-view polarity (figure vs REAL ground+backdrop, no compositing): `
    + `edge ${shippedFG.edge} surround ${shippedFG.surround} contrast ${shippedFG.contrast >= 0 ? '+' : ''}${shippedFG.contrast}`);
  console.log(`wrote ${OUT}/_raw/${TAG}.json`);
  await browser.close();

  // ── THE POLARITY VERDICT ───────────────────────────────────────────────────
  // Every emitted panel must reproduce the SIGN of `shippedPolarity`. Run this
  // tool with `--bg 39b7e8` (the cyan `src/preview.ts` used to ship) and this
  // block FAILS — that is the known-bad input, and a guard that has not been
  // shown to fail on the bug it guards against is not a guard.
  // WANT is the CONSTANT +1, not `sign(shippedFG)`. Round 2 of this tool derived
  // the wanted sign from the run's own control, and the cyan known-bad then
  // reported "13/13 PASS" — self-consistently inverted, which is precisely the
  // tautological guard docs/LESSONS.md §13 warns about (`selfPair` asserting
  // metric(a) == metric(a)). The shipped sign is POSITIVE by measurement, not by
  // whatever this invocation happened to render against:
  //   real match, donut          +0.216   (src/preview.ts:114)
  //   fixed preview backdrop     +0.2224  (src/preview.ts:126)
  //   this run's own control     see `shippedPolarity` above
  const WANT = +1;
  const scored = results.filter((r) => r.valid && r.figureGround);
  const agree = scored.filter((r) => Math.sign(r.figureGround.contrast) === WANT);
  const controlOK = Math.sign(shippedFG.contrast) === WANT;
  console.log(`POLARITY ${agree.length}/${scored.length} panels are POSITIVE against the field;`
    + ` this run's own uncomposited control is ${shippedFG.contrast} -> ${controlOK ? 'OK' : 'INVERTED'}`);
  for (const r of scored) if (Math.sign(r.figureGround.contrast) !== WANT) {
    console.log(`  negative-against-field: ${r.part} contrast ${r.figureGround.contrast}`);
  }
  // MAGNITUDE control: the whole-figure panel must reproduce the shipped
  // figure/ground it was built from, not merely its sign — a panel handing a
  // critic five times the separation the player gets is still a harness artefact,
  // just a flattering one.
  //
  // The delta decomposes, and the decomposition is reported because it is what
  // makes the number interpretable: EDGE is the subject's own pixels (they should
  // be identical — the same render), SURROUND is the field level.
  const whole = results.find((r) => r.part === 'figure-whole');
  const magDelta = whole && whole.figureGround ? +(whole.figureGround.contrast - shippedFG.contrast).toFixed(4) : null;
  const edgeDelta = whole && whole.figureGround ? +(whole.figureGround.edge - shippedFG.edge).toFixed(4) : null;
  const surrDelta = whole && whole.figureGround ? +(whole.figureGround.surround - shippedFG.surround).toFixed(4) : null;
  console.log(`MAGNITUDE figure-whole panel ${whole?.figureGround?.contrast} vs shipped ${shippedFG.contrast}`
    + ` -> delta ${magDelta}   [edge ${edgeDelta} + field ${surrDelta === null ? '?' : -surrDelta}]`);

  // INSET DRIFT control: an inset panel must reproduce the feature's own in-context
  // contrast. This is the assertion that the isolation did not invent the
  // relationship being judged, and unlike the polarity sign it CAN fail on a real
  // mistake — rendering the eyes without the bun makes it fail by ~0.8.
  const insets = results.filter((r) => r.valid && r.kind === 'inset' && r.contextDrift !== null);
  const driftMax = insets.length ? Math.max(...insets.map((r) => Math.abs(r.contextDrift))) : null;
  console.log(`INSET DRIFT max |featureFG - contextFG| = ${driftMax} over ${insets.length} inset panels`
    + ` (${insets.map((r) => `${r.part} ${r.contextDrift}`).join(', ')})`);

  // Per-part polarity NOTES, not failures: a genuinely dark part (hamburger's feet
  // are `pattyDarkMat`) is legitimately darker than the ground it stands on, and
  // the shipped render agrees. What would be a fault is a panel that disagrees
  // with its own in-context sign.
  for (const r of scored) {
    if (!r.contextFG) continue;
    if (Math.sign(r.figureGround.contrast) !== Math.sign(r.contextFG.contrast)) {
      console.log(`  NOTE ${r.part}: panel ${r.figureGround.contrast} vs in-context ${r.contextFG.contrast}`
        + ` — the field is not what this part sits against in the game`);
    }
  }

  const ok = controlOK && Math.sign(whole?.figureGround?.contrast ?? 0) === WANT;
  if (!ok) {
    console.log('FAIL — the harness inverts the relationship it is measuring (docs/LESSONS.md §13).');
    if (!a.includes('--allow-negative')) process.exit(3);
    console.log('  (--allow-negative given: this was expected. The FAIL above is the point.)');
    return;
  }
  console.log('PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
