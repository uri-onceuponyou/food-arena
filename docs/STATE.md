# State — what is done, what is pending

As of commit **124**. Tree clean, HEAD verified bootable, all gates green, no agents running.

---

# PART 1 — DONE

Each row is verified by measurement, not assertion. Where a thing is *unscored*, it says so.

## Foundations

| | evidence |
|---|---|
| **Frozen design → live game** | 11 characters, all weapons, all balance transcribed into `rules.ts`. Pure sim with a typed event stream; 51 assertions. |
| **HUD** | The one element that **beat the shipped reference** in a blind A/B (critic scored real Brawl Stars 5/10 and ours higher). |
| **Viewport fairness** | Identical guaranteed view radius **199.2wu on every aspect**, 4:3 → 32:9 → portrait, spread **0.00wu**. Found and fixed a live bug: forward visibility was *below every melee range*, so you could be hit from off screen. |
| **Weapon-range rebalance** | Ranges retuned as two documented ladders. Characters **8.1% → ~13%** of frame height while keeping strict fairness. Melee anchored to body size, ranged to the fair radius. |
| **Body archetypes** | 4 reusable bodies (STUB/STOUT/STANDARD/LANKY) replacing one shared plan. `RigProportions` had only thickness knobs — no torso or limb *length* — which is why every body looked identical. |
| **Economy + trophy road** | Pure logic, seeded, **173 assertions**, every tunable in one file. Odds are computed from the same table the roller uses (60k seeded rolls assert distribution within 1pp). Real-money SKUs modelled, **disabled**, honestly labelled. |
| **Audio pillar** | Built from zero. Procedural synthesis, no assets. **319 assertions** from real rendered samples. |
| **Theme music** | Uri's "Bounce and Bash" — streamed, not decoded (decoding would be ~198MB resident for a 4MB file). Stops for a fight, resumes after. Verified audible by differential measurement. |
| **Touch controls** | Twin floating sticks. **46/46** proven with real CDP touch events read off fighter state. Mobile is now playable. |
| **Menus** | Shell/router, opening, home, character select, trophy road, settings, match. **315 assertions** across 5 viewports × 5 screens × notch/no-notch. |
| **Icons** | All 60 emoji replaced by 65 authored icons. |

## Bugs found and fixed — the majority of the value

| bug | impact |
|---|---|
| **Colour grade destroying a fifth of every frame** | 8 of 12 palette colours lost a channel; all arrived at saturation *exactly 1.00*. Explains the years-old "heavy orange grout" complaint — the albedo was always fine. |
| **SSAO contributing exactly 0.0000/255** | At every framing, for the entire project. Every lighting score ever recorded was a score *without* AO. |
| **Fog killing invisibly** | 50 HP/s outside the safe radius with **no renderer at all** — and its damage was visually identical to being shot. |
| **63% of prop grounding buried** | Shadow decals drawn under opaque floor pads that props deliberately stand on. Inverted a queued decision: they must be *kept*, not deleted. |
| **GL context leak** | 6 contexts created, **6 live**, 2 leaked per menu↔match round trip. Chrome caps at ~16 — the game white-screened after ~8 round trips. Now flat at 1. |
| **HEAD unbootable for 24 commits** | A committed file imported an uncommitted one; every gate passed because they check the working tree. |
| **AI could not navigate** | A "deterministic side preference" computed a vector crossed with *itself* — identically zero. Map reachability 48% → **78.2%**; stalls 77% of the match → **0.0%**. |
| **Impact burst 2.25× character height** | Swallowed whatever it hit. Would have poisoned nine queued weapon agents. |
| **Motion never assessed** | Attacks ended in a one-frame **0.79m teleport**; squash/stretch was dead code project-wide; run bob was *exactly* phase-inverted. Fixing them took the same characters **3/10 → 7/10**. |
| **Audio compressor eating 8.2 dB** | On a signal 6 dB *below* its own threshold. The whole game would simply have been quiet. |
| **Trail/decal/effect invisibility** | Sixteen instances. See `docs/LESSONS.md` §1. |

## Measured baselines worth keeping

- **Whole arena scores 4.2** while its elements score 5–7 individually — the ~2 point gap is
  real, and confirmed the structural risk of per-element optimisation.
