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
import type { ArenaDefinition } from '../arena/types';
import { createCharacter } from '../characters/registry';
import type { CharacterModel } from '../characters/types';
import { createFogRing, type FogRing } from '../arena/fogRing';
import { createMatch, stepMatch, type MatchLevels } from './sim';
import { enemyLevelFor } from './economy';
import type { DamageSource, Fighter, FighterRole, GameEvent, MatchInput, MatchState } from './state';
import { otherRole } from './state';
import { boxesOverlap } from './movement';
import { CHARACTER_IDS, CHARACTERS, LEVEL_MIN, MATCH_DURATION_MS, MIN_SAFE_RADIUS, clampLevel, type CharacterId, type Weapon } from './rules';
import { CHARACTER_HEIGHT, groundPos, toWorldUnits } from '../units';
import { InputController } from './input';
import { createPointerLock, type PointerLockController } from './pointerLock';
import { VfxLayer } from './vfx';
// Audio is a SECOND, independent consumer of the same `GameEvent[]` stream the VFX
// layer runs on — see `src/audio/director.ts`. It never touches the sim, never
// touches the renderer, and every call into it is failure-tolerant by contract, so
// an audio problem degrades to silence rather than to a stalled frame.
import { createMatchAudio, type MatchAudio } from '../audio';
// `enemyVisibleToPlayer` is concealment's ONE presentation-side predicate, shared by all
// three surfaces that could leak the opponent's position (radar blip, floating HP pill,
// 3D model). It is declared in `hud.ts` rather than here purely for import direction:
// `match.ts` imports `hud.ts` and not the other way round, so this is the only placement
// that lets both files call one copy instead of growing two. Its header carries the
// asymmetry rule — observer is always `state.player`, target is always `state.enemy`.
import { createHud, enemyVisibleToPlayer, type Hud, type ScreenPoint } from '../ui/hud';

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
    /** QA-only mirror of the INPUT → SIM edge. See `MatchDebug`. */
    __matchDebug?: MatchDebug;
    /** QA-only mirror of the EVENT → FEEL edge. See `FeelDebug`. */
    __feelDebug?: FeelDebug;
    /**
     * QA-only: run one synthetic `GameEvent` through the REAL `handleEvents` path —
     * every feel channel at once (impact VFX, camera kick, hit-stop, knockback,
     * damage number), arbitrated exactly as a sim-emitted event would be.
     *
     * `window.__vfxSpawnTest` already fires one VFX effect on demand, and that is not
     * the same question. A hit is a MULTI-CHANNEL event and this project has already
     * paid for measuring channels separately: Giant Lollipop's three passes each
     * looked reasonable alone and together repainted 85.3% of the player
     * (`docs/LESSONS.md` §7). Driving a real hit through gameplay is unreliable —
     * fighters spawn 1080 wu apart, weapons reach <= 140 wu, and probes have timed
     * out waiting (`docs/TOOLS.md`) — so a probe that wants to compare a 2-damage
     * chip against an 18-damage smash has no repeatable way to produce either.
     *
     * Deliberately takes a whole `GameEvent` rather than `(damage)`: the response is
     * a function of `source.kind` as much as of `amount` (fog gets no burst and no
     * shake; trail/hazard get no hit-stop), and a hook that could only express one of
     * those would measure a path the player never takes.
     *
     * Published by the constructor, cleared by `dispose()`. Never called by game logic.
     */
    __feelEvent?: (ev: GameEvent) => void;
    /**
     * QA-only: THE LIVE `ArenaDefinition` this match is stepping, by reference.
     *
     * It exists for exactly one question that is otherwise unanswerable:
     * **is a concealed enemy actually invisible on screen?** No arena declares an
     * `arena.concealment` list yet (the mechanic shipped inert and Uri's plates are not
     * placed), so without a handle there is no way to render the state at all — the
     * three hiding surfaces would ship measured only by reading the code, which is this
     * project's most-repeated failure. A probe assigns
     * `window.__matchArena.concealment = [...]` and the very next frame is drawn through
     * it, because `MatchState.arena` is this same object.
     *
     * Deliberately the ARENA and not the whole session: it is the one input the renderer
     * and the sim genuinely share, so a probe can change the world without being able to
     * reach into `MatchState` and fake an outcome. Strictly less power than
     * `__feelEvent` immediately above, which synthesises gameplay events outright.
     *
     * Published by the constructor, cleared by `dispose()`. Never read by game logic —
     * every gameplay reader goes through `this.arena`/`state.arena` directly.
     */
    __matchArena?: ArenaDefinition;
  }
}

/**
 * QA-only, never read by game logic — the EVENT → FEEL edge, in the same spirit as
 * `MatchDebug`'s INPUT → SIM edge and for the same reason.
 *
 * `stepMatch()` returns a typed `GameEvent[]` with two independent consumers (this
 * file's `handleEvents`, and `audio/director.ts`). Nothing published which events
 * arrived or which feedback channels answered them, so "this event has no visual
 * response" and "this event never fires" were the same picture from outside. That is
 * exactly the shape the audio pillar's worst bug had: a match ending on the clock and
 * the FINAL RING had no sound at all, and it survived because 95.3% of real ticks
 * carry no events, so a census taken by eye sees nothing either way.
 *
 * `events` is keyed the way `tools/tmp/feel_census.mjs` keys its Node-side census —
 * `hit-landed:weapon`, `projectile-destroyed:hit-cover` — so the two tables join. The
 * census is the DENOMINATOR (what the sim emits over 110 matches); this is the
 * NUMERATOR (what the renderer did about it). Neither is trustworthy alone.
 *
 * Mutated in place, never reallocated, with every key present from construction — it
 * is written every frame and this project tracks per-frame allocation.
 */
