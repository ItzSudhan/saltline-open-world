// Low-poly people (the player, pedestrians, officers, gang members) with a walk/run/aim cycle.
import * as THREE from 'three';

const SKIN = ['#f1c7a4', '#d9a07a', '#a86b48', '#7a4a2f', '#e8b896', '#5a3825'];
const SHIRTS = ['#ff6b5a', '#ffffff', '#19d3c5', '#ffd166', '#7b5cff', '#ef476f', '#118ab2', '#f4a261', '#90be6d', '#f7f1e3'];
const PANTS = ['#2b2d42', '#3d5a80', '#e9d8a6', '#6c584c', '#1d3557', '#f1faee', '#264653'];
const HAIR = ['#1b1b1b', '#4a2f1d', '#c99a5b', '#7a3b1d', '#e5d3b3'];

const geo = {
  leg: new THREE.BoxGeometry(0.22, 0.85, 0.24).translate(0, -0.42, 0),
  arm: new THREE.BoxGeometry(0.17, 0.72, 0.18).translate(0, -0.34, 0),
  torso: new THREE.BoxGeometry(0.56, 0.68, 0.3),
  head: new THREE.BoxGeometry(0.28, 0.3, 0.28),
  hair: new THREE.BoxGeometry(0.3, 0.1, 0.3),
  cap: new THREE.BoxGeometry(0.32, 0.08, 0.42),
  gun: new THREE.BoxGeometry(0.08, 0.14, 0.42),
};
const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}

export function randomLook(rand) {
  return { skin: rand.pick(SKIN), shirt: rand.pick(SHIRTS), pants: rand.pick(PANTS), hair: rand.pick(HAIR), cap: rand.chance(0.2) ? rand.pick(SHIRTS) : null };
}

export class CharacterModel {
  constructor(look) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const part = (g, color, x, y, z, parent = body) => {
      const m = new THREE.Mesh(g, mat(color));
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const pivot = (x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); body.add(p); return p; };
    this.legL = pivot(-0.14, 0.88, 0); part(geo.leg, look.pants, 0, 0, 0, this.legL);
    this.legR = pivot(0.14, 0.88, 0); part(geo.leg, look.pants, 0, 0, 0, this.legR);
    this.torso = part(geo.torso, look.shirt, 0, 1.22, 0);
    this.armL = pivot(-0.37, 1.52, 0); part(geo.arm, look.shirt, 0, 0, 0, this.armL);
    this.armR = pivot(0.37, 1.52, 0); part(geo.arm, look.shirt, 0, 0, 0, this.armR);
    part(geo.arm.clone().scale(0.98, 0.3, 0.98).translate(0, -0.48, 0), look.skin, 0, 0, 0, this.armL);
    part(geo.arm.clone().scale(0.98, 0.3, 0.98).translate(0, -0.48, 0), look.skin, 0, 0, 0, this.armR);
    this.head = part(geo.head, look.skin, 0, 1.72, 0);
    part(geo.hair, look.hair, 0, 1.9, -0.01);
    if (look.cap) part(geo.cap, look.cap, 0, 1.92, 0.05);
    if (look.vest) part(new THREE.BoxGeometry(0.6, 0.4, 0.34), look.vest, 0, 1.3, 0);
    this.gun = part(geo.gun, '#222326', 0, -0.68, 0.16, this.armR);
    this.gun.visible = false;
    this.root = root;
    this.body = body;
    this.phase = Math.random() * 6;
    this.dead = false;
  }

  // speed in m/s; aiming raises the right arm forward.
  animate(dt, speed, aiming = false, armed = false) {
    if (this.dead) return;
    if (this.sitting) {
      // Breathing and the odd glance around while sitting on the sand.
      this.phase += dt;
      this.head.rotation.y = Math.sin(this.phase * 0.4) * 0.5;
      return;
    }
    this.phase += dt * (2.2 + speed * 1.6);
    const swing = Math.min(1, speed / 5) * 0.9 + (speed > 0.2 ? 0.15 : 0);
    const s = Math.sin(this.phase);
    this.legL.rotation.x = s * swing;
    this.legR.rotation.x = -s * swing;
    this.armL.rotation.x = -s * swing * 0.8;
    this.armR.rotation.x = aiming ? -Math.PI / 2 : s * swing * 0.8;
    this.armR.rotation.z = 0;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.06 * swing;
    this.body.rotation.x = speed > 6 ? 0.12 : 0;
    this.gun.visible = armed;
  }

  // Sitting on a towel: legs out in front, leaning back on the hands.
  setSitting(on) {
    this.sitting = on;
    this.body.position.y = on ? -0.74 : 0;
    this.body.rotation.x = on ? -0.18 : 0;
    this.legL.rotation.x = this.legR.rotation.x = on ? -Math.PI / 2 + 0.18 : 0;
    this.armL.rotation.x = this.armR.rotation.x = on ? 0.55 : 0;
    this.head.rotation.y = 0;
  }

  punch(t) { this.armR.rotation.x = -Math.PI / 2 * Math.sin(Math.min(1, t) * Math.PI); }

  setDead(dead) {
    this.dead = dead;
    this.body.rotation.x = dead ? -Math.PI / 2 : 0;
    this.body.position.y = dead ? 0.18 : 0;
    this.body.position.z = dead ? -0.9 : 0;
    if (dead) { this.legL.rotation.x = 0.2; this.legR.rotation.x = -0.15; this.armL.rotation.x = -2.6; this.armR.rotation.x = -0.4; }
  }
}