- **The player is never in the top three salience cells of any frame.**
- Match: **696 draw calls**, 295k triangles, 95MB textures, allocation **1,697 B/frame**
  (healthy — do not spend a loop there).
- Mean match length **25.3s** of a 180s clock. Fog contributes **0.4%** of all damage.

---

# PART 2 — PENDING

## 🔴 Gameplay bugs — highest priority, all found by the full-match pass

1. **The match clock ends nothing.** `stepMatch` has no time-limit termination: 260s into a
   180s match with both fighters immortal, `phase` stays `'playing'` and `winner` stays
   `null` forever. In practice `safeRadius` hits 0 and the 100 HP player dies ~0.9s before
   the 150 HP enemy — **timeout is an arithmetically guaranteed player loss.** Fairness bug.
   → `src/game/sim.ts`
2. **Trail marks stack into a one-frame kill.** `applyWorldTick` damages once per mark, all
   in the same tick, uncapped: **100 HP → 1 HP in a single 16.7ms tick**, 30 simultaneous
   hit events. Undodgeable. Keep the mechanic; cap it per tick.
   → `src/game/sim.ts`, `rules.ts:TRAIL`
3. **Melee at distance 0 ignores facing** (`NaN > cone/2` is false), and the AI closes to
   literally zero distance — so damage stops being a function of aim exactly when the fight
   is closest. → `src/game/combat.ts`
4. **A fighter inside the pot is invisible.** The pot has a solid visual body and **no
   `CoverBox`**, so fighters walk into the mesh and vanish. The fog funnels both players
   there at the end of every match. → `src/arena/hazards.ts` / `kitchen.ts`
5. **The radar shows no zone.** The safe rect is `(2R/1400)` of a 152px box: 127% of the
   widget at start, ≥100% until t=38.4s, while matches end at ~25s. It is a flat cream
   rectangle for the entire match. → `src/ui/hud.ts`
6. **`MATCH_DURATION_MS` is ~7× too long** — mean match 25.3s of 180s, and the entire
   closing-zone system never fires. Note the fog schedule derives from it. → `rules.ts`

## 🟠 Known-weak, with a lead

7. **AI pathing needs real pathfinding.** Greedy local avoidance now reaches 78.2% of the
   map, but the player's own spawn still reads "gets within 2× reach, never arrives" — it
   sits in an alcove and no side-choice heuristic can thread a multi-obstacle route. A flow
   field or A* over a coarse grid is the proper fix. → `src/game/movement.ts` / `ai.ts`
8. **Cumulative desaturation has overshot the reference, across two independently-correct
   passes.** Reference warm chroma 0.145; after the floor re-key 0.128; after the counters
   re-key **0.067** — under half. Mean saturation 0.324 vs the reference's 0.493, against
   the 0.302 three critics called "muddy". **Nobody is watching the sum.** Add cumulative
   chroma to `tools/arena-scan.mjs` before anyone desaturates anything else.
9. **Floor terracotta moved into the PLUM family** (`tileLight` hue 332–340) — the same hue
   family `coverBody`/`coverPlinthPanel` reserve for *blocking*. The hue half of the
   blocking-vs-walkable cue is gone; value alone (53 luma) carries it. Deliberate decision
   needed.
10. **Icons: emoji are gone, but the icons are not yet good.** Identify-at-real-size was
    **12–13 of 28** across two rounds — flat. Needs one focused pass on that test alone.
11. **Spawn separation → 75.2% dead time**, with the opponent outside the fair-play square
    73.4% of the match. Also: the closing circle takes players into *denser* cover
    (occlusion 31% → 47%), the opposite of the genre convention. → `src/arena/kitchen.ts`

## 🟡 Unscored — work landed, verdict missing

The 200-agent cap hit before closing critics could run. **Blind packets are already built.**

- **Character heads, both passes** (all 11). Mid-point scores only. Packets at
  `shots/heads/r4/review/<char>/` and `shots/heads/`.
- **Home, settings, opening.** Packet at `shots/review/home-r1/`.
- **Counters/storage round 2.** Packets at `shots/review/counters-r2-{1,2,3}`.
- **Floor final state** — the mauve re-key landed *after* its critics judged; validated by
  measurement only.

