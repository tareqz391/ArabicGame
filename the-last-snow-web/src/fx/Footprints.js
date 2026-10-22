import * as THREE from 'three';
import { footprintTexture } from './Textures.js';

/** Pooled footprint decals that slowly fill with snow. */
export class Footprints {
  constructor(scene, max = 90) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.16, 0.3).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: footprintTexture(), transparent: true, depthWrite: false, opacity: 0.85 }),
      max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.ages = new Float32Array(max).fill(999);
    this.data = [];
    this.next = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    for (let i = 0; i < max; i++) {
      this.data.push({ p: new THREE.Vector3(), yaw: 0 });
      this.mesh.setMatrixAt(i, this._m.makeScale(0, 0, 0));
    }
    scene.add(this.mesh);
  }

  add(x, y, z, yaw) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.data[i].p.set(x, y + 0.012, z);
    this.data[i].yaw = yaw;
    this.ages[i] = 0;
  }

  update(dt) {
    const life = 40;
    for (let i = 0; i < this.max; i++) {
      if (this.ages[i] > life) continue;
      this.ages[i] += dt;
      const k = Math.max(0, 1 - this.ages[i] / life);
      this._q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.data[i].yaw);
      this._s.set(k, 1, k);
      this.mesh.setMatrixAt(i, this._m.compose(this.data[i].p, this._q, this._s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
