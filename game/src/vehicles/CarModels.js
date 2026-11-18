// Saltline Bay's own car line-up and the low-poly meshes built for each model.
import * as THREE from 'three';

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
};

export const TRAFFIC_MIX = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'taxi', 'pickup', 'coupe'];

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

function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

// Builds a car facing +z. Returns the group and the parts that animate.
export function buildCarMesh(typeKey, color) {
  const t = CAR_TYPES[typeKey];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x666666 });
  const L = t.len, W = t.wid, H = t.h;
  const baseY = 0.42;
  const lowerH = H * 0.42;
  box(W, lowerH, L, bodyMat, 0, baseY + lowerH / 2, 0, g);
  // Hood and boot taper.
  box(W * 0.96, 0.12, L * 0.28, bodyMat, 0, baseY + lowerH + 0.04, L * 0.34, g);
  const cabinLen = typeKey === 'pickup' ? L * 0.34 : L * (t.sporty ? 0.42 : 0.5);
  const cabinZ = typeKey === 'pickup' ? L * 0.12 : -L * 0.04;
  const cabinH = H - lowerH - (t.sporty ? 0.05 : 0);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, cabinH, cabinLen), [glassMat, glassMat, bodyMat, glassMat, glassMat, glassMat]);
  cabin.position.set(0, baseY + lowerH + cabinH / 2, cabinZ);
  cabin.castShadow = true;
  g.add(cabin);
  // Pillars give the cabin a car-like silhouette.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.08, cabinH, 0.12, bodyMat, sx * W * 0.43, cabin.position.y, cabinZ + sz * cabinLen * 0.48, g, false);
  }
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

  const parts = { wheels: [], steerPivots: [], lightbar: null, bodyMat };
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
    parts.lightbar = { left: l, right: r, red, blue };
  }
  if (typeKey === 'taxi') {
    box(0.9, 0.28, 0.35, new THREE.MeshBasicMaterial({ color: '#fff7c2' }), 0, baseY + lowerH + cabinH + 0.14, cabinZ, g, false);
    for (const sx of [-1, 1]) box(0.03, 0.18, L * 0.7, new THREE.MeshLambertMaterial({ color: '#ffffff' }), sx * (W / 2 + 0.01), baseY + lowerH * 0.55, 0, g, false);
  }

  const wx = W / 2 - 0.12, wz = L * 0.33;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wx, 0.38, sz * wz);
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.castShadow = true;
    wheel.add(tyre, new THREE.Mesh(rimGeo, rimMat));
    pivot.add(wheel);
    g.add(pivot);
    parts.wheels.push(wheel);
    if (sz > 0) parts.steerPivots.push(pivot);
  }
  return { group: g, parts };
}
