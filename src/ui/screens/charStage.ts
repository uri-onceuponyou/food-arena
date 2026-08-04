/**
 * The menu's 3D character portrait.
 *
 * This is the same machinery `preview.html?piece=character&id=<id>` uses — the real
 * `Stage` (toon materials, lighting, IBL, the colour grade) and the real
 * `createCharacter()` factory — with the camera set up exactly the way
 * `src/preview.ts` sets it up for a character piece. That matters: those framing
 * numbers — `frameMode: 'subject'`, a shallow pitch, a bright ground disc — are the
 * ones every character was authored and critiqued against, so a model approved in
 * preview looks the same in the menu. Picking new ones by eye would make the menu a
 * third, unjudged framing. The one deliberate departure is `applyFraming()` below,
 * which also fits WIDTH; see its comment for why a menu column forces that.
 *
 * ── Why this is a singleton ─────────────────────────────────────────────────
 * A WebGL context is expensive to create and browsers cap how many can be live.
 * Home and character select both want a hero portrait, and the user bounces between
 * them constantly, so the context is created once, re-parented on navigation, and
 * only destroyed when a MATCH starts (which needs the GPU for itself). The shell
 * owns that lifecycle — see `disposeCharacterStage()`.
 */

import * as THREE from 'three';
import { Stage } from '../../render/stage';
import { createCharacter } from '../../characters/registry';
import type { CharacterModel } from '../../characters/types';
import { CHARACTER_HEIGHT } from '../../units';
import { toonMat, RAMP_SOFT, flatMat } from '../../render/toon';
import type { CharacterId } from '../../game/rules';

/**
 * Backdrop for the portrait. Deliberately the SAME bright cyan `preview.ts` defaults
 * to for a character piece, and for the same reason recorded there: a dark ground
 * made every model read as gloomy clay, and the reference presents characters on
 * bright saturated grounds. It is also complementary to the menu's warm orange
 * backdrop, so the portrait reads as a lit display case rather than a hole.
 */
const PORTRAIT_BG = 0x39b7e8;
/**
 * Ground and pedestal.
 *
 * Round 1 used `#8fd6f2` ground with a blue plinth and the whole lower third came
 * back as one pale, near-white wash — the plinth and the floor were the same colour
 * once the toon ramp and the grade had brightened both, so the hero read as floating
 * on a blank field. The floor is now a deeper blue and the plinth is WARM, which is
 * the same warm-object-on-cool-ground separation Zooba's hero pedestal uses
 * (`reference/images/zooba/tablet_5.jpg`) and ties the stand to the menu's gold.
 */
const PORTRAIT_GROUND = '#3FA8D4';
const PEDESTAL_TOP = '#F4C55E';
const PEDESTAL_SIDE = '#B9701F';

/** Height of the plinth the hero stands on, in metres. */
const PLINTH_H = 0.2;
/** Fraction of the frame's HEIGHT the subject fills when height is the binding axis. */
const V_FILL = 0.62;
/** Widest part of the plinth, in metres — it has to be framed too. */
const PLINTH_BASE_W = 2.48;
/** Fraction of the frame's WIDTH the subject may fill when width is binding. */
const H_FILL = 0.86;

export interface CharacterStage {
  /** Move the canvas into `host` (and size to it). Safe to call repeatedly. */
  attachTo(host: HTMLElement): void;
  /** Remove the canvas from the DOM without destroying the GL context. */
  detach(): void;
  /** Swap the displayed character. No-op if already showing `id`. */
  show(id: CharacterId): void;
  /** One-shot attack animation — the menu's "tap the mascot" easter egg. */
  poke(): void;
  /** Advance animation and render. Driven by whichever screen owns the stage. */
  update(dtSeconds: number): void;
  resize(): void;
  /** QA-only framing readout. See the implementation. */
  info(): Record<string, unknown>;
  dispose(): void;
}

