/**
 * Stage — renderer + scene + camera + lighting + post FX, wired together.
 *
 * Both the live game and every isolated piece preview construct a Stage, so a
 * character approved in preview renders identically in a match. If you change the
 * look, change it here, not in a preview.
 */

import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, SMAAEffect, VignetteEffect,
  ToneMappingEffect, ToneMappingMode, BlendFunction,
} from 'postprocessing';
import { CameraRig, type CameraRigOptions } from './camera';
import { createLighting, type LightingRig } from './lighting';

export interface StageOptions {
  canvas?: HTMLCanvasElement;
  container?: HTMLElement;
  camera?: CameraRigOptions;
  /** Backdrop colour behind everything. */
  background?: THREE.ColorRepresentation;
  /** Distance fog tint. Set null to disable. */
  fog?: { color: THREE.ColorRepresentation; near: number; far: number } | null;
  postFx?: boolean;
  shadows?: boolean;
  /** Cap the device pixel ratio. Screenshots use 2 for crisp critic review. */
  maxPixelRatio?: number;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly rig: CameraRig;
  readonly lighting: LightingRig;
  readonly canvas: HTMLCanvasElement;
  private composer: EffectComposer | null = null;
  private container: HTMLElement;
  private disposed = false;

  constructor(opts: StageOptions = {}) {
    this.container = opts.container ?? document.body;
    this.canvas = opts.canvas ?? document.createElement('canvas');
    if (!this.canvas.parentElement) this.container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      // Required so Playwright's toDataURL/screenshot sees the drawn frame.
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio ?? 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // handled in post
    if (opts.shadows !== false) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(opts.background ?? 0x2a1f3d);
    if (opts.fog !== null) {
      const f = opts.fog ?? { color: 0x3a2a4d, near: 30, far: 90 };
      this.scene.fog = new THREE.Fog(new THREE.Color(f.color), f.near, f.far);
    }

    this.rig = new CameraRig(opts.camera);
    this.lighting = createLighting();
    this.scene.add(this.lighting.group);

    if (opts.postFx !== false) this.buildPost();
    this.resize();
  }

  private buildPost(): void {
    const composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    composer.addPass(new RenderPass(this.scene, this.rig.camera));

    // Gentle bloom — just enough to make highlights and Neon/Cyber accents sing.
    // Overdone bloom is the fastest way to look like a hobby project.
    const bloom = new BloomEffect({
      intensity: 0.42,
      luminanceThreshold: 0.72,
      luminanceSmoothing: 0.32,
      mipmapBlur: true,
      radius: 0.62,
    });

    const vignette = new VignetteEffect({
      offset: 0.30,
      darkness: 0.42,
      blendFunction: BlendFunction.NORMAL,
    });

    const tone = new ToneMappingEffect({
      mode: ToneMappingMode.AGX,
    });

    composer.addPass(new EffectPass(this.rig.camera, bloom, tone, vignette));
    composer.addPass(new EffectPass(this.rig.camera, new SMAAEffect()));
    this.composer = composer;
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.rig.setAspect(w / Math.max(1, h));
  }

  render(dtSeconds: number): void {
    if (this.disposed) return;
    this.rig.update(dtSeconds);
    if (this.composer) this.composer.render(dtSeconds);
    else this.renderer.render(this.scene, this.rig.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
