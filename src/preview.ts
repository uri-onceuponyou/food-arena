/**
 * Piece preview harness.
 *
 * Renders a single piece — one character, the arena, one VFX — in isolation using
 * the exact same Stage (toon materials, lighting, camera, post FX) the game uses.
 * This is what builder agents iterate against and what critic agents screenshot.
 *
 * Query params:
 *   piece=character|arena|vfx|roster   (default: character)
 *   id=<characterId|vfxId>
 *   anim=idle|run|attack|hit|death|victory
 *   yaw=<degrees>            orbit around the subject
 *   pitch=<degrees>          camera pitch override
 *   t=<seconds>              deterministic animation time (implies frozen clock)
 *   shot=1                   hide all chrome, signal readiness for screenshotting
 *   bg=<hex>                 background override, e.g. bg=1b1426
 *   grid=1                   show a reference ground grid + height rulers
 *
 * The screenshot tool waits for `window.__previewReady === true`.
 */

import * as THREE from 'three';
import { Stage } from './render/stage';
import { createCharacter } from './characters/registry';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from './game/rules';
import type { AnimState, CharacterModel } from './characters/types';
import { CHARACTER_HEIGHT, groundPos } from './units';
import { toonMat, RAMP_SOFT, outlineGroup } from './render/toon';
import { createKitchenArena } from './arena/kitchen';
import { buildFloor } from './arena/floor';
import { buildMaterials } from './arena/shared';
import type { ArenaDefinition } from './arena/types';

declare global {
  interface Window {
    __previewReady?: boolean;
    __preview?: PreviewApi;
  }
}

interface PreviewApi {
  setAnim(a: AnimState): void;
  setYaw(deg: number): void;
  setTime(seconds: number): void;
  info(): Record<string, unknown>;
  /**
   * Deterministically advance the character to `seconds` since the animation
   * started, and render. See `advanceTo` for why this exists and why callers
   * should sample in increasing `t`.
   */
  frameAt(seconds: number, opts?: { anim?: AnimState; remount?: boolean }): Record<string, unknown>;
  /**
   * Sample named joint positions (in the character's own local space) across a
   * time span. The numeric half of motion review — see `traceMotion`.
   */
  trace(opts?: { anim?: AnimState; t0?: number; t1?: number; samples?: number }): MotionTrace;
}

/** One sampled instant of a motion trace. */
export interface MotionSample {
  t: number;
  /** Joint name → [x, y, z] in the character root's local frame (feet at y=0). */
  joints: Record<string, [number, number, number]>;
  /** `rig_body` scale, which is where squash/stretch lives. */
  bodyScale: [number, number, number];
  /**
   * Lowest point of the whole model, in metres, with feet nominally at y=0.
   *
   * `types.ts` convention #1 is "feet at y=0", and the cast already violates it by
   * -0.08 to -0.25 m standing still. Any motion change that drops the body has to
   * be checked against this or characters sink through the floor while running.
   */
  minY: number;
}

export interface MotionTrace {
  id: string;
  anim: string;
  samples: MotionSample[];
}

const params = new URLSearchParams(location.search);
const piece = params.get('piece') ?? 'character';
const shotMode = params.get('shot') === '1';
const showGrid = params.get('grid') === '1';
const frozenTime = params.has('t') ? Number(params.get('t')) : null;
/**
 * Silhouette mode: flatten everything to unlit black on a white ground.
 *
 * Tests whether SHAPES read at all, independent of colour, texture and lighting —
 * the fastest way to answer "can you tell these apart at thumbnail size", which is
 * what the reference cast does best and what our critics keep circling.
 */
const silhouette = params.get('silhouette') === '1';
const isArena = piece === 'arena' || piece === 'prop' || piece === 'floor';
// arena only: 'gameplay' frames a combat-distance patch, 'overview' frames the whole map.
const arenaView = params.get('view') === 'overview' ? 'overview' : 'gameplay';

if (shotMode) document.body.classList.add('shot');

const container = document.getElementById('stage')!;
const label = document.getElementById('label')!;

