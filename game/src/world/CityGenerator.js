// Builds Saltline Bay's meshes: roads, sidewalks, pastel low-rises, glass towers, palms, the beach,
// the ocean and landmarks, and registers every solid footprint with the collision world.
import * as THREE from 'three';
import {
  GRID, CELL, HALF, ROAD_HALF, BEACH_START, SHORE_X, LANDMARKS, roadCoord, blockCenter, isDowntown,
} from './CityLayout.js';
import {
  makeRoadTexture, makeFacadeTexture, makeGlassTexture, makeSignTexture, makeSandTexture, makeConcreteTexture,
} from './Textures.js';

const PASTELS = ['#f7c8a8', '#f2a7b5', '#a8e0d8', '#fde7a6', '#c9d8f5', '#f5efe4', '#e9b8e8', '#ffd2a1', '#b9e6b0', '#ffb8a0'];
const GLASS_TINTS = ['#bfe6ff', '#a6d8d0', '#d5ccff', '#ffe0c0'];
const BILLBOARDS = [
  ['SUNPOP SODA', '#ff5a5f'], ['KESTREL MOTORS', '#1b3a5c'], ['WAVE 104.2 FM', '#19a7a0'],
  ['GULLWING AIR', '#f28c28'], ['MANGO BAY RESORT', '#2a9d8f'], ['NIGHTJAR ENERGY', '#3d2c8d'],
];

function shade(mesh, cast = true) { mesh.castShadow = cast; mesh.receiveShadow = true; return mesh; }

// Box with UVs scaled so the facade texture repeats once per 4 m bay and 3.5 m floor.
function facadeBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const floors = Math.max(1, Math.round(h / 3.5));
  for (let face = 0; face < 6; face++) {
    const across = face < 2 ? d : w;
    const bays = Math.max(1, Math.round(across / 4));
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uv.getX(i) * bays, uv.getY(i) * floors);
    }
  }
  return g;
}

