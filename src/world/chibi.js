import * as THREE from 'three';
import { part, toon, outlined, INK } from './toon';

// Chibi Earth: big head, short black hair, aviator goggles, Air Force blue
// jacket and a Thai-tea orange scarf. Faces +Z, sits on the plane's spine.
const SKIN = '#f6cfa8';
const HAIR = '#231c24';
const JACKET = '#3f6fb0';
const SCARF = '#e8a35a';
const GOGGLE = '#8a5a3c';

export function createChibi() {
  const root = new THREE.Group();

  // --- Body (sitting) ---
  const body = part(new THREE.CapsuleGeometry(0.2, 0.18, 6, 16), JACKET, [0, 0.28, 0]);
  root.add(body);
  // Collar / chest badge
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), toon('#f2c94c'));
  badge.position.set(0.09, 0.36, 0.195);
  root.add(badge);

  // Arms on shoulder pivots, resting forward on the plane; the right one can wave
  const shoulders = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.21, 0.4, 0);
    const arm = part(new THREE.CapsuleGeometry(0.06, 0.2, 4, 10), JACKET, [0, -0.12, 0]);
    pivot.add(arm);
    pivot.add(part(new THREE.SphereGeometry(0.065, 12, 10), SKIN, [0, -0.27, 0]));
    pivot.rotation.x = -1.1; // reach forward
    root.add(pivot);
    return pivot;
  });
  const waveArm = shoulders[0];

  // --- Head ---
  const head = new THREE.Group();
  head.position.set(0, 0.78, 0);
  root.add(head);

  head.add(part(new THREE.SphereGeometry(0.4, 32, 24), SKIN, [0, 0, 0], 0.035));

  // Hair: a cap over the back/top + a soft fringe
  const hairCap = outlined(
    new THREE.SphereGeometry(0.43, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
    toon(HAIR),
    0.03
  );
  hairCap.rotation.x = -0.35;
  hairCap.position.set(0, 0.03, -0.02);
  head.add(hairCap);
  const fringeGeo = new THREE.SphereGeometry(0.13, 12, 10);
  [[-0.2, 0.22, 0.27], [-0.05, 0.27, 0.3], [0.11, 0.26, 0.29], [0.24, 0.19, 0.25]].forEach((p, i) => {
    const f = part(fringeGeo, HAIR, p, 0.02);
    f.scale.set(1, 0.7, 0.75);
    f.rotation.z = (i - 1.5) * 0.3;
    head.add(f);
  });
  // Side hair
  [-1, 1].forEach((s) => {
    const side = part(new THREE.SphereGeometry(0.14, 12, 10), HAIR, [s * 0.36, 0.02, -0.02], 0.02);
    side.scale.set(0.5, 1, 0.9);
    head.add(side);
  });

  // Eyes with highlights
  const eyeGeo = new THREE.SphereGeometry(0.055, 16, 12);
  const eyeMat = new THREE.MeshBasicMaterial({ color: INK });
  const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyes = [];
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(0.85, 1.25, 0.5);
    eye.position.set(s * 0.14, -0.02, 0.37);
    head.add(eye);
    eyes.push(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), shineMat);
    shine.position.set(s * 0.14 + 0.018, 0.015, 0.405);
    head.add(shine);
    // Blush
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: '#f59a9a', transparent: true, opacity: 0.6 }));
    blush.position.set(s * 0.24, -0.11, 0.335);
    blush.rotation.y = s * 0.5;
    head.add(blush);
  });

  // Smile
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.012, 6, 16, Math.PI),
    new THREE.MeshBasicMaterial({ color: INK })
  );
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.1, 0.385);
  head.add(smile);

  // Aviator goggles pushed up on the forehead + strap
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.025, 8, 40), toon(GOGGLE));
  strap.rotation.x = Math.PI / 2 - 0.35;
  strap.position.y = 0.17;
  head.add(strap);
  [-1, 1].forEach((s) => {
    const rim = part(new THREE.TorusGeometry(0.075, 0.03, 8, 20), GOGGLE, [s * 0.11, 0.3, 0.33], 0.015);
    rim.rotation.x = -0.6;
    head.add(rim);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 20),
      new THREE.MeshToonMaterial({ color: '#9fd8ff', emissive: '#3a7fb5', emissiveIntensity: 0.3 })
    );
    lens.position.set(s * 0.11, 0.3, 0.335);
    lens.rotation.x = -0.6;
    head.add(lens);
  });

  // --- Scarf: a wrap + a tail that flutters behind ---
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.06, 8, 24), toon(SCARF));
  wrap.rotation.x = Math.PI / 2;
  wrap.position.y = 0.47;
  root.add(wrap);

  const SEG = 10;
  const tailGeo = new THREE.PlaneGeometry(0.16, 0.7, 1, SEG);
  tailGeo.translate(0, -0.35, 0);
  tailGeo.rotateX(-Math.PI / 2); // lies flat, trailing toward -Z
  const tail = new THREE.Mesh(tailGeo, toon(SCARF, { side: THREE.DoubleSide }));
  tail.position.set(0.1, 0.48, -0.15);
  root.add(tail);
  const tailBase = tailGeo.attributes.position.array.slice();

  let blink = 2;
  return {
    object: root,
    head,
    // speed 0–1, bank −1..1
    update(t, dt, { speed = 0.5, bank = 0, happy = 0, wave = 0 }) {
      // Wave hello: swing the arm up and side to side
      waveArm.rotation.x = THREE.MathUtils.lerp(-1.1, -2.6, wave);
      waveArm.rotation.z = wave * (-0.5 + Math.sin(t * 9) * 0.45);

      // Scarf wave grows with speed
      const pos = tailGeo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        const along = -tailBase[i + 2]; // 0 at the neck → 0.7 at the tip
        pos[i + 1] = tailBase[i + 1] + Math.sin(t * 12 - along * 9) * along * (0.08 + speed * 0.12);
        pos[i] = tailBase[i] + Math.sin(t * 7 - along * 5) * along * 0.05;
      }
      tailGeo.attributes.position.needsUpdate = true;
      tailGeo.computeVertexNormals();

      // Lean into turns, little bob, look around when idle
      head.rotation.z = -bank * 0.35 + Math.sin(t * 1.3) * 0.04;
      head.rotation.y = Math.sin(t * 0.7) * 0.25 * (1 - Math.abs(bank));
      head.rotation.x = -0.05 + Math.sin(t * 2.1) * 0.03 - happy * 0.15;
      root.position.y = Math.sin(t * 3) * 0.02 + happy * Math.abs(Math.sin(t * 14)) * 0.08;

      // Blink every few seconds
      blink -= dt;
      const closed = blink < 0.12;
      eyes.forEach((e) => { e.scale.y = closed ? 0.15 : 1.25; });
      if (blink < 0) blink = 2 + Math.random() * 3;
    },
  };
}
