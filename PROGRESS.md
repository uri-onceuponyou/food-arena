# Food Fight Arena — Build Progress

> **SUPERSEDED IN PART.** `CLAUDE.md` is the entry point, `docs/STATE.md` has
> current state, and `docs/LESSONS.md` supersedes the trap lists below. This file is kept
> for its historical narrative and per-element score histories.


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
| **HUD** | `src/ui/hud.ts` | ✅ **Beat the shipped reference in a blind test** |
| **Characters — bodies** | `rig.ts`, `bodies.ts`, all 11 | ✅ four archetypes; silhouettes now read distinctly |
| **Viewport fairness** | `render/camera.ts` | ✅ 199.2wu guaranteed on every aspect, 0.00 spread |
| **Weapon ranges** | `game/rules.ts` | ✅ retuned; characters 8.1% → ~13% of frame, fairness kept |
| **Tile/prop textures** | `arena/textures.ts` | ✅ frequency bug fixed |
| Floor | `arena/floor.ts` | 🅿️ **PARKED by Uri** — see the lead above |
| Fog / safe zone | `game/match.ts`, `ui/hud.ts` | 🔴 **NO VISUAL AT ALL** — 50 HP/s, invisible. Being fixed |
| Cover props | `arena/props/*`, `shared.ts` | 🔴 grounding 63% z-occluded — scores 3,4,3,3,4 are **void**. Being fixed |
| Hazards | `arena/hazards.ts` | 🔴 rework never landed (ownership deadlock); shadows at world origin. Being fixed |
| Combat VFX | `game/vfx.ts`, `vfx/weapons/*` | ⚠️ pipeline healthy, but burst is 2× character height — gates Wave 3 |
| Lighting & post | `render/lighting.ts`, `stage.ts` | 5/10 — loop running on SSAO-is-a-no-op |
| Characters (heads) | `characters/<id>.ts` | not yet looped; scope is now head+torso only |

**Read this before spending a loop:** of the elements probed, **every plateau was a bug or
an ownership deadlock, not a taste gap** — consistent with 3-of-4 historically. Probe
first. A ~20k probe has repeatedly outperformed a ~300k critic loop, and the floor loop
spent 309k for a score that did not move at all.

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

**RESOLVED — and the answer differs by DECAL TYPE. Read which one before acting.**

There are two baked families and they had opposite verdicts. Conflating them is exactly
how this sat unresolved for months.

| family | measured | verdict |
|---|---|---|
| **CONTACT / AO rings** | 2.25 → **2.98/255 over ~10%** | **KEEP.** Removing them makes every pad-mounted prop float. |
| **CAST shadow ovals** | n=32, **0.127/255 over 0.75%** | **REMOVED.** The diff was five faint slivers, most under the prop that cast them. |

The old note read "the baked cast-shadow decals are probably a redundant third darkening
layer — test removing them", and for the CONTACT rings that guess was backwards. The
section below is about the CONTACT rings.

Retiring the CAST decals is also what **freed the key azimuth**, which had been pinned to
`SHADOW_DIR` so real and baked shadows would point the same way. The key then swung
38.08° → 16.0°, which measurably improved modelling (a barrel's terminator ramp +26%; the
shaded fraction of a visible vertical cylinder 19% → 38%) with no shadow-merge regression
— shadowed ground area went *down*, 8.16% → 7.28%. The contact rings got **stronger** as a
side effect, since nothing overdraws them any more.

**Two stale duplicates of the old azimuth remain**, both 22° out and neither drawing a
hard edge, so neither is visibly wrong yet: `arena/floor.ts` ~line 891 (parked — fix when
the floor resumes). `arena/apron.ts` was ALREADY FIXED — it reads `Math.hypot(16.35,
4.69)`, matching `lighting.ts:166` and `shared.ts:93`. **Only `floor.ts` remains.**

