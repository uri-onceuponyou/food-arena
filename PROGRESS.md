# Food Fight Arena — Build Progress

Real-time 3D brawler in Three.js, rebuilding the 2D prototype's execution at the quality
bar of **Brawl Stars** and **Zooba**.

> **Resuming? Read this file and `git log` first.** Everything below reflects committed,
> pushed state. Do not redo anything marked done.

Remote: https://github.com/uri-onceuponyou/food-arena (auth works; push freely)
Live progress page: https://claude.ai/code/artifact/e2831790-d411-476a-97ae-9245211d56f7

---

## THE WORKING MODEL — per-element critic loops

Uri's direction: **decompose everything to its smallest parts. One agent owns each
element and runs its own build → critique → fix loop until an independent critic scores
it 7/10.** Plus a periodic whole-arena scan to check the parts still add up.

This replaced whole-artefact judging, which had stalled: a critic scoring an entire
arena averages everything, so the score is dragged by the weakest part and no individual
improvement ever gets credit.

### Rules for running an element loop

1. One agent owns one FILE SET. Parallel agents in the same file clobber each other —
   the single hardest constraint, and why `kitchen.ts` is being split.
2. Each round: improve → screenshot → **read the screenshot yourself** → build a blind
   packet with `tools/review.mjs` → spawn a **FRESH** critic subagent → act on its named
   fix → loop. Cap at 5 rounds.
3. **Never reuse a critic.** A fresh one per round cannot anchor on its own earlier
   verdicts.
4. Tell the critic what to ignore: our shots may lack the HUD (preview harness), and are
   full-body on a plain backdrop where references are often portrait crops. Those are
   capture artifacts, not quality — say so explicitly or the score is measuring framing.
5. Builder self-scores are NOT verdicts. They have run 2–4 points above independent
   critics all project.

### ISOLATION EARNED THE SCALE-OUT

Uri's condition was *"if it proves itself do it scale — on every element we failed to
improve, isolate, review, fix, each element in its own improvement loop."* It proved
itself three separate ways, so every plateaued element now has its own loop:

1. **Floor** — flat 3/10 across five rounds judged in the full arena; peaked **6/10**
   once judged on the `piece=floor` clean slate. The isolation also revealed that the
   default centred crop sat almost entirely inside the pot hazard's radius, so critics
   had been scoring nearly bare tile.
2. **Silhouettes** — one render of the cast as pure black on white (`silhouette=1`) did
   what five rounds of prose critique could not: it named *which* characters fail.
   Lollipop, Pizza, Donut, Taco, Soup, Egg read distinctly; **Burrito, Sushi and Water
   Bottle collapse into generic blobs.** It also showed every body is nearly identical,
   so essentially all identifying information lives in the head — the measurable form of
   the recurring "one template with different heads" complaint.
3. **The checker probe** — root-caused a five-round blocker in about ten minutes.

The general lesson: **an element judged inside a busy shared scene is scored on the
scene.** Cover props lost a round to a neighbouring spice cart that wasn't under review.
Isolate first, then loop.

### Element scoreboard

| Element | Owner files | Status |
|---|---|---|
| **HUD** | `src/ui/hud.ts` | ✅ **Beat the shipped reference in a blind test** — critic scored the shipped side 5/10 and ours higher |
| Floor | `src/arena/floor.ts` | 4.5/10, peak 6 — texture blocker now cleared, loop resumed |
| Tile/prop textures | `src/arena/textures.ts` | ✅ frequency bug fixed, grain verified visible |
| Lighting & post | `src/render/lighting.ts`, `stage.ts` | 5/10 capped — loop running, building a neutral probe scene |
| Cover props | `src/arena/props/*` | 3,4,3,3,4 capped — loop running, per-prop isolation |
| Hazards | `src/arena/hazards.ts` | 6,6.5,6,5,6 — capped by colour semiotics (every hue collided with a genre meaning). Now reworked to Uri's design: render grease/water plainly, react on contact |
| Combat VFX | `src/game/vfx.ts`, `src/vfx/weapons/*` | 3,4,4,3,3.5 capped — per-weapon agents, one per weapon |
| Burrito / Sushi / Water Bottle | `src/characters/<id>.ts` | loops running — the three the silhouette test named |
| Characters (rest) | `src/characters/*` | **PARKED at 4/10** — do not resume unless asked |

