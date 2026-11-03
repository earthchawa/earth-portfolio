import * as THREE from 'three';

const TAU = Math.PI * 2;
const jitter = (s) => (Math.random() - 0.5) * s;
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();

// Pulsing markers on the globe: [lat, lng, kind] — kind 2 = orange, 3 = blue
export const MARKERS = [
  [14.53, 100.91, 2], // Saraburi
  [41.88, -87.63, 3], // Chicago
];

function latLngToVec3(lat, lng, target = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return target.set(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  );
}

function pointInTriangle(a, b, c, target) {
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) { u = 1 - u; v = 1 - v; }
  _ab.subVectors(b, a);
  _ac.subVectors(c, a);
  return target.copy(a).addScaledVector(_ab, u).addScaledVector(_ac, v);
}

export function loadLandMask(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 720;
      const h = 360;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      resolve((lat, lng) => {
        const x = Math.min(w - 1, Math.floor(((lng + 180) / 360) * w));
        const y = Math.min(h - 1, Math.floor(((90 - lat) / 180) * h));
        return data[(y * w + x) * 4] < 128;
      });
    };
    img.onerror = () => {
      console.warn('[globe] land mask not found — using plain sphere');
      resolve(null);
    };
    img.src = url;
  });
}

// Scene 0 — Dotted Earth + markers
// kind: 0 land · 1 ocean · 2/3 marker
function globe(n, isLand, r = 2.4) {
  const pos = new Float32Array(n * 3);
  const kind = new Float32Array(n);
  let k = 0;
  const put = (v, type) => {
    pos[k * 3] = v.x;
    pos[k * 3 + 1] = v.y;
    pos[k * 3 + 2] = v.z;
    kind[k] = type;
    k++;
  };

  const perMarker = Math.floor(n * 0.015);
  const surfaceN = n - perMarker * MARKERS.length;

  const land = [];
  const ocean = [];
  const CANDIDATES = 30000;
  const golden = 180 * (3 - Math.sqrt(5));
  for (let i = 0; i < CANDIDATES; i++) {
    const lat = THREE.MathUtils.radToDeg(Math.asin(1 - (2 * (i + 0.5)) / CANDIDATES));
    const lng = ((i * golden) % 360) - 180;
    const v = latLngToVec3(lat, lng).multiplyScalar(r);
    (!isLand || isLand(lat, lng) ? land : ocean).push(v);
  }

  const oceanN = ocean.length ? Math.floor(surfaceN * 0.15) : 0;
  const landN = surfaceN - oceanN;
  for (let i = 0; i < landN; i++) put(land[Math.floor((i * land.length) / landN)], 0);
  for (let i = 0; i < oceanN; i++) put(ocean[Math.floor((i * ocean.length) / oceanN)], 1);

  const v = new THREE.Vector3();
  MARKERS.forEach(([lat, lng, type]) => {
    const c = latLngToVec3(lat, lng);
    for (let i = 0; i < perMarker; i++) {
      v.set(c.x + jitter(0.06), c.y + jitter(0.06), c.z + jitter(0.06))
        .normalize()
        .multiplyScalar(r * 1.02);
      put(v, type);
    }
  });

  return { pos, kind };
}

// Scene 1 — Paper Plane
function paperPlane(n) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const nose = V(2.8, 0, 0);
  const spine = V(-1.8, 0.2, 0);
  const keel = V(-1.8, -0.7, 0);
  const wingL = V(-2.0, 0.35, -1.7);
  const wingR = V(-2.0, 0.35, 1.7);

  const euler = new THREE.Euler(0.35, -0.7, 0.15);
  const out = new Float32Array(n * 3);
  const p = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    const k = i % 5;
    const tri = k < 2 ? [nose, spine, wingL] : k < 4 ? [nose, spine, wingR] : [nose, spine, keel];
    pointInTriangle(tri[0], tri[1], tri[2], p).applyEuler(euler);
    out.set([p.x, p.y, p.z], i * 3);
  }
  return out;
}

// Scene 2 — </>
function codeBrackets(n) {
  const segs = [
    [[-1.3, 1.1], [-2.5, 0]], [[-2.5, 0], [-1.3, -1.1]],
    [[0.55, 1.5], [-0.55, -1.5]],
    [[1.3, 1.1], [2.5, 0]], [[2.5, 0], [1.3, -1.1]],
  ];
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [[x1, y1], [x2, y2]] = segs[i % segs.length];
    const t = Math.random();
    out.set([
      x1 + (x2 - x1) * t + jitter(0.12),
      y1 + (y2 - y1) * t + jitter(0.12),
      jitter(0.5),
    ], i * 3);
  }
  return out;
}

// Scene 3 — 35mm Lens (outer rings only → text sits inside the "aperture")
function lensRings(n) {
  const rings = [2.6, 2.3, 2.0];
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const idx = i % rings.length;
    const a = Math.random() * TAU;
    const r = rings[idx] + jitter(0.06);
    out.set([Math.cos(a) * r, Math.sin(a) * r, -idx * 0.3], i * 3);
  }
  return out;
}

// Scene 4 — Graduation Cap (About page)
function gradCap(n) {
  const out = new Float32Array(n * 3);
  const p = new THREE.Vector3();
  const euler = new THREE.Euler(0.5, -0.6, 0.08);
  const half = 1.7;
  const c45 = Math.SQRT1_2;
  const corner = half * 2 * c45; // tip of the diamond-shaped board

  for (let i = 0; i < n; i++) {
    const k = Math.random();
    if (k < 0.55) {
      // Board (square rotated 45°)
      const a = (Math.random() * 2 - 1) * half;
      const b = (Math.random() * 2 - 1) * half;
      p.set((a - b) * c45, 0.9 + jitter(0.04), (a + b) * c45);
    } else if (k < 0.8) {
      // Skull cap
      const ang = Math.random() * TAU;
      const y = Math.random();
      const rad = 1.0 + y * 0.12;
      p.set(Math.cos(ang) * rad, y * 0.9, Math.sin(ang) * rad);
    } else if (k < 0.83) {
      // Button
      p.set(jitter(0.15), 0.95 + Math.random() * 0.06, jitter(0.15));
    } else if (k < 0.9) {
      // Cord across the board
      const t = Math.random();
      p.set(corner * t + jitter(0.03), 0.95 - t * 0.03, jitter(0.03));
    } else if (k < 0.94) {
      // Cord hanging down
      const t = Math.random();
      p.set(corner + jitter(0.03), 0.9 - t * 1.1, jitter(0.03));
    } else {
      // Tassel
      const t = Math.random();
      const ang = Math.random() * TAU;
      const spread = (0.06 + t * 0.2) * Math.random();
      p.set(corner + Math.cos(ang) * spread, -0.2 - t * 0.7, Math.sin(ang) * spread);
    }
    p.x -= 0.4;
    p.y -= 0.3;
    p.applyEuler(euler);
    out.set([p.x, p.y, p.z], i * 3);
  }
  return out;
}

export function createShapes(n, isLand) {
  const g = globe(n, isLand);
  return {
    globe: g.pos,
    kind: g.kind,
    plane: paperPlane(n),
    code: codeBrackets(n),
    lens: lensRings(n),
    cap: gradCap(n),
  };
}