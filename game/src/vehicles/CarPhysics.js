// A drivable car: arcade physics (throttle, brake/reverse, steering, grip and handbrake drifts),
// collisions with the city and other cars, damage, smoke and wrecks.
import { CAR_TYPES, buildCarMesh } from './CarModels.js';
import { clamp } from '../core/Random.js';

let nextId = 1;

export class Vehicle {
  constructor(game, typeKey, x, z, heading, color) {
    this.id = nextId++;
    this.game = game;
    this.typeKey = typeKey;
    this.type = CAR_TYPES[typeKey];
    this.color = color || this.type.colors[0];
    const { group, parts } = buildCarMesh(typeKey, this.color);
    this.mesh = group;
    this.parts = parts;
    game.scene.add(group);
    this.x = x; this.z = z; this.heading = heading;
    this.vx = 0; this.vz = 0;
    this.speed = 0;          // signed forward speed (m/s)
    this.steer = 0;
    this.yawRate = 0;
    this.health = 100;
    this.wrecked = false;
    this.driver = null;      // 'player' | 'ai' | 'police' | null (parked)
    this.ai = null;
    this.radius = Math.max(this.type.len, this.type.wid) * 0.48;
    this.wheelSpin = 0;
    this.lightTimer = 0;
    this.smokeTimer = 0;
    this.sirenOn = typeKey === 'police';
    this.mission = null;
    this.sync();
  }

  get isPolice() { return this.typeKey === 'police'; }

  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  // controls: { throttle 0..1, brake 0..1, steer -1..1 (positive = left), handbrake bool }
  drive(dt, c) {
    if (this.wrecked) c = { throttle: 0, brake: 0, steer: 0, handbrake: true };
    const t = this.type;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -fz, rz = fx;
    let vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;

    if (c.throttle > 0) vF += t.accel * c.throttle * dt * (vF < t.maxSpeed ? 1 : 0);
    if (c.brake > 0) {
      if (vF > 0.8) vF -= 30 * c.brake * dt;
      else if (vF > -t.maxSpeed * 0.35) vF -= t.accel * 0.6 * c.brake * dt;
    }
    if (c.handbrake) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 9 * dt);
    if (!c.throttle && !c.brake) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 3 * dt);
    vF *= 1 - 0.12 * dt;

    const grip = c.handbrake ? 1.4 : t.grip;
    vR *= Math.exp(-grip * dt);

    const speedFrac = clamp(Math.abs(vF) / t.maxSpeed, 0, 1);
    const maxSteer = 0.62 * (1 - speedFrac * 0.55);
    this.steer += (c.steer * maxSteer - this.steer) * Math.min(1, dt * 8);
    this.yawRate = (vF * Math.tan(this.steer)) / 2.7;
    if (c.handbrake && Math.abs(vF) > 6) this.yawRate *= 1.5;
    this.heading += this.yawRate * dt;

    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const nrx = -nfz, nrz = nfx;
    this.vx = nfx * vF + nrx * vR;
    this.vz = nfz * vF + nrz * vR;
    this.speed = vF;
    this.drift = Math.abs(vR);
    this.integrate(dt);
  }

  integrate(dt) {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.collideWorld();
    this.sync(dt);
  }

  // Two circles (front and rear) against buildings.
  collideWorld() {
    const f = this.forward();
    const off = this.type.len * 0.28;
    const r = this.type.wid * 0.55;
    let worst = 0;
    for (const s of [1, -1]) {
      const p = { x: this.x + f.x * off * s, z: this.z + f.z * off * s };
      const hit = this.game.collision.resolveCircle(p, r);
      if (hit.hit) {
        const dx = p.x - (this.x + f.x * off * s), dz = p.z - (this.z + f.z * off * s);
        this.x += dx; this.z += dz;
        const vn = this.vx * hit.nx + this.vz * hit.nz;
        if (vn < 0) {
          this.vx -= vn * hit.nx * 1.35;
          this.vz -= vn * hit.nz * 1.35;
          this.vx *= 0.8; this.vz *= 0.8;
          worst = Math.max(worst, -vn);
        }
      }
    }
    if (worst > 6) this.impact(worst);
  }

  impact(strength) {
    this.damage(strength * 1.1);
    this.game.audio?.crash(strength);
    if (this.driver === 'player') this.game.camera?.shake(Math.min(1, strength / 25));
  }

  damage(amount, byPlayer = false) {
    if (this.wrecked) return;
    this.health -= amount;
    if (byPlayer && this.isPolice) this.game.wanted.reportCrime('copcar', this.x, this.z);
    if (this.health <= 0) this.explode(byPlayer);
  }

  explode(byPlayer) {
    this.health = 0;
    this.wrecked = true;
    this.parts.bodyMat.color.set('#2b2b2b');
    this.game.effects.explosion(this.x, 1, this.z);
    this.game.onVehicleExploded?.(this, byPlayer);
  }

  sync(dt = 0) {
    const m = this.mesh;
    m.position.set(this.x, 0, this.z);
    m.rotation.y = this.heading;
    const spd = Math.hypot(this.vx, this.vz) * Math.sign(this.speed || 1);
    this.wheelSpin += (spd * dt) / 0.38;
    for (const w of this.parts.wheels) w.rotation.x = this.wheelSpin;
    for (const p of this.parts.steerPivots) p.rotation.y = this.steer;
    // Body roll in corners.
    m.rotation.z = clamp(-this.yawRate * Math.abs(this.speed) * (this.type.twoWheel ? 0.03 : 0.004), -0.06, 0.06) * (this.type.twoWheel ? 4 : 1);
    if (this.parts.rider) this.parts.rider.visible = this.driver === 'ai';
    if (this.parts.lightbar && this.sirenOn && !this.wrecked) {
      this.lightTimer += dt;
      const on = Math.floor(this.lightTimer * 6) % 2 === 0;
      const lb = this.parts.lightbar;
      lb.red.color.set(on ? '#ff1f3d' : '#3a0710');
      lb.blue.color.set(on ? '#0b1a44' : '#2f7bff');
      lb.glowRed.visible = lb.glowBlue.visible = true;
      lb.glowRed.material.opacity = on ? 1 : 0.3;
      lb.glowBlue.material.opacity = on ? 0.3 : 1;
    } else if (this.parts.lightbar) {
      this.parts.lightbar.glowRed.visible = this.parts.lightbar.glowBlue.visible = false;
    }
    if (dt > 0 && this.health < 45) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = this.wrecked ? 0.12 : 0.25;
        const f = this.forward();
        this.game.effects.smoke(this.x + f.x * this.type.len * 0.35, 1.2, this.z + f.z * this.type.len * 0.35, this.wrecked);
      }
    }
  }

  remove() {
    this.game.scene.remove(this.mesh);
    this.removed = true;
  }
}

