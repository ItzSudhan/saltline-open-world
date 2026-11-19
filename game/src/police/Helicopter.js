// SBPD air unit: joins the pursuit at HEAT 3+, flies a loose orbit over the player and keeps a
// searchlight on them while they are within reach. A lit player counts as "seen", so the air unit
// stops the heat cooling off; outrunning it (it tops out slower than a sports car) breaks contact.
import * as THREE from 'three';

const ALT = 30;
const MAX_SPEED = 31;
const REACH = 48;   // horizontal distance at which the searchlight can hold the player

export class Helicopter {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.leaving = false;
    this.x = 0; this.z = 0; this.y = ALT;
    this.vx = 0; this.vz = 0;
    this.heading = 0;
    this.tracking = false;
    this.t = 0;
    this.callsign = 'HAWK-1';
    this.build();
  }

  build() {
    const g = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: '#eef2f6' });
    const navy = new THREE.MeshLambertMaterial({ color: '#16264a' });
    const dark = new THREE.MeshLambertMaterial({ color: '#22252b' });
    const glass = new THREE.MeshPhongMaterial({ color: '#1b2633', shininess: 120, specular: 0x99bbdd });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10), white);
    body.scale.set(1, 0.85, 1.7);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 3.6), navy);
    belly.position.y = -0.75;
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    canopy.scale.set(1.1, 0.9, 1.2); canopy.position.set(0, 0.1, 1.2); canopy.rotation.x = 0.5;
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 5.2, 8), white);
    boom.rotation.x = Math.PI / 2; boom.position.set(0, 0.35, -4.2);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.9), navy);
    fin.position.set(0, 1.0, -6.6);
    g.add(body, belly, canopy, boom, fin);
    for (const s of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4), dark);
      skid.position.set(s * 1.1, -1.55, 0.2);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), dark);
      strut.position.set(s * 1.1, -1.25, 0.2);
      g.add(skid, strut);
    }
    // Main rotor: two crossed blades on a hub; tail rotor on the fin.
    this.rotor = new THREE.Group();
    this.rotor.position.y = 1.55;
    for (const r of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.35), dark);
      blade.rotation.y = r;
      this.rotor.add(blade);
    }
    this.rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8), dark));
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.22), dark);
    this.tailRotor.position.set(0.25, 1.0, -6.6);
    g.add(this.rotor, this.tailRotor);
    // Flashing belly beacons.
    this.beaconRed = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2040' }));
    this.beaconBlue = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#2f6bff' }));
    this.beaconRed.position.set(-0.9, -1.0, 1.4); this.beaconBlue.position.set(0.9, -1.0, 1.4);
    g.add(this.beaconRed, this.beaconBlue);
    this.mesh = g;
    g.visible = false;
    this.game.scene.add(g);

    // Searchlight: a soft additive cone plus a bright pool on the ground and a real spotlight.
    const coneGeo = new THREE.CylinderGeometry(0.4, 6, 1, 24, 1, true);
    coneGeo.translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
      color: '#fff3c4', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(6.2, 32), new THREE.MeshBasicMaterial({
      color: '#fff6d6', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.pool.rotation.x = -Math.PI / 2;
    this.light = new THREE.SpotLight('#fff1c8', 0, 90, 0.2, 0.5, 1.2);
    this.light.castShadow = false;
    this.game.scene.add(this.cone, this.pool, this.light, this.light.target);
    this.cone.visible = this.pool.visible = false;
  }

  // Arrives from the edge of town toward (x, z).
  launch(x, z) {
    const a = this.game.rand.next() * Math.PI * 2;
    this.x = x + Math.cos(a) * 140; this.z = z + Math.sin(a) * 140;
    this.vx = this.vz = 0;
    this.active = true; this.leaving = false;
    this.mesh.visible = true;
  }

  // Places it directly over a point (for staged scenes and spawning on top of a chase).
  placeOver(x, z, ox = 0, oz = 0) {
    if (!this.active) this.launch(x, z);
    this.x = x + ox; this.z = z + oz;
  }

  dismiss() { if (this.active) this.leaving = true; }

  get distance() {
    const p = this.game.player.position;
    return Math.hypot(this.x - p.x, this.z - p.z);
  }

  update(dt) {
    const game = this.game;
    const level = game.wanted.level;
    if (!this.active) { if (level >= 3 && !game.player.dead) this.launch(game.player.x, game.player.z); else return; }
    if (level < 3 && !this.leaving) this.leaving = true;
    if (level >= 3) this.leaving = false;
    this.t += dt;
    const p = game.player.position, v = game.player.vehicle;
    // Target: a slow orbit over the player, led by their velocity; away from town when leaving.
    let tx, tz;
    if (this.leaving) { tx = this.x + (this.x - p.x) * 2 + 1; tz = this.z + (this.z - p.z) * 2 + 1; }
    else {
      const lead = v ? 1.2 : 0;
      tx = p.x + (v ? v.vx * lead : 0) + Math.cos(this.t * 0.35) * 16;
      tz = p.z + (v ? v.vz * lead : 0) + Math.sin(this.t * 0.35) * 16;
    }
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1;
    const want = Math.min(MAX_SPEED, d * 0.9);
    const ax = (dx / d) * want - this.vx, az = (dz / d) * want - this.vz;
    const k = Math.min(1, dt * 1.6);
    this.vx += ax * k; this.vz += az * k;
    this.x += this.vx * dt; this.z += this.vz * dt;
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 1) this.heading += wrap(Math.atan2(this.vx, this.vz) - this.heading) * Math.min(1, dt * 2);
    this.y = ALT + Math.sin(this.t * 1.3) * 0.6;
    const m = this.mesh;
    m.position.set(this.x, this.y, this.z);
    m.rotation.set(Math.min(0.25, sp * 0.008), this.heading, -Math.sin(this.t * 0.35) * 0.08, 'YXZ');
    this.rotor.rotation.y += dt * 38;
    this.tailRotor.rotation.x += dt * 45;
    const on = Math.floor(this.t * 3) % 2 === 0;
    this.beaconRed.visible = on; this.beaconBlue.visible = !on;
    if (this.leaving && this.distance > 220) { this.active = false; m.visible = false; }
    this.aimLight(p);
  }

  aimLight(p) {
    const hd = this.distance;
    this.tracking = this.active && !this.leaving && hd < REACH && !this.game.player.dead;
    const show = this.active && !this.leaving;
    this.cone.visible = this.pool.visible = show;
    this.light.intensity = show ? (this.tracking ? 110 : 50) : 0;
    if (!show) return;
    // The beam sweeps when it has lost the player, and locks on when in reach.
    const gx = this.tracking ? p.x : this.x + Math.cos(this.t * 1.7) * 12;
    const gz = this.tracking ? p.z : this.z + Math.sin(this.t * 1.7) * 12;
    const sx = this.x, sy = this.y - 1.2, sz = this.z + 0;
    const len = Math.hypot(gx - sx, sy, gz - sz);
    this.cone.position.set(sx, sy, sz);
    this.cone.scale.set(1, len, 1);
    this.cone.lookAt(gx, 0, gz);
    this.cone.rotateX(-Math.PI / 2);
    this.cone.material.opacity = this.tracking ? 0.2 : 0.1;
    this.pool.position.set(gx, 0.2, gz);
    this.pool.material.opacity = this.tracking ? 0.36 : 0.18;
    this.light.position.set(sx, sy, sz);
    this.light.target.position.set(gx, 0, gz);
  }
}

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
