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
// ITEMS — the loadout, and how a player OBTAINS one
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── URI'S SPEC, AND THE HALF OF IT THIS FILE ANSWERS ────────────────────────
 *
 * *"Add game items … (up to 2 items per player, he sets it up on the lobby, which ones
 * he wants to use out of what he has). Figure out names and looks for the items based
 * on what they do. … Add rarity to items — zombie power is the rarest. … Items can be
 * obtained through boxes/chests and in trophy road (as a surprise, not a fixed item)."*
 *
 * Two halves, and they live in two files by the same split every other feature here uses:
 *
 *   `rules.ts`   what an item DOES in a match — the sleep duration, the 1.3× stack, the
 *                five-second lockout. That is COMBAT, and `rules.ts` owns combat.
 *   HERE         what an item IS to the progression system — its identity, its rarity,
 *                which containers can produce it, what a duplicate is worth, and where
 *                the trophy road hides one. That is PROGRESSION, and this file owns it.
 *
 * 🚨 **AND THE `rules.ts` HALF DOES NOT EXIST YET, WHICH IS WHY THE CATALOGUE IS HERE.**
 * The brief that produced this work stated *"Phase 1 landed the ITEMS registry with rarity
 * in `rules.ts` plus `docs/ITEMS.md`"*. Both were checked against the tree before anything
 * was written and **neither exists**: `grep ITEMS src/game/rules.ts` returns nothing and
 * there is no `docs/ITEMS.md`. So this is the FIRST catalogue, not a second copy — but it
 * is sitting in the file that owns the acquisition half of the question rather than the
 * behaviour half, and that is a seam somebody has to close.
 *
 * → **When `rules.ts` grows an item registry, `ITEM_IDS` and `ITEMS[id].rarity` must move
 *   there and this file must IMPORT them**, exactly as it already imports `CHARACTER_IDS`
 *   and `CHARACTERS[id].rarity` rather than restating them. `tools/tmp/ie_items.mjs`
 *   watches that seam: it parses `rules.ts` for an item registry and, the moment one
 *   appears, diffs the id set and the rarity map against this one and exits 1 on any
 *   disagreement. Until then it prints SOLE-CATALOGUE. A second copy that AGREES today is
 *   the one that goes stale next month — `CLAUDE.md`'s standing rule about counts, applied
 *   to a table.
 *
 * ── ⚠️ AND THE NAMES ARE A PROPOSAL, NOT A MEASUREMENT ──────────────────────
 * Uri asked for names "based on what they do". These are one string each and are meant to
 * be argued with; nothing in the model reads a name, and `ie_items.mjs` asserts that
 * (renaming every item leaves every drop rate, pool and pity figure bit-identical). The
 * LOOKS he also asked for are a `rules.ts`/render question and are not attempted here.
 */

/**
 * ── THE ONE PLACE THE ITEM RARITY LADDER DEPARTS FROM THE CHARACTER ONE ─────
 *
 * `RARITY_MEANING` below says, of FIGHTERS: *"Rarity sets how hard a fighter is to find —
 * not how strong it is."* That sentence is load-bearing, it is on a legal-disclosure
 * surface, and `DECISIONS §24b` is Uri reversing rarity-as-power outright because in a
 * humans-vs-humans game it is pay-to-win.
 *
 * 🚨 **ITEMS DO NOT OBEY IT, AND THAT IS URI'S OWN INSTRUCTION RATHER THAN A DRIFT.**
 * *"Add rarity to items — zombie power is the rarest"* names the single most match-altering
 * effect in his list (a free resurrection) as the single rarest thing to obtain. Rarity for
 * items therefore tracks IMPACT, not just scarcity, and the ladder below is ordered by how
 * much an item changes a fight.
 *
 * **That reintroduces exactly the shape §24b removed**, by a narrower door: gems are the
 * premium currency, gems buy boxes, boxes now contain items, so a payer reaches the top of
 * the item ladder faster than a non-payer. Three things bound it, and they are the reason
 * this is shippable rather than a blocker — but it is a DESIGN DECISION URI SHOULD SEE, not
 * an implementation detail:
 *
 *   1. **`ITEM_SLOTS` is 2.** The ceiling is two items, not a collection, so the gap between
 *      a whale and a free player is bounded by the best two items rather than by all ten.
 *   2. **The Cyber tier is reachable free.** Six late trophy-road nodes each carry a
 *      `late`-pool surprise with a Cyber slice, and the road costs nothing.
 *      `tools/tmp/ie_items.mjs --career` measures what that is actually worth.
 *   3. **A duplicate never becomes power.** It converts to coins (see
 *      `ITEM_DUPLICATE_COINS`). There is deliberately no item-levelling path, because
 *      "buy boxes → level the item" is the pay-to-win loop §24b closed, wearing a hat.
 */
