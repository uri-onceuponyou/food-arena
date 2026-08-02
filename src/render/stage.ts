/**
 * Stage — renderer + scene + camera + lighting + post FX, wired together.
 *
 * Both the live game and every isolated piece preview construct a Stage, so a
 * character approved in preview renders identically in a match. If you change the
 * look, change it here, not in a preview.
 */

import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, NormalPass,
  BloomEffect, SMAAEffect, VignetteEffect, SSAOEffect,
  HueSaturationEffect, BrightnessContrastEffect, BlendFunction,
} from 'postprocessing';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
  /** Image-based lighting. On by default — it is what gives surfaces their sheen. */
  environment?: boolean;
  environmentIntensity?: number;
  /** Ambient occlusion. On by default; disable for cheap/fast renders. */
  ao?: boolean;
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
  private envMap: THREE.Texture | null = null;
  private useAO = true;

  constructor(opts: StageOptions = {}) {
    this.useAO = opts.ao !== false;
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

    // ── Image-based lighting ─────────────────────────────────────────────────
    // Without an environment map, MeshStandardMaterial derives specular purely from
    // direct lights, which yields a dull, chalky surface no matter how the lights are
    // tuned. Reference art gets its moulded-vinyl sheen from IBL. This is the single
    // largest material-quality win available, and it applies to every mesh at once.
    if (opts.environment !== false) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();
      const envScene = new RoomEnvironment();
      this.envMap = pmrem.fromScene(envScene, 0.04).texture;
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = opts.environmentIntensity ?? 0.38;
      envScene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry?.dispose();
      });
      pmrem.dispose();
    }

    if (opts.postFx !== false) this.buildPost();
    this.resize();
  }

  private buildPost(): void {
    const composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    composer.addPass(new RenderPass(this.scene, this.rig.camera));

    // ── Ambient occlusion ────────────────────────────────────────────────────
    // The critic's #2 named gap: forms read as flat because nothing darkens where
    // parts meet. Shadow maps alone don't deliver contact darkening between a
    // character's own overlapping pieces — SSAO does, and it's what makes a stack of
    // shapes read as genuinely three-dimensional rather than as decals on a blob.
    let ssao: SSAOEffect | null = null;
    if (this.useAO) {
      const normalPass = new NormalPass(this.scene, this.rig.camera);
      composer.addPass(normalPass);
      ssao = new SSAOEffect(this.rig.camera, normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        distanceScaling: true,
        worldDistanceThreshold: 30,
        worldDistanceFalloff: 6,
        worldProximityThreshold: 0.5,
        worldProximityFalloff: 0.2,
        luminanceInfluence: 0.6,
        samples: 16,
        rings: 5,
        radius: 0.06,
        intensity: 2.0,
        resolutionScale: 0.75,
      });
    }

    // Bloom only on genuinely hot highlights. The threshold is high on purpose:
    // at 0.72 it was haloing plain white geometry (sesame seeds glowed like LEDs).
    const bloom = new BloomEffect({
      intensity: 0.30,
      luminanceThreshold: 0.88,
      luminanceSmoothing: 0.20,
      mipmapBlur: true,
      radius: 0.58,
    });

    // NO filmic tonemapping. AgX/ACES are built to tame photorealistic HDR and both
    // desaturate hard — exactly the wrong move for a hyper-saturated toy-plastic look.
    // Reference frames are vivid and high-key, so we grade toward that instead.
    // Restrained on purpose. At 0.34 this shoved an authored tan bun to pure orange —
    // the grade should lift what the artist chose, not overwrite it. Saturation belongs
    // in the albedo colours first, with only a light global assist here.
    const saturation = new HueSaturationEffect({ saturation: 0.16 });
    const contrast = new BrightnessContrastEffect({ brightness: 0.02, contrast: 0.06 });

    // Barely-there vignette; the reference has essentially none.
    const vignette = new VignetteEffect({
      offset: 0.42,
      darkness: 0.20,
      blendFunction: BlendFunction.NORMAL,
    });

    const effects = ssao
      ? [ssao, bloom, saturation, contrast, vignette]
      : [bloom, saturation, contrast, vignette];
    composer.addPass(new EffectPass(this.rig.camera, ...effects));
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
