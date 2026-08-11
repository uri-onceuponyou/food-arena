/**
 * THE MESSAGE PROTOCOL — what actually crosses the boundary.
 *
 * One union, discriminated on `t`, carrying JSON-safe values only. It is deliberately
 * transport-agnostic: `transport.ts` decides framing, `host.ts`/`client.ts` decide meaning, and
 * nothing here knows whether the far side is a WebRTC DataChannel, a WebSocket, a Worker
 * `postMessage` or the in-process loopback.
 *
 * ── 🚨 SLOT IDENTITY IS ON THE WIRE AS AN ARRAY POSITION, NEVER AS A KEY ────────
 *
 * `seats` is `(PeerId | null)[]` indexed by slot. It is **not** `Record<PeerId, number>` and
 * not a `Map`, and that is a game rule rather than a serialisation preference. Slot order
 * decides three things the sim states out loud:
 *
 *   * who acts first inside a tick (`sim.ts`'s fighter loop walks `state.fighters` in slot
 *     order — "who fires first, and whose trail mark exists before the other walks over it");
 *   * `nearestLivingOpponent`'s tie break (`<` not `<=`, so the lower slot keeps a tie);
 *   * `resolveTimeout`'s rung 3 — `DECISIONS §49a`, Uri: *"Fewest deaths, then lower slot"*.
 *
 * ⚠️ §49a's rung 3 is **inert today** (`deaths ∈ {0,1}` and rung 1 has already sorted every
 * corpse below every survivor, and `DECISIONS §2`'s sudden death should make a timeout
 * unreachable at all) — and it becomes live the day respawns exist. So a lobby that always
 * hands the earliest joiner slot 0 is handing out a real, if currently unreachable, advantage.
 * `lobby.ts:shuffleSeats` is the seeded, auditable answer; the *default* is join order, stated
 * where it can be seen rather than buried.
 *
 * ── WHAT IS NOT HERE, AND WHY ──────────────────────────────────────────────────
 *
 * There is **no signalling, no matchmaking service, no room server and no credentials**, and
 * no field that would carry any. `DECISIONS §52` chose a HOST PEER first precisely so the
 * authoritative architecture can be exercised end to end before anybody stands a backend up;
 * standing one up is Uri's call. This repo is public, so nothing configurable ever gets a
 * default that is a real endpoint — see `NetConfig` at the bottom.
 */

import type { GameEvent, MatchInput } from '../game/state.ts';
import type { WireDelta } from './delta.ts';
import type { WireState } from './wire.ts';

/**
 * PROTOCOL VERSION. Bumped whenever a message's meaning changes, and checked in `hello`.
 *
 * ⚠️ Separate from `wire.ts`'s `WIRE_VERSION`, which versions the STATE encoding. They move for
 * different reasons: adding a message is a protocol change and no state-encoding change at all.
 */
export const PROTOCOL_VERSION = 1;

/** A transport-assigned participant handle. Opaque; never an index into anything. */
export type PeerId = string;

/** A seat index into `MatchState.fighters`. THE fighter's identity — see `state.ts:FighterId`. */
export type Slot = number;

/** Everything a seat needs to be built, in a form that survives a text channel. */
export interface WireSeat {
  slot: Slot;
  /** `null` for a seat filled by a bot. */
  peer: PeerId | null;
  characterId: string;
  level: number;
  /**
   * ⚠️ **COORDINATES, NEVER A FORMULA.** `NETCODE.md` §7 (§49d) makes this a protocol rule:
   * a derived ring spawn is `Math.cos`/`Math.sin`, two of the five implementation-approximated
   * call sites, so **a derived spawn is a potential disagreement at tick 0 before anybody has
   * moved.** `sim.ts:createMatch` already refuses to invent one and `arena.spawns` already
   * holds them as data; this field carries the host's choice so no client re-derives it.
   */
  spawn: { x: number; y: number };
  facing?: { x: number; y: number };
}

