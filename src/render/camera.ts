/**
 * Camera rig — tilted top-down, the Brawl Stars / Zooba framing.
 *
 * A perspective camera with a fairly narrow FOV, pitched down steeply and orbited
 * slightly, so 3D models read as a clean top-down brawler while still showing their
 * fronts and picking up rim light. Orthographic would flatten the characters and
 * lose exactly the depth cue we're building models for.
 */

import * as THREE from 'three';
import { WORLD_SCALE } from '../units';

export interface CameraRigOptions {
  /** Downward pitch in degrees. 90 = straight down. Brawl Stars sits around 55-62. */
  pitchDeg?: number;
  /** Rotation around Y in degrees. Small non-zero values add life. */
  yawDeg?: number;
  /** Vertical field of view. Narrow = less distortion at the frame edges. */
  fov?: number;
  /** How much of the world (in world units, horizontally) should fill the frame. */
  viewWidthUnits?: number;
  /** How quickly the camera catches up to its target. 0-1 per frame at 60fps. */
  followLerp?: number;
  /**
   * 'ground' frames a patch of the GROUND PLANE `viewWidthUnits` wide — correct for
   * gameplay, where pitch foreshortens the floor and must be compensated for.
   *
   * 'subject' frames a STANDING SUBJECT `subjectHeight` metres tall — correct for
   * previews. Using ground-framing on a preview pushes the camera back by 1/sin(pitch),
   * which at a shallow preview pitch shrinks the model to a speck.
   */
  frameMode?: 'ground' | 'subject';
  /** 'subject' mode: height in metres that should fill `subjectFill` of the frame. */
  subjectHeight?: number;
  /** 'subject' mode: fraction of frame height the subject occupies. Default 0.62. */
  subjectFill?: number;
  /** Raise the look-at point off the floor, in metres. */
  targetHeight?: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  pitchDeg: number;
  yawDeg: number;
  viewWidthUnits: number;
  followLerp: number;
  frameMode: 'ground' | 'subject';
  subjectHeight: number;
  subjectFill: number;
  targetHeight: number;

  /** Look-at point on the ground plane, in metres. */
  private target = new THREE.Vector3(0, 0, 0);
  private desired = new THREE.Vector3(0, 0, 0);
  /** Additive shake offset, in metres. */
  private shakeOffset = new THREE.Vector3();
  private shakeAmount = 0;
  private shakeDecay = 0;
  private aspect = 16 / 9;

  constructor(opts: CameraRigOptions = {}) {
    this.pitchDeg = opts.pitchDeg ?? 58;
    this.yawDeg = opts.yawDeg ?? 0;
    this.viewWidthUnits = opts.viewWidthUnits ?? 360;
    this.followLerp = opts.followLerp ?? 0.12;
    this.frameMode = opts.frameMode ?? 'ground';
    this.subjectHeight = opts.subjectHeight ?? 2.1;
    this.subjectFill = opts.subjectFill ?? 0.62;
    this.targetHeight = opts.targetHeight ?? 0;
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 34, this.aspect, 0.5, 300);
    this.camera.name = 'gameCamera';
    this.apply();
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.apply();
  }

  /** Distance needed to frame either the ground patch or the standing subject. */
  private computeDistance(): number {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);

    if (this.frameMode === 'subject') {
      // Fit `subjectHeight` into `subjectFill` of the vertical frame. No pitch
      // compensation — the subject stands up out of the ground plane, so it is not
      // foreshortened the way the floor is.
      const targetVisibleH = this.subjectHeight / THREE.MathUtils.clamp(this.subjectFill, 0.05, 1);
      return (targetVisibleH / 2) / Math.tan(vFov / 2);
    }

    const halfW = (this.viewWidthUnits * WORLD_SCALE) / 2;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.aspect);
    const distForWidth = halfW / Math.tan(hFov / 2);
    // Pitching the camera foreshortens the ground plane; compensate so the framed
    // ground width stays constant regardless of pitch.
    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    return distForWidth / Math.max(0.35, Math.sin(pitch));
  }

  /** Snap the camera to its computed position immediately. */
  apply(): void {
    const dist = this.computeDistance();
    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    const yaw = THREE.MathUtils.degToRad(this.yawDeg);

    const horiz = Math.cos(pitch) * dist;
    const offset = new THREE.Vector3(
      Math.sin(yaw) * horiz,
      Math.sin(pitch) * dist,
      Math.cos(yaw) * horiz
    );

    const c = this.target.clone().add(this.shakeOffset);
    c.y += this.targetHeight;
    this.camera.position.copy(c).add(offset);
    this.camera.lookAt(c);
  }

  /** Set the follow target instantly (use on spawn / respawn). */
  snapTo(x: number, z: number): void {
    this.target.set(x, 0, z);
    this.desired.set(x, 0, z);
    this.apply();
  }

  /** Set the follow target for smooth catch-up. */
  follow(x: number, z: number): void {
    this.desired.set(x, 0, z);
  }

  /** Kick off a screen shake. `amount` is in metres. */
  shake(amount = 0.18, decay = 4.5): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeDecay = decay;
  }

  update(dtSeconds: number): void {
    const t = 1 - Math.pow(1 - this.followLerp, dtSeconds * 60);
    this.target.lerp(this.desired, t);

    if (this.shakeAmount > 0.0001) {
      this.shakeAmount = Math.max(0, this.shakeAmount - this.shakeDecay * this.shakeAmount * dtSeconds);
      const a = this.shakeAmount;
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * a,
        (Math.random() * 2 - 1) * a * 0.4,
        (Math.random() * 2 - 1) * a
      );
      if (this.shakeAmount < 0.002) {
        this.shakeAmount = 0;
        this.shakeOffset.set(0, 0, 0);
      }
    }
    this.apply();
  }
}
