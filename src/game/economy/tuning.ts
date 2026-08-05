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
// CHARACTER LEVELS — the coin sink
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── WHY COINS, AND ONLY COINS ───────────────────────────────────────────────
 *
 * Uri left the currency open: *"To increase levels you need to spend coins/anything else."*
 * The answer is **coins**, and the argument is a measurement rather than a preference:
 *
 * **Before this, coins had no sink worth using.** The only thing they bought was a box,
 * and while `ROSTER_GATED` is false every box pays out a DUPLICATE — so a 900-coin
 * Hamburger Box returns 138 coins in expectation (0.89x120 + 0.10x260 + 0.01x520) and a
 * 12,000-coin Fire Box returns 932. Coins were a currency whose only sink was an
 * incinerator, and a player's balance rose forever with nothing to do about it. That is
 * the hole levelling fills, and it is why this needs no new faucet: the coin faucets
 * (match payout, chests, road nodes) already run and already have nowhere to drain.
 *
 * ── WHY NOT A SECOND, PER-CHARACTER RESOURCE ────────────────────────────────
 *
 * Brawl Stars splits this into gold (global) plus power points (per-brawler), which makes
 * levelling ADDITIVE to unlocking rather than competing with it. It is a good design and it
 * is deliberately not this one, for one reason: **a second resource needs a second faucet**,
 * and every faucet here is already tuned and asserted. Adding one means re-deriving the
 * chest table, the road payouts and the box odds together — a bigger change than the
 * feature, and one that would land untested.
 *
 * **The competition is therefore REAL and is the intended tension**: coins spent on levels
 * are coins not spent on boxes. That is a decision the player gets to make, which is more
 * than the coin balance offered before.
 *
 * ⚠️ AND IT IS REVERSIBLE BY CONSTRUCTION. `levelUpCost()` returns a full `{ coins, gems }`
 * price, not a number, and takes the CHARACTER ID even though nothing below reads it for
 * anything except rarity. Adding a per-character resource, or moving levels onto gems, is
 * a change to this table and to `Reward` — not a change to any call site.
 */
