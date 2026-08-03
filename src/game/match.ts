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
import type { DamageSource, Fighter, FighterRole, GameEvent, MatchInput, MatchState } from './state';
import { otherRole } from './state';
import { CHARACTER_IDS, CHARACTERS, type CharacterId, type Weapon } from './rules';
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
    /** QA-only counter, bumped on every `giantSlam` weapon-fired event. A screenshot
     * driver can `waitForFunction` on this to reliably catch the Giant Lollipop
     * shockwave, which is real but brief (and shorter still under `?simSpeed=`),
     * rather than guessing at screenshot timing. Never read by game logic. */
    __vfxDebugGiantSlamCount?: number;
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

/** QA-only matchup override: `?player=lollipop&enemy=egg` on the page URL, same
 * spirit as `?simSpeed=`. Falls through to the caller's `opts` (which still wins if
 * explicitly set) and finally the defaults above. Lets a screenshot/Playwright pass
 * pick a specific character — e.g. Lollipop, to reach Giant Lollipop — without a
 * roster-select UI. */
function characterFromQuery(param: string): CharacterId | null {
  const raw = new URLSearchParams(location.search).get(param);
  return raw && (CHARACTER_IDS as readonly string[]).includes(raw) ? (raw as CharacterId) : null;
}

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

  // ── Hit-stop bookkeeping ──────────────────────────────────────────────────
  // On a solid hit we withhold most of this frame's (and the next few frames')
  // sim-time budget from `stepMatch`, so the simulation (and character animation,
  // which is driven off the same dt) freezes for a beat. Every millisecond withheld
  // is banked in `hitStopBankedMs` and paid back — on top of normal dt, at an
  // accelerated rate — the moment the freeze window ends. That's what "borrowing
  // back" means: `stepDtMs` summed over time always converges to `rawDtMs` summed
  // over time, so `state.elapsed` (match timer, cooldowns, status durations, the
  // closing fog) never drifts from real/simSpeed-scaled time — the freeze just
  // redistributes a little of it into a short, deliberate pause instead of losing it.
  private hitStopBudgetMs = 0;
  private hitStopBankedMs = 0;
  /** Fraction of a frame's dt that still reaches the sim during a freeze — kept
   * slightly non-zero rather than a hard 0 so nothing in the sim ever sees dt === 0. */
  private static readonly HITSTOP_TRICKLE = 0.05;
  /** How many multiples of a normal frame's dt the banked time repays per frame once
   * the freeze ends — high enough that the catch-up resolves in a couple of frames
   * (reads as a snappy "unfreeze"), not a slow-motion limp back to normal speed. */
  private static readonly HITSTOP_CATCHUP_RATE = 3;

  // ── Visual-only knockback ────────────────────────────────────────────────
  // The sim never moves a fighter on a hit (see combat.ts), so this nudges only the
  // 3D model's root position, decaying quickly — it is added AFTER `syncModelTransform`
  // writes the sim-authoritative position each frame, and never touches `MatchState`,
  // so sim and render can never desync over it.
  private readonly knockback: Record<FighterRole, { x: number; z: number }> = {
    player: { x: 0, z: 0 },
    enemy: { x: 0, z: 0 },
  };

  constructor(private readonly opts: GameSessionOptions) {
    this.playerId = opts.playerCharacterId ?? characterFromQuery('player') ?? DEFAULT_PLAYER;
    this.enemyId = opts.enemyCharacterId ?? characterFromQuery('enemy') ?? DEFAULT_ENEMY;
    const requestedSpeed = Number(new URLSearchParams(location.search).get('simSpeed'));
    this.simSpeed = Number.isFinite(requestedSpeed) && requestedSpeed > 0 ? Math.min(50, requestedSpeed) : 1;

    // Same Stage recipe `preview.ts` uses for the arena's "gameplay" view — a
    // character/arena approved in preview must render identically in the real game.
    //
    // A MATCH uses `frameMode: 'fair'`, never a fixed `viewWidthUnits`: how much arena
    // you can see is a balance number in a PvP brawler, so the rig fits the
    // gameplay-derived fair-play square (`camera.ts` -> `FAIR_PLAY`) at whatever aspect
    // the device has. `viewWidthUnits: 265` framed a constant WIDTH and let the visible
    // DEPTH collapse with the aspect ratio — 287 wu of depth on a 4:3 tablet against
    // 164 wu on a 21:9, i.e. the tablet saw 75% further forward for free.
    this.stage = new Stage({
      container: opts.container,
      background: 0xffcf8a,
      fog: { color: 0xffcf8a, near: 40, far: 130 },
      camera: { pitchDeg: 58, yawDeg: 0, frameMode: 'fair' },
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
    this.hitStopBudgetMs = 0;
    this.hitStopBankedMs = 0;
    this.knockback.player.x = 0; this.knockback.player.z = 0;
    this.knockback.enemy.x = 0; this.knockback.enemy.z = 0;

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

  /** Resolve a tint for a damage-source, so every hit's VFX matches what caused it —
   * a weapon's own colour (rules.ts), or a fixed tint for the three ambient sources
   * that have no weapon of their own. */
  private colorForDamageSource(targetRole: FighterRole, source: DamageSource): string {
    switch (source.kind) {
      case 'weapon': {
        const attacker = this.state[otherRole(targetRole)];
        const weapon = CHARACTERS[attacker.characterId].weapons.find((w) => w.key === source.weaponKey);
        return weapon?.color ?? '#FFFFFF';
      }
      case 'trail':
        return source.ownerRole === 'player' ? '#FF9EC4' : '#FFD27A';
      case 'hazard':
        return '#FF7A3D';
      case 'fog':
        return '#B98CE6';
      default:
        return '#FFFFFF';
    }
  }

  /** Queue up to `ms` of hit-stop. Takes the max against any already-queued freeze
   * rather than stacking additively, so N simultaneous hits (e.g. a 5-pellet Rice
   * Spray landing at once) don't compound into a multi-hundred-ms freeze. */
  private triggerHitStop(ms: number): void {
    this.hitStopBudgetMs = Math.max(this.hitStopBudgetMs, ms);
  }

  /** Nudge a fighter's VISUAL model away from an attack source. Sim positions are
   * never touched — see the `knockback` field comment. */
  private applyKnockback(targetRole: FighterRole, fromX: number, fromY: number, amount: number): void {
    const target = this.state[targetRole];
    const dx = target.x - fromX;
    const dy = target.y - fromY;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-4) return;
    const impulse = THREE.MathUtils.clamp(amount, 0, 0.22);
    const kb = this.knockback[targetRole];
    kb.x += (dx / mag) * impulse;
    kb.z += (dy / mag) * impulse;
  }

  /** React to this tick's sim events: attack/hit/death animations, ability VFX, hit
   * stop, screen shake, knockback and floating damage numbers. */
  private handleEvents(events: GameEvent[]): void {
    // Remembers the colour of the hit that killed each fighter this tick, so the
    // `death` event (which carries no damage-source info of its own) can still tint
    // its burst correctly — `applyDamage` always pushes `hit-landed` immediately
    // before `death` in the same batch (combat.ts), so this is always populated by
    // the time `death` is processed.
    const lastHitColor: Partial<Record<FighterRole, string>> = {};

    for (const ev of events) {
      switch (ev.type) {
        case 'weapon-fired': {
          const model = ev.fighterRole === 'player' ? this.playerModel : this.enemyModel;
          const fighter = this.state[ev.fighterRole];
          const weapons = CHARACTERS[fighter.characterId].weapons;
          const weaponIndex = weapons.findIndex((w) => w.key === ev.weaponKey);
          const weapon = weapons[weaponIndex < 0 ? 0 : weaponIndex];
          model.play('attack', { weaponIndex: weaponIndex < 0 ? 0 : weaponIndex });

          if (weapon) {
            this.vfx.spawnCastFlash(fighter.x, fighter.y, fighter.facing, weapon, fighter.characterId);
            if (weapon.type === 'melee') {
              this.vfx.spawnMeleeArc(fighter.x, fighter.y, fighter.facing, weapon.range ?? 0, weapon.cone ?? 360, weapon.color);
            }
            if (weapon.giantSlam) {
              this.vfx.spawnGiantSlamShockwave(fighter.x, fighter.y, weapon.color, weapon.range ?? 0);
              this.hud.flashScreen(weapon.color);
              this.stage.rig.shake(0.55, 2.6);
              this.triggerHitStop(120);
              window.__vfxDebugGiantSlamCount = (window.__vfxDebugGiantSlamCount ?? 0) + 1;
            }
          }
          break;
        }
        case 'hit-landed': {
          const model = ev.targetRole === 'player' ? this.playerModel : this.enemyModel;
          model.play('hit');

          const color = this.colorForDamageSource(ev.targetRole, ev.source);
          lastHitColor[ev.targetRole] = color;

          // Resolve the attacking weapon (if this hit came from one) so
          // `spawnImpactBurst` can look up a bespoke per-weapon `impact()` hook
          // (`vfx/weapons/`) — trail/hazard/fog hits have no weapon and always take
          // the generic burst, exactly as before this system existed.
          let impactSource: { weapon: Weapon; characterId: CharacterId; fromXWU: number; fromYWU: number } | undefined;
          if (ev.source.kind === 'weapon') {
            const attackerFighter = this.state[otherRole(ev.targetRole)];
            const weaponKey = ev.source.weaponKey;
            const weapon = CHARACTERS[attackerFighter.characterId].weapons.find((w) => w.key === weaponKey);
            if (weapon) {
              impactSource = {
                weapon, characterId: attackerFighter.characterId,
                fromXWU: attackerFighter.x, fromYWU: attackerFighter.y,
              };
            }
          }
          this.vfx.spawnImpactBurst(ev.x, ev.y, color, ev.amount, impactSource);

          const screenPos = this.projectPointToScreen(ev.x, ev.y, 1.3);
          if (screenPos) this.hud.spawnDamageNumber(screenPos, ev.amount);

          // Screen shake scales with the actual damage — a Rice Spray tick barely
          // registers, a Soup Dump or Giant Lollipop hit rattles the camera. Ambient
          // ticks (fog/hazard/trail) shake less and never trigger hit-stop, so the
          // game doesn't stutter every 300ms from standing in the fog.
          const isWeaponHit = ev.source.kind === 'weapon';
          const shakeBase = THREE.MathUtils.clamp(0.05 + ev.amount * 0.011, 0.05, 0.5);
          const targetBias = ev.targetRole === 'player' ? 1.25 : 1;
          this.stage.rig.shake(shakeBase * targetBias * (isWeaponHit ? 1 : 0.45));

          if (isWeaponHit) {
            this.triggerHitStop(THREE.MathUtils.clamp(38 + ev.amount * 1.8, 40, 80));
          }

          if (ev.source.kind === 'weapon') {
            const attacker = this.state[otherRole(ev.targetRole)];
            this.applyKnockback(ev.targetRole, attacker.x, attacker.y, 0.05 + ev.amount * 0.006);
          } else if (ev.source.kind === 'trail') {
            const owner = this.state[ev.source.ownerRole];
            this.applyKnockback(ev.targetRole, owner.x, owner.y, 0.03);
          }
          break;
        }
        case 'heal': {
          const fighter = this.state[ev.fighterRole];
          this.vfx.spawnHealPulse(fighter.x, fighter.y);
          const screenPos = this.projectPointToScreen(fighter.x, fighter.y, 1.6);
          if (screenPos) this.hud.spawnDamageNumber(screenPos, ev.amount, { heal: true });
          break;
        }
        case 'death': {
          const model = ev.fighterRole === 'player' ? this.playerModel : this.enemyModel;
          model.play('death');
          const fighter = this.state[ev.fighterRole];
          const color = lastHitColor[ev.fighterRole] ?? '#FFFFFF';
          this.vfx.spawnDeathBurst(fighter.x, fighter.y, color);
          this.stage.rig.shake(0.42, 3);
          this.triggerHitStop(90);
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

  /** Project an arbitrary WORLD-UNIT point (e.g. a hit location, not a character
   * root) to screen space, for floating damage numbers. */
  private projectPointToScreen(xWU: number, yWU: number, heightM: number): { x: number; y: number } | null {
    const pos = groundPos(xWU, yWU);
    this.projectVec.set(pos.x, heightM, pos.z);
    this.projectVec.project(this.stage.rig.camera);
    if (this.projectVec.z > 1) return null;
    const rect = this.stage.canvas.getBoundingClientRect();
    return {
      x: (this.projectVec.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (1 - (this.projectVec.y * 0.5 + 0.5)) * rect.height + rect.top,
    };
  }

  private readonly handleResize = (): void => this.resize();

  /** Exponential decay toward zero, used for the visual-only knockback offset.
   * Deliberately driven by `rawDtSeconds` (real/simSpeed time, NOT hit-stop-scaled)
   * so the nudge still reads as a snappy pop even while the sim is frozen. */
  private decayKnockback(rawDtSeconds: number): void {
    const decay = Math.exp(-rawDtSeconds * 14);
    for (const role of ['player', 'enemy'] as const) {
      const kb = this.knockback[role];
      kb.x *= decay;
      kb.z *= decay;
      if (Math.abs(kb.x) < 1e-4) kb.x = 0;
      if (Math.abs(kb.z) < 1e-4) kb.z = 0;
    }
  }

  private readonly loop = (): void => {
    if (this.disposed) return;

    const rawDtSeconds = Math.min(this.clock.getDelta(), 1 / 20) * this.simSpeed;
    const rawDtMs = rawDtSeconds * 1000;

    // ── Hit-stop dt accounting ────────────────────────────────────────────────
    // See the field comments above for the full "borrow it back" invariant. Short
    // version: whatever we don't spend on `stepDtMs` this frame goes into
    // `hitStopBankedMs` and gets paid back with the next frames' dt once the freeze
    // ends, so `stepDtMs` summed over time always converges back to `rawDtMs` summed
    // over time — no game time is ever lost, only redistributed into a brief pause.
    let stepDtMs: number;
    if (this.hitStopBudgetMs > 0) {
      this.hitStopBudgetMs = Math.max(0, this.hitStopBudgetMs - rawDtMs);
      stepDtMs = rawDtMs * GameSession.HITSTOP_TRICKLE;
      this.hitStopBankedMs += rawDtMs - stepDtMs;
    } else if (this.hitStopBankedMs > 0) {
      const catchUp = Math.min(this.hitStopBankedMs, rawDtMs * GameSession.HITSTOP_CATCHUP_RATE);
      this.hitStopBankedMs -= catchUp;
      stepDtMs = rawDtMs + catchUp;
    } else {
      stepDtMs = rawDtMs;
    }
    const stepDtSeconds = stepDtMs / 1000;

    const prevPlayer = { x: this.state.player.x, y: this.state.player.y };
    const prevEnemy = { x: this.state.enemy.x, y: this.state.enemy.y };

    const input = this.buildInput();
    const events = stepMatch(this.state, stepDtMs, input);
    this.handleEvents(events);

    const playerMoved = this.state.player.x !== prevPlayer.x || this.state.player.y !== prevPlayer.y;
    const enemyMoved = this.state.enemy.x !== prevEnemy.x || this.state.enemy.y !== prevEnemy.y;

    this.syncModelTransform(this.playerModel, this.state.player);
    this.syncModelTransform(this.enemyModel, this.state.enemy);
    // Layer the visual-only knockback nudge on top of the sim-authoritative position
    // written just above — never the other way around, so the sim position always
    // wins next frame and the two can't drift apart.
    this.playerModel.root.position.x += this.knockback.player.x;
    this.playerModel.root.position.z += this.knockback.player.z;
    this.enemyModel.root.position.x += this.knockback.enemy.x;
    this.enemyModel.root.position.z += this.knockback.enemy.z;
    this.decayKnockback(rawDtSeconds);

    if (this.state.player.alive) this.playerModel.play(playerMoved ? 'run' : 'idle');
    if (this.state.enemy.alive) this.enemyModel.play(enemyMoved ? 'run' : 'idle');

    // Character animation runs on `stepDtSeconds` (hit-stop-scaled) so attack swings,
    // run cycles and the hit-flash visibly hitch along with the sim on a solid hit —
    // that shared pause across sim + character motion IS the hit-stop.
    const elapsedSeconds = this.state.elapsed / 1000;
    this.playerModel.update({
      dt: stepDtSeconds,
      elapsed: elapsedSeconds,
      moveSpeed01: this.state.player.alive && playerMoved ? 1 : 0,
      health01: this.state.player.hp / this.state.player.maxHp,
    });
    this.enemyModel.update({
      dt: stepDtSeconds,
      elapsed: elapsedSeconds,
      moveSpeed01: this.state.enemy.alive && enemyMoved ? 1 : 0,
      health01: this.state.enemy.hp / this.state.enemy.maxHp,
    });

    this.arena.update?.(stepDtSeconds, elapsedSeconds);
    this.vfx.sync(this.state);
    // Ability VFX (flashes/shards/arcs) run on `rawDtSeconds` — UNAFFECTED by
    // hit-stop — so the impact itself still pops instantly and reads clearly during
    // the freeze instead of also grinding to a near-halt with everything else.
    this.vfx.updateEffects(rawDtSeconds);

    const playerPos = groundPos(this.state.player.x, this.state.player.y);
    this.stage.rig.follow(playerPos.x, playerPos.z);
    this.stage.lighting.focus(playerPos.x, playerPos.z, 30);

    // TEMP DEBUG: ground-plane screen projections for scripted aim in
    // tools/tmp/vfx_convert_capture.mjs (the floating HUD pill sits well above the
    // head, which makes a Playwright driver systematically overshoot when raycasting
    // mouse position back to the ground plane, per `buildInput()`'s aim math).
    (window as any).__vfxDebugScreen = {
      player: this.projectPointToScreen(this.state.player.x, this.state.player.y, 0),
      enemy: this.projectPointToScreen(this.state.enemy.x, this.state.enemy.y, 0),
    };

    this.hud.update(this.state, { selectedWeapon: this.input.selectedWeapon });
    this.hud.updateFloatingBars(
      this.projectToScreen(this.playerModel, this.state.player.alive),
      this.projectToScreen(this.enemyModel, this.state.enemy.alive),
      this.state.player.hp / this.state.player.maxHp,
      this.state.enemy.hp / this.state.enemy.maxHp,
    );

    // Camera (follow lerp + shake decay) always runs in real time — a shaking camera
    // that also froze during hit-stop would just look like a rendering hitch instead
    // of a deliberate punch.
    this.stage.render(rawDtSeconds);

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
