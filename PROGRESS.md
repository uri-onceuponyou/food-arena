# Food Fight Arena — Build Progress

Real-time 3D brawler in Three.js, rebuilding the 2D prototype's execution at the quality
bar of **Brawl Stars** and **Zooba**.

> **Resuming a session? Read this file and `git log` first, before anything else.**
> Everything below reflects committed, pushed state. Do not redo a piece marked done.

Remote: https://github.com/uri-onceuponyou/food-arena (auth works; push freely)
Live progress page: https://claude.ai/code/artifact/e2831790-d411-476a-97ae-9245211d56f7

---

## How to get running

```bash
npm install
npm run dev                 # http://localhost:5173  (MUST be running for screenshots)
npx tsc --noEmit            # must stay clean
node src/game/sim.test.mjs  # must stay 47/47
```

Screenshots (~2s each — **always run in the foreground**, never background them):
```bash
node tools/shoot.mjs --char donut --out-dir shots/donut/rN         # 13-shot review set
node tools/shoot.mjs --url "http://localhost:5173/preview.html?piece=arena&t=2.4&shot=1" \
  --out shots/arena/rN/gameplay.png --w 1300 --h 820
node tools/compare.mjs --tile "a.png,b.png" --labels "a,b" --cols 2 --out sheet.png
node tools/review.mjs --ours <png> --category character|gameplay --out shots/review/x  # blind A/B
```

Preview harness: `preview.html?piece=character|roster|arena&id=<id>&anim=<state>&yaw=<deg>&t=<sec>&shot=1`
(`t` freezes animation deterministically; `chars=0` empties the arena; `tx`/`ty` re-aim the arena camera.)

---

## Standing rules

- **`src/game/rules.ts` is the frozen design.** Import every gameplay constant from it;
  never hardcode one. Uri later authorised deviating *where it demonstrably raises
  quality* — deviations must be deliberate and recorded in the commit message.
- **Judge rendered pixels, never descriptions.** Render it, `Read` the PNG, look.
- **Builder self-scores are not verdicts.** Builders self-score 7–8.5/10; the independent
  critic scored a character 4/10 and the arena 2/10. Only the critic's number counts.
- **Give the critic a fair test.** The 2/10 arena verdict was partly my fault — I sent an
  empty arena, cropped, with no characters, against reference frames full of brawlers.
- **`reference/prototypes/` is gitignored and must never be published.** It was stripped
  from all history (which also removed a Supabase key committed inside
  `multiplayer-position-test.html`). Uri restored the files locally.
- **One agent per file.** Parallel agents editing a shared file will clobber each other.

---

## Architecture

| Path | Role |
|---|---|
| `src/game/rules.ts` | Frozen design: 11 characters, every weapon, all balance numbers |
| `src/game/{sim,state,combat,ai,movement}.ts` | Pure simulation, no Three.js. `stepMatch()` is the entry point; returns a typed event stream |
| `src/game/sim.test.mjs` | 47 assertions, plain Node, no framework |
| `src/render/{stage,camera,lighting,toon}.ts` | Renderer + post FX, camera rig, 3-point lighting, materials/outlines |
| `src/characters/rig.ts` | **Shared ChibiRig** — body plan + all motion. Characters author only food mass, face, palette |
| `src/characters/<id>.ts` | One file per character. `donut.ts` is the reference implementation |
| `src/arena/kitchen.ts` | The arena: geometry, cover boxes, hazards, ambient life |
| `src/preview.ts` | Isolated deterministic previews of any piece |
| `tools/{shoot,compare,review,progress}.mjs` | Screenshots, contact sheets, blind A/B packets, progress page |

