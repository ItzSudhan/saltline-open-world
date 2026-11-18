// Static collision: axis-aligned boxes for buildings and props, kept in a coarse spatial hash.
import { WORLD_MIN, WORLD_MAX, WORLD_MAX_X } from './CityLayout.js';

const HASH = 40;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.cells = new Map();
  }

  addBox(minX, minZ, maxX, maxZ, height = 30) {
    const box = { minX, minZ, maxX, maxZ, height };
    this.boxes.push(box);
    for (let cx = Math.floor(minX / HASH); cx <= Math.floor(maxX / HASH); cx++) {
      for (let cz = Math.floor(minZ / HASH); cz <= Math.floor(maxZ / HASH); cz++) {
        const key = cx * 1000 + cz;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(box);
      }
    }
    return box;
  }

  nearby(x, z) {
    return this.cells.get(Math.floor(x / HASH) * 1000 + Math.floor(z / HASH)) || [];
  }

  // Push a circle out of any box it overlaps. Returns the push normal (or null) in `out`.
  resolveCircle(pos, radius, out = {}) {
    out.hit = false; out.nx = 0; out.nz = 0;
    for (let pass = 0; pass < 2; pass++) {
      const seen = new Set();
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        for (const b of this.nearby(pos.x + ox * radius, pos.z + oz * radius)) {
          if (seen.has(b)) continue;
          seen.add(b);
          const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
          const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
          let dx = pos.x - cx, dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) continue;
          let nx, nz, push;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            nx = dx / d; nz = dz / d; push = radius - d;
          } else {
            // Centre inside the box: leave by the nearest face.
            const l = pos.x - b.minX, r = b.maxX - pos.x, t = pos.z - b.minZ, w = b.maxZ - pos.z;
            const m = Math.min(l, r, t, w);
            nx = m === l ? -1 : m === r ? 1 : 0;
            nz = m === t ? -1 : m === w ? 1 : 0;
            if (nx && nz) nz = 0;
            push = m + radius;
          }
          pos.x += nx * push; pos.z += nz * push;
          out.hit = true; out.nx = nx; out.nz = nz;
        }
      }
    }
    // The edges of the world.
    if (pos.x < WORLD_MIN) { pos.x = WORLD_MIN; out.hit = true; out.nx = 1; out.nz = 0; }
    if (pos.x > WORLD_MAX_X) { pos.x = WORLD_MAX_X; out.hit = true; out.nx = -1; out.nz = 0; }
    if (pos.z < WORLD_MIN) { pos.z = WORLD_MIN; out.hit = true; out.nx = 0; out.nz = 1; }
    if (pos.z > WORLD_MAX) { pos.z = WORLD_MAX; out.hit = true; out.nx = 0; out.nz = -1; }
    return out;
  }

  // Distance along a 2D ray to the first box (ignores height below `y`), or Infinity.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = Infinity;
    for (const b of this.boxes) {
      let tmin = 0, tmax = maxDist;
      const slab = (o, d, lo, hi) => {
        if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
        let t1 = (lo - o) / d, t2 = (hi - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        return tmin <= tmax;
      };
      if (!slab(ox, dx, b.minX, b.maxX)) continue;
      if (!slab(oz, dz, b.minZ, b.maxZ)) continue;
      if (!slab(oy, dy, -1, b.height)) continue;
      if (tmin < best) best = tmin;
    }
    return best;
  }

  // True when nothing solid stands between two points at chest height.
  lineOfSight(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    return this.raycast(ax, 1.5, az, dx / len, 0, dz / len, len) >= len;
  }
}
