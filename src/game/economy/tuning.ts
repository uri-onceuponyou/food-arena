/**
 * ECONOMY DESIGN — the single place every economy number lives.
 *
 * `rules.ts` is the source of truth for COMBAT. This file is the source of truth for
 * PROGRESSION: what a match pays, what a trophy is worth, what is in a chest, what a
 * box costs, where each character sits on the trophy road, and what the (not yet
 * live) real-money store would sell.
 *
 * ── Why everything is in ONE file ───────────────────────────────────────────
 * An economy scattered across six modules cannot be retuned. Every number below is
 * a design decision that Uri will want to move, so they are all here, all named, all
 * commented with the reasoning that produced them. The logic that consumes them
 * (`rng.ts`, `containers.ts`, `trophyRoad.ts`, `store.ts`, `state.ts`) contains no
 * numeric literals of its own.
 *
 * ── Provenance ──────────────────────────────────────────────────────────────
 * The SHAPE of all of this — trophy road with milestone nodes, chests as win
 * rewards, four purple/red/burger/fire boxes with published rarity odds, coins and
 * diamonds — is `reference/prototypes/trophy-road-screen.html` and
 * `shop-screen.html`. The MAGNITUDES are not: the prototype road ends at 25,000
 * trophies with +15 a win, which is ~1,700 wins to finish, and it only unlocks 6 of
 * the 11 characters. See `TROPHY_ROAD` for the re-scale and its arithmetic.
 *
 * ── EVERY NUMBER BELOW WAS INVENTED FOR THIS FIRST PASS ─────────────────────
 * except the ones explicitly marked "(prototype)". They are a coherent starting
 * point, not a balanced economy. The pacing assertions in `economy.test.mjs` are
 * the guard rail: change a number here and the test tells you what it did to
 * time-to-first-unlock and time-to-full-roster.
 */

import { CHARACTER_IDS, CHARACTERS, type CharacterId, type Rarity } from '../rules.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Currencies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Two currencies, and the distinction is load-bearing for the store work:
 *
 *   * `coins` — SOFT. Earned by playing, and only by playing. Buys boxes.
 *   * `gems`  — HARD / premium. Earned on the trophy road and out of chests, and
 *               (once a payment processor exists) buyable with real money. Buys the
 *               same boxes faster.
 *
 * Nothing is EXCLUSIVELY hard-currency. A player who never spends a penny can reach
 * every character on the trophy road — see `TROPHY_ROAD`. That is a deliberate
 * design constraint, not an accident of the current tuning, and it is asserted in
 * `economy.test.mjs` so it cannot quietly stop being true.
 */
export type Currency = 'coins' | 'gems';

/** What a brand-new player starts with. Was `PlayerProfile`'s old `DEFAULTS`. */
export const STARTING_BALANCE = {
  coins: 500,
  gems: 25,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// The roster gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether the roster is LOCKED — i.e. whether `characterSelect` refuses to equip a
 * character the player has not unlocked.
 *
 * ⚠️ CURRENTLY FALSE, AND THAT IS A DELIBERATE, TEMPORARY STATE.
 *
 * The unlock model below is complete and tested: `unlocked`, `unlock()`, the
 * character milestones on the trophy road, the rarity pools inside every box, and
 * the duplicate-to-coins conversion all exist and all work. The one thing that does
 * not exist is the gate itself, which lives in `src/ui/screens/characterSelect.ts`
 * — a file this work does not own.
 *
 * It is false rather than true because turning it on today would:
 *   * lock Uri out of 10 of the 11 characters while the whole project's next task is
 *     "play a full match at real framerate and judge how it FEELS";
 *   * break `tools/tmp/menu_accept.mjs`, which equips Lollipop as its flow test.
 *
 * While it is false, EVERY character counts as owned, so every character reward
 * resolves to its duplicate value instead (see `DUPLICATE_COINS`). That keeps the
 * road and the boxes honest — they always hand over something real — and means
 * flipping this to `true` is the only change needed to switch the whole economy from
 * "coins" to "characters".
 */
export const ROSTER_GATED = false;

/** The one character a new player owns. Everything else is earned. */
export const STARTER_CHARACTER: CharacterId = CHARACTER_IDS[0]; // hamburger

// ─────────────────────────────────────────────────────────────────────────────
// Match payout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What one completed match is worth.
 *
 * The prototype's trophy ladder is for a SIX-PLAYER match (+15 / +10 / +4 / +2 / 0 /
 * negative). This game is 1v1, so there is no middle: `stepMatch` reports a winner
 * and nothing else. The mapping is therefore win = the prototype's 1st place, loss =
 * the prototype's last place, with its exact scaling formula preserved.
 *
 * ── The grace band is mine, and it matters ─────────────────────────────────
 * Straight prototype rules take trophies off a brand-new player from their very
 * first loss. At a realistic 55-60% win rate that makes the first hour read as
 * standing still, which is precisely when a player decides whether to keep playing.
 * Below `trophyLossGraceBelow` a loss costs nothing. Above it, the prototype's
 * escalating penalty applies unchanged, so the mid and late road still has the
 * tension the design wants.
 */
