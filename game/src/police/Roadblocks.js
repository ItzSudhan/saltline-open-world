// HEAT 4+ roadblocks: while the player drives, SBPD parks two cruisers nose to nose across the
// road ahead of them, lights flashing. Once the player is past (or the heat drops), the cruisers
// rejoin the chase as ordinary pursuit units.
import { Vehicle } from '../vehicles/CarPhysics.js';
import { roadCoord, roadIndexNear, onRoad, HALF, ROAD_HALF } from '../world/CityLayout.js';

const AHEAD = 85;

export class Roadblocks {
  constructor(game) {
    this.game = game;
    this.blocks = [];   // { cars: [Vehicle, Vehicle], x, z, axis }
    this.cooldown = 6;
  }

  get cars() { return this.blocks.flatMap((b) => b.cars.filter((v) => !v.removed && v.driver === 'roadblock')); }

  // Two cruisers across the road through (x, z); axis 'z' means the road runs north-south.
  place(x, z, axis) {
    const game = this.game, cars = [];
    for (const s of [-1, 1]) {
      const across = axis === 'z' ? Math.PI / 2 : 0;
      const h = across + s * 0.32 + (s > 0 ? Math.PI : 0);
      const ox = axis === 'z' ? s * 3.1 : 0, oz = axis === 'z' ? 0 : s * 3.1;
      const v = new Vehicle(game, 'police', x + ox, z + oz, h);
      v.driver = 'roadblock';
      v.sirenOn = true;
      game.vehicles.push(v);
      cars.push(v);
    }
    const block = { cars, x, z, axis };
    this.blocks.push(block);
    return block;
  }

  // Finds a spot on the player's road a block ahead of them.
  tryPlaceAhead() {
    const v = this.game.player.vehicle;
    if (!v || Math.hypot(v.vx, v.vz) < 8) return null;
    const alongZ = Math.abs(v.vz) > Math.abs(v.vx);
    const dir = Math.sign(alongZ ? v.vz : v.vx);
    if (alongZ) {
      const x = roadCoord(roadIndexNear(v.x));
      if (Math.abs(v.x - x) > ROAD_HALF) return null;
      const z = v.z + dir * AHEAD;
      if (Math.abs(z) > HALF - 10 || !onRoad(x, z)) return null;
      return this.place(x, z, 'z');
    }
    const z = roadCoord(roadIndexNear(v.z));
    if (Math.abs(v.z - z) > ROAD_HALF) return null;
    const x = v.x + dir * AHEAD;
    if (Math.abs(x) > HALF - 10 || !onRoad(x, z)) return null;
    return this.place(x, z, 'x');
  }

  // Cruisers leave the roadblock: they join the pursuit (or go home if the heat is gone).
  release(block) {
    const wanted = this.game.wanted;
    for (const v of block.cars) {
      if (v.removed || v.driver !== 'roadblock') continue;
      if (wanted.level > 0 && !v.wrecked) wanted.adopt(v);
      else { v.driver = null; v.sirenOn = false; this.game.traffic.cars.push(v); }
    }
    block.done = true;
  }

  update(dt) {
    const game = this.game, p = game.player.position, level = game.wanted.level;
    this.cooldown -= dt;
    for (const b of this.blocks) {
      for (const v of b.cars) if (v.driver === 'roadblock') v.drive(dt, { throttle: 0, brake: 1, steer: 0, handbrake: true });
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      const v = game.player.vehicle;
      const behind = v && ((b.x - p.x) * v.vx + (b.z - p.z) * v.vz) < 0 && d > 18;
      if (level < 4 || d > 200 || behind || b.cars.every((c) => c.wrecked || c.driver !== 'roadblock')) this.release(b);
    }
    this.blocks = this.blocks.filter((b) => !b.done);
    if (level >= 4 && this.cooldown <= 0 && !this.blocks.length && !game.player.dead) {
      this.cooldown = this.tryPlaceAhead() ? 22 : 2;
    }
  }

  clear() {
    for (const b of this.blocks) for (const v of b.cars) if (v.driver === 'roadblock') { v.driver = null; v.sirenOn = false; this.game.traffic.cars.push(v); }
    this.blocks = [];
  }
}