// A drooping crown of palm fronds as a single geometry (for instancing).
function palmCrownGeometry() {
  const pos = [];
  const leaves = 8, segs = 5, len = 4.2;
  for (let l = 0; l < leaves; l++) {
    const a = (l / leaves) * Math.PI * 2 + (l % 2) * 0.2;
    const ca = Math.cos(a), sa = Math.sin(a);
    let prev = null;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const r = t * len;
      const y = 0.6 * t - 2.2 * t * t;
      const wdt = Math.sin(t * Math.PI) * 0.75 + 0.05;
      const cx = ca * r, cz = sa * r;
      const px = -sa * wdt, pz = ca * wdt;
      const left = [cx + px, y, cz + pz], mid = [cx, y + 0.12, cz], right = [cx - px, y, cz - pz];
      if (prev) {
        pos.push(...prev.left, ...prev.mid, ...left, ...left, ...prev.mid, ...mid);
        pos.push(...prev.mid, ...prev.right, ...mid, ...mid, ...prev.right, ...right);
      }
      prev = { left, mid, right };
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function generateCity(scene, collision, rand) {
  const R = () => rand.next();
  const footprints = [];
  const animated = [];
  const anisotropy = 8;

  const facadeTex = makeFacadeTexture(R);
  const glassTex = makeGlassTexture(R);
  const wallMats = PASTELS.map((c) => new THREE.MeshLambertMaterial({ color: c, map: facadeTex }));
  const glassMats = GLASS_TINTS.map((c) => new THREE.MeshPhongMaterial({ color: c, map: glassTex, shininess: 90, specular: 0x88aacc }));
  const roofMat = new THREE.MeshLambertMaterial({ color: '#c7beb0' });
  const trimMat = new THREE.MeshLambertMaterial({ color: '#fbf7ef' });
  const darkMat = new THREE.MeshLambertMaterial({ color: '#4a4f57' });

  // Ground beyond the city, the road surface and the sidewalks.
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: '#b7a57a' }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.06; outer.receiveShadow = true;
  scene.add(outer);

  const roadTex = makeRoadTexture(R);
  const span = 2 * (HALF + ROAD_HALF);
  roadTex.repeat.set(span / CELL, span / CELL);
  roadTex.offset.set(-ROAD_HALF / CELL, -ROAD_HALF / CELL);
  roadTex.anisotropy = anisotropy;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshLambertMaterial({ map: roadTex }));
  road.rotation.x = -Math.PI / 2; road.position.y = 0; road.receiveShadow = true;
  scene.add(road);

  const concrete = makeConcreteTexture(R);
  concrete.repeat.set(16, 16);
  const sidewalkMat = new THREE.MeshLambertMaterial({ map: concrete });
  const curbMat = new THREE.MeshLambertMaterial({ color: '#e7e1d4' });
  const grassMat = new THREE.MeshLambertMaterial({ color: '#6fbf5a' });
  const sideGeo = new THREE.BoxGeometry(CELL - 2 * ROAD_HALF, 0.16, CELL - 2 * ROAD_HALF);
  const curbGeo = new THREE.BoxGeometry(CELL - 2 * ROAD_HALF + 0.3, 0.12, CELL - 2 * ROAD_HALF + 0.3);

  // Palms and street lamps collected for instancing.
  const palms = [];
  const lamps = [];
  const palmAt = (x, z, h = 7 + R() * 5) => palms.push({ x, z, h, lean: (R() - 0.5) * 0.25, rot: R() * 6.28 });

  for (let bi = 0; bi < GRID; bi++) {
    for (let bj = 0; bj < GRID; bj++) {
      const x0 = roadCoord(bi), z0 = roadCoord(bj);
      const c = blockCenter(bi, bj);
      const side = new THREE.Mesh(sideGeo, sidewalkMat);
      side.position.set(c.x, 0.08, c.z); side.receiveShadow = true;
      scene.add(side);
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(c.x, 0.05, c.z);
      scene.add(curb);

      // Palms along every curb, street lamps on the corners.
      for (const t of [14, 30, 50, 66]) {
        palmAt(x0 + t, z0 + ROAD_HALF + 1.1);
        palmAt(x0 + t, z0 + CELL - ROAD_HALF - 1.1);
        palmAt(x0 + ROAD_HALF + 1.1, z0 + t);
        palmAt(x0 + CELL - ROAD_HALF - 1.1, z0 + t);
      }
      for (const [lx, lz] of [[x0 + 9.2, z0 + 9.2], [x0 + 70.8, z0 + 70.8], [x0 + 9.2, z0 + 70.8], [x0 + 70.8, z0 + 9.2]]) lamps.push([lx, lz]);

      const landmark = LANDMARKS[`${bi},${bj}`];
      if (landmark?.id === 'park') { buildPark(c); continue; }
      if (landmark) { buildLandmark(landmark, c, x0, z0); continue; }
      buildBlock(bi, bj, x0, z0);
    }
  }

  function addBuilding(minX, minZ, maxX, maxZ, h, mat, opts = {}) {
    const w = maxX - minX, d = maxZ - minZ;
    const m = shade(new THREE.Mesh(facadeBox(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]));
    m.position.set((minX + maxX) / 2, h / 2 + 0.1, (minZ + maxZ) / 2);
    scene.add(m);
    // Cornice cap.
    const cap = shade(new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6), opts.capMat || trimMat), false);
    cap.position.set(m.position.x, h + 0.3, m.position.z);
    scene.add(cap);
    collision.addBox(minX, minZ, maxX, maxZ, h);
    footprints.push({ minX, minZ, maxX, maxZ, h, color: opts.mapColor || '#d9cfc0' });
    return m;
  }

  function buildBlock(bi, bj, x0, z0) {
    const downtown = isDowntown(bi, bj);
    const nearCore = Math.abs(bi - 3.5) + Math.abs(bj - 3) < 3.5;
    for (let qx = 0; qx < 2; qx++) {
      for (let qz = 0; qz < 2; qz++) {
        if (!downtown && R() < 0.12) {
          // An open lot: a little plaza with palms.
          const px = x0 + 26 + qx * 28, pz = z0 + 26 + qz * 28;
          palmAt(px - 5, pz - 5); palmAt(px + 5, pz + 4);
          continue;
        }
        const w = downtown ? 20 + R() * 6 : 15 + R() * 9;
        const d = downtown ? 20 + R() * 6 : 15 + R() * 9;
        const minX = qx === 0 ? x0 + 13 : x0 + CELL - 13 - w;
        const minZ = qz === 0 ? z0 + 13 : z0 + CELL - 13 - d;
        if (downtown) {
          const h = 38 + R() * 62;
          const mat = rand.pick(glassMats);
          addBuilding(minX, minZ, minX + w, minZ + d, h, mat, { capMat: darkMat, mapColor: '#b9d4e6' });
          if (R() < 0.7) {
            const inset = 3 + R() * 2;
            const h2 = 8 + R() * 22;
            const top = shade(new THREE.Mesh(facadeBox(w - inset * 2, h2, d - inset * 2), [mat, mat, roofMat, roofMat, mat, mat]));
            top.position.set(minX + w / 2, h + h2 / 2, minZ + d / 2);
            scene.add(top);
            if (R() < 0.5) {
              const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 10, 6), trimMat);
              spire.position.set(minX + w / 2, h + h2 + 5, minZ + d / 2);
              scene.add(spire);
            }
          }
        } else {
          const h = nearCore ? 12 + R() * 22 : 6 + R() * 12;
          const mat = rand.pick(wallMats);
          addBuilding(minX, minZ, minX + w, minZ + d, h, mat, { mapColor: '#e2d6c4' });
          // Rooftop details: AC units, water tank or a billboard.
          const roll = R();
          if (roll < 0.35) {
            const ac = shade(new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.4, 2), roofMat));
            ac.position.set(minX + w * (0.3 + R() * 0.4), h + 1.3, minZ + d * (0.3 + R() * 0.4));
            scene.add(ac);
          } else if (roll < 0.5) {
            const [text, bg] = rand.pick(BILLBOARDS);
            addBillboard(minX + w / 2, h, minZ + d / 2, qz === 0 ? Math.PI : 0, text, bg);
          }
          // Shopfront awnings on the street side.
          const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.25, 2.2),
            new THREE.MeshLambertMaterial({ color: rand.pick(['#e85d75', '#2a9d8f', '#f4a261', '#3d7dd8', '#ffffff']) }));
          aw.castShadow = true;
          aw.position.set(minX + w / 2, 3.4, qz === 0 ? minZ - 1.1 : minZ + d + 1.1);
          scene.add(aw);
        }
      }
    }
  }

  function addBillboard(x, h, z, rotY, text, bg) {
    const tex = makeSignTexture(text, bg);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.9 * 12 / 6.4 * 0.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.set(x, h + 3.2, z);
    board.rotation.y = rotY;
    scene.add(board);
    for (const o of [-4, 4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.25), darkMat);
      leg.position.set(x + Math.cos(rotY) * o, h + 1.5, z - Math.sin(rotY) * o);
      scene.add(leg);
    }
  }

  function buildLandmark(lm, c, x0, z0) {
    const mat = new THREE.MeshLambertMaterial({ color: lm.color, map: facadeTex });
    const minX = c.x - 22, maxX = c.x + 22, minZ = z0 + 14, maxZ = z0 + 46;
    addBuilding(minX, minZ, maxX, maxZ, lm.height, mat, { mapColor: '#f0c27a' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.06), new THREE.MeshBasicMaterial({ map: makeSignTexture(lm.name, lm.sign) }));
    sign.position.set(c.x, Math.min(lm.height - 3, 8.5), maxZ + 0.08);
    scene.add(sign);
    if (lm.id === 'bank') {
      for (let i = -3; i <= 3; i++) {
        const col = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 7, 12), trimMat));
        col.position.set(c.x + i * 5.5, 3.6, maxZ + 2.5);
        scene.add(col);
      }
      const roofSlab = shade(new THREE.Mesh(new THREE.BoxGeometry(40, 1, 6), trimMat));
      roofSlab.position.set(c.x, 7.5, maxZ + 2.5);
      scene.add(roofSlab);
    }
    if (lm.id === 'garage') {
      for (const o of [-12, 0, 12]) {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshLambertMaterial({ color: '#39424e' }));
        door.position.set(c.x + o, 3.1, maxZ + 0.06);
        scene.add(door);
      }
      sign.position.y = 7.6;
    }
    if (lm.id === 'club') {
      const neon = new THREE.Mesh(new THREE.BoxGeometry(44.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: '#ff4fa0' }));
      neon.position.set(c.x, lm.height - 0.4, maxZ + 0.3);
      scene.add(neon);
    }
    if (lm.id === 'police') {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(44.2, 1.2, 32.2), new THREE.MeshLambertMaterial({ color: '#1d3f8a' }));
      stripe.position.set(c.x, 11, (minZ + maxZ) / 2);
      scene.add(stripe);
    }
    // Forecourt palms.
    palmAt(c.x - 18, maxZ + 12); palmAt(c.x + 18, maxZ + 12);
  }

  function buildPark(c) {
    const grass = new THREE.Mesh(new THREE.BoxGeometry(56, 0.2, 56), grassMat);
    grass.position.set(c.x, 0.12, c.z); grass.receiveShadow = true;
    scene.add(grass);
    for (const rot of [0, Math.PI / 2]) {
      const path = new THREE.Mesh(new THREE.BoxGeometry(56, 0.22, 5), sidewalkMat);
      path.position.set(c.x, 0.13, c.z); path.rotation.y = rot; path.receiveShadow = true;
      scene.add(path);
    }
    const basin = shade(new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 1, 32), trimMat));
    basin.position.set(c.x, 0.5, c.z);
    scene.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.2, 32), new THREE.MeshPhongMaterial({ color: '#4fd1e0', shininess: 120 }));
    water.position.set(c.x, 0.95, c.z);
    scene.add(water);
    const column = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 4, 12), trimMat));
    column.position.set(c.x, 2.5, c.z);
    scene.add(column);
    collision.addBox(c.x - 7, c.z - 7, c.x + 7, c.z + 7, 1);
    footprints.push({ minX: c.x - 28, minZ: c.z - 28, maxX: c.x + 28, maxZ: c.z + 28, h: 0, color: '#7cc46a' });
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      palmAt(c.x + Math.cos(ang) * 17, c.z + Math.sin(ang) * 17, 9 + R() * 4);
    }
  }

  // --- The coast: promenade, beach, ocean, pier, wheel, lighthouse -------------------------
  const sandTex = makeSandTexture(R);
  sandTex.repeat.set(30, 120);
  const beachW = SHORE_X + 30 - (HALF + ROAD_HALF);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(beachW, 900), new THREE.MeshLambertMaterial({ map: sandTex }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(HALF + ROAD_HALF + beachW / 2, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const prom = new THREE.Mesh(new THREE.BoxGeometry(7, 0.18, 680), sidewalkMat);
  prom.position.set(HALF + ROAD_HALF + 3.5, 0.09, 0); prom.receiveShadow = true;
  scene.add(prom);
  for (let z = -330; z <= 330; z += 15) palmAt(BEACH_START, z, 9 + R() * 5);

  const oceanMat = new THREE.MeshPhongMaterial({ color: '#1fa2b8', shininess: 140, specular: 0xfff1d0, transparent: true, opacity: 0.94 });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(3000, 4000, 1, 1), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(SHORE_X + 1500, 0.12, 0);
  scene.add(ocean);
  const shallow = new THREE.Mesh(new THREE.PlaneGeometry(26, 900), new THREE.MeshPhongMaterial({ color: '#5fd6d0', transparent: true, opacity: 0.75, shininess: 80 }));
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.set(SHORE_X + 9, 0.14, 0);
  scene.add(shallow);
  const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 900), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(SHORE_X - 3, 0.16, 0);
  scene.add(foam);
  animated.push((t) => {
    foam.position.x = SHORE_X - 3 + Math.sin(t * 0.8) * 1.6;
    foamMat.opacity = 0.45 + Math.sin(t * 0.8 + 1) * 0.25;
  });

  // Driftwood Pier.
  const wood = new THREE.MeshLambertMaterial({ color: '#9b7653' });
  const deck = shade(new THREE.Mesh(new THREE.BoxGeometry(150, 0.5, 9), wood));
  deck.position.set(SHORE_X + 60, 1.8, 120);
  scene.add(deck);
  for (let x = SHORE_X - 10; x <= SHORE_X + 134; x += 9) {
    for (const o of [-4, 4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 6), wood);
      post.position.set(x, 0, 120 + o);
      scene.add(post);
    }
  }

  // The Sunbreak Wheel.
  const wheel = new THREE.Group();
  wheel.position.set(378, 24, -190);
  const steel = new THREE.MeshLambertMaterial({ color: '#f6f2ea' });
  for (const zo of [-1.6, 1.6]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(20, 0.35, 8, 48), steel);
    ring.position.z = zo;
    wheel.add(ring);
  }
  const gondolaColors = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b'];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.2, 20, 0.2), steel);
    spoke.position.set(Math.cos(a) * 10, Math.sin(a) * 10, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    const gond = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2.6), new THREE.MeshLambertMaterial({ color: gondolaColors[i % 6] }));
    gond.position.set(Math.cos(a) * 20, Math.sin(a) * 20 - 1.3, 0);
    gond.userData.gondola = true;
    wheel.add(gond);
  }
  wheel.rotation.y = Math.PI / 2;
  scene.add(wheel);
  for (const zo of [-6, 6]) for (const xo of [-8, 8]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 27, 8), steel);
    leg.position.set(378 + zo * 0.3, 12, -190 + xo);
    leg.rotation.x = xo > 0 ? -0.3 : 0.3;
    scene.add(leg);
  }
  collision.addBox(372, -200, 384, -180, 20);
  footprints.push({ minX: 372, minZ: -212, maxX: 384, maxZ: -168, h: 30, color: '#ffffff' });
  wheel.rotation.order = 'YXZ';
  animated.push((t) => {
    for (const ch of wheel.children) if (ch.userData.gondola) ch.rotation.z = -t * 0.06;
    wheel.rotation.z = t * 0.06;
  });

  // Lighthouse on Pelican Point's spit.
  const rock = shade(new THREE.Mesh(new THREE.CylinderGeometry(9, 13, 3, 10), new THREE.MeshLambertMaterial({ color: '#8d8579' })));
  rock.position.set(452, 0.5, -300);
  scene.add(rock);
  for (let i = 0; i < 6; i++) {
    const band = shade(new THREE.Mesh(new THREE.CylinderGeometry(2.6 - i * 0.15, 2.75 - i * 0.15, 4, 16),
      new THREE.MeshLambertMaterial({ color: i % 2 ? '#d62839' : '#fdfcf8' })));
    band.position.set(452, 4 + i * 4, -300);
    scene.add(band);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff3b0' }));
  lamp.position.set(452, 28, -300);
  scene.add(lamp);

  // Lifeguard huts and umbrellas.
  const hutColors = ['#ff6b6b', '#4cc9f0', '#ffd166', '#06d6a0'];
  for (let i = 0; i < 7; i++) {
    const z = -280 + i * 90 + (R() - 0.5) * 20;
    const hut = shade(new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), new THREE.MeshLambertMaterial({ color: hutColors[i % 4] })));
    hut.position.set(396, 3.6, z);
    scene.add(hut);
    for (const o of [[-1.2, -1.2], [1.2, 1.2], [-1.2, 1.2], [1.2, -1.2]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), steel);
      l.position.set(396 + o[0], 1.2, z + o[1]);
      scene.add(l);
    }
  }
  const umbrellaMats = hutColors.map((c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
  for (let i = 0; i < 40; i++) {
    const x = 350 + R() * 50, z = -320 + R() * 640;
    const top = shade(new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.8, 10, 1, true), rand.pick(umbrellaMats)));
    top.position.set(x, 2.5, z);
    scene.add(top);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4), steel);
    pole.position.set(x, 1.25, z);
    scene.add(pole);
  }

  // --- Instanced palms and lamps ---------------------------------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: '#8a6a4a' }), palms.length);
  const crowns = new THREE.InstancedMesh(palmCrownGeometry(), new THREE.MeshLambertMaterial({ color: '#3f9a46', side: THREE.DoubleSide }), palms.length);
  const crownColor = new THREE.Color();
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  palms.forEach((pl, i) => {
    e.set(pl.lean, pl.rot, pl.lean * 0.5);
    q.setFromEuler(e);
    mtx.compose(p.set(pl.x, 0, pl.z), q, s.set(1, pl.h, 1));
    trunks.setMatrixAt(i, mtx);
    const top = new THREE.Vector3(0, pl.h, 0).applyQuaternion(q);
    mtx.compose(p.set(pl.x + top.x, top.y, pl.z + top.z), q, s.set(1, 1, 1));
    crowns.setMatrixAt(i, mtx);
    crowns.setColorAt(i, crownColor.setHSL(0.27 + R() * 0.07, 0.5, 0.32 + R() * 0.12));
    if (pl.x < BEACH_START - 6 || pl.x > BEACH_START + 6) collision.addBox(pl.x - 0.35, pl.z - 0.35, pl.x + 0.35, pl.z + 0.35, pl.h);
  });
  trunks.castShadow = crowns.castShadow = true;
  scene.add(trunks, crowns);

  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 7, 6);
  poleGeo.translate(0, 3.5, 0);
  const poles = new THREE.InstancedMesh(poleGeo, darkMat, lamps.length);
  const headGeo = new THREE.BoxGeometry(0.5, 0.25, 1.6);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: '#fff2c4' }), lamps.length);
  lamps.forEach(([x, z], i) => {
    mtx.makeTranslation(x, 0, z);
    poles.setMatrixAt(i, mtx);
    mtx.makeTranslation(x, 7, z);
    heads.setMatrixAt(i, mtx);
  });
  scene.add(poles, heads);

  return {
    footprints,
    palms,
    update(t) { for (const fn of animated) fn(t); },
  };
}
