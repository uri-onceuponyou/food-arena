/**
 * VISIBILITY — "can this observer see that fighter?", answered ONCE for every presentation layer.
 *
 * ## Why this module exists at all
 *
 * Uri, `DECISIONS §29b`: *"plates and other kitchen objects you can hide under — FULLY HIDDEN."*
 * The model, the HP pill and the radar blip obey it through one predicate, `fighterVisibleTo`,
 * which lived in `ui/hud.ts`. Revamp package V3 found the PRESENTATION leaking it anyway, through
 * the two consumers that draw and voice things ON a fighter rather than the fighter itself:
 *
 *   * `game/vfx.ts` drew the stun stars, the slow ring + tint + puddle splash, the ward band and
 *     the Blue Cheese cloud on fighters the viewer could not see — a hidden fighter's position
 *     showed through its own effects (`tools/tmp/v3_conceal.mjs`: at the cloth's camera-facing edge
 *     the cloud alone changed 68,804 px of a frame that otherwise held a bare table);
 *   * `audio/director.ts` voiced every item cue at the hidden fighter's position.
 *
 * The director could not ask the HUD's predicate: `ui/hud.ts` imports `../audio` for its UI
 * clicks, and `audio/index.ts` imports `./director`, so the import is a CYCLE (V2's finding,
 * re-derived: `hud.ts`'s first import). One rule with four consumers, reachable from three, is
 * exactly how the fourth ends up re-deriving it — and a re-derivation that drops `state` and
 * `target` silently resolves concealment against the arena's DECLARED regions instead of the
 * STANDING ones (see the body). This module is where the fourth can reach it.
 *
 * ## 🚨 WHY IT IS HERE AND NOT IN `ui/`, `audio/` OR `game/`
 *
 * A root-level module, sibling of `units.ts` and `proximity.ts`, for `proximity.ts`'s own layering
 * argument: in `ui/` it drags the DOM HUD (and its audio import) under the audio layer; in `audio/`
 * it makes the HUD import audio's internals. And NOT in `src/game/`: there it would be a third
 * direct `isVisibleFrom` call, and `sim.test.mjs` §26(m) pins the `src/game/*.ts` readers of that
 * function to EXACTLY TWO (`ai.ts:stepAI`, `sim.ts:stepProjectiles`) on purpose — "a third
 * appearing should make somebody look at it rather than pass silently". It imports only the pure
 * sim predicate and two types, with `.ts` extensions, so a plain Node instrument can load it.
 *
 * ⚠️ **`ui/hud.ts` STILL HOLDS ITS OWN COPY, AND THAT IS A ROUTED CHANGE, NOT A SECOND RULE.**
 * `hud.ts` is outside V3's file set. Its `fighterVisibleTo` body is byte-for-byte this one's, and the
 * routed change is to delete it and re-export this (`export { fighterVisibleTo } from
 * '../visibility'`), after which `match.ts`'s import from `../ui/hud` resolves here unchanged.
 * Until then `tools/tmp/v3_conceal.mjs` §B asserts the two agree on the live match.
 *
 * ## What is deliberately NOT in here
 *
 * **"You can always see yourself."** The local seat is never hidden from its own screen, and
 * every caller states that EXPLICITLY (`slot === LOCAL_SLOT || fighterVisibleTo(...)`) rather than
 * leaning on this returning `true` for a fighter asked about itself — `match.ts`'s model hide gives
 * the reason: leaning on it would make the rule a consequence of a distance test instead of a
 * stated rule. Nor is WHO the observer is: that is the camera's subject (`match.ts:viewObserver()`
 * — the local seat while it lives, a spectated fighter after), and it travels to each consumer
 * rather than being re-derived by it.
 */

import { isVisibleFrom } from './game/movement.ts';
import type { Fighter, MatchState } from './game/state.ts';

/**
 * Can `observer` see `target` in THIS match? Observer first, target second, both as whole
 * fighters, so a transposition is a type error instead of four swapped numbers.
 *
 * Pure: two fighters and the match in, a boolean out, nothing written — nothing derived from it
 * ever reaches `stepMatch`, so the seeded determinism every balance number rests on is untouched.
 *
 * ⚠️ `state, target` ARE THE `DECISIONS §29c` ARGUMENTS, and omitting them is a quietly different
 * question. Two facts live on the MATCH, not the arena (`ArenaDefinition` is one object shared by
 * every match a process runs): `MatchState.brokenConcealment` — a plate the target destroyed by
 * attacking from under it — and `Fighter.revealedUntil` — the window its own attack buys the other
 * side. Without them a fighter who had just shattered its cover and fired would still read as
 * hidden here while the sim treated it as seen. `ai.ts` passes the same two for the same reason.
 *
 * Degenerates to `true` wherever the arena declares no `concealment` list. ⚠️ The shipped kitchen
 * declares TWENTY (`arena/kitchen.ts`; 20 in the live arena `v3_conceal.mjs` boots), so this is live
 * in every match — `hud.ts`'s copy still says *"which today is all of them"*, which is false (routed
 * with it).
 */
export function fighterVisibleTo(state: MatchState, observer: Fighter, target: Fighter): boolean {
  return isVisibleFrom(observer.x, observer.y, target.x, target.y, state.arena, state, target);
}
