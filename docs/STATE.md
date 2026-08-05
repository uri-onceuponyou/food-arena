# State — what is done, what is pending

As of commit **e0a4b9d**, ~37 commits into a long unattended session. HEAD verified bootable
after every commit. **Agents were still in flight when this was written** — the 🟠 section names
which, so treat those rows as "landing", not "untouched".

**Judgement calls do not live here any more.** They are in **`docs/DECISIONS-FOR-URI.md`**, with
what was assumed, what reversing costs, and why measurement could not settle it. Read that first
if you are Uri.

---

# PART 0 — the one thing to know

**Objective quality moved a great deal this session. Blind critic scores did not.**

| element | blind score | reference | round valid? |
|---|---|---|---|
| arena | **5.33** | 8.33 | yes |
| home | **6.0** | 8.5 | yes, but see below |
| character select | **6.0** | 8.5 | yes, same caveat |
| characters | **3.6** | 9.0 | yes |

Nothing is near Uri's bar of **7+**. Meanwhile reachability went 79.1% → 100%, buried limb groups
50 → 26, hue collision −35%, mean saturation above the reference plate minimum for the first time,
and 65 WCAG failures went to zero. **The work is real and has not yet converted into perceived
quality.** The measured reason is in `PART 2 🔴 1`.

Two instrument caveats that bound those numbers: the review library has **no lobby/hero-select
plates**, so every menu round scored against in-match combat frames (both critics flagged it
unprompted); and the arena packet drew 4 of 6 Zooba plates, whose camera is not ours.

---

# PART 1 — DONE

## The 🔴 gameplay bugs — all six fixed

| bug | what it actually was |
|---|---|
| **The clock ended nothing** | 110 of 110 forced-immortal matchups still `playing`, `winner: null`, after 360 s. Worse, the fog killed the 100 HP player **before** the 150 HP enemy every time (2.00 s vs 3.00 s), so running the clock out was an *arithmetically guaranteed player loss*. Now `resolveTimeout()` on HP **fraction** → zone control → the human, with `MIN_SAFE_RADIUS` flooring the ring so the tiebreak is reachable at all. |
| **Trail marks stacked into a one-frame kill** | **87 HP in a single 16.7 ms tick across 29 hit events**, undodgeable by construction. Capped at one instance per victim per tick *while still consuming the others*, so the cap did not become a drip. Per-match trail damage moved −3.4%: the burst died, the mechanic did not. |
| **Melee at distance 0 ignored facing** | `NaN > cone/2` is false, so a coned swing landed regardless of aim — an outcome decided by IEEE-754 comparison semantics. Now a defined rule: coincident fighters have no bearing, so a **directional** swing misses and an **omnidirectional** one lands. All 11 AIs still kill a motionless player, so no whiff-deadlock. |
| **A fighter inside the pot was invisible** | **0.0% of its silhouette**, head included. The probe killed the alternative fix with three numbers: the rim sits at 2.53 m and characters are 2.10 m, so the fighter was *under a lid*, not behind an opaque colour. Solid `CoverBox`; the burn ring at r=95 still bites because collision stops centres at r=73. |
| **The radar showed no zone** | Not merely oversized — **off-card at t=0, t=6 s and t=11.3 s**, with **zero pixels changing over the first six seconds** of a 19.6 s mean match. The map is now drawn *inside* the fog field, so danger closes in from outside. |
| **`MATCH_DURATION_MS` ~7× too long** | 180 s → 45 s, chosen by sweeping nine values. **But see `PART 2` — the premise was later found to be wrong**, and the correction is in `DECISIONS §1`. |

## Built this session

- **Real pathfinding.** A flow field replaced greedy avoidance. Map reachability **79.1% → 100%** (proven to be the ceiling by an independent lattice flood), the alcove deadlock **0/11 → 11/11 characters arriving**, and — the sharpest number — an idle player being reached at all went **0 of 110 matchups → 110 of 110**. Also fixed: `ai.ts` derived facing as a **zero vector** at zero separation, so every ranged shot at a coincident player flew **due east**.
- **Mobile quality tiers + DPR cap.** Three tiers, **−93% post-chain fill** and **−55% GPU memory** at `low`, DPR cap exact at deviceScaleFactor 1/2/3/4 (24/24). The top tier is **byte-identical** to the pre-tier pipeline, which retroactively validates every colour number measured through it. Settings now ships a real graphics row.
- **The shop.** Every price, percentage and pool read from the economy model; no second source of truth. Ships **visible and disabled** with the refusal stated in the model's own arithmetic (best possible outcome on a 900-coin box returns 520). `ROSTER_GATED` is never read — availability is *derived*, so the flag flip needs no edit, and that is proven by rewriting the flag inside a disposable snapshot.
- **Menus.** 65 text runs below WCAG AA → **0**, minimum ratio 1.64 → 4.91+. The trophy bar stopped contradicting its own label. Roster framing **19% figure → 57%**, faces 41px → 83px.
- **Audio.** A match ending on the clock and the FINAL RING both had **no sound at all**. Both fixed — the second required deleting an empty-batch early-out, because **95.3% of real ticks carry no events**.
- **Arena colour and layout.** The environment vacated the cast's hue band (`envShareInCastBand` 0.1906 → 0.1244, `playerRank` median 33.5 → 23). The closing ring stopped herding fighters into furniture — occlusion **rose** 30.6% → 67.7% as the zone closed and now **falls** 27.7% → 25.2%.
- **Characters.** Arms: eight of eleven stances rotated limbs *across* the body. Legs: `CapsuleGeometry` **degenerates to a sphere whenever `len < 2r`**, so STOUT's "leg" was two overlapping balls inside a boot a third of the character's height.

