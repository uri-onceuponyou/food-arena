/**
 * THE REGISTRY — every tunable in the game, declared where its value is declared.
 *
 * `DECISIONS-FOR-URI.md` §76. Read `tuningStore.ts` first; this file is the half that knows what a
 * key MEANS. It is imported by `rules.ts` and `economy/tuning.ts` and by nothing else in
 * `src/game/`, so the sim's dependency graph gains exactly one leaf.
 *
 * ── ⚠️ WHY THIS FILE IS FLAT IN `src/game/` AND NOT IN `src/game/tuning/` ───
 *
 * **Everything `rules.ts` transitively imports must be a flat `.ts` file in `src/game/`.**
 * Seven tracked staging tools copy that directory with one non-recursive `readdirSync` —
 * `stage_rules`, `stage_sim`, `stage_ai`, `stage_kit`, `stage_vitals`, `stage_weapon`,
 * `rb_stage` — and the project's entire balance-measurement layer sits on them
 * (`roster_table`, `pacing_ladder`, `rules_sweep`, `roster_sweep`, `vitals_probe`, `kit_lab`,
 * `rb_card`/`rb_run`, and the mandatory gate `driver_guard`). The first draft lived in
 * `src/game/tuning/` and `driver_guard` died with `ERR_MODULE_NOT_FOUND` on
 * `…/game/tuning/registry.ts`. `src/game/tuning/registry.ts` is now a two-line re-export view
 * that exists so `src/admin/**` keeps compiling; it carries the full note.
 *
 * ── THE REGISTRY IS POPULATED BY EVALUATION, NOT BY A LIST ─────────────────
 *
 * 🚨 There is **no table of constants in this directory**, and there must never be one.
 * §76 constraint 1: *"the panel must not become the second place"*, and a registry that
 * repeated `PLAYER_SPEED: 0.12` would be exactly that — with the added cruelty that it would
 * agree on the day it was written. `rules.ts` states the literal; `tunables()` reads it,
 * records it as the authored default, and hands back either it or the override. **The
 * default and the value flow the same way, from the same character on the same line.**
 *
 * ── AUTHORED vs DERIVED IS A TYPE, NOT A FLAG — §76 CONSTRAINT 2 ───────────
 *
 * `SUDDEN_DEATH_MS` is `FOG_CLOSE_MS + SUDDEN_DEATH_GRACE_MS` *precisely because* a literal
 * let the clock and the collapse drift apart — the bug Uri found by playing (`§72`). A text
 * box on it un-fixes that. So a derived value is registered with `derive()`, which:
 *
 *   * takes the INPUTS it reads and a PURE RECOMPUTE, and produces the value BY calling it —
 *     so the formula is stated once, as executable code, and the registry can re-run it on
 *     hypothetical inputs for a live preview without the panel knowing any arithmetic;
 *   * returns a value that no override can reach: `DerivedKey` and `AuthoredKey` are
 *     disjoint unions and `OverrideSet` is keyed on the authored one, so
 *     `{ SUDDEN_DEATH_MS: 5 }` does not compile. `validate.ts` refuses it again at runtime,
 *     because JSON arriving from a file has no types.
 *
 * ── WHAT THE TYPE SYSTEM DOES AND DOES NOT CATCH, STATED PLAINLY ───────────
 *
 * ⚠️ Scalar and grouped keys are static string-literal unions, so a typo, an unknown key and
 * every derived key are compile errors. **Per-character keys are not**: they are generated
 * by walking the roster (`registerCharacterFields`), which is the single source for them, and
 * a static union would have to be hand-written beside it — the second place again. They are
 * typed as the template `` `char.${string}` `` and validated at RUNTIME against the
 * registry. `tun_gate.mjs` proves both halves: the compile refusal with a real `tsc` run on a
 * known-bad fixture, and the runtime refusal on an unknown `char.` key.
 */

import {
  installRawOverrides, markDefaultsComplete, noteDefault, rawOverride, rawOverrideEntries,
} from './tuningStore.ts';

export type TuneGroup = 'combat' | 'character' | 'arena' | 'economy';

/** A clamp the SIM applies to this value, wherever it applies it. §76 constraint 4. */
export interface SimClamp {
  lo?: number;
  hi?: number;
  /** `file:symbol` — where the sim does the clamping. */
  where: string;
}

