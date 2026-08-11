/**
 * THE TRANSPORT SEAM — one interface, and an in-process implementation of it.
 *
 * Everything above this line (`host.ts`, `client.ts`) talks only to `Transport`. A WebRTC
 * DataChannel, a WebSocket, or a Worker `postMessage` slots in underneath with **no change
 * above**, which is the property that makes `DECISIONS §52`'s *"build it as a host PEER first
 * and move it to Node later without touching `src/game/`"* actually mean something.
 *
 * ── 🚨 THE LOOPBACK SERIALISES FOR REAL, BY DEFAULT ─────────────────────────────
 *
 * `LoopbackHub`'s default `framing: 'text'` runs every message through `JSON.stringify` /
 * `JSON.parse` before delivering it. That is not ceremony. An in-process transport that passed
 * objects by reference would let the host and the client **share the same `MatchState`**, and
 * the whole stack would work — for the wrong reason, and it would keep working right up until
 * a real channel was attached. That is this project's most-repeated failure shape (`CLAUDE.md`
 * #4: *"when something isn't there, assume it is rendering and INVISIBLE"*, and its harder
 * successor *"is it the SAME?"*). `framing: 'ref'` exists ONLY so the gate can demonstrate the
 * difference; it is never a default.
 *
 * ── 🚨 DELIVERY IS PUMPED, NOT TIMED ────────────────────────────────────────────
 *
 * There is no `setTimeout` anywhere in this file. Latency is denominated in **ticks** and
 * delivered by an explicit `hub.pump(tick)`. A wall-clock loopback would make every number the
 * gates produce a function of how busy the machine was — and *"if you add anything that makes
 * the sim's output depend on wall-clock time … you have broken the thing that makes every
 * balance number in this repo meaningful."* Packet loss draws from `economy/rng.ts`'s seeded
 * mulberry32 for the same reason.
 */

import { createRng, type Rng } from '../game/economy/rng.ts';
import type { NetMessage, PeerId } from './protocol.ts';

export type MessageHandler = (from: PeerId, msg: NetMessage) => void;
export type PeerHandler = (peer: PeerId) => void;

export interface Transport {
  readonly localPeer: PeerId;
  /** Peers this endpoint can currently reach, excluding itself. Slot-agnostic. */
  peers(): readonly PeerId[];
  send(to: PeerId, msg: NetMessage): void;
  broadcast(msg: NetMessage): void;
  /** Returns an unsubscribe function. */
  onMessage(handler: MessageHandler): () => void;
  onPeerJoin(handler: PeerHandler): () => void;
  onPeerLeave(handler: PeerHandler): () => void;
  close(): void;
}

/** Per-link conditions. All latencies are in TICKS, never in milliseconds. */
export interface LinkConditions {
  /** Ticks of one-way delay. 0 delivers on the next `pump`. */
  delayTicks: number;
  /** Extra uniform delay in [0, jitterTicks], drawn from the seeded rng. */
  jitterTicks: number;
  /** Probability in [0,1] that a message is dropped. Seeded, so a run is reproducible. */
  loss: number;
  /**
   * Deliver out of order when jitter reorders arrivals.
   *
   * ⚠️ Default `true`, because a transport that silently re-orders for you is a transport that
   * hides every ordering bug until production. A real DataChannel can be configured either
   * way; the pessimistic default is the one that finds bugs.
   */
  allowReorder: boolean;
}

export const DEFAULT_LINK: LinkConditions = {
  delayTicks: 0,
  jitterTicks: 0,
  loss: 0,
  allowReorder: true,
};

/**
 * A link key that cannot collide.
 *
 * Template concatenation would map `("ab","c")` and `("a","bc")` to the same link — a two-line
 * bug that only shows up once peer ids stop being `host` / `c1`. JSON is total over any pair.
 */
function linkKey(from: PeerId, to: PeerId): string {
  return JSON.stringify([from, to]);
}

interface Envelope {
  seq: number;
  from: PeerId;
  to: PeerId;
  at: number;
  payload: string | NetMessage;
}

export type Framing = 'text' | 'ref';

export interface LoopbackHubOptions {
  /** `'text'` (default) serialises every message. `'ref'` is for the gate's negative control only. */
  framing?: Framing;
  /** Seed for the loss/jitter draws. Same seed, same run, always. */
  seed?: number;
}

/**
 * An in-process message hub. Deterministic, pumped, and serialising by default.
 *
 * Counters (`sent`, `delivered`, `dropped`, `bytes`) are live so a gate can assert bandwidth
 * and loss instead of trusting them.
 */
export class LoopbackHub {
  private readonly endpoints = new Map<PeerId, LoopbackTransport>();
  private readonly queue: Envelope[] = [];
  private readonly links = new Map<string, LinkConditions>();
  private readonly rng: Rng;
  private readonly framing: Framing;
  private seq = 0;
  private now = 0;

  sent = 0;
  delivered = 0;
  dropped = 0;
  bytes = 0;

  constructor(opts: LoopbackHubOptions = {}) {
    this.framing = opts.framing ?? 'text';
    this.rng = createRng(opts.seed ?? 0x5eed);
  }

