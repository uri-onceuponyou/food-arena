/**
 * THE PANEL'S MODEL — everything the admin screen knows that is not a pixel.
 *
 * `DECISIONS-FOR-URI.md` §76. Split out of `adminScreen.ts` for one reason and it is not
 * tidiness: **this file has no DOM in it, so `node tools/tmp/adm_model.mjs` can drive it
 * headlessly against a registry it builds itself.** Every claim this panel makes about a
 * derived consequence is therefore checkable without a browser, and the checks include a
 * KNOWN-BAD arm (`CLAUDE.md` #6 — a guard not shown to FAIL is not a guard).
 *
 * ⚠️ Relative imports carry `.ts` extensions, matching `src/game/**` and NOT `src/ui/**`.
 * That is what lets Node 24 load this file directly; `src/ui/screens/home.ts` cannot be
 * loaded that way and neither could this, one extension ago.
 *
 * ── §76 CONSTRAINT 1: THE PANEL IS NOT THE SECOND PLACE ─────────────────────────
 *
 * There is **no table of constants in this file, and there must never be one.** Every
 * number the panel shows is read out of `src/game/tuning/registry.ts`, which learned it
 * from the literal in `rules.ts`. The panel does not know that `PLAYER_SPEED` exists.
 *
 * ── §76 CONSTRAINT 3: THE ARITHMETIC IS THE REGISTRY'S, NOT MINE ────────────────
 *
 * 🚨 `resolveValue()` below calls the registry's own `recompute` lambdas — the same
 * functions `registry.ts:previewDerived()` calls — and contributes exactly one thing of
 * its own: **the ORDER**. That distinction is the whole point.
 *
 * `previewDerived(key, {K: v})` substitutes DIRECT inputs only. If `B` is derived from
 * `A` and `A` is derived from `K`, then `previewDerived('B', {K: v})` reads `A`'s LIVE
 * value and returns a number that is **silently one level stale** — a plausible wrong
 * answer, which is this project's most expensive failure mode. So `resolveValue()`
 * resolves inputs recursively and memoises, and `adm_model.mjs` proves the difference is
 * real: on a two-deep chain the two functions DISAGREE, and on a one-deep chain they
 * agree to the bit. If they ever agree on the two-deep case, the fixture has gone
 * vacuous and the test says so.
 */

// Side-effect imports: evaluating these is what POPULATES the registry. `rules.ts` and
// `economy/tuning.ts` register their own literals as they initialise, so the registry is
// only as complete as the modules that have been evaluated — importing them here is the
// panel's half of that contract.
//
// ⚠️ `src/game/tuning/index.ts` is documented by `registry.ts` as the module that does
// this ("import `src/game/tuning/index.ts`, which imports it for you") and it DOES NOT
// EXIST in the tree as of this writing. These two imports are exactly what it would do.
// If it lands, this can become one line; nothing here has to move for that.
import '../game/rules.ts';
import '../game/economy/tuning.ts';

import {
  allEntries, assertRegistryPopulated, entryFor, sealRegistry,
  type AuthoredEntry, type DerivedEntry, type DerivedFnEntry, type RegistryEntry, type TuneGroup,
} from '../game/tuning/registry.ts';
import {
  STORAGE_KEY, hashOfPairs, isSealed, tuningSetHash, tuningSource, type TuningSource,
} from '../game/tuning/store.ts';

export type { AuthoredEntry, DerivedEntry, DerivedFnEntry, RegistryEntry, TuneGroup };
export { STORAGE_KEY };

// ─────────────────────────────────────────────────────────────────────────────
// READING THE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface Readout {
  entries: readonly RegistryEntry[];
  authored: readonly AuthoredEntry[];
  /** `'stock'` or `tun1-<hex>` — the set the SIM IS RUNNING, §76 constraint 3. */
  liveHash: string;
  liveSource: TuningSource;
  /** True once `rules.ts` has read a constant, i.e. always by the time we are here. */
  sealed: boolean;
}

/** The panel could not be built. Carries what to DO about it, not just what went wrong. */
export interface Unavailable {
  problem: string;
  hint: string;
}

export type RegistryStatus = { ok: true; readout: Readout } | { ok: false; why: Unavailable };

