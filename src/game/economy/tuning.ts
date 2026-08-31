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
// ⚠️ `ITEMS` is the loadout registry, `rules.ts`'s own. It is imported rather than
// re-listed for the same reason `CHARACTERS_BY_RARITY` is derived: an item added there
// must reach the drop pools automatically, or the pools are a second roster that silently
// disagrees with the first.
import { ITEMS, type ItemId } from '../rules.ts';
// §76: the payout scalars below are read through the override layer so the admin panel's
// Economy tab has something real in it. Same rule as `rules.ts` — the literal stays on its
// line and the registry LEARNS the default; there is no table of economy numbers anywhere.
import { tune } from '../tuningRegistry.ts';

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
 * negative). This game WAS 1v1, so there was no middle: `stepMatch` reported a winner
 * and nothing else. The mapping is therefore win = the prototype's 1st place, loss =
 * the prototype's last place, with its exact scaling formula preserved.
 *
 * ⚠️ **THE SIM NOW SEATS SIX** (`state.ts:MAX_FIGHTERS`), so "there is no middle" stopped
 * being true. See `placementSteepness` below and `trophyRoad.ts:placementCurve` for the
 * 3-to-6-seat curve, which is built FROM the two numbers here rather than beside them.
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
  trophiesWin: tune('MATCH_PAYOUT.trophiesWin', 15, {
    group: 'economy', unit: 'trophies', min: 0, max: 200, int: true,
    doc: 'Trophies for first place. The whole placement curve is stated relative to this — see the placement block below.',
  }),

  /** (prototype) Loss = min(cap, base + floor(trophies / per)). */
  trophyLossBase: tune('MATCH_PAYOUT.trophyLossBase', 2, {
    group: 'economy', unit: 'trophies', min: 0, max: 100, int: true,
    doc: 'Flat part of a loss. Loss = min(cap, base + floor(trophies / per)).',
  }),
  trophyLossPer: tune('MATCH_PAYOUT.trophyLossPer', 150, {
    group: 'economy', unit: 'trophies', min: 1, max: 10_000, int: true,
    doc: 'Trophies per extra point of loss — the escalation rate. A DIVISOR: smaller is harsher.',
  }),
  trophyLossCap: tune('MATCH_PAYOUT.trophyLossCap', 10, {
    group: 'economy', unit: 'trophies', min: 0, max: 200, int: true,
    doc: 'Ceiling on a single loss, however many trophies are held.',
  }),
  /** MINE. No trophy loss at all below this. See above. */
  trophyLossGraceBelow: tune('MATCH_PAYOUT.trophyLossGraceBelow', 100, {
    group: 'economy', unit: 'trophies', min: 0, max: 10_000, int: true,
    doc: 'Below this standing a loss costs nothing — the first hour must not read as standing still.',
  }),

  /**
   * MINE. Coins are the participation reward: you always get some, and winning is
   * worth 3x losing. A 3:1 ratio is enough for winning to feel better without making
   * a losing streak feel like a waste of ten minutes.
   */
  coinsWin: tune('MATCH_PAYOUT.coinsWin', 60, {
    group: 'economy', unit: 'coins', min: 0, max: 10_000, int: true,
    doc: 'Coins for a win. The 3:1 ratio against coinsLoss is the design statement, not either number alone.',
  }),
  coinsLoss: tune('MATCH_PAYOUT.coinsLoss', 20, {
    group: 'economy', unit: 'coins', min: 0, max: 10_000, int: true,
    doc: 'Coins for a loss. Always non-zero: a losing streak must not feel like a waste of ten minutes.',
  }),

  /**
   * MINE. Wins per free chest. The prototype's shop says outright: "Chests aren't
   * sold here - you get those for winning a game!" — so wins are the chest faucet.
   * Every win is too many (a chest becomes wallpaper); the trophy road alone is too
   * few (five chests across the entire road). Three wins is roughly one chest every
   * 8-10 minutes of play at the assumed win rate.
   */
  winsPerChest: 3,

  /**
   * ── THE 3-TO-6-SEAT PLACEMENT CURVE, AS ONE NUMBER ──────────────────────────
   *
   * `DECISIONS §57` asked what a 3-6 player match pays, and parked it with a stated safe
   * default: *"a curve that preserves today's expected value at N=2 exactly and interpolates
   * upward, so nothing already tuned moves. That is reversible; a generous curve shipped and
   * then cut is not."* This constant is that default, and it is the ONLY dial in it.
   *
   * ── HOW THE CURVE IS INDEXED, AND WHY IT IS NOT BY PLACE ────────────────────
   *
   * Everything is a function of the NORMALISED rank `r = place / (seats - 1)`, not of `place`.
   * §57's own third question is why: *"3rd of 4 is the bottom half and 3rd of 6 is the top
   * half. A curve indexed on raw placement gets this wrong."* On `r`, 3rd of 6 is r = 0.40
   * (top half, **+5 trophies**) and 3rd of 4 is r = 0.67 (bottom half, **-2 trophies**). A
   * raw-place table would pay them the same and be wrong at one of the two seat counts.
   *
   * `r` is 0 for first and 1 for last **at every seat count**, so:
   *
   *   trophies = trophiesWin - w(r) * (trophiesWin + trophyLoss(standing))
   *   coins    = coinsWin    - w(r) * (coinsWin    - coinsLoss)
   *   chest    = a win is banked iff r < 0.5
   *
   * where `w` is `trophyRoad.ts:placementWeight01` — this exponent, with the two ENDPOINTS
   * PINNED STRUCTURALLY rather than arithmetically (`r <= 0` returns 0, `r >= 1` returns 1,
   * before any `Math.pow` runs).
   *
   * ── ⚠️ WHAT THAT PINNING BUYS, AND IT IS THE LOAD-BEARING PROPERTY ──────────
   *
   * **At two seats `r` is only ever 0 or 1**, so the two seats take the two endpoints and
   * **N=2 is byte-identical to the shipped two-outcome payout — for ANY value of this
   * constant, including 0 and Infinity.** The steepness dial cannot reach the 1v1 game. That
   * is asserted directly (`economy.test.mjs` section 3b drives w() at 0, 0.6, 1, 1.6, 8 and
   * Infinity), and it is why answering §57 with a different number is a one-value edit that
   * needs no re-verification of the shipped economy.
   *
   * ── 1.0 IS LINEAR, AND LINEAR WAS CHOSEN BY MEASUREMENT ─────────────────────
   *
   * The reason to prefer linear over any other shape is not taste. Measured with
   * `tools/tmp/pc_lab.mjs` over a Plackett-Luce field calibrated to the 60% win rate the
   * pacing section already simulates (player weight 1.5 against N-1 opponents at 1.0), the
   * expected payout **per match** is flat in the seat count:
   *
   *     seats        2       3       4       5       6      (400k placements each)
   *     trophies   4.99    5.17    5.02    5.12    5.01     (shipped 1v1 EV: 5.00)
   *     coins     43.98   43.99   44.02   43.99   44.01     (shipped 1v1 EV: 44.0)
   *
   * That is the constraint §57 warned about — *"the trophy road and the store are both tuned
   * against the current two-outcome payout"* — discharged rather than argued: **the road's
   * pacing does not move when the seat count does.** The residual +-0.17 trophies is integer
   * rounding at odd seat counts and nothing else; it is exactly 0 at 2, 4 and 6.
   *
   * A steeper or flatter exponent breaks that flatness on purpose, and that is the trade Uri
   * is choosing. At six seats above the grace band (loss capped at 10):
   *
   *     k     1st  2nd  3rd  4th  5th  6th   gain / hold / lose   per match   vs shipped
   *     0.6   +15   +5   +1   -3   -7  -10   1,2,3 / -- / 4,5,6      0.17        -93%   harsh
   *     1.0   +15  +10   +5    0   -5  -10   1,2,3 /  4 / 5,6        2.50          0%   SHIPPED
   *     1.6   +15  +13   +9   +4   -2  -10   1,2,3,4 / -- / 5,6      4.83        +93%   friendly
   *
   * ⚠️ **The three-way split is the decision, not a "break-even place".** An earlier draft of
   * this table quoted one — and named the first LOSING seat, which is a different seat from the
   * neutral one exactly when the curve passes through zero, as the shipped one does at 4th of
   * six. Three groups instead: who leaves with more, who leaves level, who leaves with less.
   *
   * ⚠️ Only the middle row leaves the tuned economy where it is. Measured over 12 seeded careers
   * (`pc_lab --compare`), road completion runs **594 matches at two seats → 576 at six** on
   * k=1.0, inside the ±121 the two-seat arm's own spread allows; **1084 on k=0.6** and **404 on
   * k=1.6**, both far outside. **1.6 nearly doubles trophy income at six seats**, and a road
   * that pays out twice as fast cannot be slowed later without taking something away. That
   * asymmetry is the whole reason the conservative row is the default.
   *
   * The coin swing is far smaller than the trophy swing and is worth knowing before arguing
   * about steepness: mean coins per six-seat match are **36.3 / 40.0 / 43.7** across the three,
   * i.e. ±9% against the trophy column's ±93%.
   *
   * ── WHAT LAST PLACE GETS, WHICH §57 ASKED SEPARATELY ────────────────────────
   *
   * **Exactly what losing a 1v1 costs today, and nothing new was invented.** Last place is
   * `r = 1`, so it takes the shipped loss term verbatim: **zero** below `trophyLossGraceBelow`
   * (a new player still cannot go backwards at six seats), rising to `trophyLossCap`. Coins
   * are floored at `coinsLoss` by the same endpoint pinning, so **every finisher at every seat
   * count is paid coins** — the participation rule this table already states, unchanged.
   */
  placementSteepness: 1.0,
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
   * (`tools/tmp/roster_lab.mjs --policies smart2`, `meanSessionMs`). Countdown is 3.7 s.
   *
   * ── ⚠️ WAS `15.5`, AND THE OLD VALUE IS KEPT HERE BECAUSE OF *WHY* IT WENT STALE ──
   *
   * Re-measured 2026-08-12: **25 718.7 ms**, 880 matches, same tool, same policy, same
   * seed formula, on `tools/arena.gameplay.json` with the shipped opening ring. That is
   * **+65.9%**, and it moves every wall-clock figure derived from `SECONDS_PER_MATCH`.
   *
   * 🚨 **THE OBVIOUS CULPRIT IS NOT THE CULPRIT, AND THAT IS THE POINT.** This was
   * re-measured because `6d5c4d6` took `MATCH_DURATION_MS` from 45 s to 150 s, so the
   * expectation was that a 3.3x longer clock is what moved it. It is not. Three arms,
   * 880 matches each, identical seeds:
   *
   *     pre-6d5c4d6 sim (45 s clock, 1985 wu ring)   25 564.4 ms
   *     HEAD, ring 1792 (the superseded derivation)  25 712.4 ms   +148.0 ms  (+0.58%)
   *     HEAD, ring 1720.4650534085254 (shipped)      25 718.7 ms   +  6.3 ms  (+0.02%)
   *
   * **The clock change is worth +0.15 s and the fog schedule +0.006 s. The other +10.1 s
   * was already there and had been for some time** — matches end on a knockout at ~22 s of
   * play, so the ring's timetable barely touches them (`sr_ringfloor.mjs`: 0 of 880 duels
   * reach even the START of sudden death; zone damage is 0.1 HP per match). The staleness
   * is the accumulated balance work — the `range`/`REACH` retirement, the reach fix's
   * payback, the ability-weapon join — none of which anyone thought of as a pacing change.
   * ⚠️ So do NOT attribute this number to the clock in any downstream write-up, and do not
   * assume the next clock change moves it either.
   *
   * ⚠️ RESOLUTION: this is a mean over 880 seeded matches and the three arms above are
   * PAIRED on identical seeds, so the deltas between them are exact for this corpus. The
   * quantity that has a floor is the comparison to `15.5`, which was measured on a
   * different tree with a different roster — +10.2 s is 69x the largest paired delta here,
   * so the direction is not in question even though the exact old-vs-new attribution is.
   */
  sessionSeconds: 25.7,

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
  /**
   * Grants a uniformly-random LOADOUT ITEM of this rarity (duplicate → coins).
   *
   * The same shape as `characterRarity` and deliberately so: one roller, one odds
   * derivation, one duplicate ladder. See "ITEMS — the acquisition side" at the foot of
   * this file for the design, and `ITEMS_BY_RARITY` for the pool each tier draws from.
   *
   * ⚠️ **THIS IS THE SAME LEGAL INTERFACE the paragraph above describes.** An item is
   * randomised content inside a container that gems can buy, so its rate is disclosed on
   * exactly the same sheet by exactly the same function. There is no second table.
   */
  itemRarity?: Rarity;
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
   *
   * ── 2026-08-31: THE CHEST IS THE FREE ITEM FAUCET, AND IT STOPS AT LEGENDARY ──
   * 5% of the table is now an item, taken out of the two plain-coin rows (50 → 46 and
   * 22 → 21) so nothing else moved. The chest is the highest-VOLUME container in the
   * game — one every `winsPerChest` wins, forever, for free — so it is the right place
   * for the common half of the item set and the wrong place for the rare half.
   * **There is no Neon or Cyber item row here**, which is what keeps Uri's *"zombie
   * power is the rarest"* true against a faucet that never turns off: Leftovers and the
   * Shiitake Shield come from the boxes and from the road's late surprise nodes, both
   * of which are bounded.
   */
  chest: {
    name: 'Chest',
    emoji: '📦',
    blurb: 'Earned by winning matches and along the Trophy Road.',
    price: null,
    entries: [
      { weight: 46, coins: 120 },
      { weight: 21, coins: 220 },
      { weight: 13, coins: 90, gems: 5 },
      { weight: 8, coins: 400 },
      { weight: 4, coins: 150, gems: 20 },
      { weight: 2.1, characterRarity: 'Normal' },
      { weight: 0.9, characterRarity: 'Rare' },
      { weight: 3, itemRarity: 'Normal' },
      { weight: 1.4, itemRarity: 'Rare' },
      { weight: 0.5, itemRarity: 'Epic' },
      { weight: 0.1, itemRarity: 'Legendary' },
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
    blurb: 'Mostly Normal fighters and gear, with a chance of something rarer.',
    price: { coins: 900, gems: 60 },
    entries: [
      { weight: 71.2, characterRarity: 'Normal' },
      { weight: 8, characterRarity: 'Rare' },
      { weight: 0.8, characterRarity: 'Epic' },
      { weight: 16, itemRarity: 'Normal' },
      { weight: 3.6, itemRarity: 'Rare' },
      { weight: 0.4, itemRarity: 'Epic' },
    ],
  },

  pineappleBox: {
    name: 'Purple Pineapple Box',
    emoji: '🍍',
    blurb: 'Rare fighters and gear, Epic and Legendary possible.',
    price: { coins: 3200, gems: 120 },
    entries: [
      { weight: 75.6, characterRarity: 'Rare' },
      { weight: 4, characterRarity: 'Epic' },
      { weight: 0.4, characterRarity: 'Legendary' },
      { weight: 16, itemRarity: 'Rare' },
      { weight: 3.6, itemRarity: 'Epic' },
      { weight: 0.4, itemRarity: 'Legendary' },
    ],
  },

  redBox: {
    name: 'Big Smile Box',
    emoji: '🎁',
    blurb: 'Epic fighters and gear, with the only Cyber chance outside the Fire Box.',
    price: { coins: 5600, gems: 240 },
    entries: [
      { weight: 71.59, characterRarity: 'Epic' },
      { weight: 8, characterRarity: 'Legendary' },
      { weight: 0.4, characterRarity: 'Neon' },
      // ⚠️ 0.01 IS LOAD-BEARING AND IS THE ONE CHARACTER WEIGHT THAT DID NOT MOVE when
      // the item rows landed. `economy.test.mjs` §5 pins it as the proof that
      // `formatPercent` never rounds a real chance away to "0.0%" on a disclosure
      // surface. The 20% the item rows cost was taken from the three rows above it.
      { weight: 0.01, characterRarity: 'Cyber' },
      { weight: 16, itemRarity: 'Epic' },
      { weight: 3.5, itemRarity: 'Legendary' },
      { weight: 0.4, itemRarity: 'Neon' },
      { weight: 0.1, itemRarity: 'Cyber' },
    ],
  },

  fireBox: {
    name: 'Purple Fire Box',
    emoji: '🔥',
    blurb: 'Legendary fighters and gear, with the best Neon and Cyber odds in the game.',
    price: { coins: 12000, gems: 480 },
    entries: [
      { weight: 75.6, characterRarity: 'Legendary' },
      { weight: 4, characterRarity: 'Neon' },
      { weight: 0.4, characterRarity: 'Cyber' },
      { weight: 16, itemRarity: 'Legendary' },
      { weight: 3.5, itemRarity: 'Neon' },
      // The best Cyber ITEM odds in the game, which is what keeps the blurb above true
      // for both halves of what this box now contains. 0.5% here against 0.1% in the
      // Big Smile Box, and nothing at all in the free chest.
      { weight: 0.5, itemRarity: 'Cyber' },
    ],
  },
};

