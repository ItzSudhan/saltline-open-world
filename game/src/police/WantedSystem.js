// HEAT: the wanted level (0-5). Crimes add heat; Saltline Bay PD sends pursuit cars that route
// through the street grid, ram, deploy officers on foot and make arrests; out of sight long enough,
// the heat cools off.
import { Vehicle } from '../vehicles/CarPhysics.js';
import { GRID, roadCoord, roadIndexNear, LANE } from '../world/CityLayout.js';
import { nodePos } from '../ai/TrafficSystem.js';
import { clamp, wrapAngle } from '../core/Random.js';
import { Helicopter } from './Helicopter.js';
import { Roadblocks } from './Roadblocks.js';
import { PoliceRoster } from './PoliceRoster.js';
import { RP_FOR } from '../progression/RankSystem.js';

const CRIME_HEAT = { carjack: 0.8, assault: 1.3, runover: 1.3, gunfire: 0.25, copcar: 2.2, copkill: 3.2, explosion: 1.6 };
const CRIME_LABEL = { carjack: 'Carjacking', assault: 'Assault', runover: 'Hit and run', copcar: 'Cruiser damaged', copkill: 'Officer down', explosion: 'Explosion' };
const LEVEL_AT = [0.5, 3, 7, 12, 19];
const CARS_FOR_LEVEL = [0, 1, 2, 3, 4, 5];

export class WantedSystem {
  constructor(game) {
    this.game = game;
    this.points = 0;
    this.cars = [];
    this.evadeT = 0;
    this.seen = false;
    this.spawnT = 0;
    this.bustT = 0;
    this.lastX = 0; this.lastZ = 0;
    this.heli = new Helicopter(game);
    this.roadblocks = new Roadblocks(game);
    this.roster = new PoliceRoster(game);
    this.crimeRpT = 0;
  }

  // Evade progress 0..1 while out of sight (for the HUD).
  get evadeFrac() { return this.level ? Math.min(1, this.evadeT / (7 + this.level * 2.5)) : 0; }

  get level() { let l = 0; for (const t of LEVEL_AT) if (this.points >= t) l++; return l; }
  get evading() { return this.level > 0 && !this.seen; }

  reportCrime(kind, x, z) {
    if (this.game.peaceful) return;
    const before = this.level;
    this.points = Math.min(26, this.points + (CRIME_HEAT[kind] || 0.5));
    if (kind === 'gunfire' && this.points < LEVEL_AT[0]) this.points = Math.min(this.points, LEVEL_AT[0] - 0.05);
    if (this.level > before) { this.evadeT = 0; this.lastX = x; this.lastZ = z; this.game.audio?.heatUp(); }
    // Street cred for crimes, rate-limited so spraying bullets doesn't farm RP.
    if (RP_FOR[kind] && this.crimeRpT <= 0) { this.game.rank?.award(RP_FOR[kind], CRIME_LABEL[kind]); this.crimeRpT = 1.5; }
  }

  // A cruiser from elsewhere (a roadblock) joins the pursuit.
  adopt(v) {
    v.driver = 'police';
    v.sirenOn = true;
    v.police = { waypoint: null, stuckT: 0, reverseT: 0, deployed: false, state: 'PURSUING' };
    if (!this.cars.includes(v)) this.cars.push(v);
  }

  setLevel(n) {
    this.points = n <= 0 ? 0 : LEVEL_AT[n - 1] + 0.1;
    this.evadeT = 0;
    const p = this.game.player.position;
    this.lastX = p.x; this.lastZ = p.z;
  }

  clear() {
    this.points = 0;
    for (const v of this.cars) { v.sirenOn = false; v.driver = null; v.ai = null; this.game.traffic.cars.push(v); }
    this.cars = [];
    this.roadblocks.clear();
    this.heli.dismiss();
  }

