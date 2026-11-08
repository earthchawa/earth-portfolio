import * as THREE from 'three';
import { toon, outlined } from './toon';

export const R = 10; // planet radius

// Same mapping as THREE.SphereGeometry's UVs (u = 0 at lng −180)
export function latLngToVec3(lat, lng, target = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return target.set(-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
}

// Equirectangular land mask (land = dark pixels) → isLand(lat, lng) + the image itself
export function loadLandMask(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 720;
      const h = 360;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const isLand = (lat, lng) => {
        const x = Math.min(w - 1, Math.max(0, Math.floor(((lng + 180) / 360) * w)));
        const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
        return data[(y * w + x) * 4] < 128;
      };
      resolve({ img, isLand });
    };
    img.onerror = () => resolve({ img: null, isLand: () => false });
    img.src = url;
  });
}

// Paint a flat cartoon map: two-tone ocean, sandy coasts, green land, white caps
function paintTexture(img) {
  const w = 2048;
  const h = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#3fa7e0';
  ctx.fillRect(0, 0, w, h);
  if (!img) return c;

  // Land as an alpha mask (mask image: land dark → invert)
  const land = document.createElement('canvas');
  land.width = w;
  land.height = h;
  const lctx = land.getContext('2d');
  lctx.drawImage(img, 0, 0, w, h);
  const id = lctx.getImageData(0, 0, w, h);
  for (let i = 0; i < id.data.length; i += 4) {
    const isLand = id.data[i] < 128;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = 255;
    id.data[i + 3] = isLand ? 255 : 0;
  }
  lctx.putImageData(id, 0, 0);

  const tinted = (color, blur) => {
    const t = document.createElement('canvas');
    t.width = w;
    t.height = h;
    const tctx = t.getContext('2d');
    if (blur) tctx.filter = `blur(${blur}px)`;
    tctx.drawImage(land, 0, 0);
    tctx.filter = 'none';
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, w, h);
    return t;
  };

  ctx.drawImage(tinted('#6cc6ee', 14), 0, 0); // shallow water halo
  ctx.drawImage(tinted('#f3dfa2', 3), 0, 0); // beaches
  ctx.drawImage(tinted('#86cf6a', 0), 0, 0); // grass

  // Polar caps
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.07, 'rgba(255,255,255,0)');
  g.addColorStop(0.92, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

const _up = new THREE.Vector3(0, 1, 0);
// Place an object on the surface, standing up along the normal, facing `yaw`
export function placeOnSurface(obj, lat, lng, alt = 0, yaw = 0) {
  const n = latLngToVec3(lat, lng);
  obj.position.copy(n).multiplyScalar(R + alt);
  obj.quaternion.setFromUnitVectors(_up, n);
  obj.rotateY(yaw);
  return n;
}

export async function createPlanet(maskUrl, avoid = []) {
  const { img, isLand } = await loadLandMask(maskUrl);
  const group = new THREE.Group();

  const tex = new THREE.CanvasTexture(paintTexture(img));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sphere = outlined(new THREE.SphereGeometry(R, 96, 64), toon('#ffffff', { map: tex }), 0.08);
  group.add(sphere);

  // --- Trees and hills on land (instanced) ---
  const rand = mulberry32(7);
  const spots = [];
  for (let tries = 0; spots.length < 420 && tries < 20000; tries++) {
    const lat = THREE.MathUtils.radToDeg(Math.asin(rand() * 2 - 1));
    const lng = rand() * 360 - 180;
    if (Math.abs(lat) > 68 || !isLand(lat, lng)) continue;
    // keep stops clear
    const v = latLngToVec3(lat, lng);
    if (avoid.some((a) => a.angleTo(v) < 0.07)) continue;
    spots.push([lat, lng, v]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 5);
  trunkGeo.translate(0, 0.11, 0);
  const crownGeo = new THREE.ConeGeometry(0.2, 0.5, 7);
  crownGeo.translate(0, 0.42, 0);
  const blobGeo = new THREE.IcosahedronGeometry(0.22, 0);
  blobGeo.translate(0, 0.32, 0);

  const nPine = Math.floor(spots.length * 0.55);
  const trunks = new THREE.InstancedMesh(trunkGeo, toon('#8a5a3c'), spots.length);
  const pines = new THREE.InstancedMesh(crownGeo, toon('#3f9b54'), nPine);
  const blobs = new THREE.InstancedMesh(blobGeo, toon('#5bb85a'), spots.length - nPine);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  spots.forEach(([, , v], i) => {
    q.setFromUnitVectors(_up, v);
    const k = 0.7 + rand() * 0.8;
    s.set(k, k, k);
    m.compose(v.clone().multiplyScalar(R - 0.02), q, s);
    trunks.setMatrixAt(i, m);
    if (i < nPine) pines.setMatrixAt(i, m);
    else blobs.setMatrixAt(i - nPine, m);
  });
  group.add(trunks, pines, blobs);

  // --- Clouds: puffy clusters on a slowly turning shell ---
  const clouds = new THREE.Group();
  const puffGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const cloudMat = toon('#ffffff');
  for (let i = 0; i < 34; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) {
      const puff = outlined(puffGeo, cloudMat, 0.04);
      const sc = 0.6 + rand() * 0.6;
      puff.scale.setScalar(sc);
      puff.position.set((j - n / 2) * 0.55, rand() * 0.2, (rand() - 0.5) * 0.5);
      c.add(puff);
    }
    const lat = THREE.MathUtils.radToDeg(Math.asin(rand() * 1.8 - 0.9));
    const lng = rand() * 360 - 180;
    placeOnSurface(c, lat, lng, 3.2 + rand() * 1.6, rand() * Math.PI);
    c.scale.setScalar(0.8 + rand() * 0.6);
    clouds.add(c);
  }
  group.add(clouds);

  return {
    group,
    isLand,
    update(dt) {
      clouds.rotation.y += dt * 0.01;
    },
    dispose() {
      tex.dispose();
      [trunkGeo, crownGeo, blobGeo, puffGeo].forEach((g) => g.dispose());
    },
  };
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
