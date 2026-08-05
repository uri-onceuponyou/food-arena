# State — what is done, what is pending

**As of commit `b967242`, 125 commits into an unattended session.** Every commit verified with
`tools/verify-head.mjs` before push. Working tree clean.

Judgement calls live in **`docs/DECISIONS-FOR-URI.md`** — read that first if you are Uri; it opens
with a one-screen answer sheet. **New session? Read `CLAUDE.md`, then this file, then
`docs/LESSONS.md`.**

---

# PART 0 — where the game actually stands

**For the first time, the score can be trusted.** The blind-critic instrument was audited and rebuilt:
a canonical rubric (`tools/review.rubric.txt`), top-down plates for gameplay, action frames rather
than idle ones, menus scored against menus, and a **measured resolution floor of ±1.4 points**.
43 rounds, 43 valid.

| element | ours | sd | reference | gap in **floors** |
|---|---|---|---|---|
| **cast in match** | **4.33** | 0.52 | 8.00 | **6.5** |
| arena (action frame) | 5.17 | 0.41 | 8.33 | 5.6 |
| home | 5.17 | 0.41 | 8.50 | 5.9 |
| in-match HUD | 5.67 | 0.52 | 8.33 | 4.6 |
| character select | 7.00 | *n=1* | 8.00 | not a result |

**The bar is 7+.** Calibration: over 34 observations the critic **never scores shipped Brawl Stars
above 9**, typically 8–8.5 — so 7+ sits ~1–1.5 below shipped Brawl Stars. The bar is well placed.

⚠️ **Do not splice these onto the old series** (arena 5.33/4.0/3.875/6.0, characters 3.6/3.25/3.0/2.0).
Different rubric, plates, frame content and n. And note what the audit proved about that old series:
**its largest single step was 1.0 — inside the floor. "The characters got worse" was never an
observation.**

## The one finding that dominates

**"Surfaces are flat and unlit — no material variation, no contact shadow, no depth."**
**6/6** critics on HUD, **6/6** home, **5/6** select, **4/6** arena. Two said it unprompted:

> *"the playfield looks like coloured paper **while the HUD looks shipped**"*

Our best element was being marked down for the surfaces behind it. **This is the #1 item**, and it
has measured leads already in hand — see PART 2.

---

# PART 1 — DONE

## Gameplay

- **All six 🔴 bugs** fixed (the clock ended nothing · trail marks stacked an 87 HP one-frame kill ·
  melee at distance 0 ignored facing · a fighter inside the pot was 0.0% visible · the radar showed
  no zone · match duration ~7× too long).
- **Five AI driver bugs**, every one the same shape — *a rule stated once in `rules.ts` and
  implemented differently elsewhere*: a stun silenced the AI (11/11 characters — the stunned player
  fired 100% of its shots, the stunned AI 0%); both drivers ranked weapons by authored `damage`
  (which is per-*pellet*); a melee-only AI had nothing to fire when fleeing; the flee branch aimed
  **away** from the player and fired along it (8 of 11 dealt literally zero); and the terrain slow is
  applied to the player only — **the AI crosses every puddle at full speed** (0.450000 vs 1.000000;
  *parked* — fixing it regresses settled 17→19).
- **Levels 1–15**, +5%/level of HP and damage (1.70× each = 2.89× effective). **Level 1 is
  bit-identical to the pre-levels build**, proven tick-for-tick. The AI mirrors the player's level:
  win rate drifts **1.9 pp across L1→L15**; with the enemy pinned at L1 it would be **99.4%** by L15.
- **The roster has a second axis.** Per-character health and speed are simulated (they were card
  fiction). **Settled matchups 70 → 22 → 17 of 110.** Rarity is **not** power — tier spread
  **3.98 pp** against a ~9 pp floor — and costs nothing extra to level (§26). Speed measured as a
  **nearly inert lever**; every point of the result is health.
- **Pacing.** Countdown 5.68 → 3.68 s with **zero** win-rate change, proven: 3,520 matches
  bit-identical. `MATCH_DURATION_MS` and the fog schedule were both **falsified** as pacing levers.
