/**
 * THE OVERRIDE STORE — raw values, the seal, the bootstrap, and the SET HASH.
 *
 * `DECISIONS-FOR-URI.md` §76. Uri: *"All game and character constants should be manageable
 * through admin. Nothing lives in code."* This file is the half of that sentence which is
 * NOT a UI: the place a tuned value comes from, and the machinery that makes a tuned value
 * impossible to quote without saying which set produced it.
 *
 * ⚠️ **THIS FILE IMPORTS NOTHING.** It is evaluated before `rules.ts` (which imports
 * `tuningRegistry.ts`, which imports this) and an import of `rules.ts` from here would be a cycle
 * whose failure mode is a half-initialised constant table — i.e. the one defect that is
 * worse than having no override layer at all.
 *
 * ── §76 CONSTRAINT 1: ONE READ PATH, NOT TWO SOURCES OF TRUTH ───────────────
 *
 * `CLAUDE.md` says `rules.ts` is the single source of truth for combat, and this project's
 * most-repeated defect by a wide margin is **one rule stated in two places** — five AI
 * driver bugs, `range` as "two quantities wearing one number", `damage` being per-PELLET
 * (worth 50.6 pp and balanced against twice), the 1x map literals, a fog formula duplicated
 * so it *"AGREED BY CONSTRUCTION"*.
 *
 * So the panel does **not** get a second table of numbers. `rules.ts` keeps its literals and
 * reads each one through `tuningRegistry.ts:tunables()`, which consults this store. The authored
 * default is stated exactly once — as the literal in `rules.ts` — and the registry LEARNS it
 * from there. There is no list of defaults anywhere in `src/game/tuning/`; a file that held
 * one would be the second place.
 *
 * ── OVERRIDES ARE INSTALLED BEFORE `rules.ts` EVALUATES, AND ONLY THEN ──────
 *
 * 🚨 **AND THAT IS THE DESIGN, NOT A LIMITATION.** `export const PLAYER_SPEED = 0.12` is read
 * by `sim.ts`, `ai.ts`, `movement.ts` and eleven tools; an ESM `const` binding cannot be
 * reassigned, and making it a getter would put a function call in the sim's hot path and
 * destroy the property that *"the sim is deterministic and seeded, and that underwrites
 * every balance number in the project"* — a constant that can change **mid-match** makes a
 * replay unreproducible even when the seed is identical.
 *
 * So the first read SEALS the store, and any later write THROWS. A panel that changes a
 * value persists the set and reloads. `persistOverrides()` in `validate.ts` is that path and
 * says so in its own name.
 *
 * ── THE SET HASH — §76 CONSTRAINT 3 ────────────────────────────────────────
 *
 * *"Every balance number in this repo is tied to a constant set and NOTHING RECORDS WHICH."*
 * `csx_bitid`, `conceal_lab --bitid`, `np_ab` and `rc_oracle.json` all compare against
 * recorded state. The moment constants are tunable, an oracle without its constant set is
 * meaningless. So:
 *
 *   * a set with no effective overrides hashes to the DISTINGUISHED STRING `'stock'`;
 *   * anything else hashes to `tun1-<16 hex>`;
 *   * **an ABSENT stamp is `null` and is NEVER treated as stock** — that is the whole reason
 *     stock is a word rather than a hash. An unstamped historical measurement is UNKNOWN, and
 *     `assertSameTuning` REFUSES it (it does not warn) exactly as `arena-scan --baseline`
 *     exits 2 on a foreign station set rather than quietly comparing.
 *
 * ⚠️ A no-op override — a key written back to its authored default — canonicalises OUT, so
 * "I set it to 0.12 and 0.12 is the default" hashes to `'stock'` and compares against every
 * historical stock measurement. That is deliberate: the hash names the CONSTANT SET, not the
 * edit history that produced it.
 */

/** The distinguished hash meaning "no effective overrides". Never a hex string. */
export const STOCK_HASH = 'stock';

/** Prefix on every non-stock hash, so a stamp is self-describing in a JSON blob. */
export const HASH_PREFIX = 'tun1-';

/** localStorage key. Versioned, so a schema change cannot silently mis-read an old set. */
export const STORAGE_KEY = 'fa.tuning.v1';

