// Five weapon slots: fists, the Tern 9 pistol, the Squall SMG, the Brine 12 shotgun (unlocked at
// rank 3) and the Keel AR rifle (rank 6). Hitscan shots along the camera's aim, shotgun pellets,
// melee, ammo, switching with 1-5 or the wheel, and the crimes that gunfire reports.
import * as THREE from 'three';

export const WEAPONS = {
  fists: { id: 'fists', slot: 1, name: 'FISTS', short: 'FISTS', damage: 24, rate: 0.45, melee: true },
  pistol: { id: 'pistol', slot: 2, name: 'TERN 9 PISTOL', short: 'TERN 9', damage: 34, rate: 0.26, spread: 0.008 },
  smg: { id: 'smg', slot: 3, name: 'SQUALL SMG', short: 'SQUALL', damage: 19, rate: 0.085, spread: 0.02, auto: true },
  shotgun: { id: 'shotgun', slot: 4, name: 'BRINE 12 SHOTGUN', short: 'BRINE 12', damage: 15, rate: 0.8, spread: 0.055, pellets: 7, unlockRank: 3, startAmmo: 24 },
  rifle: { id: 'rifle', slot: 5, name: 'KEEL AR RIFLE', short: 'KEEL AR', damage: 31, rate: 0.12, spread: 0.009, auto: true, unlockRank: 6, startAmmo: 120 },
};
export const ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.owned = new Set(['fists', 'pistol']);
    this.ammo = { fists: Infinity, pistol: 48, smg: 0, shotgun: 0, rifle: 0 };
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

  // Rank-gated weapons become owned (with a starter clip) once the rank is reached.
  unlockForRank(rank) {
    const out = [];
    for (const w of Object.values(WEAPONS)) {
      if (w.unlockRank && rank >= w.unlockRank && !this.owned.has(w.id)) { this.give(w.id, w.startAmmo); out.push(w); }
    }
    return out;
  }

  update(dt) {
    const { input, player } = this.game;
    this.cooldown -= dt;
    ORDER.forEach((id, i) => { if (input.wasPressed(`Digit${i + 1}`)) this.select(id); });
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
    const o = cam.position;
    const minT = Math.hypot(o.x - pl.x, o.z - pl.z) + 0.6;
    const mx = pl.x + Math.sin(pl.heading) * 0.55 - Math.cos(pl.heading) * 0.3;
    const mz = pl.z + Math.cos(pl.heading) * 0.55 + Math.sin(pl.heading) * 0.3;
    let anyHit = false;
    for (let n = 0; n < (w.pellets || 1); n++) {
      const dir = this.ray.set(0, 0, -1).applyQuaternion(cam.quaternion);
      dir.x += (Math.random() - 0.5) * w.spread * 2; dir.y += (Math.random() - 0.5) * w.spread * 2; dir.z += (Math.random() - 0.5) * w.spread * 2;
      dir.normalize();
      const hit = this.traceShot(o.x, o.y, o.z, dir.x, dir.y, dir.z, minT, w.pellets ? 60 : 160);
      const end = { x: o.x + dir.x * hit.t, y: o.y + dir.y * hit.t, z: o.z + dir.z * hit.t };
      game.effects.tracer(mx, 1.38, mz, end.x, end.y, end.z, '#fff3b0');
      if (hit.kind === 'ped') game.peds.damage(hit.target, w.damage * 2, true);
      else if (hit.kind === 'hostile') game.hostiles.damage(hit.target, w.damage);
      else if (hit.kind === 'vehicle') { hit.target.damage(w.damage * 0.35, true); game.effects.sparks(end.x, end.y, end.z); }
      else if (hit.kind === 'world') game.effects.sparks(end.x, end.y, end.z);
      anyHit ||= hit.kind === 'ped' || hit.kind === 'hostile';
    }
    game.effects.muzzle(mx, 1.38, mz);
    game.audio?.gunshot(pl.x, pl.z, false, w.id);
    game.camera.shake(w.pellets ? 0.3 : 0.12);
    game.hud.hitMarker(anyHit);
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
