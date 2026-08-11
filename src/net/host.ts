/**
 * THE HOST PEER — the only sim of record.
 *
 * `DECISIONS §52`, decided 2026-08-11: **authoritative simulation with local prediction, built
 * as a HOST PEER first and moved to a Node process later without touching `src/game/`.** This
 * class is that host. It holds the one `MatchState` anybody is allowed to believe, it is the
 * only thing that calls `stepMatch`, and it knows nothing about rendering, the DOM or Three.js
 * — so the *same file* is the Node dedicated server, unchanged, the day one exists.
 *
 * ── WHY IT IS AUTHORITATIVE AND NOT LOCKSTEP ───────────────────────────────────
 *
 * Measured, not argued (`docs/NETCODE.md`): a six-human tick is **2.66 µs**, 0.016% of real
 * time, ≈6,260 concurrent matches per core. Server CPU is the **only** resource lockstep saves
 * and here it is free. Lockstep's price is bit-identical `Math.hypot`/trig across V8,
 * JavaScriptCore and SpiderMonkey over **32 implementation-approximated call sites** — a
 * requirement no measurement in this repo can discharge. The host does not care what a
 * client's `Math.hypot` returns, because a client's arithmetic never decides anything.
 *
 * ── THE INPUT RULE, STATED ONCE ────────────────────────────────────────────────
 *
 * **The host applies the NEWEST input it has received from a seat, and HOLDS it when nothing
 * new arrives.** That is the whole policy. Two consequences worth being explicit about:
 *
 *   * ⚠️ **The host's output depends on ARRIVAL, which is not deterministic across runs.**
 *     That is inherent to networking and it is not a loss of the property this project
 *     depends on. The determinism that underwrites every balance number is *"the same inputs
 *     produce the same match"*, and it is **preserved in the form that matters**: `inputLog`
 *     records the exact `(tick, inputs[])` sequence the host applied, and `replayInputLog`
 *     reproduces the final state **bit-identically** from a fresh `createMatch`. A live match
 *     is a recording; the recording is deterministic. `nw_stack.mjs` proves it rather than
 *     claiming it.
 *   * **A missing packet is a repeated input, not a stall.** Holding is what makes a 5% loss
 *     link produce a slightly stale fighter instead of a stuttering one, and it is why the
 *     ack in the snapshot is the input's own TICK TAG rather than a count.
 *
 * ── SLOT IDENTITY AND AUTHORITY ────────────────────────────────────────────────
 *
 * 🚨 **A CLIENT MAY SEND INPUTS FOR ITS OWN SEAT AND FOR NO OTHER.** `handleInput` checks the
 * frame's seat mask against the sender's slot and answers a `reject: 'authority'` otherwise.
 * That check is worth having in the loopback, where it can never fire, because it is the seam
 * that has to exist before a real channel is attached — and because `NETCODE.md` §8 names
 * cheating as one of the three reasons this design was chosen at all: under lockstep or
 * rollback every client holds the full state, which makes `DECISIONS §29`'s concealment
 * decoration against a modified client.
 */

import { createMatch, stepMatch, type FighterConfig } from '../game/sim.ts';
import type { CharacterId } from '../game/rules.ts';
import type { GameEvent, MatchInput, MatchState } from '../game/state.ts';
import type { ArenaDefinition } from '../arena/types.ts';
import { b64ToBytes, decodeInputFrame, quantizeInput } from './inputCodec.ts';
import { arenaFingerprint, encodeMatchState } from './wire.ts';
import {
  PROTOCOL_VERSION,
  type NetMessage,
  type PeerId,
  type Slot,
  type WireSeat,
} from './protocol.ts';
import { WIRE_VERSION } from './wire.ts';
import type { Transport } from './transport.ts';

/** How many ticks of client input the host keeps per seat. 64 ticks ≈ 1.07 s at 59.999 Hz. */
const INPUT_RING = 64;

export interface HostSessionOptions {
  transport: Transport;
  arena: ArenaDefinition;
  /** Slot-ordered. `seats[i].slot` must equal `i`; the constructor asserts it. */
  seats: readonly WireSeat[];
  /** Fixed step, ms. Default 1000/60 — `match.ts`'s own budget. */
  dtMs?: number;
  /** Ticks between authoritative snapshots. Default 3 (≈20 Hz), per `NET_CONFIG_DEFAULTS`. */
  snapshotEveryTicks?: number;
  /** Record `(tick, inputs[])` so the match is exactly replayable. Default true. */
  recordInputLog?: boolean;
}

