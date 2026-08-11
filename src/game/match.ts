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
import { createMatch, stepMatch, type FighterConfig, type MatchLevels } from './sim';
import { enemyLevelFor } from './economy';
import type { DamageSource, Fighter, FighterRole, GameEvent, MatchInput, MatchState } from './state';
// ⚠️ `otherRole` came BACK to this file on 2026-08-11, for exactly one QA-only caller —
// see `qaFillEvent`. The comment below is about the GAMEPLAY reconstructions, and those
// are still gone: nothing in `handleEvents` resolves an attacker by "the other one".
import { otherRole } from './state';
// The presentation-side seat rules, stated once for all four consumers of the event
// stream. `otherRole` is gone from this file: every "the other one" reconstruction it
// used to do — the damage-source colour, the impact VFX origin, the knockback direction —
// is now `ev.source.attackerId` through `weaponAttackerOf`.
import {
  fighterOf, fightersOf, LOCAL_SLOT, localFighter, resolvePlaces, slotOf, trailOwnerOf,
  weaponAttackerOf, type PlacementInput,
} from './roster';
import { boxesOverlap } from './movement';
import {
  CHARACTER_IDS, CHARACTERS, LEVEL_MIN, MATCH_DURATION_MS, minSafeRadiusFor,
  SUDDEN_DEATH_MS, SUDDEN_DEATH_RADIUS, SUDDEN_DEATH_REMAINING_MS, clampLevel, type CharacterId, type Weapon,
} from './rules';
import { CHARACTER_HEIGHT, groundPos, toWorldUnits } from '../units';
import { InputController } from './input';
import { createPointerLock, type PointerLockController } from './pointerLock';
import { VfxLayer } from './vfx';
// Audio is a SECOND, independent consumer of the same `GameEvent[]` stream the VFX
// layer runs on — see `src/audio/director.ts`. It never touches the sim, never
// touches the renderer, and every call into it is failure-tolerant by contract, so
// an audio problem degrades to silence rather than to a stalled frame.
import { createMatchAudio, type MatchAudio } from '../audio';
// `fighterVisibleTo` is concealment's ONE presentation-side predicate, shared by all
// three surfaces that could leak an opponent's position (radar blip, floating HP pill,
// 3D model). It is declared in `hud.ts` rather than here purely for import direction:
// `match.ts` imports `hud.ts` and not the other way round, so this is the only placement
// that lets both files call one copy instead of growing two. Its header carries the
// asymmetry rule — the observer is always the LOCAL seat, the target is any other
// fighter, asked one at a time. ⚠️ It was `enemyVisibleToPlayer(state)` and took no
// target at all, which is a predicate that can only ever hide slot 1.
import {
  createHud, fighterVisibleTo,
  type Hud, type HudFrameInfo, type MatchPayout, type ScreenPoint,
} from '../ui/hud';

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

/**
 * 🚨 WHERE EVERY SEAT FINISHED — the one thing `onPhase` could not say.
 *
 * It carried a ROLE, so `matchScreen.ts` could only ask "did slot 0 win" and banked
 * `recordResult(boolean)`, which `profile.ts` forwards as `recordPlacement(won ? 0 : 1,
 * MIN_FIGHTERS)`. **Every match on the product paid as a duel**, and the 3-6 seat payout
 * curve (`DECISIONS §59`, `§61`) was unreachable from the game.
 *
 * The ranking RULE is `roster.ts:resolvePlaces` — the file that already states the other
 * seat rules once for all four presentation modules — and its header carries the
 * measurement that decides its shape: **the rank is NOT derivable from the final state.**
 * Every loser ends `hp: 0, deaths: 1, alive: false`, identically, in 220 of 220 real
 * matches. Only the ORDER OF THE `death` EVENTS separates them, and this file is the only
 * one that sees `GameEvent[]` — which is why the TRACKING lives here and the RULE does not.
 *
 * ⚠️ PLAIN DATA, NOT LIVE `Fighter` OBJECTS. `GameSessionOptions.onPhase`'s own comment
 * promises the screen layer reacts *"WITHOUT polling `MatchState` from outside"*, and the
 * sim keeps mutating for one more tick after `phase` flips (`sim.ts`'s projectile loop
 * reproduces the prototype's extra tick deliberately). Four fields, built once per match.
 */
