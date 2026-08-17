/**
 * THE ONE IMPORT — evaluate every registering module, seal, and re-export.
 *
 * `DECISIONS-FOR-URI.md` §76. `tuningRegistry.ts` has told readers to import this file since the day
 * it was written (*"import `src/game/tuning/index.ts`, which imports it for you"*) and **it did
 * not exist**; `src/admin/model.ts` carries a comment saying so and does the two side-effect
 * imports by hand. It exists now, and `model.ts` can collapse to one line whenever that file
 * set is next opened — nothing there has to move for it.
 *
 * ── 🚨 THE SIDE-EFFECT IMPORTS ARE THE POINT OF THIS FILE ──────────────────
 *
 * The registry is **populated by evaluation, not by a list**: `rules.ts` registers each of its
 * literals as that literal initialises. So the registry is exactly as complete as the set of
 * modules that have been evaluated, and a consumer that imports `tuningRegistry.ts` alone gets an
 * EMPTY one — which is not an error state that announces itself, it is a panel with no rows
 * and a hash of `'stock'`. `CLAUDE.md` #6 calls that the vacuity class and it is why
 * `assertRegistryPopulated()` throws rather than returning an empty array.
 *
 * ⚠️ **DO NOT ADD A MODULE HERE WITHOUT ADDING ITS KEYS TO A GATE.** The failure mode of a
 * missing import is not a crash: it is a smaller registry, and a smaller registry passes every
 * quantified check it is subjected to. `tools/tmp/tun_gate.mjs` asserts a FLOOR on the count
 * and on the presence of the named §76 constants, so a module silently dropping out of this
 * list is a red gate rather than a quieter panel.
 *
 * ── ⚠️ IMPORTING THIS FILE SEALS THE STORE ────────────────────────────────
 *
 * Evaluating `rules.ts` reads a constant, and the first read seals the override store for the
 * lifetime of the process (`tuningStore.ts` explains why at length). So **anything that wants to
 * install a set must do so before this module is imported** — in Node that means `FA_TUNING`,
 * which is read at `tuningStore.ts` evaluation and is therefore always early enough. There is no
 * post-hoc install path; `validate.ts` documents why one cannot exist.
 */

// The side effects. Ordering between the two does not matter — they register disjoint keys and
// `tuningRegistry.ts:claim()` throws on a collision, so an overlap could never pass silently.
import '../rules.ts';
import '../economy/tuning.ts';

import { sealRegistry } from '../tuningRegistry.ts';

sealRegistry();

export {
  allEntries, assertRegistryPopulated, authoredEntries, derivedEntries, derivedKeys,
  diffFromDefaults, entriesInGroup, entryFor, hasKey, previewDerived, sealRegistry,
  unknownOverrideKeys, valuesOf,
  type AuthoredEntry, type DerivedEntry, type DerivedFnEntry, type RegistryEntry,
  type SimClamp, type TunableSpec, type TuneGroup,
} from '../tuningRegistry.ts';

export {
  HASH_PREFIX, STOCK_HASH, STORAGE_KEY, TuningMismatchError, assertSameTuning,
  canonicalNumber, effectiveOverrideEntries, fnv1a64, hashOfPairs, isSealed, isStock,
  rawOverrideEntries, tuningSetHash, tuningSource, tuningStamp,
  type TuningSource,
} from '../tuningStore.ts';

export {
  bandProblem, exportSet, exportSetText, overridesLocked, parseSet, persistOverrides,
  validateForHandoff,
  type ParseResult, type Rejection,
} from './validate.ts';

export type { CharacterKey, DerivedKey, OverrideSet, TuningEnvelope } from './keys.ts';
