// HEAT 4+ roadblocks: while the player drives, SBPD parks two cruisers nose to nose across the
// road ahead of them, lights flashing, with striped barriers and cones at the kerbs and a spike
// strip laid on the approach. Driving over the strip shreds the tyres (the car loses top speed and
// wobbles until Dex's Quick Fix). Once the player is past (or the heat drops), the cruisers rejoin
// the chase as ordinary pursuit units and the barriers are cleared.
import * as THREE from 'three';
import { Vehicle } from '../vehicles/CarPhysics.js';
import { roadCoord, roadIndexNear, onRoad, HALF, ROAD_HALF } from '../world/CityLayout.js';

const AHEAD = 85;
const STRIP_OFFSET = 11;   // metres in front of the cruisers, on the approach side

let kit = null;
function propKit() {
  if (kit) return kit;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f4f0' : '#e8343b'; g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + 8, 0); g.lineTo(i * 8 + 16, 16); g.lineTo(i * 8 + 8, 16); g.fill(); }
  const stripes = new THREE.CanvasTexture(c);
  stripes.colorSpace = THREE.SRGBColorSpace;
  kit = {
    board: new THREE.MeshLambertMaterial({ map: stripes }),
    leg: new THREE.MeshLambertMaterial({ color: '#3a3d44' }),
    cone: new THREE.MeshLambertMaterial({ color: '#ff7a1a' }),
    band: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    strip: new THREE.MeshLambertMaterial({ color: '#202226' }),
    spike: new THREE.MeshLambertMaterial({ color: '#c9ced6' }),
  };
  return kit;
}

// Barriers, cones and the spike strip as one group, built along local x = across the road.
function buildProps(stripOffset) {
  const k = propKit(), g = new THREE.Group();
  for (const s of [-1, 1]) {
    const horse = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.08), k.board);
    board.position.y = 0.95; board.castShadow = true;
    horse.add(board);
    for (const lx of [-1.1, 1.1]) for (const lz of [-0.25, 0.25]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), k.leg);
      leg.position.set(lx, 0.5, lz); leg.rotation.x = lz > 0 ? 0.25 : -0.25;
      horse.add(leg);
    }
    horse.position.set(s * 6.6, 0, 0.5);
    g.add(horse);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 10), k.cone);
      cone.position.set(s * (4.4 + i * 0.9), 0.35, stripOffset * 0.45 + i * 1.3);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 10), k.band);
      band.position.set(cone.position.x, 0.42, cone.position.z);
      g.add(cone, band);
    }
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(12, 0.06, 0.45), k.strip);
  strip.position.set(0, 0.04, stripOffset);
  g.add(strip);
  const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.16, 4), k.spike, 40);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) spikes.setMatrixAt(i, m.makeTranslation(-5.8 + (i >> 1) * 0.61, 0.13, stripOffset + (i % 2 ? 0.12 : -0.12)));
  g.add(spikes);
  return g;
}

export class Roadblocks {
  constructor(game) {
    this.game = game;
    this.blocks = [];   // { cars: [Vehicle, Vehicle], x, z, axis }
    this.cooldown = 6;
  }

  get cars() { return this.blocks.flatMap((b) => b.cars.filter((v) => !v.removed && v.driver === 'roadblock')); }

  // Two cruisers across the road through (x, z); axis 'z' means the road runs north-south, and
  // `approach` (+1/-1) is the side along that axis the player is coming from.
  place(x, z, axis, approach = 1) {
    const game = this.game, cars = [];
    const props = buildProps(STRIP_OFFSET);
    props.position.set(x, 0, z);
    props.rotation.y = axis === 'z' ? (approach > 0 ? 0 : Math.PI) : (approach > 0 ? Math.PI / 2 : -Math.PI / 2);
    game.scene.add(props);
    const strip = axis === 'z' ? { x, z: z + approach * STRIP_OFFSET } : { x: x + approach * STRIP_OFFSET, z };
    for (const s of [-1, 1]) {
      const across = axis === 'z' ? Math.PI / 2 : 0;
      const h = across + s * 0.32 + (s > 0 ? Math.PI : 0);
      const ox = axis === 'z' ? s * 3.1 : 0, oz = axis === 'z' ? 0 : s * 3.1;
      const v = new Vehicle(game, 'police', x + ox, z + oz, h);
      v.driver = 'roadblock';
      v.sirenOn = true;
      game.vehicles.push(v);
      cars.push(v);
    }
    const block = { cars, x, z, axis, props, strip };
    this.blocks.push(block);
    return block;
  }