export const MATCH_PAYOUT = {
  /** (prototype: 1st place) */
  trophiesWin: 15,

  /** (prototype) Loss = min(cap, base + floor(trophies / per)). */
  trophyLossBase: 2,
  trophyLossPer: 150,
  trophyLossCap: 10,
  /** MINE. No trophy loss at all below this. See above. */
  trophyLossGraceBelow: 100,

  /**
   * MINE. Coins are the participation reward: you always get some, and winning is
   * worth 3x losing. A 3:1 ratio is enough for winning to feel better without making
   * a losing streak feel like a waste of ten minutes.
   */
  coinsWin: 60,
  coinsLoss: 20,

  /**
   * MINE. Wins per free chest. The prototype's shop says outright: "Chests aren't
   * sold here - you get those for winning a game!" — so wins are the chest faucet.
   * Every win is too many (a chest becomes wallpaper); the trophy road alone is too
   * few (five chests across the entire road). Three wins is roughly one chest every
   * 8-10 minutes of play at the assumed win rate.
   */
  winsPerChest: 3,
} as const;

/**
 * MINE. Coins paid when a character reward lands on a character you already own.
 *
 * Also the substitution value for a trophy-road character node while `ROSTER_GATED`
 * is false, which is why these are not trivial amounts: a road node has to feel like
 * a milestone even when it cannot hand over a fighter yet.
 *
 * Scaled off the prototype shop's `PRICE_BY_RARITY` diamond ladder (40/120/320/684/
 * 1200/1999), converted to coins at roughly 3x and rounded to readable numbers.
 */
export const DUPLICATE_COINS: Record<Rarity, number> = {
  Normal: 120,
  Rare: 260,
  Epic: 520,
  Legendary: 900,
  Neon: 1400,
  Cyber: 2200,
};

// ─────────────────────────────────────────────────────────────────────────────
// Containers — chests and boxes
// ─────────────────────────────────────────────────────────────────────────────

export type ContainerKind =
  | 'chest'
  | 'hamburgerBox'
  | 'pineappleBox'
  | 'redBox'
  | 'fireBox';

export const CONTAINER_KINDS = [
  'chest', 'hamburgerBox', 'pineappleBox', 'redBox', 'fireBox',
] as const;

/**
 * One outcome inside a container.
 *
 * `weight` is a PERCENTAGE. Weights within a container are asserted to sum to
 * exactly 100 in `economy.test.mjs`, which is what lets the published odds be read
 * straight off this table with no second copy of the numbers anywhere.
 *
 * ⚠️ THIS IS A LEGAL INTERFACE, NOT JUST A DATA STRUCTURE. Once gems are buyable
 * with real money, boxes are transitively real-money purchasable, and both major app
 * stores — and consumer law in several markets — require the drop rates to be
 * disclosed. `containerOdds()` in `containers.ts` derives that disclosure from THIS
 * table, the same table the roll uses. There is deliberately no second hand-written
 * copy of the odds to drift out of sync, and the tests assert the empirical
 * distribution of the seeded roller matches the published percentages.
 */
export interface ContainerEntry {
  /** Percent chance. All entries in a container must sum to 100. */
  weight: number;
  coins?: number;
  gems?: number;
  /** Grants a uniformly-random character of this rarity (duplicate → coins). */
  characterRarity?: Rarity;
}

export interface ContainerDef {
  name: string;
  emoji: string;
  /** One-line description for the odds sheet and the reveal card. */
  blurb: string;
  /** Purchase price, or null for progression-only containers. */
  price: { coins: number; gems: number } | null;
  entries: ContainerEntry[];
}

/**
 * ── Chests are PROGRESSION ONLY and are deliberately not purchasable ────────
 * `price: null` is the enforcement, not a convention: `store.ts` cannot list a
 * container with no price, and `economy.test.mjs` asserts the chest stays unpriced.
 * This is Uri's standing default ("chests are progression rewards, not
 * purchasables") expressed in the data rather than in a comment.
 *
 * ── Box odds are the prototype's, verbatim ──────────────────────────────────
 * All four boxes' rarity splits are transcribed from `shop-screen.html` unchanged.
 * The PRICES are not — see `price` on each.
 */