### Score histories

**Arena (whole):** 2/10 (unfair test — my error: empty arena, cropped, no characters) →
7/10 self-scored (untested) → **3/10** first fair test → 4 → 5 → 4 → 4. Plateaued.

**Characters (whole):** 3 → 4 → 4 → 4 → 4. Parked. What moved it: changing limb
TOPOLOGY and where the FACE LIVES. What didn't: colour and proportion changes. A
full-body-reference experiment was run to test whether the plateau was a framing
artifact — **no score change**, so it was parked, not adopted.

### Arena element loops — the split landed

`kitchen.ts` (2,495 lines) is now `props/counters.ts`, `props/storage.ts`,
`props/smallProps.ts`, `floor.ts`, `hazards.ts`, `ambient.ts`, `shared.ts`, with
`kitchen.ts` as the assembler. Behaviour preservation was proven by numeric per-pixel
diff of before/after renders (deterministic: frozen `t`, seeded texture LCG) at
0.0007–0.0039/255 — the harness noise floor, from an unseeded `Math.random()` in the
dust field. A scarier ~6.9/255 reading turned out to be a Vite cache artifact, proven by
hand-reconstructing the original monolith and A/B testing that it affected old and new
code identically.

Isolate a single prop with `preview.html?piece=prop&kind=<kind>` — gameplay pitch,
character beside it for scale. Kinds: `stove_island prep_counter sink_counter
fryer_counter freezer supply_barrel produce_crate_tall herb_crate flour_sacks
stacked_pots spice_cart`.

**Known cross-element conflict, still unresolved:** the arena bakes its own soft radial
cast-shadow decal under every prop, from back when real shadows were mushy. The lighting
loop REGRESSED to 3/10 in one round because widening SSAO stacked a third soft darkening
layer on top of that decal AND the real shadow map — a critic read the mush as one
directionless blob. Now that real shadows are crisp, those decals are likely redundant
and harmful. **Both the lighting and props loops have been asked to test removing them.**
This is exactly what the whole-arena scan exists to catch: element owners optimising
locally can fight each other.

---

## THE PATTERN THAT KEEPS COSTING TIME

**When a critic says "X isn't there", check whether X is rendering and INVISIBLE before
concluding it is missing.** True cause six separate times:

1. Sesame seeds placed at a mesh's front landed on its hidden back face — the mesh is
   flipped 180° about X, which negates Z.
2. Contact-shadow decals rendered at y=0.011 while floor tiles' top faces sit at y=0.015
   — buried inside the floor, visible only through grout gaps.
3. The HUD cooldown wipe was dark-on-dark against a dark card. Three critics reported
   "no visible cooldown" across three rounds before it was root-caused.
4. Headless screenshot readback took seconds while sub-300ms VFX had already decayed.
5. Splash particles spawned at y=0.06, *underneath* the puddle decal stack at 0.15–0.25.
   Transparent materials that never set `depthWrite:false` still write depth, so they
   silently occlude anything behind or beneath them.
6. Arena textures were wired correctly and still invisible — but see below, because the
   reason was NOT the one everyone assumed.

### The probe technique — prove it, don't infer it

The tile texture was called invisible for five rounds. The fix was to replace the
generator's output with a **garish 4x4 red/cyan checker** and render `piece=floor`. It
came back crisp and full-contrast, which *disproved* the whole invisible-wiring theory
in one shot: UVs, `toonMat`'s `map` forwarding, instancing and repeat were all healthy.

Do this first, always. A 10-minute unmissable-value probe beats hours of reading code
and beats five rounds of guessing. The pattern above is a prompt to **test**, not a
conclusion to reach.