class MenuCharacterStage implements CharacterStage {
  private readonly stage: Stage;
  private readonly holder = document.createElement('div');
  private model: CharacterModel | null = null;
  private currentId: CharacterId | null = null;
  /** Measured bounds of the mounted model, in metres. Drives `applyFraming`. */
  private subjectW = CHARACTER_HEIGHT * 0.8;
  private subjectH = CHARACTER_HEIGHT;
  private elapsed = 0;
  /** Seconds remaining on the entrance pop; drives a short scale-in on swap. */
  private introT = 0;
  private observer: ResizeObserver | null = null;
  private contactShadow: THREE.Mesh | null = null;
  private disposed = false;

  constructor() {
    // A holder the Stage can measure. The Stage appends its canvas here and reads
    // clientWidth/Height off it on every resize, so it must be a real sized box.
    this.holder.style.cssText = 'position:absolute;inset:0;';

    this.stage = new Stage({
      container: this.holder,
      background: PORTRAIT_BG,
      // Fades the ground to the backdrop colour BEFORE the disc's own edge is
      // reached — otherwise the disc terminates on a visible arc across the upper
      // half of the panel, which reads as a floating island rather than as ground.
      fog: { color: PORTRAIT_BG, near: 9, far: 22 },
      camera: {
        pitchDeg: 20,
        yawDeg: 0,
        frameMode: 'subject',
        subjectHeight: CHARACTER_HEIGHT,
        subjectFill: 0.60,
        targetHeight: CHARACTER_HEIGHT * 0.52,
        followLerp: 1,
      },
      maxPixelRatio: 2,
    });
    this.stage.canvas.style.cssText = 'display:block;width:100%;height:100%;';

    this.buildPedestal();
    this.stage.rig.snapTo(0, 0);
    this.stage.lighting.focus(0, 0, 5);
  }