export interface TunableSpec {
  group: TuneGroup;
  /** `ms`, `wu`, `wu/ms`, `wu/s`, `hp`, `x` (a multiplier), `%`, `coins`, `deg`, `count`. */
  unit: string;
  /** Panel bounds. A TYPO GUARD unless a `simClamp` says otherwise — see `registerCharacterFields`. */
  min: number;
  max: number;
  /** Refuse a non-integer. Set wherever the sim indexes or counts with the value. */
  int?: boolean;
  /** One line, for the panel. The rationale lives in the constant's own block comment. */
  doc: string;
  /** What the sim itself does to out-of-band values, if anything. */
  simClamp?: SimClamp;
}

/** A spec plus the authored literal. `v` is short because it sits on every line. */
export type TunableDecl = TunableSpec & { v: number };

export interface AuthoredEntry extends TunableSpec {
  kind: 'authored';
  key: string;
  /** The literal in `rules.ts` / `economy/tuning.ts`. Learned, never restated. */
  authored: number;
  /** What the sim is actually running with — `authored` unless overridden. */
  value: number;
  overridden: boolean;
  /** Set when the value coincides with a ladder rung. A DISPLAY HINT, not a claim. */
  matchesRung?: string;
}

export interface DerivedSpec {
  group: TuneGroup;
  unit: string;
  doc: string;
  /**
   * Registry keys this value is computed from — **an ARRAY on the entry**, because
   * `src/admin/model.ts:buildGraph` iterates it with `for…of` and that contract predates this
   * file's second draft. The DECLARATION form is an object; see `DerivedDecl`.
   */
  inputs: readonly string[];
  /** Human-readable label for the panel. The lambda is the truth; this is prose. */
  formula: string;
}

export interface DerivedEntry extends DerivedSpec {
  kind: 'derived';
  key: string;
  value: number;
  recompute: (inputs: Readonly<Record<string, number>>) => number;
  /**
   * The input values as the DECLARING module saw them.
   *
   * 🚨 **THIS IS WHAT KEEPS A TEXTUALLY-STAGED TREE BOOTABLE, AND IT WAS FOUND BY A GATE
   * RATHER THAN BY THINKING.** `tools/tmp/stage_rules.mjs` rewrites a constant by regex —
   * `^(export const KEY\s*=\s*)([^;]+)(;)` — so a staged `FOG_CLOSE_MS` becomes a bare literal
   * and its `tune()` call **disappears**, taking the registration with it. Every derived value
   * reading it then died on `derived input "FOG_CLOSE_MS" is not registered`: measured, **5 of
   * 18 top-level constants** could not be staged at all, which would have broken
   * `roster_table`, `pacing_ladder`, `rules_sweep` and `status_grace_sweep` the first time
   * anyone swept the fog schedule or the clock.
   *
   * So an input is resolved from the registry when it is there and from this snapshot when it
   * is not. In a normal tree the two ALWAYS agree — including under an override, because the
   * declaration passes the identifier and the identifier already holds the tuned value — and
   * `derive()` throws if they ever disagree, which is what catches an input list that names
   * one key and passes another's value.
   */
  inputFallback: Readonly<Record<string, number>>;
}

/**
 * A derived value that is a FUNCTION of run-time arguments, not of constants alone —
 * `minSafeRadiusFor(N)`, `fogRadiusAt(t, …)`, `enemyLevelFor(level)`. Registered so the panel
 * can render them read-only and name what moves them; the panel calls the real export.
 */
export interface DerivedFnEntry {
  kind: 'derived-fn';
  key: string;
  group: TuneGroup;
  unit: string;
  doc: string;
  inputs: readonly string[];
  /** `file:symbol` — the one implementation. */
  where: string;
  /** The run-time arguments, for the panel's signature line. */
  args: readonly string[];
}

export type RegistryEntry = AuthoredEntry | DerivedEntry | DerivedFnEntry;

const entries = new Map<string, RegistryEntry>();

function claim(key: string): void {
  if (entries.has(key)) {
    throw new Error(`tuning: duplicate registry key "${key}" — a key names exactly one constant`);
  }
}