// Push overlapping cars apart and trade damage on hard hits.
export function resolveCarCollisions(vehicles) {
  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i];
    for (let j = i + 1; j < vehicles.length; j++) {
      const b = vehicles[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const rr = a.radius + b.radius - 0.6;
      const d2 = dx * dx + dz * dz;
      if (d2 > rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d;
      const aKin = a.driver === 'ai', bKin = b.driver === 'ai';
      const wa = aKin && !bKin ? 0.15 : bKin && !aKin ? 0.85 : 0.5;
      a.x -= nx * pen * wa; a.z -= nz * pen * wa;
      b.x += nx * pen * (1 - wa); b.z += nz * pen * (1 - wa);
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const imp = -rel;
        a.vx += nx * -imp * 0.55 * (1 - wa) * 2; a.vz += nz * -imp * 0.55 * (1 - wa) * 2;
        b.vx += nx * imp * 0.55 * wa * 2; b.vz += nz * imp * 0.55 * wa * 2;
        if (imp > 5) {
          const byPlayer = a.driver === 'player' || b.driver === 'player';
          a.damage(imp * 0.9, byPlayer && b.driver === 'player');
          b.damage(imp * 0.9, byPlayer && a.driver === 'player');
          a.game.audio?.crash(imp);
          if (a.ai) a.ai.blocked = 1.5;
          if (b.ai) b.ai.blocked = 1.5;
          a.game.onCarHit?.(a, b, imp);
        }
      }
    }
  }
}