/*
 * ── ⚠️ WHAT THE ITEM ROWS COST THE FIGHTER ODDS, STATED ONCE ────────────────
 *
 * Every box gave up exactly **20%** of its table to items, and the character rows were
 * scaled by 0.8 rather than re-authored — so each box's INTERNAL rarity split is
 * untouched (89:10:1 became 71.2:8:0.8, and so on) and only the fighter/item split is
 * new. The one exception is the Big Smile Box's Cyber fighter row, held at 0.01 for the
 * reason stated on it; its 20% came from the three rows above instead.
 *
 * The free chest gave up **5%**, taken from its two plain-coin rows, because it is the
 * only container that arrives forever and for free.
 *
 * ⚠️ AND THE CONSEQUENCE THE SHOP SCREEN WILL FEEL: `shop.ts:sellable()` offers a box
 * when it *"can hand over something the player does not own"*. Until today that could
 * only ever be a fighter, and `ROSTER_GATED` is false, so it was never true and every
 * Buy button was dead. Items are NOT roster-gated — a new player owns one of ten — so
 * the boxes now have a genuine first-copy to sell and the shop comes alive on its own.
 * That is the derived predicate working exactly as its author documented, not a new
 * decision, and the purchase path it enables (`state.ts:buyContainer`) has been built
 * and tested since the economy landed.
 */