**Art direction** (verified against real reference, and it contradicts the brief's prose):
Brawl Stars is **not** cel-shaded. It is smooth-shaded, hyper-saturated, high-key, with soft
specular highlights — moulded vinyl toys — and almost no ink outline. `toonMat` therefore
returns a `MeshStandardMaterial`; there is no filmic tonemapping (it desaturates); IBL +
SSAO are on. See the header of `src/render/toon.ts`.

---

## Status

### Foundation — all done
Scaffold · frozen design spec · render core (IBL, SSAO, high-key rig, saturation grade) ·
preview harness · headless-WebGL screenshots · blind A/B compositor · 21 curated reference
plates (`reference/images/curated/`, gitignored) · live progress page.

### Characters — 11 of 11 modelled, all on the shared rig
| Character | State | Note |
|---|---|---|
| Hamburger | ✅ | Richest food mass in the cast; bottom bun is its dressed torso |
| Donut | ✅ | Reference implementation; dressed torso |
| Taco | ✅ | Two-panel V-fold shell (a flat panel vanished edge-on) |
| Burrito | ✅ | Up-facing opening so it reads under the steep camera |
| Egg | ✅ | Torso built from the same `eggSurface` math as the head |
| Lollipop | ✅ | Uses the rig's neck-to-head gap AS the stick |
| Pizza | ✅ | Extruded wedge, crust rim hugging the dough's own boundary |
| Sushi | ✅ | Two lathes sharing one seam vertex; overhanging salmon lid |
| Soup | ✅ | Lathed bowl, ladle prop, deliberately no mouth |
| Water Bottle | ✅ | Real transparency; water opaque inside a transmissive shell |
| Hot Dog | ✅ | Mustard zigzag pushed along the sausage's true surface normal |

### World & systems
| Piece | State |
|---|---|
| Kitchen arena | ✅ round 2 — 7/10 (was 2/10). Danger zone is a glow ring, palette broken out of monochrome |
| Match simulation | ✅ 47/47 tests |
| Playable match (glue + HUD) | ✅ playable end-to-end |
| Ability VFX | ⬜ not started |
| Camera / game feel | ⬜ not started |
| Menus (roster, results) | ⬜ not started |

---

## THE CRITIC LOOP — this is the active work

**CURRENT TARGET: get the ARENA to 6–7/10.** Uri redirected here after the character
loop plateaued. Characters are PARKED at 4/10 — do not resume them without being asked. Run `tools/review.mjs` to build blind A/B packets, then spawn a
fresh critic agent (no memory of prior rounds) to judge them.

### Score history — always compare like-for-like

Same three characters (Hamburger / Water Bottle / Soup), same method, every round.

| Round | Score | What the critic named |
|---|---|---|
| 1 | **3/10** | "Every character reuses the same snowman-body-plus-ball-joints skeleton with a different head glued on." Faces reading as errors (Soup's mismatched pupils, Bottle's uneven eye heights). No rim light / value steps. |
| 2 | **4/10** | Still "one templated body reskinned with different heads" — because rounds had changed limb COLOUR and PROPORTION, not limb TOPOLOGY. Two characters had no mouth at all. |
| 3 | **4/10** | Same complaint again. Faces "pasted on, not integrated" — Bottle's eyes floating on stalks above the cap, Soup's face on a neck BELOW the bowl. |
| 4 | **4/10** | **RETRACTED the shared-limb complaint**: "The three do NOT share literally copy-pasted limb geometry ... three different constructions ... real, separate limb-sculpting effort per character." New gaps: no costume/wardrobe layer; flat materials with no secondary specular or texture; identical dead-front pose across the cast; Hamburger's held prop illegible. |
| 5 | in progress | Costume/accessory layer + per-character `RigStance` + material fidelity. |

### What actually moved the needle

- Colour and proportion changes did NOT move the score (rounds 2–3, flat at 4).
- Changing limb **topology** and **where the face lives** DID — it retired the
  complaint that had dominated three rounds.
- **Lesson: when the score stalls, the fix is structural, not cosmetic.**

### ARENA loop (the active one)

| Round | Score | Notes |
|---|---|---|
| 1 | **2/10** | **Unfair test — my error.** I sent an empty arena, cropped tight on the hazard, with NO characters, against reference frames full of brawlers. Its substantive points still stood. |
| 2 | 7/10 self-scored | Danger zone changed from an opaque disc to a glow ring; palette broken out of monochrome. Never independently re-tested at this point. |
| 3 (fair) | **3/10** | First like-for-like test: our in-game view WITH characters vs Brawl Stars gameplay frames WITH characters. No framing confound. |
| 4 | 6/10 self-scored, **NOT yet independently tested** | Root-caused the missing AO (see below), added top rims / backsplashes / kick bands for vertical relief, floor dressing. |

**NEXT ACTION: run the independent arena critic on `shots/arena/r20/gameplay.png`
against the 3/10 baseline.** Use `node tools/review.mjs --ours shots/arena/r20/gameplay.png
--category gameplay --out shots/review/arena-rN --n 3`, then a FRESH critic agent.
The 6/10 is the builder's own self-score and does not count.

**Round 3's finding is functional, not aesthetic, and is the one that matters:**
> "The cover objects have no height, no AO, no shadow separation from the floor, so a
> player cannot tell at a glance whether they block movement or line of sight. In a
> top-down arena brawler, that's a gameplay-legibility bug, not just a polish gap, and
> it alone caps the score regardless of how appealing the palette is."

Other findings worth keeping:
- It rated our CHARACTER art "noticeably closer to par than the environment art" — the
  arena is now the weaker half of the game.
- The pot's apparent dominance is "a detail-density illusion, not a scale error."
  **Do not shrink the pot** — give the rest of the frame something to compete with.
- Praised and must not regress: the pot prop itself ("close to shippable quality on its
  own") and the pale floor keeping characters visually separated ("a real, defensible
  design choice for competitive clarity").

Arena comparisons are inherently FAIRER than the character ones — top-down gameplay
against top-down gameplay, same subject, same framing. Use `--category gameplay`.

### CHARACTER loop — parked at 4/10

Five rounds: 3 → 4 → 4 → 4 → 4. What moved it and what didn't is recorded above.

A sixth experiment tested whether the plateau was a methodology artifact: reference
crops were mostly tight PORTRAIT close-ups while ours are full-body, so critics were
partly rewarding framing. Full-body reference crops were curated
(`reference/images/curated/character_fullbody/`, and a fair subset in
`fullbody_fair/` excluding Kung Fu Panda crossover assets, which are DreamWorks
film-grade and would raise the bar unfairly). Result: **Hamburger scored 4/10 — no
change.** Per Uri, the mechanism is parked, not adopted.

Two reference sets were downloaded and REJECTED for lowering the bar, which Uri
explicitly forbade: Food Gang (2D flat vector — on-subject but lower fidelity than
ours) and Cats&Soup (2D painted idle game). Comparable-subject 3D references at
equal-or-higher quality barely exist.

Sharpest un-actioned character findings, if the loop ever resumes:
1. Pose is the named #1 gap — "a static, symmetrical front-on mascot reads as a
   placeholder/turntable render, not hero art, regardless of how good the shading gets."
2. "No genuine dark value anywhere on the model" — wants a real core-shadow COLOUR,
   not a darker tint of the same hue.
3. Sesame seeds "read as a copy-paste array" — no scale/rotation variance.
4. Our own preview presentation was penalised: "a placeholder two-tone sky background
   with a flat ellipse shadow." That is the harness, not the art — cheap to fix.

### Honest read on reaching 8

Four rounds bought one point. The comparison images are hand-authored characters with
fabric folds, fur shading and sculpted brow ridges, often shown as tight portrait
crops that flatter that detail. 6–7 looks reachable through wardrobe, materials and
posing. 8 is possible but not assured. Report real verdicts, including flat rounds —
do not redefine success.

### Running a round

1. Render heroes: `preview.html?piece=character&id=<id>&anim=idle&yaw=15&t=1.5&shot=1&fill=0.78` at 760x950.
2. `node tools/review.mjs --ours shots/<...>.png --category character --out shots/review/rN-<id> --n 1` per character.
3. Spawn a FRESH critic agent (never reuse one — it must not remember prior rounds),
   show it ONLY the sheet PNGs, forbid it from opening any `.json`.
4. Tell it to judge design/execution, NOT framing — our renders are full-body on a
   plain backdrop, theirs are often portrait crops, and that difference is not a
   quality signal.
5. Read the answer keys yourself afterward to confirm the shuffle held.
6. Commit the verdict verbatim in the message. Feed the named gaps into the next round.

## Next actions, in priority order

1. **Land critic round 5** — costume/accessory layer and per-character stances are
   in flight for all eleven. Then re-run the critic and record the score.
2. **Material fidelity** — the critic's standing gap: "every material is a single
   flat colour with no secondary specular or texture." Wants ceramic glaze specular,
   glass refraction, a real speckled sesame texture rather than five floating ovals.
3. **Verify the game actually plays well** — VFX and juice landed but nobody has
   played a full match at real framerate and judged feel.
4. **Arena** — sits at 7/10 from its own critic pass; not re-tested since.
5. **Menus** — roster/character select and results screens do not exist.

## Known issues

- `ChibiRig.headCentreY` assumes a head mass extending ~±R about its origin.
  Non-spherical masses float or sink. Hamburger/HotDog anchor their own underside at
  about -0.90R; Taco needed a different fix (see below).
- `dressTorso`'s `size.h` is measured off the rig's DEFAULT torso bounding box, which
  is only ~92% of nominal because that sphere tapers before its poles. Character
  torsos built to that figure can sit lower than expected — this caused Taco's head
  gap, which looked like a headCentreY problem and was not.
- Meshes flipped 180° about X to hang downward negate Z, so decals placed at a
  surface's "front" land on the hidden back face (bit Hamburger's mitt seeds).
- Lathe profiles MUST run bottom→top or normals invert and the mesh renders near
  black (bit six characters at once).
- `donut.ts`, `pizza.ts`, `egg.ts` carry local `dressTorso` copies from before the rig
  exposed one. Could be de-duplicated.
- Blindness is imperfect: a critic that recognises Brawl Stars/Zooba identifies the
  reference by IP, not by quality. Critiques remain specific and actionable.
- Arena AI: `moveToward` now slides around cover; regression test covers it.
