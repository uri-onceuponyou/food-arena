/**
 * GAME DESIGN — single source of truth.
 *
 * Almost every number here is transcribed verbatim from the original 2D prototype
 * (`reference/prototypes/kitchen-gameplay-prototype.html`) and the roster screen
 * (`reference/prototypes/characters-screen.html`). Character identity, ability
 * behaviour, damage, cooldowns and match structure are unchanged.
 *
 * DO NOT tune these values for "game feel" on a hunch. If a value seems wrong, it is
 * still the spec until a deviation is deliberately authorised and recorded here.
 *
 * ── AUTHORISED DEVIATION #1 (2026-08-03): weapon REACH and projectile SPEED ──────
 *
 * Every weapon `range` and ranged `speed` below is now derived from the `REACH` and
 * `FLIGHT_MS` ladders instead of being a transcribed magic number. Uri's call; see
 * that section for the full rationale. Nothing else moved: damage, cooldown, cone,
 * pellet counts, effects, hit radii, movement speeds and arena geometry are all as
 * they were. `PROTOTYPE_VIEWPORT` below is kept as the historical record of WHY the
 * old ranges were what they were.
 *
 * The other sanctioned exception is arena geometry (see `arena.ts`), which the brief
 * explicitly opened up for redesign.
 */

// ─────────────────────────────────────────────────────────────────────────────
// World & match structure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prototype world was 900x600 "world units" with a 360x240 scrolling viewport.
 * We keep this unit system, so every damage radius, hit radius and movement speed
 * below is numerically identical to the prototype's. (Weapon reach and projectile
 * speed are the one exception — see `REACH` for why and by how much.) The 3D arena
 * is authored in these same units; the brief allows the arena to grow, so WORLD_W/H
 * are overridden by the loaded arena, which is 1400x1000.
 */
export const PROTOTYPE_WORLD = { w: 900, h: 600 } as const;

/**
 * Prototype camera window, in world units. HISTORICAL RECORD, not a live input — the
 * 3D camera derives its framing from `FAIR_PLAY` in `render/camera.ts` instead.
 *
 * Kept because it is the evidence for the range retune: a 360 wu wide window paired
 * with a 260 wu weapon means the 2D design always allowed an attacker to shoot you
 * from off screen. See `REACH`.
 */
export const PROTOTYPE_VIEWPORT = { w: 360, h: 240 } as const;

/**
 * ── AUTHORISED DEVIATION #2 (2026-08-05): MATCH LENGTH ──────────────────────
 *
 * Was 180_000 (3:00), transcribed from the prototype. Measured against the shipped
 * arena with `tools/match-sim.mjs --all-matchups` (110 matchups, the real `sim.ts`,
 * the real cover layout):
 *
 *   mean match          19.6 s      = 10.9% of a 180 s clock
 *   longest of 110      28.8 s      = 16.0%
 *   matches that ever reached the clock                 0 / 110
 *   closing fog's share of ALL damage dealt             1.5%
 *   ring radius when the median match ended             797 wu of a 890 wu opening
 *
 * So the entire closing-zone system — the ring, its HUD readouts, the fog damage
 * model — was dead weight: it had barely started moving when every match was already
 * over. A clock nobody reaches is not a clock.
 *
 * ── How 45 s was chosen ─────────────────────────────────────────────────────
 *
 * Swept 25/30/35/40/45/50/60/90/180 s through the real sim (the emulator in
 * `tools/tmp/simlayer_clock_sweep.mjs` drives any schedule by writing the one field
 * the ring derives from, so nothing had to be edited to measure it):
 *
 *      T      fog share of all damage      ring R when the median match ends
 *     25 s          34.2%                             384 wu
 *     30 s          19.0%                             444 wu
 *     40 s           9.7%                             560 wu
 *     45 s           8.1%                             598 wu
 *     60 s           2.6%                             655 wu
 *    180 s           1.5%                             797 wu
 *
 * Three constraints decided it, in this order:
 *
 *  1. THE CLOCK MUST NOT TRUNCATE A REAL FIGHT. The scripted player takes a mean
 *     13.0 s just to reach contact (the arena's spawn separation — see
 *     `docs/STATE.md` PART 2 #11 — is a known, separate problem), and the fight
 *     itself then runs a mean 6.6 s. 45 s is 1.6x the longest natural match measured
 *     (28.8 s) and 2.3x the mean. At 25-30 s the clock would be cutting off fights,
 *     not stalemates — and the fog's damage share (19-34%) would make the zone a
 *     co-primary damage source rather than a positional pressure.
 *  2. THE RING MUST ACTUALLY BITE. At 45 s the fog goes from 1.5% to 8.1% of all
 *     damage — a 5.4x increase — and the ring is inside the arena's inscribed radius
 *     (500 wu, where it first starts cutting the playfield rather than the corners)
 *     from t = 22.3 s, which is inside the top ~20% of matches by length.
 *  3. IT MUST STILL BE OUTRUNNABLE. The ring's edge now sweeps at 22.1 wu/s against
 *     a player speed of 120 wu/s. Beating the zone is a matter of noticing it, never
 *     a footrace — which is the same property the 180 s clock had (4.9 wu/s).
 *
 * ⚠️ INTERLOCK: `src/arena/shared.ts` DERIVES the opening ring radius from this
 * constant, so shortening the clock GROWS the opening ring (890 -> 993 wu) to keep
 * the fog's first contact with the arena's corners pinned at t = 6 s. That is
 * deliberate. Anything reading `arena.maxSafeRadius` as a fixed 890, or normalising a
 * widget by a hardcoded arena size, will now be wrong — see the report.
 */
