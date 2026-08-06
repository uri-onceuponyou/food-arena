/**
 * ⚠️ SCRUB RULE — inherited verbatim from `tools/tmp/pp_ref_parts.mjs` and it is
 * STANDING, not a one-off. This repo is PUBLIC, and `CLAUDE.md`'s permanent security
 * constraint says `reference/images/` must never be committed OR PUBLISHED. A prose
 * description derived from viewing a plate is still derived from it, and this file was
 * written after viewing them.
 *
 *   DESCRIBE THE COMPOSITIONAL ROLE, NEVER THE THIRD-PARTY ARTWORK.
 *   "the primary action button" — yes.  Naming its imagery, its wording or the title
 *   it belongs to — no.
 *
 * The crop COORDINATES stay: they are numbers, they are needed for reproducibility,
 * and they disclose nothing. Role-based notes are also better engineering, because
 * what this table has to record is WHY a crop is COMPARABLE, not what it contains.
 *
 * ⚠️ Two plates in the supplied set carry the owner's own account details in their
 * top-left corner. Every box below either sits outside that region or was checked
 * against it: no box in this file starts above y=175 on the left-hand third of any
 * plate except `currency-chips`, which is taken from the top-RIGHT strip.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A BOX IS
 *
 * `[x0, y0, w, h]` in PLATE pixels. Every plate in the supplied menu library is
 * 2556x1179, and `ue_shoot.mjs` captures our screens at 852x393 CSS at
 * deviceScaleFactor 3 = **2556x1179 exactly**. So the two sides share a canvas, and
 * "this element is 575x156 device px" is directly comparable to "theirs is 525x258".
 * That is the one measurement in this programme with a floor of 1 device pixel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO MATTE, AND WHY THAT IS THE OPPOSITE CALL FROM THE CHARACTER PASS
 *
 * `pp_lib` composites both sides onto one flat field, because for a character the
 * backdrop is not the subject. For a UI element the backdrop IS part of the subject:
 * a button's fill, its border, its shadow and the few pixels of screen it sits on are
 * the whole of what "amateurish" means. Matting a button would delete the thing under
 * test. So both sides are cropped with the SAME margin rule and nothing is replaced.
 *
 * The cost is stated rather than hidden: our screens' surround is warm and light, the
 * plates' are cool and dark, so a crop with a large margin measures the backdrop. The
 * margin is therefore small and proportional — `ue_pack.mjs`'s `MARGIN_FRAC` — and
 * `ue_pack` reports `elementAreaFracOfCrop` for both sides with a bound, so a pair
 * where the surround dominates cannot pass silently.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY SCALE IS MATCHED ON AREA AND NOT ON HEIGHT
 *
 * `pp_pack` matches the part's HEIGHT. That works when both sides are the same kind
 * of object. UI elements are not: our 4-tab bar is 6.06:1 and the only tab control in
 * the plates is 2.00:1. Matching height would then hand the critic a panel 3x wider
 * than the other and the pair would measure the crop. Matching AREA makes neither side
 * bigger, and `aspectRatioRatio` is reported per pair so the remaining mismatch is a
 * number rather than a surprise. A pair over the declared bound is REFUSED, not
 * quietly scored.
 */
export const PLATES = {
  bs_home: 'reference/images/curated/menus/bs_home.png',
  bs_detail: 'reference/images/curated/menus/bs_character_detail.png',
  bs_roster: 'reference/images/curated/menus/bs_roster_grid.png',
  zb_prog: 'reference/images/curated/menus/zb_progression.png',
};

/**
 * `ours` names the side of the pair as `<screen>@<viewport>`; `plate`/`box` names the
 * reference side. `role` says why the two are the same object, in compositional terms
 * only. `arRatio` is filled in by `ue_pack` and checked against `AR_BOUND`.
 */