/**
 * Character-preview backdrop. **Matched to the SHIPPED match's figure/ground, and
 * that is the entire point of the value.**
 *
 * This was `0x39b7e8` (saturated cyan) with a `#8fd6f2` ground, on the reasoning that
 * "the reference presents characters on bright, saturated grounds". Measured, that
 * backdrop inverts the polarity the game actually ships:
 *
 *   | frame                       | body luma | background luma | body - background |
 *   |-----------------------------|-----------|-----------------|-------------------|
 *   | real match (donut)          | 0.5411    | 0.3250          | **+0.216**        |
 *   | preview, old cyan (donut)   | 0.5575    | 0.8120          | **-0.255**        |
 *   | preview, old cyan (hotdog)  | 0.4132    | 0.8273          | **-0.414**        |
 *
 * So every character packet ever judged on this project was judged with the figure
 * DARKER than the ground while the game shows it LIGHTER — the one comparison a
 * silhouette/read critique depends on, backwards. Anything tuned to separate against
 * bright cyan is tuned against a frame that does not exist.
 *
 * `3d2b21` / `4a382c` was picked by sweeping candidates in-page
 * (`tools/tmp/bgsweep.mjs`) and reading the same two numbers back. On donut — the
 * character the shipped-framing reference was measured on — it lands at background
 * luma **0.3301** against the match's 0.3250 and contrast **+0.2224** against +0.216.
 * Warm, because the arena is a warm kitchen and the reference reserves the warm half
 * of the wheel for the cast (`docs/LESSONS.md` §8); dark, because that is what the
 * floor measures at, not because dark backdrops flatter models.
 *
 * The arena piece keeps its own warm sky — it brings a real floor with it.
 */
const bgParam = params.get('bg');
const background = bgParam ? Number(`0x${bgParam.replace('#', '')}`) : isArena ? 0xffcf8a : 0x3d2b21;

// The arena is tens of metres across — the tight fog tuned for small preview subjects
// would grey out most of a gameplay shot and nearly all of an overview. Push it out
// proportionally to how much ground the shot needs to show.
const arenaFog = arenaView === 'overview' ? { near: 100, far: 260 } : { near: 40, far: 130 };

/**
 * Horizontal world span, in world units, that the SHIPPED game shows at 16:9.
 *
 * Derived from the fair-play camera rather than picked by eye: `tools/aspect.mjs`
 * reports halfW = 289wu at 16:9 for the current FAIR_PLAY radius, so the full span is
 * ~578wu. Isolation views must match this or a critic is scoring our harness, not the
 * game — see the note at the `viewWidthUnits` call site.
 *
 * If the fair radius changes again, re-read halfW from `node tools/aspect.mjs` and
 * update this. It is deliberately ONE constant so that can never drift silently again.
 *
 * NOTE the sin(pitch) term, which a first version of this constant got wrong by 18%.
 * `frameMode: 'ground'` does NOT frame `viewWidthUnits` of ground — `camera.ts`'s own
 * comment records that it actually frames `viewWidthUnits / sin(pitch)`. So to put 578wu
 * of real ground across the frame at the preview's 58° pitch, the value handed to the rig
 * must be 578 × sin(58°) ≈ 490. Setting it to 578 framed 682wu instead.
 *
 * `mountProp()` deliberately ignores this and fits the camera to the individual prop —
 * you cannot judge a barrel's detail at gameplay distance. That means **prop isolation
 * views are NOT shipped scale**, and anything tuned there must be re-checked at
 * `piece=arena` before it is believed.
 */
const SHIPPED_SPAN = Math.round(578 * Math.sin((58 * Math.PI) / 180));

const stage = new Stage({
  container,
  background,
  fog: isArena ? { color: background, ...arenaFog } : { color: background, near: 40, far: 120 },
  camera: isArena ? {
    pitchDeg: params.has('pitch') ? Number(params.get('pitch')) : 58,
    yawDeg: params.has('yaw') ? Number(params.get('yaw')) : 0,
    frameMode: 'ground',
    // SHIPPED_SPAN, not a hand-picked zoom. These isolation views sat at 265 while the
    // game showed ~928wu, so every arena/floor/prop loop was judging at ~3.5x the zoom
    // anyone plays at. That is not a cosmetic mismatch — re-shooting the floor at real
    // framing sorted its work into three piles: the low-frequency lighting gradient
    // SURVIVES and is the only thing carrying the floor at distance; tile bevels, the
    // high-frequency grain and per-tile jitter VANISH entirely; and tile scale INVERTS
    // (25wu, sized to look right at 265, puts 36 tiles across a real frame with ~1px
    // joints — an aliasing generator). It also hid a decal z-fighting bug completely.
    // Judge at the distance the game is played at, or the score measures the harness.
    viewWidthUnits: arenaView === 'overview' ? 1600 : SHIPPED_SPAN,
    followLerp: 1,
  } : {
    pitchDeg: params.has('pitch') ? Number(params.get('pitch')) : 22,
    yawDeg: params.has('yaw') ? Number(params.get('yaw')) : 0,
    frameMode: 'subject',
    subjectHeight: CHARACTER_HEIGHT,
    subjectFill: params.has('fill') ? Number(params.get('fill')) : 0.66,
    targetHeight: CHARACTER_HEIGHT * 0.5,
    followLerp: 1,
  },
  maxPixelRatio: 2,
});