export type ItemId =
  | 'springboard'
  | 'moldCloud'
  | 'inkSpray'
  | 'batterPump'
  | 'liquoriceRope'
  | 'hotSauce'
  | 'chamomileMist'
  | 'fungusShield'
  | 'blackHole'
  | 'zombiePower';

/**
 * Declaration order is the RARITY LADDER, ascending, and `ie_items.mjs` asserts it.
 *
 * Same trick `CHARACTER_IDS` uses: one array, iterated everywhere, so "every item" can
 * never mean two different sets in two different files.
 */
export const ITEM_IDS = [
  'springboard', 'moldCloud',
  'inkSpray', 'batterPump',
  'liquoriceRope', 'hotSauce',
  'chamomileMist', 'fungusShield',
  'blackHole',
  'zombiePower',
] as const satisfies readonly ItemId[];

/**
 * How an item occupies its slot.
 *
 * `'passive'` is always on for the whole match and asks nothing of the player;
 * `'active'` is a thing you press. The distinction exists because of the assumption
 * this work had to make and could not ask about: **a passive occupies one of the two
 * slots exactly as an active does.** Otherwise a permanent aura is free and therefore
 * always correct, and the loadout choice Uri asked for stops being a choice.
 *
 * Nothing in `economy/` branches on this — it is here so `rules.ts` and the lobby read
 * one answer instead of two.
 */
export type ItemKind = 'active' | 'passive';

export interface ItemDef {
  name: string;
  emoji: string;
  rarity: Rarity;
  kind: ItemKind;
  /** One line, in the player's language, for the odds sheet and the reveal card. */
  blurb: string;
}

/**
 * The ten items, in ascending rarity.
 *
 * Each `blurb` is a restatement of Uri's own line for that item and nothing more — the
 * numbers behind them (the 1.3× stack, the five-second lockouts, the half-screen reach)
 * are `rules.ts`'s to own and are deliberately not repeated here, because a duration
 * written in two files is a duration that will disagree in one of them.
 */
export const ITEMS: Record<ItemId, ItemDef> = {
  // ── Normal — movement and chip. Neither ends a fight. ──
  springboard: {
    name: 'Pancake Springboard',
    emoji: '🥞',
    rarity: 'Normal',
    kind: 'active',
    blurb: 'Bounce a long jump in or out — close the gap, or leave it.',
  },
  moldCloud: {
    name: 'Mold Cloud',
    emoji: '🦠',
    rarity: 'Normal',
    kind: 'passive',
    blurb: 'A small cloud follows you all match, chipping anyone who stands too close.',
  },

  // ── Rare — disruption. Costs the target their next few seconds, not their health. ──
  inkSpray: {
    name: 'Squid Ink Spray',
    emoji: '🦑',
    rarity: 'Rare',
    kind: 'active',
    blurb: "Splatters ink across whoever you hit — they can barely see what they are fighting.",
  },
  batterPump: {
    name: 'Batter Pump',
    emoji: '🧴',
    rarity: 'Rare',
    kind: 'active',
    blurb: 'Gums up an opponent’s weapon for five seconds. They can still run.',
  },

  // ── Epic — control and damage. These decide a duel. ──
  liquoriceRope: {
    name: 'Liquorice Rope',
    emoji: '🪢',
    rarity: 'Epic',
    kind: 'active',
    blurb: 'Ties an opponent where they stand for five seconds.',
  },
  hotSauce: {
    name: 'Hot Sauce',
    emoji: '🌶️',
    rarity: 'Epic',
    kind: 'passive',
    blurb: 'Every hit you land on the SAME target burns hotter than the one before it.',
  },

  // ── Legendary — long reach, or a window nobody can attack into. ──
  chamomileMist: {
    name: 'Chamomile Mist',
    emoji: '😴',
    rarity: 'Legendary',
    kind: 'active',
    blurb: 'Puts a distant enemy to sleep. The further away they are, the longer they stay down.',
  },
  fungusShield: {
    name: 'Fungus Shield',
    emoji: '🍄',
    rarity: 'Legendary',
    kind: 'active',
    blurb: 'Grows a shell for five seconds. Everything that hits you takes the hit back.',
  },

  // ── Neon — it moves other people around the map. ──
  blackHole: {
    name: 'Black Hole Bagel',
    emoji: '🕳️',
    rarity: 'Neon',
    kind: 'active',
    blurb: 'Drops an opponent next to a DIFFERENT opponent. Useless in a two-player endgame.',
  },

  // ── Cyber — Uri: "zombie power is the rarest". One item, one tier, on purpose. ──
  zombiePower: {
    name: 'Zombie Power',
    emoji: '🧟',
    rarity: 'Cyber',
    kind: 'passive',
    blurb: 'If the player who killed you dies before the match is decided, you get back up. Once.',
  },
};

