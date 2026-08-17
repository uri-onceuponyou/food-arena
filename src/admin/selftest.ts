/**
 * A SYNTHETIC REGISTRY, so the panel can be validated against a KNOWN input.
 *
 * `CLAUDE.md` #6: *"VALIDATE EVERY INSTRUMENT AGAINST A KNOWN-BAD INPUT BEFORE BELIEVING
 * IT… a guard that has not been shown to FAIL on the bug it guards against is not a
 * guard."* This panel is an instrument — it reports numbers Uri will tune a game by — and
 * the only way to know it reports them correctly is to point it at a registry whose every
 * value is known in advance.
 *
 * ── AND IT IS ALSO THE ONLY WAY TO SEE THE PANEL AT ALL, TODAY ──────────────────
 *
 * 🚨 **As of this commit `rules.ts` registers NOTHING.** `src/game/tuning/registry.ts` and
 * `store.ts` exist (a peer's, untracked at the time of writing) but no constant has been
 * routed through `tune()` yet, so the live registry is EMPTY and the panel's honest
 * rendering of that is a diagnostic, not a table. This fixture is what makes the screen
 * photographable, keyboard-testable and consequence-checkable before that wiring lands.
 *
 * ── WHY IT IS SAFE TO REGISTER INTO THE REAL REGISTRY ───────────────────────────
 *
 *   * it runs ONLY when the URL says so — `?admin=selftest`, and only inside a build
 *     where `gate.ts` already made the panel reachable at all;
 *   * every key is prefixed `selftest.`, and `registry.ts:claim()` throws on a duplicate,
 *     so a collision with a real constant is a loud error rather than a shadowed value;
 *   * nothing here is ever persisted: `canonicalise()` keeps only keys the registry knows,
 *     and these keys stop existing the moment the page reloads without the parameter.
 *
 * ── WHAT THE FIXTURE IS SHAPED TO CATCH ─────────────────────────────────────────
 *
 * Not "some numbers". Each entry exists to make a specific way of being wrong VISIBLE:
 *
 *   `selftest.paceMs`      an authored scalar with two derived consumers, one of them
 *                          two levels deep — the transitive case `previewDerived()`
 *                          answers STALE and `model.ts:resolveValue()` answers live.
 *   `selftest.graceMs`     a second input to the same derived value, so a consequence
 *                          row has to be a function of more than the field beside it.
 *   `selftest.lockedInt`   `int: true` with a narrow band — the validation known-bad.
 *   `selftest.orphan`      an authored scalar NOTHING derives from, so a panel that
 *                          invented a consequence for every field would be caught.
 *   `selftest.total`       derived, depth 1.
 *   `selftest.cycles`      derived FROM a derived — depth 2, the whole point.
 *   `selftest.radiusFor`   a derived FUNCTION: read-only, no scalar, names its args.
 */

import { deriveds, deriveFns, tunables } from '../game/tuning/registry.ts';

/** Read once. A module-scope `location` read would run on import — see AGENT-BRIEF §3. */
export function selftestRequested(): boolean {
  try {
    const loc = (globalThis as { location?: { search?: string } }).location;
    if (!loc?.search) return false;
    return new URLSearchParams(loc.search).get('admin') === 'selftest';
  } catch {
    return false;
  }
}

let installed = false;

/**
 * Register the fixture. Idempotent — a second call is a no-op rather than a
 * `duplicate registry key` throw, because a screen can be rebuilt by the router
 * (back/forward) without the module being re-evaluated.
 */
export function installSelftestRegistry(): void {
  if (installed) return;
  installed = true;

  const T = tunables({
    'selftest.paceMs': {
      v: 2000, group: 'combat', unit: 'ms', min: 0, max: 20000, int: true,
      doc: 'Fixture: a base interval. Two derived values read it, one of them indirectly.',
    },
    'selftest.graceMs': {
      v: 500, group: 'combat', unit: 'ms', min: 0, max: 20000, int: true,
      doc: 'Fixture: a second input to selftest.total, so a consequence is not a rename.',
      simClamp: { lo: 0, where: 'selftest:fixture — records that a simClamp renders' },
    },
    'selftest.lockedInt': {
      v: 3, group: 'combat', unit: 'count', min: 1, max: 6, int: true,
      doc: 'Fixture: integer-only with a narrow band — the validation known-bad lives here.',
    },
    'selftest.orphan': {
      v: 0.12, group: 'combat', unit: 'wu/ms', min: 0, max: 1,
      doc: 'Fixture: nothing derives from this. A panel that invents consequences fails here.',
    },
  });

  // ⚠️ Declaration order IS dependency order — `derive()` reads its inputs immediately,
  // exactly as `registry.ts` documents. `selftest.cycles` therefore cannot be declared
  // before `selftest.total`, which is what makes the two-deep chain real rather than
  // notional.
  deriveds({
    'selftest.total': {
      group: 'combat', unit: 'ms', inputs: ['selftest.paceMs', 'selftest.graceMs'],
      formula: 'paceMs + graceMs',
      doc: 'Fixture: depth 1. Moves when either input moves.',
      f: (i) => i['selftest.paceMs'] + i['selftest.graceMs'],
    },
    'selftest.cycles': {
      group: 'combat', unit: 'count', inputs: ['selftest.total', 'selftest.lockedInt'],
      formula: 'total / lockedInt',
      doc: 'Fixture: DEPTH 2. previewDerived() answers this stale; resolveValue() does not.',
      f: (i) => i['selftest.total'] / i['selftest.lockedInt'],
    },
  });

  deriveFns({
    'selftest.radiusFor': {
      group: 'arena', unit: 'wu', inputs: ['selftest.paceMs'],
      where: 'selftest:radiusFor',
      args: ['fighters'],
      doc: 'Fixture: a derived FUNCTION. Read-only, no scalar, names what moves it.',
    },
  });

  // Referenced so the block is not dead code to a reader wondering what `tunables`
  // returned. The live values are read back off the registry by the panel, never from here.
  void T;
}