export interface AppliedTick {
  tick: number;
  inputs: (MatchInput | null)[];
}

interface SeatBuffer {
  /** Newest input received, and the tick tag the sender put on it. `-1` = nothing yet. */
  latestTick: number;
  latest: MatchInput | null;
  /** The tick tag of the input most recently APPLIED. This is what the client acks against. */
  appliedTick: number;
  /** Ring of received frames, for diagnostics and for a future re-order window. */
  ring: ({ tick: number; input: MatchInput } | null)[];
  received: number;
  stale: number;
}

export class HostSession {
  readonly arena: ArenaDefinition;
  readonly dtMs: number;
  readonly seats: readonly WireSeat[];

  private readonly transport: Transport;
  private readonly snapshotEveryTicks: number;
  private readonly buffers: SeatBuffer[];
  /**
   * ⚠️ **AN ARRAY INDEXED BY SLOT, NOT A `Map<PeerId, Slot>`.** `slotOfPeer` is a linear scan
   * over at most six entries. `state.ts` refuses a keyed container for the fighter list
   * because *"a `Map` traverses in INSERTION order … the classic lockstep-desync mechanism"*,
   * and the same argument reaches anything that decides seat order. Six comparisons is not a
   * cost worth paying a keyed container for.
   */
  private readonly peerOfSlot: (PeerId | null)[];

  private matchState: MatchState | null = null;
  private tickNo = 0;
  private started = false;
  private pendingEvents: GameEvent[] = [];
  private readonly unsubscribe: () => void;

  readonly inputLog: AppliedTick[] = [];
  private readonly recordInputLog: boolean;

  /** Live counters, so a gate can assert traffic instead of trusting it. */
  readonly stats = { inputsAccepted: 0, inputsRejected: 0, snapshotsSent: 0, ticks: 0 };

  constructor(opts: HostSessionOptions) {
    this.transport = opts.transport;
    this.arena = opts.arena;
    this.seats = opts.seats;
    this.dtMs = opts.dtMs ?? 1000 / 60;
    this.snapshotEveryTicks = Math.max(1, Math.trunc(opts.snapshotEveryTicks ?? 3));
    this.recordInputLog = opts.recordInputLog !== false;

    for (let i = 0; i < this.seats.length; i++) {
      if (this.seats[i].slot !== i) {
        throw new RangeError(`HostSession: seats[${i}].slot is ${this.seats[i].slot};`
          + ' the seat list must be in slot order (slot identity is a game rule, DECISIONS §49a)');
      }
    }

    this.buffers = this.seats.map(() => ({
      latestTick: -1,
      latest: null,
      appliedTick: -1,
      ring: new Array<{ tick: number; input: MatchInput } | null>(INPUT_RING).fill(null),
      received: 0,
      stale: 0,
    }));
    this.peerOfSlot = this.seats.map((s) => s.peer);

    this.unsubscribe = this.transport.onMessage((from, msg) => { this.handle(from, msg); });
  }

  get state(): MatchState {
    if (!this.matchState) throw new Error('HostSession: start() has not run');
    return this.matchState;
  }
  get tick(): number { return this.tickNo; }
  get isStarted(): boolean { return this.started; }

  slotOfPeer(peer: PeerId): Slot | null {
    for (let i = 0; i < this.peerOfSlot.length; i++) if (this.peerOfSlot[i] === peer) return i;
    return null;
  }

  /**
   * Per-seat receipt counters, slot-ordered. Read-only copies.
   *
   * `stale` is the one worth watching: it counts frames dropped because they carried a tick tag
   * the host had already passed, i.e. **re-ordered or duplicated packets**. A link with jitter
   * produces them constantly and a link without them should produce none, so a non-zero count
   * on a clean link means something upstream is retransmitting.
   */
  seatStats(): { slot: Slot; received: number; stale: number; latestTick: number; appliedTick: number }[] {
    return this.buffers.map((b, slot) => ({
      slot,
      received: b.received,
      stale: b.stale,
      latestTick: b.latestTick,
      appliedTick: b.appliedTick,
    }));
  }