/** Env var read in Node: inline JSON, a path to a JSON file, or the literal `off`. */
export const ENV_KEY = 'FA_TUNING';

/** Where the live set came from. `'none'` means nothing was installed — genuinely stock. */
export type TuningSource = 'none' | 'global' | 'localStorage' | 'env' | 'programmatic';

let overrides = new Map<string, number>();
let defaults = new Map<string, number>();
let source: TuningSource = 'none';
let sealed = false;
/** Set by `tuningRegistry.ts` once `assertRegistryPopulated()` has run. Hash validity depends on it. */
let defaultsComplete = false;

/**
 * A canonical decimal for a finite number, stable across engines.
 *
 * `Number.prototype.toString()` is specified to produce the shortest string that round-trips,
 * so it is the same in Node and every browser. `-0` is normalised because `Object.is(-0, 0)`
 * is false while every consumer here treats them as one value, and a set that hashed
 * differently for `-0` would refuse a comparison against its own twin.
 */
export function canonicalNumber(v: number): string {
  if (!Number.isFinite(v)) throw new RangeError(`tuning: non-finite value ${String(v)}`);
  return Object.is(v, -0) ? '0' : String(v);
}

/**
 * FNV-1a, 64-bit, over the canonical text of the set.
 *
 * Not `crypto.subtle` — that is async and this has to be callable from a constant's
 * initialiser. Not `Math.random`-seeded, not insertion-ordered: the input is sorted, so two
 * sets with the same pairs hash the same however they were built. 64 bits is ample for a
 * value whose job is to REFUSE a mismatch, not to resist an adversary.
 */
export function fnv1a64(text: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i++) {
    h = (h ^ BigInt(text.charCodeAt(i) & 0xff)) * prime & mask;
    // Characters above U+00FF would collide with their low byte, so the high byte is fed
    // in too. Every key in this registry is ASCII today; this is here so that stops being
    // load-bearing.
    const hi = text.charCodeAt(i) >> 8;
    if (hi) h = (h ^ BigInt(hi)) * prime & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/** The hash of an explicit list of pairs. Exported so a tool can hash a set it never installs. */
export function hashOfPairs(pairs: Iterable<readonly [string, number]>): string {
  const sorted = [...pairs].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (sorted.length === 0) return STOCK_HASH;
  return HASH_PREFIX + fnv1a64(sorted.map(([k, v]) => `${k}=${canonicalNumber(v)}`).join('\n'));
}

/**
 * The raw override for `key`, or `undefined`. **Reading SEALS the store.**
 *
 * Called once per tunable during `rules.ts` evaluation and never again — there is no read
 * of this on the sim's hot path, by construction, because every consumer reads the `const`
 * that `tunables()` returned.
 */
export function rawOverride(key: string): number | undefined {
  sealed = true;
  return overrides.get(key);
}

/** Record the authored default for `key`. Called by the registry, which learns it from `rules.ts`. */
export function noteDefault(key: string, value: number): void {
  defaults.set(key, value);
}

/** True once any tunable has been read — i.e. once `rules.ts` has begun evaluating. */
export function isSealed(): boolean {
  return sealed;
}

/** Where the live set came from. */
export function tuningSource(): TuningSource {
  return source;
}

/** Marks the defaults table complete. `tuningRegistry.ts` calls this; the hash is unsafe before it. */
export function markDefaultsComplete(): void {
  defaultsComplete = true;
}

export function areDefaultsComplete(): boolean {
  return defaultsComplete;
}

/**
 * Install a raw override map. **Throws once anything has been read**, because a constant that
 * changes after `rules.ts` has handed out its values would leave the tree half-tuned — the
 * `range`-means-two-things defect with a clock on it.
 *
 * ⚠️ Values are NOT validated here: this file cannot see the registry (it would be a cycle).
 * `tuningRegistry.ts:tunables()` validates each key against its spec as it registers it, and
 * `validate.ts:parseSet()` validates a whole set against the populated registry before it is
 * ever persisted. The only way to reach an invalid value at boot is to hand-edit storage, and
 * that path throws with the key named.
 */
export function installRawOverrides(
  map: Readonly<Record<string, number>> | ReadonlyMap<string, number>,
  from: TuningSource,
): void {
  if (sealed) {
    throw new Error(
      'tuning: overrides cannot be installed after a constant has been read. ' +
      'rules.ts is already evaluated. Persist the set and RELOAD — see validate.ts:persistOverrides.',
    );
  }
  const next = new Map<string, number>();
  const entries: Iterable<readonly [string, number]> =
    map instanceof Map ? map.entries() : Object.entries(map as Record<string, number>);
  for (const [k, v] of entries) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new RangeError(`tuning: override "${k}" is not a finite number (${String(v)})`);
    }
    next.set(k, v);
  }
  overrides = next;
  source = next.size === 0 ? 'none' : from;
}

