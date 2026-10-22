import * as THREE from 'three';

/**
 * Interactables are plain objects registered with the Interaction system:
 * { pos: Vector3, radius, prompt: () => key|null, enabled: () => bool, use: () => void, height? }
 * The nearest usable one in front of the player becomes the "focus" and labels the Use button.
 */
export class Interaction {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.focus = null;
  }

  add(item) {
    const defaults = { radius: 1.3, enabled: () => true, minY: -99, maxY: 99 };
    for (const k in defaults) if (!(k in item)) item[k] = defaults[k];
    this.items.push(item);
    return item;
  }

  remove(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }

  update(player) {
    let best = null, bestScore = Infinity;
    const p = player.pos;
    const f = player.facingDir();
    for (const it of this.items) {
      if (!it.enabled()) continue;
      if (p.y < it.minY || p.y > it.maxY) continue;
      const dx = it.pos.x - p.x, dz = it.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      const facing = d < 0.4 ? 1 : (dx * f.x + dz * f.z) / d;
      if (facing < -0.2) continue;
      const score = d - facing * 0.5;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    this.focus = best;
    return best;
  }
}

/** A heavy box the player can push and pull along X; it is also a collision box to stand on. */
export class Pushable {
  constructor(game, mesh, x, y, z, size) {
    this.game = game;
    this.mesh = mesh;
    this.half = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
    this.box = game.collision.add(x - this.half.x, y, z - this.half.z, x + this.half.x, y + size.y, z + this.half.z, { tag: 'pushable', surface: 'wood' });
    this._grind = 0;
    this.sync();
  }

  get center() {
    return new THREE.Vector3((this.box.min.x + this.box.max.x) / 2, this.box.min.y, (this.box.min.z + this.box.max.z) / 2);
  }

  /** Try to slide by dx; returns the distance actually moved. */
  tryMove(dx, col) {
    const body = { pos: this.center, r: this.half.x, h: this.half.y * 2 };
    // collide as a square footprint: temporarily treat r as half width in x and z (z half may differ)
    const before = body.pos.x;
    this.box.enabled = false;
    const bodyZ = { pos: body.pos, r: Math.min(this.half.x, this.half.z), h: body.h };
    col.move(bodyZ, dx, 0, 0, { stepHeight: 0 });
    this.box.enabled = true;
    const moved = bodyZ.pos.x - before;
    this.box.min.x += moved; this.box.max.x += moved;
    this.sync();
    if (Math.abs(moved) > 0.0005) {
      this._grind += Math.abs(moved);
      if (this._grind > 0.35) { this._grind = 0; this.game.sound.play('step_wood' + Math.floor(Math.random() * 4), { vol: 0.35, rate: 0.55, x: before }); }
    }
    return moved;
  }

  sync() {
    const c = this.center;
    this.mesh.position.set(c.x, c.y, c.z);
  }
}
