/**
 * LOBBIES AND LEAGUES — the data model, and the seam it attaches to. No UI, no service.
 *
 * Uri named three things: *"host games, leagues, online multiplayer game"*. The third is
 * `host.ts` / `client.ts`. The first two are this file, and they are deliberately **pure data
 * plus pure functions**: no storage, no fetch, no timers, no ids drawn from `Math.random`.
 * Everything here is a function of its arguments and of a seed the caller supplies, which is
 * what lets a lobby be replayed, tested, and — later — reconciled against a server that owns
 * the same shapes.
 *
 * 🚨 **NOTHING IS PROVISIONED AND NOTHING PHONES HOME.** No project, database, deployment or
 * account was created for this, and no field below carries an endpoint or a credential. This
 * repo is PUBLIC and a live key in it once forced a rewrite of all git history. `LeagueStore`
 * is an interface with an in-memory implementation; wiring it to anything real is Uri's call.
 *
 * ── 🚨 SLOT ORDER IS A GAME RULE, SO SEAT ASSIGNMENT IS A GAME DECISION ────────
 *
 * `state.ts` and `DECISIONS §49a` between them make three rules depend on which slot you get:
 * who acts first inside a tick, who keeps a `nearestLivingOpponent` tie, and — Uri's own
 * answer — the timeout tiebreak's rung 3, *"Fewest deaths, then lower slot"*.
 *
 * ⚠️ **All three are currently unreachable or measure-zero**, and that is exactly why this
 * needs saying out loud now rather than later. Rung 3 landed **inert** (`deaths ∈ {0,1}` and
 * rung 1 sorts every corpse below every survivor; §2's sudden death should stop a timeout
 * happening at all), and it goes live the day respawns exist. A lobby that always hands the
 * first joiner slot 0 is therefore handing out an advantage that nothing can currently
 * measure — the worst kind to leave undeclared.
 *
 * So `assignSeat` takes **join order** (simple, predictable, and what a host game wants), and
 * `shuffleSeats(lobby, seed)` is the seeded, reproducible, auditable alternative for anything
 * ranked. The choice is the caller's and it is one line either way.
 */

import type { CharacterId } from '../game/rules.ts';
import { LEVEL_MIN } from '../game/rules.ts';
import { MAX_FIGHTERS, MIN_FIGHTERS } from '../game/state.ts';
// ⚠️ THE PAYOUT CURVE IS IMPORTED, NEVER RESTATED. `economy/trophyRoad.ts` owns it; this
// module does the league bookkeeping and nothing else. `placementCurve` is re-exported below
// so a caller that wants the whole field's deltas for DISPLAY does not have to reach past this
// seam to get them — but the arithmetic has exactly one home.
import { placementCurve, placementTrophyDelta } from '../game/economy/trophyRoad.ts';
import { createRng } from '../game/economy/rng.ts';
import type { ArenaDefinition } from '../arena/types.ts';
import type { LobbyStatus, PeerId, Slot, WireSeat } from './protocol.ts';

export interface LobbySeat {
  slot: Slot;
  /** `null` means the seat is empty or bot-filled — `bot` distinguishes the two. */
  peer: PeerId | null;
  bot: boolean;
  characterId: CharacterId | null;
  level: number;
  ready: boolean;
}

export interface Lobby {
  id: string;
  hostPeer: PeerId;
  arenaId: string;
  status: LobbyStatus;
  /** ⚠️ SLOT-INDEXED, ALWAYS. `seats[i].slot === i` is an invariant `lobbyViolations` checks. */
  seats: LobbySeat[];
}

/**
 * @param capacity how many seats this lobby has. Clamped to the sim's own `MIN_FIGHTERS`..
 * `MAX_FIGHTERS`, which are the real limits and are imported rather than restated —
 * `MAX_FIGHTERS` is 6 because `DECISIONS §48` sized the ×4 arena for 4–6 players, and the
 * ceiling above it is `fighterBit`'s int32 coercion at 31 slots.
 */
