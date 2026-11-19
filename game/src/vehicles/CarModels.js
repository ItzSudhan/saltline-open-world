// Saltline Bay's own car line-up and the low-poly meshes built for each model.
import * as THREE from 'three';
import { makePuffTexture } from '../world/Textures.js';
import { mergeGeometries } from '../world/StaticBatcher.js';

let glowTex = null;

export const CAR_TYPES = {
  sedan: { name: 'Ondo Cruiser', len: 4.6, wid: 1.9, h: 1.45, maxSpeed: 40, accel: 15, grip: 7.5,
    colors: ['#e9e4da', '#3f6f9f', '#9a2f2f', '#2f4f3f', '#c9c2b8', '#22252b', '#d9a441'] },
  coupe: { name: 'Marlin Vela', len: 4.4, wid: 1.9, h: 1.25, maxSpeed: 54, accel: 22, grip: 8.5, sporty: true,
    colors: ['#ff6b5a', '#19d3c5', '#ffd166', '#ffffff', '#7b5cff'] },
  suv: { name: 'Brisa Trailhawk', len: 4.9, wid: 2.05, h: 1.8, maxSpeed: 36, accel: 12, grip: 7,
    colors: ['#4a5560', '#efefef', '#6b8f71', '#25384f', '#8c6a4f'] },
  taxi: { name: 'Gull Cab', len: 4.6, wid: 1.9, h: 1.45, maxSpeed: 40, accel: 15, grip: 7.5, colors: ['#2ec4b6'] },
  pickup: { name: 'Ridgeback Hauler', len: 5.2, wid: 2.05, h: 1.7, maxSpeed: 36, accel: 12, grip: 6.5,
    colors: ['#c2452d', '#2d5d7b', '#e8e1cf', '#3c3c3c'] },
  kestrel: { name: 'Kestrel GT', len: 4.5, wid: 1.95, h: 1.2, maxSpeed: 58, accel: 24, grip: 9, sporty: true, colors: ['#d7263d'] },
  courier: { name: 'Sable Interceptor', len: 4.8, wid: 1.95, h: 1.35, maxSpeed: 50, accel: 18, grip: 8, colors: ['#15171c'] },
  police: { name: 'SBPD Pursuit', len: 4.8, wid: 1.95, h: 1.45, maxSpeed: 52, accel: 19, grip: 8.5, colors: ['#f4f6f8'] },
  scooter: { name: 'Puffin 125', len: 1.9, wid: 0.75, h: 1.1, maxSpeed: 25, accel: 11, grip: 9, twoWheel: true,
    colors: ['#8ff7ec', '#ffd166', '#ff9db0', '#ffffff', '#9fe3a0'] },
};

export const TRAFFIC_MIX = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'taxi', 'pickup', 'coupe', 'scooter', 'scooter'];

const glassMat = new THREE.MeshPhongMaterial({ color: '#1b2633', shininess: 120, specular: 0x99bbdd });
const tyreMat = new THREE.MeshLambertMaterial({ color: '#17181b' });
const rimMat = new THREE.MeshLambertMaterial({ color: '#c9ced6' });
const trimMat = new THREE.MeshLambertMaterial({ color: '#2a2d33' });
const headMat = new THREE.MeshBasicMaterial({ color: '#fff6d8' });
const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14);
wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8);
rimGeo.rotateZ(Math.PI / 2);
let wheelComboCache = null;
const wheelComboGet = () => (wheelComboCache ||= mergeGeometries([wheelGeo, rimGeo], true));

// Collapse a car's static boxes into one mesh per material (far fewer draw calls).
function mergeByMaterial(group, bodyMat) {
  const buckets = new Map();
  for (const m of [...group.children]) {
    if (!m.isMesh || Array.isArray(m.material) || m.userData.keep) continue;
    m.updateMatrix();
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material).push(m.geometry.clone().applyMatrix4(m.matrix));
    group.remove(m);
  }
  for (const [mat, geos] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.castShadow = mat === bodyMat;
    group.add(mesh);
  }
}

function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

// Each model is built once as a template; every car is a clone sharing its geometry, with its own
// paint and lightbar materials.
const templates = new Map();
const TEMPLATE_PAINT = new THREE.MeshPhongMaterial({ color: '#ffffff', shininess: 70, specular: 0x666666 });