// ─────────────────────────────────────────────────────────────────────────────
// The trophy road
// ─────────────────────────────────────────────────────────────────────────────

export type MilestoneReward =
  | { type: 'coins'; amount: number }
  | { type: 'gems'; amount: number }
  | { type: 'container'; kind: ContainerKind; count: number }
  | { type: 'character'; id: CharacterId }
  /**
   * A LOADOUT ITEM the player cannot see in advance. Uri: *"and in trophy road (as a
   * surprise, not a fixed item)"*.
   *
   * `minRarity` is a FLOOR on the pool, not the item — the node still cannot be read off
   * the table, which is the whole instruction, but the road can get rarer as it goes and
   * the last surprise can guarantee something worth walking 9,145 trophies for. A tier
   * banded at `Neon` draws from {Shiitake Shield, Leftovers} and nothing else.
   *
   * ⚠️ It carries NO item id on purpose. Which item it resolves to is a function of the
   * player's persisted seed and this threshold — see `trophyRoad.ts:roadSurpriseItem`.
   */
  | { type: 'itemSurprise'; minRarity: Rarity }
  | { type: 'bundle'; parts: MilestoneReward[] };

export interface Milestone {
  /** Trophies required. Strictly ascending, and the identity used for "claimed". */
  trophies: number;
  reward: MilestoneReward;
}