export type NetMessage =
  /** client -> host, first thing on the channel. */
  | { t: 'hello'; protocol: number; wire: number; name?: string }
  /** host -> client. `slot` is null for a spectator or a full lobby. */
  | { t: 'welcome'; protocol: number; wire: number; peer: PeerId; slot: Slot | null; reason?: string }
  /** host -> client, whenever the lobby changes. */
  | { t: 'lobby'; seats: (PeerId | null)[]; ready: boolean[]; status: LobbyStatus }
  /**
   * host -> client. Everything needed to build the SAME `createMatch` call the host made.
   *
   * `arenaFingerprint` is the drift control (`wire.ts`): it answers *"is it the same arena?"*,
   * not *"did an arena arrive?"*. A client on a stale bundle would resolve every arena
   * reference to a real box and some of them to the wrong one.
   */
  | {
      t: 'match-start';
      arenaId: string;
      arenaFingerprint: string;
      seats: WireSeat[];
      /** Fixed simulation step, ms. The host's tick and the client's must denominate the same. */
      dtMs: number;
      /** The host's tick number at `createMatch`. Always 0 today; explicit so a rejoin can differ. */
      tick: number;
    }
  /** client -> host. `b` is `encodeInputFrame` output in base64. */
  | { t: 'input'; b: string }
  /**
   * host -> client. The authoritative state, plus the events that produced it.
   *
   * ⚠️ **THE EVENTS TRAVEL WITH THE STATE, AND THAT IS WHAT BUYS OUT OF ROLLBACK'S BILL.**
   * `NETCODE.md` §3 costed the thing every re-simulating design pays: `stepMatch` **returns**
   * `GameEvent[]`, four consumers are built on it (`match.ts`, `vfx.ts`, `hud.ts`,
   * `audio/director.ts`), and re-simulating a tick **re-fires its events** — ~2.7 of them per
   * 8-tick replay, every one a damage number, an explosion, a hit-stop and a note of the score.
   * A client that predicted its own events would have to make all four consumers idempotent.
   *
   * It does not. The client's prediction moves PIXELS only; the event stream it hands to VFX,
   * HUD and audio is this one — authoritative, delivered once, never replayed and never
   * retracted. Prediction's replay discards its own events (`client.ts`).
   */
  | {
      t: 'snapshot';
      tick: number;
      state: WireState;
      events: GameEvent[];
      /** Per slot: the input tick the host last APPLIED. The client replays strictly after it. */
      ackTick: number[];
      /**
       * The input the host applied on this tick, per slot, as a base64 `encodeInputFrame`.
       *
       * 🚨 **IT WENT THROUGH THE INPUT CODEC BECAUSE MEASURING SAID SO.** It was a raw
       * `(MatchInput | null)[]` until `nw_stack.mjs` X6 put a number on it: at six seats the
       * JSON form is **~540 B against a ~1,500 B delta — a third of the message**, which is
       * absurd for a field the client uses only to replay remote seats. `inputCodec.ts` exists
       * to make an input 7 bytes and was being used in exactly one direction.
       *
       * ⚠️ It also makes the two directions agree by construction: the host now replays what it
       * *decoded*, and the client replays the same decode of the same bytes, so a quantisation
       * that disagreed between them could not survive the round trip unnoticed.
       */
      applied: string;
    }
  /**
   * host -> client. The same payload as `snapshot`, minus the ~96% of it the receiver already
   * has (`delta.ts`).
   *
   * 🚨 **`base` IS NOT BOOKKEEPING — IT IS THE ONLY THING BETWEEN A CLIENT AND A PLAUSIBLE,
   * WRONG MATCH.** A delta applied to a base of the same SHAPE but a different tick resolves
   * every index, lands every value somewhere real, and decodes to a state that passes every
   * integrity invariant while being no tick of any match — measured in `nw_delta.mjs` D5. A
   * receiver whose base is not `base` must discard it and ask for a keyframe, never apply it.
   * (A base of a DIFFERENT shape is caught structurally by `patchWire`; only the same-shape
   * case is silent, which is exactly why the tick is on the wire.)
   */
  | {
      t: 'delta';
      tick: number;
      base: number;
      d: WireDelta;
      events: GameEvent[];
      ackTick: number[];
      /** Base64 `encodeInputFrame` — see `snapshot.applied`. */
      applied: string;
    }
  /**
   * client -> host: "I cannot use your deltas; send me a keyframe."
   *
   * Sent on a base mismatch, a version mismatch, or a first delta before any snapshot. `have`
   * is the tick the client is actually on, so the host can log the gap rather than guess it.
   * ⚠️ The host answers with its **current baseline**, not a fresh encode — a keyframe that is
   * not the baseline would leave the client one tick off it and resyncing forever.
   */
  | { t: 'resync'; have: number }
  /** either direction. */
  | { t: 'bye'; reason?: string }
  /** host -> client, when a client did something it is not allowed to do. */
  | { t: 'reject'; code: RejectCode; detail: string };