export function buildCarMesh(typeKey, color) {
  if (!templates.has(typeKey)) templates.set(typeKey, buildCarTemplate(typeKey));
  const group = templates.get(typeKey).clone(true);
  const bodyMat = TEMPLATE_PAINT.clone();
  bodyMat.color.set(color);
  const parts = { wheels: [], steerPivots: [], lightbar: null, bodyMat };
  const lb = {};
  group.traverse((o) => {
    if (o.material === TEMPLATE_PAINT) o.material = bodyMat;
    else if (Array.isArray(o.material)) o.material = o.material.map((m) => (m === TEMPLATE_PAINT ? bodyMat : m));
    if (o.userData.wheel) parts.wheels.push(o);
    if (o.userData.steer) parts.steerPivots.push(o);
    if (o.userData.lb) { o.material = o.material.clone(); lb[o.userData.lb] = o.material; }
    if (o.userData.glow) { o.material = o.material.clone(); lb[o.userData.glow] = o; }
    if (o.userData.rider) parts.rider = o;
  });
  if (lb.red) parts.lightbar = { red: lb.red, blue: lb.blue, glowRed: lb.glowRed, glowBlue: lb.glowBlue };
  return { group, parts };
}

// A step-through scooter facing +z, with a helmeted rider (shown while an AI rides it).
function buildScooterTemplate() {
  const g = new THREE.Group();
  const bodyMat = TEMPLATE_PAINT;
  box(0.5, 0.12, 1.3, trimMat, 0, 0.38, -0.05, g);                     // floorboard
  box(0.56, 0.45, 0.8, bodyMat, 0, 0.62, -0.45, g);                    // rear body
  box(0.5, 0.12, 0.7, new THREE.MeshLambertMaterial({ color: '#2a1d16' }), 0, 0.9, -0.4, g); // seat
  const stem = box(0.42, 0.75, 0.16, bodyMat, 0, 0.75, 0.62, g);       // leg shield
  stem.rotation.x = -0.25;
  box(0.66, 0.06, 0.06, trimMat, 0, 1.18, 0.6, g, false);              // handlebar
  box(0.22, 0.14, 0.08, headMat, 0, 1.05, 0.74, g, false);
  box(0.2, 0.08, 0.06, tailMat, 0, 0.78, -0.88, g, false);
  mergeByMaterial(g, bodyMat);
  const rider = new THREE.Group();
  rider.userData.rider = true;
  const shirt = new THREE.MeshLambertMaterial({ color: '#3f6f9f' });
  const skin = new THREE.MeshLambertMaterial({ color: '#c98d66' });
  const helmet = new THREE.MeshLambertMaterial({ color: '#f4f6f8' });
  box(0.42, 0.55, 0.26, shirt, 0, 1.28, -0.3, rider).rotation.x = 0.2;
  box(0.36, 0.2, 0.5, new THREE.MeshLambertMaterial({ color: '#22252b' }), 0, 1.0, -0.15, rider);
  for (const s of [-1, 1]) box(0.1, 0.1, 0.55, skin, s * 0.24, 1.3, 0.12, rider, false).rotation.x = 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), helmet);
  head.position.set(0, 1.72, -0.22);
  head.castShadow = true;
  rider.add(head);
  g.add(rider);
  for (const sz of [0.66, -0.68]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.26, sz);
    const wheel = new THREE.Mesh(wheelComboGet(), [tyreMat, rimMat]);
    wheel.scale.setScalar(0.68);
    wheel.userData.wheel = true;
    pivot.userData.steer = sz > 0;
    pivot.add(wheel);
    g.add(pivot);
  }
  return g;
}

