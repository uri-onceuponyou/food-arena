/**
 * DELTA COMPRESSION — and the reason it is a diff of the WIRE TREE rather than of the state.
 *
 * Measured before this existed: six clients on full snapshots at 20 Hz cost **981.6 KiB/s**
 * total, 163.6 KiB/s each. `docs/NETCODE.md` §2 measured only **35.9 changed leaves per tick**
 * at N=6 against 918 leaf fields, so ~96% of every snapshot is a retransmission of something
 * the receiver already has.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 THE ONE DECISION: THIS DIFFS THE ENCODED TREE, NOT THE `MatchState`.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * A delta encoder that walks `MatchState` directly would be a **second traversal with a second
 * set of rules** — a second place to decide what an alias is, what a sentinel is, and what
 * belongs to the arena. `wire.ts` exists because that is the "one rule stated once and
 * implemented twice" shape `rules.ts` documents six defects of; adding a parallel walker would
 * reintroduce it with a network in the middle, and the two could disagree **only on the states
 * where they disagree**, which is the least reproducible defect this layer could have.
 *
 * So the pipeline is strictly layered and the encoder is untouched:
 *
 *     state ──encodeMatchState──▶ wire tree ──diffWire──▶ delta
 *     wire tree + delta ──patchWire──▶ wire tree ──decodeMatchState──▶ state
 *
 * Everything the encoder guarantees is therefore inherited for free: aliases are already `$ref`
 * tokens, `-Infinity` is already a string, array holes are already dense tokens, the arena is
 * already an `@` reference. **The delta never sees a `MatchState` and cannot get any of it
 * wrong.** It is a diff of plain JSON, which is the smallest thing that can possibly work.
 *
 * ⚠️ And one consequence worth stating out loud: **a JSON round trip of the WIRE TREE is
 * lossless**, while a JSON round trip of the STATE corrupts it in four ways (`wire.ts`'s
 * header). That is not a coincidence — it is exactly what the transform bought, and it is why
 * `patchWire` may `structuredClone` its base without any of `wire.ts`'s objections applying.
 *
 * ── THE PATH TABLE IS DERIVED FROM THE BASE, NOT MAINTAINED ────────────────────
 *
 * `NETCODE.md` §2 named the engineering a delta protocol IS: *"a stable field-id table that
 * must be regenerated whenever `state.ts` gains a field, which is the 'one rule stated once and
 * implemented twice' shape this project has been bitten by repeatedly."*
 *
 * **There is no table.** Both ends already agree on the base tree — that is what a delta means
 * — so both ends can enumerate its paths in the same canonical order and refer to them by
 * INDEX. A field added to `state.ts` appears in the enumeration by itself, on both ends, on the
 * first tick it exists. Nothing to regenerate and nothing that can drift, because the table is
 * a function of data both sides hold rather than of a constant both sides ship.
 *
 * The cost is that a path which does NOT exist in the base — a new key, a grown array — has no
 * index and must carry its literal path string. That is the minority case by construction, and
 * `nw_delta.mjs` measures the split rather than assuming it.
 *
 * ── 🚨 WHAT MAKES THIS TESTABLE AT ALL ─────────────────────────────────────────
 *
 * **A delta encoder that silently drops a field looks exactly like a delta encoder that
 * correctly skipped an unchanged one.** Both produce a smaller delta and both round-trip
 * perfectly *against themselves*. So the control cannot be `patch(diff(a,b))` compared to
 * anything the delta machinery produced — it must be compared to an **independently produced
 * full snapshot**, `encodeMatchState(nextState)`, which is made by the encoder and knows
 * nothing about the diff. `nw_delta.mjs` does exactly that on every tick of a real match, and
 * then decodes and compares back to the `MatchState` itself.
 *
 * That is the same trap this agent's own `errorWu` metric fell into — it read exactly 0.0 at
 * every latency because it compared the client's prediction chain against itself rather than
 * against the host.
 */

import type { Json } from './wire.ts';

export const DELTA_VERSION = 1;

/**
 * One tick's change set.
 *
 * Parallel arrays rather than an array of op tuples, and it is purely a byte-count decision:
 * `{"i":[4,9],"v":[1,2]}` against `{"ops":[[0,4,1],[0,9,2]]}` saves the per-op brackets and
 * comma, which at ~36 ops/tick is roughly a fifth of the payload. It costs readability, which
 * is why the field names are documented here rather than being guessable.
 */
