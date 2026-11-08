import * as THREE from 'three';
import { part, toon, outlined, INK } from './toon';

// Little cartoon props. Each faces +Z, stands on y = 0, ~1–1.6 units tall.

export function createPaperPlane() {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const nose = V(0, 0, 1.7);
  const spine = V(0, 0.02, -1.1);
  const wingL = V(-1.3, 0.16, -1.25);
  const wingR = V(1.3, 0.16, -1.25);
  const keel = V(0, -0.38, -1.0);
  const tris = [
    [nose, wingL, spine], [nose, spine, wingR], // wings (top)
    [nose, keel, spine], // keel
  ];
  const pos = [];
  tris.forEach((t) => t.forEach((v) => pos.push(v.x, v.y, v.z)));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, toon('#fbfaf6', { side: THREE.DoubleSide })));
  // Ink edges + a fold line down each wing
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 1),
    new THREE.LineBasicMaterial({ color: INK })
  );
  group.add(lines);
  const fold = new THREE.BufferGeometry().setFromPoints([
    nose, V(-0.65, 0.09, -1.18), nose, V(0.65, 0.09, -1.18),
  ]);
  group.add(new THREE.LineSegments(fold, new THREE.LineBasicMaterial({ color: '#c9c3d6' })));
  return group;
}

// Light pillar that marks a stop from far away
const beaconGeo = new THREE.CylinderGeometry(0.32, 0.32, 7, 24, 1, true);
beaconGeo.translate(0, 3.5, 0);
export function createBeacon(color) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.55 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
      void main(){
        float a = (1.0 - vUv.y) * (0.6 + 0.4 * sin(vUv.y * 18.0 - uTime * 3.0));
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
  });
  const mesh = new THREE.Mesh(beaconGeo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

// Floating diamond above each stop
export function createGem(color) {
  const g = outlined(new THREE.OctahedronGeometry(0.28, 0), toon(color, { emissive: color, emissiveIntensity: 0.35 }), 0.03);
  g.scale.y = 1.4;
  return g;
}

function academy() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(1.4, 0.6, 0.8), '#f4efe4', [0, 0.3, 0]));
  const roof = part(new THREE.ConeGeometry(0.95, 0.5, 4), '#d9534f', [0, 0.85, 0]);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.62;
  g.add(roof);
  // Thai gable spikes
  [-0.62, 0.62].forEach((x) => {
    const spike = part(new THREE.ConeGeometry(0.06, 0.32, 6), '#f2c94c', [x, 1.05, 0]);
    spike.rotation.z = x > 0 ? -0.5 : 0.5;
    g.add(spike);
  });
  [-0.4, 0, 0.4].forEach((x) => g.add(part(new THREE.BoxGeometry(0.2, 0.3, 0.05), '#5ea7e8', [x, 0.32, 0.41], 0.015)));
  // Flagpole
  g.add(part(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), '#7a6f7f', [0.85, 0.65, 0.3], 0.01));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), toon('#5ea7e8', { side: THREE.DoubleSide }));
  flag.position.set(1.06, 1.15, 0.3);
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

function city() {
  const g = new THREE.Group();
  [[-0.5, 1.2, '#7aa6d8'], [-0.1, 1.7, '#5c86c4'], [0.3, 1.0, '#9cc0e8'], [0.62, 1.35, '#6a95cf'], [0.05, 0.7, '#b9d3f0']].forEach(([x, h, c], i) => {
    g.add(part(new THREE.BoxGeometry(0.34, h, 0.34), c, [x, h / 2, (i % 2) * 0.35 - 0.15]));
  });
  // Antenna on the tall one
  g.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), '#2b2440', [-0.1, 1.95, 0.2], 0.01));
  // A little mortarboard on top of the city
  const cap = new THREE.Group();
  cap.add(part(new THREE.BoxGeometry(0.6, 0.05, 0.6), '#2b2440', [0, 0.18, 0], 0.015));
  cap.add(part(new THREE.CylinderGeometry(0.18, 0.2, 0.18, 12), '#2b2440', [0, 0.08, 0], 0.015));
  cap.add(part(new THREE.SphereGeometry(0.05, 8, 6), '#f2c94c', [0.25, 0.1, 0.25], 0.01));
  cap.position.set(0, 2.4, 0);
  cap.rotation.y = 0.6;
  g.add(cap);
  g.userData.spin = cap;
  return g;
}

function hangar() {
  const g = new THREE.Group();
  // Half cylinder: axis along Z, arched over the ground
  const shellGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.6, 20, 1, false, 0, Math.PI);
  shellGeo.rotateX(Math.PI / 2);
  shellGeo.rotateZ(Math.PI / 2);
  g.add(outlined(shellGeo, toon('#9bd08f', { side: THREE.DoubleSide }), 0.03));
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20, 0, Math.PI), toon('#2b2440'));
  door.position.set(0, 0, 0.81);
  g.add(door);
  // A paper plane parked outside
  const p = createPaperPlane();
  p.scale.setScalar(0.28);
  p.position.set(0.55, 0.12, 1.2);
  p.rotation.y = 0.5;
  g.add(p);
  g.add(part(new THREE.BoxGeometry(2.2, 0.04, 2.4), '#c9c3d6', [0, 0.02, 0.4], 0.01));
  return g;
}