export interface FeelDebug {
  /** `GameEvent` arrivals, keyed as `feel_census.mjs` keys them. */
  events: Record<string, number>;
  /** Feedback channels fired, by channel. A key in `events` with zero movement in
   * ANY of these across a whole match is a gap, not a taste call. */
  responses: {
    vfx: number;
    shake: number;
    hitStop: number;
    knockback: number;
    damageNumber: number;
    screenFlash: number;
  };
  /** Live hit-stop state, refreshed every frame — see the `hitStop*` fields. */
  hitStopBudgetMs: number;
  hitStopBankedMs: number;
  /**
   * The freeze the LAST `triggerHitStop` asked for, in ms.
   *
   * `hitStopBudgetMs` cannot answer that question: `triggerHitStop` takes a `Math.max`
   * against whatever is already queued (so five Rice Spray pellets do not compound
   * into a multi-hundred-ms freeze), which means the live budget is a running maximum
   * and a probe reading it after a 2-damage chip sees whatever the last big hit
   * queued. That is not a hypothetical — it made this file's own probe report an
   * identical 70 ms for every rung of a 2..18 damage ladder, i.e. a dynamic range of
   * exactly 1.00x, which is a confidently wrong answer about the channel under test.
   */
  lastHitStopMs: number;
  /** Last frame's real budget vs what actually reached `stepMatch`, in ms. Their
   * RATIO is the freeze: 1.0 is normal time, `HITSTOP_TRICKLE` is a full freeze, and
   * anything above 1.0 is the banked time being repaid. */
  rawDtMs: number;
  stepDtMs: number;
  /** Frames since the match began in each of the three dt regimes. `frozen +
   * repaying` over `frames` is the share of the match that is not running at 1x —
   * the number that says whether hit-stop reads as a punch or as a stutter. */
  frames: number;
  frozenFrames: number;
  repayingFrames: number;
  /** Largest `amount` seen on a `hit-landed`, and the largest shake it asked for.
   * Both are peaks over the match, so a single number says whether the loud end of
   * the range is ever actually reached in play. */
  peakHitAmount: number;
  peakShakeM: number;
}

/** Every key `FeelDebug.events` can carry, allocated up front so the record never
 * grows at runtime. Mirrors `tools/tmp/feel_census.mjs`'s keying exactly. */
const FEEL_EVENT_KEYS = [
  'countdown-tick', 'match-started', 'match-ended', 'weapon-fired', 'weapon-fired:giantSlam',
  'projectile-spawned', 'projectile-destroyed:hit-target', 'projectile-destroyed:hit-cover',
  'projectile-destroyed:expired', 'hit-landed:weapon', 'hit-landed:trail', 'hit-landed:hazard',
  'hit-landed:fog', 'heal', 'death', 'splat-created', 'trail-mark-created',
] as const;

/**
 * QA-only, never read by game logic — the instrument that exists because
 * "WASD does not move the player" was reported, investigated and NOT diagnosed with
 * nothing to look at between the DOM and the fighter's position.
 *
 * Every field is one link in that chain, in order, so a probe can name the broken
 * link instead of guessing at it:
 *
 *   phase/paused   is the sim even stepping?
 *   moveX/moveY    did the keyboard reach `MatchInput.move`? (non-zero here with a
 *                  stationary fighter means the break is in the SIM, not in input —
 *                  which is exactly what the 2026-08 report turned out to be)
 *   attack         did the mouse reach `MatchInput.attack`?
 *   facingX/Y      did the aim pipeline (mouse → NDC → raycast → direction) survive?
 *   pointerLocked  which of the two cursor models is live
 *   qaSpawnInsideCover
 *                  a `?px=/?py=` that teleported the fighter INTO a CoverBox. There
 *                  is no depenetration anywhere in `movement.ts` — `tryMove` tests
 *                  the DESTINATION for overlap, and from inside a box every
 *                  destination within one step still overlaps — so such a fighter is
 *                  pinned for the rest of the match while input flows perfectly.
 *
 * Mutated in place, never reallocated: it is written every frame and this project
 * tracks per-frame allocation (1,697 B/frame) as a number worth keeping.
 */
export interface MatchDebug {
  phase: MatchState['phase'];
  winner: FighterRole | null;
  paused: boolean;
  moveX: number;
  moveY: number;
  attack: boolean;
  facingX: number;
  facingY: number;
  /** `1`-`4` / the HUD weapon bar. Zero-based, as `MatchInput.selectedWeapon`. */
  selectedWeapon: number;
  pointerLocked: boolean;
  /** Description of the offending CoverBox, or null. Set once, at spawn. */
  qaSpawnInsideCover: string | null;
  /** Frames the loop has run. Lets a probe prove the loop is alive while paused. */
  frames: number;
}