## Instruments built — and this is the session's real output

Seven instruments were found returning **confident wrong answers**. Each is now fixed and
validated against a known input first.

| instrument | what it was doing |
|---|---|
| `arena-scan` colour budget | **new.** Reproduces the recorded reference figures to 4 decimals, so its numbers compare directly to the git log. Also found `<id>.canvas.png` — labelled "canvas only, no HUD" — **has never been HUD-free**. |
| `valuescan` | **new.** Value ladder + hero/ground separation, calibrated against 27 reference-plate measurements. |
| `verify-head` | **missed the bug it exists to catch**, through three gaps at once. Now walks `tools/`, reads HTML, and resolves root-absolute paths. |
| `menu_accept_portrait` | **new.** Five landscape viewports had hidden **four** portrait bugs, all invisible because `.fa-root` clips so `scrollWidth` reads clean. |
| `input_accept` | **new**, 81/81. Real CDP key events asserted against sim state. |
| `limbcheck` | measures **22°**; the match camera is **58°**. See 🔴 2. |
| `match-sim`'s `smart` policy | tests line-of-sight **before** range, so the scripted player strafes into a wall for the whole match. Being fixed. |

---

# PART 2 — PENDING

## 🔴 The two findings that matter most

**1. The cast has no dark rung.** Measured against 18 Brawl Stars plates:

| | ours | reference |
|---|---|---|
| p95 (light end) | **0.896** | **0.896** |
| p05 (dark end) | **0.304** | **0.097** |

Our light end is *identical* to the reference. **Every one of eighteen reference plates puts 5% of
the character below luma 0.18; not one of ours does.** 73% of the gap is art, 27% is the post chain.
`valuescan --mode gate` is the acceptance test; **0 of 11 currently pass.** Ranked: egg (range 0.401,
below the reference *minimum*), donut, pizza, taco, hotdog. **Leave soup and hamburger alone** —
best part structure in the cast.

⚠️ **Do not fix this by desaturating.** Falsified **four** times now: the cast is **1.8× more
saturated than the environment** and the frame sits below the reference. Value is the lever.

**2. `limbcheck` has been measuring the wrong camera.** At the match's 58°: idle passes **8/11 → 0/11**,
mean wasted footprint **17.7% → 53.8%**. Idle *ranking* survives (ρ 0.927) so priorities were sound;
**run ranking does not** (ρ 0.673). And at the shipped spawn facing every character sits at **exact
profile to camera**, burying 5.3 of ~15 joints against 0.8 in the pose `limbcheck` uses.

## 🟠 In flight as this was written

- **Status lock** — a weapon whose cooldown is shorter than the status it applies holds that status
  up **forever**: 4 of 5 stun and 8 of 10 slow weapons do. **31.4% of engaged time movement-locked**,
  longest unbroken lock **11.02 s** against a 6.0 s mean engagement. The Sticky Trail burst in slow
  motion. ⚠️ Cutting `STUN_DURATION_MS` is measured **wrong** — it costs the player 10.6 pp.
- **AI has no hazard or zone awareness.** Fog kills **14.1% of enemies vs 1.3% of players**, and
  since the layout revived the pot, **100% of pot damage lands on the AI too.**
- **Post chain** eating 27% of the value gap · **`grease_in`**, one puddle where 9 of 11 characters
  fail figure/ground · **VFX audit** against the new hue contract · **measurement integrity** ·
  **loose ends** (key rebinding, player name).

## 🟡 Known, not started

- **Skins** — needs a per-character material-variant system that does not exist.
- **Faceting** is visibly real at crop (taco's hip gems, pizza's crust) and no critic named it as a
  top fix.
- **Eyes** are flat dark decals with no sclera/iris separation. **Faces vanish entirely at match
  framing** — this is a character-select item only.
- **`COUNTDOWN_FROM` + flash = 5.7 s of pre-match against a 17.9 s fight** (32%). Flagged, untouched.

## ⚪ Small and certain

- `preview.ts` `face=1` is unusable for non-spherical heads.
- Four characters mount face features onto `head` instead of `rig.joints.face` (being fixed).
- `rules.ts` + `economy/`: `emoji` fields are still model tokens; a real `iconId` would delete a
  50-line translation table.
- `hamburger` keeps 197 px of detachment — a floating lettuce frill the right mitt touches.

---

# PART 3 — NEEDS URI

**→ `docs/DECISIONS-FOR-URI.md`.** Eleven parked items, each with the assumption in force, the cost
to reverse, and the measurement behind it. The two that block other work:

1. **Lobby/hero-select reference plates.** Three consecutive menu rounds scored against in-match
   combat frames. Only Uri can supply them, and until he does every menu score is unreliable.
2. **Two icons need a *subject* change**, not a redraw — measured across four and five attempts.

And the standing one: **the two most valuable bug reports this project has ever had came from Uri
simply playing it.** Both were invisible to `tsc`, to every assertion, and to every screenshot.
