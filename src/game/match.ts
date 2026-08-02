/**
 * Match glue layer: wires the pure simulation (`sim.ts`) to the arena, the character
 * models and the renderer.
 *
 * Hard rule: models FOLLOW the sim, the sim never reads from the renderer. Every
 * frame this module (1) gathers input, (2) unprojects the mouse onto the ground
 * plane to get a world-unit aim point, (3) calls `stepMatch`, (4) syncs 3D model
 * transforms/animation to the resulting `MatchState`, and (5) renders. Gameplay math
 * stays in world units throughout; `groundPos`/`toWorldUnits` (`src/units.ts`) are
 * the only bridge to Three.js metres.
 */

import * as THREE from 'three';
import { Stage } from '../render/stage';
import { createKitchenArena } from '../arena/kitchen';
import { createCharacter } from '../characters/registry';
import type { CharacterModel } from '../characters/types';
import { createMatch, stepMatch } from './sim';
import type { Fighter, GameEvent, MatchInput, MatchState } from './state';
import { CHARACTERS, type CharacterId } from './rules';
import { CHARACTER_HEIGHT, groundPos, toWorldUnits } from '../units';
import { InputController } from './input';
import { VfxLayer } from './vfx';
import { createHud, type Hud } from '../ui/hud';

declare global {
  interface Window {
    /** Set true once the first frame of the live game has rendered. */
    __gameReady?: boolean;
    /** Also set, so `tools/shoot.mjs` (built for `preview.html`) works unchanged. */
    __previewReady?: boolean;
  }
}

export interface GameSessionOptions {
  /** Mount point for the WebGL canvas. */
  container: HTMLElement;
  /** Mount point for the DOM HUD. */
  hudRoot: HTMLElement;
  playerCharacterId?: CharacterId;
  enemyCharacterId?: CharacterId;
}

const DEFAULT_PLAYER: CharacterId = 'hamburger';
const DEFAULT_ENEMY: CharacterId = 'donut';

/** Metres above a fighter's feet the floating HUD pill should anchor to. */
const FLOAT_BAR_HEIGHT = CHARACTER_HEIGHT + 0.35;

export class GameSession {
  private readonly stage: Stage;
  private readonly arena = createKitchenArena();
  private readonly vfx: VfxLayer;
  private readonly hud: Hud;
  private readonly input: InputController;
  private readonly playerId: CharacterId;
  private readonly enemyId: CharacterId;

  private playerModel: CharacterModel;
  private enemyModel: CharacterModel;
  private state: MatchState;

  private readonly clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private readyFired = false;

  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly rayHit = new THREE.Vector3();
  private readonly projectVec = new THREE.Vector3();

  /**
   * QA-only fast-forward: `?simSpeed=8` on the page URL advances the sim faster than
   * real time. Defaults to 1 (no effect) for real play. Exists because a software
   * (SwiftShader) renderer makes each frame expensive, and our own per-frame dt is
   * clamped for simulation stability — without this, waiting out a 5s countdown for a
   * screenshot means waiting far longer than 5 real seconds.
   */
  private readonly simSpeed: number;