### What the real bug was: spatial frequency, not contrast

A tile texture maps 0..1 across ONE tile. The old generator drew five soft blobs of
radius 0.22–0.46 — features the same size as the tile carrying them. That cannot read
as surface detail; it reads as "this tile is slightly tinted", which is precisely what
five critics reported as *"a single flat fill per cell."* Shrinking tiles 100→40wu made
it worse, not better.

**`map` is a property of the MATERIAL, not the instance.** The whole floor ran on two
texture variants, so the old "2–3 directional scuffs" were stamped identically onto
every light tile — hundreds of copies of one scuff. **Any recognisable mark in a tiling
texture becomes a visible repeat.** Detail must be isotropic, or it reads as a stamp.

Own the three bands separately. This generalises to every tiling surface in the project:

| Band | Owner | Notes |
|---|---|---|
| HIGH — sub-tile grain, pebble tooth | the texture | isotropic, no landmarks. **Close-range only — see below** |
| MID — feature the size of one tile | **nobody** | reads as flat tint AND repeats |
| LOW — wear across many tiles | `instanceColor` / vertex colour | macro variation. **The only band that survives at gameplay distance** |

### The band that matters depends on ZOOM, and we were judging at the wrong one

`preview.ts` isolation views use `viewWidthUnits: 265`; the shipped game spans ~900wu.
Every floor and prop loop has been judging at roughly **3.5× the zoom anyone plays at.**
Re-shooting the floor at shipped framing sorted its own work into three piles:

- **Survives:** the baked LOW-frequency lighting gradient — by far the biggest win and
  the only thing carrying the floor at distance. Per-tile tonal/hue variation. Overall
  value/saturation re-key.
- **Vanishes entirely:** tile chamfer/bevel, the high-frequency grain from `textures.ts`,
  per-tile yaw/scale jitter, stain tidemark rings. All close-range-only polish.
- **Inverts:** tile scale. Sized to 25wu against the preview, that is 36 tiles across a
  real frame with ~1px joints — an aliasing generator.

**At shipped distance, floor detail should live almost entirely in the LOW band.** The
frequency contract above is still right about what each band DOES; this says which band
is worth spending rounds on. Re-check after the range rebalance, which pulls the camera
back in and may partially restore the high band.

Re-shooting at shipped framing also exposed a bug the preview zoom had hidden completely:
decals z-fighting into shredded stripes, invisible at 265wu.

Also: `finishTexture` never set `anisotropy`. On a tilted top-down rig the floor and
every counter top are sampled at a grazing angle for most of the frame, where anisotropy
1 averages detail into mush — every grain texture was fighting that before it drew a
pixel. Now 8 (three.js clamps to hardware max).

The older contrast finding still holds and is separate: ±5–10% value swings get crushed
once multiplied against dark saturated bases and pushed through the contrast pass.
Needed 0.5–0.6 depth.

## Other hard-won traps

- `ChibiRig.headCentreY` assumes a head mass extending ~±R about its origin.
  Non-spherical masses float or sink. Hamburger/HotDog anchor their underside at ≈ −0.90R.
- `dressTorso`'s `size.h` is measured off the rig's DEFAULT torso bbox, ~92% of nominal
  because that sphere tapers before its poles. Caused Taco's head gap, which *looked*
  like a `headCentreY` problem and wasn't.
- Lathe profiles MUST run bottom→top or normals invert and the mesh renders near-black.
  Bit six characters at once.
- Composing `rotation.x` then `rotation.y` does NOT rotate a flat plane about world up —
  Euler angles are intrinsic and sequential, so the plane tips edge-on and vanishes from
  a top-down camera. Use explicit quaternions.
- Irradiance summed to ~3.7–3.8× before any material multiply, clipping pale surfaces to
  white. A hemisphere fill with both endpoints near-full-bright acts as flat ambient and
  destroys directional falloff.
- Large flat single-quad mats have ONE normal — no lighting can give them internal
  top-vs-side gradient. That needs baked texture/AO.