export function createLobby(id: string, hostPeer: PeerId, arenaId: string, capacity: number): Lobby {
  const n = Math.max(MIN_FIGHTERS, Math.min(MAX_FIGHTERS, Math.trunc(capacity)));
  return {
    id,
    hostPeer,
    arenaId,
    status: 'open',
    seats: Array.from({ length: n }, (_, slot): LobbySeat => ({
      slot,
      peer: null,
      bot: false,
      characterId: null,
      level: LEVEL_MIN,
      ready: false,
    })),
  };
}

/**
 * Seat a peer in the LOWEST free slot. Returns the slot, or `null` if the lobby is full.
 *
 * ⚠️ Lowest-free rather than first-fit-from-anywhere so the result is a pure function of the
 * join order, and so a lobby that has churned produces the same layout as one that has not.
 * See the header for what "lowest" costs and how to buy out of it.
 */
export function assignSeat(lobby: Lobby, peer: PeerId, characterId: CharacterId, level = LEVEL_MIN): Slot | null {
  if (lobby.status !== 'open') return null;
  if (lobby.seats.some((s) => s.peer === peer)) return null;   // already seated; not an error
  for (const seat of lobby.seats) {
    if (seat.peer !== null || seat.bot) continue;
    seat.peer = peer;
    seat.characterId = characterId;
    seat.level = level;
    seat.ready = false;
    return seat.slot;
  }
  return null;
}

/** Empty a peer's seat. The slot stays where it is — seats are positions, not a queue. */
export function releaseSeat(lobby: Lobby, peer: PeerId): Slot | null {
  for (const seat of lobby.seats) {
    if (seat.peer !== peer) continue;
    seat.peer = null;
    seat.bot = false;
    seat.characterId = null;
    seat.level = LEVEL_MIN;
    seat.ready = false;
    return seat.slot;
  }
  return null;
}

/**
 * Fill every empty seat with a bot.
 *
 * ⚠️ **AND `DECISIONS §49c` MAKES THIS A COST, NOT A CONVENIENCE.** Uri: *"AI player is
 * currently only for testing the game."* A bot is a test harness, not a design target — and
 * `NETCODE.md` §5 measured what one costs the host: a six-human tick is **2.66 µs**; the same
 * tick with six bots is **399.50 µs**, 150× more, and 99.2% of it is `stepAI`'s BFS flow
 * field. **A host peer filling five empty seats with bots is doing 2.4% of its frame budget on
 * simulation before it renders anything** — on a phone Uri already describes as unplayable
 * (§33). Fill deliberately.
 */
export function fillWithBots(lobby: Lobby, characterId: CharacterId, level = LEVEL_MIN): number {
  let filled = 0;
  for (const seat of lobby.seats) {
    if (seat.peer !== null || seat.bot) continue;
    seat.bot = true;
    seat.characterId = characterId;
    seat.level = level;
    seat.ready = true;
    filled++;
  }
  return filled;
}

/**
 * Re-deal the occupied seats into a seeded random slot order.
 *
 * Fisher–Yates over a `createRng` stream — the same seeded mulberry32 the economy uses for
 * chest rolls, imported rather than copied, for the reason `rng.ts` gives at the top: *"a
 * reward table whose output you cannot reproduce is a table whose published odds you cannot
 * verify."* A ranked lobby's seat draw is exactly that kind of claim: it has to be auditable,
 * so the seed is an argument and the result is a pure function of it.
 */
export function shuffleSeats(lobby: Lobby, seed: number): void {
  const rng = createRng(seed);
  const occupants = lobby.seats.map((s) => ({ peer: s.peer, bot: s.bot, characterId: s.characterId, level: s.level, ready: s.ready }));
  for (let i = occupants.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = occupants[i];
    occupants[i] = occupants[j];
    occupants[j] = tmp;
  }
  for (let i = 0; i < lobby.seats.length; i++) {
    lobby.seats[i] = { slot: i, ...occupants[i] };
  }
}

export function setReady(lobby: Lobby, peer: PeerId, ready: boolean): void {
  for (const seat of lobby.seats) if (seat.peer === peer) seat.ready = ready;
}

export function seatedCount(lobby: Lobby): number {
  return lobby.seats.filter((s) => s.peer !== null || s.bot).length;
}

export function allReady(lobby: Lobby): boolean {
  return lobby.seats.every((s) => (s.peer === null && !s.bot) || s.ready);
}

