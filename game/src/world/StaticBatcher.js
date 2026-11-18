// Merges the city's static meshes into one mesh per material, cutting thousands of draw calls
// down to a few dozen. Also hosts the geometry-merging helper the car models use.
import * as THREE from 'three';

// Join geometries into one (positions, normals, uvs); one draw group per source when asked.
export function mergeGeometries(geos, groups = false) {
  let verts = 0;
  for (const g of geos) verts += g.attributes.position.count;
  const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), uv = new Float32Array(verts * 2);
  const index = [];
  const out = new THREE.BufferGeometry();
  let off = 0;
  geos.forEach((g, gi) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
    const start = index.length;
    if (g.index) for (const i of g.index.array) index.push(i + off);
    else for (let i = 0; i < n; i++) index.push(i + off);
    if (groups) out.addGroup(start, index.length - start, gi);
    off += n;
  });
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(index);
  out.computeBoundingSphere();
  return out;
}

// Split a multi-material mesh's geometry into one geometry per material slot.
function piecesOf(mesh) {
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrix);
  if (!Array.isArray(mesh.material)) return [[mesh.material, g]];
  const out = [];
  for (const grp of g.groups) {
    const piece = g.clone();
    const idx = g.index.array.slice(grp.start, grp.start + grp.count);
    piece.setIndex(Array.from(idx));
    piece.clearGroups();
    out.push([mesh.material[grp.materialIndex], piece]);
  }
  return out;
}

export function batchStaticMeshes(scene, fromIndex) {
  const candidates = scene.children.slice(fromIndex).filter((o) => o.isMesh && !o.isInstancedMesh && !o.userData.dynamic);
  const buckets = new Map();
  for (const m of candidates) {
    m.updateMatrix();
    for (const [mat, geo] of piecesOf(m)) {
      const key = `${mat.uuid}|${m.castShadow}|${m.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, { mat, cast: m.castShadow, receive: m.receiveShadow, geos: [] });
      buckets.get(key).geos.push(geo);
    }
    scene.remove(m);
  }
  for (const b of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }
  return { before: candidates.length, after: buckets.size };
}
