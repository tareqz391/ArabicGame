import * as THREE from 'three';

const WALK = 1.9, RUN = 3.9, CROUCH = 1.05, PUSH = 1.0, CARRY = 1.6;
const GRAVITY = -19, JUMP_V = 6.0;
const STAND_H = 1.7, CROUCH_H = 1.1;

/**
 * Adam: 2.5D character controller (move along X, depth on Z), with crouch, jump, ledge
 * mantling, push/pull, carrying and a flashlight. Drives the GLB animation clips.
 */
export class Player {
  constructor(assets, scene, game) {
    this.game = game;
    const { root, clips } = assets.character('adam');
    this.model = root;
    scene.add(root);
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    for (const c of clips) {
      const a = this.mixer.clipAction(c);
      this.actions[c.name] = a;
      if (['Jump', 'Climb', 'Interact', 'WakeUp', 'LookBack', 'Caught'].includes(c.name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
    }
    this.current = null;
    this.body = { pos: new THREE.Vector3(), r: 0.22, h: STAND_H };
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI / 2;
    this.targetYaw = this.yaw;
    this.grounded = true;
    this.crouching = false;
    this.locked = false;
    this.scripted = null;
    this.climb = null;
    this.grab = null;          // { obj, side } while pushing/pulling
    this.carrying = null;      // { id, mesh }
    this.speedMul = 1;
    this.surface = 'snow';
    this._stepDist = 0;
    this._footSide = 1;
    this.noise = 0;
    this.chest = root.getObjectByName('chest');
    this.handR = root.getObjectByName('handR');

    // Flashlight (warm-white beam from the chest)
    this.light = new THREE.SpotLight(0xfff1d6, 0, 16, Math.PI / 6, 0.45, 1.4);
    this.light.position.set(0.12, 1.25, 0.3);
    this.light.castShadow = false;
    this.lightTarget = new THREE.Object3D();
    this.lightTarget.position.set(0, -0.6, 3.5);
    root.add(this.light, this.lightTarget);
    this.light.target = this.lightTarget;
    this.lightOn = false;
    this.play('Idle', 0);
  }

  get pos() { return this.body.pos; }

  setPosition(x, y, z, yaw = null) {
    this.body.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    if (yaw !== null) { this.yaw = this.targetYaw = yaw; }
    this.model.position.copy(this.body.pos);
    this.model.rotation.y = this.yaw;
  }

  play(name, fade = 0.2, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return null;
    a.timeScale = timeScale;
    if (this.current === a) return a;
    a.reset();
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.play();
    if (this.current && fade > 0) this.current.crossFadeTo(a, fade, false);
    else if (this.current) this.current.stop();
    this.current = a;
    this.currentName = name;
    return a;
  }

  /** Play a one-shot (or looped) animation under script control. Resolves when finished. */
  playScripted(name, { fade = 0.25, loop = false, timeScale = 1 } = {}) {
    this.scripted = name;
    const a = this.play(name, fade, timeScale);
    if (!a) return Promise.resolve();
    if (loop) { a.setLoop(THREE.LoopRepeat, Infinity); return Promise.resolve(); }
    return new Promise((res) => {
      const done = (e) => {
        if (e.action !== a) return;
        this.mixer.removeEventListener('finished', done);
        res();
      };
      this.mixer.addEventListener('finished', done);
    });
  }

  releaseScripted() {
    this.scripted = null;
  }

  toggleLight(force) {
    this.lightOn = force !== undefined ? force : !this.lightOn;
    this.light.intensity = this.lightOn ? 26 : 0;
    this.game.sound.play('flash', { vol: 0.5 });
  }

  facingDir() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  startGrab(obj) {
    // lock to the X axis, facing the object
    const side = Math.sign(obj.center.x - this.pos.x) || 1;
    this.grab = { obj, side };
    this.targetYaw = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.game.sound.play('cloth', { vol: 0.5 });
  }

  endGrab() { this.grab = null; }

  pickUp(id, mesh) {
    this.carrying = { id, mesh };
    const anchor = this.chest || this.model;
    anchor.add(mesh);
    mesh.position.set(0, -0.25, 0.32);
    mesh.rotation.set(0, 0, 0);
    this.game.sound.play('pickup', { vol: 0.6 });
  }

  drop() {
    const c = this.carrying;
    this.carrying = null;
    return c;
  }

  update(dt, input) {
    const col = this.game.collision;
    const b = this.body;
    const controllable = !this.locked && !this.scripted && !this.climb;

    // --- climbing (mantle) in progress
    if (this.climb) {
      const c = this.climb;
      c.t += dt / c.dur;
      const k = Math.min(1, c.t);
      const up = Math.min(1, k / 0.55);
      const fwd = Math.max(0, (k - 0.35) / 0.65);
      b.pos.set(
        THREE.MathUtils.lerp(c.from.x, c.to.x, fwd),
        THREE.MathUtils.lerp(c.from.y, c.to.y, 1 - (1 - up) * (1 - up)),
        THREE.MathUtils.lerp(c.from.z, c.to.z, fwd),
      );
      if (k >= 1) { this.climb = null; this.grounded = true; this.vel.set(0, 0, 0); }
    }

    let mx = 0, mz = 0;
    if (controllable) { mx = input.move.x; mz = -input.move.y; }

    // --- crouch toggle
    if (controllable && input.take('crouch')) {
      if (this.crouching) {
        if (col.isFree(b.pos.x, b.pos.y, b.pos.z, b.r, STAND_H)) this.crouching = false;
      } else if (this.grounded && !this.carrying) this.crouching = true;
    }
    b.h = this.crouching ? CROUCH_H : STAND_H;

    // --- push / pull
    if (this.grab) {
      const o = this.grab.obj;
      if (!controllable || !this.grounded || Math.abs(o.center.x - this.pos.x) > o.half.x + b.r + 0.35) this.endGrab();
    }

    let speed = this.crouching ? CROUCH : (input.run ? RUN : WALK);
    if (this.carrying) speed = CARRY;
    if (this.grab) speed = PUSH;
    speed *= this.speedMul;

    let dx = 0, dz = 0;
    if (this.grab) {
      const o = this.grab.obj;
      const want = mx * speed * dt;
      if (want !== 0 && Math.sign(want) === this.grab.side) dx = o.tryMove(want, col); // push: crate leads
      else { dx = want; this._pullFrom = b.pos.x; }                                      // pull: player leads
      dz = 0;
    } else {
      dx = mx * speed * dt;
      dz = mz * speed * dt * 0.85;
      if (Math.abs(mx) + Math.abs(mz) > 0.05 && controllable) this.targetYaw = Math.atan2(mx, mz);
    }

    // --- jump / mantle
    if (controllable && input.take('jump') && !this.grab) {
      const f = this.facingDir();
      const ledge = this.grounded && !this.carrying ? col.findLedge(b, f.x, f.z, 0.55, 1.55) : null;
      if (ledge) {
        this.crouching = false;
        this.climb = { from: b.pos.clone(), to: new THREE.Vector3(ledge.x, ledge.y, ledge.z), t: 0, dur: 0.95 };
        this.play('Climb', 0.12);
        this.game.sound.play('cloth', { vol: 0.6 });
      } else if (this.grounded && !this.crouching) {
        this.vel.y = this.carrying ? JUMP_V * 0.6 : JUMP_V;
        this.grounded = false;
      }
    }

    // --- physics
    if (!this.climb) {
      this.vel.y += GRAVITY * dt;
      if (this.locked || this.scripted) { dx = 0; dz = 0; }
      const res = col.move(b, dx, this.vel.y * dt, dz, { grounded: this.grounded, ignore: this.grab ? this.grab.obj.box : null });
      if (this.grab && this._pullFrom !== undefined) {
        const actual = b.pos.x - this._pullFrom;
        if (actual !== 0) this.grab.obj.tryMove(actual, col);
      }
      this._pullFrom = undefined;
      if (res.grounded) {
        if (!this.grounded && this.vel.y < -7) { this.game.sound.play('thud', { vol: 0.4, x: b.pos.x }); this.game.cameraRig.shake(0.08, 0.2); }
        this.vel.y = 0;
        this.grounded = true;
        this.surface = res.ground.surface;
      } else {
        this.grounded = false;
        if (res.ceiling && this.vel.y > 0) this.vel.y = 0;
      }
      if (b.pos.y < -20) this.game.onFellOut();
    }

    // --- facing
    let d = this.targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 10);

    // --- animation state
    const planar = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
    if (!this.scripted && !this.climb) {
      if (!this.grounded) this.play(this.vel.y > 0.5 ? 'Jump' : 'Fall', 0.15);
      else if (this.grab) {
        const dir = Math.sign(dx) * this.grab.side;
        this.play('Push', 0.2, planar > 0.05 ? (dir >= 0 ? 1 : -1) : 0.0001);
      } else if (this.crouching) this.play(planar > 0.1 ? 'CrouchWalk' : 'Crouch', 0.25, planar > 0.1 ? planar / CROUCH : 1);
      else if (this.carrying) this.play(planar > 0.1 ? 'CarryWalk' : 'CarryIdle', 0.25, planar > 0.1 ? planar / CARRY : 1);
      else if (planar > 2.7) this.play('Run', 0.2, planar / RUN);
      else if (planar > 0.1) this.play('Walk', 0.2, Math.max(0.6, planar / WALK));
      else this.play('Idle', 0.3);
    }

    // --- footsteps & noise
    if (this.grounded && planar > 0.1 && !this.scripted) {
      this._stepDist += planar * dt;
      const stride = planar > 2.7 ? 0.95 : (this.crouching ? 0.45 : 0.62);
      if (this._stepDist > stride) {
        this._stepDist = 0;
        this._footSide *= -1;
        if (!this.crouching || Math.random() < 0.5) this.game.sound.step(this.surface, b.pos.x);
        if (this.surface === 'snow') {
          const side = this._footSide * 0.1;
          this.game.footprints.add(b.pos.x + Math.cos(this.yaw) * side, b.pos.y, b.pos.z - Math.sin(this.yaw) * side, this.yaw);
        }
      }
    }
    this.noise = this.grounded ? (planar > 2.7 ? 1 : planar > 0.1 ? (this.crouching ? 0.15 : 0.45) : 0.05) : 0.6;

    this.mixer.update(dt);
    this.model.position.copy(b.pos);
    this.model.rotation.y = this.yaw;
  }
}