/**
 * Self-consistency of a lobby, in the same idiom as `wire.ts:checkStateIntegrity` — a list of
 * machine-readable codes rather than a boolean, so a gate can assert the SET.
 */
export function lobbyViolations(lobby: Lobby): string[] {
  const out: string[] = [];
  if (!Array.isArray(lobby.seats)) return ['seats/not-array'];
  if (lobby.seats.length < MIN_FIGHTERS || lobby.seats.length > MAX_FIGHTERS) out.push('seats/capacity');
  const peers = new Set<PeerId>();
  for (let i = 0; i < lobby.seats.length; i++) {
    const s = lobby.seats[i];
    if (s.slot !== i) out.push(`slot/index:${i}`);
    if (s.peer !== null && s.bot) out.push(`slot/peer-and-bot:${i}`);
    if (s.peer !== null) {
      if (peers.has(s.peer)) out.push(`peer/duplicate:${s.peer}`);
      peers.add(s.peer);
    }
    if ((s.peer !== null || s.bot) && s.characterId === null) out.push(`slot/no-character:${i}`);
  }
  return out;
}

/**
 * THE SEAM: a lobby becomes `HostSession`'s seat list.
 *
 * 🚨 **SPAWNS ARE READ FROM `arena.spawns` AS COORDINATES AND ARE NEVER DERIVED HERE.**
 * `NETCODE.md` §7 (§49d) makes that a protocol rule under every transport: a ring spawn
 * computed from `Math.cos`/`Math.sin` is two implementation-approximated call sites, so a
 * *derived* spawn is a disagreement at tick 0 before anybody has moved. `sim.ts:createMatch`
 * already throws rather than inventing one, and `arena/types.ts` documents the contract on
 * whoever authors the list (pairs, interleaved, 180° point symmetry, every entry passing
 * `spawn_runway.mjs`). **This function refuses rather than filling a gap.**
 */
