// Things to pick up: dropped cash, ammo, health and armour, and the twelve hidden Salt Stashes
// (a collectible hunt that pays out across the city).
import * as THREE from 'three';

import { roadCoord } from './CityLayout.js';

// Each stash sits on a sidewalk (10 m in from a road centre line) or on the beach.
const walk = (i, j, dx = 10, dz = 40) => [roadCoord(i) + dx, roadCoord(j) + dz];
export const STASH_SPOTS = [
  walk(0, 0), walk(2, 1, 40, 10), walk(4, 0), walk(6, 2, 70, 30), walk(7, 4, 70, 50), [390, -120], [380, 250],
  walk(0, 5), walk(2, 7, 30, 70), walk(4, 6, 10, 20), walk(6, 7, 50, 10), walk(3, 2, 40, 70),
];

const geo = {
  cash: new THREE.BoxGeometry(0.5, 0.25, 0.3),
  ammo: new THREE.BoxGeometry(0.45, 0.35, 0.35),
  health: new THREE.BoxGeometry(0.55, 0.55, 0.55),
  armor: new THREE.BoxGeometry(0.6, 0.6, 0.25),
  stash: new THREE.OctahedronGeometry(0.6),
};
const mats = {
  cash: new THREE.MeshBasicMaterial({ color: '#4cff8f' }),
  ammo: new THREE.MeshBasicMaterial({ color: '#ffd166' }),
  health: new THREE.MeshBasicMaterial({ color: '#ff4d6d' }),
  armor: new THREE.MeshBasicMaterial({ color: '#6ab7ff' }),
  stash: new THREE.MeshBasicMaterial({ color: '#19d3c5' }),
};

export class Pickups {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.stashFound = new Set();
  }

  add(kind, x, z, amount = 0, extra = {}) {
    const m = new THREE.Mesh(geo[kind], mats[kind]);
    m.position.set(x, 0.7, z);
    this.game.scene.add(m);
    const item = { kind, x, z, amount, mesh: m, life: kind === 'stash' || extra.permanent ? Infinity : 40, ...extra };
    this.items.push(item);
    return item;
  }

  dropCash(x, z, amount) { this.add('cash', x + (Math.random() - 0.5), z + (Math.random() - 0.5), amount); }
  dropAmmo(x, z) { this.add('ammo', x, z, 12); }

  placeStashes() {
    STASH_SPOTS.forEach(([x, z], i) => { if (!this.stashFound.has(i)) this.add('stash', x, z, 500, { index: i }); });
    this.add('health', -235, 66, 0, { permanent: true, respawn: 30 });
    this.add('health', 150, -150, 0, { permanent: true, respawn: 30 });
    this.add('armor', 236, -94, 0, { permanent: true, respawn: 60 });
  }

  update(dt, t) {
    const game = this.game, pl = game.player, pp = pl.position;
    for (const it of this.items) {
      it.mesh.rotation.y = t * 2;
      it.mesh.position.y = 0.8 + Math.sin(t * 3 + it.x) * 0.15;
      if (it.cooldown > 0) { it.cooldown -= dt; it.mesh.visible = it.cooldown <= 0; continue; }
      it.life -= dt;
      const reach = pl.vehicle ? 3 : 1.4;
      if (Math.hypot(pp.x - it.x, pp.z - it.z) < reach) this.collect(it);
      if (it.life <= 0) it.gone = true;
    }
    for (const it of this.items) if (it.gone) game.scene.remove(it.mesh);
    this.items = this.items.filter((it) => !it.gone);
  }

  collect(it) {
    const game = this.game, pl = game.player;
    if (it.kind === 'cash') { game.addMoney(it.amount); }
    else if (it.kind === 'ammo') { game.weapons.ammo.pistol += it.amount; if (game.weapons.owned.has('smg')) game.weapons.ammo.smg += it.amount * 2; game.hud.updateWeapon(); game.hud.toast('+ Ammo'); }
    else if (it.kind === 'health') { if (pl.health >= 100) return; pl.health = 100; game.hud.toast('Health restored'); }
    else if (it.kind === 'armor') { if (pl.armor >= 100) return; pl.armor = 100; game.hud.toast('Body armour'); }
    else if (it.kind === 'stash') {
      this.stashFound.add(it.index);
      game.addMoney(it.amount);
      game.hud.toast(`Salt Stash ${this.stashFound.size}/${STASH_SPOTS.length} found`);
    }
    game.audio?.pickup();
    if (it.respawn) { it.cooldown = it.respawn; it.mesh.visible = false; }
    else it.gone = true;
  }
}