export interface WireDelta {
  /** Format version. A receiver that does not recognise it must ask for a keyframe. */
  readonly z: number;
  /** The tick this delta is FROM. 🚨 A receiver whose base is not this tick must refuse it. */
  readonly b: number;
  /** The tick this delta produces. */
  readonly t: number;
  /** Indices into the base path table, parallel with `v`. */
  readonly i: number[];
  /** New values at `i`. Each is a fully encoded subtree, so a whole fighter can arrive at once. */
  readonly v: Json[];
  /** Literal paths for positions the base does NOT have, parallel with `pv`. */
  readonly p: string[];
  readonly pv: Json[];
  /** Indices of object keys REMOVED. */
  readonly d: number[];
  /** Array length changes: parallel `n` (index into the table) and `nl` (new length). */
  readonly n: number[];
  readonly nl: number[];
}

/** Thrown when a delta cannot be applied to the base it was handed. */
export class DeltaError extends Error {
  readonly code: 'base-mismatch' | 'version' | 'unresolvable';
  constructor(code: 'base-mismatch' | 'version' | 'unresolvable', message: string) {
    super(message);
    this.name = 'DeltaError';
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The path table — derived from the base, identical on both ends
// ─────────────────────────────────────────────────────────────────────────────

function escSeg(s: string): string {
  return s.replace(/~/g, '~0').replace(/\//g, '~1');
}
function unescSeg(s: string): string {
  return s.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Every addressable position in a wire tree, in canonical order.
 *
 * ⚠️ **KEYS ARE SORTED HERE TOO, AND FOR THE SAME REASON `arenaRegistry` SORTS THEM.** The two
 * ends build this from their own copy of the base. `encodeMatchState` already emits sorted
 * keys, so a tree that came straight from it enumerates identically either way — but a tree
 * that has been through `patchWire` has had keys ADDED, and an added key lands at the end of
 * insertion order rather than in sorted position. Enumerating in insertion order would then
 * give the two ends different tables the first time a delta added a key, and every subsequent
 * index would address the wrong field: a plausible, silent, total corruption. Sorting makes the
 * table a function of the tree's SHAPE and of nothing else.
 */
export function wirePathTable(base: Json): string[] {
  const out: string[] = [];
  const walk = (v: Json, segs: string[]): void => {
    out.push(segs.length === 0 ? '' : segs.map(escSeg).join('/'));
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) walk(v[i], [...segs, String(i)]);
    } else {
      for (const key of Object.keys(v).sort()) walk(v[key], [...segs, key]);
    }
  };
  walk(base, []);
  return out;
}

function tableIndex(table: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < table.length; i++) m.set(table[i], i);
  return m;
}

function pathOf(segs: readonly string[]): string {
  return segs.length === 0 ? '' : segs.map(escSeg).join('/');
}

function nodeAt(root: Json, path: string): { holder: Json; key: string | number } | null {
  if (path === '') return null;
  const segs = path.split('/').map(unescSeg);
  let node: Json = root;
  for (let i = 0; i < segs.length - 1; i++) {
    if (node === null || typeof node !== 'object') return null;
    node = Array.isArray(node)
      ? (node[Number(segs[i])] as Json)
      : ((node as { [k: string]: Json })[segs[i]]);
  }
  if (node === null || typeof node !== 'object') return null;
  const last = segs[segs.length - 1];
  return { holder: node, key: Array.isArray(node) ? Number(last) : last };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIFF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structural diff of two wire trees.
 *
 * ⚠️ **ARRAYS ARE DIFFED POSITIONALLY, NOT BY `id`, AND THAT IS A MEASURED TRADE.**
 * `projectiles`, `trailMarks` and `splats` all carry a stable `id`, so a keyed diff would
 * survive a removal from the middle without rewriting the tail. It is not built, because a
 * keyed diff needs a RULE about which arrays are keyed and by what — a rule stated in the
 * encoder and again in the decoder, which is the shape this module was written to avoid. The
 * positional cost is measured instead: `nw_delta.mjs` prints mean and p99 delta size over a
 * whole match, so the tail-rewrite ticks are visible rather than assumed away.
 */
export function diffWire(prev: Json, next: Json, baseTick: number, tick: number): WireDelta {
  const table = wirePathTable(prev);
  const index = tableIndex(table);

  const i: number[] = [];
  const v: Json[] = [];
  const p: string[] = [];
  const pv: Json[] = [];
  const d: number[] = [];
  const n: number[] = [];
  const nl: number[] = [];

  const set = (segs: string[], value: Json): void => {
    const path = pathOf(segs);
    const idx = index.get(path);
    if (idx === undefined) { p.push(path); pv.push(value); }
    else { i.push(idx); v.push(value); }
  };

  const walk = (a: Json, b: Json, segs: string[]): void => {
    const aObj = a !== null && typeof a === 'object';
    const bObj = b !== null && typeof b === 'object';

    if (!aObj || !bObj) {
      // At least one side is a scalar. Encoded scalars are string | number | boolean | null —
      // `-0` and `NaN` are already TOKENS, so `!==` is exact here and no `Object.is` is needed.
      if (a !== b) set(segs, b);
      return;
    }
    const aArr = Array.isArray(a);
    const bArr = Array.isArray(b);
    if (aArr !== bArr) { set(segs, b); return; }   // shape changed entirely

    if (aArr && bArr) {
      const av = a as Json[];
      const bv = b as Json[];
      if (av.length !== bv.length) {
        const idx = index.get(pathOf(segs));
        if (idx === undefined) { set(segs, b); return; }   // the array itself is new
        n.push(idx);
        nl.push(bv.length);
      }
      for (let k = 0; k < bv.length; k++) {
        if (k < av.length) walk(av[k], bv[k], [...segs, String(k)]);
        else set([...segs, String(k)], bv[k]);
      }
      return;
    }

    const ao = a as { [k: string]: Json };
    const bo = b as { [k: string]: Json };
    for (const key of Object.keys(ao).sort()) {
      if (key in bo) walk(ao[key], bo[key], [...segs, key]);
      else {
        const idx = index.get(pathOf([...segs, key]));
        // A key present in the base always has an index; the guard is for a base that was
        // handed in without going through `wirePathTable` consistently, and it fails loudly
        // rather than dropping the deletion.
        if (idx === undefined) throw new DeltaError('unresolvable', `deleted key ${pathOf([...segs, key])} is not in the base table`);
        d.push(idx);
      }
    }
    for (const key of Object.keys(bo).sort()) {
      if (!(key in ao)) set([...segs, key], bo[key]);
    }
  };

  walk(prev, next, []);
  return { z: DELTA_VERSION, b: baseTick, t: tick, i, v, p, pv, d, n, nl };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a delta to a base wire tree, returning a NEW tree. The base is not mutated.
 *
 * 🚨 **THE BASE TICK IS CHECKED AND THE CHECK IS THE WHOLE SAFETY PROPERTY.** Applying a delta
 * to the wrong base does not throw and does not look wrong: every index resolves, every value
 * lands somewhere real, and the result is a complete, structurally valid `MatchState` that
 * passes `checkStateIntegrity` — with fighters at positions nobody was ever at. That is
 * `CLAUDE.md` #4's harder question in its purest form: not *"did it arrive"* but *"is it the
 * SAME"*. `nw_delta.mjs` demonstrates the corruption with the check removed, and the refusal
 * with it in place.
 *
 * ⚠️ `structuredClone` is used here and it is safe **only because this is a wire tree**. On a
 * `MatchState` it throws (`arena.build` is a method) and, with the arena stripped, it silently
 * detaches the arena — see `wire.ts:cloneMatchState`. A wire tree is plain JSON by
 * construction, so none of that applies.
 */
export function patchWire(base: Json, delta: WireDelta, baseTick: number): Json {
  if (delta.z !== DELTA_VERSION) {
    throw new DeltaError('version', `delta version ${delta.z}, this build speaks ${DELTA_VERSION}`);
  }
  if (delta.b !== baseTick) {
    throw new DeltaError('base-mismatch',
      `delta is from tick ${delta.b}; the receiver's base is tick ${baseTick}.`
      + ' Applying it would produce a complete, valid, WRONG state — ask for a keyframe.');
  }
  const table = wirePathTable(base);
  const out = structuredClone(base);

  const resolve = (path: string): { holder: Json; key: string | number } => {
    const hit = nodeAt(out, path);
    if (hit === null) throw new DeltaError('unresolvable', `delta path ${JSON.stringify(path)} does not resolve`);
    return hit;
  };
  const byIndex = (idx: number): { holder: Json; key: string | number } => {
    if (idx < 0 || idx >= table.length) {
      throw new DeltaError('unresolvable', `delta index ${idx} is outside the base table (${table.length})`);
    }
    return resolve(table[idx]);
  };

  // ── ORDER IS PART OF THE FORMAT AND IT IS STATED ONCE, HERE ──
  // 1. DELETES, against the base's own shape, before anything moves.
  // 2. LENGTHS, so a grown array has the slots the sets below will fill.
  // 3. SETS by index — every one addresses a position the base already had.
  // 4. SETS by literal path — the new positions, which only exist after steps 2 and 3.
  // Any other order lets a set address a slot that does not exist yet, or a delete remove a key
  // a set just wrote.
  for (const idx of delta.d) {
    const { holder, key } = byIndex(idx);
    if (holder !== null && typeof holder === 'object' && !Array.isArray(holder)) {
      delete (holder as { [k: string]: Json })[key as string];
    }
  }
  for (let k = 0; k < delta.n.length; k++) {
    const path = table[delta.n[k]];
    const target = path === '' ? out : (() => {
      const hit = resolve(path);
      return Array.isArray(hit.holder)
        ? (hit.holder as Json[])[hit.key as number]
        : (hit.holder as { [k: string]: Json })[hit.key as string];
    })();
    if (!Array.isArray(target)) {
      throw new DeltaError('unresolvable', `length op at ${JSON.stringify(path)} does not address an array`);
    }
    (target as Json[]).length = delta.nl[k];
  }
  for (let k = 0; k < delta.i.length; k++) {
    const { holder, key } = byIndex(delta.i[k]);
    (holder as { [k: string]: Json })[key as string] = delta.v[k];
  }
  for (let k = 0; k < delta.p.length; k++) {
    const { holder, key } = resolve(delta.p[k]);
    (holder as { [k: string]: Json })[key as string] = delta.pv[k];
  }
  return canonicaliseWire(out);
}

/**
 * Rebuild a wire tree with SORTED keys, so a patched tree is byte-identical to a fresh encode.
 *
 * 🚨 **THIS EXISTS BECAUSE THE FIRST VERSION OF THE GATE FAILED AND THE DELTA WAS CORRECT.**
 * `nw_delta.mjs` compared `patchWire(...)` to `encodeMatchState(next)` with `JSON.stringify`,
 * and it diverged at tick 243 — while a STRUCTURAL comparison found no difference at all and
 * `decodeMatchState` reproduced the `MatchState` exactly. The cause is that `JSON.stringify`
 * serialises objects in **insertion order**: `encodeMatchState` emits keys sorted, but a delta
 * that ADDS a key (a peck projectile gaining `arrived`, say) appends it to the end of a cloned
 * object, so two structurally identical trees stringify differently.
 *
 * The fix could have gone in the comparator instead. It goes here, for two reasons:
 *
 *   * **a contract nobody can forget beats a comparator everybody must remember.** "A patched
 *     tree is indistinguishable from an encoded one, byte for byte" is checkable with plain
 *     `JSON.stringify` by any future instrument, and this repo's record is full of comparators
 *     that were subtly wrong;
 *   * **the decoded state's key order is load-bearing downstream.** `decodeMatchState` builds
 *     objects in the wire tree's key order, and `wire.ts:cloneMatchState` documents why that
 *     matters: *"`conceal_lab.mjs`'s bit-identity differ walks states with `Object.keys`/spread,
 *     and a clone whose keys came out in a different order would compare unequal to its
 *     original under any key-ordered instrument in this repo while being the same state."* A
 *     client fed by deltas would drift out of that agreement one added key at a time.
 *
 * Cost is one walk of a ~9 KB tree per patch, against the `decodeMatchState` that immediately
 * follows it — which is strictly more work.
 */
export function canonicaliseWire(v: Json): Json {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canonicaliseWire);
  const src = v as { [k: string]: Json };
  const out: { [k: string]: Json } = {};
  for (const key of Object.keys(src).sort()) out[key] = canonicaliseWire(src[key]);
  return out;
}

/** Ops in a delta — the quantity `NETCODE.md` §2 calls "changed leaves per tick". */
export function deltaOpCount(delta: WireDelta): number {
  return delta.i.length + delta.p.length + delta.d.length + delta.n.length;
}

/** Serialised size in bytes, for a bandwidth number that is measured rather than estimated. */
export function deltaBytes(delta: WireDelta): number {
  return JSON.stringify(delta).length;
}