export function toWireSeats(lobby: Lobby, arena: ArenaDefinition): WireSeat[] {
  const occupied = lobby.seats.filter((s) => s.peer !== null || s.bot);
  if (occupied.length < MIN_FIGHTERS) {
    throw new RangeError(`toWireSeats: ${occupied.length} occupied seats; the sim seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}`);
  }
  const spawns = arena.spawns ?? [arena.playerSpawn, arena.enemySpawn];
  if (spawns.length < occupied.length) {
    throw new RangeError(
      `toWireSeats: arena '${arena.id}' declares ${spawns.length} spawns for ${occupied.length} seats.`
      + ' Spawn placement is arena geometry (arena/types.ts: pairs, interleaved, 180-degree point'
      + ' symmetry, every entry passing spawn_runway.mjs) and is never derived here.',
    );
  }
  return occupied.map((seat, i): WireSeat => ({
    slot: i,
    peer: seat.peer,
    characterId: seat.characterId as string,
    level: seat.level,
    spawn: { x: spawns[i].x, y: spawns[i].y },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAGUES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A finished match, as a league sees it.
 *
 * ⚠️ **PLACEMENT, NOT `won: boolean`** — and that is the whole reason this type exists rather
 * than reusing `economy/state.ts:LastMatch`. That one is `{ won, trophies, coins, chests }`,
 * which is a complete description of a **1v1** result and says nothing about coming third of
 * six. `DECISIONS §49a` already fixed how placement is decided (*"fewest deaths, then lower
 * slot"*, implemented in `sim.ts:resolveTimeout`), so the ORDER is a settled game rule; what
 * each position is WORTH above two seats is not, see `applyMatchResult`.
 */
export interface LeagueMatchResult {
  matchId: string;
  /** Player ids in FINISHING ORDER, best first. Length equals the seat count. */
  placements: string[];
  /** Ticks the match ran, for audit. */
  ticks: number;
}

export interface LeagueEntrant {
  playerId: string;
  /**
   * The SAME currency `economy/state.ts:EconomyState.trophies` holds, deliberately.
   *
   * A league that invented a second ladder number would put the trophy road (`TROPHY_ROAD`,
   * 10 milestones from 10 to the roster's last unlock) on one scale and ranked play on
   * another, and every reward in the game hangs off the first one.
   */
  trophies: number;
  played: number;
  /** Count of finishes at each position, index 0 = first place. */
  finishes: number[];
}

export interface League {
  id: string;
  name: string;
  seasonId: string;
  /** Seat count these matches are played at. Drives the length of `finishes`. */
  seats: number;
  entrants: LeagueEntrant[];
}

export function createLeague(id: string, name: string, seasonId: string, seats: number): League {
  return {
    id,
    name,
    seasonId,
    seats: Math.max(MIN_FIGHTERS, Math.min(MAX_FIGHTERS, Math.trunc(seats))),
    entrants: [],
  };
}

export function enterLeague(league: League, playerId: string, trophies = 0): LeagueEntrant {
  const existing = league.entrants.find((e) => e.playerId === playerId);
  if (existing) return existing;
  const entrant: LeagueEntrant = {
    playerId,
    trophies,
    played: 0,
    finishes: new Array<number>(league.seats).fill(0),
  };
  league.entrants.push(entrant);
  return entrant;
}

/**
 * A trophy delta per finishing position, best first.
 *
 * ✅ **THE OPEN ITEM THIS TYPE WAS WAITING FOR IS CLOSED — `721ce3c`.** This block used to read:
 *
 *   > *"`economy/tuning.ts` … currently prices exactly two outcomes … **There is no placement
 *   > curve anywhere in this repo** … So the curve comes in from the caller, `tuning.ts` owns
 *   > it when it exists, and this function does the arithmetic and nothing else. **Reported as
 *   > an open item for Uri / the economy owner; not decided here.**"*
 *
 * It exists now, and it is `economy/trophyRoad.ts:placementCurve(seats, trophies)`, indexed on
 * **normalised rank** `r = place / (seats - 1)` rather than on raw place — so 3rd of six
 * (r = 0.40) and 3rd of four (r = 0.67) are priced apart, which a place-indexed table cannot do
 * and gets wrong at one of the two. Proven a no-op at two seats against a frozen oracle.
 *
 * The type stays, and the `curve` argument stays OPTIONAL rather than being deleted, for one
 * reason that is not backwards compatibility: an exhibition or a fixed-rate event wants a curve
 * that is not the ladder's. What is gone is `twoSeatCurve`, and with it the hardcoded `15`.
 */
export type PlacementCurve = readonly number[];

/**
 * @deprecated ⚠️ **REMOVED — `twoSeatCurve(loss)` RETURNED `[15, -loss]` AND THAT `15` WAS A
 * HARDCODED LITERAL WHERE `MATCH_PAYOUT.trophiesWin` BELONGED.** Retuning `trophiesWin` would
 * have left the league silently paying the old rate, with nothing red anywhere: the number is
 * right today, so no test comparing it against itself could ever fail. Use
 * `placementCurve(2, trophies)`, which reads the constant.
 *
 * Kept as a comment rather than as a shim, because a shim would still be a second statement of
 * the payout — and `state.ts` documents the identical judgement for `FighterRole`: the wording
 * survives, the behaviour does not.
 */

/**
 * Apply a finished match. Pure: mutates only the league passed in, and returns the deltas.
 *
 * 🚨 **BY DEFAULT EVERY FINISHER IS PRICED AT THEIR OWN STANDING, AND THE CURVE FORM IS THE
 * EXCEPTION.** This is the defect the economy pass named in `trophyRoad.ts:placementCurve`:
 *
 *   > *"Every entry is priced at the SAME standing … a field whose members sit at different
 *   > standings needs one call per finisher (`placementTrophyDelta`), not one curve."*
 *
 * A league is exactly that field. `MATCH_PAYOUT`'s loss term is
 * `min(cap, base + floor(trophies / per))` with a grace band below 100, so it is a function of
 * the LOSER'S OWN trophy count — and a single curve has to pick one player's standing and pay
 * everybody at it. Measured on the real numbers: a 3,000-trophy loser priced on a curve built
 * at 0 trophies is charged **0 instead of -10**, because the 0-trophy player is inside the
 * grace band and the 3,000-trophy one is at the cap. `nw_stack.mjs` P-KB asserts exactly that
 * gap, so the per-finisher path is a measurement rather than a preference.
 *
 * Passing `curve` explicitly overrides it, for the fixed-rate case — and then the old
 * simplification applies and is the caller's to own.
 */
export function applyMatchResult(
  league: League,
  result: LeagueMatchResult,
  curve?: PlacementCurve,
): { playerId: string; delta: number; trophies: number }[] {
  const seats = result.placements.length;
  if (curve !== undefined && curve.length < seats) {
    throw new RangeError(
      `applyMatchResult: curve has ${curve.length} positions for ${seats} finishers.`
      + ' The placement curve belongs to economy/trophyRoad.ts (placementCurve) and is passed in'
      + ' rather than invented here.',
    );
  }
  const out: { playerId: string; delta: number; trophies: number }[] = [];
  for (let pos = 0; pos < seats; pos++) {
    const entrant = enterLeague(league, result.placements[pos]);
    // ⚠️ THE ENTRANT'S OWN STANDING, READ BEFORE THE WRITE. `placementTrophyDelta` refuses an
    // out-of-range seat count or place rather than clamping, in the house style of
    // `sim.ts:createMatch` and `toWireSeats` below — a silently clamped payout is one nobody
    // can trace back to a match.
    const delta = curve !== undefined
      ? curve[pos]
      : placementTrophyDelta(pos, seats, entrant.trophies);
    // Trophies never go below zero — `economy/state.ts` holds the same floor for the same
    // reason, and a league that could push a player negative would disagree with the road.
    entrant.trophies = Math.max(0, entrant.trophies + delta);
    entrant.played++;
    if (pos < entrant.finishes.length) entrant.finishes[pos]++;
    out.push({ playerId: entrant.playerId, delta, trophies: entrant.trophies });
  }
  return out;
}

/**
 * Re-exported so a caller holding a `League` can price the whole field for DISPLAY without
 * reaching past this seam into `game/economy/`.
 *
 * ⚠️ **A RE-EXPORT, NOT A WRAPPER, AND THE DIFFERENCE IS THE WHOLE POINT.** A wrapper here
 * would be a second place the payout could be adjusted, which is the defect `twoSeatCurve` was.
 * This is the same function object; `nw_stack.mjs` asserts the identity rather than assuming it.
 * And note what it is FOR: `applyMatchResult` does **not** use it, because a real field sits at
 * different standings — see that function.
 */
export { placementCurve };

/**
 * Standings, best first.
 *
 * ⚠️ **THE COMPARATOR IS TOTAL AND ENDS ON `playerId`.** A sort whose comparator can return 0
 * for two distinct entries leaves their order to the engine's sort implementation — the same
 * hazard `sim.ts:resolveTimeout` avoids by ending its own tiebreak on the slot index, and the
 * same reason `state.ts` refuses a `Map`. A leaderboard that reshuffles equal-trophy players
 * on every render is a bug report nobody can reproduce.
 */
export function standings(league: League): LeagueEntrant[] {
  return [...league.entrants].sort((a, b) =>
    (b.trophies - a.trophies)
    || (b.finishes[0] - a.finishes[0])
    || (a.played - b.played)
    || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
}

/**
 * Where a league lives. **An interface with an in-memory implementation, and nothing else.**
 *
 * `DECISIONS §52` chose the host-peer form precisely so the whole architecture can be
 * exercised before a backend exists. Standing one up — Supabase, a Node service, anything — is
 * Uri's call and his money; this seam is what it would plug into. 🚨 Whatever implements it
 * must read its endpoint and credentials from the environment: **this repo is public and a
 * live key in it once forced a rewrite of all git history.**
 */
export interface LeagueStore {
  load(leagueId: string): Promise<League | null>;
  save(league: League): Promise<void>;
  record(leagueId: string, result: LeagueMatchResult): Promise<void>;
}

export function createMemoryLeagueStore(): LeagueStore {
  const leagues = new Map<string, League>();
  const results = new Map<string, LeagueMatchResult[]>();
  return {
    async load(leagueId) { return leagues.get(leagueId) ?? null; },
    async save(league) { leagues.set(league.id, league); },
    async record(leagueId, result) {
      const list = results.get(leagueId) ?? [];
      list.push(result);
      results.set(leagueId, list);
    },
  };
}