export const CONTAINERS: Record<ContainerKind, ContainerDef> = {
  /**
   * The free one. MINE, entirely — the prototype never says what is in a chest.
   *
   * Deliberately currency-heavy with a thin character tail: a chest arrives every
   * three wins, so it has to be satisfying at high frequency without being the
   * fastest route to the roster (that is the trophy road's job). Expected value is
   * ~186 coins + ~1.5 gems, which is about three matches' coin income — enough that
   * the chest counter is worth watching.
   */
  chest: {
    name: 'Chest',
    emoji: '📦',
    blurb: 'Earned by winning matches and along the Trophy Road.',
    price: null,
    entries: [
      { weight: 50, coins: 120 },
      { weight: 22, coins: 220 },
      { weight: 13, coins: 90, gems: 5 },
      { weight: 8, coins: 400 },
      { weight: 4, coins: 150, gems: 20 },
      { weight: 2.1, characterRarity: 'Normal' },
      { weight: 0.9, characterRarity: 'Rare' },
    ],
  },

  /**
   * `shop-screen.html` calls this the "Regular Box"; the trophy road calls the same
   * burger artwork a "Hamburger Box". One object, and the road's name wins because
   * the road is what ships first.
   *
   * PRICE IS MINE. The prototype's 3,500 coins is ~80 matches of coin income at the
   * payout above — it was priced against a 25,000-trophy road with much larger
   * grants. All four box prices are re-scaled by the same factor as the road (~4x
   * down) and then rounded.
   */
  hamburgerBox: {
    name: 'Hamburger Box',
    emoji: '🍔',
    blurb: 'Mostly Normal fighters, with a chance of better.',
    price: { coins: 900, gems: 60 },
    entries: [
      { weight: 89, characterRarity: 'Normal' },
      { weight: 10, characterRarity: 'Rare' },
      { weight: 1, characterRarity: 'Epic' },
    ],
  },

  pineappleBox: {
    name: 'Purple Pineapple Box',
    emoji: '🍍',
    blurb: 'Rare fighters guaranteed, Epic and Legendary possible.',
    price: { coins: 3200, gems: 120 },
    entries: [
      { weight: 94.5, characterRarity: 'Rare' },
      { weight: 5, characterRarity: 'Epic' },
      { weight: 0.5, characterRarity: 'Legendary' },
    ],
  },

  redBox: {
    name: 'Big Smile Box',
    emoji: '🎁',
    blurb: 'Epic fighters, with the only Cyber chance outside the Fire Box.',
    price: { coins: 5600, gems: 240 },
    entries: [
      { weight: 89.49, characterRarity: 'Epic' },
      { weight: 10, characterRarity: 'Legendary' },
      { weight: 0.5, characterRarity: 'Neon' },
      { weight: 0.01, characterRarity: 'Cyber' },
    ],
  },

  fireBox: {
    name: 'Purple Fire Box',
    emoji: '🔥',
    blurb: 'Legendary fighters, with the best Neon and Cyber odds in the game.',
    price: { coins: 12000, gems: 480 },
    entries: [
      { weight: 94.5, characterRarity: 'Legendary' },
      { weight: 5, characterRarity: 'Neon' },
      { weight: 0.5, characterRarity: 'Cyber' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// The trophy road
// ─────────────────────────────────────────────────────────────────────────────

export type MilestoneReward =
  | { type: 'coins'; amount: number }
  | { type: 'gems'; amount: number }
  | { type: 'container'; kind: ContainerKind; count: number }
  | { type: 'character'; id: CharacterId }
  | { type: 'bundle'; parts: MilestoneReward[] };

export interface Milestone {
  /** Trophies required. Strictly ascending, and the identity used for "claimed". */
  trophies: number;
  reward: MilestoneReward;
}

/**
 * ── The curve, and the arithmetic behind it ─────────────────────────────────
 *
 * The prototype's road runs to 25,000 trophies. At its own +15 a win that is ~1,670
 * wins BEFORE counting losses, and it unlocks only 6 of the 11 characters. Uri's
 * constraint is the opposite: a first unlock inside one sitting, and no implication
 * of hundreds of hours to see the roster. So the road was rebuilt, not rescaled.
 *
 * Assumptions used to derive it — CHANGE THESE AND THE NUMBERS BELOW MOVE:
 *   * 60% win rate against the current AI.
 *   * ~2 minutes per match including menu time (`MATCH_DURATION_MS` is 3:00, but
 *     most matches end on a knockout well before the clock).
 *
 * Expected trophies per match at that win rate:
 *   * below 100 trophies (grace band):  0.6 x 15                = +9.0
 *   * around 300 trophies:              0.6 x 15 - 0.4 x 4      = +7.4
 *   * around 1,000:                     0.6 x 15 - 0.4 x 8      = +5.8
 *   * 1,350 and above (loss capped):    0.6 x 15 - 0.4 x 10     = +5.0
 *
 * Which the seeded simulation in `economy.test.mjs` turns into (measured, not
 * estimated — the printed line in section 9 is the live figure):
 *   * FIRST CHARACTER (Donut, 75 trophies) — ~6 matches, ~12 minutes. One sitting.
 *   * HALF THE ROSTER (Water Bottle, 850)  — ~110 matches, ~3.7 hours.
 *   * FULL ROSTER (Hot Dog, 2,400)         — ~440 matches, ~15 hours.
 *   * ROAD COMPLETE (3,200)                — ~600 matches, ~20 hours.
 *
 * ~15 hours to the full roster is the number to argue with. It is deliberately
 * shorter than any shipped brawler's (Brawl Stars is hundreds of hours) because this
 * game has 11 characters, not 90, and a roster you cannot see is a roster you cannot
 * appreciate. `economy.test.mjs` asserts these bounds directly, so retuning any
 * number above will report exactly what it did to them.
 *
 * ── Which characters, in which order ────────────────────────────────────────
 * Rarity-ascending, which also preserves the prototype's own ordering for the six it
 * placed (Donut → Sushi → Water Bottle → Pizza → Lollipop → Hot Dog). The five it
 * never placed (Taco, Burrito, Soup, Egg, and Hamburger as the starter) slot in by
 * rarity. ALL TEN unlockable characters are on the road — the prototype left five to
 * the shop, which would have made a paid store mandatory to complete the game.
 *
 * The road/roster relationship is asserted, not assumed: `economy.test.mjs` checks
 * that the set of characters on this road is exactly `CHARACTER_IDS` minus the
 * starter, so adding a 12th character to `rules.ts` fails the test until it has a
 * home here.
 */
export const TROPHY_ROAD: Milestone[] = [
  { trophies: 10, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 25, reward: { type: 'coins', amount: 150 } },
  { trophies: 42, reward: { type: 'gems', amount: 5 } },
  { trophies: 60, reward: { type: 'character', id: 'donut' } },
  { trophies: 85, reward: { type: 'container', kind: 'hamburgerBox', count: 1 } },
  { trophies: 107, reward: { type: 'coins', amount: 250 } },
  { trophies: 130, reward: { type: 'character', id: 'taco' } },
  { trophies: 160, reward: { type: 'gems', amount: 10 } },
  { trophies: 190, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 220, reward: { type: 'character', id: 'burrito' } },
  { trophies: 260, reward: { type: 'coins', amount: 400 } },
  { trophies: 300, reward: { type: 'container', kind: 'hamburgerBox', count: 1 } },
  { trophies: 345, reward: { type: 'character', id: 'soup' } },
  { trophies: 400, reward: { type: 'gems', amount: 20 } },
  { trophies: 455, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 510, reward: { type: 'character', id: 'sushi' } },
  { trophies: 580, reward: { type: 'coins', amount: 700 } },
  { trophies: 650, reward: { type: 'container', kind: 'pineappleBox', count: 1 } },
  { trophies: 725, reward: { type: 'character', id: 'waterbottle' } },
  { trophies: 815, reward: { type: 'gems', amount: 35 } },
  { trophies: 905, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 1000, reward: { type: 'character', id: 'pizza' } },
  { trophies: 1105, reward: { type: 'coins', amount: 1200 } },
  { trophies: 1220, reward: { type: 'container', kind: 'redBox', count: 1 } },
  { trophies: 1340, reward: { type: 'character', id: 'egg' } },
  { trophies: 1485, reward: { type: 'gems', amount: 60 } },
  { trophies: 1630, reward: { type: 'container', kind: 'pineappleBox', count: 1 } },
  { trophies: 1780, reward: { type: 'character', id: 'lollipop' } },
  { trophies: 1980, reward: { type: 'coins', amount: 2000 } },
  { trophies: 2190, reward: { type: 'container', kind: 'redBox', count: 1 } },
  { trophies: 2400, reward: { type: 'character', id: 'hotdog' } },
  { trophies: 2650, reward: { type: 'gems', amount: 100 } },
  { trophies: 2900, reward: { type: 'container', kind: 'fireBox', count: 1 } },
  {
    trophies: 3200,
    reward: {
      type: 'bundle',
      parts: [
        { type: 'coins', amount: 5000 },
        { type: 'gems', amount: 150 },
        { type: 'container', kind: 'fireBox', count: 1 },
      ],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// The real-money store — DEFINED, PRICED, AND DELIBERATELY NOT LIVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ THE STORE IS NOT AVAILABLE, AND THE UI SAYS SO.
 *
 * There is no payment processor, no checkout, no receipt validation and no
 * entitlement server. Every product below renders DISABLED and labelled "Coming
 * soon" — a player is told exactly where they stand, which is the honest version of
 * an unbuilt feature. What is emphatically NOT built is a Buy button that looks live
 * and no-ops; that is the failure both menu critics punished.
 *
 * The reason the products exist in the model at all is that fulfilment is the part
 * that is expensive to retrofit. `grantProduct()` in `store.ts` is the function a
 * real processor's webhook would call, and it already works and is already tested.
 * Wiring Stripe or an app-store IAP later is then an integration: verify the receipt,
 * call `grantProduct`, persist. Not a rewrite of the economy.
 *
 * ── What is and is not sellable ─────────────────────────────────────────────
 * Real money buys GEMS ONLY, plus one starter bundle. It never buys a chest (Uri's
 * standing rule) and never buys a character directly. Because gems buy boxes, and
 * boxes contain randomised characters, the drop rates are transitively real-money
 * odds — which is exactly why `containerOdds()` derives its disclosure from the live
 * table. See the warning on `ContainerEntry`.
 */
export const STORE_AVAILABLE = false;

export type StoreProductId =
  | 'gemsPouch' | 'gemsSack' | 'gemsCrate' | 'gemsBarrel' | 'gemsVault'
  | 'starterBundle';

export interface StoreProduct {
  id: StoreProductId;
  name: string;
  emoji: string;
  /** US cents. Integer — never carry money in a float. */
  priceUsdCents: number;
  gems: number;
  coins?: number;
  container?: { kind: ContainerKind; count: number };
  /** Corner flash, e.g. "+24% MORE". Derived, not authored — see `store.ts`. */
  oneTime?: boolean;
}

/**
 * MINE, all of it. Standard five-tier gem ladder at the conventional price points,
 * with gems-per-dollar rising from 80.8 at the bottom tier to 140.0 at the top — a
 * 73% better rate at the vault, which is the shape every shipped ladder has.
 *
 * The starter bundle is the usual one-time trap-door offer and is priced to be an
 * obvious first purchase: 500 gems at the $4.99 tier's own rate, plus 2,000 coins
 * and a Pineapple Box on top.
 */
export const STORE_PRODUCTS: StoreProduct[] = [
  { id: 'gemsPouch', name: 'Pouch of Gems', emoji: '💎', priceUsdCents: 99, gems: 80 },
  { id: 'gemsSack', name: 'Sack of Gems', emoji: '💎', priceUsdCents: 499, gems: 500 },
  { id: 'gemsCrate', name: 'Crate of Gems', emoji: '💎', priceUsdCents: 999, gems: 1200 },
  { id: 'gemsBarrel', name: 'Barrel of Gems', emoji: '💎', priceUsdCents: 1999, gems: 2600 },
  { id: 'gemsVault', name: 'Vault of Gems', emoji: '💎', priceUsdCents: 4999, gems: 7000 },
  {
    id: 'starterBundle',
    name: 'Chef Starter Pack',
    emoji: '🧑‍🍳',
    priceUsdCents: 499,
    gems: 500,
    coins: 2000,
    container: { kind: 'pineappleBox', count: 1 },
    oneTime: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived roster data — computed from `rules.ts`, never hand-listed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Character ids grouped by rarity, built from `CHARACTERS` at module load.
 *
 * `shop-screen.html` hand-wrote this same map as a `RARITY_POOL` literal. Deriving
 * it means a rarity change in `rules.ts` — or a 12th character — reaches the box
 * tables and the published odds automatically, instead of silently making them wrong.
 */
export const CHARACTERS_BY_RARITY: Record<Rarity, CharacterId[]> = (() => {
  const out = {} as Record<Rarity, CharacterId[]>;
  for (const id of CHARACTER_IDS) {
    const rarity = CHARACTERS[id].rarity;
    (out[rarity] ??= []).push(id);
  }
  return out;
})();