/** Every raw override, whether or not it differs from its default. */
export function rawOverrideEntries(): ReadonlyArray<readonly [string, number]> {
  return [...overrides.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/**
 * The EFFECTIVE set: raw overrides minus every key already sitting at its authored default.
 *
 * ⚠️ Throws if the defaults table is not yet complete. A hash taken mid-evaluation would
 * canonicalise against a partial default table and could call a tuned set "stock" — which is
 * the failure this whole mechanism exists to prevent, so it fails loudly instead.
 */
export function effectiveOverrideEntries(): ReadonlyArray<readonly [string, number]> {
  if (!defaultsComplete) {
    throw new Error(
      'tuning: the set hash was read before the registry finished populating. ' +
      'Import `src/game/tuning/index.ts` (it evaluates rules.ts and economy/tuning.ts) before hashing.',
    );
  }
  const out: Array<readonly [string, number]> = [];
  for (const [k, v] of overrides) {
    const d = defaults.get(k);
    if (d !== undefined && Object.is(d, v)) continue;
    out.push([k, v] as const);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** `'stock'` when nothing is effectively overridden, else `tun1-<hex>`. */
export function tuningSetHash(): string {
  return hashOfPairs(effectiveOverrideEntries());
}

/** True when the live set is `'stock'`. */
export function isStock(): boolean {
  return tuningSetHash() === STOCK_HASH;
}

/**
 * What a recorder stamps into a measurement. Spread this into any JSON an oracle will later
 * be compared against — that is the whole of §76 constraint 3's mechanical half.
 */
export function tuningStamp(): { tuningHash: string; tuningSource: TuningSource; overrides: Record<string, number> } {
  const eff = effectiveOverrideEntries();
  return {
    tuningHash: tuningSetHash(),
    tuningSource: source,
    overrides: Object.fromEntries(eff),
  };
}

/** Thrown by `assertSameTuning`. A distinct class so a caller can exit 2 rather than 1. */
export class TuningMismatchError extends Error {
  readonly recorded: string | null;
  readonly actual: string | null;
  constructor(recorded: string | null | undefined, actual: string | null | undefined, what: string) {
    const r = recorded ?? 'UNSTAMPED';
    const a = actual ?? 'UNSTAMPED';
    super(
      `tuning: REFUSING to compare ${what} across constant sets — recorded ${r}, actual ${a}. ` +
      (recorded == null || actual == null
        ? 'An UNSTAMPED measurement is UNKNOWN, not stock: it predates the override layer or was ' +
          'written by a tool that does not stamp, and either way nothing records which constants produced it. ' +
          'Re-record it, or stamp it by hand only if you can prove the tree it came from.'
        : 'Re-record the baseline under the current set, or re-run under the recorded one ' +
          `(FA_TUNING=<set.json>). Comparing them would attribute a CONSTANT change to a CODE change.`),
    );
    this.name = 'TuningMismatchError';
    this.recorded = recorded ?? null;
    this.actual = actual ?? null;
  }
}

/**
 * REFUSE, do not warn. §76 constraint 3, and the precedent is `arena-scan --baseline`, which
 * exits 2 on a foreign station set rather than printing a comparison nobody can interpret.
 *
 * `null`/`undefined` on either side is a REFUSAL, not a pass: the distinguished `'stock'`
 * string exists so that "this measurement was taken on stock constants" and "nobody recorded
 * what this measurement was taken on" cannot be the same value.
 */
export function assertSameTuning(
  recorded: string | null | undefined,
  actual: string | null | undefined = tuningSetHash(),
  what = 'these measurements',
): void {
  if (recorded == null || actual == null || recorded !== actual) {
    throw new TuningMismatchError(recorded, actual, what);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP — runs once, at module evaluation, before `rules.ts` reads anything
// ─────────────────────────────────────────────────────────────────────────────
//
// Three sources, first match wins, and every one of them can be switched off with the
// literal `off` — because a persisted set that a later `min` narrows would otherwise make
// the game unbootable with no way in from the outside. `?tuning=off` is the browser's escape
// hatch and `FA_TUNING=off` is Node's; both are checked BEFORE any source is read.
//
//   1. `globalThis.__FA_TUNING__`   an object injected by a host before the app's modules
//                                   load. This is the hook a native wrapper or a test rig
//                                   uses; nothing in `src/` writes it.
//   2. `localStorage[STORAGE_KEY]`  the panel's own persistence. Browser only.
//   3. `process.env.FA_TUNING`      inline JSON, or a path to a .json file. Node only —
//                                   this is what lets the WHOLE gate battery run under a set
//                                   with no code change:  FA_TUNING=set.json node src/game/sim.test.mjs
//
// ⚠️ A bad set here THROWS rather than being ignored. A silently-dropped override produces a
// measurement whose stamp says "tuned" and whose numbers are stock — unreproducible in the
// most confusing possible way.

function parseBootstrapPayload(text: string, whence: string): Record<string, number> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`tuning: ${whence} is not valid JSON — ${(err as Error).message}`);
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`tuning: ${whence} must be a JSON object`);
  }
  const obj = json as Record<string, unknown>;
  // Accept both the bare map and the exported envelope, so a file written by
  // `validate.ts:exportSet()` can be fed straight back in.
  const body = (typeof obj.overrides === 'object' && obj.overrides !== null)
    ? obj.overrides as Record<string, unknown>
    : obj;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`tuning: ${whence} key "${k}" is not a finite number (${JSON.stringify(v)})`);
    }
    out[k] = v;
  }
  return out;
}