/**
 * Validate an override the moment its spec is known, and THROW rather than clamp.
 *
 * ⚠️ A silently clamped override is the §76 constraint 4 defect with the volume turned up:
 * the stamp would say "tuned to 0.9" and the sim would be running 0.5, so every number
 * measured under it is unreproducible in the most confusing possible way. The message names
 * the key and the way out, because the only path to an invalid value here is a hand-edited
 * store and the panel's own import path refuses it first.
 */
function checkOverride(key: string, spec: TunableSpec, v: number): void {
  const how = 'Clear it with FA_TUNING=off (Node) or ?tuning=off (browser), then fix the set.';
  if (!Number.isFinite(v)) throw new RangeError(`tuning: "${key}" override is not finite. ${how}`);
  if (spec.int && !Number.isInteger(v)) {
    throw new RangeError(`tuning: "${key}" must be an integer, got ${v}. ${how}`);
  }
  if (v < spec.min || v > spec.max) {
    throw new RangeError(`tuning: "${key}" = ${v} is outside [${spec.min}, ${spec.max}]. ${how}`);
  }
}

function register(key: string, decl: TunableDecl): number {
  claim(key);
  const { v, ...spec } = decl;
  noteDefault(key, v);
  const ov = rawOverride(key);
  if (ov !== undefined) checkOverride(key, spec, ov);
  const value = ov ?? v;
  entries.set(key, {
    kind: 'authored', key, ...spec, authored: v, value, overridden: ov !== undefined,
  });
  return value;
}

/**
 * Register ONE tunable in place and return its live value.
 *
 *     export const PLAYER_SPEED = tune('PLAYER_SPEED', 0.12, { group: 'combat', … });
 *
 * ── WHY THE PER-LINE FORM IS THE ONE `rules.ts` USES ───────────────────────
 *
 * The literal stays on the line it was on, under the sixty-line block comment that is the
 * only record of why it is that number. `rules.ts` is a document as much as a module —
 * *"the log is a primary source"* is the same instinct — and a refactor that lifted eighty
 * literals into object blocks would have separated every one of them from its argument.
 *
 * ⚠️ **THE PRICE, STATED RATHER THAN HIDDEN: an authored key is `string` to the type system.**
 * `tunables()` below returns an object whose `keyof` IS the key union, and if every authored
 * constant went through it, `OverrideSet` could refuse a typo at compile time. It does not,
 * for two reasons and the second is the binding one:
 *   * per-character keys (~250 of them) are generated by walking the roster, so no static
 *     union can cover them however the scalars are written;
 *   * a hand-written union beside the registry is **the second place** §76 constraint 1
 *     forbids, and it would agree on the day it was written.
 * The DERIVED half — the half §76 constraint 2 is actually about — IS statically refused;
 * see `deriveds()` and `keys.ts`. Unknown and out-of-range keys are refused at run time by
 * `validate.ts`, and `tun_gate.mjs` proves both refusals against known-bad input.
 */
export function tune(key: string, v: number, spec: TunableSpec): number {
  return register(key, { ...spec, v });
}

/**
 * Register a flat block of tunables and return their LIVE values.
 *
 *     const T = tunables({ PLAYER_SPEED: { v: 0.12, group: 'combat', … } });
 *     export const PLAYER_SPEED = T.PLAYER_SPEED;
 *
 * The returned object's keys are the registry keys, so `keyof typeof T` is the authored-key
 * union for that block — derived, never typed twice.
 */
export function tunables<S extends Record<string, TunableDecl>>(specs: S): { [K in keyof S]: number } {
  const out = {} as { [K in keyof S]: number };
  for (const k of Object.keys(specs) as Array<keyof S & string>) {
    out[k] = register(k, specs[k]) as { [K in keyof S]: number }[keyof S & string];
  }
  return out;
}

/**
 * The same, for a block that ships as an object — `REACH`, `POT`, `MATCH_PAYOUT`.
 *
 *     export const REACH = tunableGroup('REACH', REACH_DECL);
 *
 * Registry keys are `PREFIX.field`; the returned object keeps the bare field names, so every
 * existing `REACH.rangedMax` reader is untouched. `KeysOf<'REACH', typeof REACH_DECL>` gives
 * the dotted union for the type layer.
 */
export function tunableGroup<P extends string, S extends Record<string, TunableDecl>>(
  prefix: P, specs: S,
): { [K in keyof S]: number } {
  const out = {} as { [K in keyof S]: number };
  for (const k of Object.keys(specs) as Array<keyof S & string>) {
    out[k] = register(`${prefix}.${k}`, specs[k]) as { [K in keyof S]: number }[keyof S & string];
  }
  return out;
}