- **Touch is sound and closeable** — 36/36 distinct bearings, worst error 0.27°, reversal spread 0.
  Two real defects fixed: a second finger in the same zone killed the stick, and **83.3% of the
  bottom 38% of a portrait frame was dead to touch, with the control hints drawn on it**.
- **Session continuity.** The URL now names the screen and reloads land there. A restored WebGL
  context was rendering **15.65 luma darker, permanently** (a dead PMREM env map plus a shadow map
  that never redraws). One bad screen constructor used to kill the router permanently.

## Presentation

- **Cast:** dark rung (p05 0.273 → 0.157; 11/11 pass `range`/`p05`/`steps10`), silhouette (hull
  deficiency 0.1379 → **0.2621**, the reference median; appendages 0.5 → 3.0; **11/11** clear the
  floor, from 1/11), near-white clipping **0.1007 → 0.0275** against a reference median of 0.0249.
- **Arena:** brightness (nothing railed it; frame luma 0.322 → 0.402), edge grammar (the reference
  marks a ground seam with a **dark band, never a bright line** — we had it inverted), contact
  grounding (share past the 0.06 threshold 16.9% → 35.6%), stains (they had **no dark core at all** —
  a bright ring around nothing).
- **Lighting:** the key light's **azimuth sign** was throwing every shadow behind its own object.
  Contact ΔL 0.0353 → **0.1242**. Figure/ground *paid* rather than cost: cast minimum −0.0014 →
  **+0.0593**, gate failures 3 → 0.
- **HUD:** 20 WCAG failures → 0, min ratio 1.89 → 6.48. Eight defects, all bugs — including a
  `.hud-zone.is-danger` state authored and selected by nothing, and damage numbers erasing the clock.
- **VFX:** the trail was **0.7° of hue from the floor and 1.0° from the cast** — the critic's phrase
  was literal. Now 22.4°, with cast figure/ground +5.1%.
- **Audio:** the top three octaves did not exist (tilt −5.57 dB/oct, 86.2% of energy below 1 kHz).
  Now −5.07, duty cycle **21.9% → 58.6%**, plus a kitchen ambience bed. `generic.hurt()` alone was
  holding the game darker than the other fifteen sounds combined.
- **Menus:** key rebinding (35 assertions read off **sim state**), the levels UI, and three more
  "shows a number the model does not compute" defects.

## The instruments — the session's real output

**Nineteen instruments were caught returning confident wrong answers.** Each is fixed and validated
against a known-bad input. The most consequential:

| instrument | what it was doing |
|---|---|
| **the blind critic** | **±1.4-point floor; a round's two panels are n=1, not n=2.** The rubric alone is worth 2.0 points and there was no canonical one. |
| `scripted_player.mjs` | **`bestWeapon` skips `'self'` — the measurement cannot press heal.** Worth **50.6 pp** on Hamburger. ⚠️ **The roster was balanced twice against this.** |
| `feel_probe.diff()` | saturated: a fog hit (flash only) read 3904 px; a weapon hit (flash **plus the whole burst**) read 3879. The burst's real range is **6.31×**, not 1.66×. |
| `valuescan --mode gate` | served **stale JSON off disk** — reported 0/11 passing where HEAD is 11/11, and named the **wrong characters**. |
| one stale driver | copied into **ten** tools; a fourteenth born mid-audit. `roster_table`'s aggregate moved 0.8 pp while **58 of 110 matchups moved, max 34.4 pp**. |
| `arena-scan` | ignored `PREVIEW_BASE`, silently measuring whatever was on port 5187. Three rails also disagreed with their own HUD-free twins. |
| `hud_fit` harness | missing `box-sizing`, so it reported "0 px overflow" against a real 15.1 px — **and `hud.ts` cited that number in a source comment as proof.** |
| `driver_guard` | its coverage **shrank** when a bug was fixed (49 → 41), because its census keyed off the bug's own fingerprint. |
| `limbcheck` | measured **22°** and a pose the player never sees; the match camera is **58°**. Reported 9/11 passing on a cast where 10/11 failed. |