export const MATCH_DURATION_MS = 45_000; // 0:45
export const COUNTDOWN_FROM = 5; // 5 → 4 → 3 → 2 → 1 → "START!"
export const COUNTDOWN_START_FLASH_MS = 700; // "START!" hold before play begins

/** Closing fog ring. safeRadius = MAX_SAFE_RADIUS * (1 - matchProgress). */
export const MAX_SAFE_RADIUS = 545;
export const FOG_TICK_MS = 300;
export const FOG_DAMAGE = 15;

/**
 * FLOOR on the closing ring: `safeRadius` never shrinks below this.
 *
 * Without it the ring reaches zero at the final whistle, which means the last seconds
 * of any match that goes the distance contain NO ground that costs 0 HP/s — and at
 * that point the outcome is pure arithmetic, not play: both fighters burn the same
 * FOG_DAMAGE per FOG_TICK_MS, so the one with the smaller HP pool dies first. That is
 * always the player (PLAYER_MAX_HP 100 vs ENEMY_MAX_HP 150): measured on the real sim,
 * with both fighters pinned and unable to attack, the player dies at 2.00 s and the
 * enemy at 3.00 s. **Running the clock out was an arithmetically guaranteed loss**, and
 * it pre-empted the timeout rule below — the tiebreak could never fire because the fog
 * always resolved the match first.
 *
 * Value: the arena's central damage hazard (the boiling pot, `POT.dangerRadius` = 95)
 * sits ON the arena centre, so the ring must clear it or "safe" ground does not exist.
 * 95 + one body length (PLAYER_SIZE = 42) = 137, rounded to 140 — a 45 wu-wide safe
 * annulus around the pot. `sim.test.mjs` asserts that relationship so a bigger pot
 * cannot silently re-create the bug.
 *
 * This is the genre convention too: a battle-royale final circle is small, not empty.
 */
export const MIN_SAFE_RADIUS = 140;

/** Central hazard (the boiling pot in the prototype). */
export const POT = {
  x: 450,
  y: 300,
  bodyRadius: 52,
  dangerRadius: 95,
  tickMs: 250,
  damage: 8,
} as const;

/** Standing-water hazard: slows anyone inside it. */
export const PUDDLE_SLOW_FACTOR = 0.45;

// ─────────────────────────────────────────────────────────────────────────────
// Entities
// ─────────────────────────────────────────────────────────────────────────────

export const PLAYER_MAX_HP = 100;
export const ENEMY_MAX_HP = 150;
export const PLAYER_SIZE = 42;
export const ENEMY_SIZE = 42;

/** Base movement: px per ms. Prototype: `0.12 * dt * speedMult`. */
export const PLAYER_SPEED = 0.12;
/** AI chase / flee speeds. Prototype: `0.07 * dt` and `0.085 * dt`. */
export const AI_CHASE_SPEED = 0.07;
export const AI_FLEE_SPEED = 0.085;
/** AI retreats below this fraction of max HP. */
export const AI_FLEE_HP_FRACTION = 0.28;
/** Movement multiplier applied to a slowed AI. */
export const AI_SLOW_MULTIPLIER = 0.35;

// ─────────────────────────────────────────────────────────────────────────────
// Status effects
// ─────────────────────────────────────────────────────────────────────────────

export const SLOW_DURATION_MS = 2500;
export const SLOW_MOVE_MULTIPLIER = 0.45;
export const STUN_DURATION_MS = 2000; // stunned = movement locked to 0

/** Out-of-combat regeneration. */
export const REGEN_DELAY_MS = 10_000; // since last damage taken
export const REGEN_TICK_MS = 200;
export const REGEN_AMOUNT = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Ground effects
// ─────────────────────────────────────────────────────────────────────────────

/** Splatter left by `splatter: true` weapons — slows anyone standing in it. */
export const SPLAT_DURATION_MS = 4000;
export const SPLAT_RADIUS = 20;

/**
 * Donut's Sticky Trail (passive).
 *
 * ── AUTHORISED DEVIATION #3 (2026-08-05): the trail is now RATE-LIMITED ──────
 *
 * `dropIntervalMs` 160 against `durationMs` 4500 means up to 29 of one owner's marks
 * can be alive at once, and `radius` 22 is far larger than the ~11 wu a chasing AI
 * covers between drops — so a Donut that circles, or gets held against cover, piles
 * its whole trail onto one tile. Every mark then damaged INDEPENDENTLY, all in the
 * same tick, uncapped. Measured on the real sim: 29 marks stacked on one spot cost the
 * victim **87 HP in a single 16.67 ms tick, across 29 simultaneous hit events** — 87%
 * of a player's maximum HP, delivered inside one frame, with no possible reaction.
 *
 * The mechanic is kept and the *numbers below are unchanged*. What changed is in
 * `sim.ts`: at most `maxHitsPerTick` marks may DAMAGE a given victim per tick, and any
 * other mark the victim is standing in is consumed at the same time (you tread the
 * filling out of all of them; only one of them bites). That converts an unbounded
 * burst into a rate, without touching the trail's density, its look, or its total
 * output in ordinary play — see the measured before/after in the commit message.
 */