// ── Neutral studio ground ────────────────────────────────────────────────────
// A shadow-catching disc, so models are judged with real contact shadows rather
// than floating in a void. The arena piece brings its own floor, so it skips this.
if (!isArena) {
  // Ground albedo is chosen with the backdrop above, not independently: it fills most
  // of a character frame, so it — not the sky — is what sets `frameLuma`. See the
  // `background` note for the measurement.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    toonMat({ color: params.get('ground') ? `#${params.get('ground')}` : '#4a382c', ramp: RAMP_SOFT() })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'preview_ground';
  ground.userData.noOutline = true;
  stage.scene.add(ground);
}

if (showGrid) {
  const grid = new THREE.GridHelper(12, 24, 0x8a7aa0, 0x5a4a70);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  grid.position.y = 0.002;
  stage.scene.add(grid);

  // Height ruler at the canonical character height — catches scale drift instantly.
  const ruler = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, CHARACTER_HEIGHT, 0.02),
    toonMat({ color: '#ff4fd0' })
  );
  ruler.position.set(1.9, CHARACTER_HEIGHT / 2, 0);
  ruler.userData.noOutline = true;
  stage.scene.add(ruler);
}

// ── Subject ──────────────────────────────────────────────────────────────────
let model: CharacterModel | null = null;
let anim: AnimState = (params.get('anim') as AnimState) ?? 'idle';
const subjectId = (params.get('id') ?? 'hamburger') as CharacterId;

function mountCharacter(id: CharacterId) {
  if (model) {
    stage.scene.remove(model.root);
    model.dispose();
  }
  model = createCharacter(id);
  stage.scene.add(model.root);
  model.play(anim);
  stage.rig.snapTo(0, 0);
  // Face close-up. Critics anchor hardest on faces, but judge them from full-body
  // distance where they are only a few dozen pixels across.
  if (params.get('face') === '1') {
    stage.rig.subjectHeight = CHARACTER_HEIGHT * 0.30;
    stage.rig.subjectFill = 0.80;
    stage.rig.targetHeight = CHARACTER_HEIGHT * 0.80;
    stage.rig.pitchDeg = params.has('pitch') ? Number(params.get('pitch')) : 8;
    stage.rig.snapTo(0, 0);
  }
}

function mountRoster() {
  // Whole cast lined up — the fastest way to spot scale, style or palette drift
  // across characters built by different agents.
  const spacing = 2.6;
  CHARACTER_IDS.forEach((id, i) => {
    const m = createCharacter(id);
    m.root.position.x = (i - (CHARACTER_IDS.length - 1) / 2) * spacing;
    m.root.rotation.y = 0;
    stage.scene.add(m.root);
    rosterModels.push(m);
  });
  // Wide line-up. Frame by GROUND width, not subject height: the row is ~26m across,
  // and subject-framing sized the camera to one 2.1m character, which shrank the whole
  // cast to specks. Width in world units = metres / WORLD_SCALE, plus margin.
  // Wide line-up. Ground framing is wrong here: it divides by sin(pitch), so at the
  // shallow pitch this shot wants it pushes the camera to ~54m and the cast becomes
  // specks. Instead frame as a "subject" whose height is the row's span converted
  // through the viewport aspect — that fits the row across the frame directly.
  const spanMetres = (CHARACTER_IDS.length - 1) * spacing + 3.4;
  const aspect = (container.clientWidth || window.innerWidth) /
                 Math.max(1, container.clientHeight || window.innerHeight);
  stage.rig.frameMode = 'subject';
  stage.rig.subjectFill = 0.95;
  stage.rig.subjectHeight = spanMetres / Math.max(0.2, aspect);
  stage.rig.pitchDeg = 14;
  stage.rig.targetHeight = CHARACTER_HEIGHT * 0.5;
  stage.rig.snapTo(0, 0);
}
const rosterModels: CharacterModel[] = [];

