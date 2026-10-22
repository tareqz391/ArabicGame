import * as THREE from 'three';

/**
 * Mobile-friendly lighting: the level declares any number of "virtual" point lights, but only
 * a fixed pool of real PointLights exists (so shaders never recompile). Each frame the pool is
 * assigned to the virtual lights nearest the focus point.
 */
export class LightPool {
  constructor(scene, size = 6) {
    this.real = [];
    this.virtual = [];
    for (let i = 0; i < size; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 1.6);
      l.castShadow = false;
      scene.add(l);
      this.real.push(l);
    }
  }

  /** v: { pos, color, intensity, distance, on, flicker } */
  add(v) {
    const o = Object.assign({ color: 0xffb070, intensity: 4, distance: 9, on: true, flicker: 0, level: 0, phase: Math.random() * 100 }, v);
    o.colorObj = new THREE.Color(o.color);
    this.virtual.push(o);
    return o;
  }

  update(dt, focus, t) {
    for (const v of this.virtual) {
      const target = v.on ? 1 : 0;
      v.level += (target - v.level) * Math.min(1, dt * (v.on ? 3 : 8));
      let f = 1;
      if (v.flicker > 0) {
        const n = Math.sin(t * 13 + v.phase) * Math.sin(t * 7.3 + v.phase * 2) + (Math.random() < 0.02 * v.flicker ? -1.5 : 0);
        f = THREE.MathUtils.clamp(1 + n * 0.35 * v.flicker, 0.05, 1.2);
      }
      v.current = v.intensity * v.level * f;
      if (v.onUpdate) v.onUpdate(v.current / Math.max(0.001, v.intensity));
      v._d = Math.abs(v.pos.x - focus.x) + Math.abs(v.pos.z - focus.z) * 0.5;
    }
    const ranked = this.virtual.filter((v) => v.current > 0.01).sort((a, b) => a._d - b._d);
    for (let i = 0; i < this.real.length; i++) {
      const l = this.real[i], v = ranked[i];
      if (!v) { l.intensity = 0; continue; }
      l.position.copy(v.pos);
      l.color.copy(v.colorObj);
      l.distance = v.distance;
      // fade the furthest assigned lights so swaps don't pop
      const edge = i >= this.real.length - 2 ? THREE.MathUtils.clamp(1 - (v._d - 10) / 10, 0, 1) : 1;
      l.intensity = v.current * edge;
    }
  }
}
