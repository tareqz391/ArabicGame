import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Cinematic finishing pass: cold grade, vignette, film grain, letterbox, memory sepia. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.85 },
    uGrain: { value: 0.045 },
    uSepia: { value: 0 },
    uFrost: { value: 0 },
    uLetterbox: { value: 0 },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uSepia, uFrost, uLetterbox, uAspect;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec4 c = texture2D(tDiffuse, uv);
      vec3 col = c.rgb;
      // cool shadows, keep warm highlights (teal/orange split)
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col * vec3(0.92, 0.98, 1.08), col, smoothstep(0.25, 0.8, l));
      // memory flashback: sepia + bloom-ish lift
      vec3 sep = vec3(l) * vec3(1.15, 0.95, 0.72) + 0.04;
      col = mix(col, sep, uSepia);
      // vignette
      vec2 q = (uv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(1.05, 0.25, length(q) * uVignette);
      col *= mix(0.35, 1.0, v);
      // frost at screen edges when freezing
      float edge = smoothstep(0.35, 0.95, length(q) + hash(floor(uv * 180.0)) * 0.08);
      col = mix(col, vec3(0.78, 0.86, 1.0), edge * uFrost * 0.8);
      // grain
      float g = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5;
      col += g * uGrain;
      // cinematic letterbox for cutscenes
      float lb = uLetterbox * 0.11;
      if (uv.y < lb || uv.y > 1.0 - lb) col = vec3(0.0);
      gl_FragColor = vec4(col, c.a);
    }`,
};

export class Renderer {
  constructor(container, quality) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.3;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    this.quality = quality;
    this.scale = 1;
    this._fpsSamples = [];
    this.applyQuality(quality);
  }

  setup(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const r = this.renderer;
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  applyQuality(q) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const caps = { low: 0.75, medium: 1.0, high: 1.5, auto: 1.25 };
    this.maxRatio = Math.min(dpr, caps[q] || 1.25);
    this.pixelRatio = this.maxRatio;
    this.renderer.shadowMap.enabled = q !== 'low';
    if (this.composer) this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = this.pixelRatio;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
      // bloom at reduced resolution is much cheaper on phones
      this.bloom.resolution.set(Math.round(w * 0.5), Math.round(h * 0.5));
      this.grade.uniforms.uAspect.value = w / h;
    }
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Adaptive resolution: keeps the frame rate steady on mid-range phones. */
  adapt(dt, target = 30) {
    if (this.quality !== 'auto') return;
    this._fpsSamples.push(dt);
    if (this._fpsSamples.length < 45) return;
    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    this._fpsSamples.length = 0;
    const fps = 1 / avg;
    let pr = this.pixelRatio;
    if (fps < target * 0.85) pr = Math.max(0.6, pr - 0.15);
    else if (fps > target * 1.4) pr = Math.min(this.maxRatio, pr + 0.1);
    if (Math.abs(pr - this.pixelRatio) > 0.01) {
      this.pixelRatio = pr;
      this.resize();
    }
  }

  render(time) {
    this.grade.uniforms.uTime.value = time;
    this.composer.render();
  }
}