export const TRAIL = {
  dropIntervalMs: 160,
  durationMs: 4500,
  radius: 22,
  damage: 3,
  speedBoost: 1.35,
  damageBoost: 1.5,
  /**
   * Hard cap on trail damage instances applied to ONE victim in ONE tick. 1, so the
   * worst tick a Donut's trail can ever produce is exactly `damage` (3 HP) — down from
   * 87 HP. Raising it re-opens the burst proportionally; it is a cap, not a rate.
   */
  maxHitsPerTick: 1,
} as const;

/** Homing projectile steering. Prototype: `turnAmount = min(1, 0.006 * dt)`. */
export const HOMING_TURN_RATE = 0.006;

/** Projectile hit radii. */
export const HIT_RADIUS_VS_PLAYER = PLAYER_SIZE * 0.6; // 25.2
export const HIT_RADIUS_VS_ENEMY = 26;

// ─────────────────────────────────────────────────────────────────────────────
// WEAPON REACH — the range ladder
// ─────────────────────────────────────────────────────────────────────────────
//
// Ranges used to be 11 scattered magic numbers between 90 and 260 wu, transcribed
// from a 2D prototype that scrolled a 360x240 window. That pairing — a 260 wu weapon
// inside a 360 wu window — means the original design ALWAYS allowed an attacker to
// hit you from off screen. The 3D camera guarantees the opposite (`FAIR_PLAY` in
// `render/camera.ts` fits a square of radius `maxRange + HIT_RADIUS_VS_PLAYER +
// reaction` on every aspect ratio), and honouring the old 260 forced the camera out
// to ~43 m, shrinking characters to 8% of frame height — a third of the Brawl Stars /
// Zooba silhouette this project exists to hit.
//
// So the ranges were retuned for a camera that shows you your attacker.
//
// ── How the ladder was built ────────────────────────────────────────────────
//
// A uniform cut was rejected: it would have dragged melee down to ~49-65 wu, and a
// fighter is PLAYER_SIZE = 42 wu across, so two of them would have had to overlap to
// trade blows. Instead the ladder is anchored at BOTH ends and the old values were
// mapped onto it monotonically, preserving every ratio that makes a character feel
// different:
//
//   * MELEE is anchored to the BODY. Expressed in body-lengths (1 body = 42 wu),
//     the old melee band was 2.1-2.9 bl — which is not melee, it is short range with
//     a swing animation. The new band is 1.4-2.0 bl: genuine contact reach, the gap
//     between two hitboxes running from ~0.4 to ~1.0 of a body width.
//   * RANGED is anchored to the FAIR RADIUS. `rangedMax` is the single number that
//     sets how far the camera has to pull back, so it is the tightest constraint in
//     the file; everything else is spaced beneath it.
//   * The melee:ranged spread is PRESERVED. Old max-ranged / max-melee = 260/120 =
//     2.17; new = 140/84 = 1.67 against the heavy melee special and 140/70 = 2.00
//     against a standard swing (old equivalent: 260/110 = 2.36). The gap at the
//     BOUNDARY actually widens — shortest ranged / longest melee goes from 130/120 =
//     1.08 to 98/84 = 1.17 — so "brawler vs shooter" reads more clearly, not less.
//   * Per-character ORDER is preserved exactly. Where the naive band map collapsed
//     two of one character's weapons onto the same rung, the shorter one was pushed
//     down a rung (Taco's Onion Bomb, Burrito's Disc, Water Bottle's Spray and
//     Glass). Every character keeps as many distinct ranges as it had, except Taco's
//     Filling Toss and Double Toss, which were identical (220) in the original too.
//
// ── What this costs ─────────────────────────────────────────────────────────
//
// The longest weapon reaches 3.3 body-lengths instead of 6.2. That is the honest
// price and it is real: a sniper reads as "clearly out-ranges the brawler" rather
// than "shoots from across the room". Everything else about the fight is preserved,
// because shrinking reach by 0.54 while the camera closes in by 1/0.62 leaves the
// on-screen picture — how far a shot travels as a fraction of the frame, how long it
// takes to get there — very close to unchanged, with the characters ~60% larger.
// ─────────────────────────────────────────────────────────────────────────────

/** One body length, in world units. Every reach below is a multiple of this. */
export const BODY_LENGTH = PLAYER_SIZE; // 42

