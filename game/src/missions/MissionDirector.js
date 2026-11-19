// Runs the story: start markers for the next job, step-by-step objectives (steal, deliver, chase,
// eliminate, hold, escape), timers, failure, rewards and unlocks, plus 3D markers and map blips.
import * as THREE from 'three';
import { MISSIONS, CAST } from '../story/StoryScript.js';
import { LOCATIONS } from '../world/CityLayout.js';
import { Vehicle } from '../vehicles/CarPhysics.js';

const OBJECTIVE_TYPES = new Set(['enterCar', 'deliver', 'goto', 'destroy', 'eliminate', 'hold', 'loseWanted']);

function makeMarker(color) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.6, 32, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }));
  ring.position.y = 0.8;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 4), new THREE.MeshBasicMaterial({ color }));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 4;
  g.add(ring, arrow);
  g.userData = { ring, arrow };
  g.visible = false;
  return g;
}

export class MissionDirector {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.active = null;
    this.stepIdx = 0;
    this.timer = null;
    this.hold = 0;
    this.cars = {};
    this.marker = makeMarker('#ffd166');
    this.startMarker = makeMarker('#19d3c5');
    game.scene.add(this.marker, this.startMarker);
    this.objective = '';
    this.target = null;
    this.cooldown = 0;
  }

  get next() { return MISSIONS[this.index] || null; }
  get step() { return this.active ? this.active.steps[this.stepIdx] : null; }
  get total() { return MISSIONS.length; }

  // The player-facing stages of the active job (objectives, not scripted beats): number, title,
  // which stage is current, progress within it (hold timers), and the text of the next stage.
  stageInfo() {
    const m = this.active;
    if (!m) return null;
    const stages = m.steps.map((s, i) => ({ s, i })).filter(({ s }) => OBJECTIVE_TYPES.has(s.type));
    let cur = stages.findIndex(({ i }) => i >= this.stepIdx);
    if (cur < 0) cur = stages.length - 1;
    const s = this.step;
    const within = s?.type === 'hold' ? Math.min(1, this.hold / s.seconds) : 0;
    const nextStage = stages[cur + 1];
    return { num: MISSIONS.indexOf(m) + 1, title: m.title.toUpperCase(), stage: cur + 1, stages: stages.length, within, next: nextStage?.s.text || null };
  }

  loc(name) { return LOCATIONS[name]; }

  start(m) {
    const game = this.game;
    this.active = m;
    this.stepIdx = 0;
    this.timer = null;
    this.cars = {};
    game.hud.missionStart(m.title);
    game.hud.say(m.intro.map(([who, text]) => ({ who: CAST[who], text })));
    game.audio?.missionStart();
    this.enterStep();
  }

  enterStep() {
    const s = this.step, game = this.game;
    if (!s) return this.pass();
    this.hold = 0;
    this.target = null;
    if (s.timeLimit) this.timer = s.timeLimit;
    switch (s.type) {
      case 'spawnCar': {
        const p = this.loc(s.at);
        const v = new Vehicle(game, s.car, p.x, p.z, s.heading || 0);
        v.mission = true;
        game.vehicles.push(v);
        game.traffic.cars.push(v);
        this.cars[s.id] = v;
        return this.advance();
      }
      case 'spawnChase': {
        // Starts in Palmetto Yards heading north up Halcyon Ave.
        const v = game.traffic.spawnCar(4, 7, { x: 0, z: -1 }, 30, s.car);
        v.ai.cruise = 19; v.ai.reckless = true;
        v.mission = true;
        v.health = 140;
        this.cars[s.id] = v;
        return this.advance();
      }
      case 'say':
        game.hud.say(s.lines.map(([who, text]) => ({ who: CAST[who], text })));
        return this.advance();
      case 'wanted':
        if (game.wanted.level < s.level) game.wanted.setLevel(s.level);
        return this.advance();
      case 'spawnGang': {
        const p = this.loc(s.at);
        for (let i = 0; i < s.count; i++) {
          const a = (i / s.count) * Math.PI * 2;
          game.hostiles.spawn('gang', p.x + Math.cos(a) * 9, p.z + Math.sin(a) * 12, { tag: s.tag });
        }
        return this.advance();
      }
      case 'spawnGuards': {
        const p = this.loc(s.at);
        for (let i = 0; i < s.count; i++) game.hostiles.spawn('police', p.x - 8 + i * 8, p.z + 14, { aggro: true, tag: 'guards' });
        return this.advance();
      }
      default:
        this.objective = s.text || '';
        game.hud.setObjective(this.active.title, this.objective);
    }
  }

  advance() {
    this.stepIdx++;
    this.timer = this.step?.timeLimit ? this.timer : (this.step?.type === 'say' || this.step?.type === 'wanted' ? this.timer : null);
    this.enterStep();
  }

  fail(reason) {
    if (!this.active) return;
    const game = this.game;
    game.hud.banner('MISSION FAILED', reason, true);
    game.audio?.missionFail();
    for (const v of Object.values(this.cars)) v.mission = false;
    game.hostiles.clear('gang');
    this.active = null;
    this.timer = null;
    this.cooldown = 4;
    game.hud.setObjective('', '');
  }

  pass() {
    const game = this.game, m = this.active;
    game.addMoney(m.reward, true);
    const rp = 300 + Math.round(m.reward / 8);
    game.rank?.award(rp, m.title);
    game.hud.banner('MISSION PASSED', `+$${m.reward.toLocaleString()}  ·  +${rp} RP  ·  ${m.unlock}`);
    game.hud.say(m.outro.map(([who, text]) => ({ who: CAST[who], text })));
    game.audio?.missionPass();
    if (m.give?.weapon) { game.weapons.give(m.give.weapon, m.give.ammo); game.weapons.select(m.give.weapon); }
    if (m.give?.armor) game.player.armor = m.give.armor;
    for (const v of Object.values(this.cars)) v.mission = false;
    this.active = null;
    this.timer = null;
    this.index++;
    this.cooldown = 5;
    game.stats.missions = this.index;
    game.hud.setObjective('', '');
    game.onMissionPassed?.(m);
  }

  update(dt, t) {
    const game = this.game, pl = game.player, pp = pl.position;
    this.cooldown -= dt;
    // Start marker for the next job.
    const next = this.next;
    this.startMarker.visible = !this.active && !!next && this.cooldown <= 0;
    if (this.startMarker.visible) {
      const p = this.loc(next.start);
      this.placeMarker(this.startMarker, p, 1.6, t);
      if (Math.hypot(pp.x - p.x, pp.z - p.z) < 2.6 && game.wanted.level === 0 && !pl.dead) this.start(next);
      else if (Math.hypot(pp.x - p.x, pp.z - p.z) < 6 && game.wanted.level > 0) game.hud.prompt('Lose the heat before starting a job');
    }
    this.marker.visible = false;
    if (!this.active) return;
    if (this.timer !== null) {
      this.timer -= dt;
      game.hud.setTimer(this.timer);
      if (this.timer <= 0) return this.fail('Out of time');
    } else game.hud.setTimer(null);
    const s = this.step;
    if (!s) return;
    const near = (p, r) => Math.hypot(pp.x - p.x, pp.z - p.z) < r;
    switch (s.type) {
      case 'enterCar': {
        const v = this.cars[s.id];
        if (v.wrecked) return this.fail('The car was destroyed');
        this.target = { x: v.x, z: v.z };
        this.placeMarker(this.marker, this.target, 2.5, t, 2.2);
        if (pl.vehicle === v) this.advance();
        break;
      }
      case 'deliver': {
        const v = this.cars[s.id], p = this.loc(s.to);
        if (v.wrecked) return this.fail('The car was destroyed');
        if (pl.vehicle !== v) {
          this.target = { x: v.x, z: v.z };
          game.hud.setObjective(this.active.title, 'Get back in the car');
          this.placeMarker(this.marker, this.target, 2.5, t, 2.2);
        } else {
          game.hud.setObjective(this.active.title, s.text);
          this.target = p;
          this.placeMarker(this.marker, p, 5, t);
          if (near(p, 6) && Math.abs(v.speed) < 5) { pl.exitVehicle(true); v.mission = false; this.advance(); }
        }
        break;
      }
      case 'goto': {
        const p = this.loc(s.to);
        this.target = p;
        this.placeMarker(this.marker, p, s.radius > 10 ? 10 : (s.radius || 4), t);
        const ok = (!s.inVehicle || pl.vehicle) && (!s.onFoot || !pl.vehicle);
        if (near(p, s.radius || 4)) {
          if (ok) this.advance();
          else game.hud.prompt(s.inVehicle ? 'You need a getaway car' : 'Get out of the car and walk in');
        }
        break;
      }
      case 'destroy': {
        const v = this.cars[s.id];
        this.target = { x: v.x, z: v.z };
        this.placeMarker(this.marker, this.target, 2.5, t, 2.2);
        if (v.wrecked) this.advance();
        break;
      }
      case 'eliminate': {
        const left = game.hostiles.alive(s.tag);
        game.hud.setObjective(this.active.title, `${s.text} (${left.length} left)`);
        if (left.length) this.target = { x: left[0].x, z: left[0].z };
        if (!left.length) this.advance();
        break;
      }
      case 'hold': {
        const p = this.loc(s.to);
        this.target = p;
        this.placeMarker(this.marker, p, s.radius, t);
        if (near(p, s.radius) && !pl.vehicle) this.hold += dt;
        else this.hold = Math.max(0, this.hold - dt * 0.5);
        game.hud.setHold(this.hold / s.seconds);
        if (this.hold >= s.seconds) { game.hud.setHold(null); this.advance(); }
        break;
      }
      case 'loseWanted':
        this.target = null;
        if (game.wanted.level === 0) this.advance();
        break;
      default:
        this.advance();
    }
  }

  placeMarker(m, p, radius, t, height = 1) {
    m.visible = true;
    m.position.set(p.x, 0.1, p.z);
    m.userData.ring.scale.set(radius, height, radius);
    m.userData.arrow.position.y = 3.6 + height + Math.sin(t * 3) * 0.4;
    m.userData.arrow.rotation.y = t * 2;
  }

  blips() {
    const out = [];
    if (this.active && this.target) out.push({ x: this.target.x, z: this.target.z, color: '#ffd166', size: 7, kind: 'objective' });
    if (!this.active && this.next) {
      const p = this.loc(this.next.start);
      out.push({ x: p.x, z: p.z, color: CAST[this.next.giver].color, size: 8, label: CAST[this.next.giver].initials[0], kind: 'contact' });
    }
    return out;
  }
}