/** The dotted registry-key union produced by `tunableGroup(P, S)`. */
export type KeysOf<P extends string, S> = `${P}.${keyof S & string}`;

/** Current live values for a list of registry keys. Throws on an unknown or non-scalar key. */
export function valuesOf(keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) {
    const e = entries.get(k);
    if (!e) throw new Error(`tuning: derived input "${k}" is not registered`);
    if (e.kind === 'derived-fn') throw new Error(`tuning: derived input "${k}" is a function, not a value`);
    out[k] = e.value;
  }
  return out;
}

/**
 * Resolve a derived value's inputs: the REGISTRY where it knows the key, the declaration's own
 * snapshot where it does not.
 *
 * ⚠️ **AND IT REFUSES A DISAGREEMENT RATHER THAN PREFERRING ONE.** The declaration form is ES
 * shorthand — `inputs: { FOG_CLOSE_MS, SUDDEN_DEATH_GRACE_MS }` — so the key and the value come
 * from the *same identifier* and cannot drift. If they ever differ, the input list is naming
 * one constant and passing another's value, which is a silently wrong formula: exactly the
 * plausible-wrong-answer class, and the only failure mode this form introduces.
 */
function resolveInputs(key: string, declared: DeclaredInputs): Record<string, number> {
  // ── THE ARRAY FORM: names only, so there is nothing to fall back to ──────
  //
  // ⚠️ **KEPT BECAUSE `src/admin/selftest.ts` USES IT AND THAT FILE SET IS OWNED ELSEWHERE.**
  // It builds a synthetic registry for the panel's headless gate and declares its fixtures as
  // `inputs: ['selftest.paceMs', 'selftest.graceMs']`. Narrowing the API to the object form
  // broke it with four `TS2322`s — which is precisely the "silently strands 2,194 lines of
  // measured work" failure this pass was told to avoid. Both forms are supported, on purpose,
  // and the difference is exactly what they can survive: an array input MUST be registered.
  if (Array.isArray(declared)) return valuesOf(declared);

  const out: Record<string, number> = {};
  for (const [k, declaredValue] of Object.entries(declared)) {
    const e = entries.get(k);
    if (e && e.kind === 'derived-fn') {
      throw new Error(`tuning: derived input "${k}" is a function, not a value`);
    }
    if (!e) { out[k] = declaredValue; continue; }
    if (!Object.is(e.value, declaredValue)) {
      throw new Error(
        `tuning: derived "${key}" names input "${k}" but was passed ${declaredValue} while the ` +
        `registry holds ${e.value}. The declaration must pass the identifier it names.`,
      );
    }
    out[k] = e.value;
  }
  return out;
}

/**
 * A derived value's inputs, as DECLARED. Two forms, and they differ in one property only:
 *
 *   * `['A', 'B']` — names. Every one must already be registered or `derive()` throws.
 *   * `{ A, B }`   — ES shorthand, so the name and its current value are ONE token. Survives a
 *     textually-staged tree in which the input's `tune()` call was rewritten away, which is
 *     what `tools/tmp/stage_rules.mjs` does to five of the eighteen top-level constants.
 *
 * **Prefer the object form in `src/game/`.** The array form exists because `src/admin/` uses it.
 */
export type DeclaredInputs = readonly string[] | Readonly<Record<string, number>>;

/** The names, whichever form was used. */
function inputNames(declared: DeclaredInputs): string[] {
  return Array.isArray(declared) ? [...declared] : Object.keys(declared);
}

/**
 * Register a DERIVED scalar and return it. The value is produced BY the recompute, so the
 * formula exists once and the panel gets a live preview for free.
 *
 * ⚠️ Inputs are read NOW, so declaration order must match the real dependency order — which is
 * the order `rules.ts` already has to be in for its `const` initialisers to run.
 */
export function derive(
  key: string,
  spec: DerivedDeclSpec,
  recompute: (inputs: Readonly<Record<string, number>>) => number,
): number {
  claim(key);
  const resolved = resolveInputs(key, spec.inputs);
  const value = recompute(resolved);
  if (!Number.isFinite(value)) throw new RangeError(`tuning: derived "${key}" is not finite (${value})`);
  const { inputs, ...rest } = spec;
  entries.set(key, {
    kind: 'derived', key, ...rest, inputs: inputNames(inputs), value, recompute,
    inputFallback: resolved,
  });
  return value;
}