export const LEVEL_UP = {
  /**
   * Coin price of the very first upgrade (level 1 -> 2) for a Normal character.
   *
   * Set against `STARTING_BALANCE.coins` deliberately: 300 out of a 500-coin opening
   * balance buys EXACTLY ONE level before a single match is played, and the second rung
   * (400) does not fit. The level system therefore announces itself immediately — a
   * player finds the button by having enough for it — without the welcome balance
   * quietly paying for a quarter of the ladder. Asserted in `economy.test.mjs` §13,
   * because it is a relationship between two constants and not a property of either.
   */
  baseCoins: 300,

  /**
   * Each upgrade costs this much more than the one before it, before rarity.
   *
   * 1.32 over the 14 steps of a 1-15 ladder puts the last upgrade at 37x the first, which
   * is the shape every shipped level ladder has: the first few are impulse purchases and
   * the last one is a decision. Totals are in `LEVEL_UP`'s own tests and in
   * `tools/tmp/level_lab.mjs --economy`, measured against real career income rather than
   * asserted from this comment.
   */
  growth: 1.32,

  /**
   * ── FLAT, DELIBERATELY. RARITY COSTS NOTHING EXTRA ──────────────────────────
   *
   * ⚠️ This was a 1.0x -> 4.5x ladder, and the reasoning behind it is kept below because
   * it was coherent and it was still wrong.
   *
   * THE OLD ARGUMENT: the game granted power for rarity AND power for level, so a rarer
   * character would be strictly better forever unless something else differed. Clash
   * Royale's answer is that rarity is paid for in upgrade cost, so the ladder was set at
   * ~1.35x per tier — Cyber 4.5x Normal, close to Clash Royale's own Common-to-Legendary
   * gold ratio.
   *
   * WHY IT NO LONGER APPLIES. `DECISIONS §24b`: Uri reversed rarity-as-power, because in
   * a game heading for humans-vs-humans it is pay-to-win, and it is the one imbalance
   * skill cannot close. Tier spread is now **3.98 pp against a ~9 pp noise floor** — flat
   * to the limit of the instrument. So the premise the ladder existed to correct is gone,
   * and what was left was a **pure penalty**: same power, 4.5x the price, once you own the
   * character. In Clash Royale that cost scaling is a CONSEQUENCE OF COPY SCARCITY — rare
   * cards are hard to FIND. This game has no scarcity mechanic behind it.
   *
   * TWO INDEPENDENT ROUTES REACHED THE SAME ANSWER (§26, §27):
   *   * Uri's own Brawl Stars reference plate shows rarity as the word "EPIC" under the
   *     ROLE label — not a stat, not a bar, not a cost. It carries no mechanical job at all.
   *   * A kit-distinctiveness pass built a validated metric, found 0 of 55 character pairs
   *     indistinguishable, tested eight candidate kits and shipped no balance change,
   *     concluding rarity could not be given a distinctiveness job at a price worth paying.
   *
   * SO RARITY'S JOB IS ACQUISITION AND PRESTIGE. It decides how hard a character is to
   * OBTAIN — trophy-road position and drop rate — and nothing else. Levelling costs the
   * same for everyone, which is what "anyone can get there; it costs time, not luck" means.
   *
   * ── WHAT IT ACTUALLY COST, DERIVED RATHER THAN ASSERTED ───────────────────
   *
   * Coins to take ONE character from level 1 to `LEVEL_MAX`, and the matches of career
   * income that buys at the 60% win rate section 9 simulates (`SECONDS_PER_MATCH` for the
   * clock). Every figure re-derived in Node off this table, not remembered:
   *
   *     tier         mult          BEFORE            AFTER      matches   h
   *     Normal    1.0 -> 1.0       44,770           44,770         590    4.2
   *     Rare      1.35 -> 1.0      60,440           44,770         590    4.2   (-25.9%)
   *     Epic      1.8 -> 1.0       80,590           44,770         590    4.2   (-44.4%)
   *     Legendary 2.45 -> 1.0     109,690           44,770         590    4.2   (-59.2%)
   *     Neon      3.3 -> 1.0      147,750           44,770         590    4.2   (-69.7%)
   *     Cyber     4.5 -> 1.0      201,460           44,770         590    4.2   (-77.8%)
   *
   * The COIN columns are exact arithmetic over this table. The matches column is a MEAN
   * over 12 seeds (sd 31) — see the note in `TROPHY_ROAD` about not sharpening it.
   *
   * Tier spread 156,690 coins (4.50x) -> **0 coins (1.00x)**. Whole roster 1,208,810 ->
   * **492,470** (-59.3%), i.e. ~191.6 h -> **~76.2 h** of play to max all eleven.
   *
   * ⚠️ **THE NORMAL PLAYER PAID NOTHING FOR THIS AND GAINS NOTHING FROM IT** — Normal was
   * the 1.0x tier, so its curve is byte-identical before and after. The entire effect is a
   * refund to players who own rarer characters, which is precisely the penalty §26 named.
   * Worth stating because "we cut levelling costs 59%" sounds like an economy-wide
   * loosening and is not one: the cheapest path through the game did not move at all.
   *
   * ⚠️ AND NOTHING ELSE IN THIS FILE READS THIS MAP. Verified by mutation rather than by
   * grep: setting the ladder back to 1.0->4.5 and re-fingerprinting every box price, box
   * odd, trophy-road reward, store product, duplicate value, match payout and starting
   * balance leaves all of them IDENTICAL, while `costToMax(Cyber)` does move to 201,460 —
   * so the probe is live, not inert. `levels.ts:levelUpCost` is the only consumer.
   *
   * ⚠️ Kept as a per-rarity map rather than collapsed to a constant, so restoring a ladder
   * is a value edit rather than a signature change — and so this comment stays attached to
   * the decision it explains.
   */
  rarityCostMultiplier: {
    Normal: 1.0,
    Rare: 1.0,
    Epic: 1.0,
    Legendary: 1.0,
    Neon: 1.0,
    Cyber: 1.0,
  } as Record<Rarity, number>,

  /** Prices are rounded to this, so they read as prices rather than as arithmetic. */
  roundTo: 10,
} as const;

/**
 * ── HOW LONG A MATCH ACTUALLY TAKES ─────────────────────────────────────────
 *
 * Every "hours to unlock" figure this project has ever quoted was computed from a
 * hardcoded **2 minutes per match** buried in `economy.test.mjs`, dating from when
 * `MATCH_DURATION_MS` was 180 s. It has been wrong ever since the clock moved, which is
 * why `DECISIONS §13`'s *"roughly 13 hours of play"* and this file's own *"~15 hours to
 * the full roster"* are both stale by a factor of four. The number lives here now, next to
 * everything else that decides pacing, so it can never again be a literal inside a test.
 *
 * ⚠️ TWO OF THESE THREE ARE MEASUREMENTS AND ONE IS AN ASSUMPTION. Stated separately on
 * purpose — Uri should know which numbers he can argue with.
 */
export const MATCH_PACING = {
  /**
   * MEASURED. Mean wall-clock from PLAY pressed to the winner being decided, including
   * the countdown, over 110 matchups x 8 seeds on the shipped arena
   * (`tools/tmp/roster_lab.mjs`, policy `smart2`). Countdown is 3.7 s of it.
   */
  sessionSeconds: 15.5,

  /**
   * ASSUMED, and the only number here that is not measured. Results screen, the walk back
   * to the lobby, and pressing Fight again. Nothing in this repo instruments a human
   * navigating a menu, so this is a placeholder that is labelled rather than hidden —
   * `DECISIONS §22` asks Uri for it.
   */
  menuSecondsPerMatch: 10,
} as const;