export interface MatchOutcome {
  /** How many seats this match had — `profile.recordPlacement`'s second argument. */
  readonly seats: number;
  /** Every slot, best first. `places[k]` is the slot that finished `k`th. */
  readonly places: readonly number[];
  /**
   * Where the LOCAL seat finished, **ZERO-BASED** — 0 is first, `seats - 1` is last.
   * ⚠️ `hud.ts` renders the ONE-based *"4th of 6"*; that `+ 1` happens at that one call
   * site and nowhere else. See `roster.ts:placeOf`.
   */
  readonly localPlace: number;
  /** The slot `sim.ts` declared the winner, or `null` if the match never resolved. */
  readonly winnerId: number | null;
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
  onPhase?: (
    phase: MatchState['phase'],
    winner: FighterRole | null,
    /** Non-null on the `'ended'` transition only. See `MatchOutcome`. */
    outcome: MatchOutcome | null,
  ) => void;
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

/**
 * QA-ONLY: `?fighters=<id>@<x>,<y>;<id>@<x>,<y>;…` — seat 3 to `MAX_FIGHTERS` fighters.
 *
 * ── 🚨 WHY THIS EXISTS, AND WHY IT CARRIES ITS OWN SPAWNS ──────────────────
 *
 * The sim has seated up to six fighters since `1b506d6`. **Nothing in `src/` calls the list
 * form**, so before this parameter there was no way to put a third fighter on screen at all
 * — and "the presentation is N-capable" would have shipped measured only by reading the
 * code, which is this project's most-repeated failure. `tools/tmp/np_nfighter.mjs` is the
 * consumer.
 *
 * ⚠️ **THE SPAWNS COME FROM THE CALLER, NOT FROM THIS FILE, AND THAT IS `DECISIONS §49d`
 * BEING OBEYED RATHER THAN WORKED AROUND.** `ArenaDefinition` declares exactly two spawn
 * points, and `sim.ts:createMatch` deliberately THROWS for a slot 2+ with no explicit
 * `spawn` rather than inventing a ring — because spawn placement for 4-6 fighters is part
 * of §48's layout pass, where 180° point symmetry is a competitive-fairness constraint in
 * the same category as `aspect.mjs`. A default invented HERE would be exactly the second,
 * quieter source of truth the sim refused to become, and it would produce balance numbers,
 * and it would look like it worked. So this parameter is a TRANSPORT for coordinates a
 * probe chose; it contains no placement policy of its own, exactly like `?px=`/`?py=`.
 *
 * Absent, malformed or shorter than 3 entries -> `null`, and the session takes the shipped
 * two-fighter path with not one branch changed. Never read by game logic.
 */
function fightersFromQuery(): FighterConfig[] | null {
  const raw = new URLSearchParams(location.search).get('fighters');
  if (!raw) return null;
  const out: FighterConfig[] = [];
  for (const part of raw.split(';')) {
    const [idPart, posPart] = part.split('@');
    const id = idPart?.trim();
    if (!id || !(CHARACTER_IDS as readonly string[]).includes(id)) return null;
    const cfg: FighterConfig = { characterId: id as CharacterId };
    if (posPart) {
      const [x, y] = posPart.split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      cfg.spawn = { x, y };
    }
    out.push(cfg);
  }
  // Two or fewer is refused rather than honoured: at two seats the legacy form is the
  // measured-identical path and there is no reason for a QA parameter to route around it.
  return out.length >= 3 ? out : null;
}

/** QA-only numeric URL override, same spirit as `?simSpeed=`. */
function numberFromQuery(param: string): number | null {
  const raw = new URLSearchParams(location.search).get(param);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * QA-ONLY: fill the IDENTITY fields a hand-written `window.__feelEvent` payload omits.
 *
 * ## The defect this removes, and why it cost more than a crash
 *
 * `window.__feelEvent({ type: 'hit-landed', source: { kind: 'trail' } })` threw
 * `TypeError: Cannot read properties of undefined (reading 'x')`, while `weapon`,
 * `hazard` and `fog` all worked. The asymmetry is not luck: `weaponAttackerOf` resolves
 * through `otherRole(targetRole)`, and `otherRole(undefined)` returns `'player'` — a real
 * fighter — so the weapon branch has a working fallback by accident. `trailOwnerOf` reads
 * `source.ownerRole` **directly**, and `state[undefined]` is `undefined`, so the very next
 * line (`owner.x`) faults.
 *
 * 🚨 **AND IT SILENTLY COST A WHOLE CLASS OF MEASUREMENT.** This hook is the only way to
 * put a VFX event in a frame on demand, and on the 2800x2000 arena that is not a
 * convenience: the camera follows the local seat, the opponent starts ~2,500 wu away and
 * first contact is **18.4 s**, so a probe watching a real match has no hit on screen to
 * measure. The pass sent at Uri's *"VFX looks clunky"* came back **unresolved** because one
 * of the hook's four source kinds faulted.
 *
 * ## Why the fix is HERE and not in `handleEvents`
 *
 * `handleEvents` is the real gameplay path and the sim always populates these fields —
 * `sim.ts` pushes `{ kind: 'trail', ownerId, ownerRole }` at the single site that can emit
 * one. Softening the consumer would make the renderer tolerant of a malformed event
 * stream, which is exactly the tolerance that hides a real defect. The synthetic caller is
 * the thing that is allowed to be lazy, so the filling happens at the synthetic entry
 * point and nowhere else.
 *
 * ## Provably a no-op for the three kinds that already worked
 *
 * `targetRole` defaults to `'enemy'`, which is what the downstream readers already
 * resolved `undefined` to: `slotOf(undefined, undefined)` is 1 and `slotOf(undefined,
 * 'enemy')` is 1; `otherRole(undefined)` is `'player'` and `otherRole('enemy')` is
 * `'player'`. So weapon / hazard / fog take the identical path before and after — asserted
 * rather than argued by `tools/tmp/sd_feelevent.mjs`, which drives all four kinds through
 * the real hook in a real browser and is shown to FAIL on `trail` without this function.
 */
function qaFillEvent(ev: GameEvent): GameEvent {
  if (ev.type !== 'hit-landed') return ev;
  const targetRole: FighterRole = ev.targetRole ?? 'enemy';
  const source = ev.source.kind === 'trail' && ev.source.ownerRole === undefined
    ? { ...ev.source, ownerRole: otherRole(targetRole) }
    : ev.source;
  return { ...ev, targetRole, source };
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

  /**
   * THE ROSTER, IN SLOT ORDER — `characterIds[i]` is the character in `fighters[i]`.
   *
   * `playerId`/`enemyId` above stay as the two-seat inputs this session is CONSTRUCTED
   * from (a URL param, a menu choice, `enemyLevelFor`); this is what the renderer keys
   * off. They are the same two values today and `spawnMatch` derives one from the other.
   */
  private readonly characterIds: CharacterId[];
  /** QA-only 3..6 fighter roster, or `null` for the shipped two-seat path. See
   * `fightersFromQuery`. */
  private readonly qaFighters = fightersFromQuery();
  /**
   * ONE MODEL PER SLOT, index-aligned with `state.fighters`.
   *
   * ⚠️ WAS `playerModel` + `enemyModel`, which is a two-fighter renderer at the field
   * level. Everything downstream that used to branch on a seat name — the concealment
   * hide, the run/idle animation, the floating pill, the knockback nudge — is now one
   * loop over this array, so a third fighter needs no third branch anywhere.
   */
  private models: CharacterModel[] = [];
  private state: MatchState;

  /**
   * THE SLOTS KNOCKED OUT THIS MATCH, EARLIEST FIRST — and the ONLY record of that order
   * in the product. See `MatchOutcome` for why the final state cannot supply it.
   *
   * Appended in `handleEvents`'s `death` case, so the order here IS `stepMatch`'s order and
   * no second rule states it. Cleared in `spawnMatch` beside every other per-match
   * accumulator, for the reason `projectileOrigins.clear()` gives one line away: a restart
   * replaces the whole `MatchState`, and a stale entry would rank the NEXT match's
   * finishers off the last one's knockouts.
   */
  private readonly eliminated: number[] = [];

  /**
   * THIS MATCH'S FINISHING ORDER, COMPUTED ONCE ON THE `'ended'` TRANSITION.
   *
   * ⚠️ **CACHED RATHER THAN RECOMPUTED PER FRAME, AND THAT IS CORRECTNESS BEFORE IT IS
   * COST.** The result card stays up until the player presses something, so a per-frame
   * `outcome()` would re-rank on every one of those frames — off a `MatchState` the sim is
   * still stepping for one more tick (`sim.ts`'s projectile loop deliberately reproduces
   * the prototype's extra tick), and off an `eliminated` list that can still grow if a
   * projectile already in the air lands after the whistle. The card and the payout would
   * then be able to disagree with each other. Computed once, at the transition, is also
   * the only reading under which `onPhase` and `HudFrameInfo.place` are the same answer.
   *
   * Null in every phase but `'ended'`, which is what clears it on restart.
   */
  private endedOutcome: MatchOutcome | null = null;

  /**
   * WHAT THIS MATCH PAID, HANDED DOWN FROM THE SCREEN THAT BANKED IT. See `showPayout`.
   *
   * 🚨 **A CARRIED VALUE, NEVER A COMPUTED ONE, AND THAT IS WHAT MAKES A DOUBLE-BANK
   * IMPOSSIBLE FROM HERE.** The payout is applied as a SIDE EFFECT of banking
   * (`profile.recordPlacement` mutates the economy and commits it), so the difference
   * between "render the payout" and "bank the payout again" is one import. This file has
   * neither: it imports nothing from `game/economy/` or `ui/screens/`, and this field is
   * three numbers.
   *
   * Cleared in `notifyPhase` on every non-`'ended'` transition — beside `endedOutcome`,
   * for the same reason it is cleared there: a restart re-enters `'countdown'`, and a
   * stale payout would put the LAST match's trophies on the NEXT match's card.
   */
  private endedPayout: MatchPayout | null = null;

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

  /* ⚠️ `?fogRingRaw=1` USED TO LIVE HERE AND IS GONE — `779dc62` DELETED THE DEFECT IT
     EXISTED TO REPRODUCE. Its old wording, kept because a removed QA parameter is
     otherwise indistinguishable from one that never worked:

       > QA-only: `?fogRingRaw=1` hands `arena/fogRing.ts` the sim's LITERAL
       > `safeRadius` instead of `fogDisplayRadius()`'s epsilon. It exists to keep an
       > out-of-set defect REPRODUCIBLE rather than described — with it set,
       > `?fogRadius=0` renders the sudden-death frame with no boundary at all, which
       > is the bug `fogDisplayRadius` works around. **Delete both when the
       > one-character fix lands in `fogRing.ts`.**

     That fix landed (`fogRing.ts:update` now opens `active && safeRadiusUnits >= 0`),
     so both are deleted here as that comment instructed. The defect is still
     reproducible — on the OLD BUILD, which is where a known-bad belongs:
     `tools/tmp/mg_fog.mjs --baseline <pre-779dc62 url>` drives exactly that arm, and
     a `?fogRingRaw=1` on a build newer than this one is simply an unknown parameter
     and is ignored, which is the same thing the raw path now does anyway. */

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
  // Indexed by SLOT, grown to match the roster in `spawnMatch`. A `Record<FighterRole,…>`
  // has exactly two keys by type, so it could not have held a third fighter's nudge.
  private knockback: { x: number; z: number }[] = [];

  constructor(private readonly opts: GameSessionOptions) {
    this.playerId = opts.playerCharacterId ?? characterFromQuery('player') ?? DEFAULT_PLAYER;
    this.enemyId = opts.enemyCharacterId ?? characterFromQuery('enemy') ?? DEFAULT_ENEMY;
    // `?level=` alongside `?player=`/`?enemy=`, same QA-override spirit — it is what lets
    // a screenshot pass reach a levelled fighter with no upgrade UI in the way.
    const lvl = clampLevel(opts.playerLevel ?? numberFromQuery('level') ?? LEVEL_MIN);
    this.levels = { player: lvl, enemy: enemyLevelFor(lvl) };
    // The roster, in slot order. `createMatch`'s legacy 3-argument form still builds
    // exactly two fighters (`state.ts`), so this is exactly two entries today — but it
    // is the ONE place the renderer's fighter count is decided, and every array below
    // (`models`, `knockback`, the HUD's slots) is sized from it.
    this.characterIds = this.qaFighters
      ? this.qaFighters.map((f) => f.characterId)
      : [this.playerId, this.enemyId];
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
    this.hud.setCharacters(this.characterIds);

    this.input = new InputController(this.stage.canvas);
    // The LOCAL SEAT's weapon count, which is `playerId` on every shipped flow and is the
    // QA roster's slot 0 when one is present — `characterIds[LOCAL_SLOT]` states that once.
    this.input.setWeaponCount(CHARACTERS[this.characterIds[LOCAL_SLOT]].weapons.length);

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

    // Placeholder assigned for real by spawnMatch() below (kept non-null for TS).
    // `models` starts empty and `spawnMatch` fills it — it disposes and rebuilds the
    // whole array every time, so there is nothing here for it to tear down.
    //
    // ⚠️ HEAD ALSO BUILT TWO THROWAWAY `CharacterModel`s HERE and disposed them one line
    // later inside `spawnMatch`. Removing them changes no pixel — it is 2,532 fewer
    // `THREE.MathUtils.generateUUID` draws, measured by `tools/tmp/np_rng.mjs`, which is
    // why `np_identity.mjs` seeds UUID randomness on its own stream.
    this.state = this.newMatch();
    this.spawnMatch();

    window.__matchDebug = this.debug;
    window.__feelDebug = this.feel;
    window.__feelEvent = (ev: GameEvent) => this.handleEvents([qaFillEvent(ev)]);
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
      ...this.hudResult(),
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
    for (const m of this.models) m.dispose();
    this.stage.dispose();
  }

  /** The ONE place a `MatchState` is built. Two seats through the legacy 3-argument form
   * — which is what every shipped flow takes and what the identity battery measures — or
   * the list form when the QA roster parameter is present. */
  private newMatch(): MatchState {
    return this.qaFighters
      ? createMatch(this.arena, this.qaFighters)
      : createMatch(this.arena, this.playerId, this.enemyId, this.levels);
  }

  private spawnMatch(): void {
    this.state = this.newMatch();
    this.applyQaSetup();

    // ⚠️ IN SLOT ORDER, and the order is load-bearing rather than tidy: `scene.add`
    // order decides sibling order in the scene graph, which decides the draw order of
    // ties in three's transparent sort. The old code added `(playerModel, enemyModel)`
    // in one call; this adds slot 0 then slot 1 then the rest, which is the same
    // sequence at two fighters.
    for (const m of this.models) { this.stage.scene.remove(m.root); m.dispose(); }
    const roster = fightersOf(this.state);
    this.models = roster.map((f, i) => createCharacter(this.characterIds[i] ?? f.characterId));
    for (const m of this.models) this.stage.scene.add(m.root);
    this.models.forEach((m, i) => {
      this.syncModelTransform(m, roster[i]);
      m.play('idle');
    });

    this.vfx.clear();
    this.audio.reset();
    this.input.reset();
    // A match can end with shots still in the air, and those never emit a
    // `projectile-destroyed` — the whole `MatchState` is replaced above. Without this
    // the map keeps one entry per unresolved shot, forever, across every restart.
    this.projectileOrigins.clear();
    // Same class of bug as the line above, and a more expensive one: last match's knockout
    // order would rank this match's finishers, and it would pay them.
    this.eliminated.length = 0;
    this.hitStopBudgetMs = 0;
    this.hitStopBankedMs = 0;
    for (const k of Object.keys(this.feel.events)) this.feel.events[k] = 0;
    this.feel.responses.vfx = 0; this.feel.responses.shake = 0; this.feel.responses.hitStop = 0;
    this.feel.responses.knockback = 0; this.feel.responses.damageNumber = 0; this.feel.responses.screenFlash = 0;
    this.feel.frames = 0; this.feel.frozenFrames = 0; this.feel.repayingFrames = 0;
    this.feel.peakHitAmount = 0; this.feel.peakShakeM = 0; this.feel.lastHitStopMs = 0;
    // Reallocated rather than zeroed in place: the roster length can change between
    // matches once anything seats more than two, and a stale sixth entry holding the
    // previous match's nudge is exactly the class of bug `vfx.ts:clear()` documents.
    this.knockback = roster.map(() => ({ x: 0, z: 0 }));

    const me = localFighter(this.state);
    const startPos = groundPos(me.x, me.y);
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

  /* ── `fogDisplayRadius()` WAS HERE AND IS DELETED — the defect it papered over is
     fixed at source in `779dc62`. Its own comment carried the instruction, and it is
     kept here rather than dropped, because a workaround whose reason has been removed
     is otherwise the hardest kind of code to delete safely later:

       > 🚨 THIS IS A WORKAROUND FOR AN OUT-OF-SET DEFECT AND IT SHOULD BE DELETED.
       > `arena/fogRing.ts:update` opens with `const wanted = active && safeRadiusUnits
       > > 0` and ramps the WHOLE boundary out when that is false — so handing it the
       > sim's literal `SUDDEN_DEATH_RADIUS` (0) makes the fog disappear at exactly the
       > moment it covers the arena […] The correct fix is one character in a file this
       > pass does not own — `safeRadiusUnits >= 0`. **Remove this method when that
       > lands.**

     `fogRing.ts:533` now reads `const wanted = active && safeRadiusUnits >= 0`, so
     `this.state.safeRadius` goes to the boundary unmodified at both call sites and the
     presentation layer no longer holds a private opinion about what the sim's zero
     means. `state.safeRadius` was ALWAYS exactly 0 — the epsilon never reached the sim,
     the fog damage, the HUD's `outside` test or any instrument — so nothing downstream
     of the sim can observe this deletion.

     ⚠️ VERIFIED FROM PIXELS, WITH THE OLD BUILD AS THE KNOWN-BAD, because "it still
     looks fine" is worthless against a defect that was invisible by construction.
     `mg_fog.mjs`, `?fogRadius=0&simSpeed=0.05`, 844x390 at dpr 3, mean whole-frame luma:

       arm                              raw path   workaround path   no-fog control
       pre-fix build (5aa4655)             116.9              44.3            116.5
       this tree (fix + no workaround)      44.3              44.3            116.5

     The known-bad REPRODUCES — 116.9 against a 116.5 control, with
     `fog_boundary.visible === false`, i.e. the old build's sudden-death frame IS the
     no-fog frame — which is what licenses reading the rest of the table.
     🚨 AND THE ROW THAT ACTUALLY RETIRES THIS METHOD IS THE DRIFT CONTROL, NOT THE FIX:
     the workaround path reads 44.3 on both builds. The epsilon and the literal zero
     render the same frame, so deleting it removes a branch and not a behaviour.

     ⚠️ `&simSpeed=0.05` IS LOAD-BEARING. Sudden death does 50 HP/s to everyone, so at
     real speed the match is over in about two seconds and `fogRing.update`'s `active`
     flag (`phase === 'playing'`) correctly fades the boundary out — an earlier run of
     this exact measurement photographed six cells of an ALREADY-ENDED match and passed
     for the wrong reason. */

  /** Apply the QA-only `?fogRadius=` / `?px=` / `?py=` overrides to a fresh match.
   * A no-op unless those params are on the URL — see the field comments. */
  private applyQaSetup(): void {
    const me = localFighter(this.state);
    if (this.qaPlayerX !== null) me.x = this.qaPlayerX;
    if (this.qaPlayerY !== null) me.y = this.qaPlayerY;
    if (this.qaPlayerX !== null || this.qaPlayerY !== null) this.checkQaSpawn();

    if (this.qaFogRadius === null) return;
    const maxR = this.arena.maxSafeRadius;
    this.state.phase = 'playing';
    this.state.countdownValue = 0;
    this.state.countdownTick = 0;
    this.state.startFlashTimer = 0;

    // ── THE REACHABLE RING STATES ARE NOT AN INTERVAL ANY MORE ────────────────
    //
    // `DECISIONS §2` abolishes the ring at `SUDDEN_DEATH_MS`, so the set of radii a match
    // ever HOLDS is `(maxR/3, maxR]` — the linear close — plus the single point
    // `SUDDEN_DEATH_RADIUS`. Everything between is skipped in one tick. A parameter that
    // rewinds the clock to a requested radius therefore has two branches, not one clamp.
    //
    // ⚠️ TWO THINGS MOVED UNDER THIS BLOCK ON 2026-08-11 AND IT USED TO BE ONE LINE,
    // `clamp(this.qaFogRadius, MIN_SAFE_RADIUS, maxR)`:
    //
    //   * `MIN_SAFE_RADIUS` is only the floor at N <= 4 (`DECISIONS §53b`) — a no-op in
    //     the duel and wrong at five and six seats.
    //   * **`minSafeRadiusFor` is no longer the binding low end at all.** The lowest radius
    //     the schedule reaches is `maxR * SUDDEN_DEATH_REMAINING_MS / MATCH_DURATION_MS` =
    //     661.67 wu — 4.73x the 140 wu floor. A request of, say, 200 wu set `timeRemaining`
    //     to 4 534 ms, INSIDE the sudden-death window, and the next tick overwrote
    //     `safeRadius` with 0: exactly the "fog state the sim would immediately overwrite"
    //     the old clamp was written to prevent, arriving through a constant it never knew
    //     about.
    //
    // 🚨 AND CLAMPING **UP** TO 661.67 DOES NOT FIX IT — MEASURED TWICE, WHICH IS WHY THE
    // LOW END SNAPS **DOWN** INSTEAD. `suddenDeathActive` is `timeRemaining <=
    // SUDDEN_DEATH_REMAINING_MS`, so clamping to exactly `maxR/3` lands exactly ON the
    // trigger: `?fogRadius=1` rendered a full-arena violet frame at 0:15 reading "OUTSIDE
    // THE ZONE −50 HP/s" (mean luma 71.3 against 124 for a real boundary frame). Adding a
    // millisecond of clock did not fix it either — at `?simSpeed=0.02` one millisecond of
    // sim is 50 ms of wall clock and the collapse still arrived long before the capture
    // settled (mean 70.8, unchanged). **The bottom of the schedule is an OPEN bound and no
    // margin makes it closed**, so a request at or below it resolves to the one ring state
    // down there that is STABLE: sudden death itself. `?fogRadius=0` is the canonical way
    // to ask for it, and every smaller-than-reachable request now means the same thing
    // rather than silently photographing something else.
    const lowestScheduled = Math.max(
      minSafeRadiusFor(this.state.fighters.length),
      maxR * (SUDDEN_DEATH_REMAINING_MS / MATCH_DURATION_MS),
    );
    if (this.qaFogRadius <= lowestScheduled) {
      // ⚠️ SAID OUT LOUD, BECAUSE SEVERAL SHIPPED INSTRUMENTS ASK FOR RADII THAT NO LONGER
      // EXIST — `hudshot` (260/300), `hud_fogedge` (300), `hud_accept`'s danger station
      // (300), `kbdverdict` / `input_accept` (545) and `arena-scan`'s colour-baseline
      // stations (200/400/420) all predate `DECISIONS §2`. Every one of them now gets the
      // sudden-death frame, which is a DIFFERENT picture from the one their baseline was
      // measured on. A silent snap would have them re-baselining against a dark violet
      // arena and never knowing why; the migration is one number, `> lowestScheduled`.
      if (this.qaFogRadius > SUDDEN_DEATH_RADIUS) {
        console.warn(
          `[QA] ?fogRadius=${this.qaFogRadius} is below the lowest radius the schedule ever reaches `
          + `(${lowestScheduled.toFixed(2)} wu — DECISIONS §2 collapses the ring at ${SUDDEN_DEATH_MS / 1000} s). `
          + 'Snapped to SUDDEN DEATH (radius 0). Ask for a larger radius if you wanted a ring.',
        );
      }
      this.state.timeRemaining = SUDDEN_DEATH_REMAINING_MS;
      this.state.safeRadius = SUDDEN_DEATH_RADIUS;
      return;
    }

    const wantR = THREE.MathUtils.clamp(this.qaFogRadius, lowestScheduled, maxR);
    const frac = THREE.MathUtils.clamp(wantR / maxR, 0, 1);
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
    const p = localFighter(this.state);
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
    const me = localFighter(this.state);
    const from = this.projectPointToScreen(me.x, me.y, 0);
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
          const me = localFighter(this.state);
          aim = {
            x: toWorldUnits(hit.x) - me.x,
            y: toWorldUnits(hit.z) - me.y,
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
        // ⚠️ WAS `this.state[otherRole(targetRole)]` — "whoever is not the victim",
        // which is a correct attacker only while there are two fighters and a
        // plausible-looking wrong one at three. `DamageSource` carries `attackerId`
        // for exactly this; see `roster.ts:weaponAttackerOf` for why the seat name
        // survives as a fallback rather than being deleted.
        const attacker = weaponAttackerOf(this.state, source, targetRole);
        const weapon = CHARACTERS[attacker.characterId].weapons.find((w) => w.key === source.weaponKey);
        return weapon?.color ?? '#FFFFFF';
      }
      case 'trail':
        // The local seat's trail is rose, everyone else's is gold. A two-way tint on a
        // ROLE would have made slots 2..5 all read as "the enemy's trail", which is at
        // least honest, but keying it on the local slot says the thing the player needs
        // to know: is this puddle mine.
        return slotOf(source.ownerId, source.ownerRole) === LOCAL_SLOT ? '#FF9EC4' : '#FFD27A';
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
  private applyKnockback(targetSlot: number, fromX: number, fromY: number, amount: number): void {
    const target = fightersOf(this.state)[targetSlot];
    const kb = this.knockback[targetSlot];
    if (!target || !kb) return;
    const dx = target.x - fromX;
    const dy = target.y - fromY;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-4) return;
    const impulse = THREE.MathUtils.clamp(amount, 0, 0.22);
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
    // Indexed by SLOT. A `Partial<Record<FighterRole, string>>` has two keys by type,
    // so at three fighters the third one's death burst would have been tinted with
    // whatever slot 1 was last hit by.
    const lastHitColor: (string | undefined)[] = [];

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
          const model = this.models[slotOf(ev.fighterId, ev.fighterRole)];
          const fighter = fighterOf(this.state, ev.fighterId, ev.fighterRole);
          if (!model) break;
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
          const targetSlot = slotOf(ev.targetId, ev.targetRole);
          const model = this.models[targetSlot];
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
          model?.play('hit', { intensity: THREE.MathUtils.clamp(ev.amount / 12, 0.25, 1) });

          const color = this.colorForDamageSource(ev.targetRole, ev.source);
          lastHitColor[targetSlot] = color;

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
            // The edge vignette is the LOCAL screen's "the zone is killing YOU" —
            // it must not fire because somebody else took a fog tick.
            if (targetSlot === LOCAL_SLOT) { this.hud.flashFogTick(); this.feel.responses.screenFlash++; }
            break;
          }

          // Resolve the attacking weapon (if this hit came from one) so
          // `spawnImpactBurst` can look up a bespoke per-weapon `impact()` hook
          // (`vfx/weapons/`) — trail/hazard/fog hits have no weapon and always take
          // the generic burst, exactly as before this system existed.
          let impactSource: { weapon: Weapon; characterId: CharacterId; fromXWU: number; fromYWU: number } | undefined;
          if (ev.source.kind === 'weapon') {
            const attackerFighter = weaponAttackerOf(this.state, ev.source, ev.targetRole);
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
          // The kick is 25% harder when the hit landed on THIS screen's fighter —
          // a local-seat bias, not a slot-0 one.
          const targetBias = targetSlot === LOCAL_SLOT ? 1.25 : 1;
          this.kick(shakeBase * targetBias * (isWeaponHit ? 1 : 0.45));

          if (isWeaponHit) {
            this.triggerHitStop(THREE.MathUtils.clamp(10 + ev.amount * 4.6, 16, 105));
          }

          if (ev.source.kind === 'weapon') {
            const attacker = weaponAttackerOf(this.state, ev.source, ev.targetRole);
            this.applyKnockback(targetSlot, attacker.x, attacker.y, 0.05 + ev.amount * 0.006);
          } else if (ev.source.kind === 'trail') {
            const owner = trailOwnerOf(this.state, ev.source);
            this.applyKnockback(targetSlot, owner.x, owner.y, 0.03);
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
          const fighter = fighterOf(this.state, ev.fighterId, ev.fighterRole);
          this.vfx.spawnHealPulse(fighter.x, fighter.y);
          this.feel.responses.vfx++;
          const screenPos = this.projectPointToScreen(fighter.x, fighter.y, 1.6);
          if (screenPos) { this.hud.spawnDamageNumber(screenPos, ev.amount, { heal: true }); this.feel.responses.damageNumber++; }
          break;
        }
        case 'death': {
          const slot = slotOf(ev.fighterId, ev.fighterRole);
          // The one record of knockout ORDER anywhere. `MatchOutcome`.
          this.eliminated.push(slot);
          this.models[slot]?.play('death');
          const fighter = fighterOf(this.state, ev.fighterId, ev.fighterRole);
          const color = lastHitColor[slot] ?? '#FFFFFF';
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

  /**
   * Is the GROUND point under `(xM, zM)` actually inside the frame?
   *
   * 🚨 THIS TEST DID NOT EXIST AND THE HUD CLAMPED INSTEAD, WHICH AT SIX SEATS IS A
   * PERMANENT FREE READ ON EVERY OPPONENT. Both projection helpers below returned a
   * point for any fighter in front of the far plane, and `hud.ts:updateFloatingBars`
   * then clamps x into `[56, innerWidth - 56]` and y down to the top bar — so a fighter
   * 2 000 wu away got an HP pill pinned to the frame edge on the side they were on.
   * Measured by the six-player acceptance pass: **63.7-82.9% of all opponent HP pills
   * drawn at six seats belonged to a fighter whose projected point was outside a
   * 1280x720 viewport**, at a mean separation of 1 534 wu (max 2 470) against
   * `FAIR_PLAY.radiusUnits` of 199.2. `spawnDamageNumber` shares the clamp, so fog
   * `-15`s for fighters two thousand units away landed on the edge as well.
   *
   * ⚠️ THE CLAMP ITSELF IS NOT THE BUG AND IS DELIBERATELY LEFT ALONE. Its comment
   * describes a real, correct case — *"a fighter above the top of the frame is exactly
   * when you most want to know their HP"* — and at TWO seats the opponent is nearly
   * always on screen or dead, so the clamp could only ever fire in that case. Six seats
   * is what turned a legitimate clamp into a bearing leak, and it quietly undoes both
   * the fog of war and the concealment feature (`DECISIONS §29c`) at the same time.
   *
   * So the boundary moves rather than the clamp: **the HUD may clamp a point that is on
   * screen; it may not be handed one that is not.** The test is on the fighter's GROUND
   * point, not on the pill's anchor, and that is the whole precision of it — the anchor
   * sits `FLOAT_BAR_HEIGHT` above the root, so it leaves the top of the frame while the
   * fighter is still standing in it, which is exactly the case the clamp exists for.
   * Testing the anchor would delete that case; testing the feet preserves it.
   */
  private groundOnScreen(xM: number, zM: number): boolean {
    this.projectVec.set(xM, 0, zM);
    this.projectVec.project(this.stage.rig.camera);
    return this.projectVec.z <= 1
      && Math.abs(this.projectVec.x) <= 1 && Math.abs(this.projectVec.y) <= 1;
  }

  private projectToScreen(model: CharacterModel, alive: boolean): { x: number; y: number } | null {
    if (!alive) return null;
    if (!this.groundOnScreen(model.root.position.x, model.root.position.z)) return null;
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
   * root) to screen space, for floating damage numbers. Same off-screen rejection as
   * `projectToScreen` and for the same reason: a damage number is a readout about a
   * fighter, so one drawn for an off-screen fighter is the same free read the HP pill
   * was — and `spawnDamageNumber` clamps identically. */
  private projectPointToScreen(xWU: number, yWU: number, heightM: number): { x: number; y: number } | null {
    const pos = groundPos(xWU, yWU);
    if (!this.groundOnScreen(pos.x, pos.z)) return null;
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
    // The chevron points THIS SCREEN'S fighter at safety, so it is a local-seat read.
    const p = localFighter(this.state);
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
    this.endedOutcome = this.state.phase === 'ended' ? this.outcome() : null;
    // ⚠️ CLEARED BEFORE THE CALLBACK, NOT AFTER. `matchScreen.ts` calls `showPayout`
    // from INSIDE this callback, on this very transition — clearing afterwards would
    // throw away the payout in the same turn it arrives.
    if (this.state.phase !== 'ended') this.endedPayout = null;
    this.opts.onPhase?.(this.state.phase, this.state.winner, this.endedOutcome);
  }

  /**
   * 🚨 PUT A BANKED PAYOUT ON THE RESULT CARD. The screen layer's one-way edge IN.
   *
   * `DECISIONS §64` defect 3: `bb00d66` made a 3rd-of-6 finish pay **+9 trophies, 44
   * coins and 74 XP** and the player was told **none of it** — the card had no money on
   * it at all. `48ad6ca` opened `HudFrameInfo.place` as a socket for the RANK on exactly
   * this principle; this is the same shape for the REWARD.
   *
   * ── 🚨 WHY IT IS A HANDOFF AND NOT A LOOKUP ────────────────────────────────
   *
   * **The payout is applied as a side effect of banking the result.**
   * `profile.recordPlacement(place, seats)` calls `applyMatchPlacement`, which MUTATES
   * the economy, and then commits it to storage. So a session that "fetched" its own
   * payout would be banking the match a second time — a bug that looks perfect on screen
   * (the numbers are right!) and silently doubles every trophy, coin and XP the player
   * has ever earned. That is why this takes plain numbers from the ONE call that already
   * happened, and why this file imports nothing from `game/economy/` or `ui/screens/`.
   *
   * `matchScreen.ts` banks exactly once per match behind its own `banked` flag and passes
   * the return value straight here. `tools/tmp/rc_card.mjs` §D plays a real match through
   * the shipped screens and asserts the banked trophy delta equals the number ON THE CARD
   * rather than twice it, with a `--arm twice` known-bad that banks a second time and
   * turns the row red.
   *
   * Idempotent and order-free: calling it twice with the same numbers renders the same
   * card, and calling it before the `'ended'` transition is harmless — `hudResult()`
   * gates it on `endedOutcome`, so a payout can only reach a card that exists.
   */
  showPayout(payout: MatchPayout | null): void {
    this.endedPayout = payout;
  }

  /**
   * THE THREE END-OF-MATCH FIELDS, BUILT IN ONE PLACE.
   *
   * ⚠️ **BECAUSE THERE ARE TWO `hud.update` CALL SITES AND THEY MUST NOT DRIFT.** `pause()`
   * builds a frame as well as `loop()` does, and `place` was already duplicated across
   * both; adding `order` and `payout` beside it would have made that three chances for a
   * paused result card to disagree with a running one. One object, spread at both.
   *
   * `payout` is gated on `endedOutcome` rather than standing alone so that every field
   * here has the SAME lifetime — non-null on an ended match, null everywhere else.
   */
  private hudResult(): Pick<HudFrameInfo, 'place' | 'order' | 'payout'> {
    return {
      place: this.hudPlace(),
      order: this.endedOutcome?.places ?? null,
      payout: this.endedOutcome ? this.endedPayout : null,
    };
  }

  /**
   * The result card's finishing line, in `hud.ts`'s ONE-BASED form — `{ place: 4, of: 6 }`
   * renders *"4th of 6"*.
   *
   * 🚨 **THE `+ 1` HAPPENS HERE AND NOWHERE ELSE.** `MatchOutcome.localPlace` is ZERO-based
   * because that is what `profile.recordPlacement(place, seats)` takes; `HudFrameInfo.place`
   * is ONE-based because that is what a human reads. Two conventions for one quantity is the
   * shape that pays 6th place a 5th-place cheque, so there is exactly one conversion in the
   * product and it is this line.
   *
   * Null in every phase but `'ended'`, and null for a seat count of one, which is what
   * `hud.ts` already gates its own element on (`place.of > 1`).
   */
  private hudPlace(): { place: number; of: number } | null {
    const o = this.endedOutcome;
    if (!o || o.seats <= 1 || o.localPlace < 0) return null;
    return { place: o.localPlace + 1, of: o.seats };
  }

  /**
   * The finishing order, as plain data. See `MatchOutcome`; the RULE is
   * `roster.ts:resolvePlaces` and this only feeds it.
   */
  private outcome(): MatchOutcome {
    // `fightersOf` rather than `state.fighters` for the reason every other consumer in this
    // file uses it: `roster.ts` states the "which container is the roster" rule once, and
    // the duck-typed states instruments build do not all carry a `fighters` array.
    const roster = fightersOf(this.state);
    const input: PlacementInput = {
      seats: roster.map((f, i) => ({
        // The array INDEX, not `f.id`. `fighters[i].id === i` is a sim invariant, but
        // `fightersOf`'s `[player, enemy]` fallback can be handed a pair an instrument
        // built, where the index is the authority.
        id: i,
        alive: f.alive,
        hp: f.hp,
        maxHp: f.maxHp,
        x: f.x,
        y: f.y,
        deaths: f.deaths,
      })),
      center: { x: this.arena.center.x, y: this.arena.center.y },
      eliminated: this.eliminated,
      winnerId: this.state.winnerId ?? null,
    };
    const places = resolvePlaces(input);
    return {
      seats: input.seats.length,
      places,
      localPlace: places.indexOf(LOCAL_SLOT),
      winnerId: input.winnerId,
    };
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
    const me = localFighter(this.state);
    d.facingX = me.facing.x;
    d.facingY = me.facing.y;
    d.selectedWeapon = this.input.selectedWeapon;
    d.pointerLocked = this.input.pointerLocked;
    d.frames++;
  }

  /** Exponential decay toward zero, used for the visual-only knockback offset.
   * Deliberately driven by `rawDtSeconds` (real/simSpeed time, NOT hit-stop-scaled)
   * so the nudge still reads as a snappy pop even while the sim is frozen. */
  private decayKnockback(rawDtSeconds: number): void {
    const decay = Math.exp(-rawDtSeconds * 14);
    for (const kb of this.knockback) {
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

    // One entry per slot, in slot order. `moved` is the run/idle discriminant and the
    // model's `moveSpeed01`, and it has to be asked per fighter — the two-variable form
    // could only ever answer it for two of them.
    const roster = fightersOf(this.state);
    const prev = roster.map((f) => ({ x: f.x, y: f.y }));

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

    const moved = roster.map((f, i) => f.x !== prev[i].x || f.y !== prev[i].y);

    // Layer the visual-only knockback nudge on top of the sim-authoritative position
    // written just above — never the other way around, so the sim position always
    // wins next frame and the two can't drift apart.
    this.models.forEach((m, i) => {
      const f = roster[i];
      if (!f) return;
      this.syncModelTransform(m, f);
      const kb = this.knockback[i];
      if (!kb) return;
      m.root.position.x += kb.x;
      m.root.position.z += kb.z;
    });
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
    // ⚠️ EVERY SLOT EXCEPT `LOCAL_SLOT`, and the skip is EXPLICIT. It used to read
    // `this.enemyModel` ONLY, with the note *"`playerModel.root.visible` is never
    // assigned anywhere in this file — a player who hides must always see themselves,
    // and vanishing your own character reads as a crash rather than as a mechanic."*
    // That rule is unchanged and is now enforced by the `i === LOCAL_SLOT` continue
    // rather than by the absence of a line: `fighterVisibleTo` would in fact return
    // true for a fighter asked about itself, and leaning on that would make "you can
    // always see yourself" a consequence of a distance test instead of a stated rule.
    const observer = localFighter(this.state);
    this.models.forEach((m, i) => {
      if (i === LOCAL_SLOT) return;
      const f = roster[i];
      if (f) m.root.visible = fighterVisibleTo(this.state, observer, f);
    });

    this.models.forEach((m, i) => {
      if (roster[i]?.alive) m.play(moved[i] ? 'run' : 'idle');
    });

    // Character animation runs on `stepDtSeconds` (hit-stop-scaled) so attack swings,
    // run cycles and the hit-flash visibly hitch along with the sim on a solid hit —
    // that shared pause across sim + character motion IS the hit-stop.
    const elapsedSeconds = this.state.elapsed / 1000;
    this.models.forEach((m, i) => {
      const f = roster[i];
      if (!f) return;
      m.update({
        dt: stepDtSeconds,
        elapsed: elapsedSeconds,
        moveSpeed01: f.alive && moved[i] ? 1 : 0,
        health01: f.hp / f.maxHp,
      });
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

    // The camera follows THIS SCREEN'S seat. One client, one camera, one subject.
    const localPos = groundPos(observer.x, observer.y);
    this.stage.rig.follow(localPos.x, localPos.z);
    this.stage.lighting.focus(localPos.x, localPos.z);

    // TEMP DEBUG: ground-plane screen projections for scripted aim in
    // tools/tmp/vfx_convert_capture.mjs (the floating HUD pill sits well above the
    // head, which makes a Playwright driver systematically overshoot when raycasting
    // mouse position back to the ground plane, per `buildInput()`'s aim math).
    // ⚠️ THE `player`/`enemy` KEYS ARE A PUBLISHED CONTRACT, not an internal shape:
    // twelve instruments read `__vfxDebugScreen.player` / `.enemy` by name, including
    // `tools/match-play.mjs` and the `cw_conceal_view` gate. `slots` is ADDED for
    // anything that needs slot 2 and up; neither existing key moves.
    (window as any).__vfxDebugScreen = {
      player: this.projectPointToScreen(roster[0].x, roster[0].y, 0),
      enemy: roster[1] ? this.projectPointToScreen(roster[1].x, roster[1].y, 0) : null,
      slots: roster.map((f) => this.projectPointToScreen(f.x, f.y, 0)),
    };

    this.hud.update(this.state, {
      selectedWeapon: this.input.selectedWeapon,
      safeArrow: this.safeArrow(),
      // Null unless pointer-locked — see `HudFrameInfo.aim`. Computed for every phase,
      // not just 'playing', so the countdown is not five seconds of an invisible
      // cursor with nothing on screen to orient by.
      aim: this.aimCursor(),
      // 🔴 THE RESULT CARD COULD NOT SAY WHERE YOU FINISHED, WHO CAME SECOND, OR WHAT IT
      // PAID. Three sockets `hud.ts` deliberately left open rather than deriving answers it
      // has no right to — the rank (`place`), the finishing order the loser list is printed
      // in (`order`), and the money (`payout`, which arrives from `matchScreen.ts` through
      // `showPayout` because banking it is what produces it). This is what fills all three,
      // and `hudResult()` is why the paused frame above cannot disagree with this one.
      ...this.hudResult(),
    });
    // ⚠️ SURFACE 2 OF 3 — the floating HP pills. `updateFloatingBars` hides a bar
    // whose screen point is `null`, and `projectToScreen` already returns `null` for a
    // dead fighter, so concealment rides the SAME null channel rather than inventing a
    // second way to hide the same element. The local seat's own pill takes `alive`
    // unchanged — same explicit `LOCAL_SLOT` skip as the model hide above.
    this.hud.updateFloatingBars(
      this.models.map((m, i) => {
        const f = roster[i];
        if (!f) return null;
        const shown = i === LOCAL_SLOT ? f.alive : f.alive && fighterVisibleTo(this.state, observer, f);
        return this.projectToScreen(m, shown);
      }),
      roster.map((f) => f.hp / f.maxHp),
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
