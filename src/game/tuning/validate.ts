/**
 * VALIDATION AND PERSISTENCE — the run-time half of the refusals `keys.ts` makes statically.
 *
 * `DECISIONS-FOR-URI.md` §76. `keys.ts` explains what the type system can and cannot see; this
 * file is where the rest is caught. **JSON arriving from `localStorage`, from a pasted export,
 * or from `FA_TUNING` has no types**, so every guarantee `OverrideSet` makes has to be made
 * again here against the *populated registry* — which is the only thing that knows a key
 * exists, what band it sits in, and whether it is derived.
 *
 * ── WHY THIS IS A SEPARATE FILE FROM `tuningStore.ts` ────────────────────────────
 *
 * `tuningStore.ts` imports NOTHING, deliberately: it is evaluated before `rules.ts` and an import of
 * the registry from there would be a cycle whose failure mode is a half-initialised constant
 * table. So `tuningStore.ts` can check that a value is a finite number and nothing else — it cannot
 * see a band, because bands live on registry entries that do not exist yet. This file runs
 * *after* everything is registered and can therefore be strict.
 *
 * ── 🚨 REFUSE, DO NOT CLAMP. THE WHOLE FILE IS THIS ONE RULE ───────────────
 *
 * §76 constraint 4 is about surfaces that look authoritative and are not, and a silently
 * clamped override is the sharpest version: `tuningRegistry.ts` puts it exactly right — *"the stamp
 * would say 'tuned to 0.9' and the sim would be running 0.5"*, so every number measured under
 * it is unreproducible in the most confusing possible way. Nothing here clamps. Nothing here
 * drops a key quietly. Every rejection names the key and what was wrong with it.
 *
 * ── ⚠️ A SECOND IMPLEMENTATION EXISTS AND IT IS DECLARED RATHER THAN HIDDEN ─
 *
 * `src/admin/model.ts` carries its own `readStoredSet` / `canonicalise` / `buildEnvelope` /
 * `parseImported`. It was written while this file did not exist — its own header says so — and
 * it is a **STAGING** model: the panel's map is "what will boot", where an absent key means
 * *authored*, while this file's map is "what is installed", where an absent key means
 * *unchanged*. `model.ts:pendingCandidates` exists precisely to translate between those two
 * meanings and gets it right. **They are not the same object, but the parsing and
 * canonicalisation halves genuinely are duplicated**, which is the defect shape this repo has
 * recorded more often than any other. It is named here, in the file that should own it, rather
 * than left for someone to find: `src/admin/` is owned by another pass and collapsing the two
 * is a change to that file set, not this one.
 */

import { entryFor, hasKey, assertRegistryPopulated, type AuthoredEntry } from '../tuningRegistry.ts';
import { STORAGE_KEY, canonicalNumber, hashOfPairs, isSealed } from '../tuningStore.ts';
import type { TuningEnvelope } from './keys.ts';

/** One rejected key, with enough to render a line the reader can act on. */
export interface Rejection {
  key: string;
  why: string;
}

export type ParseResult =
  | { ok: true; overrides: Map<string, number>; hash: string }
  | { ok: false; rejections: Rejection[] };

/**
 * Validate a candidate set against the live registry.
 *
 * 🚨 **IT REFUSES THE WHOLE SET, NOT THE BAD KEYS.** A partially-applied set is a set nobody
 * can name: its hash would describe the keys that survived while the file on disk describes
 * the ones that were asked for, and §76 constraint 3 exists so that a measurement can always
 * say which constants produced it. Half a set is the failure that constraint is about.
 *
 * ⚠️ **AND IT ASSERTS THE REGISTRY IS POPULATED FIRST.** `CLAUDE.md` #6: the vacuity class
 * fired three times in three files in one session, always because a fix emptied the set an
 * assertion ran over. Against an EMPTY registry every key here would be "unknown" — so this
 * would look like a working guard while being unable to accept anything at all, which reads
 * as a bad set rather than as a broken boot. `assertRegistryPopulated` throws instead.
 */
