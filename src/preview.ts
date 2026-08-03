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
}

const params = new URLSearchParams(location.search);
const piece = params.get('piece') ?? 'character';
const shotMode = params.get('shot') === '1';
const showGrid = params.get('grid') === '1';
const frozenTime = params.has('t') ? Number(params.get('t')) : null;
const isArena = piece === 'arena' || piece === 'prop';
// arena only: 'gameplay' frames a combat-distance patch, 'overview' frames the whole map.
const arenaView = params.get('view') === 'overview' ? 'overview' : 'gameplay';

if (shotMode) document.body.classList.add('shot');

const container = document.getElementById('stage')!;
const label = document.getElementById('label')!;

// Bright studio backdrop by default. A dark ground made every model read as gloomy
// clay; the reference presents characters on bright, saturated grounds and that
// materially changes how the shading is perceived. The arena brings its own warm
// kitchen palette, so it gets a warmer sky default instead of the character-preview cyan.
const bgParam = params.get('bg');
const background = bgParam ? Number(`0x${bgParam.replace('#', '')}`) : isArena ? 0xffcf8a : 0x39b7e8;

// The arena is tens of metres across — the tight fog tuned for small preview subjects
// would grey out most of a gameplay shot and nearly all of an overview. Push it out
// proportionally to how much ground the shot needs to show.
const arenaFog = arenaView === 'overview' ? { near: 100, far: 260 } : { near: 40, far: 130 };

const stage = new Stage({
  container,
  background,
  fog: isArena ? { color: background, ...arenaFog } : { color: background, near: 40, far: 120 },
  camera: isArena ? {
    pitchDeg: params.has('pitch') ? Number(params.get('pitch')) : 58,
    yawDeg: params.has('yaw') ? Number(params.get('yaw')) : 0,
    frameMode: 'ground',
    viewWidthUnits: arenaView === 'overview' ? 1600 : 265,
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
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    toonMat({ color: params.get('ground') ? `#${params.get('ground')}` : '#8fd6f2', ramp: RAMP_SOFT() })
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

if (piece === 'prop') {
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

window.addEventListener('resize', () => stage.resize());

window.__preview = {
  setAnim(a) { anim = a; model?.play(a); },
  setYaw(deg) { stage.rig.yawDeg = deg; stage.rig.apply(); },
  setTime(seconds) { simTime = seconds; },
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
