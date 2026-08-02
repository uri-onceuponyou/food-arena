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
import { CHARACTER_HEIGHT } from './units';
import { toonMat, RAMP_SOFT, outlineGroup } from './render/toon';

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

if (shotMode) document.body.classList.add('shot');

const container = document.getElementById('stage')!;
const label = document.getElementById('label')!;

const bgParam = params.get('bg');
const background = bgParam ? Number(`0x${bgParam.replace('#', '')}`) : 0x241a33;

const stage = new Stage({
  container,
  background,
  // Preview subjects are small; pull the fog back so it never tints the model.
  fog: { color: background, near: 40, far: 120 },
  camera: {
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
// than floating in a void.
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(14, 64),
  toonMat({ color: '#4a3a5e', ramp: RAMP_SOFT() })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.name = 'preview_ground';
ground.userData.noOutline = true;
stage.scene.add(ground);

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
  // Wide line-up: frame by subject height, but scaled up to hold all 11.
  stage.rig.frameMode = 'subject';
  stage.rig.subjectHeight = CHARACTER_HEIGHT;
  stage.rig.subjectFill = 0.16;
  stage.rig.targetHeight = CHARACTER_HEIGHT * 0.5;
  stage.rig.snapTo(0, 0);
}
const rosterModels: CharacterModel[] = [];

if (piece === 'character') {
  mountCharacter(subjectId);
  label.textContent = `${CHARACTERS[subjectId]?.name ?? subjectId} · ${anim}`;
} else if (piece === 'roster') {
  mountRoster();
  label.textContent = 'roster · all 11';
} else {
  label.textContent = `piece "${piece}" not implemented yet`;
}

// ── Loop ─────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let simTime = 0;

function step(dt: number) {
  simTime += dt;
  const ctx = {
    dt,
    elapsed: simTime,
    moveSpeed01: anim === 'run' ? 1 : 0,
    health01: 1,
  };
  model?.update(ctx);
  for (const m of rosterModels) m.update(ctx);
  stage.render(dt);
}

if (frozenTime !== null) {
  // Deterministic: advance in fixed sub-steps to exactly `t`, then hold. Two
  // screenshots of the same URL are then pixel-identical, which is what makes
  // before/after critic comparisons meaningful.
  const h = 1 / 120;
  const steps = Math.max(1, Math.round(frozenTime / h));
  for (let i = 0; i < steps; i++) step(h);
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