export const REACH = {
  /** 1.38 bl — fast utility melee (Burrito's Roll Stun). A body-check. */
  meleeQuick: 58,
  /** 1.67 bl — the standard brawler swing. */
  meleeStrong: 70,
  /** 2.00 bl — slow, telegraphed, high-damage melee specials. */
  meleeHeavy: 84,

  /** 2.33 bl — sprays and close lobs; the first rung clear of every melee. */
  rangedClose: 98,
  /** 2.76 bl — the workhorse mid-range shot. */
  rangedMid: 116,
  /** 3.05 bl — long pokes and heavy single throws. */
  rangedLong: 128,
  /**
   * 3.33 bl — the longest reach any weapon has, ultimates aside.
   *
   * THIS NUMBER SETS THE CAMERA. `FAIR_PLAY.radiusUnits` = this + 25.2 + 34.0 =
   * 199.2 wu, and the camera distance is directly proportional to that. Raising it
   * pushes the camera back and shrinks every character on screen; do not raise it
   * without re-shooting `node tools/aspect.mjs` and looking at the result.
   */
  rangedMax: 140,

  /**
   * Lollipop's Giant Lollipop, and nothing else. DELIBERATELY NOT ON THE LADDER: it
   * is anchored to the ARENA (1400x1000 wu, fog closing to r=545), not to the weapon
   * ladder, because its whole design is "hits the whole map". It is excluded from
   * the fair-play radius in `render/camera.ts` — covering it would demand a 918 wu
   * radius — so its warning has to be the screen-filling slam VISUAL rather than
   * sight of the caster.
   *
   * => CONSTRAINT ON THE VFX OWNER, and it got HEAVIER with this retune: the slam
   * now reaches 2.0x the guaranteed-visible radius, where it used to reach 1.25x.
   * The caster is off screen far more often, so the tell has to carry more weight.
   */
  ultimateSlam: 400,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTILE FLIGHT — speed is derived, not authored
// ─────────────────────────────────────────────────────────────────────────────
//
// What a player actually perceives is TIME TO TARGET, not world units per second,
// and time to target is what decides whether a shot is dodgeable at all. So the
// authored number is the flight time and the speed falls out of it.
//
// This matters more than it looks: cutting range while holding speed fixed would
// have halved every flight time, dropping most shots to ~1.3 evade windows
// (EVADE_WINDOW = HIT_RADIUS_VS_PLAYER / PLAYER_SPEED = 210 ms — the time to move
// your own hit radius out of the line of fire). That would have quietly undone the
// very fairness the camera work exists to provide: seeing the shot is worthless if
// it lands before you can move. Deriving speed from a preserved flight time keeps
// every weapon exactly as dodgeable as it was, and — because the camera closed in by
// the same factor the ranges shrank — keeps its apparent on-screen speed too.
//
// The four bands are the clusters the prototype's 22 range/speed pairs already fell
// into (310, 381-447, 474-600, 813-867, 1733 ms). Every weapon keeps its band, so
// snappy weapons stay snappy and floaty ones stay floaty. Raw wu/s ordering can
// differ slightly from the old table where a weapon also changed rung — Taco's Onion
// Bomb and Pizza's Dough/Tomato are the only two cases — because speed now follows
// from reach x flight rather than being set by hand.
// ─────────────────────────────────────────────────────────────────────────────

export const FLIGHT_MS = {
  /** 1.67 evade windows. Sprays and quick lobs. */
  fast: 350,
  /** 2.38 evade windows. The workhorse. */
  normal: 500,
  /** 4.2 evade windows. Big, readable, telegraphed shots. */
  slow: 875,
  /** 8.3 evade windows. Egg's Hatch! — a chick that waddles at you. */
  drift: 1750,
} as const;

/** World units per second needed to cross `range` in `flightMs`. */
const projectileSpeed = (range: number, flightMs: number): number =>
  Math.round((range / flightMs) * 1000);

/**
 * The derived speed table. Named by the rung the weapon sits on, so a weapon's
 * `range` and `speed` can never drift out of sync.
 */
export const SPEED = {
  /** 280 wu/s */ closeFast: projectileSpeed(REACH.rangedClose, FLIGHT_MS.fast),
  /** 196 wu/s */ close: projectileSpeed(REACH.rangedClose, FLIGHT_MS.normal),
  /** 232 wu/s */ mid: projectileSpeed(REACH.rangedMid, FLIGHT_MS.normal),
  /** 256 wu/s */ long: projectileSpeed(REACH.rangedLong, FLIGHT_MS.normal),
  /** 160 wu/s */ maxSlow: projectileSpeed(REACH.rangedMax, FLIGHT_MS.slow),
  /**  80 wu/s */ maxDrift: projectileSpeed(REACH.rangedMax, FLIGHT_MS.drift),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Weapon / character types
// ─────────────────────────────────────────────────────────────────────────────

export type WeaponType = 'melee' | 'ranged' | 'self';
export type StatusEffect = 'slow' | 'stun' | null;
export type Rarity = 'Normal' | 'Rare' | 'Epic' | 'Legendary' | 'Neon' | 'Cyber';

export interface ComboPart {
  color: string;
  damage: number;
  angle: number;
  emoji: string;
}

export interface Weapon {
  /** Short key shown on the weapon slot. */
  key: string;
  name: string;
  type: WeaponType;
  /** Max travel distance (ranged) or reach (melee), in world units. */
  range?: number;
  damage: number;
  cooldown: number;
  /** Melee only: total arc width in degrees. 360 = omnidirectional. */
  cone?: number;
  /** Ranged only: world units per second. */
  speed?: number;
  color: string;
  effect: StatusEffect;
  emoji: string;

  /** Ranged: fire N pellets fanned across `spreadDeg`. */
  pellets?: number;
  spreadDeg?: number;
  pelletColors?: string[];
  pelletEmojis?: string[];

  /** Leaves a slowing floor splat on impact/expiry. */
  splatter?: boolean;
  /** Steers toward the target while in flight. */
  homing?: boolean;
  /** Fires all parts simultaneously as one combo special. */
  comboParts?: ComboPart[];
  /** Damage is multiplied when standing on own trail (Donut). */
  trailBoosted?: boolean;
  /** Arrives, then strikes repeatedly (Egg's Hatch!). */
  peckHits?: number;
  peckInterval?: number;
  /** Screen-filling AOE slam visual (Lollipop's Giant Lollipop). */
  giantSlam?: boolean;
  /** `self` type only. */
  healAmount?: number;
}

/** Display-only stats from the roster screen (0-10 scale). Not used in combat math. */
export interface DisplayStats {
  damage: number;
  health: number;
  speed: number;
}

export interface AbilityBlurb {
  emoji: string;
  name: string;
  desc: string;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  rarity: Rarity;
  stats: DisplayStats;
  /** Passive: drops a damaging speed-boost trail while moving (Donut only). */
  hasTrail: boolean;
  weapons: Weapon[];
  abilities: AbilityBlurb[];
  /**
   * Personality reference for the 3D model. Per the brief these descriptions were
   * written for flat 2D icons — they are a vibe guide, NOT a literal spec. Silhouette
   * readability and holding up against the Brawl Stars / Zooba bar wins when the two
   * pull in different directions. Identity (which food, which rarity) is fixed.
   */
  face: string;
}

export const CHARACTER_IDS = [
  'hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop',
  'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog',
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Shared palette (from the prototype's CSS custom properties)
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE = {
  ink: '#1a1224',
  bun: '#E8A33D', bunDark: '#D98E3D',
  patty: '#6B3E26', pattyDark: '#4E2C1B',
  tomato: '#E63946', lettuce: '#7CB518', onion: '#F4E9DA',
  mustard: '#FFC93C', ketchup: '#D62839', cream: '#FFF3DE',
  egg: '#FFF8EA', cheese: '#FFD873',
  rice: '#FFFFFF', nori: '#2B2B2B', salmon: '#F4A261',
  broth: '#E8792A', steam: '#C9C9C9',
  water: '#BFEFFF', waterCap: '#1E90D8',
  glaze: '#FF9EC4', sausage: '#B23A2E',
} as const;

export const RARITY_COLORS: Record<Rarity, string> = {
  Normal: '#9B9B9B',
  Rare: '#2E86D8',
  Epic: '#8B4FDE',
  Legendary: '#F4A300',
  Neon: '#FF2FD0',
  Cyber: '#00E5B0',
};

/** Card background colours behind the roster art. Neon/Cyber animate a black zigzag. */
export const RARITY_CARD_COLORS: Record<Rarity, string> = {
  Normal: '#BEBEBE',
  Rare: '#4A90D9',
  Epic: '#9B6FDE',
  Legendary: '#FFD84D',
  Neon: '#E63946',
  Cyber: '#3FD1E0',
};

// ─────────────────────────────────────────────────────────────────────────────
// The roster — 11 characters, frozen
// ─────────────────────────────────────────────────────────────────────────────

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  hamburger: {
    id: 'hamburger', name: 'Hamburger', emoji: '🍔', rarity: 'Normal',
    stats: { damage: 7, health: 8, speed: 5 }, hasTrail: false,
    face: 'Closed happy eyes, small smile. Stacked bun/patty/lettuce/tomato silhouette.',
    weapons: [
      { key: 'Smash', name: 'Patty Smash', type: 'melee', range: REACH.meleeStrong, damage: 12, cooldown: 650, cone: 80, color: '#FFC93C', effect: null, emoji: '🍖' },
      { key: 'Tomato', name: 'Tomato Toss', type: 'ranged', range: REACH.rangedClose, damage: 8, cooldown: 800, speed: SPEED.closeFast, color: '#E63946', effect: 'slow', splatter: true, emoji: '🍅' },
      { key: 'Lettuce', name: 'Lettuce Fling', type: 'ranged', range: REACH.rangedMax, damage: 6, cooldown: 1100, speed: SPEED.maxSlow, color: '#7CB518', effect: 'stun', emoji: '🥬' },
      { key: 'Onion', name: 'Onion Ring', type: 'self', damage: 0, cooldown: 6000, healAmount: 25, color: '#F4E9DA', effect: null, emoji: '🧅' },
    ],
    abilities: [
      { emoji: '🍅', name: 'Tomato Toss', desc: 'Slows enemies down' },
      { emoji: '🥬', name: 'Lettuce Fling', desc: 'Stuns enemies for a few seconds' },
      { emoji: '🍖', name: 'Patty Smash', desc: 'Deals heavy damage' },
      { emoji: '🧅', name: 'Onion Ring', desc: 'Heals himself' },
    ],
  },

  donut: {
    id: 'donut', name: 'Donut', emoji: '🍩', rarity: 'Normal',
    stats: { damage: 6, health: 7, speed: 6 }, hasTrail: true,
    face: 'Crooked smile, sprinkles across a pink glaze torus.',
    weapons: [
      { key: 'Candy', name: 'Candy Barrage', type: 'ranged', range: REACH.rangedLong, damage: 4, cooldown: 900, speed: SPEED.long, color: '#FF6FA5', effect: null, pellets: 3, spreadDeg: 14, trailBoosted: true, emoji: '🍬' },
    ],
    abilities: [
      { emoji: '🍬', name: 'Candy Barrage', desc: 'Throws candies that chip away health' },
      { emoji: '🍯', name: 'Sticky Trail', desc: 'Leaves a filling trail - hurts enemies, speeds him up' },
    ],
  },

  taco: {
    id: 'taco', name: 'Taco', emoji: '🌮', rarity: 'Rare',
    stats: { damage: 8, health: 6, speed: 5 }, hasTrail: false,
    face: 'Trapezoid shell with a jagged crimped top edge; face floats completely outside the shell, to the side.',
    weapons: [
      { key: 'Filling', name: 'Filling Toss', type: 'ranged', range: REACH.rangedLong, damage: 12, cooldown: 900, speed: SPEED.long, color: '#6B3E26', effect: null, emoji: '🥩' },
      // Onion Bomb sits one rung below Filling/Double so Taco keeps two distinct
      // ranges, exactly as it did at 200 vs 220.
      { key: 'Onion', name: 'Onion Bomb', type: 'ranged', range: REACH.rangedMid, damage: 7, cooldown: 750, speed: SPEED.mid, color: '#B497D6', effect: null, emoji: '🧅' },
      {
        key: 'Double', name: 'Double Toss', type: 'ranged', range: REACH.rangedLong, damage: 0, cooldown: 2500, speed: SPEED.long, color: '#6B3E26', effect: null, emoji: '💥',
        comboParts: [
          { color: '#6B3E26', damage: 14, angle: -10, emoji: '🥩' },
          { color: '#B497D6', damage: 9, angle: 10, emoji: '🧅' },
        ],
      },
    ],
    abilities: [
      { emoji: '🥩', name: 'Filling Toss', desc: 'Throws his filling for heavy damage' },
      { emoji: '🧅', name: 'Onion Bomb', desc: 'Throws onion for damage' },
      { emoji: '💥', name: 'Double Toss', desc: 'Special: throws filling and onion together for massive damage' },
    ],
  },

  burrito: {
    id: 'burrito', name: 'Burrito', emoji: '🌯', rarity: 'Rare',
    stats: { damage: 7, health: 6, speed: 6 }, hasTrail: false,
    face: 'White wrap, stands upright, toppings visible at the open end.',
    weapons: [
      // Disc sits one rung below Swarm so Burrito keeps its 240-vs-260 ordering.
      { key: 'Disc', name: 'Burrito Disc', type: 'ranged', range: REACH.rangedLong, damage: 10, cooldown: 850, speed: SPEED.long, color: '#F4E9DA', effect: null, emoji: '🌯' },
      { key: 'Roll', name: 'Roll Stun', type: 'melee', range: REACH.meleeQuick, damage: 4, cooldown: 1400, cone: 100, color: '#FFC93C', effect: 'stun', emoji: '🌀' },
      {
        key: 'Swarm', name: 'Topping Swarm', type: 'ranged', range: REACH.rangedMax, damage: 5, cooldown: 3000, speed: SPEED.maxSlow, color: '#7CB518', effect: null,
        pellets: 4, spreadDeg: 55, homing: true,
        pelletColors: ['#7CB518', '#E63946', '#FFC93C', '#F4E9DA'],
        pelletEmojis: ['🥬', '🍅', '🧀', '🧅'],
        emoji: '✨',
      },
    ],
    abilities: [
      { emoji: '🌯', name: 'Burrito Disc', desc: 'Throws himself like a flying disc for damage' },
      { emoji: '🌀', name: 'Roll Stun', desc: 'Rolls up and freezes enemies in place for a few seconds' },
      { emoji: '✨', name: 'Topping Swarm', desc: 'Special: squeezes out all his toppings, which fly everywhere and chase enemies dealing damage - the flying toppings can be destroyed' },
    ],
  },

  egg: {
    id: 'egg', name: 'Egg', emoji: '🥚', rarity: 'Neon',
    stats: { damage: 8, health: 6, speed: 4 }, hasTrail: false,
    face: 'Open eyes with highlights, straight neutral mouth.',
    weapons: [
      { key: 'Tackle', name: 'Egg Tackle', type: 'melee', range: REACH.meleeHeavy, damage: 16, cooldown: 2200, cone: 70, color: '#FFF8EA', effect: null, emoji: '🥚' },
      { key: 'Hatch', name: 'Hatch!', type: 'ranged', range: REACH.rangedMax, damage: 5, cooldown: 2600, speed: SPEED.maxDrift, color: '#FFE9A8', effect: null, homing: true, peckHits: 3, peckInterval: 500, emoji: '🐣' },
      { key: 'Shards', name: 'Shell Shards', type: 'ranged', range: REACH.rangedMid, damage: 4, cooldown: 1000, speed: SPEED.mid, color: '#F4E9DA', effect: 'slow', pellets: 3, spreadDeg: 30, emoji: '💥' },
    ],
    abilities: [
      { emoji: '🥚', name: 'Egg Tackle', desc: 'Launches herself at the enemy for big damage - slow to charge up' },
      { emoji: '🐣', name: 'Hatch!', desc: 'She cracks open and a chick bursts out, pecking for damage' },
      { emoji: '💥', name: 'Shell Shards', desc: 'Broken shell pieces slow enemies and chip away their health' },
    ],
  },

  lollipop: {
    id: 'lollipop', name: 'Lollipop', emoji: '🍭', rarity: 'Cyber',
    stats: { damage: 8, health: 5, speed: 6 }, hasTrail: false,
    face: 'Eyes on the stick, mouth on the candy. Concentric red/white swirl disc.',
    weapons: [
      { key: 'Smash', name: 'Lollipop Smash', type: 'melee', range: REACH.meleeStrong, damage: 11, cooldown: 750, cone: 80, color: '#E63946', effect: null, emoji: '🔨' },
      { key: 'Giant', name: 'Giant Lollipop', type: 'melee', range: REACH.ultimateSlam, damage: 10, cooldown: 8000, cone: 360, color: '#E63946', effect: 'stun', giantSlam: true, emoji: '🍭' },
    ],
    abilities: [
      { emoji: '🔨', name: 'Lollipop Smash', desc: 'Swings herself like a hammer for heavy damage' },
      { emoji: '💫', name: 'Giant Lollipop', desc: 'Grows huge and hits the whole map, making everyone dizzy' },
    ],
  },

  pizza: {
    id: 'pizza', name: 'Pizza', emoji: '🍕', rarity: 'Neon',
    stats: { damage: 6, health: 7, speed: 5 }, hasTrail: false,
    face: 'Closed eyes, smiling. Triangular slice with pepperoni and a crust base.',
    weapons: [
      { key: 'Dough', name: 'Dough Balls', type: 'ranged', range: REACH.rangedLong, damage: 5, cooldown: 850, speed: SPEED.long, color: '#FFE9A8', effect: 'slow', emoji: '⚪' },
      { key: 'Tomato', name: 'Tomato Splat', type: 'ranged', range: REACH.rangedMid, damage: 6, cooldown: 900, speed: SPEED.mid, color: '#E63946', effect: null, splatter: true, emoji: '🍅' },
      { key: 'Cheese', name: 'Cheese Blind', type: 'ranged', range: REACH.rangedClose, damage: 4, cooldown: 1300, speed: SPEED.close, color: '#FFD873', effect: 'stun', emoji: '🧀' },
    ],
    abilities: [
      { emoji: '⚪', name: 'Dough Balls', desc: 'Throws dough balls that slow enemies down' },
      { emoji: '🍅', name: 'Tomato Splat', desc: 'Tomatoes stick to the floor, damaging and slowing anyone who steps on them' },
      { emoji: '🧀', name: 'Cheese Blind', desc: "Cheese sticks to an enemy's face and blocks their vision until someone hits them" },
    ],
  },

  sushi: {
    id: 'sushi', name: 'Sushi', emoji: '🍣', rarity: 'Legendary',
    stats: { damage: 6, health: 5, speed: 7 }, hasTrail: false,
    face: 'Wide eyes, puckered lips. Rice cylinder banded with nori, salmon centre.',
    weapons: [
      { key: 'Rice', name: 'Rice Spray', type: 'ranged', range: REACH.rangedClose, damage: 2, cooldown: 700, speed: SPEED.closeFast, color: '#FFFFFF', effect: null, pellets: 5, spreadDeg: 35, emoji: '🍚' },
      { key: 'Seaweed', name: 'Seaweed Bait', type: 'ranged', range: REACH.rangedMid, damage: 5, cooldown: 1000, speed: SPEED.mid, color: '#7CB518', effect: 'slow', emoji: '🌿' },
      { key: 'Fish', name: 'Fish Pile', type: 'melee', range: REACH.meleeStrong, damage: 6, cooldown: 1200, cone: 150, color: '#F4A261', effect: null, emoji: '🐟' },
      { key: 'Catch', name: 'Big Catch', type: 'ranged', range: REACH.rangedMax, damage: 9, cooldown: 3200, speed: SPEED.maxSlow, color: '#FF8C42', effect: null, pellets: 3, spreadDeg: 40, homing: true, emoji: '🐡' },
    ],
    abilities: [
      { emoji: '🍚', name: 'Rice Spray', desc: 'Throws a spray of rice grains - each one chips away a little health' },
      { emoji: '🌿', name: 'Seaweed Bait', desc: 'Seaweed lures every enemy toward it while he shoots them' },
      { emoji: '🐟', name: 'Fish Pile', desc: 'Turns into a pile of fish that attack for small damage' },
      { emoji: '🐡', name: 'Big Catch', desc: 'Special: throws seaweed with fish - the fish grow huge and the seaweed scatters across the map, pulling enemies everywhere' },
    ],
  },

  soup: {
    id: 'soup', name: 'Soup', emoji: '🍲', rarity: 'Epic',
    stats: { damage: 7, health: 6, speed: 4 }, hasTrail: false,
    face: 'Gray steam-coloured eyes, no mouth. Wide bowl with rising steam.',
    weapons: [
      { key: 'Splash', name: 'Soup Splash', type: 'ranged', range: REACH.rangedClose, damage: 3, cooldown: 750, speed: SPEED.closeFast, color: '#E8792A', effect: null, pellets: 3, spreadDeg: 25, emoji: '💦' },
      { key: 'Noodle', name: 'Noodle Toss', type: 'ranged', range: REACH.rangedLong, damage: 5, cooldown: 1000, speed: SPEED.long, color: '#FFE9A8', effect: 'slow', emoji: '🍜' },
      { key: 'Dump', name: 'Soup Dump', type: 'melee', range: REACH.meleeHeavy, damage: 16, cooldown: 3000, cone: 90, color: '#E8792A', effect: 'slow', emoji: '🌊' },
    ],
    abilities: [
      { emoji: '💦', name: 'Soup Splash', desc: 'Throws his soup liquid - each splash chips away a little health' },
      { emoji: '🍜', name: 'Noodle Toss', desc: 'Throws noodles that slow enemies down' },
      { emoji: '🌊', name: 'Soup Dump', desc: 'Special: tips himself over onto an enemy, pouring all his soup and noodles - big damage and a heavy slow' },
    ],
  },

  waterbottle: {
    id: 'waterbottle', name: 'Water Bottle', emoji: '💧', rarity: 'Legendary',
    stats: { damage: 7, health: 7, speed: 5 }, hasTrail: false,
    face: 'Eyes floating above the cap, big smile. Translucent blue bottle with a darker cap.',
    weapons: [
      // Water Bottle is the only four-weapon fighter with three ranged slots, so
      // Spray and Glass each drop a rung to keep all four reaches distinct.
      { key: 'Spray', name: 'Water Spray', type: 'ranged', range: REACH.rangedClose, damage: 3, cooldown: 850, speed: SPEED.close, color: '#BFEFFF', effect: 'slow', pellets: 3, spreadDeg: 30, emoji: '💦' },
      { key: 'Glass', name: 'Glass Shards', type: 'ranged', range: REACH.rangedMid, damage: 7, cooldown: 1100, speed: SPEED.mid, color: '#BFEFFF', effect: 'stun', emoji: '🧊' },
      { key: 'Cap', name: 'Cap Shot', type: 'ranged', range: REACH.rangedLong, damage: 6, cooldown: 900, speed: SPEED.long, color: '#1E90D8', effect: 'slow', emoji: '🔵' },
      { key: 'Mega', name: 'Mega Splash', type: 'melee', range: REACH.meleeHeavy, damage: 18, cooldown: 3500, cone: 100, color: '#1E90D8', effect: 'slow', emoji: '🌊' },
    ],
    abilities: [
      { emoji: '💦', name: 'Water Spray', desc: 'Sprays water that slows enemies down a lot' },
      { emoji: '🧊', name: 'Glass Shards', desc: 'Shoots glass shards that deal damage and freeze enemies' },
      { emoji: '🔵', name: 'Cap Shot', desc: 'Fires his cap - enemies slip when it hits' },
      { emoji: '🌊', name: 'Mega Splash', desc: 'Special: launches himself up (takes a few seconds), his cap becomes a second bottle, and together they become one giant bottle that dumps water on an enemy for huge damage and a heavy slow' },
    ],
  },

  hotdog: {
    id: 'hotdog', name: 'Hot Dog', emoji: '🌭', rarity: 'Cyber',
    stats: { damage: 8, health: 6, speed: 7 }, hasTrail: false,
    face: 'Sleepy half-closed eyes, small smile. Sausage in a bun with a mustard zigzag.',
    weapons: [
      { key: 'Mustard', name: 'Mustard Blast', type: 'ranged', range: REACH.rangedLong, damage: 7, cooldown: 900, speed: SPEED.long, color: '#FFC93C', effect: null, emoji: '💛' },
      { key: 'Ketchup', name: 'Ketchup Slip', type: 'ranged', range: REACH.rangedMid, damage: 5, cooldown: 950, speed: SPEED.mid, color: '#D62839', effect: 'slow', emoji: '🔴' },
      { key: 'Slash', name: 'Bun Slash', type: 'melee', range: REACH.meleeStrong, damage: 11, cooldown: 650, cone: 75, color: '#FFC93C', effect: null, emoji: '⚔️' },
    ],
    abilities: [
      { emoji: '💛', name: 'Mustard Blast', desc: 'Burns enemies from a distance' },
      { emoji: '🔴', name: 'Ketchup Slip', desc: 'Makes enemies slide and lose control' },
      { emoji: '⚔️', name: 'Bun Slash', desc: 'Powerful close-range strike' },
    ],
  },
};

/** Rarity display order, lowest → highest. */
export const RARITY_ORDER: Rarity[] = ['Normal', 'Rare', 'Epic', 'Legendary', 'Neon', 'Cyber'];
