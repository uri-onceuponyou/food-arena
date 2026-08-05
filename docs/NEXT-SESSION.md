# Start here — continuation prompt

Paste the block below into a fresh session. Everything it references is committed.

---

```
Continue work on Food Fight Arena (/Users/uribishansky/claude-code/food-arena).

Read CLAUDE.md first, then docs/STATE.md, docs/DECISIONS-FOR-URI.md, docs/LESSONS.md,
docs/TOOLS.md. Do not re-derive anything they record — 125 commits of a previous session
paid for every line, including nineteen instruments that were caught returning confident
wrong answers.

GOAL: match the visual and gameplay quality of Brawl Stars and Zooba. The bar is an
independent critic scoring 7+/10 in a blind A/B against real reference plates.

WHERE WE ARE — the first scores that can be trusted (canonical rubric, 43 rounds, 43 valid,
instrument validated both directions):

  cast in match  4.33   arena 5.17   home 5.17   HUD 5.67   (references 8.00-8.50)

Every gap is 4.6-6.5x the critic's own resolution floor, so unlike the whole prior history
of this project, a real improvement WILL be visible in the score.

METHOD — fan out subagents, each owning ONE exclusive file set:
  * probe before you loop (eight for eight: every plateau ever probed here was a BUG)
  * define a measurable acceptance test BEFORE round 1, and state its resolution floor
  * improve -> screenshot -> READ THE PNG with the Read tool -> blind packet via
    tools/review.mjs --rubric canonical -> fresh critic -> act on its single highest-impact
    NAMED fix, after probing the mechanism
  * cap 3-4 rounds; score the reference side every round (outside 7-9 = discard)
  * two critics reversing -> stop and probe instead

Critics here name SYMPTOMS accurately and MECHANISMS badly — four passes have now beaten
their critics by refusing them and probing (a shadow-bias claim worth 0.0003; "ambient
dominating the key" an order of magnitude too small; a "visible side face" on a 1.7px riser;
"cut ambient 40%" measured backwards). But when two critics name the SAME mechanism
unprompted, take it seriously — that convergence produced the silhouette finding.

THE NON-NEGOTIABLES ARE IN CLAUDE.md. The ones that cost the most when broken:
  * verify-head.mjs before every push (HEAD was unbootable for 24 commits)
  * measure on a frozen snapshot: with_snapshot.mjs -- <cmd> --url {URL}
  * VALIDATE EVERY INSTRUMENT AGAINST A KNOWN-BAD INPUT — a guard not shown to FAIL on the
    bug it guards against is not a guard (tools/tmp/sentinel.mjs encodes this)
  * the blind critic has a MEASURED ±1.4 floor and a round is n=1, not n=2
  * never git stash; never git commit --amend; commit with pathspec form
  * budget: ~300-500k tokens per agent, cap 6 CONCURRENT and KEEP IT SATURATED, and there
    is a 200-agent PER-SESSION cap that the last session exhausted

START HERE, in this order:

  1. THE GAME DRAWS NO HIGHLIGHTS. Three independent probes converged on one mechanism:
     the Fresnel rim reaches 1.402% of pixels, prop faces carry one flat value each, and
     share of playfield above luma 0.80 is ours 0.67-1.68% vs reference 2.39-19.06% —
     NON-OVERLAPPING. Root cause: `Material.clone()` does not copy `onBeforeCompile`, and
     `applyRimLight` is called from exactly ONE site inside `toonMat`, so all 54 clone
     sites in src/ silently drop the rim. Fix with a `cloneToon()` helper in
     src/render/toon.ts. NOT the ground plane (apron.ts:830 declines it on purpose).
     ⚠️ The old "raise the contact decal 2.5x" lead is FALSIFIED — it compared an ablation
     delta of one layer to the reference's total shipped contact contrast. Like-for-like,
     ours already MATCHES Brawl Stars. Do not spend a round on it.

  2. tools/tmp/scripted_player.mjs — the "one line" fix is a DIFFERENT, WORSE fix. Deleting
     `if (w.type === 'self') return;` alone gives settled 13 / tier spread 9.14pp and wastes
     66.5% of every heal; it must be gated on ai.ts:rankHeal's own three conditions. And the
     SECOND bug is bigger: ranking by authored `damage` moves 40 of 110 matchups, max 46.9pp,
     and mis-ranks FIVE characters not two. Land both, keep both old behaviours behind flags.
     Then Hamburger: healAmount 25 -> 18 gives spread 8.05pp, settled 14 — but the binding
     constraint then moves to LEGENDARY AT THE BOTTOM, not Hamburger at the top.

  3. Kitchen concealment — APPROVED BY URI, UNSTARTED. "add bushes but make it relevant to
     kitchen, for example plates you can hide under." Our 21.36% reproduces, but the
     "35-45% reference" HAS NO INSTRUMENT — it is one critic's prose and three of the four
     plates do not show it. The gap is GRAIN not area: ~2 objects deliver our whole share,
     every solid prop is one height (2.415m). ⚠️ The sim contains ZERO randomness — an
     accuracy ROLL would destroy the determinism under every balance number. Step 0 is the
     inert mechanism, proven bit-identical exactly as LEVEL_MIN was.

  4. Cast value ladder — the "regressions" are ONE src/render/ COMMIT, not two character
     commits: a 9-tree paired bisect puts pizza and waterbottle both inside ce49cd3..47feb9a,
     whose only character-rendering commit is 086ff5f (the key-light front fill). And
     weakBoundaryPct MEASURES THE WRONG QUANTITY (whole-part medians, not the boundary) —
     fix the metric before dispatching any character agent. burrito and sushi regressed
     MORE than pizza and were never named. The 171 dl rows never existed on disk.

STILL NEEDS URI (docs/DECISIONS-FOR-URI.md): §17 music during matches and hurt level, §19
back out of a live match, §4 ROSTER_GATED, §14 portrait, §10 two icons need a SUBJECT
change, §16/§20 looks to eyeball. Park anything else that needs his judgement and move on —
he runs long unattended sessions and does not want to be blocked on.

He plays at https://uri-onceuponyou.github.io/food-arena/ (no HMR, works on a phone).
The two most valuable bug reports this project has ever had came from him playing it.
```

---

## Notes for whoever pastes it

- **Uri's answers this session** are recorded in `DECISIONS-FOR-URI.md`: rarity is **not** power and
  costs nothing extra to level (§24b/§26), the AI **scales to the player's level** (§22), levels are
  **1–15** (§22), difficulty is **~52%** with the flee-aim bug fixed (§12/§15), and he supplied the
  six menu reference plates (§6). Do not reopen these.
- **`docs/pages-workflow.yml`** is a ready-to-paste GitHub Actions deploy. It is not live because the
  token lacks `workflow` scope; until it is, republish by building with `DEPLOY_BASE=/food-arena/`
  and pushing `dist/` to the `gh-pages` branch.
- **Optional:** `github.com/cloudai-x/threejs-skills` — materials/lighting/postprocessing are relevant
  to item 1; loaders and animation cover nothing here. Audited at r160+, we are on 0.180.0.