/**
 * A derived scalar's DECLARATION.
 *
 * `inputs` is an OBJECT here and an array on the entry, and the asymmetry is deliberate:
 *   * the declaring module writes `inputs: { FOG_CLOSE_MS, SUDDEN_DEATH_GRACE_MS }`, so the key
 *     and its current value are one token and the value is never restated;
 *   * the panel reads `entry.inputs` as a list of names, which is the shape
 *     `src/admin/model.ts:buildGraph` already walks.
 */
export interface DerivedDeclSpec extends Omit<DerivedSpec, 'inputs'> {
  inputs: DeclaredInputs;
}

/** A derived scalar's whole declaration. `f` is the recompute; it is the formula's only copy. */
export type DerivedDecl = DerivedDeclSpec & { f: (inputs: Readonly<Record<string, number>>) => number };

/**
 * Register a BLOCK of derived scalars and return their values.
 *
 * 🚨 **THIS IS THE FORM `rules.ts` USES FOR DERIVED VALUES, AND THE REASON IS THE TYPE
 * SYSTEM.** `keyof typeof BLOCK` is the derived-key union, and `keys.ts` intersects
 * `OverrideSet` with `{ [K in DerivedKey]?: never }` — so `{ SUDDEN_DEATH_MS: 140000 }` is a
 * COMPILE ERROR, not a runtime rejection. §76 constraint 2 asks for exactly that: *"a text
 * box on `SUDDEN_DEATH_MS` would un-fix the exact bug he found by playing."*
 */
export function deriveds<S extends Record<string, DerivedDecl>>(specs: S): { [K in keyof S]: number } {
  const out = {} as { [K in keyof S]: number };
  for (const k of Object.keys(specs) as Array<keyof S & string>) {
    const { f, ...spec } = specs[k];
    out[k] = derive(k, spec, f) as { [K in keyof S]: number }[keyof S & string];
  }
  return out;
}

/** Register a derived FUNCTION for the panel to render read-only. Records nothing executable. */
export function deriveFn(key: string, spec: Omit<DerivedFnEntry, 'kind' | 'key'>): void {
  claim(key);
  entries.set(key, { kind: 'derived-fn', key, ...spec });
}

/** The block form, so `keyof typeof SPEC` joins the statically-refused `DerivedKey` union. */
export function deriveFns(specs: Readonly<Record<string, Omit<DerivedFnEntry, 'kind' | 'key'>>>): void {
  for (const k of Object.keys(specs)) deriveFn(k, specs[k]);
}