  connect(peer: PeerId): Transport {
    if (this.endpoints.has(peer)) throw new Error(`LoopbackHub: peer ${peer} already connected`);
    const ep = new LoopbackTransport(this, peer);
    // Announce in a stable order: existing peers first, in insertion order, then the newcomer
    // to each of them. Announcement order is observable (a host assigns slots on join), so it
    // is fixed here rather than left to whatever `Map` iteration happens to do.
    const existing = [...this.endpoints.values()];
    this.endpoints.set(peer, ep);
    for (const other of existing) {
      other.fireJoin(peer);
      ep.fireJoin(other.localPeer);
    }
    return ep;
  }

  /** Per-link conditions. Symmetric unless set twice. */
  setLink(from: PeerId, to: PeerId, cond: Partial<LinkConditions>): void {
    this.links.set(linkKey(from, to), { ...DEFAULT_LINK, ...this.linkOf(from, to), ...cond });
  }

  private linkOf(from: PeerId, to: PeerId): LinkConditions {
    return this.links.get(linkKey(from, to)) ?? DEFAULT_LINK;
  }

  /** @internal */
  enqueue(from: PeerId, to: PeerId, msg: NetMessage): void {
    if (!this.endpoints.has(to)) return;
    this.sent++;
    const cond = this.linkOf(from, to);
    if (cond.loss > 0 && this.rng.next() < cond.loss) { this.dropped++; return; }
    const jitter = cond.jitterTicks > 0 ? this.rng.int(cond.jitterTicks + 1) : 0;
    const payload: string | NetMessage = this.framing === 'text' ? JSON.stringify(msg) : msg;
    if (typeof payload === 'string') this.bytes += payload.length;
    this.queue.push({
      seq: this.seq++,
      from,
      to,
      at: this.now + cond.delayTicks + (cond.allowReorder ? jitter : 0),
      payload,
    });
  }

  /**
   * Deliver everything due at or before `tick`.
   *
   * ⚠️ The sort is `(at, seq)` and it is STABLE by construction — `seq` is a strict total
   * order, so two envelopes never compare equal. A comparator that could return 0 would make
   * delivery order depend on the engine's sort implementation, which is the same class of
   * hazard as `state.ts`'s reason for refusing a `Map`.
   */
  pump(tick: number): number {
    this.now = tick;
    const due = this.queue.filter((e) => e.at <= tick);
    if (due.length === 0) return 0;
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].at <= tick) this.queue.splice(i, 1);
    due.sort((a, b) => (a.at - b.at) || (a.seq - b.seq));
    for (const env of due) {
      const ep = this.endpoints.get(env.to);
      if (!ep) continue;
      const msg = typeof env.payload === 'string' ? (JSON.parse(env.payload) as NetMessage) : env.payload;
      this.delivered++;
      ep.fireMessage(env.from, msg);
    }
    return due.length;
  }

  /** Messages still in flight. A gate asserting "the stack drained" checks this is 0. */
  inFlight(): number { return this.queue.length; }

  /** @internal */
  reachable(peer: PeerId): PeerId[] {
    return [...this.endpoints.keys()].filter((p) => p !== peer);
  }

  /** @internal */
  disconnect(peer: PeerId): void {
    if (!this.endpoints.delete(peer)) return;
    for (const other of this.endpoints.values()) other.fireLeave(peer);
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].to === peer || this.queue[i].from === peer) this.queue.splice(i, 1);
    }
  }
}

class LoopbackTransport implements Transport {
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly joinHandlers = new Set<PeerHandler>();
  private readonly leaveHandlers = new Set<PeerHandler>();
  private closed = false;

  private readonly hub: LoopbackHub;
  readonly localPeer: PeerId;

  // No parameter properties: Node's type stripping refuses them and every instrument here
  // imports `.ts` with no build step. See `wire.ts:WireError` for the full note.
  constructor(hub: LoopbackHub, localPeer: PeerId) {
    this.hub = hub;
    this.localPeer = localPeer;
  }

  peers(): readonly PeerId[] { return this.hub.reachable(this.localPeer); }

  send(to: PeerId, msg: NetMessage): void {
    if (this.closed) return;
    this.hub.enqueue(this.localPeer, to, msg);
  }

  broadcast(msg: NetMessage): void {
    for (const p of this.peers()) this.send(p, msg);
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => { this.messageHandlers.delete(handler); };
  }
  onPeerJoin(handler: PeerHandler): () => void {
    this.joinHandlers.add(handler);
    return () => { this.joinHandlers.delete(handler); };
  }
  onPeerLeave(handler: PeerHandler): () => void {
    this.leaveHandlers.add(handler);
    return () => { this.leaveHandlers.delete(handler); };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.hub.disconnect(this.localPeer);
    this.messageHandlers.clear();
    this.joinHandlers.clear();
    this.leaveHandlers.clear();
  }

  /** @internal */ fireMessage(from: PeerId, msg: NetMessage): void {
    for (const h of [...this.messageHandlers]) h(from, msg);
  }
  /** @internal */ fireJoin(peer: PeerId): void {
    for (const h of [...this.joinHandlers]) h(peer);
  }
  /** @internal */ fireLeave(peer: PeerId): void {
    for (const h of [...this.leaveHandlers]) h(peer);
  }
}