/**
 * Read the live registry, or explain why there is nothing to read.
 *
 * 🚨 **THE EMPTY CASE IS A FIRST-CLASS RESULT, NOT AN ERROR PATH TO SWALLOW.**
 * `CLAUDE.md` #6: an assertion over a filtered-empty set returns `true` and a whole
 * instrument goes green while measuring nothing — three times in three files in one
 * session. A tuning panel with zero rows is the UI-shaped version of that: it looks like
 * a clean tree and it means the registry never populated. `registry.ts` already throws
 * (`assertRegistryPopulated`); this turns the throw into something the screen can render
 * loudly instead of a blank table.
 */
export function readRegistry(): RegistryStatus {
  try {
    sealRegistry();
    assertRegistryPopulated();
  } catch (err) {
    return {
      ok: false,
      why: {
        problem: String((err as Error)?.message ?? err),
        hint:
          'rules.ts and economy/tuning.ts have not declared any constant through registry.ts:tune()/tunables(). '
          + 'Until they do, there is nothing to tune and this panel deliberately shows nothing rather than an empty table.',
      },
    };
  }
  const entries = allEntries();
  let liveHash: string;
  let liveSource: TuningSource;
  try {
    liveHash = tuningSetHash();
    liveSource = tuningSource();
  } catch (err) {
    return {
      ok: false,
      why: {
        problem: String((err as Error)?.message ?? err),
        hint: 'The set hash is unreadable, so no number measured in this build could be attributed to a constant set (§76 constraint 3). Refusing to show a panel that cannot say what it is running.',
      },
    };
  }
  return {
    ok: true,
    readout: {
      entries,
      authored: entries.filter((e): e is AuthoredEntry => e.kind === 'authored'),
      liveHash,
      liveSource,
      sealed: isSealed(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DEPENDENCY GRAPH — which derived values MOVE when this field moves
// ─────────────────────────────────────────────────────────────────────────────

export interface Graph {
  /** key -> every derived / derived-fn key it influences, transitively, sorted. */
  affects: ReadonlyMap<string, readonly string[]>;
}

/**
 * Build the transitive "what does this field change" map.
 *
 * ⚠️ Derived-FN entries (`minSafeRadiusFor(N)`, `fogRadiusAt(t, …)`) are SINKS. They
 * declare inputs so the panel can name what moves them, and the registry deliberately
 * "records nothing executable" for them, so they can be affected and can never affect.
 * `registry.ts:valuesOf` enforces the same thing from the other side — it throws if a
 * derived-fn key is used as an input.
 */
export function buildGraph(entries: readonly RegistryEntry[]): Graph {
  const direct = new Map<string, string[]>();
  for (const e of entries) {
    if (e.kind === 'authored') continue;
    for (const input of e.inputs) {
      const list = direct.get(input);
      if (list) list.push(e.key); else direct.set(input, [e.key]);
    }
  }
  const affects = new Map<string, readonly string[]>();
  for (const e of entries) {
    const seen = new Set<string>();
    const queue = [...(direct.get(e.key) ?? [])];
    while (queue.length) {
      const k = queue.shift()!;
      if (seen.has(k)) continue;   // also the cycle guard
      seen.add(k);
      for (const next of direct.get(k) ?? []) if (!seen.has(next)) queue.push(next);
    }
    if (seen.size) affects.set(e.key, [...seen].sort());
  }
  return { affects };
}

/**
 * The value `key` would have under `candidates` — recursively, through every derived
 * layer between them.
 *
 * `candidates` maps AUTHORED keys to hypothetical values. A derived key in there is
 * ignored on purpose: `registry.ts` makes `{ SUDDEN_DEATH_MS: 5 }` a compile error and
 * this must not become the runtime loophole that undoes it.
 */
export function resolveValue(
  key: string,
  candidates: ReadonlyMap<string, number>,
  memo: Map<string, number> = new Map(),
  stack: Set<string> = new Set(),
): number {
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const e = entryFor(key);
  if (!e) throw new Error(`admin: "${key}" is not in the registry`);
  let v: number;
  if (e.kind === 'authored') {
    v = candidates.has(key) ? candidates.get(key)! : e.value;
  } else if (e.kind === 'derived') {
    if (stack.has(key)) throw new Error(`admin: derived cycle through "${key}"`);
    stack.add(key);
    const inputs: Record<string, number> = {};
    for (const i of e.inputs) inputs[i] = resolveValue(i, candidates, memo, stack);
    // The registry's own lambda. This file contributes the ORDER and nothing else.
    v = e.recompute(inputs);
    stack.delete(key);
  } else {
    throw new Error(`admin: "${key}" is a derived FUNCTION and has no scalar value`);
  }
  memo.set(key, v);
  return v;
}

/**
 * The candidate map `resolveValue` wants, built from the panel's staged set.
 *
 * 🚨 **THE TWO MAPS MEAN DIFFERENT THINGS BY ABSENCE, AND CONFLATING THEM IS A SILENT
 * WRONG NUMBER.** In the panel's STAGED set, a missing key means *"no override — this
 * constant will boot at its AUTHORED literal"*. In `resolveValue`'s candidate map, a
 * missing key means *"unchanged — use the LIVE value"*. Those coincide only while nothing
 * is currently overridden. The moment Uri boots a tuned set and then DELETES one of its
 * fields, the two disagree: the field will boot authored, and a naive pass of the staged
 * map straight into `resolveValue` would compute every consequence against the value he
 * just removed. So the translation is explicit, and it is done once per render rather
 * than per row.
 *
 * Returns only the keys that actually MOVE, so `resolveValue`'s memo does the least work.
 */
export function pendingCandidates(
  staged: ReadonlyMap<string, number>,
  authored: readonly AuthoredEntry[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of authored) {
    const willBe = staged.has(e.key) ? staged.get(e.key)! : e.authored;
    if (!Object.is(willBe, e.value)) out.set(e.key, willBe);
  }
  return out;
}

/** What `key` will boot as under `staged`. Absence means "no override", i.e. authored. */
export function willBe(entry: AuthoredEntry, staged: ReadonlyMap<string, number>): number {
  return staged.has(entry.key) ? staged.get(entry.key)! : entry.authored;
}

/** One row of "…and here is what that does". */
export interface Consequence {
  key: string;
  kind: 'derived' | 'derived-fn';
  unit: string;
  doc: string;
  /** Prose from the registry. For a derived-fn this is its `file:symbol` plus signature. */
  formula: string;
  /** Under the LIVE constant set — what the sim is running right now. */
  live: number | null;
  /** Under the staged set including this field's candidate. `null` for a derived-fn. */
  next: number | null;
  /** True when `next` differs from `live` by more than a float wobble. */
  moved: boolean;
}

const EPS = 1e-12;

/**
 * What moves if `key` becomes `candidate`, given everything else already staged.
 *
 * 🚨 **THIS IS THE FUNCTION THAT MAKES IT A TUNING TOOL RATHER THAN A CONFIG EDITOR**
 * (§76: *"a cooldown that happens to divide a status cycle produces an 83% lock… nobody
 * could see that from a number in a text box"*). It enumerates nothing: a consequence
 * appears here because the registry declared it as derived FROM this key, so a
 * consequence added in `rules.ts` next month shows up with no edit to the panel — and one
 * that is deleted disappears, rather than becoming a stale caption.
 */
export function consequencesFor(
  key: string,
  candidate: number,
  staged: ReadonlyMap<string, number>,
  graph: Graph,
): Consequence[] {
  const affected = graph.affects.get(key) ?? [];
  if (affected.length === 0) return [];
  const next = new Map(staged);
  next.set(key, candidate);
  const memo = new Map<string, number>();
  const out: Consequence[] = [];
  for (const k of affected) {
    const e = entryFor(k);
    if (!e || e.kind === 'authored') continue;
    if (e.kind === 'derived-fn') {
      out.push({
        key: k, kind: 'derived-fn', unit: e.unit, doc: e.doc,
        formula: `${e.where}(${e.args.join(', ')})`,
        live: null, next: null, moved: true,
      });
      continue;
    }
    let after: number | null = null;
    try {
      after = resolveValue(k, next, memo);
    } catch { /* a broken recompute must not blank the panel */ }
    out.push({
      key: k, kind: 'derived', unit: e.unit, doc: e.doc, formula: e.formula,
      live: e.value, next: after,
      moved: after !== null && Math.abs(after - e.value) > EPS,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION — §76 CONSTRAINT 4: a wired field is clamped where the sim clamps it
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refuse a candidate, or return `null`.
 *
 * ⚠️ **THE REGISTRY IS THE AUTHORITY AND THIS IS THE COURTESY.** `registry.ts`'s private
 * `checkOverride()` runs the same three comparisons at BOOT, over this same spec object,
 * and THROWS with the key named. So the failure mode of this function being laxer is a
 * loud boot error with a documented escape hatch (`?tuning=off`), never a silently
 * clamped value — which `registry.ts` itself calls out as the worse defect: *"the stamp
 * would say tuned to 0.9 and the sim would be running 0.5"*.
 *
 * The bands themselves are NOT restated here: `min`, `max` and `int` are read off the
 * entry the sim registered. `adm_model.mjs` asserts the two functions agree on a table of
 * known-bad inputs by actually booting a registry, so "they agree" is measured rather
 * than promised.
 */
export function validateCandidate(entry: AuthoredEntry, v: number): string | null {
  if (!Number.isFinite(v)) return 'not a number';
  if (entry.int && !Number.isInteger(v)) return 'must be a whole number';
  if (v < entry.min) return `below ${entry.min}`;
  if (v > entry.max) return `above ${entry.max}`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE — the panel stages, the RELOAD applies
// ─────────────────────────────────────────────────────────────────────────────
//
// 🚨 **A CONSTANT CANNOT CHANGE WHILE THE GAME IS RUNNING, AND THAT IS THE DESIGN.**
// `store.ts` says it at length: `export const PLAYER_SPEED = 0.12` is an ESM binding that
// cannot be reassigned, a getter would put a call in the sim's hot path, and a constant
// that moved MID-MATCH would make a seeded replay unreproducible — destroying the one
// property that "underwrites every balance number in the project". So the store SEALS on
// first read and a later write throws.
//
// The panel therefore edits a STAGED set, writes it to localStorage, and reloads. Every
// row shows three numbers — authored / live / staged — because a panel that showed one
// box would be claiming the sim had already changed, which is §76 constraint 4's exact
// class of defect ("a field that is displayed must be wired").

/** What came back out of storage, and whether it was readable. */
export interface StoredSet {
  overrides: Map<string, number>;
  /** Set when storage held something unusable. The panel shows it rather than eating it. */
  problem: string | null;
  /** Keys present in storage that the registry does not know. Shown, never silently kept. */
  unknown: string[];
  /** Keys present in storage that name a DERIVED value — refused by `registry.ts` at boot. */
  derived: string[];
}

function storage(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;      // storage disabled (private mode, embedded webview)
  }
}

/**
 * Read the persisted override set.
 *
 * Accepts both the bare map and the `{ overrides: {…} }` envelope, exactly as
 * `store.ts:parseBootstrapPayload` does — so a file exported from this panel can be pasted
 * straight back in, and so the panel reads what the boot path reads.
 */
export function readStoredSet(): StoredSet {
  const out: StoredSet = { overrides: new Map(), problem: null, unknown: [], derived: [] };
  const ls = storage();
  if (!ls) return out;
  let raw: string | null = null;
  try { raw = ls.getItem(STORAGE_KEY); } catch { return out; }
  if (!raw) return out;
  let json: unknown;
  try { json = JSON.parse(raw); } catch (err) {
    out.problem = `stored set is not valid JSON — ${(err as Error).message}`;
    return out;
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    out.problem = 'stored set is not a JSON object';
    return out;
  }
  const obj = json as Record<string, unknown>;
  const body = (typeof obj.overrides === 'object' && obj.overrides !== null)
    ? obj.overrides as Record<string, unknown>
    : obj;
  for (const [k, v] of Object.entries(body)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      out.problem = `stored key "${k}" is not a finite number`;
      continue;
    }
    const e = entryFor(k);
    if (!e) { out.unknown.push(k); continue; }
    if (e.kind !== 'authored') { out.derived.push(k); continue; }
    out.overrides.set(k, v);
  }
  return out;
}

/** The envelope this panel writes and exports. `tuningHash` is a STAMP, not an input. */
export interface ExportEnvelope {
  tuningHash: string;
  savedAt: string;
  overrides: Record<string, number>;
}

/**
 * The set, canonicalised the way the hash sees it: keys sorted, no-op overrides dropped.
 *
 * ⚠️ A key written back to its authored default is REMOVED, matching
 * `store.ts:effectiveOverrideEntries`. Without that the panel could persist a set that
 * hashes to `'stock'` while looking overridden, and §76 constraint 3's whole job is that
 * the hash names the CONSTANT SET rather than the edit history.
 */
export function canonicalise(staged: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const key of [...staged.keys()].sort()) {
    const e = entryFor(key);
    if (!e || e.kind !== 'authored') continue;
    const v = staged.get(key)!;
    if (Object.is(v, e.authored)) continue;
    out.set(key, v);
  }
  return out;
}

/** What the staged set WILL hash to once it is applied — the peer's hash, not a copy. */
export function stagedHash(staged: ReadonlyMap<string, number>): string {
  return hashOfPairs(canonicalise(staged));
}

export function buildEnvelope(staged: ReadonlyMap<string, number>): ExportEnvelope {
  const eff = canonicalise(staged);
  return {
    tuningHash: hashOfPairs(eff),
    savedAt: new Date().toISOString(),
    overrides: Object.fromEntries(eff),
  };
}

/**
 * Persist and hand back the envelope written. Throws if storage refuses — the caller
 * must not tell Uri his set was saved when it was not.
 */
export function persistStagedSet(staged: ReadonlyMap<string, number>): ExportEnvelope {
  const ls = storage();
  if (!ls) throw new Error('localStorage is unavailable in this context, so nothing can be persisted');
  const env = buildEnvelope(staged);
  if (Object.keys(env.overrides).length === 0) ls.removeItem(STORAGE_KEY);
  else ls.setItem(STORAGE_KEY, JSON.stringify(env));
  return env;
}

/** Parse a pasted/imported envelope into a staged set, refusing anything the sim would. */
export function parseImported(text: string): { staged: Map<string, number> } | { error: string } {
  let json: unknown;
  try { json = JSON.parse(text); } catch (err) { return { error: `not valid JSON — ${(err as Error).message}` }; }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return { error: 'expected a JSON object' };
  const obj = json as Record<string, unknown>;
  const body = (typeof obj.overrides === 'object' && obj.overrides !== null)
    ? obj.overrides as Record<string, unknown>
    : obj;
  const staged = new Map<string, number>();
  const bad: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    const e = entryFor(k);
    if (!e) { bad.push(`${k} (unknown key)`); continue; }
    if (e.kind !== 'authored') { bad.push(`${k} (derived — cannot be overridden)`); continue; }
    if (typeof v !== 'number' || !Number.isFinite(v)) { bad.push(`${k} (not a finite number)`); continue; }
    const problem = validateCandidate(e, v);
    if (problem) { bad.push(`${k} (${problem})`); continue; }
    staged.set(k, v);
  }
  if (bad.length) return { error: `refused ${bad.length} key(s): ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? ' …' : ''}` };
  if (staged.size === 0) return { error: 'the set is empty — nothing to import' };
  return { staged };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION HELPERS — formatting only, no arithmetic on a game value
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A number, readably, without lying about its precision.
 *
 * ⚠️ Rounds for DISPLAY only and never feeds anything back into the model: `0.12` must
 * survive a round trip through this panel as `0.12`, because a value that drifts by a
 * display artefact would change the set hash and silently refuse every historical
 * comparison (§76 constraint 3).
 */
export function fmt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  if (Number.isInteger(v)) return String(v);
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(1);
  if (a >= 1) return String(Number(v.toFixed(4)));
  return String(Number(v.toPrecision(4)));
}

/** The five tabs, in order. `TuneGroup` is the registry's; the label is the panel's. */
export const TABS: ReadonlyArray<{ id: string; label: string; group: TuneGroup | null }> = [
  { id: 'combat', label: 'Combat', group: 'combat' },
  { id: 'character', label: 'Characters', group: 'character' },
  { id: 'arena', label: 'Arena & Schedule', group: 'arena' },
  { id: 'economy', label: 'Economy', group: 'economy' },
  { id: 'analytics', label: 'Analytics', group: null },
];