The decals sit at y = 0.017/0.019. Above them sit **opaque, depth-writing** planes —
`floor_woodpad`, `floor_utility_pad`, `floor_teal_zone`, `floor_border` at 0.045–0.048,
`floor_seam`/`floor_drain` at 0.062. Props are *deliberately placed on those pads*, so
their grounding shadow is drawn underneath an opaque plane and never reaches the screen.
Measured: only **~37% of contact-decal area is visible; 63% is z-occluded.** At shipped
framing the spice cart and stacked pots standing on teal mats have **zero** shadow.

So the "mushy directionless blob" that regressed lighting to 3/10 was the ~37% that leaks
onto **bare tile**, un-anchored to the props standing on pads. Deleting the decals would
have removed the main grounding cue and made it worse. The fix is two constants — raise
the decals above the pad layer.

**Every cover-props score (3,4,3,3,4) was measured on props with most of their grounding
invisible. Those verdicts are void.** Re-baseline after the fix.

The general lesson is the one this project keeps re-learning: a plausible explanation that
nobody has actually tested will sit in a doc for months and get briefed to agents as fact.

---

## THE PATTERN THAT KEEPS COSTING TIME

**When a critic says "X isn't there", check whether X is rendering and INVISIBLE before
concluding it is missing.** True cause NINE separate times:

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
7. **Prop grounding shadows buried under opaque floor pads.** Decals at y=0.017/0.019,
   opaque depth-writing pads at 0.045–0.062, and props deliberately stand ON the pads —
   63% of the shadow area never reaches the screen. This is instance #2 recurring at a
   different height, which is why it is worth checking the WHOLE ground-layer stack, not
   just the one surface you changed.
8. **Both puddles' contact shadows rendered at world origin.** `buildContactShadow` was
   added to a group that is never positioned, while the disc/surface/rim set absolute
   world coords internally — so two 6.75m shadows stacked in the map's SW corner and the
   actual puddles had none.
