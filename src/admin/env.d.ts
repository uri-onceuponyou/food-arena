/**
 * Vite's `import.meta.env`, typed.
 *
 * ⚠️ **THIS PROJECT DOES NOT PULL IN `vite/client`.** `tsconfig.json` names no `types`
 * array, and `vite/client` is not auto-included, so `import.meta.env.DEV` is a
 * **TS2339 compile error** in this repo — measured, not assumed:
 *
 *     src/__probe_env.ts(1,32): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
 *
 * The one apparent counter-example is `src/audio/music.ts:78`, which names
 * `import.meta.env.BASE_URL` **inside a doc comment** and never evaluates it. So the
 * shipped tree has zero real uses and nothing established the typing.
 *
 * ── WHY A `.d.ts` HERE AND NOT `"types": ["vite/client"]` IN `tsconfig.json` ──
 *
 * `tsconfig.json` is outside this agent's owned file set (`CLAUDE.md` #9 — one owner per
 * file set), and adding a global `types` entry changes what every other file in the repo
 * sees. This declares exactly the four members the admin gate reads, in the shape
 * `vite/client` declares them, so replacing this file with the real package later is a
 * no-op rather than a conflict.
 *
 * 🚨 **`import.meta.env.DEV` MUST APPEAR VERBATIM IN THE SOURCE — DO NOT "TIDY" IT INTO A
 * CAST.** Vite substitutes the literal member expression at build time. Writing
 * `(import.meta as X).env?.DEV` produces an OPTIONAL CHAIN that the substitution does not
 * match, so the constant never folds, the branch never dies, and the admin gate in
 * `gate.ts` silently becomes a runtime read of `undefined` in the shipped bundle.
 */
interface ImportMetaEnv {
  /** True under `vite dev`. False in every `vite build` output. */
  readonly DEV: boolean;
  /** The inverse of `DEV`. Declared because the pair is how Vite documents the flag. */
  readonly PROD: boolean;
  /** `'development'` / `'production'`, or whatever `--mode` said. */
  readonly MODE: string;
  /** `vite.config.ts`'s `base` — `'/'` locally, `'/food-arena/'` on Pages. */
  readonly BASE_URL: string;
  /**
   * The admin panel's build-time opt-in. `VITE_`-prefixed, which is the ONLY prefix Vite
   * inlines into client code without a `define` in `vite.config.ts` (not owned here).
   * Absent in every default build, which is what makes the panel unreachable by default.
   */
  readonly VITE_FA_ADMIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