export default {
  'nav-tab-2up': {
    ours: 'home@plate', plate: 'zb_prog', box: [150, 185, 410, 205],
    role: 'one SELECTED top-level tab beside one unselected one — the control that says which section you are in',
  },
  'currency-chips': {
    ours: 'home@plate', plate: 'bs_home', box: [1585, 0, 615, 78],
    role: 'the run of soft-currency readouts in the top bar: icon + numeral, repeated',
    note: 'taken from the top-RIGHT strip, which carries no account identity',
  },
  'panel-progress': {
    ours: 'home@plate', plate: 'bs_home', box: [120, 175, 290, 410],
    role: 'the block that shows what you are progressing towards and what is waiting to be collected',
    pairable: false,
    why: 'NOT PAIRABLE, for a reason that is itself a finding. The only region in the four supplied plates that plays this role is the same one `chest-rows` uses, and two critic rounds sharing one reference panel are not two observations. Our card ALSO has no counterpart on the reference side at all: the reference states this role with uncontained controls sitting straight on the screen, while ours is a bordered, shadowed, titled card 3.81x its area. That container question is a SHARED-CHROME question — `theme.ts` — not a drawing question, so it is answered by the exact deltas and by the three pairable things inside it (`xp-bar`, `chest-row-single`, `progress-track`).',
  },
  'panel-fighter': {
    ours: 'home@plate', plate: 'bs_detail', box: [1847, 479, 550, 403],
    role: 'the panel that carries the selected fighter\'s numbers',
  },
  'xp-bar': {
    ours: 'home@plate', plate: 'bs_detail', box: [1847, 484, 552, 105],
    role: 'the level/progress readout: a level badge, a label, and a track showing how far through the level you are',
  },
  'stat-bars': {
    ours: 'home@plate', plate: 'bs_detail', box: [1871, 605, 525, 258],
    role: 'the repeated per-stat rows: icon, stat name, and the value expressed on a track',
  },
  'stat-bars-cs': {
    ours: 'characters@plate', plate: 'bs_detail', box: [1871, 605, 525, 258],
    role: 'same role as `stat-bars`, on OUR OWN better-scoring screen — the internal control',
  },
  'chest-rows': {
    ours: 'home@plate', plate: 'bs_home', box: [120, 175, 290, 410],
    role: 'the stack of tappable reward entries, each carrying an icon, a name and a state flag',
  },
  'chest-row-single': {
    ours: 'home@plate', plate: 'bs_home', box: [130, 760, 400, 150],
    role: 'ONE reward entry: an icon, a name, a quantity and a progress readout, in one tappable row',
  },
  'primary-button': {
    ours: 'home@plate', plate: 'bs_home', box: [1876, 985, 542, 145],
    role: 'the single largest call to action on the screen — the one that starts a match',
  },
  'primary-button-cs': {
    ours: 'characters@plate', plate: 'bs_home', box: [1876, 985, 542, 145],
    role: 'same role, on OUR OWN better-scoring screen — the internal control',
  },
  'secondary-button': {
    ours: 'characters@plate', plate: 'bs_detail', box: [690, 1015, 190, 105],
    role: 'the smaller action sitting beside the primary one',
  },
  'secondary-button-home': {
    ours: 'home@plate', plate: 'bs_detail', box: [690, 1015, 190, 105],
    role: 'same role on home',
    pairable: false,
    why: 'NOT PAIRABLE at 2.41x aspect, and the reason is the finding: home\'s secondary control is 575x132 device px against its own primary\'s 618x135 — 91% of the primary\'s AREA. The reference\'s secondary is 25% of its primary\'s. There is no wide secondary anywhere in the supplied plates to pair it with BECAUSE a shipped screen of this kind does not have one. Reported as an exact size delta instead.',
  },
  'mode-chip': {
    ours: 'home@plate', plate: 'bs_home', box: [1124, 1010, 730, 125],
    role: 'the strip that names which mode the primary button will start',
  },
  'rarity-badge': {
    ours: 'home@plate', plate: 'bs_detail', box: [520, 370, 140, 60],
    role: 'the word that states the selected fighter\'s rarity tier',
  },
  'rarity-badge-cs': {
    ours: 'characters@plate', plate: 'bs_detail', box: [520, 370, 140, 60],
    role: 'same role, on OUR OWN better-scoring screen — the internal control',
  },
  'progress-track': {
    ours: 'home@plate', plate: 'bs_detail', box: [1937, 540, 455, 28],
    role: 'the bare track a progress value is drawn on, with no label and no badge',
  },
  'roster-card': {
    ours: 'characters@plate', plate: 'bs_roster', box: [456, 180, 510, 440],
    role: 'one selectable fighter tile in a grid: portrait, name, tier mark and a footer of state marks',
  },
  'weapon-buttons': {
    ours: 'characters@tall', plate: 'bs_detail', box: [1840, 140, 560, 300],
    role: 'the cluster of per-fighter ability affordances, each carrying its own count or state',
    declared: 'OUR side is taken at the OFF-PLATE `tall` viewport. At the plate-matched viewport this element is 471x84 device px — a single row clipped mid-glyph by its own panel — and home\'s equivalent is `display:none` outright (home.ts:1490). Both facts are findings and are reported as such; neither is a pair.',
  },

  // ── REFUSED, and refused on the SAME grounds a part was refused in the
  //    character pass: a mis-specified element is a mis-specification, not a finding.
  'nav-tabs': {
    valid: false,
    why: 'our whole 4-tab bar is 6.06:1 and the only tab control in the supplied plates is 2.00:1 — a 3.03x aspect mismatch, so the pair would measure the crop. Split into `nav-tab-2up`, which is 3.56:1 against 2.00:1 and makes the same compositional statement.',
  },
  'type-scale': {
    valid: false,
    why: 'a type SCALE is a relationship between headings, labels and numerals ACROSS a screen. No single crop can show it, and the one container that looked like a candidate (`.home-nameplate`) is a full-width flex box that is 8.25:1 — a crop of it is mostly backdrop. Answered instead by the exact type census in `ue_census.mjs`, which is what the "40 distinct font-sizes" finding needs anyway.',
  },
};

/**
 * The bound on `aspectRatioRatio` = max(arOurs, arRef) / min(arOurs, arRef).
 *
 * 2.0 is not a taste call. At 2.0 with area matched, the two panels' HEIGHTS differ by
 * sqrt(2.0) = 1.41x, which is inside the 1.33-1.43x upscale the reference plates
 * already arrive with and which `docs/LESSONS.md` §3 records as NOT costing them a
 * point (they score 8 at 0.42-0.48x our edge acuity). Past 2.0 the height ratio
 * exceeds anything the instrument has been shown to tolerate.
 */
export const AR_BOUND = 2.0;