  /**
   * Build the authoritative match and tell everybody how to build the same one.
   *
   * ⚠️ **THE SPAWNS GO ON THE WIRE AS COORDINATES.** `NETCODE.md` §7: a derived ring spawn is
   * `Math.cos`/`Math.sin`, two implementation-approximated call sites, so re-deriving it on
   * each client is *"a potential desync at tick 0, before anybody has moved."* `sim.ts` already
   * refuses to invent one; this sends the host's choice.
   */
  start(): void {
    if (this.started) throw new Error('HostSession: already started');
    this.matchState = createMatch(this.arena, this.seats.map(toFighterConfig));
    this.started = true;
    this.tickNo = 0;
    this.transport.broadcast({
      t: 'match-start',
      arenaId: this.arena.id,
      arenaFingerprint: arenaFingerprint(this.arena),
      seats: this.seats.map((s) => ({ ...s })),
      dtMs: this.dtMs,
      tick: 0,
    });
    // Tick 0's snapshot: a joining client must never render an unsynchronised first frame.
    this.sendSnapshot([]);
  }

  /** One authoritative tick. Returns the events it produced, for a local renderer on the host. */
  step(): GameEvent[] {
    const state = this.state;
    const inputs: (MatchInput | null)[] = this.buffers.map((b) => {
      if (b.latest === null) return null;
      b.appliedTick = b.latestTick;
      return b.latest;
    });
    const events = stepMatch(state, this.dtMs, inputs);
    this.tickNo++;
    this.stats.ticks++;
    if (this.recordInputLog) {
      // A COPY of each input, because the buffer's object is the one the decoder produced and
      // a later frame from the same seat would otherwise rewrite history in the log.
      this.inputLog.push({ tick: this.tickNo, inputs: inputs.map((i) => (i ? { ...i, move: { ...i.move }, ...(i.aim ? { aim: { ...i.aim } } : {}) } : null)) });
    }
    this.pendingEvents.push(...events);
    if (this.tickNo % this.snapshotEveryTicks === 0) this.sendSnapshot(inputs);
    return events;
  }

  /**
   * Replay `inputLog` through a fresh `createMatch` and return the resulting state.
   *
   * 🚨 **THIS IS THE PROOF THAT THE NETWORK DID NOT COST THE DETERMINISM.** The result must be
   * bit-identical to `this.state` — `wire.ts:diffStates` returns empty — because `stepMatch` is
   * a pure function of `(state, dt, inputs)` and the log is exactly the third argument it was
   * handed, in order. If this ever disagrees, something in the host has started depending on
   * wall-clock time, on iteration order, or on a value it did not record.
   */
  replayInputLog(): MatchState {
    if (!this.recordInputLog) throw new Error('HostSession: recordInputLog was disabled');
    const replay = createMatch(this.arena, this.seats.map(toFighterConfig));
    for (const row of this.inputLog) stepMatch(replay, this.dtMs, row.inputs);
    return replay;
  }

  close(): void {
    this.unsubscribe();
    this.transport.broadcast({ t: 'bye', reason: 'host closed' });
  }

  // ───────────────────────────────────────────────────────────────────────────

