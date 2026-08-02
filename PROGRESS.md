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

### Characters — 10 of 11 modelled
| Character | State | Note |
|---|---|---|
| Hamburger | 🔄 porting to rig | Richest food mass in the cast; last one off the shared rig |
| Donut | ✅ | Reference implementation; dressed torso |
| Taco | ✅ | Two-panel V-fold shell (a flat panel vanished edge-on) |
| Burrito | ✅ | |
| Egg | ✅ | Torso built from the same `eggSurface` math as the head |
| Lollipop | ✅ | |
| Pizza | ✅ | Extruded wedge, crust rim hugging the dough's own boundary |
| Sushi | ✅ | |
| Soup | ⬜ **STILL A STUB** | Only remaining plain-sphere placeholder |
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

## Next actions, in priority order

1. **Fix the AI axis-lock** (below) — it is the biggest thing between this and "fun".
2. **Play it and judge feel** — a human at a real 60fps browser, not SwiftShader.
3. **Ability VFX** — the sim already emits `weapon-fired`, `projectile-spawned`,
   `hit-landed`, `splat-created`, `trail-mark-created`, `death`. Subscribe to those; the
   sim must stay renderer-agnostic.
4. **Game feel** — hit stop, screen shake (`rig.shake()` exists), damage numbers, death
   effects. The reference's VFX are drawn bigger and brighter than the characters.
5. **Independent critic pass** on the finished cast and the running game, via
   `tools/review.mjs`. Report the real verdict, including losses.

## Known issues

- **AI axis-lock (gameplay bug, real).** The arena places spice-cart props exactly on
  `y = CENTER.y`, which is also both spawn y-coordinates. `ai.ts`/`movement.ts` chase in a
  straight line with no pathfinding, so when both fighters share a y the AI presses into
  the box forever: `tryMove` blocks x, and dy is exactly 0 so there is nothing to slide
  along. Diagonal approach routes around it. Fix by moving those props off the spawn
  line, or by giving the AI a slide/juke when blocked.
- **AI picks the highest-damage usable weapon and nothing else** — no kiting or
  positioning, so it reads as a wall rather than an opponent. Faithful to the prototype,
  but worth improving now that deviation is authorised.
- Countdown digits render very large over the player and briefly obscure them.

- `ChibiRig.headCentreY` assumes a head mass extending ~±R about its origin. Non-spherical
  masses float or sink (Hot Dog's floated 0.33m). Hot Dog uses a hidden connector.
- The rig torso is proportionally large for narrow characters (Water Bottle), reading
  blob-ish from side/back. Would need per-character torso scaling on the rig.
- `donut.ts`, `pizza.ts`, `egg.ts` carry local `dressTorso` copies from when the rig
  helper didn't exist. It exists now — they could be de-duplicated.
- Blindness in the A/B test is imperfect: a critic that recognises Brawl Stars identifies
  the reference by IP, not by quality. The critiques are still specific and actionable.