---

# PART 2 — PENDING, ranked

## 🔴 1. Flat, unlit surfaces — the #1 defect, with measured leads

Named by 6/6 critics on three elements. **Three leads already priced, none spent:**

- **Raise `src/arena/`'s baked contact decal ~2.5×.** It sits at |dL| **0.0491** against a **0.1238**
  reference measured off real barrels. **Beats a whole SSAO pass, for zero draw calls.**
- **SSAO works** (contact −0.0273, +1 value step, acne solved by `bias 0.20` + intensity 1.5) but
  costs **+314 draw calls / +79% triangles** — a second geometry pass. `TierProfile` has no `ao` field.
- **`glossyMat` has no rim at all** — 18 materials, the only surfaces in the game with zero edge
  response. One line, but it lands on the four characters whose clipping was hardest won; gate it on
  a per-character `clipShare` run.

⚠️ Two facts to carry: **53% of the cast is authored at roughness ≥0.6**, where specular headroom has
already collapsed 10×; and **`material.envMapIntensity` is silently discarded** — three.js overwrites
it with `scene.environmentIntensity` for any material using `scene.environment`.

## 🔴 2. The scripted player cannot heal — fix it, then rebalance

One line in `tools/tmp/scripted_player.mjs`. Worth settled **17 → 14**. ⚠️ **But it makes Hamburger
the strongest character by 14 pp and blows the rarity guard from 3.98 to 16.56 pp.** The sequence,
from the agent that found it: **land it, re-measure, *then* decide what Hamburger should be** —
reading tier spread every iteration, because on this character it binds before win rate does.
`bestWeapon` **also** still ranks by authored `damage` (wrong for Taco and Burrito at 5 of 8 bands).

## 🟠 3. Kitchen concealment — approved by Uri, unstarted

**§18, and five critics deep** — each independently ranking cover density their #1 arena fix. We are
at 17–20% of frame against a reference 35–45%. Uri: *"add bushes — but make it relevant to kitchen.
For example plates you can hide under."* Solid props cannot deliver it (the collision was carefully
tuned); **walk-through concealment adds screen area without adding collision.** It is a sim mechanic
plus AI awareness plus props. **The largest single item waiting.**

## 🟠 4. Live character findings the fixed gate exposed

`weakBoundaryPct` fails **5 of 11** — and **pizza 22.0 → 41.0** and **waterbottle 22.9 → 53.9** got
*worse* while the gate was frozen. `dlBelow10` fails **lollipop (11 of 18)** and **sushi (6 of 18)**;
the stale gate had named hotdog. The dl table is **171 of 198 rows** — re-run to close it.

## 🟡 Known, not started

- **Seven weapon files carry a stale copy of the generic size curve**, each documenting it as matching
  `game/vfx.ts` — a claim the re-derivation invalidated. **Soup's three impact hooks read `ctx.damage`
  nowhere (1.00×).** Needs per-weapon floors first, or small weapons drop under the ~300 px floor.
- **`limbcheck.mjs` and `limbcheck_pitch.mjs` are 93.3% identical**, while the latter's header claims
  byte-identity so *"any delta is PITCH"*. **Every 22°-vs-58° comparison rests on that claim.**
- `perf_tier.mjs` should be `perf.mjs --query`; the clone-census budget is a holding action.
- Skins need a per-character material-variant system that does not exist.
- Character select is **n=1** — packets `select2-c2..c6` are built and waiting for five more critics.

---

# PART 3 — NEEDS URI

**→ `docs/DECISIONS-FOR-URI.md`.** Twelve were answered this session (§6, §12, §13, §15, §18, §22,
§24, §24b, §26 …). Still open: **§17** (music during matches, `hurt` level), **§19** (back out of a
live match), **§4** (`ROSTER_GATED`), **§14** (portrait), **§10** (two icons need a *subject* change),
and **§16/§20** (looks to eyeball).

And the standing one: **the two most valuable bug reports this project has ever had came from Uri
simply playing it.** A build is deployed for exactly that — see `CLAUDE.md`.
