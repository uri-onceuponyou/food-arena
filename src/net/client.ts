/**
 * THE CLIENT — local prediction over an authoritative state, and the reconciliation that
 * keeps the two honest.
 *
 * `DECISIONS §52`: *"authoritative simulation with local prediction."* This is the prediction
 * half. It is deliberately the smallest thing that deserves the name:
 *
 *   * **`view` is what the renderer draws.** It is the authoritative state plus every input
 *     this client has sent that the host has not yet acknowledged, re-applied on top.
 *   * **`drainEvents()` is what VFX, the HUD and audio consume**, and it comes **from the
 *     host, untouched.** Prediction never emits an event.
 *
 * ── 🚨 WHY THE EVENT STREAM IS NOT PREDICTED, AND WHAT THAT BUYS ───────────────
 *
 * `stepMatch` **returns** `GameEvent[]`, and `docs/NETCODE.md` §3 priced the consequence for
 * every re-simulating design: four consumers are built on that stream (`game/match.ts`,
 * `game/vfx.ts`, `ui/hud.ts`, `audio/director.ts`), the corpus runs **0.335 events/tick**, and
 * *"re-simulating a tick re-emits its events"* — so an 8-tick replay re-fires ~2.7 damage
 * numbers, explosions, hit-stops and score notes that already played. Making all four
 * consumers idempotent is *"not a hard problem; it is a whole subsystem, and it is invisible
 * until you build it."*
 *
 * **This client does not build it.** Replay discards its own events (`REPLAY_DISCARDS_EVENTS`
 * below is the single line that does it, named so it is greppable), and the only events that
 * reach a consumer are the ones the host put in the snapshot. The cost of that choice is
 * honest and stated: **a hit you predicted does not flash until the host confirms it**, i.e.
 * damage feedback carries the full one-way latency where movement does not. That is the
 * standard trade and it is the one `NETCODE.md` §7 (§49b) predicted would matter most — *"a
 * mispredicted trail bite paints a damage number that then un-happens, the most visible
 * misprediction artefact this game can produce."* We never paint it, so it never un-happens.
 *
 * ── WHAT PREDICTION DOES AND DOES NOT COVER ────────────────────────────────────
 *
 * Replay steps the **whole sim**, not just the local fighter — `stepMatch` has no narrower
 * entry point and inventing one would be a change inside `src/game/`, which this file set may
 * not make. So bots, projectiles and the fog ring are all advanced during replay too. That is
 * *more* prediction than the design calls for, and it costs what `NETCODE.md` §5 measured:
 * `stepAI` is **65.995 µs/call** and 99.2% of an all-bot tick, so a replay depth of *d* over
 * *k* bots costs roughly `d × k × 66 µs`. At d=8, k=5 that is **2.6 ms — 16% of a 16.7 ms
 * frame.** ⚠️ **The remedy is not more code here; it is fewer bots or a shallower replay**,
 * and the number is printed by `nw_stack.mjs` so it can be watched rather than assumed.
 *
 * Remote human seats replay with the **last input the host applied for them** (carried in the
 * snapshot, 7 B/seat) rather than frozen at neutral. Freezing is the cheaper thing and it is
 * visibly wrong: every other fighter stutters to a halt for the replay window and then
 * teleports.
 */

import { createMatch, stepMatch, type FighterConfig } from '../game/sim.ts';
import type { CharacterId } from '../game/rules.ts';
import type { GameEvent, MatchInput, MatchState } from '../game/state.ts';
import type { ArenaDefinition } from '../arena/types.ts';
import { bytesToB64, encodeInputFrame, neutralInput, quantizeInput } from './inputCodec.ts';
import { arenaFingerprint, cloneMatchState, decodeMatchState, WIRE_VERSION } from './wire.ts';
import { PROTOCOL_VERSION, type NetMessage, type PeerId, type Slot, type WireSeat } from './protocol.ts';
import type { Transport } from './transport.ts';

/** Sent inputs kept for replay. 64 ticks ≈ 1.07 s — far past any playable RTT. */
const SENT_RING = 64;

export interface ClientSessionOptions {
  transport: Transport;
  hostPeer: PeerId;
  /**
   * The client's OWN arena object.
   *
   * ⚠️ Not the host's, even in-process. The decoded state's `arena` is this object and every
   * `brokenConcealment` entry resolves into it, which is what keeps
   * `movement.ts:isConcealed`'s reference-identity test meaningful on this side.
   * `arenaFingerprint` is checked against the host's on `match-start`, so a client on a stale
   * bundle is told, rather than quietly resolving references to the wrong plates.
   */
  arena: ArenaDefinition;
  name?: string;
}