let arena: ArenaDefinition | null = null;

function mountArena() {
  arena = createKitchenArena();
  stage.scene.add(arena.build());
  // tx/ty (world units) let a builder re-target the camera at any spot on the map —
  // e.g. a corner room — while iterating. Defaults to the arena's own centre.
  const tx = params.has('tx') ? Number(params.get('tx')) : arena.center.x;
  const ty = params.has('ty') ? Number(params.get('ty')) : arena.center.y;

  // Populate with characters unless explicitly disabled (chars=0). An empty arena is
  // not a fair thing to judge against a reference gameplay frame — those are full of
  // brawlers and VFX, so critiquing bare environment art against them measures the
  // wrong thing. This is also simply what the real game view looks like.
  if (params.get('chars') !== '0') {
    const cast: CharacterId[] = ['donut', 'egg', 'pizza', 'taco', 'hotdog'];
    cast.forEach((id, i) => {
      const ang = (i / cast.length) * Math.PI * 2 + 0.6;
      const rad = 95 + (i % 2) * 42;
      const m = createCharacter(id);
      const p = groundPos(tx + Math.cos(ang) * rad, ty + Math.sin(ang) * rad);
      m.root.position.set(p.x, 0, p.z);
      m.root.rotation.y = -ang + Math.PI / 2;
      m.play(i % 2 === 0 ? 'run' : 'idle');
      arenaCast.push({ model: m, running: i % 2 === 0 });
      stage.scene.add(m.root);
    });
  }

  const c = groundPos(tx, ty);
  stage.rig.snapTo(c.x, c.z);
  stage.lighting.focus(c.x, c.z, arenaView === 'overview' ? 46 : 30);
}
const arenaCast: Array<{ model: CharacterModel; running: boolean }> = [];

/**
 * Frame a SINGLE arena prop, at gameplay camera pitch, with a character beside it
 * for scale.
 *
 * Judging the whole arena at once means a critic averages everything and the score
 * is dragged by whatever is weakest, so no individual element ever gets credit for
 * improving. Isolating one element per critic loop — which is what the original
 * brief asked for — gives tight, attributable feedback instead.
 *
 * Every cover prop group is named `cover:<kind>` by the arena's single addCover()
 * choke point, so this needs no cooperation from the arena module.
 */
function mountProp() {
  arena = createKitchenArena();
  const built = arena.build();
  stage.scene.add(built);

  const kind = params.get('kind') ?? 'stove_island';
  let target: THREE.Object3D | null = null;
  built.traverse((o) => {
    if (!target && o.name === `cover:${kind}`) target = o;
  });
  if (!target) {
    label.textContent = `no prop named cover:${kind}`;
    stage.rig.snapTo(0, 0);
    return;
  }

  const box = new THREE.Box3().setFromObject(target);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Put a character beside it so the critic can judge scale and "does this read as
  // cover I could hide behind" rather than guessing at an object floating alone.
  if (params.get('chars') !== '0') {
    const m = createCharacter('hamburger');
    m.root.position.set(centre.x + size.x * 0.5 + 1.1, 0, centre.z + size.z * 0.35);
    m.root.rotation.y = -Math.PI * 0.35;
    m.play('idle');
    arenaCast.push({ model: m, running: false });
    stage.scene.add(m.root);
  }

  const spanMetres = Math.max(size.x, size.z) + 4.2;
  stage.rig.frameMode = 'ground';
  stage.rig.viewWidthUnits = spanMetres / 0.05;
  stage.rig.pitchDeg = params.has('pitch') ? Number(params.get('pitch')) : 46;
  stage.rig.snapTo(centre.x, centre.z);
  stage.lighting.focus(centre.x, centre.z, 16);
  label.textContent = `prop · ${kind}`;
}

