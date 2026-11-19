// Pedestrians: they stroll the sidewalk loop around each block (or along the beach), scatter from
// gunfire and reckless drivers, can be knocked down, and drop cash when they fall.
import { CharacterModel, randomLook } from '../characters/CharacterModel.js';
import { GRID, roadCoord, blockIndexAt, BEACH_START } from '../world/CityLayout.js';
import { wrapAngle } from '../core/Random.js';

const INSET = 10.4;
const SIDE = 80 - INSET * 2;
const TARGET = 64;

function perimeterPoint(bi, bj, s) {
  const x0 = roadCoord(bi) + INSET, z0 = roadCoord(bj) + INSET;
  const per = SIDE * 4;
  s = ((s % per) + per) % per;
  const side = Math.floor(s / SIDE), t = s - side * SIDE;
  if (side === 0) return { x: x0 + t, z: z0 };
  if (side === 1) return { x: x0 + SIDE, z: z0 + t };
  if (side === 2) return { x: x0 + SIDE - t, z: z0 + SIDE };
  return { x: x0, z: z0 + SIDE - t };
}

function nearestPerimeterS(bi, bj, x, z) {
  const x0 = roadCoord(bi) + INSET, z0 = roadCoord(bj) + INSET;
  const lx = Math.min(Math.max(x - x0, 0), SIDE), lz = Math.min(Math.max(z - z0, 0), SIDE);
  const d = [lz, SIDE - lx, SIDE - lz, lx];
  const side = d.indexOf(Math.min(...d));
  if (side === 0) return lx;
  if (side === 1) return SIDE + lz;
  if (side === 2) return SIDE * 2 + (SIDE - lx);
  return SIDE * 3 + (SIDE - lz);
}

export class PedestrianSystem {
  constructor(game) {
    this.game = game;
    this.peds = [];
    this.timer = 0;
  }

  create(look, x, z) {
    const model = new CharacterModel(look);
    this.game.scene.add(model.root);
    const ped = { model, x, z, heading: 0, speed: 1.3, state: 'walk', health: 60, dead: false, fleeT: 0, deadT: 0, vx: 0, vz: 0 };
    this.peds.push(ped);
    return ped;
  }

  spawnOnBlock(bi, bj, s) {
    const rand = this.game.rand;
    const p = perimeterPoint(bi, bj, s);
    const ped = this.create(randomLook(rand), p.x, p.z);
    Object.assign(ped, { bi, bj, s, dir: rand.chance(0.5) ? 1 : -1, speed: 1.1 + rand.next() * 0.6 });
    return ped;
  }

  spawnOnBeach(z) {
    const rand = this.game.rand;
    // Half the beach crowd settles by an umbrella and looks out to sea; the rest stroll the sand.
    const spots = this.game.beach?.spots || [];
    if (spots.length && rand.chance(0.5)) {
      let best = spots[0];
      for (const s of spots) if (Math.abs(s.z - z) < Math.abs(best.z - z)) best = s;
      const ped = this.create(randomLook(rand), best.x + (rand.next() - 0.5) * 1.5, best.z + (rand.next() - 0.5) * 1.5);
      Object.assign(ped, { beach: true, idle: true, dir: 1, speed: 1, heading: Math.PI / 2 + (rand.next() - 0.5) * 1.6 });
      if (rand.chance(0.6)) ped.model.setSitting(true);
      return ped;
    }
    const ped = this.create(randomLook(rand), BEACH_START + 6 + rand.next() * 60, z);
    Object.assign(ped, { beach: true, dir: rand.chance(0.5) ? 1 : -1, speed: 1 + rand.next() * 0.5 });
    return ped;
  }

  spawnFleeing(x, z, fromX, fromZ, cop = false) {
    const look = cop ? { skin: '#d9a07a', shirt: '#1d3f8a', pants: '#14213d', hair: '#1b1b1b', cap: '#14213d' } : randomLook(this.game.rand);
    const ped = this.create(look, x, z);
    this.flee(ped, fromX, fromZ, 8);
    return ped;
  }

  spawnNear(px, pz) {
    const rand = this.game.rand;
    if (px > BEACH_START - 90 && rand.chance(px > BEACH_START - 30 ? 0.6 : 0.3)) return this.spawnOnBeach(pz + (rand.next() - 0.5) * 220);
    const bi = Math.min(GRID - 1, Math.max(0, blockIndexAt(px) + rand.int(-1, 1)));
    const bj = Math.min(GRID - 1, Math.max(0, blockIndexAt(pz) + rand.int(-1, 1)));
    return this.spawnOnBlock(bi, bj, rand.next() * SIDE * 4);
  }

  flee(ped, fromX, fromZ, time = 6) {
    if (ped.dead) return;
    ped.state = 'flee';
    ped.idle = false;
    if (ped.model.sitting) ped.model.setSitting(false);
    ped.fleeT = time;
    ped.fromX = fromX; ped.fromZ = fromZ;
  }

  panic(x, z, radius) {
    for (const ped of this.peds) if (!ped.dead && Math.hypot(ped.x - x, ped.z - z) < radius) this.flee(ped, x, z);
  }