## 🔵 Not built

- **Shop + chests/boxes UI** — blocked deliberately on `ROSTER_GATED`. While everything is
  owned, every box is a guaranteed coin loss (900 coins in, ~138 EV out). Model, odds and
  reveal are all built and tested; this is UI only.
- **Skins** — needs a per-character material-variant system that does not exist.
- **Mobile quality tiers + DPR cap.** The renderer exposes no tier, so settings deliberately
  ships no graphics row rather than a fake one. Phones report DPR 3–4; `maxPixelRatio` is 2.
- **Key rebinding** — `MOVE_KEYS` is a module-private `const` in `input.ts`. Export it and
  `settings.ts` can delete its copy instead of maintaining it.
- **Player name** — `PlayerProfile` has no setter.

## ⚪ Small, certain

- `floor.ts` ~line 891 still carries the **old key-light azimuth** (`0.79/0.615` should be
  `0.961/0.276`). Last stale copy in the repo.
- `shared.ts` lines ~226–229, 268–269, 321–322, 858–859 quote **stale hexes** for
  `stoveCap`/`prepCap`/`roofMat`.
- `kitchen.ts:229` — one-line `{ merge: true }` on `outlineGroup`, worth **−45 draws/frame**
  at 0.0002/255 image change.
- `match.ts` ~522 — drop `focus()`'s now-clamped third argument.
- **Feet below y=0 cast-wide** (−0.08 to −0.25m), violating `types.ts` convention #1.
- `bodies.ts`: STUB `shoulderFraction 0.12` puts the arm pivot in the widest part of a
  bottom-bulged mass (egg's arms were *inside the shell*); STANDARD ties `torsoWidth` to
  `shoulderWidth` so widening shoulders silently widens the waist.
- `preview.ts` `face=1` is unusable for non-spherical heads — it assumes the rig's default
  face position and frames empty crust or sky.
- `matchScreen.ts` pause chip sits in the **left thumb zone**.
- `game/rules.ts` + `economy/`: `emoji` fields are still the model's tokens; a real `iconId`
  would delete a 50-line translation table. `CONTAINERS.hamburgerBox.emoji` is the same 🍔
  as `CHARACTERS.hamburger.emoji`, so an emoji lookup cannot tell a box from a fighter.

---

# PART 3 — NEEDS URI

Nothing below can be settled by measurement.

1. **Pointer lock on a real browser.** Playwright's Chromium refuses `requestPointerLock()`
   unconditionally — headless, headed, and with automation flags stripped. **The
   multi-monitor case that prompted the work cannot be reproduced by any harness here.**
   Also: does "Click to resume" feel responsive, given Chrome's ~1s re-acquisition limit?
2. **How the retuned ranges feel.** The longest weapon reaches 3.3 body-lengths, down from
   6.2. Sim says the fight is scale-invariant; a sniper now reads as *"clearly out-ranges
   the brawler"* rather than *"shoots from across the room"*.
3. **Does `giantSlam` need a wind-up?** Its tell is verified readable with the caster off
   screen — but the slam resolves on the *same tick it is cast*, so it cannot be dodged,
   only explained. That is currently what keeps the fair-play radius at 199.2wu instead of
   ~918wu.
4. **The trophy road curve.** It is a deliberate **redesign**, not a transcription: the
   prototype's 38 nodes to 25,000 trophies is ~1,670 wins unlocking only 6 of 11
   characters. Ours is 34 nodes to 3,200 with all ten non-starters, measured at 4 matches to
   the first unlock and 394 (~13h) to the full roster.
5. **When to flip `ROSTER_GATED`.** Off for now, per Uri, while evaluating. The shop stays
   parked until it flips.
6. **Whether the icons need another pass** or the remaining trophy-road findings (an
   unrankable rarity ladder mixing themes into a rank sequence; a progress bar reading ~100%
   while labelled "30 to next reward") are worth more per token.
7. **Whether audio sounds *good*.** Structure is measured; taste is not. Specifically:
   does the synthesised room read as a *kitchen* rather than a small box, and does Hamburger
   at 767 Hz read as "heavy" or merely "muffled"?
