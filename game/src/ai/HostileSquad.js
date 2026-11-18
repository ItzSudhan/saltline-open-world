// Armed people on foot (police officers and Coral Kings gang members): close in, take cover-less
// potshots at the player, and go down when shot.
import { CharacterModel } from '../characters/CharacterModel.js';
import { wrapAngle } from '../core/Random.js';

const LOOKS = {
  police: () => ({ skin: '#c98f6a', shirt: '#1d3f8a', pants: '#14213d', hair: '#1b1b1b', cap: '#14213d', vest: '#24324f' }),
  gang: (rand) => ({ skin: rand.pick(['#a86b48', '#e8b896', '#7a4a2f']), shirt: rand.pick(['#ff9f1c', '#f4d35e']), pants: '#2b2d42', hair: '#111', cap: '#ff9f1c' }),
};

export class HostileSquad {
  constructor(game) {
    this.game = game;
    this.units = [];
  }

  spawn(team, x, z, opts = {}) {
    const look = LOOKS[team](this.game.rand);
    const model = new CharacterModel(look);
    model.gun.visible = true;
    this.game.scene.add(model.root);
    const u = {
      team, model, x, z, heading: 0, health: opts.health || (team === 'police' ? 80 : 70),
      dead: false, deadT: 0, shootT: 1 + Math.random(), range: opts.range || 16,
      accuracy: team === 'police' ? 0.36 : 0.3, damage: team === 'police' ? 7 : 6, tag: opts.tag || null, speed: 0,
      guardX: x, guardZ: z, aggro: !!opts.aggro,
    };
    this.units.push(u);
    return u;
  }

  alive(tag) { return this.units.filter((u) => !u.dead && (!tag || u.tag === tag)); }

  damage(u, amount) {
    if (u.dead) return;
    u.health -= amount;
    u.aggro = true;
    this.game.effects.blood(u.x, 1.2, u.z);
    if (u.health <= 0) {
      u.dead = true;
      u.model.setDead(true);
      if (u.team === 'police') { this.game.wanted.reportCrime('copkill', u.x, u.z); this.game.stats.cops++; }
      this.game.pickups.dropCash(u.x, u.z, 40 + Math.floor(Math.random() * 60));
      this.game.pickups.dropAmmo(u.x + 0.8, u.z);
    }
  }

  clear(team) {
    for (const u of this.units) if (!team || u.team === team) { this.game.scene.remove(u.model.root); u.removed = true; }
    this.units = this.units.filter((u) => !u.removed);
  }

  update(dt) {
    const game = this.game, pl = game.player, pp = pl.position;
    for (const u of this.units) {
      const d = Math.hypot(pp.x - u.x, pp.z - u.z);
      if ((u.dead && u.deadT > 20) || d > 220) { game.scene.remove(u.model.root); u.removed = true; continue; }
      if (u.dead) { u.deadT += dt; continue; }
      if (u.team === 'police' && game.wanted.level === 0) {
        // Stand down: walk off and fade away.
        u.deadT += dt;
        if (u.deadT > 6) { game.scene.remove(u.model.root); u.removed = true; }
        u.model.animate(dt, 0, false, true);
        continue;
      }
      if (!u.aggro && d < 30) u.aggro = true;
      if (!u.aggro) { u.model.animate(dt, 0, false, true); continue; }
      const sees = d < 60 && game.collision.lineOfSight(u.x, u.z, pp.x, pp.z);
      const want = Math.atan2(pp.x - u.x, pp.z - u.z);
      u.heading += wrapAngle(want - u.heading) * Math.min(1, dt * 6);
      let moving = 0;
      if (!sees || d > u.range) {
        const sp = 4.2;
        u.x += Math.sin(want) * sp * dt; u.z += Math.cos(want) * sp * dt;
        moving = sp;
      }
      const p = { x: u.x, z: u.z };
      game.collision.resolveCircle(p, 0.4);
      u.x = p.x; u.z = p.z;
      u.shootT -= dt;
      if (sees && d < u.range + 12 && u.shootT <= 0 && !pl.dead) {
        u.shootT = 0.9 + Math.random() * 0.9;
        const moveFactor = Math.min(1, pl.speed / 8);
        const chance = u.accuracy * (1 - Math.min(0.7, d / 60)) * (1 - moveFactor * 0.5);
        const hit = Math.random() < chance;
        const tx = pp.x + (hit ? 0 : (Math.random() - 0.5) * 3), tz = pp.z + (hit ? 0 : (Math.random() - 0.5) * 3);
        const gx = u.x + Math.sin(u.heading) * 0.6, gz = u.z + Math.cos(u.heading) * 0.6;
        game.effects.tracer(gx, 1.35, gz, tx, 1.2, tz, u.team === 'police' ? '#9fd0ff' : '#ffd27a');
        game.effects.muzzle(gx, 1.35, gz);
        game.audio?.gunshot(u.x, u.z, true);
        if (hit) {
          if (pl.vehicle) pl.vehicle.damage(u.damage * 0.6);
          pl.takeDamage(u.damage, u.x, u.z);
        }
        game.peds.panic(u.x, u.z, 25);
      }
      u.model.root.position.set(u.x, 0.14, u.z);
      u.model.root.rotation.y = u.heading;
      u.model.animate(dt, moving, sees && d < u.range + 12, true);
    }
    this.units = this.units.filter((u) => !u.removed);
  }
}
