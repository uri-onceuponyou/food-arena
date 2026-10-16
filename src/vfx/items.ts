/**
 * ── ITEMS YOU CAN SEE — every item's presentation, driven off the event stream ──────────────
 *
 * Graphics campaign V2 (`docs/REVAMP.md`). Items became usable (B1) and decisive
 * (`DECISIONS §91m`: one item takes a duel against bots from 61.8% to 99.1%), and on `3ae6028`
 * pressing one showed and sounded like NOTHING: `item-used`, `item-resolved`, `item-cancelled`
 * and `item-hit` had zero consumers, and the states they leave behind (asleep, clogged, rooted,
 * blotted, shielded, winding up) were invisible on every fighter but the one whose HUD said so.
 * `tools/tmp/v2_items.mjs` is the red/green.
 *
 * ── TWO HALVES, AND WHICH CLOCK EACH RUNS ON ────────────────────────────────────────────────
 *
 *   ONE-SHOTS   the throw, the flight, the landing, the pop, the fizzle. Spawned by the
 *               event (`used`/`hit`/`resolved`/`cancelled`/`revived`), animated by `update(dt)`
 *               on `updateEffects`' hit-stop-free clock like every other beat in `vfx.ts` — so a
 *               landing still pops while the world is frozen on the hit.
 *   STATES      the sleeper's Zs and milk pool, the stuck plunger, the liquorice coil, the ink
 *               cloud, the mushroom shield and its wind-up. Read from the SIM every frame in
 *               `sync(state)` — never remembered from an event — so a rejoin, a `clear()` or a
 *               revive cannot leave one drawn after the sim ended it, and the picture expires on
 *               the same millisecond the deadline does.
 *
 * The two meet in exactly one place: a thrown item's state is held back (`pending`) until its
 * flight LANDS, so the Zs never appear on the sleeper before the mug that put them there.
 *
 * ── THE RULES EVERY PIECE HERE FOLLOWS (vfx.ts's language, kept) ─────────────────────────────
 *
 *  * LIT SOLIDS. `ITEMS[id].look`'s 🚨: *"EVERY ITEM MATERIAL MUST BE LIT"* — the mug, plunger,
 *    coil, tin, ink blob and caps are `toonMat` (MeshStandardMaterial), vertex-painted so each
 *    prop is ONE draw.
 *  * TRANSLUCENT = ALPHA-SAFE. Every transparent material goes through `preserveDestinationAlpha`
 *    so R1's fighter contour keeps its tag under a puff (`vfx.ts:alphaSafe`'s measurement).
 *  * FRONT-SIDED. Every ground decal faces up and is `FrontSide`: a transparent `DoubleSide`
 *    material is TWO draws (`v1b_draws.mjs`' known-bad), and the phone has no draws to spare at
 *    six seats (`docs/REVAMP.md` §2.8).
 *  * NOTHING BURIES ITS FIGHTER. States sit at the feet (pool, coil, shield caps outside the
 *    body radius) or above the head (Zs, ink cloud); the one thing ON the body is the plunger,
 *    and that is the joke and the readout both.
 *  * POOLS SIZED FROM `MAX_FIGHTERS`, grown on demand, stolen only at the cap — and a steal is
 *    COUNTED (`stats.steals`), because an effect cut short is the six-seat defect class.
 *  * HUE: 0–60° is shared with the cast, so transients there are LIGHT (vfx.ts hue contract
 *    rule 1); nothing enters BLOCKING violet 258–268 (rule 4) — the ink is a blue-black at ~226°.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GUARANTEED_VISIBLE_RADIUS, ITEM_TUNING, type ItemId } from '../game/rules';
import { MAX_FIGHTERS, type Fighter, type GameEvent, type MatchState } from '../game/state';
import { CHARACTER_HEIGHT, CHARACTER_RADIUS, groundPos, wu } from '../units';
import { toonMat } from '../render/toon';
import { preserveDestinationAlpha } from '../render/roles';

type ItemHit = Extract<GameEvent, { type: 'item-hit' }>;
/** The four items that are THROWN at somebody, and therefore have a flight to land. */
type ThrownId = 'warm_milk' | 'pompa' | 'squid_ink' | 'liquorice';
const THROWN: readonly ThrownId[] = ['warm_milk', 'pompa', 'squid_ink', 'liquorice'];
const isThrown = (id: ItemId): id is ThrownId => (THROWN as readonly string[]).includes(id);

const R = CHARACTER_RADIUS;
const H = CHARACTER_HEIGHT;
/** Where a throw leaves the hand and lands on a body. */
const HAND_Y = H * 0.58;
const BODY_Y = H * 0.55;

// ── PALETTE ───────────────────────────────────────────────────────────────────────────────
const DUST = '#E9DDC9';        // springform take-off / landing: warm light dust
const TIN = '#D5DAE2';         // the springform tin
const MILK = '#FFF8EA';
const MUG = '#F4EDE0';
const STEAM = '#FFFFFF';
const RUBBER = '#D7322B';      // the plunger cup
const WOOD = '#C98B4F';        // the plunger stick
const INK = '#141A2E';         // blue-black, ~226° — out of BLOCKING violet by construction
const LIQUORICE = '#4E111B';   // black-red
const LIQUORICE_HI = '#B4232F';
const DRAIN = '#2A3038';
const STEEL = '#AEB9C6';
const SPLASH = '#C9F0FA';      // the spit-out: water off a drain
const CAP = '#6E4329';         // shiitake cap — dark brown, so it cannot read as a bun
const GILL = '#EFE0C4';        // its underside
const SPORE = '#FFE6B0';
const WILT = '#9B8F80';
const FRIDGE = '#DFF4FF';      // Leftovers: fridge light
/** Tenderiser: amber at stack 1, near-white gold at stack 6 — the 30-60 band, LIGHT. */
const TENDER_LO = new THREE.Color('#FFA33A');
const TENDER_HI = new THREE.Color('#FFF6D6');
const WHITE = new THREE.Color('#FFFFFF');

/** Per-fighter pool budgets; each pool's cap is this times `MAX_FIGHTERS`. Sized for the worst
 *  a fighter can actually do: BOTH equip slots fired on back-to-back ticks (an item's cooldown
 *  is >= 2.5 s, so a third cannot follow inside a beat's life). The heaviest pair is ~24 puffs
 *  (a thrown item's trail + landing ~13, a springform's take-off + landing 11). `v2_items.mjs`
 *  §P fires six seats x two items per tick and requires zero steals; its first stress fired
 *  THREE items per fighter 4 frames apart — a cadence no loadout can reach — and read 25 steals
 *  of 184 at the old 18-puff budget. */
const PER_FIGHTER = { puffs: 24, glows: 12, rings: 6, props: 2 } as const;

