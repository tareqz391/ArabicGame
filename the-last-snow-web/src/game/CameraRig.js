import * as THREE from 'three';

/**
 * Side-on cinematic camera. Follows the player with damping and look-ahead; camera zones
 * reframe areas (interiors, wide establishing shots); scripted shots take over for cutscenes.
 */
export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.target = null;
    this.base = { offset: new THREE.Vector3(0, 2.1, 8.0), look: new THREE.Vector3(0, 1.05, 0), fov: 38, depthFollow: 0.75 };
    this.zones = [];
    this.cur = { offset: this.base.offset.clone(), look: this.base.look.clone(), fov: this.base.fov, depthFollow: 0.75 };
    this.pos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.lookAhead = 0;
    this.shot = null;
    this.shotBlend = 1;
    this.shotFrom = null;
    this._shake = 0;
    this._shakeT = 0;
    this.drift = 0;
  }

  /** zone: { min:{x,z}, max:{x,z}, offset:Vector3, look:Vector3, fov, priority, clampX:[a,b], fixed:Vector3 } */
  addZone(z) { this.zones.push(Object.assign({ priority: 0, depthFollow: 0.75 }, z)); return z; }

  _zoneFor(p) {
    let best = null;
    for (const z of this.zones) {
      if (p.x >= z.min.x && p.x <= z.max.x && p.z >= z.min.z && p.z <= z.max.z && (!z.when || z.when())) {
        if (!best || z.priority > best.priority) best = z;
      }
    }
    return best;
  }

  /** Cut or blend to a scripted shot { pos, look, fov }. */
  setShot(shot, blend = 1.5) {
    this.shotFrom = { pos: this.cam.position.clone(), look: this.lookAt.clone(), fov: this.cam.fov };
    this.shot = shot;
    this.shotBlend = blend <= 0 ? 1 : 0;
    this.shotDur = blend;
  }

  clearShot(blend = 1.5) {
    if (!this.shot) return;
    this.shotFrom = { pos: this.cam.position.clone(), look: this.lookAt.clone(), fov: this.cam.fov };
    this.shot = null;
    this.returnBlend = blend <= 0 ? 1 : 0;
    this.returnDur = blend;
  }

  shake(amount, time) {
    this._shake = Math.max(this._shake, amount);
    this._shakeT = Math.max(this._shakeT, time);
  }

  snap() {
    this.update(1, true);
  }

  update(dt, snap = false) {
    const p = this.target.pos;
    const z = this._zoneFor(p);
    const want = z || this.base;
    const k = snap ? 1 : 1 - Math.exp(-dt * 2.2);
    this.cur.offset.lerp(want.offset, k);
    this.cur.look.lerp(want.look, k);
    this.cur.fov += ((want.fov || this.base.fov) - this.cur.fov) * k;
    this.cur.depthFollow += ((want.depthFollow ?? 0.75) - this.cur.depthFollow) * k;

    // look-ahead in the walking direction
    const f = Math.sin(this.target.yaw);
    const moving = Math.abs(this.target.vel ? 1 : 0);
    this.lookAhead += ((f * 1.1 * moving) - this.lookAhead) * (snap ? 1 : 1 - Math.exp(-dt * 0.9));

    const focus = new THREE.Vector3(p.x + this.lookAhead, p.y, p.z * this.cur.depthFollow + (want.anchorZ ?? 0) * (1 - this.cur.depthFollow));
    if (want.clampX) focus.x = THREE.MathUtils.clamp(focus.x, want.clampX[0], want.clampX[1]);
    const desiredPos = focus.clone().add(this.cur.offset);
    if (want.fixed) desiredPos.copy(want.fixed);
    const desiredLook = new THREE.Vector3(p.x + this.lookAhead * 0.6, p.y, p.z).add(this.cur.look);
    if (want.clampX) desiredLook.x = THREE.MathUtils.clamp(desiredLook.x, want.clampX[0] - 2, want.clampX[1] + 2);

    const kp = snap ? 1 : 1 - Math.exp(-dt * 3.2);
    this.pos.lerp(desiredPos, kp);
    this.lookAt.lerp(desiredLook, snap ? 1 : 1 - Math.exp(-dt * 4.0));

    let camPos = this.pos.clone(), camLook = this.lookAt.clone(), fov = this.cur.fov;
    if (this.shot) {
      this.shotBlend = Math.min(1, this.shotBlend + dt / Math.max(0.001, this.shotDur));
      const e = THREE.MathUtils.smootherstep(this.shotBlend, 0, 1);
      camPos = this.shotFrom.pos.clone().lerp(this.shot.pos, e);
      camLook = this.shotFrom.look.clone().lerp(this.shot.look, e);
      fov = THREE.MathUtils.lerp(this.shotFrom.fov, this.shot.fov || fov, e);
      if (this.shot.drift) camPos.x += Math.sin(performance.now() * 0.0002) * this.shot.drift;
    } else if (this.returnBlend !== undefined && this.returnBlend < 1) {
      this.returnBlend = Math.min(1, this.returnBlend + dt / Math.max(0.001, this.returnDur));
      const e = THREE.MathUtils.smootherstep(this.returnBlend, 0, 1);
      camPos = this.shotFrom.pos.clone().lerp(camPos, e);
      camLook = this.shotFrom.look.clone().lerp(camLook, e);
      fov = THREE.MathUtils.lerp(this.shotFrom.fov, fov, e);
    }
    // subtle handheld breathing + shake
    const t = performance.now() * 0.001;
    camPos.y += Math.sin(t * 0.7) * 0.02;
    camPos.x += Math.sin(t * 0.43) * 0.02;
    if (this._shakeT > 0) {
      this._shakeT -= dt;
      const s = this._shake * Math.max(0, Math.min(1, this._shakeT * 3));
      camPos.x += (Math.random() - 0.5) * s;
      camPos.y += (Math.random() - 0.5) * s;
      if (this._shakeT <= 0) this._shake = 0;
    }
    this.cam.position.copy(camPos);
    this.cam.lookAt(camLook);
    if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    this.focus = focus;
  }
}