/**
 * Recompute a derived scalar under hypothetical inputs — what the panel calls while a slider
 * is moving, so a field's consequence updates before anything is persisted.
 *
 * `candidates` may name any registry key; unlisted inputs keep their live value.
 *
 * ── 🚨 THIS WAS WRONG AT DEPTH 2, AND THE OLD BODY IS KEPT BELOW ───────────
 *
 * **WAS**, and it shipped in the first draft of this file:
 *
 *     const base = valuesOf(e.inputs);                      // LIVE values, one level only
 *     for (const k of e.inputs) if (k in candidates) base[k] = candidates[k];
 *     return e.recompute(base);
 *
 * That substitutes **DIRECT inputs only.** If `B` derives from `A` and `A` derives from `K`,
 * then `previewDerived('B', { K: v })` finds no `K` in `B`'s input list, reads `A`'s **live**
 * value, and returns a number that is silently one level stale — *a plausible wrong answer*,
 * which `CLAUDE.md` names as this project's most expensive failure mode. **An API whose one
 * stated purpose is "the panel's live preview" getting the preview wrong is the worst shape
 * of defect there is**, so it is fixed here rather than worked around by each caller.
 *
 * ⚠️ **IT IS NOT HYPOTHETICAL: THE SHIPPED REGISTRY HAS SUCH A CHAIN.**
 * `SUDDEN_DEATH_REMAINING_MS` ← `SUDDEN_DEATH_MS` ← `FOG_CLOSE_MS` (`rules.ts`). Measured on
 * it, and this is the gate row in `tools/tmp/tun_gate.mjs`:
 *
 *     candidate FOG_CLOSE_MS = 100_000        transitive (this body)   direct-only (the WAS)
 *     SUDDEN_DEATH_MS         (depth 1)               115000                115000   agree
 *     SUDDEN_DEATH_REMAINING_MS (depth 2)              35000                 15000   STALE
 *
 * The depth-1 row is the control: a walk that changed a depth-1 answer would be broken, not
 * clever. `tun_gate.mjs` keeps the old body verbatim as the KNOWN-BAD mutant and requires it
 * to produce the stale number — a fix whose bug cannot be reproduced is not a proven fix.
 *
 * ── HOW ────────────────────────────────────────────────────────────────────
 *
 * Inputs are resolved RECURSIVELY: a derived input is itself previewed under the same
 * candidates, an authored input takes its candidate or its live value, and a derived-FN input
 * is refused exactly as `valuesOf` refuses it (they are sinks — they declare inputs so the
 * panel can say what moves them and they can never be an input themselves).
 *
 * ⚠️ A candidate naming a DERIVED key is IGNORED, deliberately. `keys.ts` makes
 * `{ SUDDEN_DEATH_MS: 5 }` a compile error and `validate.ts` refuses it again at run time;
 * honouring it here would be the runtime loophole that undoes both.
 *
 * `stack` is a cycle guard, not decoration: `derive()` requires its inputs to be registered
 * already, so a cycle cannot be built through the public API today — but it is one refactor
 * away from being possible and an unguarded walk would hang rather than throw.
 */
export function previewDerived(
  key: string,
  candidates: Readonly<Record<string, number>> = {},
  memo: Map<string, number> = new Map(),
  stack: Set<string> = new Set(),
): number {
  const e = entries.get(key);
  if (!e || e.kind !== 'derived') throw new Error(`tuning: "${key}" is not a derived scalar`);
  return previewAny(key, candidates, memo, stack);
}