export interface GameSessionOptions {
  /** Mount point for the WebGL canvas. */
  container: HTMLElement;
  /** Mount point for the DOM HUD. */
  hudRoot: HTMLElement;
  playerCharacterId?: CharacterId;
  enemyCharacterId?: CharacterId;
  /**
   * Fired whenever the match crosses a phase boundary, including the reset back to
   * `countdown` on restart.
   *
   * Exists so the screen layer (`ui/screens/matchScreen.ts`) can react to a match
   * ending — bank the result on the player profile, reveal the "back to menu"
   * button — WITHOUT polling `MatchState` from outside or reaching into the HUD.
   * The session stays the only owner of match state; this is the one-way edge out.
   */
  onPhase?: (phase: MatchState['phase'], winner: FighterRole | null) => void;
  /**
   * The player's CHARACTER level for `playerCharacterId`, 1-15 (`rules.ts` DEVIATION #11).
   *
   * The opponent's level is NOT a second option: it is derived here through
   * `economy/levels.ts:enemyLevelFor()`, which is the single place Uri's answer lives —
   * *"AI players… need to be adjusted to the player's level."* A caller that could set
   * the two independently would be a caller that could silently un-answer that question.
   *
   * Defaults to `LEVEL_MIN`, whose multipliers are exactly 1.0, so a caller that does not
   * pass it produces a bit-identical match to the one this build produced before levels.
   */
  playerLevel?: number;
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

/** QA-only numeric URL override, same spirit as `?simSpeed=`. */
function numberFromQuery(param: string): number | null {
  const raw = new URLSearchParams(location.search).get(param);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Metres above a fighter's feet the floating HUD pill should anchor to. */
const FLOAT_BAR_HEIGHT = CHARACTER_HEIGHT + 0.35;

export class GameSession {
  private readonly stage: Stage;
  private readonly arena = createKitchenArena();
  private readonly vfx: VfxLayer;
  private readonly audio: MatchAudio = createMatchAudio();
  private readonly hud: Hud;
  private readonly input: InputController;
  private readonly pointerLock: PointerLockController;
  private readonly fogRing: FogRing;
  private readonly playerId: CharacterId;
  private readonly enemyId: CharacterId;
  /** Both fighters' levels. Symmetric by construction — see `GameSessionOptions`. */
  private readonly levels: MatchLevels;

  private playerModel: CharacterModel;
  private enemyModel: CharacterModel;
  private state: MatchState;

  private readonly clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private readyFired = false;

  /**
   * Pause.
   *
   * Deliberately NOT "stop the rAF loop": the canvas would then hold a stale frame
   * that any resize, tab switch or DPR change would blank, and the HUD's own CSS
   * animations would keep running over a frozen picture. Instead the loop keeps
   * running and simply skips the simulation, so the last live frame stays composited
   * and correct. `THREE.Clock.getDelta()` is still consumed every frame, which is
   * what makes resuming seamless — no accumulated multi-second delta to absorb.
   */
  private isPaused = false;

  /** Last phase handed to `opts.onPhase`, so the callback fires on TRANSITIONS only. */
  private lastPhase: MatchState['phase'] | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly rayHit = new THREE.Vector3();
  private readonly projectVec = new THREE.Vector3();

  /**
   * Live projectiles, keyed by sim id, for the one thing `projectile-destroyed`
   * cannot tell us on its own.
   *
   * That event carries `{ id, reason, x, y }` and nothing else — no weapon, no colour,
   * no velocity — because `sim.ts` splices the projectile out of `state.projectiles`
   * in the same call that pushes it, so by the time this file sees the event the
   * object is gone. `spawnCoverScuff` needs the colour (so a scuff reads as *that*
   * shot) and the travel direction (so the sparks come back off the surface rather
   * than fanning at random), and both are reconstructible from the `projectile-spawned`
   * event that must have preceded it: direction is simply destroy-position minus
   * spawn-position.
   *
   * Bounded by construction — every entry is deleted on `projectile-destroyed`, which
   * `sim.ts` guarantees for every projectile it ever creates (hit / cover / expiry are
   * the only three exits, and all three route through `removeProjectile`).
   */
  private readonly projectileOrigins = new Map<number, { color: string; x: number; y: number }>();

  /**
   * QA-only fast-forward: `?simSpeed=8` on the page URL advances the sim faster than
   * real time. Defaults to 1 (no effect) for real play. Exists because a software
   * (SwiftShader) renderer makes each frame expensive, and our own per-frame dt is
   * clamped for simulation stability — without this, waiting out a 5s countdown for a
   * screenshot means waiting far longer than 5 real seconds.
   */
  private readonly simSpeed: number;

  /**
   * QA-only closing-fog setup, so a screenshot can land on an exact ring state
   * instead of fast-forwarding and hoping.
   *
   * `?fogRadius=<worldUnits>` skips the countdown and rewinds the match clock to the
   * moment `safeRadius` equals that value (the sim's schedule is
   * `safeRadius = maxSafeRadius * timeRemaining / MATCH_DURATION_MS`, so this is a
   * straight inversion and every other timer stays consistent with it).
   * `?px=`/`?py=` place the player anywhere on the map — the only sane way to shoot
   * "standing in the fog" or "standing on the boundary" repeatably.
   *
   * Never read by game logic; absent params leave a match completely untouched.
   */
  private readonly qaFogRadius = numberFromQuery('fogRadius');
  private readonly qaPlayerX = numberFromQuery('px');
  private readonly qaPlayerY = numberFromQuery('py');

  /** QA mirror of the input → sim edge. Allocated once; see `MatchDebug`. */
  private readonly debug: MatchDebug = {
    phase: 'countdown', winner: null, paused: false,
    moveX: 0, moveY: 0, attack: false, facingX: 0, facingY: 0, selectedWeapon: 0,
    pointerLocked: false, qaSpawnInsideCover: null, frames: 0,
  };

  /** QA mirror of the event → feel edge. Allocated once; see `FeelDebug`. */
  private readonly feel: FeelDebug = {
    events: Object.fromEntries(FEEL_EVENT_KEYS.map((k) => [k, 0])),
    responses: { vfx: 0, shake: 0, hitStop: 0, knockback: 0, damageNumber: 0, screenFlash: 0 },
    hitStopBudgetMs: 0, hitStopBankedMs: 0, lastHitStopMs: 0, rawDtMs: 0, stepDtMs: 0,
    frames: 0, frozenFrames: 0, repayingFrames: 0,
    peakHitAmount: 0, peakShakeM: 0,
  };

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
  /**
   * Hard ceiling on a single camera kick, in metres. See `kick()` for why it lives
   * here rather than in `camera.ts`: the shake is a translation of the whole camera,
   * so it moves the fair-play window and `tools/aspect.mjs` is structurally blind to
   * it. 0.40 m is 8.0 wu against a guaranteed radius of 199.2 wu — 4.0%, and only for
   * the two or three frames a kick survives.
   */
  private static readonly SHAKE_MAX_M = 0.40;

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
    // `?level=` alongside `?player=`/`?enemy=`, same QA-override spirit — it is what lets
    // a screenshot pass reach a levelled fighter with no upgrade UI in the way.
    const lvl = clampLevel(opts.playerLevel ?? numberFromQuery('level') ?? LEVEL_MIN);
    this.levels = { player: lvl, enemy: enemyLevelFor(lvl) };
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

    // The closing fog's boundary. Lives here rather than inside the arena build
    // because it is driven by SIM state (`safeRadius`), which the arena never sees —
    // and `match.ts` is the one module allowed to talk to both.
    this.fogRing = createFogRing(this.arena.center);
    this.stage.scene.add(this.fogRing.root);

    this.vfx = new VfxLayer(this.stage.scene);
    // `onSelectWeapon` is the touch equivalent of the 1-4 keys — the HUD's weapon bar
    // is the only control a phone player has for it. Reads `this.input` lazily, which
    // is why it may be wired before the controller below exists.
    this.hud = createHud(opts.hudRoot, {
      onRestart: () => this.restart(),
      onSelectWeapon: (index) => this.input.selectWeapon(index),
    });
    this.hud.setCharacters(this.playerId, this.enemyId);

    this.input = new InputController(this.stage.canvas);
    this.input.setWeaponCount(CHARACTERS[this.playerId].weapons.length);

    // Mouse capture. Everything it needs from the session is already public — it
    // pauses and resumes through the SAME `pause()`/`resume()` the screen layer's
    // pause chip uses, so there is exactly one notion of "the match is frozen".
    // No-ops entirely on touch devices and under `?pointerLock=0`.
    this.pointerLock = createPointerLock({
      target: this.stage.canvas,
      pause: () => this.pause(),
      resume: () => this.resume(),
      onLockChange: (locked) => this.input.setPointerLocked(locked),
    });

    // Placeholders assigned for real by spawnMatch() below (kept non-null for TS).
    this.state = createMatch(this.arena, this.playerId, this.enemyId, this.levels);
    this.playerModel = createCharacter(this.playerId);
    this.enemyModel = createCharacter(this.enemyId);
    this.spawnMatch();

    window.__matchDebug = this.debug;
    window.__feelDebug = this.feel;
    window.__feelEvent = (ev: GameEvent) => this.handleEvents([ev]);
    // See the declaration: the only way to render concealment before an arena declares
    // regions. `tools/tmp/cw_conceal_view.mjs` is the consumer.
    window.__matchArena = this.arena;
    window.addEventListener('resize', this.handleResize);
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Start a brand-new match: fresh sim state, fresh models, camera snapped back. */
  restart(): void {
    this.spawnMatch();
    // Via resume(), not `isPaused = false`, so a restart re-captures the mouse. The
    // only caller is the HUD's Play Again button, so the request carries the user
    // gesture the Pointer Lock API requires.
    this.resume();
  }

  get paused(): boolean {
    return this.isPaused;
  }

  pause(): void {
    this.isPaused = true;
    // Give the mouse back whenever the match freezes — a pause menu the player cannot
    // click is worse than no pause menu. Deliberate, so it does not read as a loss.
    this.pointerLock.release();
    // ...and clear the aim reticle in the same breath. `loop()` returns early while
    // paused and never calls `hud.update()` again, so without this the virtual cursor
    // freezes on screen NEXT TO the real OS cursor the release just handed back —
    // two cursors, one of them a ghost that no longer tracks the mouse.
    this.hud.update(this.state, {
      selectedWeapon: this.input.selectedWeapon,
      safeArrow: this.safeArrow(),
      aim: null,
    });
  }

  resume(): void {
    this.isPaused = false;
    // A no-op unless the player opted into capture. If the request is refused — most
    // often because Escape deliberately does NOT grant user activation — `pointerLock`
    // pauses again and asks for a click, rather than running the match uncaptured.
    this.pointerLock.engage();
  }

  resize(): void {
    this.stage.resize();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (window.__matchDebug === this.debug) delete window.__matchDebug;
    if (window.__feelDebug === this.feel) delete window.__feelDebug;
    // Identity-guarded like `__matchDebug`, not unconditional: a second session may
    // already have claimed the slot, and clearing it would leave the live match's arena
    // unreachable to a probe that has one.
    if (window.__matchArena === this.arena) delete window.__matchArena;
    delete window.__feelEvent;
    window.removeEventListener('resize', this.handleResize);
    this.pointerLock.dispose();
    this.input.dispose();
    this.hud.dispose();
    this.vfx.dispose();
    this.fogRing.dispose();
    this.playerModel.dispose();
    this.enemyModel.dispose();
    this.stage.dispose();
  }

  private spawnMatch(): void {
    this.state = createMatch(this.arena, this.playerId, this.enemyId, this.levels);
    this.applyQaSetup();

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
    this.audio.reset();
    this.input.reset();
    // A match can end with shots still in the air, and those never emit a
    // `projectile-destroyed` — the whole `MatchState` is replaced above. Without this
    // the map keeps one entry per unresolved shot, forever, across every restart.
    this.projectileOrigins.clear();
    this.hitStopBudgetMs = 0;
    this.hitStopBankedMs = 0;
    for (const k of Object.keys(this.feel.events)) this.feel.events[k] = 0;
    this.feel.responses.vfx = 0; this.feel.responses.shake = 0; this.feel.responses.hitStop = 0;
    this.feel.responses.knockback = 0; this.feel.responses.damageNumber = 0; this.feel.responses.screenFlash = 0;
    this.feel.frames = 0; this.feel.frozenFrames = 0; this.feel.repayingFrames = 0;
    this.feel.peakHitAmount = 0; this.feel.peakShakeM = 0; this.feel.lastHitStopMs = 0;
    this.knockback.player.x = 0; this.knockback.player.z = 0;
    this.knockback.enemy.x = 0; this.knockback.enemy.z = 0;

    const startPos = groundPos(this.state.player.x, this.state.player.y);
    this.stage.rig.snapTo(startPos.x, startPos.z);
    this.stage.lighting.focus(startPos.x, startPos.z);

    this.fogRing.update(
      this.state.safeRadius,
      this.state.elapsed / 1000,
      this.state.phase === 'playing',
      this.stage.rig,
    );

    // A restart re-enters `countdown`, which is a real transition the screen layer
    // has to see (it hides the post-match "back to menu" button again).
    this.lastPhase = null;
    this.notifyPhase();
  }

  /** Apply the QA-only `?fogRadius=` / `?px=` / `?py=` overrides to a fresh match.
   * A no-op unless those params are on the URL — see the field comments. */
  private applyQaSetup(): void {
    if (this.qaPlayerX !== null) this.state.player.x = this.qaPlayerX;
    if (this.qaPlayerY !== null) this.state.player.y = this.qaPlayerY;
    if (this.qaPlayerX !== null || this.qaPlayerY !== null) this.checkQaSpawn();

    if (this.qaFogRadius === null) return;
    const maxR = this.arena.maxSafeRadius;
    // The ring bottoms out at MIN_SAFE_RADIUS (see `rules.ts`), so a request below it
    // has no corresponding moment on the clock to rewind to — clamp rather than hand
    // back a fog state the sim would immediately overwrite on the next tick, which
    // would read as a broken screenshot rather than an out-of-range parameter.
    const wantR = THREE.MathUtils.clamp(this.qaFogRadius, MIN_SAFE_RADIUS, maxR);
    const frac = THREE.MathUtils.clamp(wantR / maxR, 0, 1);
    this.state.phase = 'playing';
    this.state.countdownValue = 0;
    this.state.countdownTick = 0;
    this.state.startFlashTimer = 0;
    this.state.timeRemaining = MATCH_DURATION_MS * frac;
    this.state.safeRadius = wantR;
  }

  /**
   * `?px=/?py=` places the fighter at EXACTLY the requested point — that exactness is
   * the whole reason the parameter exists (shooting "standing on the pot rim" or
   * "one step inside the fog" repeatably). It is deliberately NOT nudged to a legal
   * position here, because a QA parameter that silently moves the subject is a worse
   * instrument than one that occasionally lands somewhere useless.
   *
   * But landing inside a `CoverBox` is not "useless", it is INDISTINGUISHABLE FROM
   * BROKEN INPUT, and it cost a real investigation:
   *
   *   `?px=850&py=500` puts the 42 wu fighter 25 wu from the centre of the
   *   `spice_cart` box at (875,500,50,50) — overlapping, since 25 < (42+50)/2 = 46.
   *   `movement.ts:tryMove` tests the DESTINATION for overlap and does no
   *   depenetration, so every ~2-6 wu step from inside still overlaps and is refused,
   *   on both axes, forever. Measured: WASD and the arrow keys move the fighter 0.0 wu
   *   over 2 s each, while `MatchInput.move` is a correct ±1 the whole time and the AI
   *   walks normally. It reads exactly like "the keyboard is dead".
   *
   * So: say so, once, loudly, and publish it for probes. See `MatchDebug`.
   */
  private checkQaSpawn(): void {
    const p = this.state.player;
    const box = this.arena.cover.find((o) => boxesOverlap(p.x, p.y, p.size, p.size, o.x, o.y, o.w, o.h));
    this.debug.qaSpawnInsideCover = box
      ? `${box.kind ?? 'cover'} @(${box.x},${box.y}) ${box.w}x${box.h}`
      : null;
    if (box) {
      console.warn(
        `[QA] ?px=${p.x}&py=${p.y} places the player INSIDE cover "${box.kind ?? 'cover'}" ` +
        `@(${box.x},${box.y}) ${box.w}x${box.h}. There is no depenetration in movement.ts, ` +
        `so the fighter cannot move at all — input is fine, the sim is refusing every step. ` +
        `Pick a point at least ${((p.size + Math.max(box.w, box.h)) / 2).toFixed(0)} wu from that centre.`,
      );
    }
  }

  /**
   * Where the aim cursor is on screen, and where it pivots from — or null when the
   * mouse is free, in which case the OS cursor is the reticle and the HUD draws none.
   *
   * Recomputed every frame rather than cached, because the pivot is the PLAYER's
   * projected position: it moves with the character, the camera's follow lerp and
   * screen shake, and a reticle anchored to a stale pivot visibly lags its own owner.
   */
  private aimCursor(): { from: ScreenPoint; at: ScreenPoint } | null {
    const off = this.input.aimOffsetPx;
    if (!off) return null;
    const from = this.projectPointToScreen(this.state.player.x, this.state.player.y, 0);
    if (!from) return null;
    return { from, at: { x: from.x + off.x, y: from.y + off.y } };
  }

  /** Gather this tick's raw input and turn it into a `MatchInput` the sim understands. */
  private buildInput(): MatchInput {
    const playing = this.state.phase === 'playing';

    const move = playing ? this.input.moveAxes() : { x: 0, y: 0 };

    let aim: { x: number; y: number } | undefined;
    if (playing) {
      // Pointer-locked: the virtual cursor's screen point, converted to NDC here so
      // everything downstream — raycast, ground hit, direction-from-player — is the
      // exact same code path the free cursor has always taken.
      const cursor = this.aimCursor();
      let ndc = this.input.mouseNdc;
      if (cursor) {
        const rect = this.stage.canvas.getBoundingClientRect();
        ndc = {
          x: ((cursor.at.x - rect.left) / rect.width) * 2 - 1,
          y: -(((cursor.at.y - rect.top) / rect.height) * 2 - 1),
        };
      }
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
    this.feel.responses.hitStop++;
    this.feel.lastHitStopMs = ms;
  }

  /** Camera kick. The ONE way this file reaches `rig.shake` — routed through here so
   * `FeelDebug` counts every kick and records the peak, and so the amplitude cap
   * below cannot be bypassed by a new call site.
   *
   * ⚠️ `amount` is a camera TRANSLATION in metres and it moves the guaranteed view
   * window with it: `camera.ts` adds `shakeOffset` to both the eye and the look-at,
   * so a kick of A metres momentarily costs A metres off the fair-play radius on the
   * side it moves toward. `SHAKE_MAX_M` bounds that at ~1% of the 199.2 wu guarantee.
   * `tools/aspect.mjs` cannot see this — it reads `__fairView()`, which is computed
   * from `computeDistance()` and never sees the shake — so the bound has to be here. */
  private kick(amount: number, decay?: number): void {
    const a = Math.min(amount, GameSession.SHAKE_MAX_M);
    this.stage.rig.shake(a, decay);
    this.feel.responses.shake++;
    if (a > this.feel.peakShakeM) this.feel.peakShakeM = a;
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
    this.feel.responses.knockback++;
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
      // QA census of the event → feel edge. Keyed exactly as `feel_census.mjs` keys
      // the Node-side census so the two tables join — see `FeelDebug`.
      const feelKey =
        ev.type === 'hit-landed' ? `hit-landed:${ev.source.kind}`
        : ev.type === 'projectile-destroyed' ? `projectile-destroyed:${ev.reason}`
        : ev.type;
      if (feelKey in this.feel.events) this.feel.events[feelKey]++;

      switch (ev.type) {
        case 'weapon-fired': {
          const model = ev.fighterRole === 'player' ? this.playerModel : this.enemyModel;
          const fighter = this.state[ev.fighterRole];
          const weapons = CHARACTERS[fighter.characterId].weapons;
          const weaponIndex = weapons.findIndex((w) => w.key === ev.weaponKey);
          const weapon = weapons[weaponIndex < 0 ? 0 : weaponIndex];
          model.play('attack', { weaponIndex: weaponIndex < 0 ? 0 : weaponIndex });

          if (weapon) {
            // ONE call, deliberately. This used to fan out to three independent
            // `vfx` methods — cast flash, melee arc, giant-slam shockwave — each
            // authored and measured alone, and for Giant Lollipop the three
            // together repainted 75.7% of the frame while every one of them looked
            // reasonable in isolation (`docs/LESSONS.md` §7). The arbitration now
            // lives in `vfx.ts`'s `spawnWeaponCast`, which is the only place that
            // can see the sum; adding another cast-time beat belongs there, not
            // here.
            this.vfx.spawnWeaponCast(fighter.x, fighter.y, fighter.facing, weapon, fighter.characterId);
            this.feel.responses.vfx++;
            if (weapon.giantSlam) {
              // Everything a giant slam does that is NOT this layer's to draw.
              this.feel.events['weapon-fired:giantSlam']++;
              this.hud.flashScreen(weapon.color);
              this.feel.responses.screenFlash++;
              this.kick(0.55, 2.6);
              this.triggerHitStop(120);
              window.__vfxDebugGiantSlamCount = (window.__vfxDebugGiantSlamCount ?? 0) + 1;
            }
          }
          break;
        }
        case 'hit-landed': {
          const model = ev.targetRole === 'player' ? this.playerModel : this.enemyModel;
          // ⚠️ `intensity` is passed and is currently IGNORED — `CharacterModel.play`
          // declares `opts.intensity` (characters/types.ts) and `BaseCharacter.play`
          // does not read it. It is passed anyway, deliberately, because this is where
          // the number is known and because the flash is the single loudest channel in
          // the whole hit and it is measurably FLAT: firing a fog hit (the one branch
          // that plays 'hit' and does nothing else) changes 4,122 px at 2 damage and
          // 4,094 px at 18 — 0.99x across a 9x damage range, while every other channel
          // at least tries. Wiring it is one line in `applyHitFlash`, in a file this
          // owner does not have; see the report accompanying this commit. Until then
          // this call site is correct and inert rather than absent and forgotten.
          model.play('hit', { intensity: THREE.MathUtils.clamp(ev.amount / 12, 0.25, 1) });

          const color = this.colorForDamageSource(ev.targetRole, ev.source);
          lastHitColor[ev.targetRole] = color;

          // ── Closing fog: deliberately NOT the generic impact treatment ────────
          // Fog damage used to run the exact same code path as a weapon hit —
          // impact burst, camera shake, white damage number — with only a violet
          // tint to tell them apart, so being killed by the zone was visually
          // indistinguishable from being shot at 50 HP/s. It is not a hit from a
          // direction, so it gets no burst at the "impact point" and no shake:
          // instead the frame's edge ignites (`flashFogTick`), the damage number
          // comes up violet and tagged "ZONE", and the persistent HUD danger state
          // (edge vignette + alarm strip + chevron) is already running from
          // `hud.update()`. See `ui/hud.ts` -> `flashFogTick`.
          if (ev.source.kind === 'fog') {
            const fogPos = this.projectPointToScreen(ev.x, ev.y, 1.3);
            if (fogPos) { this.hud.spawnDamageNumber(fogPos, ev.amount, { fog: true }); this.feel.responses.damageNumber++; }
            if (ev.targetRole === 'player') { this.hud.flashFogTick(); this.feel.responses.screenFlash++; }
            break;
          }

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
          this.feel.responses.vfx++;
          if (ev.amount > this.feel.peakHitAmount) this.feel.peakHitAmount = ev.amount;

          const screenPos = this.projectPointToScreen(ev.x, ev.y, 1.3);
          if (screenPos) { this.hud.spawnDamageNumber(screenPos, ev.amount); this.feel.responses.damageNumber++; }

          // ── DYNAMIC RANGE, and why these two curves were re-derived ───────────
          //
          // Uri, after playing the build: *"it still seems like it's flat. one tone,
          // maybe two, monotonic."* That was said about audio, and the same
          // `hit-landed` event drives these. Measured with `tools/tmp/feel_probe.mjs`
          // on a frozen snapshot, hand-cranking the real loop one 60 fps frame at a
          // time, against the game's own damage range (`rules.ts`: 2..18, a 9.0x
          // input):
          //
          //     channel                 at 2 dmg   at 18 dmg   delivered range
          //     camera kick             6.3 px      21.4 px       3.44x
          //     hit-stop                42 ms       70 ms         1.69x
          //     character hit flash     4122 px     4094 px       0.99x   <- flat
          //     impact burst pixels     4096        3621          0.88x   <- inverted
          //
          // A 9x input arriving as 1.69x is not a taste gap, it is compression: the
          // smallest hit in the game freezes the world for 60% as long as the largest
          // one. And the flash — which `tools/tmp/feel_probe.mjs` isolates by firing a
          // FOG hit, the one `hit-landed` branch that plays `'hit'` and nothing else —
          // is the loudest channel of the lot and is bit-identical at both ends.
          //
          // So both curves are re-derived with a much lower floor and a higher ceiling.
          // The floor matters more than the ceiling: `feel_census` counts 21.5 weapon
          // hits in a 16.0 s match, one every 0.74 s, so what the SMALLEST hit costs is
          // paid ~20 times a match and is most of what "monotonic" is describing.
          //
          // Total freeze goes DOWN while range goes UP — at the census's damage
          // distribution (p25 4, median 6, p75 9, p95 16) mean freeze moves 51.5 ms ->
          // 44.6 ms, i.e. 6.9% -> 6.0% of match time spent not running at 1x, against
          // 1.69x -> 4.8x of range. More punch, less stutter, and both are counted:
          // `FeelDebug.frozenFrames` / `repayingFrames`.
          const isWeaponHit = ev.source.kind === 'weapon';
          const shakeBase = THREE.MathUtils.clamp(0.012 + ev.amount * 0.0175, 0.012, GameSession.SHAKE_MAX_M);
          const targetBias = ev.targetRole === 'player' ? 1.25 : 1;
          this.kick(shakeBase * targetBias * (isWeaponHit ? 1 : 0.45));

          if (isWeaponHit) {
            this.triggerHitStop(THREE.MathUtils.clamp(10 + ev.amount * 4.6, 16, 105));
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
        case 'projectile-spawned': {
          // Only so `projectile-destroyed` can reconstruct colour + direction — see
          // `projectileOrigins`. Nothing is drawn here: `vfx.sync()` builds the
          // in-flight visual from `state.projectiles` on the same tick.
          this.projectileOrigins.set(ev.id, { color: ev.color, x: ev.x, y: ev.y });
          break;
        }
        case 'projectile-destroyed': {
          const origin = this.projectileOrigins.get(ev.id);
          this.projectileOrigins.delete(ev.id);
          // `hit-target` already brings a full impact burst via the `hit-landed` that
          // fires alongside it, and `expired` is a shot fading out at max range —
          // see `vfx.ts`'s `spawnCoverScuff` for why only cover gets a mark, and why
          // that matches what `audio/director.ts` already does with `coverThud()`.
          if (ev.reason !== 'hit-cover') break;
          this.vfx.spawnCoverScuff(
            ev.x, ev.y,
            origin?.color ?? '#FFFFFF',
            origin ? ev.x - origin.x : 0,
            origin ? ev.y - origin.y : 0,
          );
          break;
        }
        case 'heal': {
          const fighter = this.state[ev.fighterRole];
          this.vfx.spawnHealPulse(fighter.x, fighter.y);
          this.feel.responses.vfx++;
          const screenPos = this.projectPointToScreen(fighter.x, fighter.y, 1.6);
          if (screenPos) { this.hud.spawnDamageNumber(screenPos, ev.amount, { heal: true }); this.feel.responses.damageNumber++; }
          break;
        }
        case 'death': {
          const model = ev.fighterRole === 'player' ? this.playerModel : this.enemyModel;
          model.play('death');
          const fighter = this.state[ev.fighterRole];
          const color = lastHitColor[ev.fighterRole] ?? '#FFFFFF';
          this.vfx.spawnDeathBurst(fighter.x, fighter.y, color);
          this.feel.responses.vfx++;
          this.kick(0.42, 3);
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

  /**
   * Where the HUD should draw its "run this way" chevron, and which way it points.
   *
   * Both are SCREEN-space, and both have to be, because the direction to safety on
   * screen depends on the camera's yaw and pitch — the HUD has no access to either.
   * Derived by projecting the player and a point one stride toward the arena centre,
   * then taking the difference: that survives any future camera change for free,
   * where a hand-derived angle would silently rot.
   */
  private safeArrow(): { at: ScreenPoint; angleRad: number } | null {
    const p = this.state.player;
    const dx = this.arena.center.x - p.x;
    const dy = this.arena.center.y - p.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-3) return null;
    const at = this.projectPointToScreen(p.x, p.y, 0.35);
    const ahead = this.projectPointToScreen(p.x + (dx / mag) * 80, p.y + (dy / mag) * 80, 0.35);
    if (!at || !ahead) return null;
    const sx = ahead.x - at.x;
    const sy = ahead.y - at.y;
    if (Math.hypot(sx, sy) < 1) return null;
    return { at, angleRad: Math.atan2(sy, sx) };
  }

  /** Fire `opts.onPhase` on transitions only — never every frame. */
  private notifyPhase(): void {
    if (this.state.phase === this.lastPhase) return;
    this.lastPhase = this.state.phase;
    // Hand the mouse back the moment the match is decided: the HUD's own Play Again
    // button and the screen layer's "back to menu" both need a real cursor, and both
    // appear on exactly this transition.
    this.pointerLock.setMatchActive(this.state.phase !== 'ended');
    this.opts.onPhase?.(this.state.phase, this.state.winner);
  }

  private readonly handleResize = (): void => this.resize();

  /** Refresh the QA mirror. Mutates one preallocated object — see `MatchDebug`. */
  private publishDebug(moveX: number, moveY: number, attack: boolean): void {
    const d = this.debug;
    d.phase = this.state.phase;
    d.winner = this.state.winner;
    d.paused = this.isPaused;
    d.moveX = moveX;
    d.moveY = moveY;
    d.attack = attack;
    d.facingX = this.state.player.facing.x;
    d.facingY = this.state.player.facing.y;
    d.selectedWeapon = this.input.selectedWeapon;
    d.pointerLocked = this.input.pointerLocked;
    d.frames++;
  }

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

    // Paused: keep the frame composited (see `isPaused`) but advance nothing. dt 0
    // so the camera's follow lerp and shake decay hold too — a drifting camera over
    // a frozen world reads as a hitch, not as a pause.
    if (this.isPaused) {
      // Published from inside the paused branch too, with the axes forced to zero:
      // "the loop is alive and deliberately not stepping" and "the loop has stopped"
      // are otherwise the same picture from outside.
      this.publishDebug(0, 0, false);
      this.stage.render(0);
      this.raf = requestAnimationFrame(this.loop);
      return;
    }

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

    // QA mirror of the freeze itself. `stepDtMs / rawDtMs` is the one number that says
    // whether hit-stop is happening at all and how much of the match is spent not
    // running at 1x — see `FeelDebug`.
    this.feel.rawDtMs = rawDtMs;
    this.feel.stepDtMs = stepDtMs;
    this.feel.hitStopBudgetMs = this.hitStopBudgetMs;
    this.feel.hitStopBankedMs = this.hitStopBankedMs;
    this.feel.frames++;
    if (stepDtMs < rawDtMs * 0.5) this.feel.frozenFrames++;
    else if (stepDtMs > rawDtMs * 1.05) this.feel.repayingFrames++;

    const prevPlayer = { x: this.state.player.x, y: this.state.player.y };
    const prevEnemy = { x: this.state.enemy.x, y: this.state.enemy.y };

    const input = this.buildInput();
    const events = stepMatch(this.state, stepDtMs, input);
    this.handleEvents(events);
    // Second consumer of the same tick's events (the first being `handleEvents`
    // above, which drives VFX/HUD/hit-stop). Order between the two is irrelevant —
    // neither reads anything the other writes.
    this.audio.handleEvents(events, this.state);
    this.notifyPhase();
    // AFTER the step, so `facing` is what `applyAim` actually committed rather than
    // what was asked for — the aim pipeline's output, not its input.
    this.publishDebug(input.move.x, input.move.y, input.attack === true);

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

    // ⚠️ SURFACE 3 OF 3 — the model itself. Uri, §30: *"plates and other kitchen objects
    // you can hide under — FULLY HIDDEN."* Blip and HP pill without this leaves the
    // character standing in plain sight with its UI stripped, which is strictly worse
    // than either extreme.
    //
    // `root.visible = false` on the group, not per-mesh and not a material swap: Three
    // prunes the whole subtree from BOTH the beauty pass and the shadow-map pass, so the
    // contact shadow goes with it. A hidden model that still casts a shadow is
    // `docs/LESSONS.md` §1's "rendering and invisible" inverted — an unmissable dark blob
    // reporting the exact position of something the player is told they cannot see.
    //
    // The transforms above still run every frame while hidden, deliberately: the model is
    // in the right place the instant it reappears, with no one-frame pop at the old
    // position, and nothing here has to be re-synced on the reveal path.
    //
    // ⚠️ `this.enemyModel` ONLY. `playerModel.root.visible` is never assigned anywhere in
    // this file — a player who hides must always see themselves, and vanishing your own
    // character reads as a crash rather than as a mechanic.
    this.enemyModel.root.visible = enemyVisibleToPlayer(this.state);

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

    // The boundary is driven off the sim, but its drift/pulse runs on real time so it
    // keeps breathing through hit-stop (a frozen wall would read as a rendering hitch).
    this.fogRing.update(
      this.state.safeRadius,
      this.clock.elapsedTime,
      this.state.phase === 'playing',
      this.stage.rig,
    );

    const playerPos = groundPos(this.state.player.x, this.state.player.y);
    this.stage.rig.follow(playerPos.x, playerPos.z);
    this.stage.lighting.focus(playerPos.x, playerPos.z);

    // TEMP DEBUG: ground-plane screen projections for scripted aim in
    // tools/tmp/vfx_convert_capture.mjs (the floating HUD pill sits well above the
    // head, which makes a Playwright driver systematically overshoot when raycasting
    // mouse position back to the ground plane, per `buildInput()`'s aim math).
    (window as any).__vfxDebugScreen = {
      player: this.projectPointToScreen(this.state.player.x, this.state.player.y, 0),
      enemy: this.projectPointToScreen(this.state.enemy.x, this.state.enemy.y, 0),
    };

    this.hud.update(this.state, {
      selectedWeapon: this.input.selectedWeapon,
      safeArrow: this.safeArrow(),
      // Null unless pointer-locked — see `HudFrameInfo.aim`. Computed for every phase,
      // not just 'playing', so the countdown is not five seconds of an invisible
      // cursor with nothing on screen to orient by.
      aim: this.aimCursor(),
    });
    // ⚠️ SURFACE 2 OF 3 — the enemy's floating HP pill. `updateFloatingBars` hides a bar
    // whose screen point is `null`, and `projectToScreen` already returns `null` for a
    // dead fighter, so concealment rides the SAME null channel rather than inventing a
    // second way to hide the same element. The player's own pill takes `alive` unchanged.
    this.hud.updateFloatingBars(
      this.projectToScreen(this.playerModel, this.state.player.alive),
      this.projectToScreen(this.enemyModel, this.state.enemy.alive && enemyVisibleToPlayer(this.state)),
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
