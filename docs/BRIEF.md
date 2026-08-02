# Food Fight Arena — Gauntlet Loop Prompt (real 3D rebuild, Three.js)

## How to use this
Run this inside Claude Code (not a normal chat) in the project directory. Turn on ultracode
(`/effort` → `ultracode`) before starting, then leave it alone and check the live progress
page it creates.

If you want cloud backup (recommended for a long unattended run), have a GitHub remote ready
— either an empty repo you've already created, or make sure `gh` is authenticated so Claude
Code can create one itself when the prompt asks it to.

This is a real rebuild, not a polish pass — `kitchen-gameplay-prototype.html` was a 2D
DOM/CSS prototype. You're right that Brawl Stars and Zooba are both genuinely 3D: real
character rigs with toon/cel shading, viewed through a tilted top-down camera, projected
down into what reads as a 2D brawler. Matching that bar honestly means building actual 3D
models and a real camera setup, not faking the look in 2D.

---

## The prompt

Build Food Fight Arena as a real-time 3D game in Three.js: actual 3D character models with
toon/cel-shaded materials, rigged and animated, viewed through a tilted top-down camera —
the same kind of setup Brawl Stars and Zooba use to turn 3D models into a readable top-down
brawler. Real 3D arenas with real props, lighting, and shadows, not flat art.

The game design itself does not change, with one exception (the map — see below).
`kitchen-gameplay-prototype.html` documents it exactly: the character roster, every ability,
the balance (damage, cooldowns, speeds, ranges), the controls (WASD move, mouse aim, click
to fire, number-key weapon switching), collision against obstacles, and the match structure
(5s countdown, 3-minute timer, a green fog zone that shrinks in and damages anyone caught
outside the safe area, win/lose, restart). Treat all of that as fixed. What you're rebuilding
is how it's rendered and how it feels to play, not what it does.

**Identity and abilities are fixed — the exact visual descriptions are not.** Each
character's name, food item, rarity tier, and what its abilities do must not change or be
reinterpreted. The facial/visual details below, though, were written for flat 2D icons, not
3D models — treat them as a personality reference, not a literal spec to replicate. If a
literal translation would hurt silhouette readability, expression clarity, or how the model
actually holds up against the bar, adapt the specifics. The character should stay
unmistakably that food item with that same personality — Lollipop should still feel like the
eyes-on-the-stick, mouth-on-the-candy character even if the exact geometry changes — but the
3D interpretation is the model's creative call, not a constraint to satisfy literally.

When a critic is judging a character, the first question is always "does this hold up next
to Brawl Stars and Zooba." Only second is "is this still true to the character's vibe."
Quality against the bar wins when the two pull in different directions.

Translate each into a real 3D model and moveset:

- **Hamburger** (Normal) — closed happy eyes, small smile. Patty Smash (melee), Tomato Toss
  (slows, splatters into a floor puddle that slows), Lettuce Fling (stuns), Onion Ring
  (self-heal). Has a "Shades & Toppings" skin.
- **Donut** (Normal) — crooked smile, sprinkles. Candy Barrage (multi-pellet spread), Sticky
  Trail (passive — leaves a trail while moving that damages enemies who cross it and speeds
  him up / boosts his damage when he crosses his own trail).
- **Taco** (Rare) — trapezoid shell with a jagged crimped top edge; face floats completely
  outside the shell, to the side. Filling Toss, Onion Bomb, Double Toss (fires both at once
  as a combo special).
- **Burrito** (Rare) — white, stands upright, toppings visible at the open end. Burrito Disc,
  Roll Stun (close-range stun), Topping Swarm (homing multi-projectile special, each pellet a
  different topping).
- **Egg** (Neon) — open eyes, straight mouth. Egg Tackle (heavy, slow-charging melee), Hatch!
  (a chick that homes in, arrives, and pecks 3 times), Shell Shards (slowing pellet spread).
- **Lollipop** (Cyber) — eyes on the stick, mouth on the candy. Lollipop Smash (melee hammer),
  Giant Lollipop (huge AOE stun special with a dramatic screen-filling visual).
