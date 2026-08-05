# Start here — continuation prompt

Paste the block below into a fresh session. Everything it references is committed and pushed.

---

```
Continue work on Food Fight Arena (/Users/uribishansky/claude-code/food-arena).

Read CLAUDE.md first, then docs/STATE.md (PART 0b especially), docs/DECISIONS-FOR-URI.md
(sections 28-33 are Uri's newest answers), docs/LESSONS.md, docs/TOOLS.md. Do not re-derive
anything they record.

GOAL: match the visual and gameplay quality of Brawl Stars and Zooba. The bar is an
independent critic scoring 7+/10 in a blind A/B against real reference plates.

WHERE WE ARE — and read this before choosing what to work on:

  arena (action)  5.00    cast in match  3.83    (references 8.00-8.50)

⚠️ THE LAST SESSION MOVED EVERY OBJECTIVE METRIC AND ZERO POINTS OF SCORE. The acceptance
test (share of playfield above luma 0.70) went 2.40% -> 13.58%, past the reference median,
4.7x its own floor — and 22 fresh critics scored the result flat. It was honestly measured
and it was NOT THE BINDING CONSTRAINT. That is LESSONS §6b, and it is the single most
important thing to understand before spending another pass.

START HERE, in this order:

  1. 🔴 THE FLOOR PLANE. 9 of 14 arena critics named it UNPROMPTED — "a flat, untextured
     pink-and-blue checkerboard with hard unmodulated tile lines", "a HARD, UNBLENDED
     STRAIGHT SEAM between the two colours", "characters sit on it like decals". It is the
     one surface every pass was structurally forbidden to touch: apron.ts:830 passes
     rim:false deliberately, and floorprobe (5/5) breaks on any global floor value change.
     Converges with an independent pixel measurement — 63.44% of frame is flat ground with
     ZERO normalMaps project-wide.
     ⚠️ PROBE BEFORE YOU LOOP. bs_04's ground is ALSO a smooth flat plane, so the lever is
     most likely the tile GRID and the colour SEAM, not surface detail. And our floor is
     already brighter than every reference ground (p50 0.449 vs 0.26-0.42), and tile scale
     INVERTS at shipped zoom.

  2. 🔴 The pale-blue foreground counter reads as "an unfinished placeholder block" to ~8
     critics, and it HARD-CROPS the character it overlaps. Hypothesis worth probing: the
     prop-albedo pass may have made it worse by raising a big blank slab's top face.

  3. 🟠 Cast: the per-part instrument now exists and works. 12 parts scored on hamburger,
     worst first — decoration 3/9, face-overall 3.5/9, eyes 3/8.5, feet 3/8.5, prop 3/8.5.
     Findings are specific in a way no whole-character round ever produced: our eyes have
     0% of pixels above 0.85 luma against the reference's 35.2%; the bib measures Δ0.001
     luma across its whole height where the reference ramps 0.880 -> 0.667 AND rotates
     warmer. ⚠️ Uri is sending per-character rejects — READ THEM FIRST.

  4. 🟠 dlBelow10: a cast pass fixed p05 roster-wide (11/11 FAIL -> 0/11) and range (6/11
     -> 0/11) and PAID figure/ground (1/11 -> 6/11). 17 fixed, 5 created, nobody chose the
     trade. 6 of 7 failures are at FOG stations where figure and ground both collapse
     toward the veil — an arena fix, not a cast fix.

  5. 🟠 Concealment step 0 is landed and INERT (bit-identical, 0 differing ticks in
     3,283,873). It needs 5 out-of-set files to become visible — arena/types.ts,
     ui/hud.ts:757, game/match.ts:1191, arena-dump.js, arena_probe's extractor AND its
     --verify normaliser (both BLIND to concealment today).

METHOD — the rules that earned their place last session:
  * probe before you loop — NINE for nine: every plateau ever probed here was a BUG
  * an acceptance test proves you moved the thing you NAMED, not that it was the thing.
    Ask what fraction of the frame your metric governs and what is EXCLUDED from it BY
    POLICY (LESSONS §6b)
  * a BASELINE is itself a measurement — comparing against an unvalidated one manufactures
    a regression as convincingly as a real bug
  * ask of every assertion: WHAT IMPLEMENTATION WOULD FAIL THIS? If you cannot name one it
    is a comment with a tick next to it (LESSONS §13, the tautological guard)
  * measure the artefact you SHIP, on the PATH you ship it to (LESSONS §3b — a 404 on the
    deployed build survived 427 audio assertions because every one pointed at "/")
  * a round is n=1, the critic floor is ±1.4, and a cross-session before/after needs the
    identical-sheet control run alongside it

STILL NEEDS URI: §29a (bush size — screenshot sent, awaiting his read), §33 (does the menu
theme play on his phone now, and is the ringer switch off), §16 (per-character rejects, he
is sending them), §28 (heal integer, after he plays more).

He plays at https://uri-onceuponyou.github.io/food-arena/ — REDEPLOYED with the audio fix
and the new lobby. The three most valuable bug reports this project has ever had came from
him playing it, and the newest one exposed a whole untested class.
```

---

## Notes for whoever pastes it

- **`docs/STATE.md` PART 0b** is the honest account of the session that moved metrics and not the
  score. Read it before proposing a render pass.
- **Uri's answers are §30–§33** in `DECISIONS-FOR-URI.md`. Landscape only (§14). Rarity is
  acquisition-only and the level tax is gone (§26). Concealment is **fully hidden**, the theme is
  **plates and kitchen objects — NOT bushes**, and **attacking breaks your cover** (§29–30).
- ⚠️ **The word "bushes" is banned.** Every older doc uses it; Uri has twice said kitchen objects.
- ⚠️ **This repo is PUBLIC and describing the reference plates counts as publishing them.** Breached
  once on 2026-08-06 and scrubbed. Describe the compositional ROLE, never the artwork.
- **Open tasks 7–17** carry the routed defects: the gate-count guard, the icon collisions, the
  missing menu click sounds, `menu_accept`'s hero-fill assertion blocking a full-bleed lobby.