function bootstrap(): void {
  const g = globalThis as Record<string, unknown>;

  // ── the escape hatch, checked first ───────────────────────────────────────
  const proc = g.process as { env?: Record<string, string | undefined> } | undefined;
  const envRaw = proc?.env?.[ENV_KEY];
  if (envRaw === 'off') return;
  try {
    const loc = g.location as { search?: string } | undefined;
    if (loc?.search && /(^|[?&])tuning=off(&|$)/.test(loc.search)) return;
  } catch { /* no DOM */ }

  // 1. host injection
  const injected = g.__FA_TUNING__;
  if (injected && typeof injected === 'object') {
    installRawOverrides(parseBootstrapPayload(JSON.stringify(injected), 'globalThis.__FA_TUNING__'), 'global');
    if (overrides.size > 0) return;
  }

  // 2. localStorage
  try {
    const ls = g.localStorage as { getItem(k: string): string | null } | undefined;
    const stored = ls?.getItem(STORAGE_KEY) ?? null;
    if (stored) {
      installRawOverrides(parseBootstrapPayload(stored, `localStorage["${STORAGE_KEY}"]`), 'localStorage');
      if (overrides.size > 0) return;
    }
  } catch { /* storage disabled or absent */ }

  // 3. env: INLINE JSON ONLY
  //
  // ⚠️ **NOT A PATH, DELIBERATELY.** Reading a file from here would need `node:fs`, and this
  // module is imported by `rules.ts` — i.e. by the browser bundle, by `charStage`, by
  // everything. A static `node:fs` import would break the Vite build; a dynamic one would
  // make this module top-level-await and turn `rules.ts` into an async module, which every
  // tool in `tools/` imports synchronously today. Neither price is worth a convenience the
  // shell already provides:
  //
  //     FA_TUNING="$(cat tools/tmp/tun_sets/slower.json)" node src/game/sim.test.mjs
  if (envRaw) {
    const trimmed = envRaw.trim();
    if (!trimmed.startsWith('{')) {
      throw new Error(
        `tuning: ${ENV_KEY} must be inline JSON or the literal "off" (got ${JSON.stringify(trimmed.slice(0, 40))}). ` +
        `To load a file: ${ENV_KEY}="$(cat set.json)" node …`,
      );
    }
    installRawOverrides(parseBootstrapPayload(trimmed, `${ENV_KEY} (inline JSON)`), 'env');
  }
}

bootstrap();
