/**
 * A RE-EXPORT VIEW. The implementation is `src/game/tuningRegistry.ts`.
 *
 * ── 🚨 WHY THIS SHIM EXISTS, AND IT IS NOT TIDINESS ────────────────────────
 *
 * **Everything `rules.ts` transitively imports must be a FLAT `.ts` file in `src/game/`.**
 * That invariant was true by accident until 2026-08-17 and is undocumented nowhere else, so
 * here it is: **seven tracked staging tools copy `src/game/*.ts` with a single non-recursive
 * `readdirSync` and no subdirectories** — `stage_rules`, `stage_sim`, `stage_ai`, `stage_kit`,
 * `stage_vitals`, `stage_weapon`, `rb_stage`. Every balance instrument in the project sits on
 * that layer: `roster_table`, `pacing_ladder`, `rules_sweep`, `roster_sweep`, `vitals_probe`,
 * `kit_lab`, `rb_card`/`rb_run`, and the mandatory pre-commit gate `driver_guard`.
 *
 * The first draft of the override layer put the implementation in this directory and had
 * `rules.ts` import `./tuning/registry.ts`. **Measured, not guessed:** `driver_guard` died with
 * `ERR_MODULE_NOT_FOUND` on `/private/tmp/driver_guard/cd5/game/tuning/registry.ts` — the
 * staged tree is flat, so the subdirectory simply is not there. All seven stagers break the
 * same way, and they break by failing to RESOLVE, which at least is loud.
 *
 * So the implementation moved to `../tuningRegistry.ts` and this file became a view.
 *
 * ── WHY THE PATH IS KEPT AT ALL ────────────────────────────────────────────
 *
 * `src/admin/**` imports `../game/tuning/registry.ts` and `../game/tuning/store.ts` — 2,194
 * lines of measured panel, owned by a different pass. Breaking that import to save two shim
 * files would strand it. `export *` re-exports bindings, not values, so there is exactly ONE
 * module instance and ONE `entries` map however it is reached; the registry's singleton
 * property is not weakened by the extra path.
 *
 * ⚠️ **THE OTHER FIX IS BETTER AND IT IS NOT MINE TO MAKE.** Teaching the seven stagers to
 * copy recursively is three lines each and removes the invariant instead of routing around it.
 * They are outside this pass's owned file set (`CLAUDE.md` #9), so it is reported rather than
 * done. If that lands, delete these two shims, point `src/admin/**` at `../game/tuningRegistry.ts`,
 * and move the implementation back here.
 */
export * from '../tuningRegistry.ts';