  spawnPoliceCar(nearX, nearZ, minD = 110, maxD = 170) {
    const rand = this.game.rand;
    for (let t = 0; t < 20; t++) {
      const i = rand.int(0, GRID), j = rand.int(0, GRID);
      const n = nodePos(i, j);
      const d = Math.hypot(n.x - nearX, n.z - nearZ);
      if (d < minD || d > maxD) continue;
      const h = Math.atan2(nearX - n.x, nearZ - n.z);
      return this.addPoliceCar(n.x, n.z, h);
    }
    return null;
  }

  addPoliceCar(x, z, heading) {
    const v = new Vehicle(this.game, 'police', x, z, heading);
    v.driver = 'police';
    v.police = { waypoint: null, stuckT: 0, reverseT: 0, deployed: false, state: 'RESPONDING' };
    this.game.vehicles.push(v);
    this.cars.push(v);
    return v;
  }

  update(dt) {
    const game = this.game, pl = game.player, pp = pl.position;
    const level = this.level;
    this.crimeRpT -= dt;
    // Wrecks and far-away units leave the pursuit (traffic cleans them up later).
    for (const v of this.cars) {
      if (Math.hypot(v.x - pp.x, v.z - pp.z) > 260) game.traffic.despawn(v);
      else if (v.wrecked) { v.driver = null; v.sirenOn = false; game.traffic.cars.push(v); }
    }
    this.cars = this.cars.filter((v) => !v.removed && !v.wrecked && v.driver === 'police');

    // Is anyone from SBPD watching?
    this.seen = false;
    if (level > 0) {
      for (const v of this.cars) {
        if (!v.wrecked && Math.hypot(v.x - pp.x, v.z - pp.z) < 75 && game.collision.lineOfSight(v.x, v.z, pp.x, pp.z)) { this.seen = true; break; }
      }
      if (!this.seen) for (const u of game.hostiles.alive()) {
        if (u.team === 'police' && Math.hypot(u.x - pp.x, u.z - pp.z) < 50) { this.seen = true; break; }
      }
      if (this.heli.tracking) this.seen = true;
      if (this.seen) { this.evadeT = 0; this.lastX = pp.x; this.lastZ = pp.z; }
      else {
        this.evadeT += dt;
        if (this.evadeT > 7 + level * 2.5) {
          this.points = 0;
          game.hud.toast('Heat cooled off');
          game.audio?.heatClear();
          game.rank?.award(80 * level, `Evaded HEAT ${level}`);
        }
      }
      // Fresh units.
      this.spawnT -= dt;
      const active = this.cars.filter((v) => !v.wrecked).length;
      if (active < CARS_FOR_LEVEL[level] && this.spawnT <= 0 && !pl.dead && this.cars.length < 8) {
        this.spawnT = 2.5;
        this.spawnPoliceCar(pp.x, pp.z, 90, 160);
      }
    } else if (this.cars.length) {
      for (const v of this.cars) { v.sirenOn = false; v.driver = null; v.police = null; game.traffic.cars.push(v); }
      this.cars = [];
    }

    for (const v of this.cars) this.drivePursuit(v, dt);
    this.heli.update(dt);
    this.roadblocks.update(dt);
    this.roster.update();
    this.checkBust(dt);
  }

