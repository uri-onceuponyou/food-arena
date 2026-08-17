/**
 * A RE-EXPORT VIEW. The implementation is `src/game/tuningStore.ts`.
 *
 * See `./registry.ts` for the whole reason both shims exist: everything `rules.ts` transitively
 * imports must be a FLAT `.ts` file in `src/game/`, because seven tracked staging tools copy
 * that directory non-recursively and the entire balance-measurement layer sits on them.
 *
 * `src/admin/**` imports this path and is owned elsewhere, so the path is kept. `export *`
 * re-exports bindings rather than values, so the store's module-level `overrides` / `defaults`
 * / `sealed` state is a single instance however it is reached — which matters more here than
 * anywhere, because a SECOND store instance would seal independently and hand `rules.ts` one
 * set while telling the panel about another.
 */
export * from '../tuningStore.ts';