9. **A slow-effect ring in the same cyan as the puddle it sits on.** Rendering correctly,
   perfectly invisible — the dark-on-dark failure (#3) in a different colour.

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

### Character on-screen size: ~10.5% of frame height (settled)

Two agents disagreed and BOTH were wrong, in opposite directions. Measured directly off a
clean 1600x900 live-game frame: the hamburger spans ~95px ≈ **10.5%**, inside the 10-13%
reference band. So the framing after the range rebalance is fine — no further camera or
range change is needed on these grounds.

- **13% was too high.** It came from `characterHeight / frameHeightAtThatDistance`, which
  ignores that the camera is pitched 58°. A vertical object is foreshortened.
- **7% was too low.** It applied the full foreshortening factor (sin 32° ≈ 0.53), which is
  right for a thin vertical stick and wrong for a chibi — the head is a sphere and barely
  foreshortens at all.

**Measure this off a rendered frame, not by trigonometry.** Both analytic attempts failed
because the shape of the subject decides the answer. And beware: it could not be measured
at all until the countdown overlay bug below was fixed.

### The HUD countdown was covering the player — and corrupting every VFX measurement

`.hud-countdown` used `inset: 0` with `align-items: center`. The camera keeps the player at
frame centre, so a 140px opaque numeral — 15% of frame height — sat **directly on the
player** for the whole pre-match countdown.

Worse, VFX probes are captured at `simSpeed`≈0 where the countdown never advances, so a
giant orange "5" was composited over the subject of **every VFX measurement in the
project**. One agent mis-read it as a character head. Now positioned at 22vh, clearing both
the top status bar and the character mass.

### MEASURE AGAINST A FROZEN SNAPSHOT — never the shared dev server

Single-owner file sets stop agents CLOBBERING each other. They do nothing about
**measurement**, because any render of this game includes the whole tree — so every probe
run against the shared dev server also includes every peer's half-finished edits.

That one cause has now produced, in different costumes:
- a whole-arena scan silently contaminated by ~40 concurrent saves to `floor.ts`
- `menu_accept` failing with "execution context destroyed" and being reported as a
  regression when it was a peer's save reloading the page mid-run
- one agent's syntax error 500ing the dev server for **every** agent at once
- probes reading a `window.__stage` that a peer's screen had already disposed
- an agent chasing a phantom gate failure all the way to `git stash`

**`tools/snapshot.mjs` is the fix. Use it for anything you will report a number from.**

```bash
node tools/snapshot.mjs --json      # -> {"url": "http://localhost:PORT", ...}
node tools/arena-scan.mjs --url $URL --out shots/scan/x
node tools/perf.mjs --mode counts --url $URL
PREVIEW_BASE=$URL node tools/tmp/menu_accept.mjs
```

It copies the tree to a temp dir, **symlinks** `node_modules` (no install, no 200MB copy),
and serves on an OS-assigned free port — so two agents cannot collide on a guessed port
either. Verified frozen: a file created after the snapshot starts is served by `:5173` and
is invisible to the snapshot.

**`--swap <path>` is the controlled-A/B mode**: everything frozen except the named file,
symlinked back to the live tree, so exactly ONE thing moves. That is the experiment that
proved "desaturate the environment" was the wrong instruction — it needs a stationary
background to be meaningful at all.

Rule of thumb: **edit on the shared tree, measure on a snapshot.** The shared `:5173` is
fine for a quick look; it is not fit for anything you will quote.

### NEVER `git stash` during a multi-agent session

An agent hit an apparently-failing gate, ran `git stash` to test whether it was
pre-existing, and momentarily reverted **two other agents' uncommitted in-flight work**.
It restored everything within ~2 minutes and nothing was permanently lost, but the blast
radius of that command is the entire repo, and the failure it was chasing was a phantom
(see below). To test whether something is pre-existing, use `git stash push -- <specific
files>`, a scratch worktree, or just ask the coordinator.

### A "failing gate" during a multi-agent session is probably the HMR race

`tools/aspect.mjs` reported `window.__fairView is not a function`. It was NOT a
regression — re-running it after the fact passes with 0.00wu spread. Another agent's save
triggers a Vite full reload, and any probe that reads in-page state mid-flight sees it
briefly undefined.

**Cost of not knowing this:** one agent lost three probe sweeps to it, and another chased
the phantom all the way to `git stash`. Before reporting a gate as broken, re-run it once
the repo is quiet.

### Probes during a multi-agent session must stub Vite's HMR client

Any Playwright probe that holds in-page state across steps will be wiped mid-run: every
save by another agent triggers a full page reload. One agent lost three sweeps before
working this out. `tools/tmp/rake.mjs` shows the pattern.

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

### 🅿️ FLOOR IS PARKED until Uri returns (2026-08-04) — with a strong lead

Uri: *"Re. Floor — we were at 6. We are missing something there."* Correct, and the score
history says where it went. **Do not run a floor loop until this hypothesis is tested.**

| loop | round | score | what changed |
|---|---|---|---|
| 1 | r1 | 4 | tile 100→40wu, wear zones |
| 1 | r2 | 3 | grout-crevice AO grid |
| 1 | **r3** | **6 ← peak** | **per-tile tonal noise via instanced vertex colour: macro sine "AO patch" + micro jitter** |
| 1 | r4 | 3.5–4 | *same idea pushed harder* (noise 0.22→0.32), splatter snapped to grid |
| 1 | r5 | 4.5 | within-tile pebble speckle |
| 2 | r1–r4 | 4,4,4,4 | value/sat re-key, MID-band + aliasing removal |

**Hypothesis: the 6 was LOW-BAND macro tonal variation at moderate strength, and r4
overshot it.** Every later round then spent itself on sub-tile detail.

This fits the independently-discovered zoom finding exactly: at shipped framing the
low-frequency gradient is *the only thing that carries the floor*, and tile bevels, grain
and jitter vanish. r3 accidentally found the right band; r4 pushed the right band too far
and was scored down for it; loop 2 then optimised bands that do not survive at all.

**Test tomorrow:** restore r3's macro variation at its ORIGINAL strength (0.22, not 0.32),
keep loop 2's value/saturation re-key and its aliasing/MID-band fixes, and judge at
`SHIPPED_SPAN` — which no floor round has ever been judged at. Use an objective
acceptance test, not aesthetic critique: composite a mid-value character silhouette; its
outline must be the darkest edge within a 200px radius.

r3's exact diff is recoverable from git history — find it before re-deriving it by hand.

### ~~THE POST CHAIN IS CLAMPING COLOUR~~ — SUPERSEDED, see below

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

### THE COLOUR GRADE WAS DESTROYING A FIFTH OF THE FRAME — found, retracted, re-confirmed

**Status: real, fixed.** This finding was reported, then wrongly retracted by me, then
confirmed with a much stronger measurement. The retraction happened because the probe
that "disproved" it was taken with the lighting agent's in-flight FIX already in the tree.
I noted that caveat at the time and under-weighted it. **Do not re-litigate this.**

Measured with unlit `MeshBasicMaterial` swatches, so the pixel entering the composer IS
the authored colour and lighting is out of the equation:

| authored | before | after |
|---|---|---|
| `freezerDoor` #2E88AC (46,136,172) | **(0,140,200)** | (4,145,204) |
| `steel` #184F6E (24,79,110) | **(0,68,119)** | (2,68,117) |
| `cabinet` #C1731E (193,115,30) | (233,99,**0**) hue −5.8° | (220,109,2) hue −1.8° |
| `tileLight` #EAD3A8 (234,211,168) | (**255**,232,149) | (250,221,148) |

**8 of 12 palette colours lost a channel outright, and all 8 arrived at HSV saturation
exactly 1.00** — an authored range of 0.56–0.89 collapsing onto a single value. Saturation
had stopped being a dimension the palette could use at all. Across the whole frame: 9.39%
of pixels with a channel pinned at 0, 10.60% pinned at 255.

**Mechanism**, verified by dumping the generated `EffectPass` shader rather than inferred:
`HueSaturationEffect` extrapolates each channel away from the arithmetic mean of **linear**
RGB, and `postprocessing` runs it in linear light — the sRGB transfer is only inserted
later, for contrast. In linear the mean is dominated by the brightest channel, so the
dimmest goes negative at gain 1/(1.001−0.32)=1.47×, and nothing clamps in between
(HalfFloat, one shader), so the negative survives to the framebuffer write.
`BrightnessContrastEffect` compounded it: 1.22× about 0.5 in sRGB sends anything below
23/255 to black and above 232/255 to white.

Replaced by `ToyGradeEffect` (sRGB space, saturation about Rec.709 luma, per-pixel soft
knee at the gain where the first channel would reach a bound). **0/12 clipped, max hue
error 3.9°.** Saturation was NOT reduced — measured on-screen mean HSV saturation rose
0.503 → 0.515.

#### THE CONSTRAINT EVERY COLOUR AUTHOR NOW WORKS TO
**Author the colour you actually want. Stop pre-compensating.** Hue arrives within ~4°,
saturation is monotone in what you author, and the destruction threshold moved from
**~47/255 down to ~10/255** (authored channels ≥12 survive; ≤8 still round to 0). Expect
roughly +0.1 HSV saturation and essentially unchanged hue and value on screen.

**Anything colour-tuned before this fix was tuned against a distortion and should be
re-measured** — including the hazard palette, `KPAL.butcherBlock`/`cabinet` (~15% too hot
in red: 5.94% of frame at R≥253 vs 0.27% in reference), and every "heavy orange grout"
verdict. That complaint was never an albedo problem.

### SSAO was contributing EXACTLY ZERO, at every framing, for the whole project

A/B with the effect's blend skipped: **mean 0.0000/255, max 0, 0.00% of pixels** — in the
live match, the character preview *and* the arena preview. One knob:
`worldProximityThreshold: 0.5` rejects any tap whose linear-depth difference from the
centre exceeds it, and on a 58°-pitched ground plane under a 300m far plane every tap
exceeds 0.5m.

**So every score this element ever received was a score without AO**, and the rounds that
"pulled the radius back to fine-seam duty" (0.16→0.11→0.07) were tuning a dead pass.
Revived it produces broad low-frequency floor dimming rather than contact seams (a
character is ~70px tall at shipped framing) — precisely the third darkening layer that
scored 3/10. Now off by default, kept behind `ao: true` with the dead knob repaired.

### Three things all three lighting critics agreed on — none fixable in `lighting.ts`

1. **Hero and floor share a hue family** (warm orange on warm terracotta), so hue does no
   separation work. Both references solve this at the CHARACTER level, not globally.
   → `floor.ts` / character owners.
2. **Large flat surfaces have no internal gradient and physically cannot.** Measured
   p90−p10 across the big apron quad: **0.003**. One normal, directional light, constant
   output. The barrel's *curved* skirt by contrast ramps 0.276→0.323. Two of three critics
   spent their #1 fix on this. It needs baked gradient/AO in the albedo.
3. **Red is railed on the warm props** — safe to fix now the grade no longer distorts it.

### An INVALID critic round already drove real work — check the control BEFORE acting

The apron's round 1 scored the reference plates **6, 6, 5** — below the ~7–9 valid band,
so by this file's own rule that round should have been **discarded**. It was not. It drove
**the two largest rewrites** the apron received.

The rule is only worth having if the control is checked *before* the fix is implemented,
not afterwards when reconciling scores. Read the reference-side score first; if it is out
of band, stop and re-run rather than acting on the critique.

Related, from the same report: **do not take a critic's stated mechanism at face value.**
The apron's final critic scored 4/10 with three reasons, and two failed verification —
"props float over dark violet nothing" was measurably false (100% apron coverage of that
quadrant, floor present at luma 34.7/255; the fog canopy had crushed it). That is the
"rendering but invisible" trap **in reverse**: a critic reporting absence where there is
presence. The third reason was real and was kept.

### An agent's LAST MESSAGE is not its state — check the tree

I twice recorded work as unfinished based on where an agent said it was when stopped, and
was twice wrong:
- "sushi had just started" — it was already 1,147 complete lines.
- "the reticle is still unfinished" — a finished, measurement-driven reticle had landed.

An agent narrates the step it is *beginning*, and often completes several more before the
stop takes effect. **Before writing a resume note, look at the diff and the line counts.**
A stale note costs a whole re-dispatch, and worse, invites an agent to rebuild something
that already works.

### "Spawned inside the target" has a HEIGHT variant, not just a size one

Sushi's blade was **correctly sized** — 2.74m, well clear of any fighter — but spawned at
`IMPACT_HEIGHT` 1.15m, the middle of a fighter's mass, and its geometry is a **lens**:
thin at the ends, widest in the middle. The target ate the middle third, so one continuous
knife stroke rendered as two disconnected shards.

Every earlier instance of this bug was a size error, so a scale-focused review passes right
over it. **Check WHERE an effect spawns relative to the body, not only how big it is** —
and note that a shape whose mass is concentrated where the occluder sits fails worse than
a uniform one.

### Lint a language by PARSING it, not by pattern-matching it

The CSS-backtick guard was a regex. Widening it to cover `innerHTML` immediately
false-positived on legitimate nested template literals — and a lint that cries wolf gets
ignored, which is worse than no lint. The hole and the fix were the same mistake. It is
now a parser that catches **every** syntax error across all 88 modules in ~95ms. Cheapest
possible defence against 500ing the shared dev server, which this project has done to
itself three times.

### SCORE THE REFERENCE AS A CONTROL — the instrument is not stable

The menu loop caught something that reframes every score in this file. Critics see a blind
A/B packet: our work against real shipped reference plates. **They also score the reference
side.** Across three fresh critics on the *same reference library*:

| critic | score it gave the REFERENCE |
|---|---|
| menu round 1 | 8–9/10 |
| menu round 2 (home) | 8–9/10 |
| menu round 2 (character select) | **4/10 and 5/10** |

**A four-point spread on the control.** That critic also ranked our menu *above* the
shipped reference. Nothing about the reference changed; only the judge did.

**So a round where the reference scores outside ~7–9 is measuring the critic, not the
work, and must be discarded rather than acted on.** Record the reference-side score every
round and treat it as a calibration check. This is cheap — the critic already produces it.

This probably explains a good share of the oscillation documented above, and it means
single-round scores anywhere in this file should be read as noisy. Trust: (1) named,
specific, reproducible gaps, (2) objective acceptance tests, (3) trends across rounds —
in that order. The bare number is the weakest signal we have.

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
