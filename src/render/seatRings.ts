/**
 * SEAT RINGS — the coloured disc under every fighter in a match.
 *
 * Graphics campaign F1 (`docs/REVAMP.md` §2.1 and §5 `F1`; the colours are
 * `docs/DECISIONS-FOR-URI.md` §91b). The review measured the reference's fighter "unit" as
 * ring + contour + label + a saturated mid-value body, and found every reference frame
 * carries a ring under each fighter while this source had none anywhere. R1 built the
 * contour; this is the ring. It is a MARK, not light: §2.1's sentence is *"the reference
 * marks them, it does not light them"*, and no lighting variant R1 or D4 tried moved fighter
 * salience at all.
 *
 * ── WHAT IT IS ──────────────────────────────────────────────────────────────
 * One flat disc per drawn fighter, lying on the floor under its feet: a solid RIM and a
 * soft FILL, in ONE texture and one colour per role. Unlit (`MeshBasicMaterial`), so it
 * reads the same in a prop's cast shadow as in the open — a marker that dims in shade
 * would hand the shade back the salience the ring exists to take.
 *
 *   the LOCAL seat   `SEAT_RING_LOCAL` — a hue no other ring uses
 *   every opponent   `SEAT_RING_ENEMY` — one shared enemy hue (six-player is FFA)
 *
 * Both are the HUD's own team colours (`hud.ts` `.hud-float--player` / `--enemy` fills),
 * so the ring, the over-head plate and the corner nameplates say "you" and "them" in one
 * vocabulary. §91b parks the alternative (a hue per seat) as a one-table reversal.
 *
 * ── ONE DRAW EACH, AND NOTHING ELSE ─────────────────────────────────────────
 * One shared `CircleGeometry`, one shared 128x128 alpha texture, two materials. No shadow
 * casting (it IS a mark on the floor, not an object), so it never enters the shadow pass;
 * `depthWrite: false`, so it never enters the depth the contact-AO pass reads. The phone
 * tier has no draw headroom at six seats (`docs/REVAMP.md` §2.8) and this costs exactly
 * one draw per ring.
 *
 * ── THE FOUR THINGS THAT WOULD HAVE BROKEN IT, each from a recorded failure ──────────
 *  1. **The contour.** R1's match contour inks wherever a CHARACTER fragment wrote its
 *     alpha tag (`roles.ts`). A NormalBlending decal blends destination ALPHA toward its
 *     own, so drawn over a fighter's edge it would thin the tag and fade the ink there.
 *     `preserveDestinationAlpha` keeps the colour maths and leaves alpha untouched — the
 *     ring is neither inked nor an eraser of ink. Proved on a frozen frame with the
 *     contour drawn in pure green (`r1_probe` variant `dbg:green`), not assumed.
 *  2. **Concealment.** A ring under a hidden opponent would report exactly the position
 *     the game says you cannot see — `docs/LESSONS.md` §1's "rendering and invisible"
 *     inverted, the same leak `match.ts` documents for the contact shadow. So a seat is
 *     ringed only while its model root AND every ancestor are `visible`: the ring reads
 *     `match.ts`'s own presentation verdict (`fighterVisibleTo`) through the scene graph,
 *     with no second copy of the rule.
 *  3. **The ground stack.** `y = SEAT_RING_Y` sits above every floor DECAL (pads 0.045,
 *     seams 0.062, baked prop shadows 0.07, prop kicks 0.08, the contact decal 0.09) and
 *     below the floor-standing geometry (debris 0.17+, plinths, drains, the pot skirt):
 *     a ring on the floor goes behind a crate standing on the floor, as it should. Drawn
 *     at `renderOrder` 2.5/2.6 — after the contact decal (2) and the hazard glow (2), so a
 *     contact shadow never darkens it, and before every VFX layer (3..11), so a status
 *     ring, a telegraph or a projectile is never painted over by a ground marker.
 *  4. **The lobby.** Match framing only (`frameMode: 'fair'`), exactly as the contact
 *     decals: the character select podium has its own authored grounding, and the lobby
 *     is the framing Uri judges a character in.
 *
 * ── LATER: STATUS ON THE RING ───────────────────────────────────────────────
 * The plan puts status segments ON this ring (`docs/REVAMP.md` §5 F1). Room is left for
 * it rather than built: the rim is its own band of the texture (`RIM_IN`..`RIM_OUT`), so a
 * segmented rim is a per-seat material with an angular mask over that band, and `update`
 * already walks seats one at a time with the seat in hand.
 */