  // Pursuit driving: straight at the player when in sight, otherwise along the road grid.
  drivePursuit(v, dt) {
    const game = this.game, pp = game.player.position, P = v.police;
    if (v.wrecked) { v.drive(dt, { throttle: 0, brake: 1, steer: 0 }); return; }
    const d = Math.hypot(pp.x - v.x, pp.z - v.z);
    const pv = game.player.vehicle;
    let tx, tz, ram = false;
    if (d < 45 && game.collision.lineOfSight(v.x, v.z, pp.x, pp.z)) {
      P.waypoint = null;
      if (pv && d < 16) {
        // Ramming: aim where the player's car will be in a moment, flat out.
        P.state = 'RAMMING'; ram = true;
        tx = pp.x + pv.vx * 0.35; tz = pp.z + pv.vz * 0.35;
      } else if (pv && v.id % 2 === 1 && Math.hypot(pv.vx, pv.vz) > 6) {
        // Flanking: odd-numbered units drive for a point beside and ahead of the player.
        P.state = 'FLANKING';
        const sp = Math.hypot(pv.vx, pv.vz), fx = pv.vx / sp, fz = pv.vz / sp;
        const side = v.id % 4 === 1 ? 1 : -1;
        tx = pp.x + fx * 10 - fz * 5 * side; tz = pp.z + fz * 10 + fx * 5 * side;
      } else {
        P.state = pv ? 'PURSUING' : (d < 20 ? 'ARRESTING' : 'PURSUING');
        tx = pp.x; tz = pp.z;
      }
    } else {
      P.state = 'RESPONDING';
      if (!P.waypoint || Math.hypot(P.waypoint.x - v.x, P.waypoint.z - v.z) < 12) {
        // Next intersection: the neighbour of the nearest node that best closes the distance.
        const i = roadIndexNear(v.x), j = roadIndexNear(v.z);
        const here = nodePos(i, j);
        let best = here, bestD = Infinity;
        if (Math.hypot(here.x - v.x, here.z - v.z) > 14) best = here;
        else {
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) continue;
            const n = nodePos(ni, nj);
            const dd = Math.hypot(n.x - this.lastX, n.z - this.lastZ);
            if (dd < bestD) { bestD = dd; best = n; }
          }
        }
        P.waypoint = best;
      }
      tx = P.waypoint.x; tz = P.waypoint.z;
      if (d < 70 && Math.hypot(tx - v.x, tz - v.z) > d) { tx = pp.x; tz = pp.z; }
    }
    const want = Math.atan2(tx - v.x, tz - v.z);
    let diff = wrapAngle(want - v.heading);
    const c = { throttle: 1, brake: 0, steer: clamp(diff * 2.2, -1, 1), handbrake: false };
    if (Math.abs(diff) > 1.3 && v.speed > 14) { c.throttle = 0; c.brake = 1; }
    if (Math.abs(diff) > 1.0 && v.speed > 8) c.handbrake = true;
    // Stop beside an on-foot player and send officers out.
    const playerOnFoot = !game.player.vehicle;
    if (playerOnFoot && d < 16) { c.throttle = 0; c.brake = 1; c.handbrake = false; }
    // Unstick.
    if (Math.abs(v.speed) < 1.2 && c.throttle > 0) P.stuckT += dt; else P.stuckT = 0;
    if (P.stuckT > 1.2) { P.reverseT = 1.1; P.stuckT = 0; }
    if (P.reverseT > 0) { P.reverseT -= dt; c.throttle = 0; c.brake = 1; c.steer = -c.steer; }
    const maxCap = this.level >= 3 || ram ? 1 : 0.85;
    c.throttle *= maxCap;
    v.drive(dt, c);
    if (playerOnFoot && d < 22 && Math.abs(v.speed) < 3 && !P.deployed) {
      P.deployed = true;
      const f = v.forward();
      for (const s of [1, -1]) game.hostiles.spawn('police', v.x + f.z * 2.4 * s, v.z - f.x * 2.4 * s, { aggro: true });
    }
  }

  checkBust(dt) {
    const game = this.game, pl = game.player;
    if (this.level === 0 || pl.dead) { this.bustT = 0; return; }
    const pp = pl.position;
    let close = false;
    if (!pl.vehicle) {
      for (const u of game.hostiles.alive()) if (u.team === 'police' && Math.hypot(u.x - pp.x, u.z - pp.z) < 2.6) close = true;
      for (const v of this.cars) if (!v.wrecked && Math.hypot(v.x - pp.x, v.z - pp.z) < 4) close = true;
      close = close && pl.speed < 2.5;
    } else if (Math.abs(pl.vehicle.speed) < 1) {
      let n = 0;
      for (const v of this.cars) if (!v.wrecked && Math.hypot(v.x - pp.x, v.z - pp.z) < 6.5) n++;
      close = n >= 1;
    }
    this.bustT = close ? this.bustT + dt : Math.max(0, this.bustT - dt * 2);
    if (this.bustT > (pl.vehicle ? 3.5 : 2)) { this.bustT = 0; game.onPlayerDown('busted'); }
  }
}