  private handle(from: PeerId, msg: NetMessage): void {
    switch (msg.t) {
      case 'hello': {
        if (msg.protocol !== PROTOCOL_VERSION || msg.wire !== WIRE_VERSION) {
          this.transport.send(from, {
            t: 'reject',
            code: 'version',
            detail: `host speaks protocol ${PROTOCOL_VERSION} / wire ${WIRE_VERSION};`
              + ` peer offered ${msg.protocol} / ${msg.wire}`,
          });
          return;
        }
        this.transport.send(from, {
          t: 'welcome',
          protocol: PROTOCOL_VERSION,
          wire: WIRE_VERSION,
          peer: from,
          slot: this.slotOfPeer(from),
        });
        // ── WHAT A JOINING CLIENT RECEIVES, AND IT IS THE SAME TWO MESSAGES EVERY TIME ──
        //
        // `match-start` then a full `snapshot`. There is no separate "late join" path and
        // there deliberately is not one: a client that joins at tick 0 and a client that
        // joins at tick 900 run the identical code, so the rarer of the two cannot rot. The
        // snapshot is a FULL state, which is what makes that possible — `NETCODE.md` §2
        // measured the dumbest option (a full JSON snapshot 20x a second at six seats) at
        // 158.7 KiB/s and concluded *"that is a bad protocol, and it still fits on a phone."*
        // A delta protocol would need a keyframe for exactly this moment anyway.
        if (this.started && this.matchState) {
          this.transport.send(from, {
            t: 'match-start',
            arenaId: this.arena.id,
            arenaFingerprint: arenaFingerprint(this.arena),
            seats: this.seats.map((s) => ({ ...s })),
            dtMs: this.dtMs,
            tick: this.tickNo,
          });
          this.transport.send(from, {
            t: 'snapshot',
            tick: this.tickNo,
            state: encodeMatchState(this.matchState),
            // ⚠️ NOT `this.pendingEvents` — those already played for everyone else and a
            // joiner must not be handed a backlog of explosions that happened before it
            // arrived. It gets the STATE they produced, which is the whole point of the
            // state being authoritative.
            events: [],
            ackTick: this.buffers.map((b) => b.appliedTick),
            applied: [],
          });
        }
        return;
      }
      case 'input': return this.handleInput(from, msg.b);
      case 'bye': return;
      default: return;   // clients do not send anything else; ignore rather than throw
    }
  }

  private handleInput(from: PeerId, b64: string): void {
    const slot = this.slotOfPeer(from);
    if (slot === null) {
      this.stats.inputsRejected++;
      this.transport.send(from, { t: 'reject', code: 'authority', detail: 'peer holds no seat' });
      return;
    }
    let frame: ReturnType<typeof decodeInputFrame>;
    try {
      frame = decodeInputFrame(b64ToBytes(b64));
    } catch (e) {
      this.stats.inputsRejected++;
      this.transport.send(from, { t: 'reject', code: 'malformed', detail: String(e) });
      return;
    }
    // 🚨 THE AUTHORITY CHECK. Exactly one bit, and it must be this peer's own seat.
    if (frame.seatMask !== (1 << slot)) {
      this.stats.inputsRejected++;
      this.transport.send(from, {
        t: 'reject',
        code: 'authority',
        detail: `peer holds slot ${slot} but the frame claims mask 0x${frame.seatMask.toString(16)}`,
      });
      return;
    }
    const input = frame.inputs[slot];
    if (!input) {
      this.stats.inputsRejected++;
      this.transport.send(from, { t: 'reject', code: 'malformed', detail: 'seat mask set with no seat body' });
      return;
    }
    const buf = this.buffers[slot];
    buf.received++;
    buf.ring[frame.tick % INPUT_RING] = { tick: frame.tick, input };
    if (frame.tick <= buf.latestTick) {
      // A re-ordered or duplicated frame. DROPPED rather than applied: applying it would move
      // the seat BACKWARDS in time, which is worse than the 16.7 ms of staleness it saves.
      buf.stale++;
      return;
    }
    buf.latestTick = frame.tick;
    // ⚠️ Re-quantised on receipt. The decoder already produces quantised values, so this is a
    // no-op today — and it is the line that keeps being true if the encoding ever gains a
    // field the decoder rounds differently from the sender. The host simulates what IT
    // decoded, never what the sender says it meant.
    buf.latest = quantizeInput(input);
    this.stats.inputsAccepted++;
  }

  private sendSnapshot(applied: (MatchInput | null)[]): void {
    const state = this.state;
    const msg: NetMessage = {
      t: 'snapshot',
      tick: this.tickNo,
      state: encodeMatchState(state),
      events: this.pendingEvents,
      ackTick: this.buffers.map((b) => b.appliedTick),
      applied: applied.map((i) => (i ? { ...i } : null)),
    };
    this.pendingEvents = [];
    this.transport.broadcast(msg);
    this.stats.snapshotsSent++;
  }
}

function toFighterConfig(seat: WireSeat): FighterConfig {
  const cfg: FighterConfig = {
    characterId: seat.characterId as CharacterId,
    controller: seat.peer === null ? 'ai' : 'human',
    level: seat.level,
    spawn: { x: seat.spawn.x, y: seat.spawn.y },
  };
  if (seat.facing) cfg.facing = { x: seat.facing.x, y: seat.facing.y };
  return cfg;
}