/**
 * WHERE THE ROSTER COMPLETES. Uri, 2026-08-24, verbatim:
 *
 *   *"Change the trophy road to distribute the characters across 10,000 trophies. When
 *   you reach 10,000 you will have all of them. Add more steps and stretch the distance
 *   between steps a bit."*
 *
 * This is that number, exported rather than typed into the table twice, because a
 * retyped literal is invisible to every legality check — a wrong threshold is still a
 * legal threshold, exactly like `CLAUDE.md`'s stale map coordinates. `TROPHY_ROAD`'s
 * last entry IS this constant, `economy.test.mjs` §4b asserts the identity, and
 * `tools/tmp/tr_road_probe.mjs` measures against it.
 */
export const ROSTER_COMPLETE_TROPHIES = 10_000;

/**
 * ── 2026-08-24: THE ROAD NOW RUNS TO 10,000 AND THE LAST CHEF IS THE LAST NODE ──
 *
 * Uri asked for four things and all four are measurable, so all four are measured
 * (`tools/tmp/tr_road_probe.mjs`, and `--selftest`'s ten known-bad arms are what make
 * the measurements worth quoting):
 *
 *   | he asked for            | before      | after       |
 *   |-------------------------|-------------|-------------|
 *   | characters by 10,000    | last @2,400 | last @10,000 (= the road end) |
 *   | MORE steps              | 34          | **45**      |
 *   | STRETCHED gaps          | min 10 · median 70 · mean 94.1  | min 30 · median 220 · mean 222.2 |
 *
 * The gap figures are quoted as all three because a mean alone cannot tell "every gap
 * got wider" from "one enormous tail gap dragged the average up" — here the min tripled
 * and the median more than tripled, so it is genuinely the whole road that stretched.
 * The step gaps are also **non-decreasing for the first time**: the old road stepped
 * 25 then 22, so it briefly sped up.
 *
 * 🚨 **AND THE THING URI HAS TO DECIDE IS THE WALL CLOCK, WHICH MOVED ×4.8.**
 * Not one payout changed — `MATCH_PAYOUT` is untouched — so a ×3.13 longer road is a
 * ×4.8 longer grind, because the trophy loss escalates with standing and the top of the
 * road is spent at the +15/−10 cap where a 60% player nets **5.0 trophies a match**:
 *
 *   * FULL ROSTER — **394 → 1,891 matches**, ~3.9 h → **~18.8 h** at 35.7 s a match.
 *   * FIRST CHARACTER — 4 → **8 matches** (~2.4 → ~4.8 min). Still one sitting.
 *   * HALF THE ROSTER — 94 → **296 matches**, ~0.9 → **~2.9 h**.
 *
 * ⚠️ **This block used to argue the OPPOSITE and the old wording is kept because it is
 * still the argument against what just shipped**: *"~3.9 hours to the full roster is
 * the number to argue with, and it is now SHORT rather than long — deliberately shorter
 * than any shipped brawler's (Brawl Stars is hundreds of hours) because this game has 11
 * characters, not 90."* 18.8 h is no longer short. Whether that is right is Uri's call
 * and nothing else in this file assumes an answer.
 * → **If 18.8 h is too long, the dial is `MATCH_PAYOUT.trophiesWin`, not the road.**
 * It is the only term in the 5.0/match figure that is not a loss cap, and moving it
 * rescales the whole clock without disturbing a single threshold, the ordering, the
 * rarity ladder or the reward mix.
 *
 * ── WHERE THE BUNDLE WENT ───────────────────────────────────────────────────
 * The capstone bundle used to be the road's LAST node. It is now second-to-last, at
 * 9,565, because "when you reach 10,000 you will have all of them" reads best when the
 * node AT 10,000 is the final chef — the roster completing is the climax, and a
 * "Grand Prize" sitting after it would upstage it. Two thresholds cannot share a value,
 * so one of the two had to move and the character won.
 * ⚠️ The alternative was folding the character INTO the bundle at 10,000. It was
 * rejected on cost, not taste: `milestoneFace`, the node renderer and §9's pacing sim
 * all match on `reward.type === 'character'`, and a character hidden inside a bundle is
 * invisible to every one of them — a pacing sim that measures nine characters and calls
 * it ten. `tr_road_probe.mjs` arm I plants exactly that bug to keep the option honest if
 * anyone takes it later.
 *
 * ── The curve, and the arithmetic behind it ─────────────────────────────────
 *
 * The prototype's road runs to 25,000 trophies. At its own +15 a win that is ~1,670
 * wins BEFORE counting losses, and it unlocks only 6 of the 11 characters. Uri's
 * constraint is the opposite: a first unlock inside one sitting, and no implication
 * of hundreds of hours to see the roster. So the road was rebuilt, not rescaled.
 *
 * ⚠️ **THE PARAGRAPH ABOVE IS NOW HALF-TRUE AND IS KEPT FOR THE HALF THAT SURVIVES.**
 * "A first unlock inside one sitting" survives exactly (8 matches). "No implication of
 * hundreds of hours" survives (18.8 h is not hundreds). What does NOT survive is the
 * implied contrast with the prototype's LENGTH: at 10,000 trophies and +15 a win this
 * road is now the same *kind* of object the prototype was, and the thing that still
 * separates them is that **all ten unlockable chefs are on it** where the prototype
 * placed six and left five to a paid shop.
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
 * ── ⚠️ THOSE FOUR HOUR FIGURES ARE THE `15.5 s` SESSION AND ARE KEPT AS THE RECORD ──
 *
 * `MATCH_PACING.sessionSeconds` was re-measured on 2026-08-12 at **25.7 s** (see its
 * comment — and note that the 45 s → 150 s clock accounts for 0.15 s of the 10.2 s move,
 * so this is NOT "the clock got longer"). `SECONDS_PER_MATCH` goes 25.5 → **35.7 s**, a
 * flat **×1.400** on every wall clock below. **The MATCH counts are unchanged** — they are
 * what this model computes, and `economy.test.mjs` §9's assertions are in matches for
 * exactly this reason, which is why nothing went red:
 *
 *   * FIRST CHARACTER (Donut, 60 trophies) —   4 matches, **~2.4 min**. Still one sitting.
 *   * HALF THE ROSTER (Water Bottle, 725)  —  94 matches, **~0.9 h**.
 *   * FULL ROSTER (Hot Dog, 2,400)         — 394 matches, **~3.9 h**.
 *   * ROAD COMPLETE (3,200)                — 636 matches, **~6.3 h**.
 *
 * ~3.9 hours to the full roster is the number to argue with, and it is now SHORT rather
 * than long — deliberately shorter than any shipped brawler's (Brawl Stars is hundreds of
 * hours) because this game has 11 characters, not 90. **The long tail is no longer the
 * road at all: it is levelling** (`LEVEL_UP`).
 *
 * ── ⚠️ AND THE FOUR LINES ABOVE ARE THE **3,200-TROPHY** ROAD. ALL FOUR MOVED. ──
 *
 * Kept per house style, because the pair is the record of what Uri's 10,000 instruction
 * actually cost. Re-measured 2026-08-24 on the same seeded model, same
 * `SECONDS_PER_MATCH` = 35.7 s, so every difference below is the ROAD and nothing else:
 *
 *   * FIRST CHARACTER (Donut, **100** trophies) —    **8** matches, ~4.8 min. One sitting.
 *   * HALF THE ROSTER (Water Bottle, **1,950**) —  **296** matches, **~2.9 h**.
 *   * FULL ROSTER (Hot Dog, **10,000**)         — **1,891** matches, **~18.8 h**.
 *   * ROAD COMPLETE (**10,000**)                — **1,891** matches, **~18.8 h**.
 *
 * ⚠️ **FULL ROSTER AND ROAD COMPLETE ARE NOW THE SAME NUMBER, AND THAT IS STRUCTURAL,
 * NOT A COINCIDENCE TO BE READ INTO.** The last chef IS the last node, so the two events
 * are the same event. They were 394 and 636 before because three reward nodes sat past
 * the final character. Anyone quoting them as two independent corroborating figures is
 * quoting one figure twice.
 *
 * ⚠️ **DONUT MOVED 60 → 100 AND IT WAS FORCED, NOT CHOSEN.** §9 asserts the character
 * gaps never shrink and never more than **1.6×** the one before. With ten gaps summing to
 * 10,000, the biggest reachable total from a 60-trophy first gap is 60 × Σ1.6ⁱ = **10,895**
 * — so 10,000 is reachable from 60 only by pinning almost every ratio at the 1.6 ceiling,
 * which turns the guard into a tautology and buys a 3,700-trophy final gap. At 100 the
 * curve closes at a max ratio of **1.556** with real margin. The first unlock costs four
 * more minutes; the alternative was a guard that could no longer fail.
 *
 * 💰 **AND THIS IS THE HALF OF URI'S PENDING EARN-RATE DECISION THAT IS NOW CONCRETE.**
 * The question parked for him is whether the earn rate falling is acceptable. It has two
 * independent halves and they must not be added together:
 *   * **trophies/coins per match** — unchanged by any of this. Not one payout moved.
 *   * **matches per hour** — 141.2 → **100.8**, because a session is 10.2 s longer.
 * So the *only* thing that changed is that the same content takes **1.4× the wall clock**.
 * Nothing about the road, the payouts or the level ladder needs to move to restore it;
 * either the session gets shorter or the hour figures stand.
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
 *     (550-638) · ~4.2 h → **~5.9 h** at the re-measured 25.7 s session.
 *   * MAX THE WHOLE ROSTER (11 chars) — 492,470 coins · **10,751 matches mean, sd 27**
 *     (10,705-10,798) · ~76.2 h → **~106.6 h**.
 *   * for scale, COMPLETING THE ROAD on the same runs — 577 matches mean, **sd 51**
 *     (457-638) · **~5.7 h**.
 *   ⚠️ The MATCH figures are the measurement and the hours are `matches × SECONDS_PER_MATCH`
 *   — kept in that order deliberately, because the hours are the half that goes stale.
 *
 * ⚠️ Maxing one character and finishing the whole road are the SAME SIZE of commitment —
 * 590 vs 577 matches — but do not sharpen that past "the same size". The first draft of
 * this comment said they were equal *"to the match"* on the strength of both reading 636
 * at seed 20260804. They are equal at 8 of 12 seeds and 93 matches apart at another; the
 * road's own sd is 51. That is `CLAUDE.md` non-negotiable 10 in miniature — a single-seed
 * coincidence written up as a finding — caught here only because the greedy sim two
 * sections down runs a DIFFERENT seed and printed a different number.
 *
 * 🚨 **THE 10,000 ROAD REVERSES THAT PAIRING OUTRIGHT — THE ROAD IS NOW THE BIGGER
 * PROJECT, BY 2.5×.** Kept above because "they are the same size" was true and is the
 * clearest statement of what changed. Measured on the greedy career in
 * `economy.test.mjs` §13 (seed 20260805): **road complete 1,747 matches · Lv15 on the
 * starter at 709**. The assertion there has been reversed with its old wording kept.
 * ⚠️ And re-derive the run-to-run spread before comparing across the two roads: **sd is
 * roughly proportional to career length**, so the old road's sd 51 does not describe
 * this one. Measured with a matched instrument over 40 seeds
 * (`tr_road_probe.mjs --seatnull 40`): old road **mean 580.5, sd 43.3 (cv 7.45%)**;
 * this road **mean 1,923.0, sd 102.0 (cv 5.30%)**.
 *
 * "More than the entire road pays out" SURVIVES the flattening and is worth stating
 * precisely, because it is the load-bearing claim: the road hands over **9,700** coins
 * directly, or **24,328** counting every chest, box and duplicate at expected value. One
 * maxed character is **4.6x** the former and **1.8x** the latter.
 *
 * ⚠️ **ON THE 10,000 ROAD THAT CLAIM IS STILL TRUE AND IS NOW TRUE BY 2.7%.** Re-derived
 * by `tr_road_probe.mjs --payout`, which reproduces all four numbers above exactly on the
 * old table before being trusted on the new one: direct **26,900** coins, **43,571**
 * counting chests, boxes and duplicates. One maxed character is **1.66x** the former and
 * **1.03x** the latter.
 * → **This is a scale artefact, not a regression, and the distinction matters.** Not one
 * payout RATE moved. The road is ×3.13 longer so it pays ×2.77 more, while `costToMax`
 * is a fixed 44,770 that does not know the road exists. The invariant that actually
 * carries the design — *the road is a bonus, not the coin faucet* — is unchanged: road
 * coins are **32%** of what the same career earns from matches (26,900 against
 * 1,891 × 44), where they were **35%** (9,700 against 636 × 44).
 * → But at 1.03x the HEADLINE has nearly no margin left, and one more road-lengthening
 * or one cut to `LEVEL_UP` would invert it. **If it inverts, levelling stops being the
 * long tail** — which is the sentence four paragraphs up. Flagged for Uri rather than
 * pre-emptively retuned, because the fix is a payout decision and he did not ask for one.
 *
 * (Before §26: a Cyber was 201,460 coins / 4,134 matches mean / ~29.3 h, and the roster
 * 1,208,810 / 27,048 / ~191.6 h. Flattening cut the roster's bill **59.3%** and cost the
 * Normal player nothing — Normal was the 1.0x tier already.)
 *
 * ── 2026-08-31: SEVEN SURPRISE ITEMS, AND NOT ONE NUMBER ON THIS ROAD MOVED ──
 *
 * Uri: *"Items can be obtained through boxes/chests and in trophy road (as a surprise,
 * not a fixed item)"*. Seven nodes now pay a `itemSurprise` **in addition to** what they
 * already paid, wrapped in the `bundle` type that already existed.
 *
 * 🚨 **ADDITIVE WAS A DELIBERATE CHOICE AND IT IS THE REASON THE 10,000 ROAD SURVIVES
 * INTACT.** The two alternatives were both destructive and both were rejected on
 * measurement, not taste:
 *   * **New nodes.** Inserting seven thresholds SHRINKS gaps, and `economy.test.mjs`
 *     §4b asserts *"step gaps never shrink along the road"* — the assertion `2228c2b`
 *     added to protect Uri's own *"stretch the distance between steps"*. Seven inserted
 *     nodes falsify it by construction.
 *   * **Replacing seven payouts.** The seven cheapest coin/gem nodes are 5+10+120+150
 *     gems and 700+1,800+3,000 coins. Taking them out cuts road gems **39%** and road
 *     coins **20%**, on a road whose grind Uri is already being asked to rule on.
 *
 * So: same 45 steps, same thresholds, same gaps, same character positions, same road
 * end, same **26,900** direct coins, same **800** gems. **Time to the full roster is
 * unchanged and it is unchanged BY CONSTRUCTION, not by luck** — not one trophy
 * threshold and not one trophy payout was touched, and `MATCH_PAYOUT` was not opened.
 * §9's pacing figures (8 matches / 296 / 1,891) are therefore the same figures.
 *
 * The bands rise along the road — Normal · Normal · Rare · Rare · Epic · Legendary ·
 * **Neon** — so the last one draws from a two-item pool and finishing the road
 * guarantees a Neon-or-better item. `minRarity` is a floor on the POOL, never an item
 * id: the node is genuinely unreadable in advance, which is the instruction.
 *
 * ⚠️ **AND THE ROAD IS NOW WORTH MORE THAN THE COMMENTARY ABOVE STATES.** Every
 * *"the road hands over 26,900 coins directly, or 43,571 counting every chest, box and
 * duplicate"* figure above is a CURRENCY figure and all of them still hold exactly.
 * What they no longer describe is the road's total value, because seven of its nodes now
 * hand over something that is not currency at all. Do not add an item to those sums; it
 * is not denominated in coins unless the pool is exhausted, and then it is a duplicate.
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
  // ── to the first chef ──────────────────────────────────────── gaps 30·35·35 ──
  { trophies: 30, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 65, reward: { type: 'coins', amount: 150 } },
  { trophies: 100, reward: { type: 'character', id: 'donut' } },           // Normal
  // ── 45·50·55 ────────────────────────────────────────────────────────────────
  { trophies: 145, reward: { type: 'bundle', parts: [
    { type: 'gems', amount: 5 },
    { type: 'itemSurprise', minRarity: 'Normal' },
  ] } },
  { trophies: 195, reward: { type: 'container', kind: 'hamburgerBox', count: 1 } },
  { trophies: 250, reward: { type: 'character', id: 'taco' } },            // Rare
  // ── 65·75·90 ────────────────────────────────────────────────────────────────
  { trophies: 315, reward: { type: 'coins', amount: 250 } },
  { trophies: 390, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 480, reward: { type: 'character', id: 'burrito' } },         // Rare
  // ── 95·110·115 ──────────────────────────────────────────────────────────────
  { trophies: 575, reward: { type: 'bundle', parts: [
    { type: 'gems', amount: 10 },
    { type: 'itemSurprise', minRarity: 'Normal' },
  ] } },
  { trophies: 685, reward: { type: 'container', kind: 'hamburgerBox', count: 1 } },
  { trophies: 800, reward: { type: 'character', id: 'soup' } },            // Epic
  // ── 140·150·160 ─────────────────────────────────────────────────────────────
  { trophies: 940, reward: { type: 'coins', amount: 400 } },
  { trophies: 1090, reward: { type: 'container', kind: 'pineappleBox', count: 1 } },
  { trophies: 1250, reward: { type: 'character', id: 'sushi' } },          // Legendary
  // ── 170·175·175·180 ─────────────────────────────────────────────────────────
  { trophies: 1420, reward: { type: 'gems', amount: 20 } },
  { trophies: 1595, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 1770, reward: { type: 'bundle', parts: [
    { type: 'coins', amount: 700 },
    { type: 'itemSurprise', minRarity: 'Rare' },
  ] } },
  { trophies: 1950, reward: { type: 'character', id: 'waterbottle' } },    // Legendary
  // ── 190·200·210·220·230 ─────────────────────────────────────────────────────
  { trophies: 2140, reward: { type: 'container', kind: 'pineappleBox', count: 1 } },
  { trophies: 2340, reward: { type: 'gems', amount: 35 } },
  { trophies: 2550, reward: { type: 'coins', amount: 1200 } },
  { trophies: 2770, reward: { type: 'container', kind: 'chest', count: 2 } },
  { trophies: 3000, reward: { type: 'character', id: 'pizza' } },          // Neon
  // ── 235·240·250·255·260·260 ─────────────────────────────────────────────────
  { trophies: 3235, reward: { type: 'container', kind: 'redBox', count: 1 } },
  { trophies: 3475, reward: { type: 'bundle', parts: [
    { type: 'coins', amount: 1800 },
    { type: 'itemSurprise', minRarity: 'Rare' },
  ] } },
  { trophies: 3725, reward: { type: 'gems', amount: 50 } },
  { trophies: 3980, reward: { type: 'container', kind: 'pineappleBox', count: 1 } },
  { trophies: 4240, reward: { type: 'coins', amount: 2400 } },
  { trophies: 4500, reward: { type: 'character', id: 'egg' } },            // Neon
  // ── 280·300·310·320·330·340·370 ─────────────────────────────────────────────
  { trophies: 4780, reward: { type: 'gems', amount: 70 } },
  { trophies: 5080, reward: { type: 'container', kind: 'redBox', count: 1 } },
  { trophies: 5390, reward: { type: 'bundle', parts: [
    { type: 'coins', amount: 3000 },
    { type: 'itemSurprise', minRarity: 'Epic' },
  ] } },
  { trophies: 5710, reward: { type: 'container', kind: 'chest', count: 3 } },
  { trophies: 6040, reward: { type: 'gems', amount: 90 } },
  { trophies: 6380, reward: { type: 'container', kind: 'pineappleBox', count: 2 } },
  { trophies: 6750, reward: { type: 'character', id: 'lollipop' } },       // Cyber
  // ── the last stretch — 375·385·395·405·415·420·420·435 ──────────────────────
  { trophies: 7125, reward: { type: 'coins', amount: 4000 } },
  { trophies: 7510, reward: { type: 'container', kind: 'redBox', count: 1 } },
  { trophies: 7905, reward: { type: 'bundle', parts: [
    { type: 'gems', amount: 120 },
    { type: 'itemSurprise', minRarity: 'Legendary' },
  ] } },
  { trophies: 8310, reward: { type: 'coins', amount: 5000 } },
  { trophies: 8725, reward: { type: 'container', kind: 'fireBox', count: 1 } },
  { trophies: 9145, reward: { type: 'bundle', parts: [
    { type: 'gems', amount: 150 },
    // The last surprise before the capstone, banded so the pool is exactly the two
    // rarest items in the game. Finishing the road GUARANTEES you own a Neon-or-better
    // item, which is asserted rather than intended.
    { type: 'itemSurprise', minRarity: 'Neon' },
  ] } },
  {
    // The capstone haul. It is now the SECOND-TO-LAST node rather than the last —
    // see "WHERE THE BUNDLE WENT" above.
    trophies: 9565,
    reward: {
      type: 'bundle',
      parts: [
        { type: 'coins', amount: 8000 },
        { type: 'gems', amount: 250 },
        { type: 'container', kind: 'fireBox', count: 1 },
      ],
    },
  },
  // ── 10,000: THE ROSTER IS COMPLETE. This node is the whole point of the road. ──
  { trophies: ROSTER_COMPLETE_TROPHIES, reward: { type: 'character', id: 'hotdog' } }, // Cyber
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

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS — the acquisition side
// ─────────────────────────────────────────────────────────────────────────────
//
// `rules.ts:ITEMS` is the contract: ten loadout items, two equip slots, a rarity each.
// It says nothing about how a player COMES to own one, and this block is that half.
//
// ── ⚠️ `rules.ts` HAS NO `ITEM_IDS`, AND `CHARACTER_IDS` IS THE PRECEDENT IT BROKE ──
// `CHARACTER_IDS` is an exported array and `CharacterId` is derived FROM it, so every
// consumer in the codebase enumerates the roster the same way. `ItemId` is a hand-written
// union with no runtime counterpart, so the first thing every downstream track (loadout
// screen, AI, VFX, icons, this file) has to do is invent `Object.keys(ITEMS)` — five
// private enumerations of one set, in five files, none of them asserted to agree. This is
// the one below and it is REPORTED rather than fixed here: `rules.ts` is not this file
// set's to edit. `economy.test.mjs` §14 asserts it against `ITEMS` so at least this copy
// cannot drift.
//
// ── RARITY GATES THE POOL, WHICH IS THE OPPOSITE OF WHAT IT DOES FOR FIGHTERS ──
// `RARITY_MEANING` above tells the player, truthfully, that a fighter's rarity buys no
// power. An ITEM's rarity is a power statement — you carry two of them into a match —
// and `rules.ts` states the reconciliation: a character's tier gates nothing, an item's
// tier gates how hard it is to get. So item rarity appears here as a DROP WEIGHT and
// nowhere else; it never touches a cost, a level or a stat.

/** Every item id, derived from the registry. See the note above about `ITEM_IDS`. */
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/**
 * Item ids grouped by rarity — the pool a container row or a road surprise draws from.
 * Derived exactly as `CHARACTERS_BY_RARITY` is, and for the identical reason.
 *
 * ⚠️ A tier with NO items is a real possibility (there is exactly one Normal item and
 * one Cyber item today, so deleting either empties a tier). Every consumer must treat an
 * empty pool as "this row cannot pay out" rather than indexing into it — `[]` is the
 * vacuity trap `CLAUDE.md` non-negotiable 6 is about, and `economy.test.mjs` §14 asserts
 * every tier a shipped container REFERENCES is non-empty, after first asserting that the
 * set of referencing rows is itself non-empty.
 */