  constructor(private readonly opts: GameSessionOptions) {
    this.playerId = opts.playerCharacterId ?? DEFAULT_PLAYER;
    this.enemyId = opts.enemyCharacterId ?? DEFAULT_ENEMY;
    const requestedSpeed = Number(new URLSearchParams(location.search).get('simSpeed'));
    this.simSpeed = Number.isFinite(requestedSpeed) && requestedSpeed > 0 ? Math.min(50, requestedSpeed) : 1;

    // Same Stage recipe `preview.ts` uses for the arena's "gameplay" view — a
    // character/arena approved in preview must render identically in the real game.
    this.stage = new Stage({
      container: opts.container,
      background: 0xffcf8a,
      fog: { color: 0xffcf8a, near: 40, far: 130 },
      camera: { pitchDeg: 58, yawDeg: 0, frameMode: 'ground', viewWidthUnits: 360 },
    });
    this.stage.scene.add(this.arena.build());

    this.vfx = new VfxLayer(this.stage.scene);
    this.hud = createHud(opts.hudRoot, { onRestart: () => this.restart() });
    this.hud.setCharacters(this.playerId, this.enemyId);

    this.input = new InputController(this.stage.canvas);
    this.input.setWeaponCount(CHARACTERS[this.playerId].weapons.length);

    // Placeholders assigned for real by spawnMatch() below (kept non-null for TS).
    this.state = createMatch(this.arena, this.playerId, this.enemyId);
    this.playerModel = createCharacter(this.playerId);
    this.enemyModel = createCharacter(this.enemyId);
    this.spawnMatch();

    window.addEventListener('resize', this.handleResize);
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Start a brand-new match: fresh sim state, fresh models, camera snapped back. */
  restart(): void {
    this.spawnMatch();
  }

  resize(): void {
    this.stage.resize();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.handleResize);
    this.input.dispose();
    this.hud.dispose();
    this.vfx.dispose();
    this.playerModel.dispose();
    this.enemyModel.dispose();
    this.stage.dispose();
  }

  private spawnMatch(): void {
    this.state = createMatch(this.arena, this.playerId, this.enemyId);

    this.stage.scene.remove(this.playerModel.root, this.enemyModel.root);
    this.playerModel.dispose();
    this.enemyModel.dispose();

    this.playerModel = createCharacter(this.playerId);
    this.enemyModel = createCharacter(this.enemyId);
    this.stage.scene.add(this.playerModel.root, this.enemyModel.root);
    this.syncModelTransform(this.playerModel, this.state.player);
    this.syncModelTransform(this.enemyModel, this.state.enemy);
    this.playerModel.play('idle');
    this.enemyModel.play('idle');

    this.vfx.clear();
    this.input.reset();

    const startPos = groundPos(this.state.player.x, this.state.player.y);
    this.stage.rig.snapTo(startPos.x, startPos.z);
    this.stage.lighting.focus(startPos.x, startPos.z, 30);
  }