// Builds a car facing +z.
function buildCarTemplate(typeKey) {
  const t = CAR_TYPES[typeKey];
  if (t.twoWheel) return buildScooterTemplate();
  const g = new THREE.Group();
  const bodyMat = TEMPLATE_PAINT;
  const L = t.len, W = t.wid, H = t.h;
  const baseY = 0.42;
  const lowerH = H * 0.42;
  const lower = box(W, lowerH, L, bodyMat, 0, baseY + lowerH / 2, 0, g);
  const lp = lower.geometry.attributes.position;
  for (let i = 0; i < lp.count; i++) if (lp.getY(i) > 0) { lp.setX(i, lp.getX(i) * 0.94); lp.setZ(i, lp.getZ(i) * 0.97); }
  lower.geometry.computeVertexNormals();
  // Wheel arches.
  for (const sz of [-1, 1]) box(W + 0.04, 0.12, 1.1, trimMat, 0, baseY + 0.05, sz * L * 0.33, g, false);
  // Hood and boot taper.
  box(W * 0.96, 0.12, L * 0.28, bodyMat, 0, baseY + lowerH + 0.04, L * 0.34, g);
  const cabinLen = typeKey === 'pickup' ? L * 0.34 : L * (t.sporty ? 0.42 : 0.5);
  const cabinZ = typeKey === 'pickup' ? L * 0.12 : -L * 0.04;
  const cabinH = H - lowerH - (t.sporty ? 0.05 : 0);
  // Taper the cabin's roof so the windscreen and rear window slope.
  const cabinGeo = new THREE.BoxGeometry(W * 0.86, cabinH, cabinLen);
  const cp = cabinGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    if (cp.getY(i) > 0) { cp.setZ(i, cp.getZ(i) * (t.sporty ? 0.55 : 0.7) - cabinLen * 0.04); cp.setX(i, cp.getX(i) * 0.9); }
  }
  cabinGeo.computeVertexNormals();
  const cabin = new THREE.Mesh(cabinGeo, [glassMat, glassMat, bodyMat, glassMat, glassMat, glassMat]);
  cabin.position.set(0, baseY + lowerH + cabinH / 2, cabinZ);
  cabin.castShadow = true;
  g.add(cabin);
  if (typeKey === 'pickup') {
    box(W, 0.5, L * 0.38, trimMat, 0, baseY + lowerH + 0.2, -L * 0.28, g);
    box(W * 0.9, 0.06, L * 0.36, new THREE.MeshLambertMaterial({ color: '#3a3328' }), 0, baseY + lowerH + 0.46, -L * 0.28, g, false);
  }
  // Bumpers and lights.
  box(W * 1.02, 0.22, 0.18, trimMat, 0, baseY + 0.18, L / 2 + 0.02, g, false);
  box(W * 1.02, 0.22, 0.18, trimMat, 0, baseY + 0.18, -L / 2 - 0.02, g, false);
  for (const sx of [-1, 1]) {
    box(0.42, 0.16, 0.06, headMat, sx * W * 0.34, baseY + lowerH * 0.72, L / 2 + 0.03, g, false);
    box(0.42, 0.16, 0.06, tailMat, sx * W * 0.34, baseY + lowerH * 0.72, -L / 2 - 0.03, g, false);
  }
  if (t.sporty) box(W * 0.9, 0.06, 0.4, trimMat, 0, baseY + lowerH + 0.35, -L / 2 + 0.25, g); // spoiler
  if (typeKey === 'kestrel' || typeKey === 'coupe') {
    box(0.3, 0.02, L * 0.98, new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.25, baseY + lowerH + 0.11, 0, g, false);
  }

  if (typeKey === 'police') {
    // Navy doors and a lightbar of the city's own design.
    const navy = new THREE.MeshLambertMaterial({ color: '#16264a' });
    for (const sx of [-1, 1]) box(0.04, lowerH * 0.8, L * 0.45, navy, sx * (W / 2 + 0.01), baseY + lowerH / 2, 0, g, false);
    box(W * 0.98, 0.04, L * 0.2, navy, 0, baseY + lowerH + 0.06, L * 0.38, g, false);
    const red = new THREE.MeshBasicMaterial({ color: '#ff1f3d' });
    const blue = new THREE.MeshBasicMaterial({ color: '#1f6bff' });
    const roofY = baseY + lowerH + cabinH + 0.1;
    box(W * 0.7, 0.08, 0.36, trimMat, 0, roofY - 0.04, cabinZ, g, false);
    const l = box(W * 0.33, 0.16, 0.32, red, -W * 0.18, roofY + 0.06, cabinZ, g, false);
    const r = box(W * 0.33, 0.16, 0.32, blue, W * 0.18, roofY + 0.06, cabinZ, g, false);
    l.userData.keep = r.userData.keep = true;
    l.userData.lb = 'red'; r.userData.lb = 'blue';
    // Additive glows so the lightbar reads from a distance and at dusk.
    glowTex ||= makePuffTexture();
    const glow = (color, x) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      s.scale.setScalar(3.4);
      s.position.set(x, roofY + 0.1, cabinZ);
      g.add(s);
      return s;
    };
    glow('#ff2040', -W * 0.25).userData.glow = 'glowRed';
    glow('#2f6bff', W * 0.25).userData.glow = 'glowBlue';
  }
  if (typeKey === 'taxi') {
    box(0.9, 0.28, 0.35, new THREE.MeshBasicMaterial({ color: '#fff7c2' }), 0, baseY + lowerH + cabinH + 0.14, cabinZ, g, false);
    for (const sx of [-1, 1]) box(0.03, 0.18, L * 0.7, new THREE.MeshLambertMaterial({ color: '#ffffff' }), sx * (W / 2 + 0.01), baseY + lowerH * 0.55, 0, g, false);
  }

  mergeByMaterial(g, bodyMat);
  const wx = W / 2 - 0.12, wz = L * 0.33;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wx, 0.38, sz * wz);
    const wheel = new THREE.Mesh(wheelComboGet(), [tyreMat, rimMat]);
    wheel.userData.wheel = true;
    pivot.userData.steer = sz > 0;
    pivot.add(wheel);
    g.add(pivot);
  }
  return g;
}