---

## How to run things

```bash
npm run dev                 # http://localhost:5173 — MUST be running for screenshots
npx tsc --noEmit            # must stay clean
node src/game/sim.test.mjs  # must stay 51/51
```

Screenshots (~2s; **always foreground** — backgrounding them stalled several agents):
```bash
node tools/shoot.mjs --char donut --out-dir shots/donut/rN
node tools/shoot.mjs --url "<preview or game url>" --out x.png --w 1300 --h 820
node tools/compare.mjs --tile "a.png,b.png" --labels "a,b" --cols 2 --out sheet.png
node tools/review.mjs --ours <png> --category character|gameplay --out shots/review/x --n 2
```

Preview harness — `preview.html?`:
- `piece=character&id=<id>&anim=<state>&yaw=<deg>&t=<sec>&shot=1&fill=<0-1>`
- `piece=roster` — all 11 lined up
- `piece=arena&t=<sec>&tx=<worldX>&ty=<worldY>&view=overview|gameplay&chars=0`
- `piece=prop&kind=<kind>` — single prop, gameplay pitch, character for scale
- `piece=floor` — floor alone, no props/hazards. Params `tx`/`ty`/`zoom`/`pitch` (700/500/265/58)
- `silhouette=1` — everything pure black on white. The single most diagnostic shot we have
- `face=1` — face detail alone

Real game — `/?simSpeed=<n>&player=<id>&enemy=<id>`. Static shots often miss brief
effects; **script Playwright** to drive input and wait on a condition instead.

**Judge the arena from PLAYER-CENTRED views** (`tx`/`ty`), never the arena centre.
Centring on the pot filled the frame with the hazard and pushed cover out of shot, which
depressed several rounds of scores for reasons that were my framing, not the arena.

---

## Architecture

| Path | Role |
|---|---|
| `src/game/rules.ts` | Frozen design — 11 characters, every weapon, all balance numbers |
| `src/game/{sim,state,combat,ai,movement}.ts` | Pure simulation, no Three.js. `stepMatch()` returns a typed event stream |
| `src/game/sim.test.mjs` | 51 assertions, plain Node |
| `src/game/match.ts` | `GameSession` — the only place that talks to both sim and renderer |
| `src/game/{input,vfx}.ts` | DOM input; pooled VFX driven off sim events |
| `src/ui/hud.ts` | DOM/CSS HUD over the canvas |
| `src/render/*` | Renderer, post FX, camera rig, lighting, materials |
| `src/characters/rig.ts` | Shared ChibiRig — body plan, proportions, stance, motion |
| `src/characters/<id>.ts` | One file per character; `donut.ts` is the reference pattern |
| `src/arena/*` | Arena geometry, cover, hazards, textures, ambient |
| `tools/*.mjs` | Screenshots, contact sheets, blind A/B packets, progress page |