export type LobbyStatus = 'open' | 'starting' | 'in-match' | 'closed';

export type RejectCode =
  /** `hello` carried a protocol or wire version this host does not speak. */
  | 'version'
  /** An input frame claimed a seat the sender does not hold. THE anti-cheat seam. */
  | 'authority'
  /** A malformed frame. */
  | 'malformed'
  /** The lobby is full or already in a match. */
  | 'full';

/**
 * Configuration, and the security rule that governs it permanently.
 *
 * 🚨 **THIS REPO IS PUBLIC. NO KEY, TOKEN, CREDENTIAL OR REAL ENDPOINT MAY EVER BE WRITTEN
 * INTO A COMMITTED FILE HERE.** The prototypes under `reference/` were once stripped from all
 * git history because one contained a live Supabase key. Every field below therefore reads
 * from the environment (or from a runtime-injected global in the browser) and **defaults to a
 * value that connects to nothing.** A default of `''` is a feature: the loopback stack is
 * fully exercisable with no configuration at all, so nobody ever needs to paste an endpoint in
 * to run the gates.
 */
export interface NetConfig {
  /** Signalling endpoint. Default `''` — meaning "no network; loopback only". */
  signalUrl: string;
  /** ICE servers for a future WebRTC transport. Default `[]` — a LAN-only peer connection. */
  iceServers: readonly { urls: string }[];
  /** How many ticks between authoritative snapshots. 3 ticks ≈ 20 Hz at the shipped 59.999 Hz. */
  snapshotEveryTicks: number;
}

export const NET_CONFIG_DEFAULTS: NetConfig = {
  signalUrl: '',
  iceServers: [],
  snapshotEveryTicks: 3,
};

/**
 * Read config from the environment, with connect-to-nothing defaults.
 *
 * Works in Node (`process.env`) and in the browser (`globalThis.__NET_CONFIG`, which a wrapper
 * or an index.html can inject at runtime). Neither source is required and neither is committed.
 */
export function readNetConfig(): NetConfig {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const injected = (globalThis as { __NET_CONFIG?: Partial<NetConfig> }).__NET_CONFIG ?? {};
  const every = Number(env.FA_SNAPSHOT_TICKS ?? injected.snapshotEveryTicks ?? NET_CONFIG_DEFAULTS.snapshotEveryTicks);
  return {
    signalUrl: env.FA_SIGNAL_URL ?? injected.signalUrl ?? NET_CONFIG_DEFAULTS.signalUrl,
    iceServers: injected.iceServers ?? NET_CONFIG_DEFAULTS.iceServers,
    snapshotEveryTicks: Number.isFinite(every) && every >= 1 ? Math.trunc(every) : NET_CONFIG_DEFAULTS.snapshotEveryTicks,
  };
}
