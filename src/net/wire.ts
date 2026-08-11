/**
 * THE WIRE FORMAT — and the one trap it exists to defuse.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 `MatchState` DOES NOT SURVIVE A JSON ROUND TRIP, AND NOTHING REPORTS IT.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Measured (`docs/NETCODE.md` §6) on a real N=6 state. `JSON.parse(JSON.stringify(state))`
 * returns an object that passes every value comparison anyone would write and is **wrong in
 * three separate ways**:
 *
 *   1. **THREE ALIAS INVARIANTS BREAK SILENTLY.** `state.player` and `state.enemy` are real,
 *      own, enumerable properties holding **the same objects** as `fighters[0]` and
 *      `fighters[1]`; `state.aiSighting` **is** `sightings[1 * n + 0]`. That aliasing is why
 *      the N-fighter refactor needed zero changes in every renderer, HUD, audio and tool
 *      consumer (`state.ts` says so at each field). JSON has no references, so a round trip
 *      hands you *two independent copies of every fighter*: a write through `state.player`
 *      becomes invisible through `state.fighters[0]`, the HUD and the sim diverge, and
 *      **nothing throws**.
 *   2. **SEVEN `-Infinity` SENTINELS FLATTEN TO `null`** (`lastDamagedAt`, every `lastUsed`
 *      slot, both `StatusTimers` deadlines, `revealedUntil`). `1b506d6` recorded the same
 *      trap from the other side: two states differing *only* in those fields compare EQUAL
 *      under `stringify`, and *"they are exactly the fields a mis-built fighter gets wrong."*
 *   3. **`brokenConcealment` HOLDS ARENA BOXES BY REFERENCE** and `movement.ts:isConcealed`
 *      tests them with reference identity. A round trip turns them into structurally equal
 *      strangers, so every destroyed region silently comes back.
 *
 * And a fourth this file found while building the guard: **`Fighter.hazardTimers` is
 * documented "sparse; grows lazily"** and `sim.ts:applyWorldTick` writes it at the hazard's
 * index — so a fighter that steps into hazard 3 before hazard 0 has real array HOLES.
 * `JSON.stringify` turns a hole into `null`; `JSON.parse` gives you a present `null`. The
 * accumulator `(hazardTimers[idx] ?? 0)` reads both as 0 today, so this one is currently
 * benign — which is exactly why it would never be noticed.
 *
 * ── WHAT THIS MODULE DOES INSTEAD ───────────────────────────────────────────────
 *
 * **ONE alias-aware structural walker, three consumers.** `encodeMatchState`,
 * `decodeMatchState` and `cloneMatchState` are the same traversal with the same rules, so
 * there is exactly one place to state what an alias is, what a sentinel is, and what belongs
 * to the arena rather than to the match. `rules.ts` documents six defects in this repo of the
 * shape *"one rule stated once and implemented twice"*; a hand-written per-field encoder
 * beside a hand-written per-field cloner is that shape with a network in the middle.
 *
 * The walker is **generic over the state's shape**, deliberately. `docs/NETCODE.md` §6 named
 * the bill an authoritative design pays as *"a hand-written encoder/decoder … and every future
 * field added to `state.ts` must be added to it too"*. A field-list encoder rots the day
 * `state.ts` grows a field and it rots **silently**, because the missing field simply is not
 * there on the far side and the receiver's `undefined` reads as 0 in most arithmetic. This
 * walker instead:
 *
 *   * carries **plain data of any shape** with no registration at all — a new number, string,
 *     boolean, array or plain object needs no change here and cannot be dropped;
 *   * **REFUSES, LOUDLY, at encode time** anything it has no rule for — a `Map`, a `Set`, a
 *     `Date`, a typed array, a class instance, a function, a symbol, a bigint — naming the
 *     exact path. So a field that would need a rule cannot ship without one;
 *   * carries **reference topology generically**: the second visit to any object emits a
 *     `$ref` to where it was first seen, so `player`, `enemy`, `aiSighting` and every future
 *     alias are preserved without being enumerated anywhere.
 *
 * ⚠️ **THE ARENA IS NOT ON THE WIRE, AND THAT IS NOT AN OPTIMISATION.** One `ArenaDefinition`
 * object is shared by every match a process runs (`state.ts` says so at `brokenConcealment`),
 * and `match.ts` hands the same object to `createMatch` across restarts. Shipping a *copy* of
 * it would give the receiver a `state.arena` that is not the arena its renderer holds, and
 * `brokenConcealment`'s reference identity would be against the wrong object. So every object
 * reachable from the arena is pre-registered under an `@`-rooted path, the state refers to
 * them by that path, and the **receiver supplies its own arena**. `arenaFingerprint` is the
 * drift control that makes that safe: it answers *"is it the SAME arena?"*, not *"did an arena
 * arrive?"* — `CLAUDE.md` #4, eighteen times true.
 *
 * ── WHY THE TRANSFORMED TREE IS STILL JSON ──────────────────────────────────────
 *
 * The output is a JSON-safe value. Not because JSON is a good snapshot protocol — `NETCODE.md`
 * §2 measures a full JSON snapshot at 8,126 B mean / 17,089 B max at N=6, and a binary delta
 * at ~220 B — but because **the corruption above is a property of the TRANSFORM, not of the
 * byte encoding.** Fix the transform and any byte encoding underneath it is correct; ship a
 * binary encoder over the untransformed tree and it is corrupt in exactly the same three ways
 * while looking twenty times more serious. A delta/binary layer belongs *under* this and is
 * named in the report as remaining work.
 */