export const ITEMS_BY_RARITY: Record<Rarity, ItemId[]> = (() => {
  const out = {} as Record<Rarity, ItemId[]>;
  for (const id of ITEM_IDS) (out[ITEMS[id].rarity] ??= []).push(id);
  return out;
})();

/**
 * What a SECOND copy of an item is worth, by rarity.
 *
 * ── THE DUPLICATE DECISION, STATED ONCE ─────────────────────────────────────
 * An item is binary: you own it or you do not. There are no item levels, no power
 * points, no shards. Two reasons, and the second is the one that decides it:
 *   * You carry `ITEM_SLOTS` of them (two). A second copy of a thing you can already
 *     equip is worth exactly nothing in a match, so it must be worth something outside
 *     one or the container that produced it paid nothing.
 *   * An upgrade ladder is a whole second economy — a currency, a cost curve, a cap, a
 *     balance pass at every rung — and Uri asked for none of it. `LEVEL_UP` is already
 *     this game's long tail and it took a 1,108-line file to price. Adding a parallel
 *     one on an unshipped feature would be inventing work the owner did not ask for.
 *
 * So a duplicate converts to coins, exactly as a duplicate fighter does, **on the same
 * ladder** — `DUPLICATE_COINS`, not a second table. One ladder used by two things beats
 * two ladders that drift. And the roller refuses to hand you a duplicate at all while an
 * unowned item shares the pool, which is `rollContainer`'s existing rule for fighters
 * applied unchanged.
 */