export function parseSet(input: unknown): ParseResult {
  assertRegistryPopulated();
  const rejections: Rejection[] = [];
  const body = unwrap(input, rejections);
  if (!body) return { ok: false, rejections };

  const out = new Map<string, number>();
  for (const [key, raw] of Object.entries(body)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      rejections.push({ key, why: `not a finite number (${JSON.stringify(raw)})` });
      continue;
    }
    if (!hasKey(key)) {
      rejections.push({ key, why: 'not a registered constant — a typo here would be silently ignored while still changing the set hash' });
      continue;
    }
    const e = entryFor(key)!;
    if (e.kind !== 'authored') {
      rejections.push({ key, why: `is DERIVED (${e.kind}) — it is computed from other constants and a text box on it would re-create the bug §72 fixed` });
      continue;
    }
    const problem = bandProblem(e, raw);
    if (problem) { rejections.push({ key, why: problem }); continue; }
    out.set(key, raw);
  }
  if (rejections.length) return { ok: false, rejections };
  return { ok: true, overrides: out, hash: hashOfPairs(effective(out)) };
}

/**
 * Why `v` is outside `entry`'s band, or `null`.
 *
 * ⚠️ **THE BAND IS READ OFF THE ENTRY, NEVER RESTATED.** `tuningRegistry.ts:checkOverride` runs the
 * same three comparisons at BOOT over the same spec object, and the two agreeing is what makes
 * this function a courtesy rather than a second authority: if this one were laxer the result is
 * a loud boot error with a documented escape hatch, never a value that got past both.
 * `tools/tmp/tun_gate.mjs` measures the agreement on a table of known-bad inputs instead of
 * assuming it.
 */
export function bandProblem(entry: AuthoredEntry, v: number): string | null {
  if (!Number.isFinite(v)) return 'not a finite number';
  if (entry.int && !Number.isInteger(v)) return `must be a whole number, got ${v}`;
  if (v < entry.min) return `${v} is below the minimum ${entry.min}`;
  if (v > entry.max) return `${v} is above the maximum ${entry.max}`;
  return null;
}

/**
 * Drop every key already sitting at its authored default.
 *
 * Matches `tuningStore.ts:effectiveOverrideEntries` — a no-op override canonicalises OUT, so a set
 * that writes `0.12` back onto `PLAYER_SPEED` hashes to `'stock'` and compares against every
 * historical stock measurement. The hash names the CONSTANT SET, not the edit history.
 */
function effective(map: ReadonlyMap<string, number>): Array<readonly [string, number]> {
  const out: Array<readonly [string, number]> = [];
  for (const [k, v] of map) {
    const e = entryFor(k);
    if (e && e.kind === 'authored' && Object.is(e.authored, v)) continue;
    out.push([k, v] as const);
  }
  return out;
}

/** Accept the bare map and the `{ overrides: {…} }` envelope, exactly as the boot path does. */
function unwrap(input: unknown, rejections: Rejection[]): Record<string, unknown> | null {
  let json = input;
  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch (err) {
      rejections.push({ key: '<document>', why: `not valid JSON — ${(err as Error).message}` });
      return null;
    }
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    rejections.push({ key: '<document>', why: 'expected a JSON object' });
    return null;
  }
  const obj = json as Record<string, unknown>;
  const inner = obj.overrides;
  if (inner !== undefined) {
    if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) {
      rejections.push({ key: 'overrides', why: 'the envelope\'s `overrides` field is not an object' });
      return null;
    }
    return inner as Record<string, unknown>;
  }
  return obj;
}

/** The envelope a set is written and shared as. `tuningHash` is a STAMP, never an input. */
export function exportSet(overrides: ReadonlyMap<string, number>): TuningEnvelope {
  const eff = effective(overrides);
  return {
    tuningHash: hashOfPairs(eff),
    savedAt: new Date().toISOString(),
    overrides: Object.fromEntries(eff),
  };
}

