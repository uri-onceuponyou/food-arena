# Food Fight Arena — Build Progress

Real-time 3D brawler in Three.js. Rebuilding the execution of the 2D prototype at the
quality bar of **Brawl Stars** and **Zooba**, with the game design held fixed.

**Read this file and `git log` before doing anything else in a new session.**
Resume where this says you left off. Never redo a piece already marked critic-approved.

---

## Ground rules

- **Design is frozen.** `src/game/rules.ts` is the single source of truth, transcribed
  verbatim from `reference/prototypes/kitchen-gameplay-prototype.html`. Damage, cooldowns,
  ranges, speeds, status durations and match structure must not be "improved".
- **The arena is the one sanctioned exception** — the brief explicitly opened up layout,
  prop count and scale, as long as the gameplay *types* survive (central hazard, physical
  cover with collision, at least one slowing hazard).
- **Character identity is fixed** (which food, which rarity, what each ability does).
  The 2D face descriptions are a personality guide, not a literal spec — silhouette
  readability against the bar wins when the two conflict.
- **Every piece is judged on rendered pixels**, never on a description. Critics receive a
  blind A/B sheet against real reference imagery and must call which is better.
- **Commit atomically**: one commit per builder round + critic verdict. Message names the
  piece, round number, and verdict. Update this file in the same commit.

## Verdict vocabulary

- `not started`
- `round N — building`
- `round N — REJECTED: <the single biggest gap>`
- `round N — APPROVED` (critic picked ours, or called it a genuine tie, in a blind test)

---

## Foundation

| Piece | Status | Notes |
|---|---|---|
| F1 · Project scaffold | ✅ done | Vite + TS + Three 0.180, typecheck clean |
| F2 · Frozen design spec | ✅ done | `src/game/rules.ts` — all 11 characters, all weapons |
| F3 · Render core | ✅ done (unjudged) | toon ramps, inverted-hull outline, 3-point rig, AgX + bloom + SMAA |
| F4 · Preview harness | ✅ done | `preview.html` — isolated, deterministic (`?t=`), `__previewReady` |
| F5 · Screenshot pipeline | ✅ done | `tools/shoot.mjs` — headless WebGL verified rendering real pixels |
| F6 · Blind A/B compositor | ✅ done | `tools/compare.mjs` — shuffles ours/ref into A/B, key written separately |
| F7 · Reference imagery | ⬜ not started | Real Brawl Stars / Zooba stills for critics |
| F8 · Live progress page | ⬜ not started | `progress.html`, checkable from phone |

## Pieces

Order matters: **Hamburger is built first and becomes the art bible.** Locking one
character's style before parallelising prevents 11 agents producing 11 different games.

| # | Piece | Status |
|---|---|---|
| P0 | Art direction lock (via Hamburger) | ⬜ not started |
| P1 | Hamburger — model / rig / anim | ⬜ not started |
| P2 | Donut | ⬜ not started |
| P3 | Taco | ⬜ not started |
| P4 | Burrito | ⬜ not started |
| P5 | Egg | ⬜ not started |
| P6 | Lollipop | ⬜ not started |
| P7 | Pizza | ⬜ not started |
| P8 | Sushi | ⬜ not started |
| P9 | Soup | ⬜ not started |
| P10 | Water Bottle | ⬜ not started |
| P11 | Hot Dog | ⬜ not started |
| P12 | Kitchen arena — environment art | ⬜ not started |
| P13 | VFX — projectiles, melee arcs, splats, trails, giant slam | ⬜ not started |
| P14 | Camera + game feel / juice | ⬜ not started |
| P15 | HUD + menus (DOM/CSS over canvas) | ⬜ not started |
| P16 | Gameplay integration — frozen rules, AI, match flow | ⬜ not started |

---

## Currently active

**F7 · Reference imagery** — pulling real Brawl Stars / Zooba stills so critics have a bar
to judge against. Nothing can be meaningfully critiqued until this exists.

## Log

- Foundation F1–F6 landed. Headless WebGL screenshot verified against a placeholder model;
  fixed two real defects found by looking at the output: the inverted-hull outline never
  expanded (`objectNormal` is undefined in `MeshBasicMaterial`'s shader — replaced with a
  dedicated ShaderMaterial), and preview framing applied gameplay ground-plane pitch
  compensation to a standing subject, shrinking it to a speck.