export const ITEM_DUPLICATE_COINS: Record<Rarity, number> = DUPLICATE_COINS;

/**
 * Relative chance of drawing each item WITHIN a pool, by rarity.
 *
 * Used only where a draw spans more than one tier — the trophy road's surprise, whose
 * `minRarity` band is a floor rather than a tier. A container row names ONE tier, so its
 * pool is uniform and this table never enters into it.
 *
 * ── DERIVED, AND FROM THE LADDER THAT ALREADY EXISTS ────────────────────────
 * The weight is the RECIPROCAL of `DUPLICATE_COINS`. That is one ladder read in its two
 * directions: what a duplicate pays you is what the item is worth, and what an item is
 * worth is the inverse of how often you should see it. Authoring a second six-number
 * table here would be a table that can disagree with the first one, on the same axis,
 * for no gain — which is `DECISIONS §13`'s defect shape exactly.
 *
 * The resulting share of an all-tiers draw, computed rather than typed (§14 prints it):
 * Springform 30.7% · each Rare 14.2% · each Epic 7.1% · each Legendary 4.1% ·
 * Shiitake Shield 2.6% · **Leftovers 1.7%** — 18.3× rarer than the Normal item, which is
 * Uri's *"zombie power is the rarest"* as an arithmetic fact rather than an intention.
 */