// ── TEXTURES (built once; canvas, so browser-only like the rest of the layer) ───────────────
function canvasTex(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const c = cv.getContext('2d')!;
  draw(c, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** A heavy Z with a dark stroke, so it reads on the light floor AND on a dark fighter. */
function buildZTex(): THREE.CanvasTexture {
  return canvasTex(64, (c, s) => {
    c.font = `900 ${Math.round(s * 0.84)}px system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = s * 0.13; c.strokeStyle = '#2B2442';
    c.strokeText('Z', s / 2, s / 2 + s * 0.04);
    c.fillStyle = '#F6F3FF';
    c.fillText('Z', s / 2, s / 2 + s * 0.04);
  });
}
/** The milk pool: a lobed cream blob with a slightly darker meniscus and a soft outer edge. */
function buildPuddleTex(): THREE.CanvasTexture {
  return canvasTex(128, (c, s) => {
    const cx = s / 2; const r0 = s * 0.40;
    const lobe = (a: number) => r0 * (1 + 0.07 * Math.sin(a * 3 + 0.4) + 0.05 * Math.sin(a * 5 + 1.9));
    const path = (k: number) => {
      c.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const r = lobe(a) * k;
        if (i === 0) c.moveTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r); else c.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
      }
      c.closePath();
    };
    c.filter = 'blur(2px)';
    c.fillStyle = 'rgba(214,196,168,0.95)'; path(1.08); c.fill();   // meniscus
    c.fillStyle = 'rgba(255,250,238,1)'; path(0.98); c.fill();      // milk
    c.filter = 'none';
    c.fillStyle = 'rgba(255,255,255,0.75)';                          // one specular sheen
    c.beginPath(); c.ellipse(cx - r0 * 0.28, cx - r0 * 0.32, r0 * 0.30, r0 * 0.12, -0.5, 0, Math.PI * 2); c.fill();
  });
}
/** The drain: a dark well with three lighter spiral arms — spun, it reads as a whirlpool. */
function buildSwirlTex(): THREE.CanvasTexture {
  return canvasTex(128, (c, s) => {
    const cx = s / 2;
    const g = c.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0, 'rgba(6,8,12,1)'); g.addColorStop(0.72, 'rgba(32,38,48,0.96)'); g.addColorStop(1, 'rgba(32,38,48,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.strokeStyle = 'rgba(150,170,190,0.85)'; c.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = arm * (Math.PI * 2 / 3) + t * Math.PI * 2.2;
        const r = cx * (0.08 + t * 0.78);
        if (i === 0) c.moveTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r); else c.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
      }
      c.lineWidth = s * 0.035; c.stroke();
    }
  });
}
/** Vertical falloff for the fridge-light column: opaque at the floor, gone at the top. */
function buildColumnTex(): THREE.CanvasTexture {
  return canvasTex(64, (c, s) => {
    const g = c.createLinearGradient(0, s, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  });
}

// ── GEOMETRY ──────────────────────────────────────────────────────────────────────────────
function paint(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const col = new THREE.Color(hex);
  const n = geo.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function merged(parts: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error(`[items] ${name}: mergeGeometries refused the parts`);
  for (const p of parts) p.dispose();
  g.name = name;
  return g;
}
/** Up-facing flat ring (front face up, so `FrontSide` is visible from the camera). */
function flatRing(inner: number, outer: number, seg = 48): THREE.BufferGeometry {
  return new THREE.RingGeometry(inner, outer, seg).rotateX(-Math.PI / 2);
}
/** The plunger, built along +Z: the cup's mouth at z = 0 facing -Z (into the body it hits). */
function buildPlungerGeo(): THREE.BufferGeometry {
  // The dome's pole points +Z (toward the stick), its MOUTH at z = 0 faces -Z, into the body.
  // (The first build had this reversed: from the thrower's side the camera looked INTO a
  // back-face-culled cup and saw a thin red ring — sheet `s1`, "pompa: clogged".)
  const cup = new THREE.SphereGeometry(0.37, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
  cup.scale(1, 1, 0.8);
  const lip = new THREE.TorusGeometry(0.36, 0.06, 6, 20);
  const stick = new THREE.CylinderGeometry(0.075, 0.075, 1.0, 8).rotateX(Math.PI / 2).translate(0, 0, 0.27 + 0.5);
  return merged([paint(cup, RUBBER), paint(lip, RUBBER), paint(stick, WOOD)], 'vfx_item_plunger_geo');
}
function buildMugGeo(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.24, 0.21, 0.40, 16);
  const milk = new THREE.CircleGeometry(0.215, 16).rotateX(-Math.PI / 2).translate(0, 0.17, 0);
  const handle = new THREE.TorusGeometry(0.12, 0.04, 6, 12, Math.PI).rotateZ(-Math.PI / 2).translate(0.24, 0, 0);
  return merged([paint(body, MUG), paint(milk, MILK), paint(handle, MUG)], 'vfx_item_mug_geo');
}
function buildInkBlobGeo(): THREE.BufferGeometry {
  const a = new THREE.SphereGeometry(0.30, 12, 8);
  const b = new THREE.SphereGeometry(0.20, 10, 6).translate(0.22, 0.08, -0.10);
  const c = new THREE.SphereGeometry(0.16, 10, 6).translate(-0.18, -0.06, 0.14);
  return merged([paint(a, INK), paint(b, INK), paint(c, INK)], 'vfx_item_ink_geo');
}
/** Three wraps of rope around the shins, alternately tilted so it reads as WOUND, not as rings. */
function buildCoilGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const ys = [0.30, 0.55, 0.80];
  ys.forEach((y, i) => {
    const t = new THREE.TorusGeometry(R * 0.72, 0.07, 7, 28).rotateX(Math.PI / 2).rotateZ(i % 2 ? 0.16 : -0.16).translate(0, y, 0);
    parts.push(paint(t, i === 1 ? LIQUORICE_HI : LIQUORICE));
  });
  return merged(parts, 'vfx_item_coil_geo');
}
/** Six overlapping mushroom caps on a ring OUTSIDE the body, tilted outward — the shield. */
function buildCapsGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 6; const ring = R * 1.18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tilt = 0.55;
    const cap = new THREE.SphereGeometry(0.42, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1);
    const gill = new THREE.CircleGeometry(0.40, 14).rotateX(Math.PI / 2).translate(0, -0.005, 0);
    const stem = new THREE.CylinderGeometry(0.09, 0.12, 0.42, 8).translate(0, -0.21, 0);
    for (const g of [cap, gill, stem]) {
      g.rotateZ(-tilt).rotateY(-a).translate(Math.cos(a) * ring, 0.62 + (i % 2) * 0.16, Math.sin(a) * ring);
    }
    parts.push(paint(cap, CAP), paint(gill, GILL), paint(stem, GILL));
  }
  return merged(parts, 'vfx_item_caps_geo');
}
function buildTinGeo(): THREE.BufferGeometry {
  const drum = new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.22, 24);
  const band = new THREE.CylinderGeometry(R * 0.64, R * 0.64, 0.06, 24).translate(0, 0.05, 0);
  return merged([paint(drum, TIN), paint(band, '#D94A3A')], 'vfx_item_tin_geo');
}

// ── THE ONE-SHOT POOLS ──────────────────────────────────────────────────────────────────────
interface Beat {
  obj: THREE.Object3D;
  /** The slot's own material when it has one (opacity/colour per beat), else null. */
  mat: (THREE.Material & { opacity: number; color?: THREE.Color }) | null;
  active: boolean;
  t: number;
  life: number;
  delay: number;
  run: ((b: Beat, k: number, dt: number) => void) | null;
  /** Called once when the beat completes OR is stolen — a stolen flight still LANDS. */
  end: (() => void) | null;
}

class BeatPool {
  readonly beats: Beat[] = [];
  calls = 0;
  steals = 0;
  constructor(
    private readonly parent: THREE.Group,
    private readonly make: () => { obj: THREE.Object3D; mat: Beat['mat'] },
    readonly cap: number,
  ) {}
  alloc(): Beat {
    this.calls++;
    for (const b of this.beats) if (!b.active) return b;
    if (this.beats.length < this.cap) {
      const m = this.make();
      m.obj.visible = false;
      this.parent.add(m.obj);
      const b: Beat = { obj: m.obj, mat: m.mat, active: false, t: 0, life: 1, delay: 0, run: null, end: null };
      this.beats.push(b);
      return b;
    }
    this.steals++;
    let best = this.beats[0]!;
    for (const b of this.beats) if (b.t / b.life > best.t / best.life) best = b;
    const end = best.end; best.end = null;
    end?.();
    return best;
  }
  update(dt: number): void {
    for (const b of this.beats) {
      if (!b.active) continue;
      if (b.delay > 0) {
        b.delay -= dt;
        if (b.delay > 0) continue;
        b.obj.visible = true;
      }
      b.t += dt;
      const k = b.t / b.life;
      if (k >= 1) {
        b.active = false; b.obj.visible = false;
        const end = b.end; b.end = null;
        end?.();
        continue;
      }
      b.run?.(b, k, dt);
    }
  }
  reset(): void {
    for (const b of this.beats) { b.active = false; b.obj.visible = false; b.end = null; b.run = null; }
  }
}

// ── THE PER-FIGHTER STATE VISUALS ───────────────────────────────────────────────────────────
interface SlotVis {
  root: THREE.Group;
  pool: THREE.Mesh;
  zs: THREE.Sprite[];
  plunger: THREE.Mesh;
  coil: THREE.Mesh;
  ink: THREE.Mesh;
  shield: THREE.Mesh;
  windCaps: THREE.Mesh;
  windRing: THREE.Mesh;
}

/** Position of a seat as `sync` last saw it, metres. */
interface SeatPos { x: number; z: number; alive: boolean }

export interface ItemVfxStats {
  calls: number;
  steals: number;
  /** One per event this layer drew something for. */
  beats: number;
}

export class ItemVfx {
  readonly group = new THREE.Group();
  private readonly groundY: number;
  private readonly zTex = buildZTex();
  private readonly puddleTex = buildPuddleTex();
  private readonly swirlTex = buildSwirlTex();
  private readonly columnTex = buildColumnTex();
  private readonly ringThin = flatRing(0.84, 1);
  private readonly ringWide = flatRing(0.56, 1, 40);
  private readonly disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  private readonly plungerGeo = buildPlungerGeo();
  private readonly mugGeo = buildMugGeo();
  private readonly inkGeo = buildInkBlobGeo();
  private readonly coilGeo = buildCoilGeo();
  private readonly capsGeo = buildCapsGeo();
  private readonly tinGeo = buildTinGeo();
  /** The rope: a unit-length cylinder along +Z from z = 0, stretched per frame. */
  private readonly ropeGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 6, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  private readonly columnGeo = new THREE.CylinderGeometry(R * 0.85, R * 1.0, H * 1.35, 20, 1, true).translate(0, H * 0.675, 0);
  /** One lit material per prop family; props scale in and out rather than fade, so they share. */
  private readonly propMat: THREE.MeshStandardMaterial;
  private readonly tinMat: THREE.MeshStandardMaterial;

  private readonly puffs: BeatPool;     // soft discs, normal blend (dust, milk, ink, steam)
  private readonly glows: BeatPool;     // additive glow / star sprites (spores, sparks, splash)
  private readonly glowRings: BeatPool; // additive flat rings
  private readonly dustRings: BeatPool; // normal-blend flat rings
  private readonly props: Record<'tin' | 'mug' | 'plunger' | 'ink' | 'rope' | 'drain' | 'column' | 'wilt', BeatPool>;
  private readonly pools: BeatPool[];

  private readonly slots: (SlotVis | null)[] = [];
  private readonly seats: SeatPos[] = [];
  /** A thrown item's state is held back until its flight lands. Per seat, per thrown item. */
  private readonly pending: Record<ThrownId, boolean>[] = [];
  /** Bearing (radians, world XZ) from the victim back toward whoever stuck the plunger on. */
  private readonly plungerYaw: number[] = [];
  /** Sim time a springform landing puff is due for each seat (NaN = none). */
  private readonly landAt: number[] = [];
  /** The throw a seat's `item-used` started this tick, so its `item-hit` can re-aim it. */
  private readonly throws: ({ beat: Beat; itemId: ThrownId; at: number; aim: { x: number; z: number } } | null)[] = [];
  /** The last Tenderiser ring per VICTIM, so a volley's pellets brighten one ring, not stack six. */
  private readonly tender: ({ beat: Beat; at: number; stacks: number } | null)[] = [];
  private nowSim = 0;
  readonly stats: ItemVfxStats = { calls: 0, steals: 0, beats: 0 };

  constructor(groundY: number, tex: { glow: THREE.Texture; softDisc: THREE.Texture; star: THREE.Texture }) {
    this.groundY = groundY;
    this.group.name = 'vfx_items';
    this.propMat = toonMat({ color: '#ffffff', roughness: 0.34, metalness: 0 });
    this.propMat.vertexColors = true;
    this.propMat.emissive = new THREE.Color('#ffffff');
    this.propMat.emissiveIntensity = 0.10;
    this.tinMat = toonMat({ color: '#ffffff', roughness: 0.28, metalness: 0.45 });
    this.tinMat.vertexColors = true;
    const cap = (n: number) => n * MAX_FIGHTERS;
    const spriteMat = (map: THREE.Texture, additive: boolean) => {
      const m = new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      preserveDestinationAlpha(m);
      return m;
    };
    const basic = (o: THREE.MeshBasicMaterialParameters & { additive?: boolean }) => {
      const { additive, ...rest } = o;
      const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, ...rest });
      preserveDestinationAlpha(m);
      return m;
    };
    this.puffs = new BeatPool(this.group, () => {
      const mat = spriteMat(tex.softDisc, false);
      const s = new THREE.Sprite(mat); s.name = 'vfx_item_puff'; s.renderOrder = 9;
      return { obj: s, mat };
    }, cap(PER_FIGHTER.puffs));
    this.glows = new BeatPool(this.group, () => {
      const mat = spriteMat(tex.glow, true);
      const s = new THREE.Sprite(mat); s.name = 'vfx_item_glow'; s.renderOrder = 10;
      return { obj: s, mat };
    }, cap(PER_FIGHTER.glows));
    this.glowRings = new BeatPool(this.group, () => {
      const mat = basic({ color: 0xffffff, additive: true });
      const m = new THREE.Mesh(this.ringThin, mat); m.name = 'vfx_item_ring'; m.renderOrder = 6;
      return { obj: m, mat };
    }, cap(PER_FIGHTER.rings));
    this.dustRings = new BeatPool(this.group, () => {
      const mat = basic({ color: 0xffffff });
      const m = new THREE.Mesh(this.ringWide, mat); m.name = 'vfx_item_dust_ring'; m.renderOrder = 3;
      return { obj: m, mat };
    }, cap(PER_FIGHTER.rings));
    const prop = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, own = false) => new BeatPool(this.group, () => {
      const m = own ? (mat.clone() as THREE.MeshBasicMaterial) : mat;
      if (own) preserveDestinationAlpha(m);
      const mesh = new THREE.Mesh(geo, m); mesh.name = name; mesh.renderOrder = own ? 7 : 0;
      return { obj: mesh, mat: own ? (m as Beat['mat']) : null };
    }, cap(PER_FIGHTER.props));
    this.props = {
      tin: prop('vfx_item_tin', this.tinGeo, this.tinMat),
      mug: prop('vfx_item_mug', this.mugGeo, this.propMat),
      plunger: prop('vfx_item_plunger_flight', this.plungerGeo, this.propMat),
      ink: prop('vfx_item_ink_flight', this.inkGeo, this.propMat),
      rope: prop('vfx_item_rope', this.ropeGeo, this.propMat.clone()),
      drain: prop('vfx_item_drain', this.disc, basic({ map: this.swirlTex, color: 0xffffff }), true),
      column: prop('vfx_item_fridge', this.columnGeo, basic({ map: this.columnTex, color: FRIDGE, additive: true }), true),
      wilt: prop('vfx_item_wilt', this.capsGeo, this.propMat),
    };
    // The rope is ONE colour: re-paint its geometry's vertex colours rather than add a material.
    paint(this.ropeGeo, '#8E1622');
    this.pools = [this.puffs, this.glows, this.glowRings, this.dustRings, ...Object.values(this.props)];
  }

  // ── EVENT ENTRY POINTS (match.ts's event switch) ──────────────────────────────────────────

  /** `item-used`: the press. `facing` is the user's, for a throw's aim. */
  used(slot: number, itemId: ItemId, xWU: number, yWU: number, facing: { x: number; y: number }, nowSim: number): void {
    this.nowSim = nowSim;
    this.ensureSeat(slot);
    const p = groundPos(xWU, yWU);
    this.stats.beats++;
    switch (itemId) {
      case 'springform': {
        // The tin snaps open under the feet and is gone; the dust ring is the take-off.
        this.tinPop(p.x, p.z);
        this.dustRing(p.x, p.z, DUST, R * 0.7, R * 2.3, 0.42, 0.62);
        this.puffRing(p.x, p.z, 6, DUST, 0.10, R * 1.1, 0.5, 0.55);
        this.landAt[slot] = nowSim + ITEM_TUNING.springform.travelMs;
        return;
      }
      case 'warm_milk': case 'pompa': case 'squid_ink': case 'liquorice': {
        // Aimed down the facing at full reach until `item-hit` (same tick) names a victim; if
        // none comes, this IS the miss — it lands at the end of the reach and fizzles there.
        const reach = wu(itemId === 'warm_milk' ? ITEM_TUNING.warm_milk.range : GUARANTEED_VISIBLE_RADIUS);
        const aim = { x: p.x + facing.x * reach, z: p.z + facing.y * reach };
        const beat = this.throwFlight(slot, itemId, p.x, p.z, aim);
        this.throws[slot] = { beat, itemId, at: nowSim, aim };
        return;
      }
      case 'disposal': {
        // The press: a small drain opens and shuts at the user's feet. The real one opens under
        // the VICTIM with `item-hit`.
        this.drain(p.x, p.z, R * 0.55, 0.32, 0);
        return;
      }
      case 'shiitake': {
        // The wind-up's first beat — spores lift off the ring the caps will grow from. The
        // growth itself is drawn from `fighter.itemCast` in `sync`, so it is exactly as long as
        // the sim's wind-up and dies the instant the sim cancels it.
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          this.glow(p.x + Math.cos(a) * R * 1.18, this.groundY + 0.2, p.z + Math.sin(a) * R * 1.18, SPORE, 0.55, 0.9, 0.08 * i,
            { vy: 1.1, s1: 0.25 });
        }
        return;
      }
      default:
        this.stats.beats--; // passive / triggered items emit no `item-used`
    }
  }

  /** `item-resolved`: only Shiitake has a wind-up — the caps SNAP up. */
  resolved(slot: number, itemId: ItemId, xWU: number, yWU: number): void {
    if (itemId !== 'shiitake') return;
    this.ensureSeat(slot);
    const p = groundPos(xWU, yWU);
    this.stats.beats++;
    this.dustRing(p.x, p.z, GILL, R * 1.0, R * 1.9, 0.34, 0.7);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      this.glow(p.x + Math.cos(a) * R * 1.2, this.groundY + 0.7, p.z + Math.sin(a) * R * 1.2, SPORE, 0.6, 0.55, 0,
        { vx: Math.cos(a) * 1.6, vz: Math.sin(a) * 1.6, vy: 1.4, s1: 0.2 });
    }
  }

  /** `item-cancelled`: the wind-up died — the half-grown caps wilt into the floor. */
  cancelled(slot: number, itemId: ItemId, xWU: number, yWU: number): void {
    if (itemId !== 'shiitake') return;
    this.ensureSeat(slot);
    const p = groundPos(xWU, yWU);
    this.stats.beats++;
    const b = this.props.wilt.alloc();
    this.start(b, 0.42, 0, (bb, k) => {
      bb.obj.position.set(p.x, this.groundY - 0.55 * k * k, p.z);
      bb.obj.scale.set(0.75 * (1 - 0.5 * k), 0.75 * (1 - 0.8 * k), 0.75 * (1 - 0.5 * k));
      bb.obj.rotation.y = k * 0.6;
    });
    this.puffRing(p.x, p.z, 6, WILT, 0.35, R * 1.2, 0.55, 0.6);
  }

  /** `item-hit`. `seeOwner`/`seeTarget`/`seeFrom` are the observer's concealment answers
   *  (`match.ts` asks `fighterVisibleTo`); nothing is drawn at a place the observer cannot see. */
  hit(ev: ItemHit, ownerSlot: number, targetSlot: number, seeOwner: boolean, seeTarget: boolean, seeFrom: boolean, nowSim: number): void {
    this.nowSim = nowSim;
    this.ensureSeat(targetSlot);
    const to = groundPos(ev.x, ev.y);
    switch (ev.itemId) {
      case 'tenderiser': {
        if (!seeTarget) return;
        this.stats.beats++;
        this.tenderRing(targetSlot, to.x, to.z, ev.stacks, nowSim);
        return;
      }
      case 'warm_milk': case 'pompa': case 'squid_ink': case 'liquorice': {
        const id = ev.itemId;
        // Stuck where it came from: the plunger points back at its thrower.
        const from = this.seats[ownerSlot];
        this.plungerYaw[targetSlot] = from ? Math.atan2(from.x - to.x, from.z - to.z) : 0;
        const th = this.throws[ownerSlot];
        const flying = th && th.itemId === id && th.at === nowSim && th.beat.active && seeOwner;
        if (!seeTarget) {
          // The observer cannot see the victim: the throw stays a throw into nowhere (its miss
          // trajectory) rather than drawing a line to where a concealed fighter stands.
          this.pending[targetSlot]![id] = false;
          return;
        }
        this.stats.beats++;
        if (flying) {
          // Re-time the flight for the victim it found: it was launched at full REACH, and a mug
          // at a fighter 3 m away must not take as long as one thrown 10 m into nothing. Same
          // distance/18 m/s, 160-420 ms rule the director delays the landing cue by.
          const o = this.seats[ownerSlot];
          const d = o ? Math.hypot(to.x - o.x, to.z - o.z) : 0;
          th!.beat.life = Math.max(th!.beat.t + 0.03, Math.min(0.42, Math.max(0.16, d / 18)));
          this.pending[targetSlot]![id] = true;
          th!.beat.end = () => { this.pending[targetSlot]![id] = false; this.landing(id, targetSlot); };
          (th!.beat as Beat & { target?: number }).target = targetSlot;
          this.throws[ownerSlot] = null;
        } else {
          this.pending[targetSlot]![id] = false;
          this.landing(id, targetSlot);
        }
        return;
      }
      case 'disposal': {
        const from = groundPos(ev.fromX, ev.fromY);
        if (seeFrom) { this.stats.beats++; this.drain(from.x, from.z, R * 1.15, 0.62, 0); }
        if (seeTarget) {
          if (!seeFrom) this.stats.beats++;
          // The spit-out, a beat after the drain swallowed them: a splash ring wide enough that
          // the fighter they land beside sees it arrive at THEIR feet.
          this.dustRing(to.x, to.z, SPLASH, R * 0.6, R * 2.8, 0.5, 0.75, 0.16);
          this.glowRing(to.x, this.groundY + 0.06, to.z, SPLASH, R * 0.9, R * 2.2, 0.36, 0.8, 0.16);
          this.puffRing(to.x, to.z, 8, SPLASH, 0.9, R * 1.3, 0.5, 0.75, 0.16, 1.6);
          this.glow(to.x, BODY_Y + 0.4, to.z, '#FFFFFF', 1.6, 0.26, 0.16, { s0: 0.4, star: true });
        }
        return;
      }
      case 'shiitake': {
        if (!seeTarget) return;
        this.stats.beats++;
        this.glowRing(to.x, BODY_Y * 0.6, to.z, SPORE, R * 0.7, R * 1.6, 0.3, 0.9);
        return;
      }
      default:
        return;
    }
  }

  /** `item-revived` (Leftovers): the fridge light comes on over the corpse. */
  revived(xWU: number, yWU: number): void {
    const p = groundPos(xWU, yWU);
    this.stats.beats++;
    const b = this.props.column.alloc();
    this.start(b, 0.95, 0, (bb, k) => {
      const m = bb.mat!;
      const rise = Math.min(1, k / 0.18);
      bb.obj.position.set(p.x, this.groundY, p.z);
      bb.obj.scale.set(1, 0.25 + 0.75 * rise, 1);
      m.opacity = 0.85 * rise * (1 - k) ** 1.2;
    });
    this.glowRing(p.x, this.groundY + 0.05, p.z, FRIDGE, R * 0.6, R * 2.0, 0.6, 0.85);
  }

  // ── PER-FRAME ──────────────────────────────────────────────────────────────────────────────

  /**
   * The STATES, read from the sim. `shown[slot]` is the observer's concealment answer for that
   * seat (a state on a fighter the observer cannot see is not drawn).
   */
  sync(state: MatchState, roster: readonly Fighter[], shown: readonly boolean[]): void {
    const now = state.elapsed;
    this.nowSim = now;
    for (let slot = 0; slot < roster.length; slot++) {
      const f = roster[slot]!;
      const pos = groundPos(f.x, f.y);
      this.ensureSeat(slot);
      const seat = this.seats[slot]!;
      seat.x = pos.x; seat.z = pos.z; seat.alive = f.alive;

      // SPRINGFORM's landing is a state-driven beat: due when the sim's travel is over.
      const land = this.landAt[slot]!;
      if (land === land && now >= land) {
        this.landAt[slot] = NaN;
        if (f.alive && shown[slot]) {
          this.dustRing(pos.x, pos.z, DUST, R * 0.6, R * 1.9, 0.36, 0.55);
          this.puffRing(pos.x, pos.z, 5, DUST, 0.12, R * 0.9, 0.45, 0.5);
        }
      }

      const it = f.item;
      const pend = this.pending[slot]!;
      const asleep = f.alive && now < it.sleepUntil && !pend.warm_milk;
      const clogged = f.alive && now < it.clogUntil && !pend.pompa;
      const rooted = f.alive && now < it.rootUntil && !pend.liquorice;
      const blotted = f.alive && now < it.blotUntil && !pend.squid_ink;
      const shielded = f.alive && now < it.shieldUntil;
      const cast = f.itemCast;
      const winding = f.alive && cast !== null && cast.itemId === 'shiitake';
      let v = this.slots[slot] ?? null;
      if (!v && !(asleep || clogged || rooted || blotted || shielded || winding)) continue;
      v ??= this.buildSlot(slot);
      const show = shown[slot] === true;
      v.root.position.set(pos.x, this.groundY, pos.z);
      // The last 300 ms of any state shrink it out, so its END is as readable as its start.
      const tail = (until: number) => Math.min(1, Math.max(0, (until - now) / 300));

      // ── ASLEEP: drifting Zs above, a milk pool beneath ──
      const sleepOn = show && asleep;
      v.pool.visible = sleepOn;
      if (sleepOn) {
        const k = tail(it.sleepUntil);
        v.pool.scale.setScalar(R * 1.08 * (0.6 + 0.4 * k) * (1 + 0.03 * Math.sin(now * 0.004)));
        (v.pool.material as THREE.MeshBasicMaterial).opacity = 0.72 * k;
      }
      v.zs.forEach((z, i) => {
        z.visible = sleepOn;
        if (!sleepOn) return;
        const ph = ((now / 1700) + i / v!.zs.length) % 1;
        z.position.set(R * 0.35 + Math.sin(ph * Math.PI * 2 + i) * 0.18, H * 1.02 + ph * 1.05, -R * 0.1);
        z.scale.setScalar(0.42 + ph * 0.34);
        (z.material as THREE.SpriteMaterial).opacity = Math.min(1, ph / 0.18, (1 - ph) / 0.3) * tail(it.sleepUntil);
        (z.material as THREE.SpriteMaterial).rotation = -0.25 + Math.sin(ph * 4 + i) * 0.12;
      });

      // ── CLOGGED: the plunger, stuck on, pointing back at its thrower ──
      v.plunger.visible = show && clogged;
      if (v.plunger.visible) {
        const yaw = this.plungerYaw[slot] ?? 0;
        const age = (now - (it.clogUntil - ITEM_TUNING.pompa.clogMs)) / 1000;
        const wobble = 0.32 * Math.exp(-age * 5) * Math.sin(age * 34);
        v.plunger.position.set(Math.sin(yaw) * R * 0.55, H * 0.66, Math.cos(yaw) * R * 0.55);
        v.plunger.rotation.set(-0.5 + wobble, yaw, 0, 'YXZ');
        v.plunger.scale.setScalar(tail(it.clogUntil));
      }

      // ── ROOTED: the liquorice coil, wound round the shins ──
      v.coil.visible = show && rooted;
      if (v.coil.visible) {
        const k = tail(it.rootUntil);
        v.coil.rotation.y = now * 0.0007;
        v.coil.scale.set(k * (1 + 0.025 * Math.sin(now * 0.006)), k, k * (1 + 0.025 * Math.sin(now * 0.006)));
      }

      // ── BLOTTED: a small ink cloud over the head (the screen-space half is `ink.ts`'s) ──
      v.ink.visible = show && blotted;
      if (v.ink.visible) {
        v.ink.position.set(0, H * 1.18 + Math.sin(now * 0.003) * 0.06, 0);
        v.ink.rotation.y = now * 0.0011;
        v.ink.scale.setScalar(0.85 * tail(it.blotUntil));
      }

      // ── SHIELDED: the caps, turning; WINDING UP: the same caps growing out of the floor ──
      v.shield.visible = show && shielded;
      if (v.shield.visible) {
        v.shield.rotation.y = now * 0.0009;
        v.shield.scale.setScalar(tail(it.shieldUntil));
      }
      const windOn = show && winding;
      v.windCaps.visible = windOn;
      v.windRing.visible = windOn;
      if (windOn) {
        const span = Math.max(1, cast!.resolvesAt - cast!.startedAt);
        const p = Math.min(1, Math.max(0, (now - cast!.startedAt) / span));
        v.windCaps.scale.setScalar(0.35 + 0.6 * p);
        v.windCaps.position.y = -0.25 * (1 - p);
        v.windCaps.rotation.y = -now * 0.0006;
        // A ring that fills and pulses FASTER as the shield nears: the counterable read.
        const pulse = 0.5 + 0.5 * Math.sin(now * (0.006 + 0.018 * p));
        v.windRing.scale.setScalar(R * 1.55);
        (v.windRing.material as THREE.MeshBasicMaterial).opacity = (0.25 + 0.55 * p) * (0.7 + 0.3 * pulse);
      }
    }
  }

  /** One-shots, on the hit-stop-free clock. */
  update(dt: number): void {
    for (const p of this.pools) p.update(dt);
    let calls = 0; let steals = 0;
    for (const p of this.pools) { calls += p.calls; steals += p.steals; }
    this.stats.calls = calls; this.stats.steals = steals;
  }

  clear(): void {
    for (const p of this.pools) p.reset();
    for (const v of this.slots) if (v) for (const o of v.root.children) o.visible = false;
    for (const p of this.pending) for (const k of THROWN) p[k] = false;
    this.landAt.fill(NaN);
    this.throws.fill(null);
    this.tender.fill(null);
  }

  dispose(): void {
    this.clear();
    this.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (m) for (const mm of Array.isArray(m) ? m : [m]) mm.dispose();
    });
    for (const g of [this.ringThin, this.ringWide, this.disc, this.plungerGeo, this.mugGeo, this.inkGeo,
      this.coilGeo, this.capsGeo, this.tinGeo, this.ropeGeo, this.columnGeo]) g.dispose();
    for (const t of [this.zTex, this.puddleTex, this.swirlTex, this.columnTex]) t.dispose();
    this.group.removeFromParent();
  }

  // ── INTERNALS ──────────────────────────────────────────────────────────────────────────────

  private ensureSeat(slot: number): void {
    while (this.seats.length <= slot) {
      this.seats.push({ x: 0, z: 0, alive: false });
      this.pending.push({ warm_milk: false, pompa: false, squid_ink: false, liquorice: false });
      this.plungerYaw.push(0);
      this.landAt.push(NaN);
      this.throws.push(null);
      this.tender.push(null);
      this.slots.push(null);
    }
  }

  /** A seat's state visuals, built the first frame that seat has a state to show — a match in
   *  which nobody uses an item builds none of them. */
  private buildSlot(slot: number): SlotVis {
    const root = new THREE.Group(); root.name = `vfx_item_slot_${slot}`;
    const poolMat = new THREE.MeshBasicMaterial({ map: this.puddleTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide });
    preserveDestinationAlpha(poolMat);
    const pool = new THREE.Mesh(this.disc, poolMat); pool.name = 'vfx_item_milk_pool'; pool.renderOrder = 2;
    pool.position.y = 0.012;
    const zs: THREE.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.SpriteMaterial({ map: this.zTex, transparent: true, opacity: 0, depthWrite: false });
      preserveDestinationAlpha(m);
      const z = new THREE.Sprite(m); z.name = 'vfx_item_sleep_z'; z.renderOrder = 11;
      zs.push(z);
    }
    const plunger = new THREE.Mesh(this.plungerGeo, this.propMat); plunger.name = 'vfx_item_plunger';
    const coil = new THREE.Mesh(this.coilGeo, this.propMat); coil.name = 'vfx_item_coil';
    // A LIT, glossy blob of ink — not a flat dark sprite: a soft near-black disc reads as a hole
    // in the floor behind the fighter (V1b's "a hole torn in the floor"); a wet blob with a
    // specular highlight reads as a THING hanging over their head.
    const ink = new THREE.Mesh(this.inkGeo, this.propMat); ink.name = 'vfx_item_ink_cloud';
    const shield = new THREE.Mesh(this.capsGeo, this.propMat); shield.name = 'vfx_item_shield';
    const windCaps = new THREE.Mesh(this.capsGeo, this.propMat); windCaps.name = 'vfx_item_shield_windup';
    const ringMat = new THREE.MeshBasicMaterial({ color: SPORE, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.FrontSide, blending: THREE.AdditiveBlending });
    preserveDestinationAlpha(ringMat);
    const windRing = new THREE.Mesh(this.ringThin, ringMat); windRing.name = 'vfx_item_windup_ring'; windRing.renderOrder = 6;
    windRing.position.y = 0.02;
    for (const o of [pool, ...zs, plunger, coil, ink, shield, windCaps, windRing]) { o.visible = false; root.add(o); }
    this.group.add(root);
    const v: SlotVis = { root, pool, zs, plunger, coil, ink, shield, windCaps, windRing };
    this.slots[slot] = v;
    return v;
  }

  private start(b: Beat, life: number, delay: number, run: (b: Beat, k: number, dt: number) => void): void {
    b.active = true; b.t = 0; b.life = Math.max(0.001, life); b.delay = delay; b.run = run; b.end = null;
    (b as Beat & { target?: number }).target = undefined;
    b.obj.visible = delay <= 0;
    b.obj.rotation.set(0, 0, 0);
    b.obj.scale.setScalar(1);
    run(b, 0, 0);
  }

  /** A soft puff that drifts and fades. `vel` in m/s. */
  private puff(x: number, y: number, z: number, hex: string, size: number, life: number, delay: number,
    o: { vx?: number; vy?: number; vz?: number; s1?: number; a0?: number } = {}): void {
    const b = this.puffs.alloc();
    const vx = o.vx ?? 0; const vy = o.vy ?? 0; const vz = o.vz ?? 0;
    const s1 = o.s1 ?? 1.6; const a0 = o.a0 ?? 0.75;
    b.mat!.color!.set(hex);
    this.start(b, life, delay, (bb, k) => {
      const t = k * life;
      bb.obj.position.set(x + vx * t, y + vy * t, z + vz * t);
      bb.obj.scale.setScalar(size * (1 + (s1 - 1) * Math.sqrt(k)));
      bb.mat!.opacity = a0 * (1 - k) * Math.min(1, k * 8 + 0.3);
    });
  }

  private glow(x: number, y: number, z: number, hex: string, size: number, life: number, delay: number,
    o: { vx?: number; vy?: number; vz?: number; s0?: number; s1?: number; star?: boolean } = {}): void {
    const b = this.glows.alloc();
    const vx = o.vx ?? 0; const vy = o.vy ?? 0; const vz = o.vz ?? 0;
    const s0 = o.s0 ?? 1; const s1 = o.s1 ?? 1;
    b.mat!.color!.set(hex).lerp(WHITE, 0.25);
    this.start(b, life, delay, (bb, k) => {
      const t = k * life;
      bb.obj.position.set(x + vx * t, y + vy * t, z + vz * t);
      bb.obj.scale.setScalar(size * (s0 + (s1 - s0) * k));
      bb.mat!.opacity = (1 - k) ** 1.4;
    });
  }

  private puffRing(x: number, z: number, n: number, hex: string, y: number, radius: number, size: number, life: number,
    delay = 0, speed = 1.1): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (x * 7.3 + z * 3.1) % 1;
      this.puff(x + Math.cos(a) * radius * 0.5, this.groundY + y + 0.15, z + Math.sin(a) * radius * 0.5, hex, size, life, delay,
        { vx: Math.cos(a) * speed * 1.4, vz: Math.sin(a) * speed * 1.4, vy: 0.5 });
    }
  }

  /** Expanding flat ring on the floor, normal blend (dust, splash) — reads on the light floor
   *  because it is OPAQUE-ish and warm, not because it glows. */
  private dustRing(x: number, z: number, hex: string, r0: number, r1: number, life: number, a0: number, delay = 0): void {
    const b = this.dustRings.alloc();
    b.mat!.color!.set(hex);
    this.start(b, life, delay, (bb, k) => {
      const e = 1 - (1 - k) ** 2.2;
      bb.obj.position.set(x, this.groundY + 0.02, z);
      bb.obj.scale.setScalar(r0 + (r1 - r0) * e);
      bb.mat!.opacity = a0 * (1 - k) ** 1.3;
    });
  }

  private glowRing(x: number, y: number, z: number, hex: string, r0: number, r1: number, life: number, a0: number, delay = 0): void {
    const b = this.glowRings.alloc();
    b.mat!.color!.set(hex).lerp(WHITE, 0.2);
    this.start(b, life, delay, (bb, k) => {
      const e = 1 - (1 - k) ** 2;
      bb.obj.position.set(x, y, z);
      bb.obj.scale.setScalar(r0 + (r1 - r0) * e);
      bb.mat!.opacity = a0 * (1 - k);
    });
  }

  private tinPop(x: number, z: number): void {
    const b = this.props.tin.alloc();
    this.start(b, 0.34, 0, (bb, k) => {
      // Squash, then the spring stretches it tall, then it shrinks away: the arc's first frame.
      const sy = k < 0.25 ? 0.35 + 2.6 * k : k < 0.5 ? 1 + 1.2 * (0.5 - k) : 1 - (k - 0.5) * 1.8;
      const sx = k < 0.25 ? 1.15 - 0.4 * k : 1 - (k - 0.25) * 0.9;
      bb.obj.position.set(x, this.groundY + 0.11 * sy, z);
      bb.obj.scale.set(Math.max(0.05, sx), Math.max(0.05, sy), Math.max(0.05, sx));
    });
  }

  private drain(x: number, z: number, radius: number, life: number, delay: number): void {
    const b = this.props.drain.alloc();
    this.start(b, life, delay, (bb, k, dt) => {
      // Opens fast, swirls hard, shuts.
      const open = k < 0.2 ? k / 0.2 : k > 0.72 ? Math.max(0, (1 - k) / 0.28) : 1;
      bb.obj.position.set(x, this.groundY + 0.025, z);
      bb.obj.scale.setScalar(radius * (0.15 + 0.85 * open));
      bb.obj.rotation.y -= dt * 11;
      bb.mat!.opacity = 0.95 * Math.min(1, 0.35 + open * 1.5);
    });
    this.dustRing(x, z, STEEL, radius * 0.95, radius * 1.15, life, 0.7, delay);
  }

  private tenderRing(slot: number, x: number, z: number, stacks: number, nowSim: number): void {
    const prev = this.tender[slot];
    // A later pellet of the same volley (within 150 ms sim) brightens the ring it already has.
    if (prev && prev.beat.active && nowSim - prev.at <= 150 && nowSim >= prev.at) {
      prev.stacks = Math.max(prev.stacks, stacks);
      return;
    }
    const b = this.glowRings.alloc();
    const rec = { beat: b, at: nowSim, stacks };
    this.tender[slot] = rec;
    this.start(b, 0.30, 0, (bb, k) => {
      const s = Math.min(6, Math.max(1, rec.stacks));
      const q = (s - 1) / 5;
      bb.mat!.color!.copy(TENDER_LO).lerp(TENDER_HI, q);
      // COMPRESSION: it closes IN on the body.
      const e = 1 - (1 - k) ** 2;
      bb.obj.position.set(x, BODY_Y * 0.85, z);
      bb.obj.scale.setScalar(R * (1.9 - 0.85 * e) * (1 + 0.12 * q));
      bb.mat!.opacity = (0.5 + 0.5 * q) * Math.min(1, 0.4 + k * 6) * (1 - k);   // lands ON the hit frame
    });
    if (stacks >= 6) this.glow(x, H + 0.35, z, '#FFF3C8', 1.5, 0.3, 0, { s0: 0.5, s1: 1.2 });
  }

  /** A thrown item in the air, from the user's hand toward `aim` — re-aimed onto a victim if
   *  `hit` names one this tick (`target` set on the beat), else it lands on `aim` and fizzles. */
  private throwFlight(ownerSlot: number, itemId: ThrownId, x0: number, z0: number, aim: { x: number; z: number }): Beat {
    const pool = itemId === 'warm_milk' ? this.props.mug : itemId === 'pompa' ? this.props.plunger
      : itemId === 'squid_ink' ? this.props.ink : this.props.rope;
    const b = pool.alloc() as Beat & { target?: number };
    const apex = itemId === 'pompa' ? 0.5 : itemId === 'liquorice' ? 0 : 1.3;
    let trailAcc = 0;
    let missEnd = true;
    // Distance-scaled flight: ~18 m/s, never shorter than 160 ms or longer than 420 ms.
    const dist0 = Math.hypot(aim.x - x0, aim.z - z0);
    const life = Math.min(0.42, Math.max(0.16, dist0 / 18));
    this.start(b, life, 0, (bb, k, dt) => {
      const tgt = bb as Beat & { target?: number };
      const owner = this.seats[ownerSlot];
      const sx = owner ? owner.x : x0; const sz = owner ? owner.z : z0;
      let ex = aim.x; let ez = aim.z; let ey = this.groundY + 0.2;
      if (tgt.target !== undefined) {
        const v = this.seats[tgt.target];
        if (v) { ex = v.x; ez = v.z; ey = BODY_Y; missEnd = false; }
      }
      const px = sx + (ex - sx) * k; const pz = sz + (ez - sz) * k;
      const py = HAND_Y + (ey - HAND_Y) * k + apex * 4 * k * (1 - k);
      if (itemId === 'liquorice') {
        // The rope WHIPS out: one end in the hand, the other end at the tip.
        const len = Math.max(0.05, Math.hypot(px - sx, pz - sz, py - HAND_Y));
        bb.obj.position.set(sx, HAND_Y, sz);
        bb.obj.lookAt(px, py, pz);
        bb.obj.scale.set(1, 1, len);
        return;
      }
      bb.obj.position.set(px, py, pz);
      const yaw = Math.atan2(ex - sx, ez - sz);
      if (itemId === 'pompa') bb.obj.rotation.set(0, yaw + Math.PI, 0);    // flies flat, cup first
      else bb.obj.rotation.set(k * 9, yaw, k * 4);                          // tumbles
      trailAcc += dt;
      if (trailAcc > 0.035) {
        trailAcc = 0;
        if (itemId === 'warm_milk') this.puff(px, py + 0.25, pz, STEAM, 0.32, 0.5, 0, { vy: 0.9, s1: 2.0, a0: 0.42 });
        else if (itemId === 'squid_ink') this.puff(px, py, pz, INK, 0.30, 0.42, 0, { vy: -0.6, s1: 1.4, a0: 0.7 });
      }
    });
    b.end = () => { if (missEnd) this.fizzle(itemId, aim.x, aim.z); };
    return b;
  }

  /** A throw that found nobody: it lands at the end of its reach and splashes there. */
  private fizzle(itemId: ThrownId, x: number, z: number): void {
    const hex = itemId === 'warm_milk' ? MILK : itemId === 'squid_ink' ? INK : itemId === 'pompa' ? RUBBER : LIQUORICE;
    this.puffRing(x, z, 5, hex, 0.05, R * 0.7, 0.42, 0.45);
  }

  /** The moment a thrown item reaches its victim. */
  private landing(itemId: ThrownId, slot: number): void {
    const v = this.seats[slot];
    if (!v) return;
    const x = v.x; const z = v.z;
    switch (itemId) {
      case 'warm_milk':
        // The mug breaks over the head: milk splashes outward and drips.
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          this.puff(x + Math.cos(a) * 0.2, H * 0.95, z + Math.sin(a) * 0.2, MILK, 0.42, 0.5, 0,
            { vx: Math.cos(a) * 2.2, vz: Math.sin(a) * 2.2, vy: -0.8, s1: 1.3, a0: 0.9 });
        }
        this.glow(x, H * 0.95, z, '#FFFFFF', 1.1, 0.2, 0, { s0: 0.4 });
        return;
      case 'pompa':
        // THWOCK: a hard white pop where the cup lands.
        {
          const yaw = this.plungerYaw[slot] ?? 0;
          this.glow(x + Math.sin(yaw) * R * 0.6, H * 0.66, z + Math.cos(yaw) * R * 0.6, '#FFFFFF', 1.25, 0.18, 0, { s0: 0.5, star: true });
          this.glowRing(x, H * 0.66, z, '#FFD6CF', R * 0.5, R * 1.4, 0.2, 0.75);
        }
        return;
      case 'squid_ink':
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          this.puff(x + Math.cos(a) * 0.25, H * 0.8, z + Math.sin(a) * 0.25, INK, 0.5, 0.55, 0,
            { vx: Math.cos(a) * 2.6, vz: Math.sin(a) * 2.6, vy: -0.4, s1: 1.25, a0: 0.85 });
        }
        return;
      case 'liquorice':
        // The rope snaps tight: a ring that closes onto the shins.
        this.glowRing(x, 0.55 + this.groundY, z, LIQUORICE_HI, R * 1.6, R * 0.8, 0.22, 0.85);
        this.puffRing(x, z, 4, LIQUORICE, 0.3, R * 0.9, 0.32, 0.4);
        return;
    }
  }
}
