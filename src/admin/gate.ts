/**
 * THE GATE — whether the admin panel exists at all in this build.
 *
 * `DECISIONS-FOR-URI.md` §76 constraint 5, verbatim:
 *
 *   > *"It must be UNREACHABLE in the shipped player build. A live tuning panel is a cheat
 *   > surface and a support nightmare. `main.ts:MATCH_ONLY_PARAMS` and
 *   > `verify-head`/`ab_basepath` are the existing precedents for 'reachable only under a
 *   > condition, and proved so'."*
 *
 * ── WHAT IS CLAIMED, PRECISELY: UNREACHABLE, NOT ABSENT ─────────────────────────
 *
 * 🚨 **The panel's code IS in the default bundle. Only the ROUTE is gated.** Saying
 * "it is not shipped" would be the kind of plausible-and-wrong claim this repo keeps
 * paying for, so it is stated the other way round and measured:
 * `tools/tmp/adm_unreachable.mjs` drives a **real production build** and proves that
 * every path to the screen refuses — the URL (`?screen=admin`), a `popstate` carrying
 * `{name:'admin'}` in `history.state`, and the QA handle `window.__shell.navigate` that
 * `shell.ts` exposes in production to everybody including a player with devtools open.
 *
 * Absence would need tree-shaking behind a dynamic import, which needs a `define` in
 * `vite.config.ts` — **not in this agent's owned file set**. It is written up in the
 * report as the one thing that would upgrade "unreachable" to "not present".
 *
 * ── THE THREE GATED SEAMS, AND WHY IT IS ALL THREE ──────────────────────────────
 *
 * `shell.ts` alone would not be enough and neither would `main.ts` alone:
 *
 *   1. `main.ts:bootRoute`      — `?screen=admin` on a cold load.
 *   2. `shell.ts:ROUTE_NAMES`   — what `parseRoute`/`routeFromSearch` will accept from
 *                                 `history.state` or a hand-edited address bar.
 *   3. `shell.ts:build()`       — the last line of defence, and the only one that also
 *                                 covers `window.__shell.navigate({ name: 'admin' })`.
 *
 * Seam 3 is the one that matters: `shell.ts` publishes `window.__shell` unconditionally
 * (*"QA-only navigation handle, same spirit as `?simSpeed=` in `match.ts`"*), so a gate
 * that only filtered URLs would be a gate a console one-liner walks straight through.
 * `build()` throws instead, and `mountFailed` already routes a failed build back to home —
 * so the refusal is a working game, not a black screen.
 *
 * ── HOW URI TURNS IT ON ─────────────────────────────────────────────────────────
 *
 *     npm run dev                          panel present   (DEV)
 *     VITE_FA_ADMIN=1 npx vite build       panel present   (explicit opt-in)
 *     npm run build                        panel UNREACHABLE  <- what Pages deploys
 *
 * ⚠️ **AND THE OPT-IN BUILD IS THE ONE HE ACTUALLY WANTS, because a tuned set lives in
 * `localStorage` and `localStorage` IS ORIGIN-SCOPED.** A set tuned at
 * `http://localhost:5173` is invisible at `http://localhost:4321` (`playtest.mjs`) and at
 * `https://uri-onceuponyou.github.io`. So "tune in dev, play on the deploy" does not work
 * and never will; that is a browser rule, not a bug here. The two paths that DO work are
 * (a) a `VITE_FA_ADMIN=1` build served on the same origin you play on, and (b) the panel's
 * **Export** button, which writes the set as JSON — the same JSON `FA_TUNING=` feeds to
 * the Node gates. §76 asked for export/import for exactly this reason.
 */

/**
 * True when this build carries a reachable admin panel.
 *
 * ⚠️ Written as a single expression over two verbatim `import.meta.env` reads so that
 * Vite's build-time substitution turns it into a literal `false` — see `env.d.ts` for why
 * a cast would break that. Do not refactor either operand behind a helper.
 */
export const ADMIN_ENABLED: boolean =
  import.meta.env.DEV === true || import.meta.env.VITE_FA_ADMIN === '1';

/**
 * Why the panel is off, in words, for the one place it is worth saying out loud.
 *
 * Not shown to a player — `build()` throws and the shell falls back to home silently.
 * This is for `adm_unreachable.mjs`'s failure message and for a developer who typed
 * `?screen=admin` into a production build and wants to know what to do about it.
 */
export const ADMIN_OFF_REASON =
  'admin panel is not enabled in this build — rebuild with VITE_FA_ADMIN=1, or run the dev server';