export const ITEM_DROP_WEIGHT: Record<Rarity, number> = (() => {
  const out = {} as Record<Rarity, number>;
  for (const [rarity, coins] of Object.entries(DUPLICATE_COINS) as [Rarity, number][]) {
    out[rarity] = coins > 0 ? 1 / coins : 0;
  }
  return out;
})();

/**
 * The one item a brand-new player already has, so the loadout screen is never empty.
 *
 * ⚠️ **THIS IS AN ASSUMPTION, NOT AN INSTRUCTION.** Uri named boxes, chests and the
 * trophy road as the ways to obtain an item and did not mention a starting one. A player
 * who owns nothing meets an empty loadout screen and cannot discover the feature exists
 * until their first chest — which is `winsPerChest` wins away — so the feature would be
 * invisible for the whole of a first session. `STARTER_CHARACTER` is the precedent and
 * the same argument produced it. Reversing it is one line and costs a player one Normal
 * item.
 *
 * DERIVED, not typed: the lowest-rarity item on the ladder, ties broken by registry
 * order. Adding a second Normal item changes which one this is, and §14 asserts that the
 * result is a real member of the lowest non-empty tier rather than trusting the index.
 */
export const STARTER_ITEM: ItemId = (() => {
  const ladder = (Object.keys(DUPLICATE_COINS) as Rarity[])
    .sort((a, b) => DUPLICATE_COINS[a] - DUPLICATE_COINS[b]);
  for (const tier of ladder) {
    const pool = ITEMS_BY_RARITY[tier];
    if (pool && pool.length > 0) return pool[0];
  }
  // Unreachable while `rules.ts` ships ten items; throwing beats exporting `undefined`
  // as an `ItemId` and letting it surface as a missing icon three files away.
  throw new Error('STARTER_ITEM: rules.ts:ITEMS is empty');
})();