/** The exported envelope as text, stable enough to diff and commit. */
export function exportSetText(overrides: ReadonlyMap<string, number>): string {
  const env = exportSet(overrides);
  const body = Object.entries(env.overrides)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${canonicalNumber(v)}`)
    .join(',\n');
  return `{\n  "tuningHash": ${JSON.stringify(env.tuningHash)},\n  "savedAt": ${JSON.stringify(env.savedAt)},\n  "overrides": {\n${body}\n  }\n}\n`;
}

/**
 * Persist a validated set and hand back what was written. **THIS IS THE ONLY WRITE PATH, AND
 * IT DOES NOT CHANGE THE RUNNING SIM — the caller must RELOAD.**
 *
 * 🚨 `tuningStore.ts` states the reason at length and it is not a limitation: `export const
 * PLAYER_SPEED = 0.12` is an ESM binding that cannot be reassigned, a getter would put a call
 * in the sim's hot path, and a constant that moved MID-MATCH would make a seeded replay
 * unreproducible — destroying the one property that *"underwrites every balance number in the
 * project"*. So the store seals on first read and this function refuses to pretend otherwise:
 * it throws if storage is unavailable rather than reporting a save that did not happen.
 *
 * ⚠️ An empty effective set REMOVES the key rather than storing `{}` — otherwise a stock set
 * would leave a residue that the next boot reads, hashes to `'stock'` anyway, and reports its
 * source as `localStorage`. Same numbers, different provenance, for no reason.
 */
export function persistOverrides(overrides: ReadonlyMap<string, number>): TuningEnvelope {
  const ls = localStorageOrNull();
  if (!ls) {
    throw new Error(
      'tuning: localStorage is unavailable here, so nothing was persisted. ' +
      'In Node use FA_TUNING="$(cat set.json)"; in a webview with storage disabled there is no persistence at all.',
    );
  }
  const env = exportSet(overrides);
  if (Object.keys(env.overrides).length === 0) ls.removeItem(STORAGE_KEY);
  else ls.setItem(STORAGE_KEY, JSON.stringify(env));
  return env;
}

function localStorageOrNull(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;      // private mode, embedded webview, or no DOM at all
  }
}

/**
 * 🚨 **THERE IS NO `installValidatedSet()`, AND THE REASON IS A CIRCLE, NOT AN OVERSIGHT.**
 *
 * One was written here and deleted before it shipped, because it cannot work:
 *
 *   * `parseSet` needs a POPULATED registry — a key's band, and whether it is derived, exist
 *     only on the entry `rules.ts` created;
 *   * the registry is populated BY `rules.ts` evaluating;
 *   * and `rules.ts` evaluating **seals the store** (`tuningStore.ts:rawOverride` sets `sealed` on
 *     the first read), after which `installRawOverrides` throws by design.
 *
 * So "validate this set, then install it into this process" is **impossible by construction**,
 * and a function offering it would have thrown one of two ways round every single time —
 * `assertRegistryPopulated` before the boot, `installRawOverrides` after it. Worse, it would
 * have looked like the obvious API and sent the next reader hunting for a bug in the store.
 *
 * The two paths that DO work, and both install before anything is read:
 *
 *   * **Node** — `FA_TUNING="$(cat set.json)" node …`, read at `tuningStore.ts` module evaluation,
 *     which is always early enough because `tuningStore.ts` is the leaf of the import graph.
 *   * **Browser** — `persistOverrides()` above, then RELOAD. That is the panel's whole
 *     interaction model and `tuningStore.ts` explains why it is the design rather than a limitation.
 *
 * `validateForHandoff` is the honest version of what the deleted function was reaching for:
 * check a set in THIS process, then hand it to the NEXT one.
 */
export function validateForHandoff(input: unknown): ParseResult {
  return parseSet(input);
}

/** True once `rules.ts` has read a constant — i.e. once installing anything would throw. */
export function overridesLocked(): boolean {
  return isSealed();
}