/**
 * The FLOOR, alone. No props, no hazards, no characters, no ambient.
 *
 * Five floor critic rounds all scored 3/10 and every one of them fixated on things
 * that were not the floor — a neighbouring prop, a decal artifact, a shadow from
 * something else. An element cannot be judged while the frame is full of other
 * owners' work, so this gives the floor a genuinely clean slate.
 */
function mountFloorOnly() {
  const M = buildMaterials();
  const g = buildFloor(M);
  stage.scene.add(g);
  const tx = params.has('tx') ? Number(params.get('tx')) : 700;
  const ty = params.has('ty') ? Number(params.get('ty')) : 500;
  const c = groundPos(tx, ty);
  stage.rig.frameMode = 'ground';
  stage.rig.viewWidthUnits = params.has('zoom') ? Number(params.get('zoom')) : SHIPPED_SPAN;
  stage.rig.pitchDeg = params.has('pitch') ? Number(params.get('pitch')) : 58;
  stage.rig.snapTo(c.x, c.z);
  stage.lighting.focus(c.x, c.z, 30);
  label.textContent = 'floor only';
}

if (piece === 'floor') {
  mountFloorOnly();
} else if (piece === 'prop') {
  mountProp();
} else if (piece === 'character') {
  mountCharacter(subjectId);
  label.textContent = `${CHARACTERS[subjectId]?.name ?? subjectId} · ${anim}`;
} else if (piece === 'roster') {
  mountRoster();
  label.textContent = 'roster · all 11';
} else if (piece === 'arena') {
  mountArena();
  label.textContent = `kitchen · ${arenaView}`;
} else {
  label.textContent = `piece "${piece}" not implemented yet`;
}

// ── Loop ─────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let simTime = 0;

/** Advance animation only. Deliberately does NOT render. */
function advance(dt: number) {
  simTime += dt;
  const ctx = {
    dt,
    elapsed: simTime,
    moveSpeed01: anim === 'run' ? 1 : 0,
    health01: 1,
  };
  model?.update(ctx);
  for (const m of rosterModels) m.update(ctx);
  for (const c of arenaCast) {
    c.model.update({ ...ctx, moveSpeed01: c.running ? 1 : 0 });
  }
  arena?.update?.(dt, simTime);
}

function step(dt: number) {
  advance(dt);
  stage.render(dt);
}

if (frozenTime !== null) {
  // Deterministic: advance in fixed sub-steps to exactly `t`, then hold. Two
  // screenshots of the same URL are then pixel-identical, which is what makes
  // before/after critic comparisons meaningful.
  // Step the ANIMATION to `t` without rendering, then render once. Rendering every
  // sub-step meant ~180 fully post-processed frames per screenshot, which made a
  // single capture take ~26s under CPU-rasterised WebGL and was the real reason
  // batch renders ran for minutes.
  const h = 1 / 120;
  const steps = Math.max(1, Math.round(frozenTime / h));
  for (let i = 0; i < steps; i++) advance(h);
  // Post FX (SMAA/bloom) need a couple of settled frames.
  stage.render(0);
  stage.render(0);
  requestAnimationFrame(() => {
    stage.render(0);
    window.__previewReady = true;
  });
} else {
  const loop = () => {
    step(Math.min(clock.getDelta(), 1 / 20));
    requestAnimationFrame(loop);
  };
  loop();
  setTimeout(() => { window.__previewReady = true; }, 400);
}

/** Flatten every mesh to matte black; the backdrop and ground go white. */
function applySilhouette() {
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  stage.scene.background = new THREE.Color(0xffffff);
  stage.scene.fog = null;
  stage.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.name === 'preview_ground' || m.name.startsWith('floor')) {
      m.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      return;
    }
    m.material = black;
  });
}
if (silhouette) applySilhouette();

window.addEventListener('resize', () => stage.resize());

// ── Motion review harness ────────────────────────────────────────────────────
//
// Every character critique on this project has judged a STILL, yet the recurring
// complaint — "reads like a turntable render" — is a complaint about MOTION.
// Nothing here changes what the game does; it makes the time axis capturable.
//
// The `t=` URL param already gave one deterministic frame per page load, which is
// enough for a single still and far too slow for a 12-frame strip (12 WebGL
// contexts, ~2s each). These two entry points sweep the SAME deterministic clock
// inside one page instead.
//
// `advanceTo` only ever steps FORWARD unless asked to remount, and that is
// load-bearing rather than an optimisation: the one-shot states (attack, hit,
// death) are armed by `play()` at mount time, so t=0 is the start of the one-shot
// and the only way to rewind is to build a fresh model. Sample in increasing t and
// a whole strip costs one mount.

