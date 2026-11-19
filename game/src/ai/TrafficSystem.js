// Civilian traffic: cars that keep to the right-hand lane, curve through intersections, brake for
// whatever is ahead and are recycled in a ring around the player.
import { Vehicle } from '../vehicles/CarPhysics.js';
import { TRAFFIC_MIX, CAR_TYPES } from '../vehicles/CarModels.js';
import { GRID, LANE, ROAD_HALF, roadCoord } from '../world/CityLayout.js';

const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const TARGET_CARS = 32;

export const laneRight = (d) => ({ x: -d.z, z: d.x });
export const nodePos = (i, j) => ({ x: roadCoord(i), z: roadCoord(j) });
const inGrid = (i, j) => i >= 0 && j >= 0 && i <= GRID && j <= GRID;

// Choose the next direction at an intersection (no U-turns, stay in the grid).
export function exitsFrom(i, j, dir) {
  return DIRS.filter((d) => !(d.x === -dir.x && d.z === -dir.z) && inGrid(i + d.x, j + d.z));
}

export class TrafficSystem {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.spawnTimer = 0;
    this.parked = [];
    this.parkingSpots = this.planParking();
  }

  // Kerbside parking along every street, decided once from the seed.
  planParking() {
    const rand = this.game.rand, spots = [];
    for (let line = 0; line <= GRID; line++) {
      for (let seg = 0; seg < GRID; seg++) {
        for (const along of [20, 34, 48, 62]) {
          for (const side of [-1, 1]) {
            if (!rand.chance(0.22)) continue;
            const a = roadCoord(seg) + along, c = roadCoord(line) + side * 6.5;
            const type = rand.pick(TRAFFIC_MIX);
            const color = rand.pick(CAR_TYPES[type].colors);
            // Roads running north-south (x = const) and east-west (z = const).
            spots.push({ x: c, z: a, heading: side > 0 ? Math.PI : 0, type, color, vehicle: null });
            if (rand.chance(0.9)) spots.push({ x: a, z: c, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2, type: rand.pick(TRAFFIC_MIX), color: rand.pick(['#e9e4da', '#3f6f9f', '#9a2f2f', '#2ec4b6', '#4a5560']), vehicle: null });
          }
        }
      }
    }
    return spots;
  }

  updateParking(dt) {
    const game = this.game, p = game.player.position;
    for (const s of this.parkingSpots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (!s.vehicle && !s.taken && d < 130) {
        const v = new Vehicle(game, s.type, s.x, s.z, s.heading, s.color);
        v.parked = true;
        s.vehicle = v;
        game.vehicles.push(v);
        this.parked.push(v);
      } else if (s.vehicle) {
        const v = s.vehicle;
        const moved = v.driver || Math.hypot(v.x - s.x, v.z - s.z) > 3 || v.wrecked;
        if (moved) { s.taken = true; s.vehicle = null; v.parked = false; this.cars.push(v); }
        else if (d > 170) { this.despawn(v); s.vehicle = null; }
      }
    }
    this.parked = this.parked.filter((v) => v.parked && !v.removed);
    for (const v of this.parked) {
      if (Math.hypot(v.vx, v.vz) > 0.05) v.drive(dt, { throttle: 0, brake: 0, steer: 0, handbrake: true });
    }
  }

  // Put a car on the lane approaching node (i, j) travelling along dir, `back` metres before it.
  spawnCar(i, j, dir, back, typeKey, color) {
    const rand = this.game.rand;
    typeKey = typeKey || rand.pick(TRAFFIC_MIX);
    const r = laneRight(dir), n = nodePos(i, j);
    const x = n.x - dir.x * back + r.x * LANE, z = n.z - dir.z * back + r.z * LANE;
    const v = new Vehicle(this.game, typeKey, x, z, Math.atan2(dir.x, dir.z), color || rand.pick(CAR_TYPES[typeKey].colors));
    v.driver = 'ai';
    v.ai = { i, j, dir, seg: null, cruise: 10 + rand.next() * 4, speed: 8, blocked: 0, honk: 0 };
    this.startStraight(v, x, z);
    this.game.vehicles.push(v);
    this.cars.push(v);
    return v;
  }

  startStraight(v, x, z) {
    const a = v.ai, n = nodePos(a.i, a.j), r = laneRight(a.dir);
    const bx = n.x - a.dir.x * (ROAD_HALF + 1) + r.x * LANE, bz = n.z - a.dir.z * (ROAD_HALF + 1) + r.z * LANE;
    a.seg = { ax: x, az: z, cx: (x + bx) / 2, cz: (z + bz) / 2, bx, bz, s: 0, len: Math.max(0.1, Math.hypot(bx - x, bz - z)), turn: false };
  }

  startTurn(v) {
    const a = v.ai, rand = this.game.rand;
    const options = exitsFrom(a.i, a.j, a.dir);
    const straight = options.find((d) => d.x === a.dir.x && d.z === a.dir.z);
    const nd = straight && rand.chance(0.55) ? straight : rand.pick(options);
    const n = nodePos(a.i, a.j), r = laneRight(a.dir), nr = laneRight(nd);
    const s = a.seg;
    const bx = n.x + nd.x * (ROAD_HALF + 1) + nr.x * LANE, bz = n.z + nd.z * (ROAD_HALF + 1) + nr.z * LANE;
    let cx, cz;
    if (nd === straight) { cx = (s.bx + bx) / 2; cz = (s.bz + bz) / 2; }
    else { cx = n.x + r.x * LANE + nr.x * LANE; cz = n.z + r.z * LANE + nr.z * LANE; }
    const chord = Math.hypot(bx - s.bx, bz - s.bz);
    a.seg = { ax: s.bx, az: s.bz, cx, cz, bx, bz, s: 0, len: chord * (nd === straight ? 1 : 1.15), turn: true };
    a.dir = nd;
    a.i += nd.x; a.j += nd.z;
  }

  update(dt) {
    const game = this.game, p = game.player.position;
    this.updateParking(dt);
    // Recycle cars far from the player, top up the ring.
    for (const v of this.cars) {
      const d = Math.hypot(v.x - p.x, v.z - p.z), far = d > 270;
      if (v.wrecked) v.wreckT = (v.wreckT || 0) + dt;
      if ((far && v.driver !== 'player' && !v.mission) || (v.wrecked && (far || (v.wreckT > 40 && d > 30)))) this.despawn(v);
    }
    this.cars = this.cars.filter((v) => !v.removed);
    this.spawnTimer -= dt;
    const aiCount = this.cars.filter((v) => v.driver === 'ai').length;
    if (aiCount < TARGET_CARS && this.spawnTimer <= 0) {
      this.spawnTimer = 0.15;
      this.spawnNear(p.x, p.z, 70, 230);
    }
    for (const v of this.cars) {
      if (v.wrecked && v.driver === 'ai') { v.ai = null; v.driver = null; v.vx = v.vz = 0; }
      if (v.driver === 'ai' && v.ai) this.drive(v, dt);
      else if (!v.driver && !v.removed) v.drive(dt, { throttle: 0, brake: 0, steer: 0, handbrake: true });
    }
  }

  spawnNear(px, pz, minD, maxD) {
    const rand = this.game.rand;
    for (let tries = 0; tries < 8; tries++) {
      const i = rand.int(0, GRID), j = rand.int(0, GRID);
      const n = nodePos(i, j);
      const d = Math.hypot(n.x - px, n.z - pz);
      if (d < minD || d > maxD) continue;
      const dir = rand.pick(DIRS);
      if (!inGrid(i - dir.x, j - dir.z)) continue;
      const back = 15 + rand.next() * 50;
      const r = laneRight(dir);
      const x = n.x - dir.x * back + r.x * LANE, z = n.z - dir.z * back + r.z * LANE;
      if (this.game.vehicles.some((o) => Math.hypot(o.x - x, o.z - z) < 12)) continue;
      return this.spawnCar(i, j, dir, back);
    }
    return null;
  }

  despawn(v) {
    v.remove();
    const list = this.game.vehicles;
    const k = list.indexOf(v);
    if (k >= 0) list.splice(k, 1);
  }

  // How far ahead the road is clear (cars, the player, pedestrians in the lane).
  clearance(v) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let best = 99;
    const test = (x, z, width) => {
      const dx = x - v.x, dz = z - v.z;
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0 || ahead > 18) return;
      const side = Math.abs(dx * -fz + dz * fx);
      if (side < width) best = Math.min(best, ahead);
    };
    for (const o of this.game.vehicles) if (o !== v) test(o.x, o.z, 2.4);
    const pl = this.game.player;
    if (!pl.vehicle) test(pl.x, pl.z, 1.8);
    for (const ped of this.game.peds.peds) if (!ped.dead) test(ped.x, ped.z, 1.6);
    return best;
  }

  drive(v, dt) {
    const a = v.ai;
    a.blocked = Math.max(0, a.blocked - dt);
    const clear = a.reckless ? 99 : this.clearance(v);
    let want = a.seg.turn ? Math.min(a.cruise, 7.5) : a.cruise;
    if (clear < 18) want = Math.min(want, Math.max(0, (clear - 6) * 1.1));
    if (a.blocked > 0) want = 0;
    a.speed += Math.max(-14 * dt, Math.min(6 * dt, want - a.speed));
    if (clear < 7 && a.speed < 0.5) {
      a.honk -= dt;
      if (a.honk <= 0 && Math.hypot(v.x - this.game.player.x, v.z - this.game.player.z) < 30) { this.game.audio?.horn(v.x, v.z); a.honk = 3 + Math.random() * 3; }
    }
    const s = a.seg;
    s.s += a.speed * dt;
    if (s.s >= s.len) {
      if (s.turn) this.startStraight(v, s.bx, s.bz);
      else this.startTurn(v);
    }
    const g = v.ai.seg;
    const t = Math.min(1, g.s / g.len), u = 1 - t;
    const x = u * u * g.ax + 2 * u * t * g.cx + t * t * g.bx;
    const z = u * u * g.az + 2 * u * t * g.cz + t * t * g.bz;
    const tx = 2 * u * (g.cx - g.ax) + 2 * t * (g.bx - g.cx), tz = 2 * u * (g.cz - g.az) + 2 * t * (g.bz - g.cz);
    const nh = Math.atan2(tx, tz);
    const dh = Math.atan2(Math.sin(nh - v.heading), Math.cos(nh - v.heading));
    v.yawRate = dt > 0 ? dh / dt : 0;
    v.steer = Math.max(-0.5, Math.min(0.5, dh * 8));
    v.heading = nh;
    v.vx = Math.sin(nh) * a.speed; v.vz = Math.cos(nh) * a.speed;
    v.x = x; v.z = z;
    v.speed = a.speed;
    v.sync(dt);
  }

  ejectDriver(v) {
    if (!v.ai && v.driver !== 'police') return;
    const f = v.forward();
    this.game.peds.spawnFleeing(v.x + f.z * 2.4, v.z - f.x * 2.4, this.game.player.x, this.game.player.z, v.isPolice);
    v.ai = null;
    v.driver = null;
    const k = this.cars.indexOf(v);
    if (k < 0) this.cars.push(v);
  }
}
