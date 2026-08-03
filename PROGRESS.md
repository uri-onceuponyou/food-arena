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

### Element scoreboard

| Element | Owner files | Status |
|---|---|---|
| **HUD** | `src/ui/hud.ts` | ✅ **Beat the shipped reference in a blind test** — critic scored the shipped side 5/10 and ours higher |
| Lighting & post | `src/render/lighting.ts`, `stage.ts` | 5/10 after 5 rounds, capped |
| Combat VFX | `src/game/vfx.ts` | loop running |
| Arena (whole) | `src/arena/*` | 4/10 — being split into per-element modules |
| Characters (whole) | `src/characters/*` | **PARKED at 4/10** — do not resume unless asked |

### Score histories

**Arena (whole):** 2/10 (unfair test — my error: empty arena, cropped, no characters) →
7/10 self-scored (untested) → **3/10** first fair test → 4 → 5 → 4 → 4. Plateaued.

**Characters (whole):** 3 → 4 → 4 → 4 → 4. Parked. What moved it: changing limb
TOPOLOGY and where the FACE LIVES. What didn't: colour and proportion changes. A
full-body-reference experiment was run to test whether the plateau was a framing
artifact — **no score change**, so it was parked, not adopted.

### Arena element loops — queued, blocked on the split

`kitchen.ts` (2,495 lines) is being split into `props/counters.ts`, `props/storage.ts`,
`props/smallProps.ts`, `floor.ts`, `hazards.ts`, `ambient.ts`, `shared.ts`. The split
must be **behaviour-preserving**, proven by a numeric per-pixel diff of before/after
renders (deterministic: frozen `t`, seeded texture LCG).

Once landed, fan out one agent per module. Isolate a single prop with
`preview.html?piece=prop&kind=<kind>` — gameplay pitch, character beside it for scale.
Kinds: `stove_island prep_counter sink_counter fryer_counter freezer supply_barrel
produce_crate_tall herb_crate flour_sacks stacked_pots spice_cart`.

**Known cross-element conflict to resolve there:** `kitchen.ts` bakes its own soft radial
cast-shadow decal under every prop. The lighting loop REGRESSED to 3/10 in one round
because widening SSAO stacked a third soft darkening layer on top of that decal AND the
real shadow map — a critic read the mush as one directionless blob. Now that real shadows
are crisp, those decals are likely redundant and harmful. **Test removing them.** This is
exactly what the whole-arena scan exists to catch: element owners optimising locally can
fight each other.

---

## THE PATTERN THAT KEEPS COSTING TIME

**When a critic says "X isn't there", check whether X is rendering and INVISIBLE before
concluding it is missing.** True cause three separate times:

1. Sesame seeds placed at a mesh's front landed on its hidden back face — the mesh is
   flipped 180° about X, which negates Z.
2. Contact-shadow decals rendered at y=0.011 while floor tiles' top faces sit at y=0.015
   — buried inside the floor, visible only through grout gaps.
3. The HUD cooldown wipe was dark-on-dark against a dark card. Three critics reported
   "no visible cooldown" across three rounds before it was root-caused.

Related: arena textures were wired correctly and still invisible, because ±5–10% value
swings get crushed once multiplied against dark saturated bases and pushed through the
contrast pass. Needed 0.5–0.6 depth.

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

- `src/game/rules.ts` is the frozen design. Import every gameplay constant; never
  hardcode one. Uri later authorised deviating *where it demonstrably raises quality* —
  deviations must be deliberate and recorded in the commit message.
- **Judge rendered pixels, never descriptions.** Render it, Read the PNG, look.
- `reference/prototypes/` and `reference/images/` are gitignored and must never be
  published. Prototypes were stripped from all history, which also removed a Supabase key
  that had been committed inside `multiplayer-position-test.html`.
- Verify before committing: `tsc` clean AND sim 51/51. I once pushed a broken tree by
  letting `git add -A` sweep in a file an agent was mid-edit on.

## Next actions

1. Land the arena split (behaviour-preserving, per-pixel diff proven).
2. Fan out one agent per arena module, each looping to 7/10.
3. Wire the periodic whole-arena scanner as the real scoreboard — element scores will
   read higher than the whole, because a critic judging one barrel isn't weighing
   composition or density. Optimising the easier metric is the risk to avoid.
4. Resolve the authored-shadow-decal vs real-shadow conflict.
5. Nobody has played a full match at real framerate and judged how it FEELS.
