// The Sunbreak Sprint: a repeatable checkpoint race through the east side, started from the
// beach road in any car. Beat the clock for prize money; the best time is kept in the save.
import * as THREE from 'three';
import { roadCoord } from '../world/CityLayout.js';
import { RP_FOR } from '../progression/RankSystem.js';

const ROUTE = [[8, 1], [8, 3], [8, 6], [6, 6], [6, 8], [3, 8], [3, 5], [5, 5], [5, 2], [8, 2]]
  .map(([i, j]) => ({ x: roadCoord(i), z: roadCoord(j) }));
const START = { x: roadCoord(8) + 4, z: roadCoord(0) + 30 };
const TIME_LIMIT = 85;
const PRIZE = 1500;

export class StreetRace {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.index = 0;
    this.time = 0;
    this.best = null;
    const ringMat = new THREE.MeshBasicMaterial({ color: '#19d3c5', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 5, 32, 1, true), ringMat);
    this.ring.position.y = 2.5;
    this.ring.visible = false;
    this.flag = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 8, 24), new THREE.MeshBasicMaterial({ color: '#ff6b5a' }));
    this.flag.position.set(START.x, 0.3, START.z);
    this.flag.rotation.x = Math.PI / 2;
    game.scene.add(this.ring, this.flag);
  }

  get start() { return START; }

  begin() {
    this.active = true;
    this.index = 0;
    this.time = 0;
    this.game.hud.banner('SUNBREAK SPRINT', `Hit ${ROUTE.length} checkpoints in ${TIME_LIMIT}s`, false, 2.5);
    this.game.audio?.missionStart();
  }

  finish(won) {
    const game = this.game;
    this.active = false;
    this.ring.visible = false;
    game.hud.setObjective('', '');
    game.hud.setTimer(null);
    if (won) {
      const t = this.time.toFixed(1);
      const record = this.best === null || this.time < this.best;
      if (record) this.best = this.time;
      game.addMoney(PRIZE, true);
      game.rank?.award(RP_FOR.raceWin + (record ? RP_FOR.raceBest : 0), record ? 'Race won · new best' : 'Race won');
      game.hud.banner('SPRINT WON', `${t}s${record ? ' · new best' : ''} · +$${PRIZE}`);
      game.audio?.missionPass();
    } else {
      game.hud.banner('SPRINT LOST', 'Out of time', true);
      game.audio?.missionFail();
    }
  }

  update(dt, t) {
    const game = this.game, pl = game.player, p = pl.position;
    this.flag.visible = !this.active && !game.missions.active;
    if (!this.active) {
      if (this.flag.visible && pl.vehicle && Math.hypot(p.x - START.x, p.z - START.z) < 9) {
        game.hud.prompt(`<b>E</b> Race the Sunbreak Sprint ($${PRIZE} prize${this.best ? `, best ${this.best.toFixed(1)}s` : ''})`);
        if (game.input.wasPressed('KeyE')) this.begin();
      }
      return;
    }
    if (!pl.vehicle || pl.dead || game.missions.active) return this.finish(false);
    this.time += dt;
    const cp = ROUTE[this.index];
    this.ring.visible = true;
    this.ring.position.set(cp.x, 2.5, cp.z);
    this.ring.material.opacity = 0.35 + Math.sin(t * 6) * 0.1;
    game.hud.setObjective('Sunbreak Sprint', `Checkpoint ${this.index + 1} of ${ROUTE.length}`);
    game.hud.setTimer(TIME_LIMIT - this.time);
    if (Math.hypot(p.x - cp.x, p.z - cp.z) < 9) {
      this.index++;
      game.audio?.pickup();
      if (this.index >= ROUTE.length) return this.finish(true);
    }
    if (this.time > TIME_LIMIT) this.finish(false);
  }

  blips() {
    if (this.active) {
      const cp = ROUTE[this.index];
      return [{ x: cp.x, z: cp.z, color: '#19d3c5', size: 7, kind: 'objective' }];
    }
    return this.flag.visible ? [{ x: START.x, z: START.z, color: '#ff6b5a', size: 5, label: 'R' }] : [];
  }
}
