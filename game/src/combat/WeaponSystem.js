// Fists, the Tern 9 pistol and the Squall SMG: hitscan shots along the camera's aim, melee,
// ammo, weapon switching and the crimes that gunfire reports.
import * as THREE from 'three';

export const WEAPONS = {
  fists: { id: 'fists', name: 'FISTS', damage: 24, rate: 0.45, melee: true },
  pistol: { id: 'pistol', name: 'TERN 9 PISTOL', damage: 34, rate: 0.26, spread: 0.008 },
  smg: { id: 'smg', name: 'SQUALL SMG', damage: 19, rate: 0.085, spread: 0.02, auto: true },
};
const ORDER = ['fists', 'pistol', 'smg'];

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.owned = new Set(['fists', 'pistol']);
    this.ammo = { fists: Infinity, pistol: 48, smg: 0 };
    this.current = WEAPONS.pistol;
    this.cooldown = 0;
    this.ray = new THREE.Vector3();
  }

  select(id) { if (this.owned.has(id)) { this.current = WEAPONS[id]; this.game.hud.updateWeapon(); } }

  cycle(step) {
    const list = ORDER.filter((id) => this.owned.has(id));
    const i = list.indexOf(this.current.id);
    this.select(list[(i + step + list.length) % list.length]);
  }

  give(id, ammo) {
    this.owned.add(id);
    this.ammo[id] = (this.ammo[id] || 0) + ammo;
    this.game.hud.updateWeapon();
  }

  update(dt) {
    const { input, player } = this.game;
    this.cooldown -= dt;
    if (input.wasPressed('Digit1')) this.select('fists');
    if (input.wasPressed('Digit2')) this.select('pistol');
    if (input.wasPressed('Digit3')) this.select('smg');
    if (input.wheel) this.cycle(input.wheel);
    if (player.vehicle || player.dead) return;
    const w = this.current;
    const trigger = w.auto ? input.buttons[0] : input.clicked[0];
    if (trigger && this.cooldown <= 0) this.fire();
  }

  fire() {
    const game = this.game, w = this.current, pl = game.player;
    this.cooldown = w.rate;
    if (w.melee) return this.punch();
    if (this.ammo[w.id] <= 0) { game.audio?.click(); this.select('fists'); return; }
    this.ammo[w.id]--;
    game.hud.updateWeapon();
    const cam = game.three.camera;
    const dir = this.ray.set(0, 0, -1).applyQuaternion(cam.quaternion);
    dir.x += (Math.random() - 0.5) * w.spread * 2; dir.y += (Math.random() - 0.5) * w.spread * 2; dir.z += (Math.random() - 0.5) * w.spread * 2;
    dir.normalize();
    const o = cam.position;
    const minT = Math.hypot(o.x - pl.x, o.z - pl.z) + 0.6;
    const hit = this.traceShot(o.x, o.y, o.z, dir.x, dir.y, dir.z, minT, 160);
    const mx = pl.x + Math.sin(pl.heading) * 0.55 - Math.cos(pl.heading) * 0.3;
    const mz = pl.z + Math.cos(pl.heading) * 0.55 + Math.sin(pl.heading) * 0.3;
    const end = { x: o.x + dir.x * hit.t, y: o.y + dir.y * hit.t, z: o.z + dir.z * hit.t };
    game.effects.tracer(mx, 1.38, mz, end.x, end.y, end.z, '#fff3b0');
    game.effects.muzzle(mx, 1.38, mz);
    game.audio?.gunshot(pl.x, pl.z, false, w.id);
    game.camera.shake(0.12);
    if (hit.kind === 'ped') game.peds.damage(hit.target, w.damage * 2, true);
    else if (hit.kind === 'hostile') game.hostiles.damage(hit.target, w.damage);
    else if (hit.kind === 'vehicle') { hit.target.damage(w.damage * 0.35, true); game.effects.sparks(end.x, end.y, end.z); }
    else if (hit.kind === 'world') game.effects.sparks(end.x, end.y, end.z);
    game.hud.hitMarker(hit.kind === 'ped' || hit.kind === 'hostile');
    // Gunfire scares people and draws heat when witnessed.
    const witnesses = game.peds.peds.some((p) => !p.dead && Math.hypot(p.x - pl.x, p.z - pl.z) < 45);
    game.peds.panic(pl.x, pl.z, 40);
    if (witnesses) game.wanted.reportCrime('gunfire', pl.x, pl.z);
  }

  // Nearest thing the shot meets: a building, a car, a pedestrian or an armed hostile.
  traceShot(ox, oy, oz, dx, dy, dz, minT, maxT) {
    const game = this.game;
    let best = { t: Math.min(maxT, game.collision.raycast(ox, oy, oz, dx, dy, dz, maxT)), kind: 'world', target: null };
    if (best.t >= maxT) best.kind = 'none';
    if (dy < -1e-3) { const tg = -oy / dy; if (tg > minT && tg < best.t) best = { t: tg, kind: 'world', target: null }; }
    const sphere = (cx, cy, cz, r) => {
      const lx = cx - ox, ly = cy - oy, lz = cz - oz;
      const t = lx * dx + ly * dy + lz * dz;
      if (t < minT) return Infinity;
      const d2 = lx * lx + ly * ly + lz * lz - t * t;
      return d2 < r * r ? t - Math.sqrt(r * r - d2) : Infinity;
    };
    const person = (x, z) => Math.min(sphere(x, 1.5, z, 0.45), sphere(x, 0.9, z, 0.45));
    for (const v of game.vehicles) {
      if (v.driver === 'player') continue;
      const t = Math.min(sphere(v.x, 0.9, v.z, 1.35), sphere(v.x + Math.sin(v.heading) * 1.3, 0.8, v.z + Math.cos(v.heading) * 1.3, 1.1),
        sphere(v.x - Math.sin(v.heading) * 1.3, 0.8, v.z - Math.cos(v.heading) * 1.3, 1.1));
      if (t < best.t) best = { t, kind: 'vehicle', target: v };
    }
    for (const p of game.peds.peds) if (!p.dead) { const t = person(p.x, p.z); if (t < best.t) best = { t, kind: 'ped', target: p }; }
    for (const u of game.hostiles.units) if (!u.dead) { const t = person(u.x, u.z); if (t < best.t) best = { t, kind: 'hostile', target: u }; }
    if (best.kind === 'none') best.t = maxT;
    return best;
  }

  punch() {
    const game = this.game, pl = game.player;
    pl.punchT = 0;
    game.audio?.whoosh();
    const fx = Math.sin(pl.heading), fz = Math.cos(pl.heading);
    const inReach = (x, z) => {
      const dx = x - pl.x, dz = z - pl.z, d = Math.hypot(dx, dz);
      return d < 2 && (dx * fx + dz * fz) / (d || 1) > 0.3;
    };
    for (const p of game.peds.peds) if (!p.dead && inReach(p.x, p.z)) { game.peds.damage(p, this.current.damage, true); game.audio?.thud(); return; }
    for (const u of game.hostiles.units) if (!u.dead && inReach(u.x, u.z)) { game.hostiles.damage(u, this.current.damage); game.audio?.thud(); return; }
  }
}