import * as THREE from 'three';
import { CHARACTER_RADIUS } from '../units';
import { preserveDestinationAlpha } from './roles';

/** The local seat's ring — `hud.ts` `.hud-float--player .hud-float-fill`. Reserved: no other ring uses it. */
export const SEAT_RING_LOCAL = 0x3fcb86;
/** Every opponent's ring — `hud.ts` `.hud-float--enemy .hud-float-fill`. */
export const SEAT_RING_ENEMY = 0xe6493f;
/** Height of the disc above the floor plane, metres. See note 3 in the header. */
export const SEAT_RING_Y = 0.1;

/**
 * Everything a probe may sweep on one frozen frame (`Stage.look.ring*`). The defaults are
 * what ships; see the F1 commits for the measured sweep behind each.
 */
export interface SeatRingStyle {
  /** Outer radius in `CHARACTER_RADIUS` units (the sim's footprint, `PLAYER_SIZE` / 2). */
  spread: number;
  /** Fill alpha at the rim's inner edge; the centre carries half of it (under the body). */
  fill: number;
  /** Rim alpha. */
  rim: number;
  /** Alpha of a dark keyline just outside the rim (0 = none). */
  key: number;
  local: number;
  enemy: number;
}

export const SEAT_RING_STYLE: Readonly<SeatRingStyle> = {
  spread: 1.5, fill: 0.42, rim: 1, key: 0, local: SEAT_RING_LOCAL, enemy: SEAT_RING_ENEMY,
};

/** Texture radii, as a fraction of the outer radius. The rim is one band, kept whole. */
const RIM_IN = 0.79;
const RIM_OUT = 0.93;
/** The keyline's outer edge; the disc's last texels beyond it are exactly clear. */
const KEY_OUT = 0.985;

/** What a caller (or the Stage's own inference) says about one seat. */
export interface SeatRingSeat {
  /** The fighter's model root — a `character:*` group. */
  readonly root: THREE.Object3D;
  /** The seat this screen is playing (`roster.ts` `LOCAL_SLOT`). */
  readonly local: boolean;
  /** False for a knocked-out fighter: a corpse is not a unit and gets no ring. */
  readonly alive: boolean;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The ring profile, written into `data` (RGBA, size x size). White RGB for the rim and fill
 * — the material colour tints them, so ONE texture serves both roles — and a DARK keyline
 * (RGB 0.12 x the tint) outside the rim when `key` > 0. The outermost texels are exactly 0
 * alpha: a disc whose texture is merely "nearly clear" at its edge draws a visible polygon
 * on the floor.
 */
function writeProfile(data: Uint8Array, size: number, st: SeatRingStyle): void {
  const c = (size - 1) / 2;
  const aa = 1.5 / c;  // ~1.5 texels of edge, so the rim is crisp but not aliased
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x - c) / c, (y - c) / c);
      const inRim = smooth(RIM_IN - aa, RIM_IN + aa, r);
      const outRim = 1 - smooth(RIM_OUT - aa, RIM_OUT + aa, r);
      const rim = st.rim * inRim * outRim;
      const fill = st.fill * (0.5 + 0.5 * smooth(0, RIM_IN, r)) * (1 - inRim);
      const key = st.key * smooth(RIM_OUT - aa, RIM_OUT + aa, r) * (1 - smooth(KEY_OUT - aa, KEY_OUT, r));
      const a = r >= 1 ? 0 : Math.min(1, Math.max(rim, fill, key));
      // Dark only where the keyline is the dominant term.
      const v = key > Math.max(rim, fill) ? 0.12 : 1;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255);
      data[i + 3] = Math.round(a * 255);
    }
  }
}

function ringTexture(st: SeatRingStyle, size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  writeProfile(data, size, st);
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  t.name = 'seat:ring';
  return t;
}

