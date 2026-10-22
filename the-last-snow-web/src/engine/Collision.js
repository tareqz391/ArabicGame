import * as THREE from 'three';

/**
 * Lightweight AABB collision world. The game is 2.5D, so axis-aligned boxes are enough for
 * floors, walls, props and pushable crates, and they are cheap on mobile.
 * A body is { pos: Vector3 (feet centre), r: half-width, h: height }.
 */
export class Collision {
  constructor() {
    this.boxes = [];
  }

  /** Adds a box given min/max corners. opts: { tag, enabled, owner } */
  add(minx, miny, minz, maxx, maxy, maxz, opts = {}) {
    const b = {
      min: new THREE.Vector3(minx, miny, minz),
      max: new THREE.Vector3(maxx, maxy, maxz),
      enabled: opts.enabled !== false,
      tag: opts.tag || '',
      owner: opts.owner || null,
      surface: opts.surface || 'snow',
    };
    this.boxes.push(b);
    return b;
  }

  /** Adds a box centred at (x, z) standing on y0. */
  addCentered(x, y0, z, w, h, d, opts) {
    return this.add(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2, opts);
  }

  remove(b) {
    const i = this.boxes.indexOf(b);
    if (i >= 0) this.boxes.splice(i, 1);
  }

  _overlapY(b, y, h) { return y + 0.001 < b.max.y && y + h > b.min.y + 0.001; }
  _overlapX(b, x, r) { return x + r > b.min.x && x - r < b.max.x; }
  _overlapZ(b, z, r) { return z + r > b.min.z && z - r < b.max.z; }

  /**
   * Moves a body, resolving collisions axis by axis. Returns contact info.
   * stepHeight lets the body climb small ledges (stairs, kerbs).
   */
  move(body, dx, dy, dz, { stepHeight = 0.3, ignore = null, grounded = false } = {}) {
    const p = body.pos, r = body.r, h = body.h;
    const res = { grounded: false, ceiling: false, hitX: null, hitZ: null, ground: null };
    const skip = (b) => !b.enabled || b === ignore || (ignore && ignore.includes && ignore.includes(b));

    // X axis
    if (dx !== 0) {
      let nx = p.x + dx;
      for (const b of this.boxes) {
        if (skip(b) || !this._overlapY(b, p.y, h) || !this._overlapZ(b, p.z, r)) continue;
        if (!(nx + r > b.min.x && nx - r < b.max.x)) continue;
        const rise = b.max.y - p.y;
        if (grounded && rise > 0 && rise <= stepHeight && this._free(nx, b.max.y, p.z, r, h, skip)) {
          p.y = b.max.y; continue;
        }
        if (dx > 0 && p.x + r <= b.min.x + 0.02) { nx = Math.min(nx, b.min.x - r - 0.001); res.hitX = b; }
        else if (dx < 0 && p.x - r >= b.max.x - 0.02) { nx = Math.max(nx, b.max.x + r + 0.001); res.hitX = b; }
      }
      p.x = nx;
    }
    // Z axis
    if (dz !== 0) {
      let nz = p.z + dz;
      for (const b of this.boxes) {
        if (skip(b) || !this._overlapY(b, p.y, h) || !this._overlapX(b, p.x, r)) continue;
        if (!(nz + r > b.min.z && nz - r < b.max.z)) continue;
        const rise = b.max.y - p.y;
        if (grounded && rise > 0 && rise <= stepHeight && this._free(p.x, b.max.y, nz, r, h, skip)) {
          p.y = b.max.y; continue;
        }
        if (dz > 0 && p.z + r <= b.min.z + 0.02) { nz = Math.min(nz, b.min.z - r - 0.001); res.hitZ = b; }
        else if (dz < 0 && p.z - r >= b.max.z - 0.02) { nz = Math.max(nz, b.max.z + r + 0.001); res.hitZ = b; }
      }
      p.z = nz;
    }
    // Y axis
    let ny = p.y + dy;
    for (const b of this.boxes) {
      if (skip(b) || !this._overlapX(b, p.x, r) || !this._overlapZ(b, p.z, r)) continue;
      if (dy <= 0 && p.y >= b.max.y - 0.05 && ny <= b.max.y) {
        ny = b.max.y; res.grounded = true; res.ground = b;
      } else if (dy > 0 && p.y + h <= b.min.y + 0.05 && ny + h > b.min.y) {
        ny = b.min.y - h; res.ceiling = true;
      }
    }
    p.y = ny;
    return res;
  }

  /** True if an AABB body would fit at (x, y, z). */
  _free(x, y, z, r, h, skip = (b) => !b.enabled) {
    for (const b of this.boxes) {
      if (skip(b)) continue;
      if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z && y + 0.01 < b.max.y && y + h > b.min.y) return false;
    }
    return true;
  }

  isFree(x, y, z, r, h, ignore) {
    return this._free(x, y, z, r, h, (b) => !b.enabled || b === ignore);
  }

  /** Highest box top below (x, z) under height y (for ledges / shadows). */
  groundBelow(x, z, y, r = 0.05, ignore = null) {
    let best = null;
    for (const b of this.boxes) {
      if (!b.enabled || b === ignore) continue;
      if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z && b.max.y <= y + 0.01) {
        if (!best || b.max.y > best.max.y) best = b;
      }
    }
    return best;
  }

  /** Finds a ledge in front of a body: a box whose top lies between minH and maxH above the feet. */
  findLedge(body, dirX, dirZ, minH, maxH, reach = 0.8) {
    for (let d = 0.02; d <= reach; d += 0.08) {
      const fx = body.pos.x + dirX * (body.r + d);
      const fz = body.pos.z + dirZ * (body.r + d);
      for (const b of this.boxes) {
        if (!b.enabled) continue;
        const rise = b.max.y - body.pos.y;
        if (rise < minH || rise > maxH) continue;
        if (fx < b.min.x || fx > b.max.x || fz < b.min.z || fz > b.max.z) continue;
        // stand point on top, a little past the edge
        const inset = (lo, hi, v) => (hi - lo < 2 * body.r ? (lo + hi) / 2 : THREE.MathUtils.clamp(v, lo + body.r, hi - body.r));
        const tx = inset(b.min.x, b.max.x, fx + dirX * body.r);
        const tz = inset(b.min.z, b.max.z, fz + dirZ * body.r);
        if (this._free(tx, b.max.y, tz, body.r * 0.8, body.h, (o) => !o.enabled || o === b)) return { box: b, x: tx, y: b.max.y, z: tz };
      }
    }
    return null;
  }
}