  kill(ped, byPlayer, pushX = 0, pushZ = 0) {
    if (ped.dead) return;
    ped.dead = true;
    ped.state = 'dead';
    ped.deadT = 0;
    ped.vx = pushX; ped.vz = pushZ;
    ped.model.setDead(true);
    this.game.effects.blood(ped.x, 1, ped.z);
    if (byPlayer) {
      this.game.wanted.reportCrime('assault', ped.x, ped.z);
      this.game.stats.peds++;
    }
    if (this.game.rand.chance(0.6)) this.game.pickups.dropCash(ped.x, ped.z, 20 + Math.floor(this.game.rand.next() * 60));
    this.panic(ped.x, ped.z, 30);
  }

  damage(ped, amount, byPlayer) {
    ped.health -= amount;
    if (ped.health <= 0) this.kill(ped, byPlayer);
    else { this.flee(ped, this.game.player.x, this.game.player.z); if (byPlayer) this.game.wanted.reportCrime('assault', ped.x, ped.z); }
  }

  update(dt) {
    const game = this.game, p = game.player.position;
    for (const ped of this.peds) {
      const d = Math.hypot(ped.x - p.x, ped.z - p.z);
      if (d > 160 || (ped.dead && ped.deadT > 25)) { game.scene.remove(ped.model.root); ped.removed = true; }
    }
    this.peds = this.peds.filter((q) => !q.removed);
    this.timer -= dt;
    if (this.peds.length < TARGET && this.timer <= 0) {
      this.timer = 0.1;
      const ped = this.spawnNear(p.x, p.z);
      if (ped && Math.hypot(ped.x - p.x, ped.z - p.z) < 25) { game.scene.remove(ped.model.root); this.peds.pop(); }
    }
    for (const ped of this.peds) this.step(ped, dt);
    this.checkCarHits();
  }

  step(ped, dt) {
    if (ped.dead) {
      ped.deadT += dt;
      ped.x += ped.vx * dt; ped.z += ped.vz * dt;
      ped.vx *= Math.exp(-4 * dt); ped.vz *= Math.exp(-4 * dt);
      ped.model.root.position.set(ped.x, 0.1, ped.z);
      return;
    }
    let speed = ped.speed, tx, tz;
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const ax = ped.x - ped.fromX, az = ped.z - ped.fromZ, l = Math.hypot(ax, az) || 1;
      tx = ped.x + (ax / l) * 5; tz = ped.z + (az / l) * 5;
      speed = 5.6;
      if (ped.fleeT <= 0) {
        ped.state = 'walk';
        if (!ped.beach) {
          ped.bi = Math.min(GRID - 1, Math.max(0, blockIndexAt(ped.x)));
          ped.bj = Math.min(GRID - 1, Math.max(0, blockIndexAt(ped.z)));
          ped.s = nearestPerimeterS(ped.bi, ped.bj, ped.x, ped.z);
        }
      }
    } else if (ped.beach && ped.idle) {
      tx = ped.x; tz = ped.z;
    } else if (ped.beach) {
      tx = ped.x; tz = ped.z + ped.dir * 5;
      if (Math.abs(ped.z) > 320) ped.dir = -Math.sign(ped.z);
    } else {
      ped.s += ped.dir * speed * dt;
      const q = perimeterPoint(ped.bi, ped.bj, ped.s);
      tx = q.x; tz = q.z;
      if (Math.hypot(tx - ped.x, tz - ped.z) > 3) speed = 3;
    }
    const dx = tx - ped.x, dz = tz - ped.z, l = Math.hypot(dx, dz);
    if (l > 0.01) {
      const mv = Math.min(l, speed * dt * (ped.state === 'flee' ? 1 : 1.5));
      ped.x += (dx / l) * mv; ped.z += (dz / l) * mv;
      const h = Math.atan2(dx, dz);
      ped.heading += wrapAngle(h - ped.heading) * Math.min(1, dt * 8);
    }
    if (ped.state === 'flee') {
      const pos = { x: ped.x, z: ped.z };
      this.game.collision.resolveCircle(pos, 0.4);
      ped.x = pos.x; ped.z = pos.z;
    }
    ped.model.root.position.set(ped.x, 0.14, ped.z);
    ped.model.root.rotation.y = ped.heading;
    ped.model.animate(dt, l > 0.01 ? speed : 0);
  }

  checkCarHits() {
    for (const v of this.game.vehicles) {
      const sp = Math.hypot(v.vx, v.vz);
      if (sp < 3) continue;
      for (const ped of this.peds) {
        if (ped.dead) continue;
        const d = Math.hypot(ped.x - v.x, ped.z - v.z);
        if (d < v.radius * 0.8 + 0.3) {
          this.game.audio?.thud();
          this.kill(ped, v.driver === 'player', v.vx * 0.6, v.vz * 0.6);
          if (v.driver === 'player') this.game.wanted.reportCrime('runover', ped.x, ped.z);
        } else if (d < 12 && v.driver === 'player' && sp > 8) {
          const ahead = ((ped.x - v.x) * v.vx + (ped.z - v.z) * v.vz) / sp;
          if (ahead > 0) this.flee(ped, v.x, v.z, 3);
        }
      }
    }
  }
}