/** The recursive half. Not exported: `previewDerived` is the contract, this is the walk. */
function previewAny(
  key: string,
  candidates: Readonly<Record<string, number>>,
  memo: Map<string, number>,
  stack: Set<string>,
): number {
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const e = entries.get(key);
  if (!e) throw new Error(`tuning: derived input "${key}" is not registered`);
  if (e.kind === 'derived-fn') {
    throw new Error(`tuning: derived input "${key}" is a function, not a value`);
  }
  let v: number;
  if (e.kind === 'authored') {
    v = key in candidates ? candidates[key] : e.value;
  } else {
    if (stack.has(key)) throw new Error(`tuning: derived cycle through "${key}"`);
    stack.add(key);
    const inputs: Record<string, number> = {};
    // ⚠️ `inputFallback` covers the staged-tree case where an input's `tune()` call was
    // rewritten away — see `DerivedEntry.inputFallback`. In a normal tree every input is
    // registered and this branch is never taken; a candidate on an unregistered key is still
    // honoured, because "what if this moved" is the question the preview exists to answer.
    for (const i of e.inputs) {
      inputs[i] = entries.has(i)
        ? previewAny(i, candidates, memo, stack)
        : (i in candidates ? candidates[i] : e.inputFallback[i]);
    }
    v = e.recompute(inputs);
    stack.delete(key);
  }
  memo.set(key, v);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ROSTER — registered by WALKING it, because a hand-written list is the second place
// ─────────────────────────────────────────────────────────────────────────────

/** Structural view of a character, so this file never imports `rules.ts`. */
interface RosterChar {
  stats: Record<string, number>;
  weapons: Array<Record<string, unknown>>;
}

/** Fields whose domain is real rather than derived from the authored value. */
const CHAR_FIELD_DOMAIN: Readonly<Record<string, { min: number; max: number; int?: boolean }>> = {
  cone: { min: 0, max: 360 },
  spreadDeg: { min: 0, max: 360 },
  angle: { min: -360, max: 360 },
  pellets: { min: 1, max: 24, int: true },
  peckHits: { min: 1, max: 24, int: true },
};

/**
 * Register every numeric field of every weapon and stat block, and APPLY any override in
 * place. Keys are `char.<id>.<weaponKey>.<field>` and `char.<id>.stats.<field>`.
 *
 * ── KEYED ON `weapon.key`, NEVER ON THE ARRAY INDEX ────────────────────────
 *
 * `rules.ts` records what a positional join costs: Hamburger's `weapons` and `abilities`
 * arrays are in different orders, so *"3 of these 4 rows would join to the WRONG weapon by
 * index"*, and `wj_guard.mjs` exists because of it. An override set that survives a weapon
 * being reordered is worth more than one that reads two characters shorter.
 *
 * ── THE BANDS ARE A TYPO GUARD AND THEY SAY SO ─────────────────────────────
 *
 * ⚠️ Five fields have a real domain (above). Every other character band is **derived as
 * `0 … 4x the authored value`** and is not a design statement: authoring ~250 bands by hand
 * would be ~250 chances to state a bound nothing measured, and this repo's record on
 * hand-authored per-item tables is *"20 of 34 weapon descriptions describe mechanics that do
 * not exist"*. A band that is honestly a typo guard is better than one that looks
 * authoritative and is not — §76 constraint 4 is precisely about surfaces that look
 * authoritative.
 *
 * ⚠️ `range` and `speed` on most weapons are AUTHORED AS A LADDER RUNG (`REACH.rangedMid`,
 * `SPEED.mid`). Overriding one PINS that weapon off the ladder, so the rung it matches today
 * is recorded on the entry as `matchesRung` for the panel to warn with. It is a coincidence
 * test on the current value, not a record of how the literal was written — a value that
 * happens to equal a rung will be labelled too, which is why it is a hint and not a claim.
 */
export function registerCharacterFields(
  roster: Readonly<Record<string, RosterChar>>,
  rungs: Readonly<Record<string, number>> = {},
): void {
  const rungName = (v: number): string | undefined => {
    for (const [k, rv] of Object.entries(rungs)) if (rv === v) return k;
    return undefined;
  };
  const bandFor = (field: string, v: number): { min: number; max: number; int?: boolean } => {
    const d = CHAR_FIELD_DOMAIN[field];
    if (d) return d;
    const hi = v >= 0 ? Math.max(v * 4, v + 10) : Math.max(Math.abs(v) * 4, 10);
    const lo = v >= 0 ? 0 : -hi;
    return { min: lo, max: hi, int: Number.isInteger(v) };
  };
  const put = (owner: Record<string, unknown>, field: string, key: string, group: TuneGroup, doc: string): void => {
    const v = owner[field];
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const band = bandFor(field, v);
    const value = register(key, { v, group, unit: unitFor(field), doc, ...band });
    if (value !== v) owner[field] = value;
    const rung = rungName(v);
    if (rung) (entries.get(key) as AuthoredEntry).matchesRung = rung;
  };

  for (const [id, def] of Object.entries(roster)) {
    for (const field of Object.keys(def.stats)) {
      put(def.stats as Record<string, unknown>, field, `char.${id}.stats.${field}`, 'character',
        `${id} display stat "${field}" — drives healthMultiplier/speedMultiplier, see rules.ts`);
    }
    const seen = new Set<string>();
    for (const w of def.weapons) {
      const wk = String(w.key ?? '');
      if (!wk) throw new Error(`tuning: ${id} has a weapon with no key — the registry keys on it`);
      if (seen.has(wk)) throw new Error(`tuning: ${id} has two weapons keyed "${wk}"`);
      seen.add(wk);
      for (const field of Object.keys(w)) {
        put(w, field, `char.${id}.${wk}.${field}`, 'character', `${id} · ${String(w.name ?? wk)} · ${field}`);
      }
      const parts = w.comboParts;
      if (Array.isArray(parts)) {
        parts.forEach((part: Record<string, unknown>, i: number) => {
          for (const field of Object.keys(part)) {
            put(part, field, `char.${id}.${wk}.comboParts.${i}.${field}`, 'character',
              `${id} · ${String(w.name ?? wk)} · combo part ${i} · ${field}`);
          }
        });
      }
    }
  }
}

function unitFor(field: string): string {
  if (/ms$|Interval$|cooldown/i.test(field)) return 'ms';
  if (/^range$/.test(field)) return 'wu';
  if (/^speed$/.test(field)) return 'wu/s';
  if (/^(radius|spreadDeg|cone|angle)$/.test(field)) return field === 'radius' ? 'wu' : 'deg';
  if (/damage|heal/i.test(field)) return 'hp';
  if (/Boost$|Factor$|Multiplier$/.test(field)) return 'x';
  if (/^(pellets|peckHits|maxHitsPerTick)$/.test(field)) return 'count';
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// READING THE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🚨 **ASSERT NON-EMPTY BEFORE ANY `every()`.** `CLAUDE.md` #6: that exact vacuity fired
 * three times in three files in one session, always because a fix emptied the filtered set
 * an assertion ran over, and `[].every()` returns `true`. Every reader below goes through
 * here, so a registry that failed to populate is a THROW and never a green run.
 */
export function assertRegistryPopulated(): void {
  if (entries.size === 0) {
    throw new Error(
      'tuning: the registry is EMPTY. Nothing registered means rules.ts was never evaluated — ' +
      'import `src/game/tuning/index.ts`, which imports it for you.',
    );
  }
}

/**
 * Every installed override key that matched NO registry key.
 *
 * ⚠️ **THIS CANNOT BE CHECKED AT BOOT, AND THAT IS WHY IT IS A SEPARATE FUNCTION.** Overrides
 * are installed *before* `rules.ts` evaluates — that is the whole design (`store.ts`: an ESM
 * `const` cannot be reassigned) — so at install time the registry is empty and EVERY key looks
 * unknown. The earliest moment the question is answerable is the seal.
 */
export function unknownOverrideKeys(): string[] {
  return rawOverrideEntries().map(([k]) => k).filter((k) => !entries.has(k));
}

/**
 * Called by `index.ts` once every registering module has evaluated. Unlocks the set hash.
 *
 * 🚨 **AND IT THROWS ON AN OVERRIDE KEY NOTHING CLAIMED.** `store.ts` states the principle
 * two screens up and this is where it is enforced: *"a silently-dropped override produces a
 * measurement whose stamp says 'tuned' and whose numbers are stock — unreproducible in the
 * most confusing possible way."* A typo in a hand-written set is exactly that. It hashes to a
 * non-stock `tun1-…`, so the measurement is refused against every stock baseline it should
 * have matched, while the sim runs the authored numbers — a plausible wrong answer with a
 * receipt attached.
 *
 * ⚠️ **The check is HERE and not in `validate.ts` because the env and host-injection paths do
 * not go through `validate.ts` at all** — only the panel's persist path does. `FA_TUNING=…`
 * is the one that runs the gate battery, so it is the one that most needs the refusal.
 */
export function sealRegistry(): void {
  assertRegistryPopulated();
  const unknown = unknownOverrideKeys();
  if (unknown.length > 0) {
    throw new Error(
      `tuning: ${unknown.length} override key(s) match no registered constant: ${unknown.slice(0, 8).join(', ')}` +
      `${unknown.length > 8 ? ' …' : ''}. They would be SILENTLY IGNORED while still changing the set hash. ` +
      'Fix the key, or clear the set with FA_TUNING=off (Node) / ?tuning=off (browser).',
    );
  }
  markDefaultsComplete();
}

export function allEntries(): RegistryEntry[] {
  assertRegistryPopulated();
  return [...entries.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

export function entryFor(key: string): RegistryEntry | undefined {
  return entries.get(key);
}

export function hasKey(key: string): boolean {
  return entries.has(key);
}

export function authoredEntries(): AuthoredEntry[] {
  return allEntries().filter((e): e is AuthoredEntry => e.kind === 'authored');
}

export function derivedEntries(): Array<DerivedEntry | DerivedFnEntry> {
  return allEntries().filter((e): e is DerivedEntry | DerivedFnEntry => e.kind !== 'authored');
}

/** Every registry key that is DERIVED — the set an override may never name. */
export function derivedKeys(): string[] {
  return derivedEntries().map((e) => e.key);
}

export function entriesInGroup(group: TuneGroup): RegistryEntry[] {
  return allEntries().filter((e) => e.group === group);
}

/** Keys whose live value differs from the authored literal, with both numbers. */
export function diffFromDefaults(): Array<{ key: string; authored: number; value: number }> {
  return authoredEntries()
    .filter((e) => !Object.is(e.authored, e.value))
    .map((e) => ({ key: e.key, authored: e.authored, value: e.value }));
}

/** Re-export so a consumer needs one import. */
export { installRawOverrides };