/**
 * How many items a player may take into a match. Uri: *"up to 2 items per player"*.
 *
 * Exported rather than typed into the lobby, `state.ts` and the sim separately — three
 * copies of a cap is three places for it to be two in one of them. `state.ts:equipItem`
 * enforces it, and it is the number that bounds the pay-to-win exposure described above.
 */
export const ITEM_SLOTS = 2;

/**
 * Coins paid when an item drop lands on one the player already holds.
 *
 * ── WHY COINS AND NOT AN UPGRADE ────────────────────────────────────────────
 * Every route from a duplicate to POWER is the loop `DECISIONS §24b` closed: buy boxes,
 * feed the copies into the item, own a stronger item than someone who did not pay. There
 * is no item-levelling path in this model and adding one is a design decision rather than
 * a feature, so a repeat pays out in the currency that already has a sink (`LEVEL_UP`).
 *
 * ── THE NUMBERS ─────────────────────────────────────────────────────────────
 * ~40% of `DUPLICATE_COINS` at the same tier, rounded to readable prices: an item occupies
 * ONE of two loadout slots where a fighter is the whole loadout, so it is worth a fraction
 * of one and the fraction is stated rather than left implicit. Strictly ascending, which
 * `economy.test.mjs` asserts — a ladder that is not monotone is a ladder where a rarer drop
 * pays less, and nobody would ever notice it in the odds sheet.
 *
 * ⚠️ **The endgame check that matters is that this must not turn a box into a coin faucet.**
 * A player who owns every item still gets less back from every container than they put in —
 * `ie_items.mjs --shredder` re-derives all five containers at full ownership and asserts it.
 */
export const ITEM_DUPLICATE_COINS: Record<Rarity, number> = {
  Normal: 50,
  Rare: 100,
  Epic: 200,
  Legendary: 350,
  Neon: 550,
  Cyber: 900,
};

/**
 * ── THE TROPHY ROAD SURPRISE — Uri: *"as a surprise, not a fixed item"* ─────
 *
 * A surprise node does not name what it pays. It names a POOL, the pool is a weight table
 * over rarities, and the item inside is resolved when the player claims it.
 *
 * ── HOW IT RESOLVES DETERMINISTICALLY, STATED PRECISELY ─────────────────────
 *
 * There are two halves and only one of them is fixed in advance. Saying so exactly is the
 * point, because "the surprise is decided the moment you see the node" is the claim a
 * player would infer and it is only three-quarters true:
 *
 *   * **THE RARITY IS PINNED BY (player seed, node threshold) AND NOTHING ELSE.**
 *     `createRng(seed + ROAD_SURPRISE_SALT + threshold)` — no dependence on `rolls`, on
 *     claim order, on how many matches have been played, or on the wall clock. It cannot be
 *     re-rolled by reloading the page before claiming, which is the oldest exploit in the
 *     genre and is the same property `state.ts`'s persisted `rolls` counter buys for chests.
 *   * **WHICH item of that rarity you receive depends on what you already own AT THE MOMENT
 *     YOU CLAIM.** Deliberately: the road never hands you a duplicate while an unowned item
 *     of the same rarity is sitting in the pool. That is `rollContainer()`'s existing rule
 *     for fighters, applied unchanged, and it is why claiming two surprises in the other
 *     order can hand you the same two items in the other order.
 *
 * ⚠️ `ROAD_SURPRISE_SALT` is what keeps the road's stream from colliding with the container
 * stream, which runs on `seed + rolls`. Without it, a player at `rolls === 195` claiming the
 * node at 195 trophies would draw from an RNG whose state a chest had already used — and
 * `rng.ts`'s own header explains at length why near-identical seeds are the thing `mixSeed`
 * exists to decorrelate. The value is the golden-ratio constant, arbitrary and standard; the
 * point is that it is a NAMED constant in one place rather than a literal at a call site,
 * so the two domains are visibly distinct.
 */
export const ROAD_SURPRISE_SALT = 0x9e37_79b9;

export type ItemPoolId = 'early' | 'mid' | 'late';

/**
 * Rarity weights for each surprise pool. Percentages, summing to 100, exactly like
 * `ContainerEntry.weight` — one convention for every weight table in this file, and
 * `economy.test.mjs` asserts all four sums the same way.
 *
 * ── THE LADDER IS IN THE POOLS, NOT IN THE NODES ────────────────────────────
 * `early` cannot produce anything above Epic; only `late` can produce Cyber. So the road's
 * item track climbs for the same reason its character track does, and a 195-trophy node
 * cannot hand a brand-new player the rarest item in the game.
 *
 * ── WHY CYBER IS 12 AND NOT 5 ───────────────────────────────────────────────
 * Zombie Power is the only Cyber item, so this number IS its drop rate on a late node.
 * The design target was stated before it was tuned: **the rarest item should be reachable
 * on a single road completion but not expected.** Six late nodes at 12% is
 * 1 − 0.88⁶ = **53.6%**, so it is roughly a coin flip. At the 5% first draft it was 26.5%,
 * which makes the marquee item something three players in four complete a ~19-hour road
 * and never see. `ie_items.mjs --career` measures the realised figure over seeded careers
 * rather than trusting this arithmetic, because it ignores the box drops entirely.
 */
