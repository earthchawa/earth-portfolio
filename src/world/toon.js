import * as THREE from 'three';

// 3-step cel shading shared by every toon material
let gradient = null;
function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 170, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map();
export function toon(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra }));
  }
  return cache.get(key);
}

export const INK = '#2b2440';
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

// Cartoon outline: a slightly fatter back-face copy drawn in ink
export function outlined(geometry, material, thickness = 0.04) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  geometry.computeBoundingSphere();
  const r = geometry.boundingSphere.radius || 1;
  const shell = new THREE.Mesh(geometry, inkMat);
  shell.scale.setScalar(1 + thickness / r);
  // keep the shell centred on the geometry's own centre
  const c = geometry.boundingSphere.center;
  shell.position.copy(c).multiplyScalar(-(thickness / r));
  group.add(shell);
  group.userData.mesh = mesh;
  return group;
}

// Shorthand: outlined mesh at a position
export function part(geometry, color, pos = [0, 0, 0], thickness = 0.03) {
  const g = outlined(geometry, toon(color), thickness);
  g.position.set(...pos);
  return g;
}

export function disposeAll() {
  cache.forEach((m) => m.dispose());
  cache.clear();
  inkMat.dispose();
  gradient?.dispose();
  gradient = null;
}