function elephant() {
  const g = new THREE.Group();
  const C = '#f4a7bf';
  const body = part(new THREE.SphereGeometry(0.5, 20, 16), C, [0, 0.62, 0]);
  body.scale.set(1, 0.85, 1.2);
  g.add(body);
  g.add(part(new THREE.SphereGeometry(0.36, 20, 16), C, [0, 0.95, 0.55]));
  [-1, 1].forEach((s) => {
    const ear = part(new THREE.SphereGeometry(0.26, 16, 12), '#f08ca8', [s * 0.36, 1.0, 0.45]);
    ear.scale.set(0.35, 1, 0.9);
    g.add(ear);
    g.add(part(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 10), C, [s * 0.25, 0.2, 0.3]));
    g.add(part(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 10), C, [s * 0.25, 0.2, -0.3]));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: INK }));
    eye.position.set(s * 0.15, 1.03, 0.87);
    g.add(eye);
  });
  const trunk = part(new THREE.CapsuleGeometry(0.08, 0.38, 4, 8), C, [0, 0.72, 0.88]);
  trunk.rotation.x = 0.5;
  g.add(trunk);
  g.userData.bob = body;
  return g;
}

function ship() {
  const g = new THREE.Group();
  const hull = part(new THREE.BoxGeometry(0.8, 0.35, 2), '#d9534f', [0, 0.1, 0]);
  g.add(hull);
  g.add(part(new THREE.BoxGeometry(0.82, 0.08, 2.02), '#f4efe4', [0, 0.3, 0], 0.01));
  ['#5ea7e8', '#f2c94c', '#7cc576', '#e8a35a', '#a98be8', '#5ea7e8'].forEach((c, i) => {
    g.add(part(new THREE.BoxGeometry(0.32, 0.26, 0.42), c, [(i % 2) * 0.36 - 0.18, 0.47 + Math.floor(i / 4) * 0.27, -0.55 + (i % 3) * 0.45], 0.015));
  });
  g.add(part(new THREE.BoxGeometry(0.5, 0.5, 0.35), '#f4efe4', [0, 0.6, 0.78]));
  g.add(part(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 10), '#2b2440', [0, 1.0, 0.78], 0.015));
  g.userData.rock = g;
  return g;
}

function castle() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(1.1, 0.7, 0.8), '#cbbfe8', [0, 0.35, 0]));
  [[-0.6, -0.45], [0.6, -0.45], [-0.6, 0.45], [0.6, 0.45]].forEach(([x, z]) => {
    g.add(part(new THREE.CylinderGeometry(0.2, 0.22, 1.1, 12), '#b9a8e0', [x, 0.55, z]));
    g.add(part(new THREE.ConeGeometry(0.28, 0.45, 12), '#7b5fd1', [x, 1.32, z]));
  });
  g.add(part(new THREE.BoxGeometry(0.3, 0.4, 0.05), '#2b2440', [0, 0.2, 0.41], 0.01));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), toon('#f2c94c', { side: THREE.DoubleSide }));
  flag.position.set(0.76, 1.75, 0.45);
  g.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), '#2b2440', [0.6, 1.7, 0.45], 0.008));
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

function camera() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(1.3, 0.75, 0.5), '#2b2440', [0, 0.45, 0]));
  g.add(part(new THREE.BoxGeometry(1.32, 0.3, 0.52), '#d8d2c4', [0, 0.92, 0], 0.02));
  const lens = part(new THREE.CylinderGeometry(0.3, 0.33, 0.35, 24), '#3d3550', [0, 0.45, 0.4]);
  lens.rotation.x = Math.PI / 2;
  g.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshToonMaterial({ color: '#9fd8ff', emissive: '#3a7fb5', emissiveIntensity: 0.4 }));
  glass.position.set(0, 0.45, 0.58);
  g.add(glass);
  g.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12), '#ef7d6b', [0.42, 1.12, 0], 0.015));
  return g;
}

function lighthouse() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.75, 0.9, 0.25, 16), '#b7b0a2', [0, 0.12, 0]));
  [0, 1, 2].forEach((i) => {
    g.add(part(new THREE.CylinderGeometry(0.36 - i * 0.04, 0.4 - i * 0.04, 0.42, 16), i % 2 ? '#f4efe4' : '#ff6b5e', [0, 0.46 + i * 0.42, 0]));
  });
  g.add(part(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 12), '#fff3b0', [0, 1.6, 0]));
  g.add(part(new THREE.ConeGeometry(0.34, 0.35, 12), '#ff6b5e', [0, 1.93, 0]));
  // Rotating light cone
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 2.6, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  beam.geometry.translate(0, -1.3, 0);
  beam.rotation.z = Math.PI / 2;
  const pivot = new THREE.Group();
  pivot.position.y = 1.6;
  pivot.add(beam);
  g.add(pivot);
  g.userData.spin = pivot;
  return g;
}

const BUILDERS = { academy, city, hangar, elephant, ship, castle, camera, lighthouse };

export function createLandmark(kind) {
  return (BUILDERS[kind] ?? academy)();
}

// Animate whatever a landmark exposes in userData
export function animateLandmark(obj, t, i) {
  const u = obj.userData;
  if (u.flag) u.flag.rotation.y = Math.sin(t * 4 + i) * 0.35;
  if (u.spin) u.spin.rotation.y = t * 1.2;
  if (u.bob) u.bob.position.y = 0.62 + Math.sin(t * 3 + i) * 0.03;
  if (u.rock) u.rock.rotation.z = Math.sin(t * 1.4 + i) * 0.06;
}
