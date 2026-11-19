// Rae Castillo, the player: walking, sprinting, entering/stealing/leaving cars and driving them.
import { CharacterModel } from '../characters/CharacterModel.js';
import { clamp, wrapAngle } from '../core/Random.js';

export const RAE_LOOK = { skin: '#c98f6a', shirt: '#ff6b5a', pants: '#24364f', hair: '#1a1210', cap: null };

export class PlayerController {
  constructor(game) {
    this.game = game;
    this.model = new CharacterModel(RAE_LOOK);
    game.scene.add(this.model.root);
    this.x = 0; this.z = 0; this.heading = 0;
    this.vx = 0; this.vz = 0;
    this.health = 100; this.armor = 0;
    this.vehicle = null;
    this.speed = 0;
    this.radius = 0.45;
    this.punchT = 1;
    this.dead = false;
    this.aiming = false;
  }

  place(x, z, heading = 0) {
    this.x = x; this.z = z; this.heading = heading;
    this.vx = this.vz = 0;
    this.sync();
  }

  get position() { return this.vehicle ? { x: this.vehicle.x, z: this.vehicle.z } : { x: this.x, z: this.z }; }

  update(dt) {
    const { input, camera } = this.game;
    if (this.dead) return;
    if (input.wasPressed('KeyF')) {
      if (this.vehicle) this.exitVehicle();
      else this.tryEnterVehicle();
    }
    if (this.vehicle) {
      const v = this.vehicle;
      v.drive(dt, {
        throttle: input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0,
        brake: input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0,
        steer: input.axis('KeyD', 'KeyA') + input.axis('ArrowRight', 'ArrowLeft'),
        handbrake: input.isDown('Space'),
      });
      this.x = v.x; this.z = v.z;
      this.speed = Math.abs(v.speed);
      if (v.wrecked) this.exitVehicle(true);
      return;
    }
    // On foot, relative to the camera.
    const yaw = camera.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
    const mf = input.axis('KeyS', 'KeyW'), mr = input.axis('KeyA', 'KeyD');
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    this.aiming = input.buttons[2] && this.game.weapons.current.id !== 'fists';
    const maxSpeed = this.aiming ? 2.6 : sprint ? 7.2 : 3.6;
    let dx = fx * mf + rx * mr, dz = fz * mf + rz * mr;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }
    const accel = Math.min(1, dt * 10);
    this.vx += (dx * maxSpeed - this.vx) * accel;
    this.vz += (dz * maxSpeed - this.vz) * accel;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.speed = Math.hypot(this.vx, this.vz);
    if (this.aiming || input.buttons[0]) this.heading = yaw;
    else if (this.speed > 0.3) {
      const target = Math.atan2(this.vx, this.vz);
      this.heading += wrapAngle(target - this.heading) * Math.min(1, dt * 12);
    }
    const p = { x: this.x, z: this.z };
    this.game.collision.resolveCircle(p, this.radius);
    this.x = p.x; this.z = p.z;
    // Bump into cars.
    for (const v of this.game.vehicles) {
      const ddx = this.x - v.x, ddz = this.z - v.z, d = Math.hypot(ddx, ddz), r = v.radius * 0.75 + this.radius;
      if (d < r && d > 1e-4) { this.x = v.x + (ddx / d) * r; this.z = v.z + (ddz / d) * r; }
    }
    this.punchT += dt * 3.5;
    this.sync(dt);
  }

  sync(dt = 0) {
    const m = this.model;
    m.root.visible = !this.vehicle;
    m.root.position.set(this.x, 0.14, this.z);
    m.root.rotation.y = this.heading;
    const armed = this.game.weapons && this.game.weapons.current.id !== 'fists';
    m.animate(dt, this.speed, this.aiming || (armed && this.game.input.buttons[0]), armed);
    if (this.punchT < 1) m.punch(this.punchT);
  }

  nearestVehicle(maxDist = 4.5) {
    let best = null, bd = maxDist;
    for (const v of this.game.vehicles) {
      if (v.wrecked) continue;
      const d = Math.hypot(v.x - this.x, v.z - this.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  tryEnterVehicle() {
    const v = this.nearestVehicle();
    if (!v) return false;
    if (v.driver === 'ai' || v.driver === 'police' || v.bailed) {
      // Carjacking: the driver is pulled out (or already bailed at gunpoint) and runs.
      if (!v.bailed) this.game.traffic.ejectDriver(v);
      v.bailed = false;
      this.game.wanted.reportCrime(v.isPolice ? 'copcar' : 'carjack', v.x, v.z);
      this.game.hud.toast(`Stole a ${v.type.name}`);
      this.game.stats.cars++;
    }
    this.enterVehicle(v);
    return true;
  }

  enterVehicle(v) {
    this.vehicle = v;
    v.driver = 'player';
    v.owned = true;
    v.ai = null;
    v.sirenOn = false;
    this.model.root.visible = false;
    this.game.audio?.doorSound();
    this.game.hud.showVehicleName(v.type.name);
    this.game.audio?.radioOn();
  }

  exitVehicle(forced = false) {
    const v = this.vehicle;
    if (!v) return;
    if (!forced && Math.abs(v.speed) > 9) return;
    const f = v.forward();
    const side = { x: f.z, z: -f.x }; // driver side (left of the car)
    this.x = v.x + side.x * 2.2; this.z = v.z + side.z * 2.2;
    const p = { x: this.x, z: this.z };
    this.game.collision.resolveCircle(p, this.radius);
    this.x = p.x; this.z = p.z;
    this.heading = v.heading;
    v.driver = null;
    this.vehicle = null;
    this.vx = this.vz = 0;
    this.game.audio?.doorSound();
    this.game.audio?.radioOff();
    this.sync();
  }

  takeDamage(amount, fromX, fromZ) {
    if (this.dead || this.game.godMode) return;
    if (this.vehicle) amount *= 0.5;
    const absorbed = Math.min(this.armor, amount * 0.7);
    this.armor -= absorbed;
    this.health = clamp(this.health - (amount - absorbed), 0, 100);
    this.game.hud.flashDamage();
    if (this.health <= 0) this.game.onPlayerDown('wasted');
  }
}