/** Joints worth tracking. Names are set by `ChibiRig`'s constructor. */
const TRACE_JOINTS = [
  'rig_body', 'hips', 'torso', 'neck', 'head',
  'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR',
];

function jointMap(): Map<string, THREE.Object3D> {
  const m = new Map<string, THREE.Object3D>();
  model?.root.traverse((o) => {
    if (!m.has(o.name) && TRACE_JOINTS.includes(o.name)) m.set(o.name, o);
  });
  return m;
}

function advanceTo(seconds: number, opts?: { anim?: AnimState; remount?: boolean }) {
  const wantAnim = opts?.anim ?? anim;
  const needsReset = opts?.remount || wantAnim !== anim || seconds < simTime - 1e-6 || !model;
  if (needsReset) {
    anim = wantAnim;
    mountCharacter(subjectId);
    if (silhouette) applySilhouette();
    simTime = 0;
    // A zero-length step, so t=0 is the animation's first frame rather than
    // whatever pose the constructor happened to leave behind. Without this the
    // first cell of every filmstrip showed `restPose()` and silently lied about
    // the start of the cycle.
    advance(0);
  }
  // 1/120 to match the `t=` param's own sub-stepping, so both paths agree exactly.
  const h = 1 / 120;
  const steps = Math.max(0, Math.round((seconds - simTime) / h));
  for (let i = 0; i < steps; i++) advance(h);
}

function frameAt(seconds: number, opts?: { anim?: AnimState; remount?: boolean }) {
  advanceTo(seconds, opts);
  // Post FX (SMAA/bloom) need a couple of settled frames, same as the `t=` path.
  stage.render(0);
  stage.render(0);
  return { t: +simTime.toFixed(4), anim, id: subjectId };
}

/**
 * Sample joint positions across a span, in the character's OWN local frame.
 *
 * Deliberately camera-independent: arc curvature, anticipation and settle are
 * properties of the motion, and measuring them off screen pixels would fold in
 * perspective, framing and the post chain. Positions come back relative to
 * `model.root`, whose origin is the character's feet.
 */
function traceMotion(opts?: { anim?: AnimState; t0?: number; t1?: number; samples?: number }): MotionTrace {
  const t0 = opts?.t0 ?? 0;
  const t1 = opts?.t1 ?? 1;
  const n = Math.max(2, Math.round(opts?.samples ?? 48));
  advanceTo(0, { anim: opts?.anim ?? anim, remount: true });
  const joints = jointMap();
  const body = joints.get('rig_body');
  const samples: MotionSample[] = [];
  const v = new THREE.Vector3();
  const box = new THREE.Box3();
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * i) / (n - 1);
    advanceTo(t);
    model!.root.updateMatrixWorld(true);
    const rec: Record<string, [number, number, number]> = {};
    for (const [name, obj] of joints) {
      v.setFromMatrixPosition(obj.matrixWorld);
      model!.root.worldToLocal(v);
      rec[name] = [+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5)];
    }
    box.setFromObject(model!.root);
    samples.push({
      t: +t.toFixed(5),
      minY: +box.min.y.toFixed(4),
      joints: rec,
      bodyScale: body ? [+body.scale.x.toFixed(5), +body.scale.y.toFixed(5), +body.scale.z.toFixed(5)] : [1, 1, 1],
    });
  }
  return { id: subjectId, anim: opts?.anim ?? anim, samples };
}

window.__preview = {
  setAnim(a) { anim = a; model?.play(a); },
  setYaw(deg) { stage.rig.yawDeg = deg; stage.rig.apply(); },
  setTime(seconds) { simTime = seconds; },
  frameAt,
  trace: traceMotion,
  info() {
    const box = model ? new THREE.Box3().setFromObject(model.root) : null;
    return {
      piece, id: subjectId, anim,
      height: box ? +(box.max.y - box.min.y).toFixed(3) : null,
      footY: box ? +box.min.y.toFixed(3) : null,
      width: box ? +(box.max.x - box.min.x).toFixed(3) : null,
      targetHeight: CHARACTER_HEIGHT,
    };
  },
};