  /** Gather this tick's raw input and turn it into a `MatchInput` the sim understands. */
  private buildInput(): MatchInput {
    const playing = this.state.phase === 'playing';

    const move = playing ? this.input.moveAxes() : { x: 0, y: 0 };

    let aim: { x: number; y: number } | undefined;
    if (playing) {
      const ndc = this.input.mouseNdc;
      if (ndc) {
        this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.stage.rig.camera);
        const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.rayHit);
        if (hit) {
          // Unproject the cursor's ground-plane hit (3D metres) back to world units,
          // then express it as a direction FROM the player — MatchInput.aim is a
          // facing vector, not a target point.
          aim = {
            x: toWorldUnits(hit.x) - this.state.player.x,
            y: toWorldUnits(hit.z) - this.state.player.y,
          };
        }
      }
    }

    const attack = playing && this.input.attackHeld;

    return { move, aim, selectedWeapon: this.input.selectedWeapon, attack };
  }

  private syncModelTransform(model: CharacterModel, fighter: Fighter): void {
    const pos = groundPos(fighter.x, fighter.y);
    model.root.position.set(pos.x, 0, pos.z);
    // Character convention (characters/types.ts): root faces +Z at rotation.y = 0.
    // World (x, y) maps directly to three (x, z) with no sign flip (units.ts), so the
    // rotation that points local +Z at a facing vector (fx, fy) is atan2(fx, fy).
    model.root.rotation.y = Math.atan2(fighter.facing.x, fighter.facing.y);
  }

  /** React to this tick's sim events: attack/hit/death animations + a camera shake. */
  private handleEvents(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'weapon-fired': {
          const model = ev.fighterRole === 'player' ? this.playerModel : this.enemyModel;
          const fighter = this.state[ev.fighterRole];
          const weapons = CHARACTERS[fighter.characterId].weapons;
          const weaponIndex = weapons.findIndex((w) => w.key === ev.weaponKey);
          model.play('attack', { weaponIndex: weaponIndex < 0 ? 0 : weaponIndex });
          break;
        }
        case 'hit-landed': {
          const model = ev.targetRole === 'player' ? this.playerModel : this.enemyModel;
          model.play('hit');
          this.stage.rig.shake(ev.targetRole === 'player' ? 0.22 : 0.14);
          break;
        }
        case 'death': {
          const model = ev.fighterRole === 'player' ? this.playerModel : this.enemyModel;
          model.play('death');
          break;
        }
        default:
          break;
      }
    }
  }

  private projectToScreen(model: CharacterModel, alive: boolean): { x: number; y: number } | null {
    if (!alive) return null;
    this.projectVec.set(model.root.position.x, FLOAT_BAR_HEIGHT, model.root.position.z);
    this.projectVec.project(this.stage.rig.camera);
    if (this.projectVec.z > 1) return null;
    const rect = this.stage.canvas.getBoundingClientRect();
    return {
      x: (this.projectVec.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (1 - (this.projectVec.y * 0.5 + 0.5)) * rect.height + rect.top,
    };
  }

  private readonly handleResize = (): void => this.resize();

  private readonly loop = (): void => {
    if (this.disposed) return;

    const dtSeconds = Math.min(this.clock.getDelta(), 1 / 20) * this.simSpeed;
    const dtMs = dtSeconds * 1000;

    const prevPlayer = { x: this.state.player.x, y: this.state.player.y };
    const prevEnemy = { x: this.state.enemy.x, y: this.state.enemy.y };

    const input = this.buildInput();
    const events = stepMatch(this.state, dtMs, input);
    this.handleEvents(events);

    const playerMoved = this.state.player.x !== prevPlayer.x || this.state.player.y !== prevPlayer.y;
    const enemyMoved = this.state.enemy.x !== prevEnemy.x || this.state.enemy.y !== prevEnemy.y;

    this.syncModelTransform(this.playerModel, this.state.player);
    this.syncModelTransform(this.enemyModel, this.state.enemy);

    if (this.state.player.alive) this.playerModel.play(playerMoved ? 'run' : 'idle');
    if (this.state.enemy.alive) this.enemyModel.play(enemyMoved ? 'run' : 'idle');

    const elapsedSeconds = this.state.elapsed / 1000;
    this.playerModel.update({
      dt: dtSeconds,
      elapsed: elapsedSeconds,
      moveSpeed01: this.state.player.alive && playerMoved ? 1 : 0,
      health01: this.state.player.hp / this.state.player.maxHp,
    });
    this.enemyModel.update({
      dt: dtSeconds,
      elapsed: elapsedSeconds,
      moveSpeed01: this.state.enemy.alive && enemyMoved ? 1 : 0,
      health01: this.state.enemy.hp / this.state.enemy.maxHp,
    });

    this.arena.update?.(dtSeconds, elapsedSeconds);
    this.vfx.sync(this.state);

    const playerPos = groundPos(this.state.player.x, this.state.player.y);
    this.stage.rig.follow(playerPos.x, playerPos.z);
    this.stage.lighting.focus(playerPos.x, playerPos.z, 30);

    this.hud.update(this.state, { selectedWeapon: this.input.selectedWeapon });
    this.hud.updateFloatingBars(
      this.projectToScreen(this.playerModel, this.state.player.alive),
      this.projectToScreen(this.enemyModel, this.state.enemy.alive),
      this.state.player.hp / this.state.player.maxHp,
      this.state.enemy.hp / this.state.enemy.maxHp,
    );

    this.stage.render(dtSeconds);

    if (!this.readyFired) {
      this.readyFired = true;
      window.__gameReady = true;
      window.__previewReady = true;
    }

    this.raf = requestAnimationFrame(this.loop);
  };
}

export function startGame(opts: GameSessionOptions): GameSession {
  return new GameSession(opts);
}
