import * as THREE from 'three';

/**
 * GPU snowfall: particles live in a box that follows the camera; the vertex shader moves
 * them (fall + wind + flutter) and wraps them, so the CPU cost is ~zero.
 */
export class Snow {
  constructor(scene, { count = 4000, size = [24, 14, 22], flake = 0.06, opacity = 0.9, near = false } = {}) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * size[0];
      pos[i * 3 + 1] = Math.random() * size[1];
      pos[i * 3 + 2] = Math.random() * size[2];
      rnd[i * 4] = Math.random(); rnd[i * 4 + 1] = Math.random(); rnd[i * 4 + 2] = Math.random(); rnd[i * 4 + 3] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
    this.uniforms = {
      uTime: { value: 0 },
      uOrigin: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(...size) },
      uWind: { value: new THREE.Vector2(-0.6, 0) },
      uFall: { value: 0.9 },
      uSize: { value: flake },
      uOpacity: { value: opacity },
      uScale: { value: 400 },
      uFogColor: { value: new THREE.Color(0x0d1424) },
      uFogDensity: { value: 0.03 },
      uIntensity: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        uniform float uTime, uFall, uSize, uScale, uIntensity; uniform vec3 uOrigin, uBox; uniform vec2 uWind;
        attribute vec4 aRnd; varying float vAlpha; varying float vFog;
        void main(){
          vec3 p = position;
          float speed = uFall * (0.6 + aRnd.x * 0.8);
          p.y -= uTime * speed;
          p.x += uTime * uWind.x * (0.7 + aRnd.y * 0.6) + sin(uTime * (0.8 + aRnd.z) + aRnd.w * 6.28) * 0.35;
          p.z += uTime * uWind.y + cos(uTime * (0.6 + aRnd.y) + aRnd.x * 6.28) * 0.25;
          // wrap inside the box centred on the camera focus
          vec3 o = uOrigin - uBox * 0.5;
          p = mod(p - o, uBox) + o;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float s = uSize * (0.5 + aRnd.w);
          gl_PointSize = s * uScale / -mv.z;
          vAlpha = step(aRnd.z, uIntensity) * (0.55 + 0.45 * aRnd.y);
          float d = -mv.z; vFog = exp(-d * d * 0.0009);
        }`,
      fragmentShader: `
        uniform float uOpacity; varying float vAlpha; varying float vFog;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(c));
          gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), a * vAlpha * uOpacity * vFog);
          if (gl_FragColor.a < 0.01) discard;
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  update(t, focus, pixelScale) {
    this.uniforms.uTime.value = t;
    this.uniforms.uOrigin.value.copy(focus);
    this.uniforms.uScale.value = pixelScale;
  }

  set intensity(v) { this.uniforms.uIntensity.value = v; }
}
