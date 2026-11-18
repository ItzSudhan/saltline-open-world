// Visual effects: bullet tracers, muzzle flashes, sparks, blood, tyre smoke, burning wrecks and
// explosions, drawn from small pools so nothing is allocated mid-fight.
import * as THREE from 'three';
import { makePuffTexture } from '../world/Textures.js';

export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.puff = makePuffTexture();
    this.particles = [];
    for (let i = 0; i < 160; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puff, transparent: true, depthWrite: false, fog: true }));
      s.visible = false;
      scene.add(s);
      this.particles.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 0, fade: 1 });
    }
    this.cursor = 0;
    this.tracers = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fff3b0', transparent: true }));
      l.visible = false; l.frustumCulled = false;
      scene.add(l);
      this.tracers.push({ l, life: 0 });
    }
    this.flash = new THREE.PointLight('#ffcf7a', 0, 14, 2);
    scene.add(this.flash);
    this.boomLight = new THREE.PointLight('#ff8a3d', 0, 60, 1.5);
    scene.add(this.boomLight);
    this.fireballs = [];
    const fbMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), fbMat.clone());
      m.visible = false;
      scene.add(m);
      this.fireballs.push({ m, life: 0 });
    }
  }

  emit(x, y, z, o) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.particles.length;
    p.s.visible = true;
    p.s.position.set(x, y, z);
    p.s.material.color.set(o.color);
    p.s.material.opacity = o.opacity ?? 1;
    p.s.material.blending = o.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.s.scale.setScalar(o.size);
    p.life = o.life; p.max = o.life; p.fade = o.opacity ?? 1;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.grow = o.grow || 0; p.gravity = o.gravity || 0;
  }

  tracer(ax, ay, az, bx, by, bz, color) {
    const t = this.tracers.find((q) => q.life <= 0) || this.tracers[0];
    const arr = t.l.geometry.attributes.position.array;
    arr.set([ax, ay, az, bx, by, bz]);
    t.l.geometry.attributes.position.needsUpdate = true;
    t.l.material.color.set(color);
    t.l.visible = true;
    t.life = 0.07;
  }

  muzzle(x, y, z) {
    this.flash.position.set(x, y, z);
    this.flash.intensity = 25;
    this.emit(x, y, z, { color: '#ffd27a', size: 0.7, life: 0.06, additive: true });
  }

  sparks(x, y, z) {
    for (let i = 0; i < 6; i++) {
      this.emit(x, y, z, { color: '#ffe08a', size: 0.18, life: 0.3, additive: true, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 6, gravity: 12 });
    }
    this.emit(x, y, z, { color: '#bbbbbb', size: 0.6, life: 0.6, opacity: 0.5, grow: 1.5, vy: 0.5 });
  }

  blood(x, y, z) {
    for (let i = 0; i < 7; i++) {
      this.emit(x, y, z, { color: '#a3001b', size: 0.25, life: 0.5, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, gravity: 9 });
    }
  }

  smoke(x, y, z, heavy) {
    this.emit(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), {
      color: heavy ? '#2a2a2a' : '#8a8a8a', size: heavy ? 1.6 : 0.9, life: heavy ? 2.4 : 1.4, opacity: 0.65, grow: 1.6, vy: 2.2,
    });
    if (heavy && Math.random() < 0.5) this.emit(x, y - 0.3, z, { color: '#ff7a1a', size: 1.1, life: 0.35, additive: true, vy: 2, grow: 0.5 });
  }

  tyreSmoke(x, z) { this.emit(x, 0.4, z, { color: '#d8d8d8', size: 0.9, life: 1, opacity: 0.4, grow: 2.2, vy: 0.6 }); }

  explosion(x, y, z) {
    const game = this.game;
    const fb = this.fireballs.find((f) => f.life <= 0) || this.fireballs[0];
    fb.m.position.set(x, y, z);
    fb.m.visible = true;
    fb.life = 0.7;
    this.boomLight.position.set(x, y + 2, z);
    this.boomLight.intensity = 400;
    for (let i = 0; i < 22; i++) {
      this.emit(x, y, z, { color: i % 2 ? '#ff8c2a' : '#ffd166', size: 2.4, life: 0.8, additive: true, grow: 3,
        vx: (Math.random() - 0.5) * 14, vy: Math.random() * 9, vz: (Math.random() - 0.5) * 14 });
    }
    for (let i = 0; i < 14; i++) {
      this.emit(x, y + 1, z, { color: '#303030', size: 2.5, life: 3, opacity: 0.7, grow: 2.2,
        vx: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 5 });
    }
    game.audio?.explosion(x, z);
    const pp = game.player.position;
    const d = Math.hypot(pp.x - x, pp.z - z);
    game.camera.shake(Math.max(0, 1.2 - d / 40));
    game.onExplosion?.(x, z);
  }

  update(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.vy -= p.gravity * dt;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      if (p.s.position.y < 0.05) { p.s.position.y = 0.05; p.vy = 0; }
      p.s.scale.multiplyScalar(1 + p.grow * dt);
      p.s.material.opacity = p.fade * Math.min(1, (p.life / p.max) * 1.6);
    }
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.l.visible = false; }
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 500);
    this.boomLight.intensity = Math.max(0, this.boomLight.intensity - dt * 500);
    for (const f of this.fireballs) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const k = 1 - f.life / 0.7;
      f.m.scale.setScalar(1 + k * 6);
      f.m.material.opacity = Math.max(0, 1 - k);
      f.m.material.color.setHSL(0.09 - k * 0.07, 1, 0.6 - k * 0.3);
      if (f.life <= 0) f.m.visible = false;
    }
  }
}