export interface ReconcileReport {
  /** Host tick the snapshot was taken at. */
  tick: number;
  /** Inputs re-applied on top of it. */
  replayed: number;
  /**
   * How far the local fighter moved when the authoritative state replaced the predicted one,
   * in world units.
   *
   * ⚠️ **STATE ITS FLOOR BEFORE ACTING ON IT: this metric is EXACT, not noisy.** It is a
   * paired comparison of two positions computed from the same seed on the same tick, so 0.0
   * means bit-identical and any non-zero value is a real disagreement — the same distinction
   * `CLAUDE.md` #10 draws between a paired per-matchup delta (exact) and an aggregate (±9 pp).
   * Do not apply a tolerance to it. At zero latency it is 0.0 and `nw_stack.mjs` requires that.
   */
  errorWu: number;
}

export class ClientSession {
  readonly arena: ArenaDefinition;

  private readonly transport: Transport;
  private readonly hostPeer: PeerId;
  private readonly unsubscribe: () => void;

  private slotNo: Slot | null = null;
  private seats: readonly WireSeat[] = [];
  private dtMs = 1000 / 60;

  private authoritative: MatchState | null = null;
  private predicted: MatchState | null = null;

  /** Ring of inputs this client has sent, for replay. */
  private readonly sent: ({ tick: number; input: MatchInput } | null)[] =
    new Array<{ tick: number; input: MatchInput } | null>(SENT_RING).fill(null);
  private sendTick = 0;
  /** Highest input tick the host has acknowledged applying for this client's seat. */
  private ackTick = -1;
  /** The host's last-applied input per slot, used to replay REMOTE seats. */
  private remoteApplied: (MatchInput | null)[] = [];

  private events: GameEvent[] = [];
  private lastReconcile: ReconcileReport | null = null;

  readonly stats = {
    snapshots: 0,
    inputsSent: 0,
    replayed: 0,
    /** Highest single reconciliation displacement seen, wu. */
    maxErrorWu: 0,
    /** Sum of reconciliation displacements, wu — divide by `snapshots` for the mean. */
    sumErrorWu: 0,
    rejects: 0,
    /** Set if `match-start` carried an arena fingerprint this client cannot match. */
    arenaMismatch: false,
  };

  constructor(opts: ClientSessionOptions) {
    this.transport = opts.transport;
    this.hostPeer = opts.hostPeer;
    this.arena = opts.arena;
    this.unsubscribe = this.transport.onMessage((from, msg) => {
      if (from !== this.hostPeer) return;   // only the host is believed, by construction
      this.handle(msg);
    });
    this.transport.send(this.hostPeer, {
      t: 'hello',
      protocol: PROTOCOL_VERSION,
      wire: WIRE_VERSION,
      ...(opts.name === undefined ? {} : { name: opts.name }),
    });
  }

  get slot(): Slot | null { return this.slotNo; }
  get ready(): boolean { return this.predicted !== null; }
  /** What the renderer draws: authoritative + this client's unacknowledged inputs. */
  get view(): MatchState {
    if (!this.predicted) throw new Error('ClientSession: no match yet');
    return this.predicted;
  }
  /** The last state the host actually vouched for. Useful for diagnostics; do not render it. */
  get confirmed(): MatchState {
    if (!this.authoritative) throw new Error('ClientSession: no match yet');
    return this.authoritative;
  }
  get reconcile(): ReconcileReport | null { return this.lastReconcile; }

  /**
   * Send this tick's input and predict its effect.
   *
   * 🚨 **RETURNS THE QUANTISED INPUT, AND THAT RETURN IS THE POINT.** `inputCodec.ts` states
   * the rule: *the quantised value must BE the canonical input*. A caller that fed its own sim
   * the raw value it passed in here would be simulating a slightly different match from the
   * host on every tick, forever. Here the value that is predicted, the value that is stored
   * for replay and the value that goes on the wire are **one object**, so the three cannot
   * disagree by construction rather than by discipline.
   */
  sendInput(raw: MatchInput): MatchInput {
    if (!this.predicted || this.slotNo === null) return quantizeInput(raw);
    const input = quantizeInput(raw);
    const tick = this.sendTick++;
    this.sent[tick % SENT_RING] = { tick, input };

    const frame: (MatchInput | null)[] = new Array<MatchInput | null>(this.slotNo + 1).fill(null);
    frame[this.slotNo] = input;
    this.transport.send(this.hostPeer, { t: 'input', b: bytesToB64(encodeInputFrame(tick, frame)) });
    this.stats.inputsSent++;

    // Predict: advance the local view by exactly the tick the host will run.
    stepMatch(this.predicted, this.dtMs, this.inputsFor(input));
    return input;
  }