/** Total wall-clock a player spends per match, on the numbers above. */
export const SECONDS_PER_MATCH =
  MATCH_PACING.sessionSeconds + MATCH_PACING.menuSecondsPerMatch;

/**
 * ── WHO ELSE LEVELS UP: Uri answered it, and the answer shaped the code ─────
 *
 * *"The game eventually should be humans vs. humans. We will incorporate AI players to
 * enrich. They need to be adjusted to the player's level."*
 *
 * So `'mirror'`: the opponent is a stand-in for a human at the player's own investment, and
 * it carries the player's level. Two consequences, both deliberate:
 *
 *   * **The win-rate curve across 1->15 should be FLAT.** Uri set difficulty to 52.2% two
 *     hours ago; a level system that made the game easier as you invest would have quietly
 *     un-set it. This is a verification, not a design space — `tools/tmp/level_lab.mjs
 *     --winrate` measures it and a drift is a defect.
 *   * **Difficulty belongs in decision quality, not in stats.** A weaker opponent should
 *     think worse, not be made of paper. Nothing here gives the AI its own stat table.
 *
 * `'fixed'` is kept because it is the honest alternative and because measuring it is what
 * PROVES the mirror is doing something: at `'fixed'` the player's win rate climbs with
 * level, which is exactly the failure this constant exists to prevent.
 */
export type EnemyLevelMode = 'mirror' | 'fixed';
export const ENEMY_LEVEL_MODE: EnemyLevelMode = 'mirror';

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

/**
 * ── WHAT RARITY BUYS, STATED ONCE AND SHOWN TO THE PLAYER ───────────────────
 *
 * Since `rules.ts` DEVIATION #12, rarity does NOT make a fighter stronger at equal level
 * — that is Uri's *"match how common games do it"* answer, and the measured tier spread
 * is 4.0 pp, inside the ~9 pp the project treats as unresolvable. What rarity governs is
 * how hard a fighter is to OBTAIN: its position on the trophy road, and its odds in a box.
 * It no longer affects levelling cost at all (§26 flattened `LEVEL_UP.rarityCostMultiplier`
 * to 1.0 across every tier).
 *
 * This string is rendered on the drop-rate sheet, which is the one surface in the product
 * that is a legal disclosure — so the sentence that says what the player is actually
 * buying belongs there rather than in a comment nobody ships.
 *
 * ── ⚠️ THIS SENTENCE WAS FALSE FOR ONE COMMIT, ON A DISCLOSURE SURFACE ──────
 *
 * It read, until now:
 *
 *     'Rarity sets how hard a fighter is to find AND HOW MUCH IT COSTS TO LEVEL UP
 *      — not how strong it is. ...'
 *
 * True when written, and untrue the moment §26 flattened the multiplier — which is the
 * same commit that wrote *"It no longer affects levelling cost at all"* into the comment
 * three lines above it. **The constant and the prose documenting it contradicted each
 * other, adjacent, in one file.** That is the `DECISIONS §13` defect class exactly — a
 * number shown to the player that the model does not compute — and it is worse here than
 * elsewhere, because `shop.ts` and `trophyRoad.ts` both render this on the drop-rate sheet,
 * the one screen this product treats as a legal disclosure.
 *
 * The lesson is about BLAST RADIUS, not about wording: flattening a constant is never just
 * a constant. Every sentence that described what the constant did is now a claim to
 * re-verify, and a `Record` keyed by rarity is exactly the shape whose prose outlives it.
 * `economy.test.mjs` §13 now DERIVES this sentence's claims from `LEVEL_UP` rather than
 * reading them, so the string cannot outlive the value a second time.
 */
