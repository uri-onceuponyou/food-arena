/**
 * FIXED GAME DESIGN — single source of truth.
 *
 * Every number here is transcribed verbatim from the original 2D prototype
 * (`reference/prototypes/kitchen-gameplay-prototype.html`) and the roster screen
 * (`reference/prototypes/characters-screen.html`).
 *
 * Per the build brief: the game design does not change. We are rebuilding how the
 * game is RENDERED and how it FEELS, not what it does. Character identity, ability
 * behaviour, damage, cooldowns, ranges, speeds and match structure are frozen.
 *
 * DO NOT tune these values for "game feel". If a value seems wrong, it is still the
 * spec. The only sanctioned exception is arena geometry (see `arena.ts`), which the
 * brief explicitly opened up for redesign.
 */

// ─────────────────────────────────────────────────────────────────────────────
// World & match structure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prototype world was 900x600 "world units" with a 360x240 scrolling viewport.
 * We keep this unit system so every damage radius, range and speed below stays
 * numerically identical. The 3D arena is authored in these same units; the brief
 * allows the arena to grow, so WORLD_W/H are overridden by the loaded arena.
 */
export const PROTOTYPE_WORLD = { w: 900, h: 600 } as const;

/** Prototype camera window, in world units. Drives our 3D camera framing distance. */
export const PROTOTYPE_VIEWPORT = { w: 360, h: 240 } as const;

export const MATCH_DURATION_MS = 180_000; // 3:00
export const COUNTDOWN_FROM = 5; // 5 → 4 → 3 → 2 → 1 → "START!"
export const COUNTDOWN_START_FLASH_MS = 700; // "START!" hold before play begins

/** Closing fog ring. safeRadius = MAX_SAFE_RADIUS * (1 - matchProgress). */
export const MAX_SAFE_RADIUS = 545;
export const FOG_TICK_MS = 300;
export const FOG_DAMAGE = 15;

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

/** Donut's Sticky Trail (passive). */
export const TRAIL = {
  dropIntervalMs: 160,
  durationMs: 4500,
  radius: 22,
  damage: 3,
  speedBoost: 1.35,
  damageBoost: 1.5,
} as const;

/** Homing projectile steering. Prototype: `turnAmount = min(1, 0.006 * dt)`. */
export const HOMING_TURN_RATE = 0.006;

