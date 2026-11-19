// Sunbreak Beach furniture: striped umbrellas, towels, loungers and lifeguard huts along the sand
// between the promenade and the surf, all instanced. The towel spots are where beach-goers settle
// (PedestrianSystem reads `spots`).
import * as THREE from 'three';
import { BEACH_START, SHORE_X } from './CityLayout.js';

const CANOPY_COLORS = ['#ff6b5a', '#19d3c5', '#ffd166', '#ff4fa0', '#7b5cff', '#ffffff', '#3d8bff'];
const TOWEL_COLORS = ['#ff6b5a', '#19d3c5', '#ffd166', '#ff9f1c', '#7dffa8', '#ff4fa0', '#ffffff', '#6ab7ff'];

// Keep the sand clear around the pier and the big wheel.
const blocked = (x, z) => Math.abs(z - 120) < 12 || Math.hypot(x - 378, z + 190) < 26;

export class BeachProps {
  constructor(scene, rand) {
    this.spots = [];
    const umbrellas = [], towels = [], loungers = [];
    for (let z = -315; z <= 315; z += 9 + rand.next() * 7) {
      // Clusters of two or three umbrellas across the sand at each step, in a loose band.
      const n = 1 + rand.int(0, 2);
      for (let k = 0; k < n; k++) {
        const x = BEACH_START + 12 + rand.next() * (SHORE_X - BEACH_START - 34);
        const zz = z + (rand.next() - 0.5) * 6;
        if (blocked(x, zz)) continue;
        umbrellas.push({ x, z: zz, tilt: (rand.next() - 0.5) * 0.25, color: rand.pick(CANOPY_COLORS) });
        const side = rand.chance(0.5) ? 1 : -1;
        towels.push({ x: x + 1.2 * side, z: zz + 0.6, rot: (rand.next() - 0.5) * 0.4, color: rand.pick(TOWEL_COLORS) });
        if (rand.chance(0.5)) towels.push({ x: x - 1.3 * side, z: zz - 0.4, rot: (rand.next() - 0.5) * 0.4, color: rand.pick(TOWEL_COLORS) });
        if (rand.chance(0.3)) loungers.push({ x: x + 2.4 * side, z: zz, rot: Math.PI / 2 });
        this.spots.push({ x: x + 1.2 * side, z: zz + 1.8 });
      }
    }
    this.umbrellas = umbrellas;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const fill = (mesh, list, place) => {
      list.forEach((it, i) => {
        place(it);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (it.color) mesh.setColorAt(i, color.set(it.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    };

    // Umbrella poles and eight-panel canopies (alternate panels tinted darker for stripes).
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 5), new THREE.MeshLambertMaterial({ color: '#e8e1cf' }), umbrellas.length);
    fill(poles, umbrellas, (u) => { dummy.position.set(u.x, 1.25, u.z); dummy.rotation.set(u.tilt, 0, u.tilt * 0.5); dummy.scale.set(1, 1, 1); });
    const canopyGeo = new THREE.ConeGeometry(1.9, 0.7, 8, 1, true);
    const shadeCol = [];
    const pos = canopyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      const stripe = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8 + 0.5) % 2;
      const top = pos.getY(i) > 0;
      const v = top ? 1 : stripe ? 1 : 0.62;
      shadeCol.push(v, v, v);
    }
    canopyGeo.setAttribute('color', new THREE.Float32BufferAttribute(shadeCol, 3));
    const canopies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), umbrellas.length);
    canopies.castShadow = true;
    fill(canopies, umbrellas, (u) => { dummy.position.set(u.x + u.tilt * 0.5, 2.5, u.z - u.tilt * 1.2); dummy.rotation.set(-u.tilt, u.x, u.tilt * 0.5); dummy.scale.set(1, 1, 1); });

    const towelMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.03, 1.9), new THREE.MeshLambertMaterial({ color: '#ffffff' }), towels.length);
    towelMesh.receiveShadow = true;
    fill(towelMesh, towels, (t) => { dummy.position.set(t.x, 0.05, t.z); dummy.rotation.set(0, t.rot, 0); dummy.scale.set(1, 1, 1); });

    // Loungers: a slatted bed with a raised back, as one merged-looking pair of instanced boxes.
    const bedMat = new THREE.MeshLambertMaterial({ color: '#f4efe6' });
    const beds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.12, 1.5), bedMat, loungers.length);
    fill(beds, loungers, (l) => { dummy.position.set(l.x, 0.35, l.z); dummy.rotation.set(0, l.rot, 0); dummy.scale.set(1, 1, 1); });
    const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), bedMat, loungers.length);
    fill(backs, loungers, (l) => { dummy.position.set(l.x - 0.95, 0.6, l.z); dummy.rotation.set(0, l.rot, 0); dummy.rotateX(-0.7); dummy.scale.set(1, 1, 1); });

    // Lifeguard huts on stilts every ~150 m.
    const hutMat = new THREE.MeshLambertMaterial({ color: '#ff6b5a' });
    const wood = new THREE.MeshLambertMaterial({ color: '#e8d7b4' });
    for (const z of [-260, -40, 60, 230]) {
      const x = SHORE_X - 22;
      const hut = new THREE.Group();
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2.6), hutMat);
      cabin.position.y = 3.6; cabin.castShadow = true;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 3.2), wood);
      roof.position.y = 4.8;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 3.6), wood);
      deck.position.y = 2.4;
      hut.add(cabin, roof, deck);
      for (const [sx, sz] of [[-1.5, -1.4], [1.5, -1.4], [-1.5, 1.4], [1.5, 1.4]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), wood);
        leg.position.set(sx, 1.2, sz);
        hut.add(leg);
      }
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 3.6), wood);
      ramp.position.set(-2.6, 1.2, 0); ramp.rotation.z = 0.6;
      hut.add(ramp);
      hut.position.set(x, 0, z);
      scene.add(hut);
    }
  }
}