export const ITEM_SURPRISE_POOLS: Record<ItemPoolId, Partial<Record<Rarity, number>>> = {
  early: { Normal: 68, Rare: 26, Epic: 6 },
  mid: { Rare: 44, Epic: 36, Legendary: 18, Neon: 2 },
  late: { Epic: 26, Legendary: 34, Neon: 28, Cyber: 12 },
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
  { trophies: 145, reward: { type: 'gems', amount: 5 } },
  { trophies: 195, reward: { type: 'container', kind: 'hamburgerBox', count: 1 } },
  { trophies: 250, reward: { type: 'character', id: 'taco' } },            // Rare
  // ── 65·75·90 ────────────────────────────────────────────────────────────────
  { trophies: 315, reward: { type: 'coins', amount: 250 } },
  { trophies: 390, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 480, reward: { type: 'character', id: 'burrito' } },         // Rare
  // ── 95·110·115 ──────────────────────────────────────────────────────────────
  { trophies: 575, reward: { type: 'gems', amount: 10 } },
  { trophies: 685, reward: { type: 'container', kind: 'hamburgerBox', count: 1 } },
  { trophies: 800, reward: { type: 'character', id: 'soup' } },            // Epic
  // ── 140·150·160 ─────────────────────────────────────────────────────────────
  { trophies: 940, reward: { type: 'coins', amount: 400 } },
  { trophies: 1090, reward: { type: 'container', kind: 'pineappleBox', count: 1 } },
  { trophies: 1250, reward: { type: 'character', id: 'sushi' } },          // Legendary
  // ── 170·175·175·180 ─────────────────────────────────────────────────────────
  { trophies: 1420, reward: { type: 'gems', amount: 20 } },
  { trophies: 1595, reward: { type: 'container', kind: 'chest', count: 1 } },
  { trophies: 1770, reward: { type: 'coins', amount: 700 } },
  { trophies: 1950, reward: { type: 'character', id: 'waterbottle' } },    // Legendary
  // ── 190·200·210·220·230 ─────────────────────────────────────────────────────
  { trophies: 2140, reward: { type: 'container', kind: 'pineappleBox', count: 1 } },
  { trophies: 2340, reward: { type: 'gems', amount: 35 } },
  { trophies: 2550, reward: { type: 'coins', amount: 1200 } },
  { trophies: 2770, reward: { type: 'container', kind: 'chest', count: 2 } },
  { trophies: 3000, reward: { type: 'character', id: 'pizza' } },          // Neon
  // ── 235·240·250·255·260·260 ─────────────────────────────────────────────────
  { trophies: 3235, reward: { type: 'container', kind: 'redBox', count: 1 } },
  { trophies: 3475, reward: { type: 'coins', amount: 1800 } },
  { trophies: 3725, reward: { type: 'gems', amount: 50 } },
  { trophies: 3980, reward: { type: 'container', kind: 'pineappleBox', count: 1 } },
  { trophies: 4240, reward: { type: 'coins', amount: 2400 } },
  { trophies: 4500, reward: { type: 'character', id: 'egg' } },            // Neon
  // ── 280·300·310·320·330·340·370 ─────────────────────────────────────────────
  { trophies: 4780, reward: { type: 'gems', amount: 70 } },
  { trophies: 5080, reward: { type: 'container', kind: 'redBox', count: 1 } },
  { trophies: 5390, reward: { type: 'coins', amount: 3000 } },
  { trophies: 5710, reward: { type: 'container', kind: 'chest', count: 3 } },
  { trophies: 6040, reward: { type: 'gems', amount: 90 } },
  { trophies: 6380, reward: { type: 'container', kind: 'pineappleBox', count: 2 } },
  { trophies: 6750, reward: { type: 'character', id: 'lollipop' } },       // Cyber
  // ── the last stretch — 375·385·395·405·415·420·420·435 ──────────────────────
  { trophies: 7125, reward: { type: 'coins', amount: 4000 } },
  { trophies: 7510, reward: { type: 'container', kind: 'redBox', count: 1 } },
  { trophies: 7905, reward: { type: 'gems', amount: 120 } },
  { trophies: 8310, reward: { type: 'coins', amount: 5000 } },
  { trophies: 8725, reward: { type: 'container', kind: 'fireBox', count: 1 } },
  { trophies: 9145, reward: { type: 'gems', amount: 150 } },
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