/** Projectile hit radii. */
export const HIT_RADIUS_VS_PLAYER = PLAYER_SIZE * 0.6; // 25.2
export const HIT_RADIUS_VS_ENEMY = 26;

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
      { key: 'Smash', name: 'Patty Smash', type: 'melee', range: 110, damage: 12, cooldown: 650, cone: 80, color: '#FFC93C', effect: null, emoji: '🍖' },
      { key: 'Tomato', name: 'Tomato Toss', type: 'ranged', range: 130, damage: 8, cooldown: 800, speed: 420, color: '#E63946', effect: 'slow', splatter: true, emoji: '🍅' },
      { key: 'Lettuce', name: 'Lettuce Fling', type: 'ranged', range: 260, damage: 6, cooldown: 1100, speed: 320, color: '#7CB518', effect: 'stun', emoji: '🥬' },
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
      { key: 'Candy', name: 'Candy Barrage', type: 'ranged', range: 200, damage: 4, cooldown: 900, speed: 380, color: '#FF6FA5', effect: null, pellets: 3, spreadDeg: 14, trailBoosted: true, emoji: '🍬' },
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
      { key: 'Filling', name: 'Filling Toss', type: 'ranged', range: 220, damage: 12, cooldown: 900, speed: 380, color: '#6B3E26', effect: null, emoji: '🥩' },
      { key: 'Onion', name: 'Onion Bomb', type: 'ranged', range: 200, damage: 7, cooldown: 750, speed: 400, color: '#B497D6', effect: null, emoji: '🧅' },
      {
        key: 'Double', name: 'Double Toss', type: 'ranged', range: 220, damage: 0, cooldown: 2500, speed: 390, color: '#6B3E26', effect: null, emoji: '💥',
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
      { key: 'Disc', name: 'Burrito Disc', type: 'ranged', range: 240, damage: 10, cooldown: 850, speed: 400, color: '#F4E9DA', effect: null, emoji: '🌯' },
      { key: 'Roll', name: 'Roll Stun', type: 'melee', range: 90, damage: 4, cooldown: 1400, cone: 100, color: '#FFC93C', effect: 'stun', emoji: '🌀' },
      {
        key: 'Swarm', name: 'Topping Swarm', type: 'ranged', range: 260, damage: 5, cooldown: 3000, speed: 300, color: '#7CB518', effect: null,
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
      { key: 'Tackle', name: 'Egg Tackle', type: 'melee', range: 100, damage: 16, cooldown: 2200, cone: 70, color: '#FFF8EA', effect: null, emoji: '🥚' },
      { key: 'Hatch', name: 'Hatch!', type: 'ranged', range: 260, damage: 5, cooldown: 2600, speed: 150, color: '#FFE9A8', effect: null, homing: true, peckHits: 3, peckInterval: 500, emoji: '🐣' },
      { key: 'Shards', name: 'Shell Shards', type: 'ranged', range: 180, damage: 4, cooldown: 1000, speed: 380, color: '#F4E9DA', effect: 'slow', pellets: 3, spreadDeg: 30, emoji: '💥' },
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
      { key: 'Smash', name: 'Lollipop Smash', type: 'melee', range: 100, damage: 11, cooldown: 750, cone: 80, color: '#E63946', effect: null, emoji: '🔨' },
      { key: 'Giant', name: 'Giant Lollipop', type: 'melee', range: 400, damage: 10, cooldown: 8000, cone: 360, color: '#E63946', effect: 'stun', giantSlam: true, emoji: '🍭' },
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
      { key: 'Dough', name: 'Dough Balls', type: 'ranged', range: 200, damage: 5, cooldown: 850, speed: 360, color: '#FFE9A8', effect: 'slow', emoji: '⚪' },
      { key: 'Tomato', name: 'Tomato Splat', type: 'ranged', range: 180, damage: 6, cooldown: 900, speed: 380, color: '#E63946', effect: null, splatter: true, emoji: '🍅' },
      { key: 'Cheese', name: 'Cheese Blind', type: 'ranged', range: 170, damage: 4, cooldown: 1300, speed: 340, color: '#FFD873', effect: 'stun', emoji: '🧀' },
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
      { key: 'Rice', name: 'Rice Spray', type: 'ranged', range: 160, damage: 2, cooldown: 700, speed: 420, color: '#FFFFFF', effect: null, pellets: 5, spreadDeg: 35, emoji: '🍚' },
      { key: 'Seaweed', name: 'Seaweed Bait', type: 'ranged', range: 190, damage: 5, cooldown: 1000, speed: 350, color: '#7CB518', effect: 'slow', emoji: '🌿' },
      { key: 'Fish', name: 'Fish Pile', type: 'melee', range: 100, damage: 6, cooldown: 1200, cone: 150, color: '#F4A261', effect: null, emoji: '🐟' },
      { key: 'Catch', name: 'Big Catch', type: 'ranged', range: 240, damage: 9, cooldown: 3200, speed: 280, color: '#FF8C42', effect: null, pellets: 3, spreadDeg: 40, homing: true, emoji: '🐡' },
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
      { key: 'Splash', name: 'Soup Splash', type: 'ranged', range: 170, damage: 3, cooldown: 750, speed: 380, color: '#E8792A', effect: null, pellets: 3, spreadDeg: 25, emoji: '💦' },
      { key: 'Noodle', name: 'Noodle Toss', type: 'ranged', range: 200, damage: 5, cooldown: 1000, speed: 340, color: '#FFE9A8', effect: 'slow', emoji: '🍜' },
      { key: 'Dump', name: 'Soup Dump', type: 'melee', range: 110, damage: 16, cooldown: 3000, cone: 90, color: '#E8792A', effect: 'slow', emoji: '🌊' },
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
      { key: 'Spray', name: 'Water Spray', type: 'ranged', range: 180, damage: 3, cooldown: 850, speed: 380, color: '#BFEFFF', effect: 'slow', pellets: 3, spreadDeg: 30, emoji: '💦' },
      { key: 'Glass', name: 'Glass Shards', type: 'ranged', range: 200, damage: 7, cooldown: 1100, speed: 400, color: '#BFEFFF', effect: 'stun', emoji: '🧊' },
      { key: 'Cap', name: 'Cap Shot', type: 'ranged', range: 220, damage: 6, cooldown: 900, speed: 420, color: '#1E90D8', effect: 'slow', emoji: '🔵' },
      { key: 'Mega', name: 'Mega Splash', type: 'melee', range: 120, damage: 18, cooldown: 3500, cone: 100, color: '#1E90D8', effect: 'slow', emoji: '🌊' },
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
      { key: 'Mustard', name: 'Mustard Blast', type: 'ranged', range: 220, damage: 7, cooldown: 900, speed: 400, color: '#FFC93C', effect: null, emoji: '💛' },
      { key: 'Ketchup', name: 'Ketchup Slip', type: 'ranged', range: 190, damage: 5, cooldown: 950, speed: 380, color: '#D62839', effect: 'slow', emoji: '🔴' },
      { key: 'Slash', name: 'Bun Slash', type: 'melee', range: 100, damage: 11, cooldown: 650, cone: 75, color: '#FFC93C', effect: null, emoji: '⚔️' },
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