  /** Shadow-catching disc plus a low plinth, so the hero is standing on a stage and
   *  not floating in a void — the single biggest "is this a shipped game" tell in
   *  every character-select screen in the reference set. */
  private buildPedestal(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 64),
      toonMat({ color: PORTRAIT_GROUND, ramp: RAMP_SOFT() }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.noOutline = true;
    ground.name = 'menu_ground';
    this.stage.scene.add(ground);

    const side = new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.24, PLINTH_H, 44),
      toonMat({ color: PEDESTAL_SIDE, ramp: RAMP_SOFT() }),
    );
    side.position.y = PLINTH_H / 2;
    side.receiveShadow = true;
    side.castShadow = true;
    side.userData.noOutline = true;
    this.stage.scene.add(side);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(1.10, 1.10, 0.04, 44),
      toonMat({ color: PEDESTAL_TOP, ramp: RAMP_SOFT() }),
    );
    top.position.y = PLINTH_H + 0.018;
    top.receiveShadow = true;
    top.userData.noOutline = true;
    this.stage.scene.add(top);

    // Explicit contact shadow on the plinth face.
    //
    // The key light already casts a long shadow across the ground, but that reads as
    // "something is over there", not as "this object is standing HERE" — and both
    // blind critics independently called the hero out as floating. A tight, soft,
    // radially-faded ellipse directly under the feet is the cheapest and most
    // reliable way to anchor a character to a surface, and it is the same trick the
    // arena uses for prop grounding (see the contact/AO decal note in PROGRESS.md,
    // where removing the equivalent rings made every pad-mounted prop float).
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 40),
      flatMat('#000000', { transparent: true, opacity: 0.34 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = PLINTH_H + 0.045;
    shadow.scale.set(1, 1, 0.62);
    shadow.userData.noOutline = true;
    shadow.renderOrder = 2;
    this.contactShadow = shadow;
    this.stage.scene.add(shadow);
  }

  /**
   * Fit the subject to the panel on BOTH axes.
   *
   * `frameMode: 'subject'` only fits HEIGHT — which is correct for `preview.html`,
   * whose plates are tall (900x1100). A menu hero column is the opposite shape: at
   * 1600x900 the character-select hero slot is ~300x745, aspect 0.40, and fitting a
   * 2.5 m tall subject to 62% of that height puts its 2.3 m width straight off both
   * sides. Round 1 shipped exactly that and lost Hamburger's lettuce and tomato.
   *
   * So the vertical fill is capped by whatever the WIDTH can afford, using the
   * subject's own measured bounding box — which matters because the cast is not one
   * shape: Hot Dog is wider than it is tall, Water Bottle is the reverse, and a
   * single hand-picked fill cannot serve both.
   */
  private applyFraming(): void {
    const cam = this.stage.rig.camera;
    const aspect = cam.aspect > 0 && Number.isFinite(cam.aspect) ? cam.aspect : 1;
    // Frame the WHOLE assembly, plinth included. Framing the character alone let the
    // plinth run off the bottom edge on a wide panel, which reads as a cropped
    // photograph rather than as a hero on a stand.
    const h = Math.max(0.5, this.subjectH) + PLINTH_H;
    const w = Math.max(0.5, this.subjectW, PLINTH_BASE_W);

    // Vertical fill we would like, and the largest one whose implied visible WIDTH
    // still leaves the subject inside H_FILL of the frame horizontally.
    const fillFromWidth = (H_FILL * aspect * h) / w;
    this.stage.rig.subjectHeight = h;
    this.stage.rig.subjectFill = THREE.MathUtils.clamp(Math.min(V_FILL, fillFromWidth), 0.2, V_FILL);
    this.stage.rig.targetHeight = h * 0.5;
    this.stage.rig.apply();
  }

  attachTo(host: HTMLElement): void {
    if (this.disposed) return;
    if (this.holder.parentElement !== host) host.appendChild(this.holder);
    this.observer?.disconnect();
    // ResizeObserver rather than a window listener: the portrait's box changes when
    // the LAYOUT changes (a stats panel growing, a roster reflowing), not only when
    // the window does, and a stale drawing-buffer size is instantly visible.
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  detach(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.holder.remove();
  }

  show(id: CharacterId): void {
    if (this.disposed || id === this.currentId) return;
    if (this.model) {
      this.stage.scene.remove(this.model.root);
      this.model.dispose();
    }
    this.model = createCharacter(id);
    this.model.play('idle');
    this.stage.scene.add(this.model.root);

    // Measure at rest, BEFORE the entrance pop scales the root — the framing has to
    // describe the character, not the animation it happens to be mid-way through.
    const box = new THREE.Box3().setFromObject(this.model.root);
    this.subjectH = Math.max(0.5, box.max.y - box.min.y);
    // Measured as twice the largest offset FROM THE AXIS, not as the raw box width.
    // The camera aims at x = 0, and several characters are asymmetric about it
    // (Hamburger holds a spatula out to one side), so a symmetric fit around the box
    // centre crops the long side. Depth counts too: the portrait sways +/-22 degrees,
    // so a shallow-but-wide character presents its depth to camera at the extremes of
    // the sway — framing the worst case once beats pumping the zoom every frame.
    this.subjectW = 2 * Math.max(
      0.25,
      Math.abs(box.min.x), Math.abs(box.max.x),
      Math.abs(box.min.z), Math.abs(box.max.z),
    );

    // Stand ON the plinth, feet on its top face, whatever the model's own foot line is.
    this.model.root.position.y = PLINTH_H + 0.02 - box.min.y;

    // Size the contact patch to this character's own footprint — a Hot Dog and a
    // Water Bottle do not share a shadow.
    if (this.contactShadow) {
      const foot = THREE.MathUtils.clamp(
        Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.42, 0.42, 1.05,
      );
      this.contactShadow.scale.set(foot / 0.78, 1, (foot / 0.78) * 0.62);
    }

    this.currentId = id;
    this.introT = 0.34;
    this.applyFraming();
  }

  poke(): void {
    this.model?.play('attack');
  }

  update(dt: number): void {
    if (this.disposed) return;
    this.elapsed += dt;

    // Slow turntable sway rather than a full spin: a continuous rotation makes it
    // impossible to read a silhouette, and every character on this project is
    // authored to face +Z. +/-22 degrees shows the profile without ever losing the
    // front three-quarter view the models were judged at.
    this.stage.rig.yawDeg = Math.sin(this.elapsed * 0.42) * 22;

    if (this.model) {
      // Entrance pop on swap — a beat of squash/stretch so switching characters
      // feels like a card being slammed down, not a texture swap.
      if (this.introT > 0) {
        this.introT = Math.max(0, this.introT - dt);
        const p = 1 - this.introT / 0.34;
        const k = Math.sin(p * Math.PI) * (1 - p * 0.4);
        this.model.root.scale.setScalar(1 + k * 0.16);
        this.model.root.rotation.y = (1 - p) * -0.9;
      } else {
        this.model.root.scale.setScalar(1);
        this.model.root.rotation.y = 0;
      }
      this.model.update({ dt, elapsed: this.elapsed, moveSpeed01: 0, health01: 1 });
    }

    this.stage.render(dt);
  }

  resize(): void {
    if (this.disposed) return;
    this.stage.resize();
    // Framing depends on the panel's aspect, which `stage.resize()` has just
    // changed — so it has to be recomputed here, not only on character swap.
    this.applyFraming();
  }

  /**
   * QA hook, in the same spirit as `window.__preview.info()`. Reports where the
   * portrait camera actually is and where the model actually lands on screen, so a
   * framing regression is a number rather than an impression. Never read by the
   * menus themselves.
   */
  info(): Record<string, unknown> {
    const cam = this.stage.rig.camera;
    const box = this.model ? new THREE.Box3().setFromObject(this.model.root) : null;
    const project = (v: THREE.Vector3) => {
      const p = v.clone().project(cam);
      return { x: +((p.x * 0.5 + 0.5)).toFixed(3), y: +((1 - (p.y * 0.5 + 0.5))).toFixed(3) };
    };
    const rig = this.stage.rig;
    return {
      id: this.currentId,
      aspect: +cam.aspect.toFixed(3),
      fill: +rig.subjectFill.toFixed(3),
      subject: { w: +this.subjectW.toFixed(2), h: +this.subjectH.toFixed(2) },
      cameraOk: Number.isFinite(cam.position.x) && Number.isFinite(cam.position.y),
      // Normalised 0..1 screen coords of the model's extremes. All four must sit
      // inside [0,1] for the hero to be fully in frame — that is the framing
      // acceptance check, and it is a number rather than an impression.
      feet: box ? project(new THREE.Vector3(0, box.min.y, 0)) : null,
      crown: box ? project(new THREE.Vector3(0, box.max.y, 0)) : null,
      left: box ? project(new THREE.Vector3(box.min.x, (box.min.y + box.max.y) / 2, 0)) : null,
      right: box ? project(new THREE.Vector3(box.max.x, (box.min.y + box.max.y) / 2, 0)) : null,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.observer = null;
    if (this.model) {
      this.stage.scene.remove(this.model.root);
      this.model.dispose();
      this.model = null;
    }
    this.stage.dispose();
    this.holder.remove();
  }
}

let instance: MenuCharacterStage | null = null;

declare global {
  interface Window {
    /** QA-only handle on the menu portrait. See `MenuCharacterStage.info()`. */
    __charStage?: () => Record<string, unknown> | null;
  }
}

/** The shared portrait stage, created on first use. */
export function getCharacterStage(): CharacterStage {
  if (!instance) {
    instance = new MenuCharacterStage();
    if (typeof window !== 'undefined') window.__charStage = () => instance?.info() ?? null;
  }
  return instance;
}

/** Destroy the shared portrait and free its WebGL context. The shell calls this
 *  before starting a match so the game never competes with an idle menu context. */
export function disposeCharacterStage(): void {
  instance?.dispose();
  instance = null;
}