  /** Authoritative events since the last drain. Hand these to VFX / HUD / audio. */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  close(): void {
    this.unsubscribe();
    this.transport.send(this.hostPeer, { t: 'bye' });
  }

  // ───────────────────────────────────────────────────────────────────────────

  private inputsFor(local: MatchInput | null): (MatchInput | null)[] {
    const n = this.seats.length;
    const out: (MatchInput | null)[] = new Array<MatchInput | null>(n).fill(null);
    for (let i = 0; i < n; i++) out[i] = this.remoteApplied[i] ?? null;
    if (this.slotNo !== null) out[this.slotNo] = local;
    return out;
  }

  private handle(msg: NetMessage): void {
    switch (msg.t) {
      case 'welcome': {
        this.slotNo = msg.slot;
        return;
      }
      case 'match-start': {
        this.seats = msg.seats;
        this.dtMs = msg.dtMs;
        // ── THE DRIFT CONTROL. "Did an arena arrive" is not the question. ──
        this.stats.arenaMismatch = arenaFingerprint(this.arena) !== msg.arenaFingerprint;
        const built = createMatch(this.arena, msg.seats.map(toFighterConfig));
        this.authoritative = built;
        this.predicted = cloneMatchState(built);
        this.remoteApplied = new Array<MatchInput | null>(msg.seats.length).fill(null);
        this.sendTick = msg.tick;
        this.ackTick = msg.tick - 1;
        return;
      }
      case 'snapshot': {
        this.stats.snapshots++;
        this.events.push(...msg.events);
        const before = this.localPos();
        this.authoritative = decodeMatchState(msg.state, this.arena);
        this.remoteApplied = msg.applied.length > 0 ? msg.applied.slice() : this.remoteApplied;
        if (this.slotNo !== null && msg.ackTick[this.slotNo] !== undefined) {
          this.ackTick = msg.ackTick[this.slotNo];
        }
        const replayed = this.rebuildPrediction();
        const after = this.localPos();
        const errorWu = before && after ? Math.sqrt((after.x - before.x) ** 2 + (after.y - before.y) ** 2) : 0;
        this.stats.replayed += replayed;
        this.stats.sumErrorWu += errorWu;
        if (errorWu > this.stats.maxErrorWu) this.stats.maxErrorWu = errorWu;
        this.lastReconcile = { tick: msg.tick, replayed, errorWu };
        return;
      }
      case 'reject': {
        this.stats.rejects++;
        return;
      }
      default: return;
    }
  }

  private localPos(): { x: number; y: number } | null {
    if (!this.predicted || this.slotNo === null) return null;
    const f = this.predicted.fighters[this.slotNo];
    return f ? { x: f.x, y: f.y } : null;
  }

  /**
   * Rebuild `predicted` = authoritative + every input the host has not acknowledged.
   *
   * The clone keeps the arena BY REFERENCE (see `wire.ts:cloneMatchState`) — a
   * `structuredClone` here would give the predicted state an arena that is not the one this
   * client's renderer holds, and `brokenConcealment` would compare boxes across two arenas.
   */
  private rebuildPrediction(): number {
    if (!this.authoritative) return 0;
    this.predicted = cloneMatchState(this.authoritative);
    if (this.slotNo === null) return 0;
    let replayed = 0;
    for (let t = this.ackTick + 1; t < this.sendTick; t++) {
      const rec = this.sent[t % SENT_RING];
      // A gap means the ring has wrapped past this tick (the client is more than 64 ticks
      // ahead of the ack, i.e. ~1.07 s of unacknowledged input). Replaying NEUTRAL there
      // would be a silent lie; the seat simply holds, which is what the host does too.
      const input = rec && rec.tick === t ? rec.input : neutralInput();
      // ── REPLAY_DISCARDS_EVENTS ──────────────────────────────────────────────
      // The return value is dropped ON PURPOSE. See this file's header: the only events a
      // consumer ever sees are the host's, so a re-simulated tick cannot re-fire a damage
      // number, an explosion, a hit-stop or a note of the score.
      stepMatch(this.predicted, this.dtMs, this.inputsFor(input));
      replayed++;
    }
    return replayed;
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