**Art direction** (verified against reference; contradicts the brief's own prose):
Brawl Stars is **not** cel-shaded — it is smooth-shaded, hyper-saturated, high-key, with
soft specular and almost no ink outline. `toonMat` returns a `MeshStandardMaterial`; no
filmic tonemapping (it desaturates); IBL + SSAO on.

---

## Standing constraints

- **`src/game/rules.ts` is NO LONGER FROZEN** (Uri, 2026-08-03: *"Don't let anything
  frozen impair your ability to improve looks and gameplay."*). It is still the single
  source of truth — import every gameplay constant, never hardcode one — but its VALUES
  are now tunable when a change demonstrably improves looks or gameplay. Deviations must
  be deliberate, verified, and recorded in the commit message. The first such change is
  the weapon-range rebalance forced by viewport fairness (below).
- **The arena must respect the fair-play window.** Everything that decides a fight —
  cover edges, hazard tells, spawns, pickups, the fog edge — must be readable inside the
  fair-play square centred on the PLAYER. On a 21:9 the view reaches well beyond it, and
  that surplus is *cosmetic bleed*: non-colliding decoration only, whose gameplay meaning
  is already known. Two violations exist today: at spawn a 21:9 player sees the boiling
  pot and its caution ring while a 4:3 player does not (a hazard living in bleed), and
  the playfield has **no apron** — from the west spawn every aspect shows flat background
  off the map edge. The arena needs dressing out well beyond its 1400×1000 bounds.
- **VFX owner:** Lollipop's `giantSlam` tell must be readable with the caster OFF SCREEN.
  That assumption is what keeps the fair radius from ballooning to ~918wu.
- **Judge rendered pixels, never descriptions.** Render it, Read the PNG, look.
- `reference/prototypes/` and `reference/images/` are gitignored and must never be
  published. Prototypes were stripped from all history, which also removed a Supabase key
  that had been committed inside `multiplayer-position-test.html`.
- Verify before committing: `tsc` clean AND sim 51/51. I once pushed a broken tree by
  letting `git add -A` sweep in a file an agent was mid-edit on.

## ⏸ PAUSED 2026-08-03 — READ `LAUNCH_PLAN.md` FIRST, THEN THIS

**`LAUNCH_PLAN.md` is the resume document.** It has the wave order, the body-archetype
decision, exact file ownership per agent, and the token budget that makes 8–10 hours of
running possible. Start at its Wave 0 — a serial blocker that unblocks every character
loop, because `RigProportions` currently exposes only thicknesses and widths, with **no
knob for torso size or limb length**. That is the real reason all 11 bodies look alike.

Everything is committed and pushed. `tsc` clean, sim 51/51, live game smoke-rendered
with no runtime break. Working tree was clean at pause. **Nothing is half-finished.**

Seven agents were stopped deliberately for the pause, all early enough that only the
VFX one had written to disk (committed in `86f7838`). The other six had done nothing
but read. **Re-dispatch them from scratch** — do not go looking for partial work:

| Loop | Owns | Target |
|---|---|---|
| Burrito | `src/characters/burrito.ts` | 7/10 — silhouette reads as a blob |
| Sushi | `src/characters/sushi.ts` | 7/10 — same |
| Water Bottle | `src/characters/waterbottle.ts` | 7/10 — hardest case, a bottle is inherently a generic cylinder |
| Lighting | `src/render/lighting.ts`, `stage.ts` | 7/10 — was building a neutral probe scene; needs a small `preview.ts` wiring change it does not own |
| Cover props | `src/arena/props/*` | 7/10 — isolate per prop with `piece=prop&kind=` |
| Floor | `src/arena/floor.ts` | 7/10 — texture blocker now cleared, so this is a fresh start |

Each gets: exclusive file ownership, the loop protocol above, a FRESH critic per round,
cap 5 rounds, and the traps from this file. The full prompts are reconstructable from
the sections above — ownership + isolation mode + goal + protocol + traps.

Then: the remaining **nine weapon stubs** in `src/vfx/weapons/` are wired to the generic
fallback and ready for one agent each. `hamburger.ts` and `waterbottle.ts` are the two
worked examples, chosen from opposite ends of the weapon space.

## Next actions

1. Re-dispatch the six loops above, plus the nine weapon agents.
2. Wire the periodic whole-arena scanner as the real scoreboard — element scores will
   read higher than the whole, because a critic judging one barrel isn't weighing
   composition or density. **Optimising the easier metric is the standing risk of this
   entire working model** and the scanner is the only thing that catches it.
3. Resolve the authored-shadow-decal vs real-shadow conflict (both loops are testing it).
4. **Give every character a distinct BODY.** The silhouette test showed all identifying
   information currently lives in the head. Fixing the three named blobs is necessary but
   not sufficient — the shared body plan is the deeper cause.
5. Isolation modes still unbuilt: **motion filmstrip** (every character critique so far
   has judged stills, yet "reads like a turntable render" is a complaint about motion,
   which is entirely unassessed), and **ambient effects alone** (steam, dust, flame are
   invisible in a busy frame).
6. Nobody has played a full match at real framerate and judged how it FEELS.

### Cross-element debts the camera rewrite created — assign these

1. **SSAO is now a no-op in matches.** Probed: raising `worldDistanceThreshold` 30→120m
   changes the frame by mean **0.003/255**. Its 0.07m radius was ~7px before and is
   sub-pixel at the new camera distance. It currently costs a NormalPass plus 16
   samples/px for nothing. Lighting owner: raise radius *and* threshold together, or drop
   it. **Re-check after the range rebalance lands**, since that pulls the camera back in.
2. **Shadow box too small.** `lighting.focus(..., 30)` (`match.ts:522`) is ±30m; visible
   half-width now reaches 30.5m at 21:9, so shadows clip at the extreme corners.
3. **Preview framings drifted from the game.** `preview.ts` arena/floor/prop views still
   use `viewWidthUnits: 265` while the shipped game spans ~928wu at 16:9 — those loops
   have been judging at ~3.5× the zoom anyone plays at. Fix centrally once the range
   rebalance settles the final camera distance, then re-verify any floor/prop work that
   was tuned at the old zoom.
4. **Feet below y=0, cast-wide.** Every character's lowest point is −0.08 to −0.25m,
   violating `types.ts` convention #1 ("feet at y=0"). Pre-existing, improved but not
   fixed by `footClearance`; several characters' custom foot geometry hangs a full
   segment below the ankle joint. Decide whether the RIG guarantees y=0 or characters do.

### THE POST CHAIN IS CLAMPING COLOUR — probably a project-wide quality cap

`stage.ts` runs `HueSaturationEffect({ saturation: 0.32 })`. A pixel probe returned
**`rgb(0, 161, 176)`** — red clamped to **zero** — from an albedo that had 47 red.

This is the mechanism behind the years-old "heavy orange grout" complaint: the joint kept
being authored warm-brown and kept arriving on screen as an orange stripe, so round after
round attacked the albedo when the post chain was eating the channel. **Any owner picking
a colour must currently author it well below the target saturation**, which means every
colour decision in this project has been made against a moving target.

It is also a strong candidate for the hazards element's cap ("every hue collided with a
genre meaning" — 6, 6.5, 6, 5, 6). If the chain cannot reproduce the hue that was
authored, hue semiotics were never really under the author's control.

**Lighting/post owner: verify and fix this first.** It plausibly outranks every other
lighting change. Note the art direction genuinely is hyper-saturated — the fix is a
saturation curve that does not clip channels, not simply turning saturation down.

### Critics can contradict each other into a standstill — use an objective test

The floor scored 4, 4, 4, 4 across four fresh critics while every named fix was
implemented faithfully. On grout contrast: r1 measured 2.5:1 and demanded ~1.2:1; r3, shown
1.15:1, called it *physically inverted* and demanded 2.5–3.3:1; r4, shown 2.0:1, demanded
1.25:1 again. Same reversal on lighting range and on value. **Each round implemented the
previous critic's fix and the next critic demanded its reverse.**

Fresh-critic-per-round prevents anchoring, which is why we do it — but it also means
nothing carries forward, so an element with no objective anchor can oscillate forever at
its noise floor. When a score sits flat for 3+ rounds with contradictory guidance, stop.
The element is not converging and more rounds will not help.

**The fix is a measurable acceptance test.** The floor's r4 critic supplied a good one,
gameplay-grounded rather than aesthetic: *composite a mid-value character silhouette on
the floor — the character's outline must be the darkest edge within a 200px radius.* That
single criterion would have settled all four contradictions. Give every element a test of
this kind before spending rounds on it.

### Two known measurement weaknesses

- **Inter-critic variance is real.** Two fresh critics scored comparable material 5 and
  4. Treat a single round's score as noisy; trust the trend across rounds.
- **Blindness is imperfect.** A critic who recognises Brawl Stars is identifying the
  reference by IP, not judging it on quality. Nothing fixes this fully — it is a reason
  to weight *named specific gaps* over the number.