  // Spike strip: any car crossing it at speed gets its tyres shredded.
  checkStrip(block) {
    const s = block.strip;
    for (const v of this.game.vehicles) {
      if (v.flat || v.wrecked || v.driver === 'roadblock' || v.driver === 'police') continue;
      const along = block.axis === 'z' ? Math.abs(v.z - s.z) : Math.abs(v.x - s.x);
      const across = block.axis === 'z' ? Math.abs(v.x - s.x) : Math.abs(v.z - s.z);
      if (along < 1.1 && across < 6.2 && Math.hypot(v.vx, v.vz) > 3) {
        v.flat = true;
        v.damage(6);
        if (v.driver === 'player') { this.game.hud.toast('Spike strip! Tyres shredded'); this.game.camera?.shake(0.6); this.game.audio?.crash(12); }
      }
    }
  }

  // Finds a spot on the player's road a block ahead of them.
  tryPlaceAhead() {
    const v = this.game.player.vehicle;
    if (!v || Math.hypot(v.vx, v.vz) < 8) return null;
    const alongZ = Math.abs(v.vz) > Math.abs(v.vx);
    const dir = Math.sign(alongZ ? v.vz : v.vx);
    if (alongZ) {
      const x = roadCoord(roadIndexNear(v.x));
      if (Math.abs(v.x - x) > ROAD_HALF) return null;
      const z = v.z + dir * AHEAD;
      if (Math.abs(z) > HALF - 10 || !onRoad(x, z)) return null;
      return this.place(x, z, 'z', -dir);
    }
    const z = roadCoord(roadIndexNear(v.z));
    if (Math.abs(v.z - z) > ROAD_HALF) return null;
    const x = v.x + dir * AHEAD;
    if (Math.abs(x) > HALF - 10 || !onRoad(x, z)) return null;
    return this.place(x, z, 'x', -dir);
  }

  // Cruisers leave the roadblock: they join the pursuit (or go home if the heat is gone).
  release(block) {
    const wanted = this.game.wanted;
    for (const v of block.cars) {
      if (v.removed || v.driver !== 'roadblock') continue;
      if (wanted.level > 0 && !v.wrecked) wanted.adopt(v);
      else { v.driver = null; v.sirenOn = false; this.game.traffic.cars.push(v); }
    }
    this.game.scene.remove(block.props);
    block.done = true;
  }

  update(dt) {
    const game = this.game, p = game.player.position, level = game.wanted.level;
    this.cooldown -= dt;
    for (const b of this.blocks) {
      for (const v of b.cars) if (v.driver === 'roadblock') v.drive(dt, { throttle: 0, brake: 1, steer: 0, handbrake: true });
      this.checkStrip(b);
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      const v = game.player.vehicle;
      const behind = v && ((b.x - p.x) * v.vx + (b.z - p.z) * v.vz) < 0 && d > 18;
      if (level < 4 || d > 200 || behind || b.cars.every((c) => c.wrecked || c.driver !== 'roadblock')) this.release(b);
    }
    this.blocks = this.blocks.filter((b) => !b.done);
    if (level >= 4 && this.cooldown <= 0 && !this.blocks.length && !game.player.dead) {
      this.cooldown = this.tryPlaceAhead() ? 22 : 2;
    }
  }

  clear() {
    for (const b of this.blocks) {
      for (const v of b.cars) if (v.driver === 'roadblock') { v.driver = null; v.sirenOn = false; this.game.traffic.cars.push(v); }
      this.game.scene.remove(b.props);
    }
    this.blocks = [];
  }
}