- **Pizza** (Neon) — closed eyes, smiling. Dough Balls (slows), Tomato Splat (splatters into a
  slowing puddle), Cheese Blind (stun).
- **Sushi** (Legendary) — wide eyes, puckered lips. Rice Spray (multi-pellet), Seaweed Bait
  (slows), Fish Pile (wide melee), Big Catch (homing combo special).
- **Soup** (Epic) — gray steam-colored eyes, no mouth. Soup Splash (pellets), Noodle Toss
  (slows), Soup Dump (heavy melee + slow special).
- **Water Bottle** (Legendary) — eyes floating above the cap, big smile. Water Spray (slowing
  pellets), Glass Shards (stun), Cap Shot (slows), Mega Splash (heavy melee + slow special).
- **Hot Dog** (Cyber) — sleepy half-closed eyes, small smile. Mustard Blast, Ketchup Slip
  (slows), Bun Slash (melee).

Rarity tiers (Normal → Rare → Epic → Legendary → Neon → Cyber) each have their own card
color in the UI; Neon and Cyber cards have an animated black zigzag pattern.

The Kitchen arena can be rebuilt. Keep the kitchen theme, but the current layout — two
islands, four cabinets, one pot, one puddle — was a rough first pass, not a spec to preserve.
Make it significantly bigger and far more detailed: more variety of cover, more
environmental storytelling, whatever it takes to feel like a real arena at the scale and
detail level Brawl Stars and Zooba maps have. Keep the gameplay *types* intact — a central
hazard players need to avoid, physical cover objects with collision, at least one hazard that
slows anyone standing in it — but the count, layout, and specific props are yours to design.

**The bar:** real screenshots and gameplay footage of *Brawl Stars* and *Zooba* — pull actual
reference images before starting. Judge everything against them: model quality and
silhouette readability, toon-shader look, camera angle and framing, animation weight (idle,
run, attack, hit react, death), particle and hit-effect VFX, lighting, and overall game feel.
A piece isn't done until it holds up next to those references in a blind side-by-side.

Decide for yourself how to break this into the smallest pieces that can be built and judged
independently — likely each character's model/rig/animation set, the toon-shader and
lighting setup, the camera system, each arena's environment art, VFX per ability type, and
game feel/juice — but that decomposition is your call, not mine. For each piece, spin up a
builder and a separate critic with fresh context. The critic inspects the actual rendered
output next to the real reference images — never a description of it — makes a blind call on
which looks better, and if ours loses, names the single biggest gap and sends it back. Keep
looping each piece until it holds up or I stop the run. No fixed number of rounds.

The HUD, menus, and other 2D UI can stay DOM/CSS overlaid on the 3D canvas — that's standard
practice and doesn't need to be forced into 3D.

Maintain a simple live HTML progress page that updates as you go, so I can check in from my
phone without interrupting you. Use subagents and ultracode throughout.

## Version control & resumability

This run may span more context than a single session holds, and needs to survive a restart
without losing work or repeating it. So:

- Initialize a git repo at the start if one isn't already present.
- Commit atomically. Every time a builder produces a new version of a piece and its critic
  evaluates it — pass or fail — commit that exact state before moving on. Never batch
  multiple pieces, or multiple rounds of the same piece, into one commit. Each commit message
  should name the piece, the round number, and the critic's verdict (approved, or the gap it
  found).
- Maintain `PROGRESS.md` at the repo root: every piece you've identified, its status (not
  started / in progress, round N / critic-approved), and which piece is currently active.
  Update and commit it alongside every other commit, so it's never out of sync with what git
  actually shows as done.
- At the start of every session — including this one and any resumed one — read `git log`
  and `PROGRESS.md` first, before doing anything else. Resume exactly where they say you left
  off. Do not restart the plan or redo a piece that's already committed and critic-approved.
- Push to a remote (GitHub) after every completed piece at minimum, so progress survives even
  if this machine has an issue. Create the remote if one doesn't exist yet.

This makes resumability a property of the repo itself — committed state plus `PROGRESS.md` —
rather than depending on any session-continuity feature, so it works regardless of how the
run gets interrupted.