import type { ArenaDefinition } from '../arena/types.ts';
import type { Fighter, MatchState, Sighting } from '../game/state.ts';
import { MAX_FIGHTERS, MIN_FIGHTERS, roleOfSlot, sightingIndex } from '../game/state.ts';

// ─────────────────────────────────────────────────────────────────────────────
// The token vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every non-JSON value becomes a string beginning with NUL.
 *
 * A reserved PREFIX rather than a wrapper object (`{$num:"-inf"}`), for two reasons that are
 * both about the failure mode: a wrapper doubles the size of every sentinel-heavy fighter and,
 * far worse, a wrapper is **indistinguishable from real data** if the state ever holds an
 * object with a `$num` key. A NUL-prefixed string cannot be confused with anything the sim
 * produces — no weapon key, colour, emoji, character id or arena name contains U+0000 — and a
 * genuine string that somehow did is escaped by `T_STR` below rather than being ambiguous.
 */
const TAG = '\u0000';
const T_NEG_INF = `${TAG}-inf`;
const T_POS_INF = `${TAG}+inf`;
const T_NAN = `${TAG}nan`;
const T_NEG_ZERO = `${TAG}-0`;
const T_UNDEF = `${TAG}undef`;
/** An array HOLE, which is a different thing from a present `undefined` and from a `null`. */
const T_HOLE = `${TAG}hole`;
/** `r:<path>` — a second visit to an already-seen object. */
const P_REF = `${TAG}r:`;
/** `s:<rest>` — a genuine string that happens to start with NUL. */
const P_STR = `${TAG}s:`;

/** Root of a path into the MATCH STATE. */
const ROOT_STATE = '$';
/** Root of a path into the ARENA, which is never transmitted. */
const ROOT_ARENA = '@';

export const WIRE_VERSION = 1;

/** A JSON-safe value. The encoder's output is one of these, always. */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** An encoded `MatchState`. Opaque; feed it to `decodeMatchState` with the receiver's arena. */
export type WireState = Json;

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON-Pointer-style escaping, so a key containing `/` or `~` cannot forge a path segment.
 *
 * No key in `MatchState` needs this today — they are all plain identifiers — which is
 * precisely why it is here: the day one does not, this is the difference between a wrong
 * reference and a loud failure.
 */