function ringMaterial(map: THREE.Texture, hex: number, name: string): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    map,
    color: hex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
  });
  m.name = name;
  preserveDestinationAlpha(m);   // header note 1
  return m;
}

/** True only if `o` and every ancestor are visible — the same answer three gives when it decides to draw `o`. */
function drawn(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * The rings of ONE `Stage`. Per-stage, never shared: `Stage.dispose()` walks its scene and
 * disposes what it finds, so a shared geometry would be freed by the first Stage to go.
 */
export class SeatRings {
  readonly group = new THREE.Group();
  private readonly geometry: THREE.CircleGeometry;
  private readonly texture: THREE.DataTexture;
  private readonly matLocal: THREE.MeshBasicMaterial;
  private readonly matEnemy: THREE.MeshBasicMaterial;
  private readonly pos = new THREE.Vector3();

  /** The style the texture and colours were last built for (`update` diffs against it). */
  private readonly built: SeatRingStyle = { ...SEAT_RING_STYLE };

  constructor() {
    this.group.name = 'seat:rings';
    this.geometry = new THREE.CircleGeometry(1, 48);
    this.geometry.rotateX(-Math.PI / 2);
    this.texture = ringTexture(this.built);
    this.matLocal = ringMaterial(this.texture, this.built.local, 'seat:ring:local');
    this.matEnemy = ringMaterial(this.texture, this.built.enemy, 'seat:ring:enemy');
  }

  /** How many rings the last `update` placed. */
  shown = 0;

  /**
   * Place one ring under every seat that is drawn and alive; hide the rest. `style`
   * defaults to what ships; a probe passes `Stage.look`'s ring knobs.
   */
  update(seats: readonly SeatRingSeat[], style: Readonly<SeatRingStyle> = SEAT_RING_STYLE): void {
    this.restyle(style);
    const s = CHARACTER_RADIUS * style.spread;
    let n = 0;
    for (const seat of seats) {
      if (!seat.alive || !drawn(seat.root)) continue;
      const m = this.ring(n++);
      seat.root.getWorldPosition(this.pos);
      m.position.set(this.pos.x, SEAT_RING_Y, this.pos.z);
      m.scale.set(s, 1, s);
      const mat = seat.local ? this.matLocal : this.matEnemy;
      if (m.material !== mat) {
        m.material = mat;
        m.name = mat.name;
        // The local ring draws LAST where two rings overlap (two fighters toe to toe):
        // "where am I" is never painted over, the radar's rule for its own dots.
        m.renderOrder = seat.local ? 2.6 : 2.5;
      }
      m.visible = true;
    }
    const kids = this.group.children;
    for (let i = n; i < kids.length; i++) kids[i].visible = false;
    this.shown = n;
  }

  /** Rebuild the texture / re-tint only when a knob actually moved — never per frame. */
  private restyle(st: Readonly<SeatRingStyle>): void {
    const b = this.built;
    if (st.fill !== b.fill || st.rim !== b.rim || st.key !== b.key) {
      b.fill = st.fill; b.rim = st.rim; b.key = st.key;
      const img = this.texture.image as { data: Uint8Array; width: number };
      writeProfile(img.data, img.width, b);
      this.texture.needsUpdate = true;
    }
    if (st.local !== b.local) { b.local = st.local; this.matLocal.color.setHex(st.local); }
    if (st.enemy !== b.enemy) { b.enemy = st.enemy; this.matEnemy.color.setHex(st.enemy); }
    b.spread = st.spread;
  }

  private ring(i: number): THREE.Mesh {
    const kids = this.group.children;
    if (i < kids.length) return kids[i] as THREE.Mesh;
    const m = new THREE.Mesh(this.geometry, this.matEnemy);
    m.name = this.matEnemy.name;
    m.castShadow = false;
    m.receiveShadow = false;
    m.frustumCulled = true;
    m.renderOrder = 2.5;
    this.group.add(m);
    return m;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.geometry.dispose();
    this.texture.dispose();
    this.matLocal.dispose();
    this.matEnemy.dispose();
  }
}