export const RARITY_MEANING =
  'Rarity sets how hard a fighter is to find — not how strong it is, and not what it costs '
  + 'to level up. Two fighters at the same level are a fair fight whatever their rarity.';

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
    // ⚠️ "with a chance of BETTER" is what this said until 2026-08-05, and it stopped
    // being true the moment Uri answered *"match how common games do it"*: rarity no
    // longer confers power at equal level (`rules.ts` DEVIATION #12 — measured tier
    // spread 20.7 pp -> 4.0 pp). A box that promises a stronger fighter and delivers a
    // rarer one is the `DECISIONS §13` defect wearing a different hat, so every blurb
    // below now says RARER, and the drop-rate sheet states what rarity buys instead.
    blurb: 'Mostly Normal fighters, with a chance of something rarer.',
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
 *   * `SECONDS_PER_MATCH` — see `MATCH_PACING`, which is where the wall clock now lives.
 *
 * Expected trophies per match at that win rate:
 *   * below 100 trophies (grace band):  0.6 x 15                = +9.0
 *   * around 300 trophies:              0.6 x 15 - 0.4 x 4      = +7.4
 *   * around 1,000:                     0.6 x 15 - 0.4 x 8      = +5.8
 *   * 1,350 and above (loss capped):    0.6 x 15 - 0.4 x 10     = +5.0
 *
 * ── ⚠️ EVERY WALL-CLOCK FIGURE THIS BLOCK USED TO QUOTE WAS WRONG BY ~4.7x ──
 *
 * The old text read "~2 minutes per match including menu time (`MATCH_DURATION_MS` is
 * 3:00...)" and derived: first character ~12 minutes, half the roster ~3.7 hours, full
 * roster ~440 matches / **~15 hours**, road complete ~600 matches / ~20 hours. The clock
 * has been **45 s** since the pacing sweep, and the measured session is **15.5 s**. So
 * "~15 hours" was never a measurement of this build, and `DECISIONS §13`'s *"roughly 13
 * hours of play"* inherited the same literal. Three of the four THRESHOLDS quoted were
 * wrong too — the first character is at 60 trophies, not 75, and half the roster is Water
 * Bottle at 725, not 850.
 *
 * Re-measured on the same seeded simulation (`economy.test.mjs` section 9 prints the live
 * figures, and the assertions there are in MATCHES precisely so a wall clock in another
 * file can never again go stale without a gate noticing):
 *
 *   * FIRST CHARACTER (Donut, 60 trophies) —   4 matches, ~1.7 min. One sitting.
 *   * HALF THE ROSTER (Water Bottle, 725)  —  94 matches, ~0.7 h.
 *   * FULL ROSTER (Hot Dog, 2,400)         — 394 matches, ~2.8 h.
 *   * ROAD COMPLETE (3,200)                — 636 matches, ~4.5 h.
 *
 * ~2.8 hours to the full roster is the number to argue with, and it is now SHORT rather
 * than long — deliberately shorter than any shipped brawler's (Brawl Stars is hundreds of
 * hours) because this game has 11 characters, not 90. **The long tail is no longer the
 * road at all: it is levelling** (`LEVEL_UP`).
 *
 * ⚠️ THE SECOND HALF OF THAT SENTENCE WAS STALE. It read *"...where maxing a single Normal
 * costs 44,770 coins — more than the entire road pays out — and A CYBER COSTS 201,460."*
 * The Cyber figure died with `LEVEL_UP.rarityCostMultiplier` (§26): every tier now costs
 * **44,770**, and 201,460 is a price nothing in this model charges.
 *
 * ⚠️ AND THE COINS ARE EXACT WHILE THE MATCHES ARE NOT — quote them differently.
 * `costToMax` is arithmetic over this file: 44,770 and 492,470 have NO seed dependence and
 * are asserted in `economy.test.mjs` §13. Turning either into *matches* runs a seeded
 * career, and that is a DISTRIBUTION. Over 12 seeds at the 60% win rate section 9 uses:
 *
 *   * MAX ONE CHARACTER (any rarity) — 44,770 coins · **590 matches mean, sd 31**
 *     (550-638) · ~4.2 h.
 *   * MAX THE WHOLE ROSTER (11 chars) — 492,470 coins · **10,751 matches mean, sd 27**
 *     (10,705-10,798) · ~76.2 h.
 *   * for scale, COMPLETING THE ROAD on the same runs — 577 matches mean, **sd 51**
 *     (457-638).
 *
 * ⚠️ Maxing one character and finishing the whole road are the SAME SIZE of commitment —
 * 590 vs 577 matches — but do not sharpen that past "the same size". The first draft of
 * this comment said they were equal *"to the match"* on the strength of both reading 636
 * at seed 20260804. They are equal at 8 of 12 seeds and 93 matches apart at another; the
 * road's own sd is 51. That is `CLAUDE.md` non-negotiable 10 in miniature — a single-seed
 * coincidence written up as a finding — caught here only because the greedy sim two
 * sections down runs a DIFFERENT seed and printed a different number.
 *
 * "More than the entire road pays out" SURVIVES the flattening and is worth stating
 * precisely, because it is the load-bearing claim: the road hands over **9,700** coins
 * directly, or **24,328** counting every chest, box and duplicate at expected value. One
 * maxed character is **4.6x** the former and **1.8x** the latter.
 *
 * (Before §26: a Cyber was 201,460 coins / 4,134 matches mean / ~29.3 h, and the roster
 * 1,208,810 / 27,048 / ~191.6 h. Flattening cut the roster's bill **59.3%** and cost the
 * Normal player nothing — Normal was the 1.0x tier already.)
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
