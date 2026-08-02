/**
 * Game entry point.
 *
 * Currently a smoke-test scene that proves the render core boots. The real match
 * loop (frozen rules from `game/rules.ts`, arena, HUD, AI) lands as its own piece.
 */

import * as THREE from 'three';
import { Stage } from './render/stage';
import { createCharacter } from './characters/registry';
import { toonMat, RAMP_SOFT } from './render/toon';

const container = document.getElementById('game')!;
const boot = document.getElementById('boot')!;

const stage = new Stage({
  container,
  background: 0x2a1f3d,
  camera: { pitchDeg: 58, yawDeg: 0, viewWidthUnits: 360 },
});

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  toonMat({ color: '#6b5a45', ramp: RAMP_SOFT() })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.userData.noOutline = true;
stage.scene.add(ground);

const hero = createCharacter('hamburger');
stage.scene.add(hero.root);
hero.play('idle');

stage.rig.snapTo(0, 0);

const clock = new THREE.Clock();
let elapsed = 0;

function loop() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  elapsed += dt;
  hero.update({ dt, elapsed, moveSpeed01: 0, health01: 1 });
  stage.render(dt);
  requestAnimationFrame(loop);
}
loop();

window.addEventListener('resize', () => stage.resize());
requestAnimationFrame(() => boot.classList.add('hidden'));