function escSeg(s: string): string {
  return s.replace(/~/g, '~0').replace(/\//g, '~1');
}
function unescSeg(s: string): string {
  return s.replace(/~1/g, '/').replace(/~0/g, '~');
}
function joinPath(root: string, segs: readonly string[]): string {
  return segs.length === 0 ? root : `${root}/${segs.map(escSeg).join('/')}`;
}
function splitPath(path: string): { root: string; segs: string[] } {
  const slash = path.indexOf('/');
  if (slash < 0) return { root: path, segs: [] };
  return {
    root: path.slice(0, slash),
    segs: path.slice(slash + 1).split('/').map(unescSeg),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plainness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is this an object the walker has a rule for?
 *
 * Arrays and objects whose prototype is `Object.prototype` or `null`. Everything else —
 * `Map`, `Set`, `Date`, `RegExp`, typed arrays, class instances, `Promise` — is refused by
 * name at the path where it was found.
 *
 * ⚠️ `Map`/`Set` are refused rather than supported ON PURPOSE, and it is a game rule rather
 * than a serialisation preference: `state.ts` says a keyed container *"traverses in INSERTION
 * order … that is the classic lockstep-desync mechanism"*, which is why `fighters` is an array
 * and `MatchInputs` is indexed by slot. A codec that quietly learned to carry a `Map` would
 * remove the one obstacle stopping somebody putting the fighter list in one.
 */
function isPlainObject(v: object): boolean {
  // ⚠️ ARRAYS FIRST, AND THE FIRST DRAFT OF THIS FUNCTION LEFT THEM OUT. `Array.prototype` is
  // not `Object.prototype`, so a prototype test alone refuses every array in the graph —
  // `fighters`, `sightings`, `projectiles`, `cover`, `concealment`, all of it. It was caught by
  // `nw_wire.mjs` on its first run, with `cannot encode instance of Array (at @/concealment)`,
  // which is the whole argument for building the gate before believing the codec.
  if (Array.isArray(v)) return true;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  const t = typeof v;
  if (t !== 'object' && t !== 'function') return t;
  if (t === 'function') return 'function';
  const ctor = (v as object).constructor as { name?: string } | undefined;
  return ctor?.name ? `instance of ${ctor.name}` : 'exotic object';
}

/**
 * Thrown by `encodeMatchState` / `cloneMatchState` when a value has no rule.
 *
 * ⚠️ **NO TYPESCRIPT PARAMETER PROPERTY, HERE OR ANYWHERE UNDER `src/net/`.** Node's built-in
 * type stripping refuses `constructor(readonly path: string)` outright
 * (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`), and every `.mjs` instrument in this repo — including
 * `sim.test.mjs` — imports `.ts` straight from `src/` with no build step. `tsc` compiles the
 * short form happily, so the defect it causes is **invisible to the gate that would catch it**
 * and shows up only when a tool tries to run. `state.ts`'s header records the same class of
 * trap from the import-extension side.
 */
export class WireError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${message} (at ${path})`);
    this.name = 'WireError';
    this.path = path;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The arena registry — everything the wire refers to but never carries
// ─────────────────────────────────────────────────────────────────────────────

export interface ArenaRegistry {
  readonly arena: ArenaDefinition;
  /** object -> `@`-rooted path. */
  readonly pathOf: ReadonlyMap<object, string>;
  /** `@`-rooted path -> object. */
  readonly objAt: ReadonlyMap<string, object>;
  /** Canonical structural hash. See `arenaFingerprint`. */
  readonly fingerprint: string;
}

const registryCache = new WeakMap<object, ArenaRegistry>();

/**
 * Register every object reachable from the arena, keyed by a **structural** path.
 *
 * ⚠️ **KEYS ARE SORTED, AND THAT IS WHAT MAKES THE PATHS PORTABLE.** The host and the client
 * each build this from their *own* arena object. If the walk used insertion order, two builds
 * of the same arena that assembled a prop's fields in a different order would produce
 * different paths for the same box, and a `brokenConcealment` reference would resolve to the
 * wrong plate on the far side — structurally plausible, and wrong. Sorting makes the path a
 * function of the arena's SHAPE and of nothing else.
 *
 * The FIRST path found under that walk wins, which matters because the arena aliases itself:
 * `types.ts` states that `spawns[0]`/`spawns[1]` **are** `playerSpawn`/`enemySpawn`, the same
 * two objects. Either path identifies the same object, so either is correct; picking
 * deterministically is what stops the two ends disagreeing about which.
 */
export function arenaRegistry(arena: ArenaDefinition): ArenaRegistry {
  const cached = registryCache.get(arena);
  if (cached) return cached;

  const pathOf = new Map<object, string>();
  const objAt = new Map<string, object>();

  const visit = (v: unknown, segs: string[]): void => {
    if (v === null || typeof v !== 'object') return;
    const obj = v as object;
    if (pathOf.has(obj)) return;
    if (!isPlainObject(obj)) {
      // An arena that carries an exotic object is not itself an error — nothing in the
      // match state can refer to one, because the encoder would refuse it there. It is
      // simply not registrable, so it is skipped rather than thrown on.
      return;
    }
    const path = joinPath(ROOT_ARENA, segs);
    pathOf.set(obj, path);
    objAt.set(path, obj);
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (i in obj) visit((obj as unknown[])[i], [...segs, String(i)]);
      }
    } else {
      for (const key of Object.keys(obj).sort()) {
        visit((obj as Record<string, unknown>)[key], [...segs, key]);
      }
    }
  };
  visit(arena, []);

  const reg: ArenaRegistry = {
    arena,
    pathOf,
    objAt,
    fingerprint: fnv1a64(fingerprintJson(arena)),
  };
  registryCache.set(arena, reg);
  return reg;
}

/**
 * A structural hash of the arena — the drift control on *"is it the SAME arena?"*.
 *
 * ⚠️ **AN ACCIDENT DETECTOR, NOT A SECURITY MECHANISM.** FNV-1a is not a cryptographic hash
 * and a modified client can trivially send whatever fingerprint the host expects. It exists to
 * catch the failure this repo has hit eighteen times in other forms — the thing that is there,
 * renders plausibly, and is *not the same* — namely a client on a stale bundle whose arena is
 * one prop different, where every reference resolves to a real box and a few of them are the
 * wrong one. Web Crypto's real hashes are async and would make this whole path a promise for
 * no benefit against an attacker the authoritative model already handles by not trusting the
 * client's state at all.
 */
export function arenaFingerprint(arena: ArenaDefinition): string {
  return arenaRegistry(arena).fingerprint;
}

/** 64-bit FNV-1a over UTF-16 code units, as 16 hex chars. */
function fnv1a64(s: string): string {
  // Split into two 32-bit halves; BigInt would be cleaner and is ~40x slower.
  let h1 = 0x811c9dc5 | 0;
  let h2 = 0xcbf29ce4 | 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
    h2 ^= h1 >>> 13;
  }
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2);
}

/**
 * Canonical JSON with SORTED keys, holes and sentinels tagged, and internal aliases emitted as
 * `$ref`s — i.e. the same transform the wire uses, minus any arena registry.
 *
 * Used for the arena fingerprint and, in the instruments, as an exact equality test between
 * two states: **`canonicalJson(a) === canonicalJson(b)` is true iff the two graphs agree on
 * values, on `Object.is` numeric identity, on array holes AND on reference topology.** Plain
 * `JSON.stringify` agrees on none of the last three, which is precisely why the JSON round
 * trip is invisible to it.
 */
export function canonicalJson(root: unknown): string {
  return JSON.stringify(encodeGraph(root, null, ROOT_STATE, 'throw'));
}

/**
 * ⚠️ **THE ARENA CARRIES FUNCTIONS AND THE FINGERPRINT HAS TO SURVIVE THEM.**
 * `ArenaDefinition` declares `build(): THREE.Group` as a REQUIRED method and `update?` as an
 * optional one, so a strict canonicalisation of an arena throws at `$/build` — which is
 * correct for a match state (a function there is a real error) and useless here.
 *
 * So the fingerprint tags a function by NAME instead of refusing it, and the consequence is
 * stated rather than hidden: **this hashes the arena's DATA, not its behaviour.** Two arenas
 * whose `build()` draws different props but whose cover, hazards, spawns and concealment agree
 * hash the SAME — which is exactly right for what the fingerprint is FOR (every path a
 * `brokenConcealment` reference can resolve through is data), and would be wrong if anyone
 * ever read it as "the two clients are running the same arena code". They are not the same
 * question. `conceal_lab.mjs` excludes function-valued keys from its own differ for the same
 * reason and it is worth the two tools agreeing.
 */
function fingerprintJson(arena: ArenaDefinition): string {
  return JSON.stringify(encodeGraph(arena, null, ROOT_ARENA, 'tag-function'));
}

// ─────────────────────────────────────────────────────────────────────────────
// ENCODE
// ─────────────────────────────────────────────────────────────────────────────

function encodeNumber(n: number): Json {
  if (Number.isFinite(n)) return Object.is(n, -0) ? T_NEG_ZERO : n;
  if (Number.isNaN(n)) return T_NAN;
  return n > 0 ? T_POS_INF : T_NEG_INF;
}

function encodeString(s: string): string {
  return s.startsWith(TAG) ? P_STR + s : s;
}

/**
 * The walker. `reg` may be null, in which case nothing is treated as external and the whole
 * graph is carried inline (that is `canonicalJson`'s mode).
 */
function encodeGraph(
  root: unknown,
  reg: ArenaRegistry | null,
  rootTag: string,
  onFunction: 'throw' | 'tag-function',
): Json {
  const seen = new Map<object, string>();

  const walk = (v: unknown, segs: string[]): Json => {
    switch (typeof v) {
      case 'undefined': return T_UNDEF;
      case 'boolean': return v;
      case 'number': return encodeNumber(v);
      case 'string': return encodeString(v);
      case 'object': break;
      case 'function':
        if (onFunction === 'tag-function') return `${TAG}fn:${(v as { name?: string }).name ?? ''}`;
        throw new WireError(joinPath(rootTag, segs), `cannot encode ${describe(v)}`);
      default:
        throw new WireError(joinPath(rootTag, segs), `cannot encode ${describe(v)}`);
    }
    if (v === null) return null;
    const obj = v as object;

    // External first: an arena-owned object is a REFERENCE, never a copy.
    const ext = reg?.pathOf.get(obj);
    if (ext !== undefined) return P_REF + ext;

    const already = seen.get(obj);
    if (already !== undefined) return P_REF + already;

    if (!isPlainObject(obj)) {
      throw new WireError(joinPath(rootTag, segs), `cannot encode ${describe(obj)}`);
    }
    seen.set(obj, joinPath(rootTag, segs));

    if (Array.isArray(obj)) {
      const out: Json[] = new Array<Json>(obj.length);
      for (let i = 0; i < obj.length; i++) {
        out[i] = i in obj ? walk((obj as unknown[])[i], [...segs, String(i)]) : T_HOLE;
      }
      return out;
    }
    const rec = obj as Record<string, unknown>;
    const out: { [k: string]: Json } = {};
    // SORTED, so the encoding is a function of the graph and not of construction order.
    // Two states that are equal produce byte-identical text, which is what lets the
    // instruments use this as an exact differ.
    for (const key of Object.keys(rec).sort()) out[key] = walk(rec[key], [...segs, key]);
    return out;
  };

  return walk(root, []);
}

/**
 * Encode a `MatchState` for transmission. The arena is referenced, never carried.
 *
 * Throws `WireError` on anything the walker has no rule for. That throw is the schema guard:
 * a field added to `state.ts` that is plain data needs nothing here, and a field that is not
 * plain data cannot ship silently.
 */
export function encodeMatchState(state: MatchState): WireState {
  return encodeGraph(state, arenaRegistry(state.arena), ROOT_STATE, 'throw');
}

// ─────────────────────────────────────────────────────────────────────────────
// DECODE
// ─────────────────────────────────────────────────────────────────────────────

/** A placeholder left where a `$ref` was, patched out in the second pass. */
class RefMark {
  readonly target: string;
  constructor(target: string) { this.target = target; }
}

function decodeScalar(s: string): unknown | RefMark | typeof KEEP {
  if (!s.startsWith(TAG)) return s;
  switch (s) {
    case T_NEG_INF: return -Infinity;
    case T_POS_INF: return Infinity;
    case T_NAN: return NaN;
    case T_NEG_ZERO: return -0;
    case T_UNDEF: return undefined;
    case T_HOLE: return KEEP;
    default: break;
  }
  if (s.startsWith(P_REF)) return new RefMark(s.slice(P_REF.length));
  if (s.startsWith(P_STR)) return s.slice(P_STR.length);
  throw new WireError('?', `unknown wire token ${JSON.stringify(s)}`);
}

/** Sentinel meaning "leave this array index unassigned", i.e. reproduce the hole. */
const KEEP = Symbol('hole');

/**
 * Rebuild a `MatchState` from the wire, against the RECEIVER'S OWN arena.
 *
 * ⚠️ **THE ARENA ARGUMENT IS THE WHOLE POINT AND IT IS NOT A CONVENIENCE.** The decoded state's
 * `arena` is the object passed in — the same one the receiver's renderer, VFX layer and nav
 * grid already hold — and every `brokenConcealment` entry is resolved to a box *inside it* by
 * reference. That is what keeps `movement.ts:isConcealed`'s reference-identity test meaningful
 * on the far side. Pass a different arena than the sender used and the paths still resolve;
 * `arenaFingerprint` is how you find out that you did.
 */
export function decodeMatchState(wire: WireState, arena: ArenaDefinition): MatchState {
  const reg = arenaRegistry(arena);
  const refs: { holder: Record<string, unknown> | unknown[]; key: string | number; target: string }[] = [];

  const build = (v: Json): unknown => {
    if (typeof v === 'string') {
      const d = decodeScalar(v);
      if (d === KEEP) throw new WireError('?', 'array hole token outside an array');
      return d;
    }
    if (v === null || typeof v !== 'object') return v;

    if (Array.isArray(v)) {
      const out: unknown[] = [];
      out.length = v.length;
      for (let i = 0; i < v.length; i++) {
        const cell = v[i];
        if (typeof cell === 'string') {
          const d = decodeScalar(cell);
          if (d === KEEP) continue;             // reproduce the hole
          if (d instanceof RefMark) { refs.push({ holder: out, key: i, target: d.target }); continue; }
          out[i] = d;
          continue;
        }
        out[i] = build(cell);
      }
      return out;
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(v)) {
      const cell = v[key];
      if (typeof cell === 'string') {
        const d = decodeScalar(cell);
        if (d === KEEP) throw new WireError(key, 'array hole token on an object key');
        if (d instanceof RefMark) { refs.push({ holder: out, key, target: d.target }); out[key] = undefined; continue; }
        out[key] = d;
        continue;
      }
      out[key] = build(cell);
    }
    return out;
  };

  const rootValue = build(wire);
  if (rootValue === null || typeof rootValue !== 'object') {
    throw new WireError(ROOT_STATE, 'wire root is not an object');
  }

  // Second pass: every reference target is a real node, so resolution is total.
  for (const r of refs) {
    const { root, segs } = splitPath(r.target);
    let node: unknown;
    if (root === ROOT_ARENA) {
      const found = reg.objAt.get(r.target);
      if (found === undefined) {
        throw new WireError(r.target, 'arena reference does not resolve — arena mismatch?');
      }
      node = found;
    } else if (root === ROOT_STATE) {
      node = rootValue;
      for (const seg of segs) {
        if (node === null || typeof node !== 'object') {
          throw new WireError(r.target, 'state reference does not resolve');
        }
        node = (node as Record<string, unknown>)[seg];
      }
    } else {
      throw new WireError(r.target, `unknown reference root ${JSON.stringify(root)}`);
    }
    (r.holder as Record<string | number, unknown>)[r.key] = node;
  }

  return rootValue as unknown as MatchState;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLONE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A deep copy of a `MatchState` that keeps the arena BY REFERENCE and preserves every alias.
 *
 * ── WHY NOT `structuredClone` ───────────────────────────────────────────────────
 *
 * `structuredClone` preserves internal references, so it gets the three aliases and the seven
 * sentinels right — `NETCODE.md` §6 measured that and it is true. It is still the wrong tool
 * here for a reason that has nothing to do with fidelity: **it deep-copies the arena too.**
 * The copy's `state.arena` would be a different object from the one the renderer, the nav grid
 * and `window.__matchArena` hold, its `brokenConcealment` would point into that copy, and
 * `movement.ts:isConcealed`'s reference test would then be comparing boxes from two different
 * arenas — every destroyed region silently intact. It is also 41x slower at N=6 (36.94 µs vs
 * 0.891 µs, `NETCODE.md` §6), and the client's reconciliation path clones on every snapshot.
 *
 * ⚠️ **KEY ORDER IS PRESERVED HERE, UNLIKE IN `encodeMatchState`.** The encoder sorts because
 * its output must be a function of the graph alone. A clone must not: `conceal_lab.mjs`'s
 * bit-identity differ walks states with `Object.keys`/spread, and a clone whose keys came out
 * in a different order would compare unequal to its original under any key-ordered instrument
 * in this repo while being the same state.
 */
export function cloneMatchState(state: MatchState): MatchState {
  const reg = arenaRegistry(state.arena);
  const seen = new Map<object, unknown>();

  const copy = (v: unknown, segs: string[]): unknown => {
    if (v === null || typeof v !== 'object') {
      if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') {
        throw new WireError(joinPath(ROOT_STATE, segs), `cannot clone ${describe(v)}`);
      }
      return v;
    }
    const obj = v as object;
    if (reg.pathOf.has(obj)) return obj;      // arena-owned: SHARED, never copied
    const hit = seen.get(obj);
    if (hit !== undefined) return hit;
    if (!isPlainObject(obj)) {
      throw new WireError(joinPath(ROOT_STATE, segs), `cannot clone ${describe(obj)}`);
    }
    if (Array.isArray(obj)) {
      const out: unknown[] = [];
      seen.set(obj, out);
      out.length = obj.length;
      for (let i = 0; i < obj.length; i++) {
        if (i in obj) out[i] = copy((obj as unknown[])[i], [...segs, String(i)]);
      }
      return out;
    }
    const rec = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    seen.set(obj, out);
    for (const key of Object.keys(rec)) out[key] = copy(rec[key], [...segs, key]);
    return out;
  };

  return copy(state, []) as MatchState;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE INSTRUMENT: what a value comparison cannot see
// ─────────────────────────────────────────────────────────────────────────────

export interface Violation {
  /** A stable machine-readable code, so a gate can assert the SET and not a message string. */
  code: string;
  detail: string;
}

/**
 * SELF-CONSISTENCY OF ONE `MatchState`. Every check here is one the sim's own comments state
 * as an invariant, and every one of them is checked by IDENTITY or by TYPE rather than by
 * value — because value equality is exactly what the JSON round trip preserves.
 *
 * 🚨 **THIS FUNCTION IS ONLY WORTH ANYTHING BECAUSE IT HAS BEEN SHOWN TO FAIL.**
 * `tools/tmp/nw_wire.mjs --selftest` runs it against `JSON.parse(JSON.stringify(state))` and
 * requires the exact violation set — `alias/player`, `alias/enemy`, `alias/aiSighting`, the
 * `sentinel/*` rows and `conceal/identity` — and separately proves that
 * `JSON.stringify(a) === JSON.stringify(b)` returns TRUE on that same pair. A guard that has
 * not been shown to fail on the bug it guards against is not a guard (`CLAUDE.md` #6).
 */
export function checkStateIntegrity(state: MatchState): Violation[] {
  const v: Violation[] = [];
  const add = (code: string, detail: string): void => { v.push({ code, detail }); };

  const fighters: unknown = state.fighters;
  if (!Array.isArray(fighters)) {
    add('container/fighters-not-array', `fighters is ${describe(fighters)}`);
    return v;   // nothing below is meaningful
  }
  const n = fighters.length;
  if (n < MIN_FIGHTERS || n > MAX_FIGHTERS) {
    add('container/seat-count', `${n} fighters, sim seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}`);
  }

  for (let i = 0; i < n; i++) {
    const f = fighters[i] as Fighter;
    if (f.id !== i) add('slot/id', `fighters[${i}].id === ${String(f.id)}`);
    if (f.role !== roleOfSlot(i)) add('slot/role-mirror', `fighters[${i}].role === ${String(f.role)}`);
  }

  // ── THE THREE ALIASES. Identity, not equality. ──
  if (state.player !== fighters[0]) add('alias/player', 'state.player is not state.fighters[0]');
  if (state.enemy !== fighters[1]) add('alias/enemy', 'state.enemy is not state.fighters[1]');

  const sightings: unknown = state.sightings;
  if (!Array.isArray(sightings)) {
    add('container/sightings-not-array', `sightings is ${describe(sightings)}`);
  } else {
    if (sightings.length !== n * n) {
      add('matrix/size', `sightings.length ${sightings.length}, expected ${n * n}`);
    }
    const legacy = sightings[sightingIndex(1, 0, n)] as Sighting | undefined;
    if (state.aiSighting !== legacy) {
      add('alias/aiSighting', `state.aiSighting is not sightings[${sightingIndex(1, 0, n)}]`);
    }
  }

  // ── THE SENTINELS. A TYPE check, because `JSON.parse` gives a present `null`, and
  //    `null >= x` is `0 >= x` — arithmetic that runs and is wrong. ──
  const numField = (owner: unknown, label: string): void => {
    if (typeof owner !== 'number') add('sentinel/not-a-number', `${label} is ${describe(owner)}`);
  };
  for (let i = 0; i < n; i++) {
    const f = fighters[i] as Fighter;
    numField(f.lastDamagedAt, `fighters[${i}].lastDamagedAt`);
    numField(f.revealedUntil, `fighters[${i}].revealedUntil`);
    numField(f.status?.slowedUntil, `fighters[${i}].status.slowedUntil`);
    numField(f.status?.stunnedUntil, `fighters[${i}].status.stunnedUntil`);
    const lu: unknown = f.lastUsed;
    if (!Array.isArray(lu)) add('sentinel/lastUsed-not-array', `fighters[${i}].lastUsed is ${describe(lu)}`);
    else for (let k = 0; k < lu.length; k++) numField(lu[k], `fighters[${i}].lastUsed[${k}]`);
  }

  // ── THE ARENA REFERENCES. `movement.ts:isConcealed` tests these by identity, so a
  //    structurally equal stranger conceals nobody and reports nothing. ──
  const broken: unknown = state.brokenConcealment;
  if (!Array.isArray(broken)) {
    add('conceal/not-array', `brokenConcealment is ${describe(broken)}`);
  } else if (broken.length > 0) {
    const list = (state.arena as unknown as { concealment?: readonly object[] }).concealment ?? [];
    for (let i = 0; i < broken.length; i++) {
      if (!list.includes(broken[i] as object)) {
        add('conceal/identity', `brokenConcealment[${i}] is not an object in arena.concealment`);
      }
    }
  }

  // ── THE LEGACY MIRRORS on the event-visible containers. ──
  const winnerExpected = state.winnerId === null || state.winnerId === undefined
    ? null
    : roleOfSlot(state.winnerId);
  if (state.winner !== winnerExpected) {
    add('mirror/winner', `winner ${String(state.winner)} vs winnerId ${String(state.winnerId)}`);
  }
  for (const p of state.projectiles ?? []) {
    if (p.ownerRole !== roleOfSlot(p.ownerId)) add('mirror/projectile-owner', `projectile ${p.id}`);
    if (p.targetRole !== roleOfSlot(p.targetId)) add('mirror/projectile-target', `projectile ${p.id}`);
    if (p.targetId < 0 || p.targetId >= n) add('range/projectile-target', `projectile ${p.id} -> slot ${p.targetId}`);
  }
  for (const m of state.trailMarks ?? []) {
    if (m.ownerRole !== roleOfSlot(m.ownerId)) add('mirror/trail-owner', `trail ${m.id}`);
    if (m.damaged !== (m.damagedMask !== 0)) add('mirror/trail-damaged', `trail ${m.id}`);
  }

  return v;
}

/**
 * EXACT equality of two match states, including everything `JSON.stringify` is blind to.
 *
 * Returns an empty array when the two graphs are identical in values (`Object.is` semantics,
 * so `-0 !== 0` and `NaN === NaN`), in array holes, and in **reference topology**. The last
 * one is the round-trip corruption: the original emits `$ref:$/fighters/0` where the corrupted
 * copy emits a second full fighter, so the canonical texts differ even though every leaf value
 * matches.
 *
 * ⚠️ It compares canonical text, so it reports THE FIRST divergence with context rather than a
 * field list. That is deliberate: a differ that keeps going past the first structural
 * disagreement is comparing two trees it has already lost alignment on.
 *
 * ⚠️ **IT COMPARES THE WIRE ENCODING, NOT `canonicalJson`, AND THE DIFFERENCE IS LOAD-BEARING
 * TWICE OVER.** First, `canonicalJson` walks *into* `state.arena` and `ArenaDefinition`
 * declares `build(): THREE.Group` as a required METHOD — so it would throw on any real state.
 * Second, and more useful: because the wire encoding refers to arena objects by a
 * **structural** path, two states built on two different `ArenaDefinition` *instances* of the
 * same shape compare EQUAL here. That is exactly the question a host and a client need
 * answered, and it is why `arenaFingerprint` is a separate check rather than part of this one.
 */
export function diffStates(a: MatchState, b: MatchState): Violation[] {
  let ta: string;
  let tb: string;
  try {
    ta = JSON.stringify(encodeMatchState(a));
  } catch (e) {
    return [{ code: 'encode/left', detail: String(e) }];
  }
  try {
    tb = JSON.stringify(encodeMatchState(b));
  } catch (e) {
    return [{ code: 'encode/right', detail: String(e) }];
  }
  if (ta === tb) return [];
  let i = 0;
  while (i < ta.length && i < tb.length && ta[i] === tb[i]) i++;
  const window = 80;
  return [{
    code: 'state/differs',
    detail: `at char ${i}: …${ta.slice(Math.max(0, i - window), i + window)}… vs `
      + `…${tb.slice(Math.max(0, i - window), i + window)}…`,
  }];
}

/**
 * The `$ref`/`@ref` TOPOLOGY of a state, as a sorted list of `path -> target`.
 *
 * This is the census that makes the generic codec safe to leave unattended: if `state.ts`
 * gains or loses an alias, this list changes and the gate says which one. A hand-written
 * encoder would simply carry on encoding the fields it knew about.
 */
export function refTopology(state: MatchState): string[] {
  const reg = arenaRegistry(state.arena);
  const out: string[] = [];
  const seen = new Map<object, string>();
  const walk = (v: unknown, segs: string[]): void => {
    if (v === null || typeof v !== 'object') return;
    const obj = v as object;
    const here = joinPath(ROOT_STATE, segs);
    const ext = reg.pathOf.get(obj);
    if (ext !== undefined) { out.push(`${here} -> ${ext}`); return; }
    const already = seen.get(obj);
    if (already !== undefined) { out.push(`${here} -> ${already}`); return; }
    if (!isPlainObject(obj)) return;
    seen.set(obj, here);
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) if (i in obj) walk((obj as unknown[])[i], [...segs, String(i)]);
    } else {
      for (const key of Object.keys(obj).sort()) walk((obj as Record<string, unknown>)[key], [...segs, key]);
    }
  };
  walk(state, []);
  return out.sort();
}
