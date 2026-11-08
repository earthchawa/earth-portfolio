import * as THREE from 'three';
import { R, createPlanet, latLngToVec3, placeOnSurface } from './planet';
import { createChibi } from './chibi';
import { createPaperPlane, createBeacon, createGem, createLandmark, animateLandmark } from './models';
import { part, disposeAll } from './toon';

const ALT = { min: 0.9, max: 4.2, start: 1.9 };
const SPEED = { cruise: 3.2, boost: 7, autopilot: 8.5 };
const TURN_RATE = 1.7; // rad/s at full stick
const NEAR = 0.1; // rad — how close counts as "arrived"
const LEAVE = 0.16; // rad — must get this far before a stop can trigger again
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);

// Rotate unit vectors p (position) and f (heading) forward along the great circle
const _axis = new THREE.Vector3();
function advance(p, f, angle) {
  _axis.crossVectors(p, f).normalize();
  p.applyAxisAngle(_axis, angle).normalize();
  f.applyAxisAngle(_axis, angle).normalize();
}

/**
 * The flyable world.
 * opts: { canvas, labelsEl, stops, start, maskUrl, onReady, onArrive(id), onAutopilot(id|null) }
 */
export function createWorld(opts) {
  const { canvas, labelsEl, stops, start, maskUrl } = opts;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = () => window.innerWidth < 768;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall() ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(isSmall() ? 62 : 52, window.innerWidth / window.innerHeight, 0.1, 200);

  scene.add(new THREE.HemisphereLight('#e6f4ff', '#8c7bb8', 1.5));
  const sun = new THREE.DirectionalLight('#fff3dc', 2.2);
  scene.add(sun, sun.target);

  // --- Craft: paper plane + chibi ---
  const craft = new THREE.Group();
  const tilt = new THREE.Group(); // bank/pitch live here so the basis math stays clean
  craft.add(tilt);
  tilt.add(createPaperPlane());
  const chibi = createChibi();
  chibi.object.scale.setScalar(0.85);
  chibi.object.position.set(0, 0.02, -0.25);
  tilt.add(chibi.object);
  craft.scale.setScalar(0.55);
  scene.add(craft);

  // Contrail puffs (instanced, they shrink away)
  const PUFFS = 70;
  const puffMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), PUFFS);
  puffMesh.frustumCulled = false;
  scene.add(puffMesh);
  const puffs = Array.from({ length: PUFFS }, () => ({ pos: new THREE.Vector3(), life: 0 }));
  let puffIdx = 0;
  let puffTimer = 0;

  // Confetti when a stop is found
  const CONF = 80;
  const confMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: '#ffffff' }), CONF);
  confMesh.frustumCulled = false;
  const confColors = ['#e8a35a', '#5ea7e8', '#f08ca8', '#f2c94c', '#7cc576', '#a98be8'].map((c) => new THREE.Color(c));
  const conf = Array.from({ length: CONF }, (_, i) => {
    confMesh.setColorAt(i, confColors[i % confColors.length]);
    return { pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, spin: Math.random() * 6 };
  });
  scene.add(confMesh);

  // --- State ---
  const p = latLngToVec3(start.lat, start.lng);
  const f = new THREE.Vector3();
  {
    const target = stops.find((s) => s.id === start.toward);
    const t = latLngToVec3(target.lat, target.lng);
    f.copy(t).addScaledVector(p, -p.dot(t)).normalize();
  }
  const state = {
    flying: false,
    paused: false,
    alt: ALT.start,
    speed: 0,
    bank: 0,
    pitch: 0,
    intro: 1, // 1 = orbit view, 0 = chase view
    show: 0, // 1 = camera swung round to the front while a card is open
    introSpin: 0,
    happy: 0,
    autopilot: null,
    disposed: false,
  };
  const input = { turn: 0, climb: 0, boost: false };
  const keys = new Set();

  // --- Stops ---
  const stopObjs = stops.map((s) => ({ ...s, normal: latLngToVec3(s.lat, s.lng), inside: false, found: false }));
  let planet = null;

  function buildStops(isLand) {
    stopObjs.forEach((s, i) => {
      const holder = new THREE.Group();
      placeOnSurface(holder, s.lat, s.lng, 0, i * 1.3);
      const model = createLandmark(s.model);
      holder.add(model);
      s.model3d = model;
      if (s.model !== 'ship' && !isLand(s.lat, s.lng)) {
        // A little island to stand on
        holder.add(part(new THREE.CylinderGeometry(1.5, 1.8, 0.35, 20), '#f3dfa2', [0, -0.1, 0.2], 0.03));
        holder.add(part(new THREE.CylinderGeometry(1.25, 1.4, 0.2, 20), '#86cf6a', [0, 0.05, 0.2], 0.02));
      }
      if (s.model === 'ship') model.position.y = -0.05;
      const beacon = createBeacon(s.color);
      holder.add(beacon);
      const gem = createGem(s.color);
      gem.position.y = 2.9;
      holder.add(gem);
      s.beacon = beacon;
      s.gem = gem;
      s.holder = holder;
      scene.add(holder);

      // Floating name tag (DOM)
      const tag = document.createElement('div');
      tag.className = 'world-tag';
      tag.style.setProperty('--c', s.color);
      tag.innerHTML = `<span class="world-tag__dot"></span><span class="world-tag__name"></span>`;
      tag.querySelector('.world-tag__name').textContent = s.title;
      labelsEl?.appendChild(tag);
      s.tag = tag;
    });
  }

  createPlanet(maskUrl, stopObjs.map((s) => s.normal)).then((pl) => {
    if (state.disposed) { pl.dispose(); return; }
    planet = pl;
    scene.add(pl.group);
    buildStops(pl.isLand);
    opts.onReady?.();
  });

  // --- Input: keyboard ---
  const KEYMAP = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ' ': 'boost', Shift: 'boost',
  };
  const onKeyDown = (e) => {
    const k = KEYMAP[e.key];
    if (!k || !state.flying) return;
    if (e.target.closest?.('input, textarea')) return;
    e.preventDefault();
    keys.add(k);
    cancelAutopilot();
  };
  const onKeyUp = (e) => { const k = KEYMAP[e.key]; if (k) keys.delete(k); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // --- Input: drag anywhere on the canvas (touch + mouse) ---
  const drag = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
  const onPointerDown = (e) => {
    if (!state.flying || drag.id !== null) return;
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.dx = drag.dy = 0;
    canvas.setPointerCapture?.(e.pointerId);
    opts.onStick?.({ x: e.clientX, y: e.clientY, dx: 0, dy: 0, active: true });
  };
  const onPointerMove = (e) => {
    if (e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    if (Math.hypot(drag.dx, drag.dy) > 8) cancelAutopilot();
    opts.onStick?.({ x: drag.x, y: drag.y, dx: drag.dx, dy: drag.dy, active: true });
  };
  const onPointerUp = (e) => {
    if (e.pointerId !== drag.id) return;
    drag.id = null;
    drag.dx = drag.dy = 0;
    opts.onStick?.({ active: false });
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  function readInput() {
    const stick = 70; // px for full deflection
    const dragTurn = drag.id !== null ? clamp(drag.dx / stick, -1, 1) : 0;
    const dragClimb = drag.id !== null ? clamp(-drag.dy / stick, -1, 1) : 0;
    input.turn = clamp((keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0) + dragTurn, -1, 1);
    input.climb = clamp((keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0) + dragClimb, -1, 1);
    input.boost = keys.has('boost');
  }

  function cancelAutopilot() {
    if (state.autopilot) {
      state.autopilot = null;
      opts.onAutopilot?.(null);
    }
  }

  // --- Effects ---
  function burst(at) {
    for (let i = 0; i < CONF; i++) {
      const c = conf[i];
      c.pos.copy(at);
      c.vel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 3);
      c.vel.addScaledVector(at.clone().normalize(), 3);
      c.life = 1.4 + Math.random() * 0.6;
    }
  }

  // --- Loop ---
  let last = performance.now();
  let t = 0;
  const m4 = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const back = new THREE.Vector3();
  const craftPos = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    readInput();

    // --- Flight ---
    let turn = input.turn;
    let climb = input.climb;
    let target = state.flying && !state.paused ? (input.boost ? SPEED.boost : SPEED.cruise) : 0;
    let turnGain = 1;

    if (state.autopilot && state.flying && !state.paused) {
      const s = stopObjs.find((o) => o.id === state.autopilot);
      const want = tmp.copy(s.normal).addScaledVector(p, -p.dot(s.normal)).normalize();
      const side = tmp2.crossVectors(f, want).dot(p);
      const ang = f.angleTo(want);
      // f rotates by −turn around p, so a target on the +side needs a negative turn
      turn = clamp(-Math.sign(side) * ang * 2.2, -1, 1);
      climb = clamp((ALT.start - state.alt) * 2, -1, 1);
      // Slow down and turn tighter on approach so it lands instead of circling the beacon
      const dist = p.angleTo(s.normal);
      target = dist < 0.4 ? THREE.MathUtils.lerp(SPEED.cruise * 0.55, SPEED.autopilot, dist / 0.4) : SPEED.autopilot;
      turnGain = dist < 0.4 ? 2.5 : 1.2;
    }

    state.speed = damp(state.speed, target, 2.5, dt);
    if (state.speed > 0.01) {
      f.applyAxisAngle(p, -turn * TURN_RATE * turnGain * dt * clamp(state.speed / SPEED.cruise, 0.4, 1.2));
      advance(p, f, (state.speed * dt) / (R + state.alt));
    }
    state.alt = clamp(state.alt + climb * 1.6 * dt, ALT.min, ALT.max);
    state.bank = damp(state.bank, turn * (state.speed > 0.5 ? 0.7 : 0.15), 6, dt);
    state.pitch = damp(state.pitch, climb * 0.3, 5, dt);

    // Orient craft: up = p, forward = f
    craftPos.copy(p).multiplyScalar(R + state.alt + Math.sin(t * 2) * 0.05);
    right.crossVectors(p, f); // basis must stay right-handed: x = y × z
    m4.makeBasis(right, p, f);
    craft.quaternion.setFromRotationMatrix(m4);
    craft.position.copy(craftPos);
    tilt.rotation.set(-state.pitch, 0, state.bank + (state.paused ? Math.sin(t * 1.5) * 0.08 : 0));

    state.happy = Math.max(0, state.happy - dt);
    chibi.update(t, dt, { speed: state.speed / SPEED.boost, bank: state.bank, happy: state.happy > 0 ? 1 : 0, wave: state.show });

    // --- Contrails ---
    puffTimer -= dt;
    if (state.speed > 1 && puffTimer <= 0) {
      puffTimer = 0.035;
      [-1, 1].forEach((sgn) => {
        const pf = puffs[puffIdx];
        pf.pos.set(sgn * 1.25, 0.16, -1.2);
        tilt.localToWorld(pf.pos);
        pf.life = 1;
        puffIdx = (puffIdx + 1) % PUFFS;
      });
    }
    puffs.forEach((pf, i) => {
      pf.life = Math.max(0, pf.life - dt * 1.1);
      dummy.position.copy(pf.pos);
      dummy.scale.setScalar(pf.life * (1.4 - pf.life * 0.6) * 1.2);
      dummy.updateMatrix();
      puffMesh.setMatrixAt(i, dummy.matrix);
    });
    puffMesh.instanceMatrix.needsUpdate = true;

    // --- Confetti ---
    conf.forEach((c, i) => {
      if (c.life > 0) {
        c.life -= dt;
        c.vel.addScaledVector(tmp.copy(c.pos).normalize(), -6 * dt);
        c.pos.addScaledVector(c.vel, dt);
      }
      dummy.position.copy(c.pos);
      dummy.rotation.set(t * c.spin, t * 2, 0);
      dummy.scale.setScalar(c.life > 0 ? Math.min(1, c.life) : 0);
      dummy.updateMatrix();
      confMesh.setMatrixAt(i, dummy.matrix);
    });
    confMesh.instanceMatrix.needsUpdate = true;

    // --- Stops: animate, arrive, tags ---
    let nearest = null;
    stopObjs.forEach((s, i) => {
      if (!s.holder) return;
      animateLandmark(s.model3d, t, i);
      s.gem.rotation.y = t * 1.5;
      s.gem.position.y = 2.9 + Math.sin(t * 2 + i) * 0.15;
      s.beacon.material.uniforms.uTime.value = t;
      s.beacon.material.uniforms.uOpacity.value = s.found ? 0.18 : 0.55;

      const d = p.angleTo(s.normal);
      if (d > LEAVE) s.inside = false;
      // On autopilot only the chosen stop counts, so it doesn't stop at every one on the way
      const eligible = !state.autopilot || state.autopilot === s.id;
      if (state.flying && !state.paused && eligible && d < NEAR && !s.inside && (!nearest || d < nearest.d)) nearest = { s, d };

      // Tag position
      if (s.tag) {
        s.gem.getWorldPosition(tmp);
        tmp.addScaledVector(s.normal, 0.7);
        const facing = tmp2.copy(camera.position).sub(tmp).dot(s.normal) > -2;
        const dist = camera.position.distanceTo(tmp);
        tmp.project(camera);
        const visible = state.intro < 0.5 && facing && tmp.z < 1 && dist < 26;
        s.tag.style.opacity = visible ? String(clamp((26 - dist) / 8, 0, 1)) : '0';
        s.tag.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * window.innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%)`;
        s.tag.classList.toggle('is-found', s.found);
      }
    });

    if (nearest) {
      const s = nearest.s;
      s.inside = true;
      if (!s.found) {
        s.found = true;
        s.gem.getWorldPosition(tmp);
        burst(tmp);
        state.happy = 1.6;
      }
      if (state.autopilot) { state.autopilot = null; opts.onAutopilot?.(null); }
      opts.onArrive?.(s.id);
    }

    // --- Camera ---
    state.intro = damp(state.intro, state.flying ? 0 : 1, reduceMotion ? 50 : 1.6, dt);
    if (!state.flying) state.introSpin += dt * 0.08;
    const k = state.intro;
    const small = isSmall();
    // Chase ↔ showcase: orbit around the plane (never through it). yaw π = behind,
    // yaw ~0.5 = in front and to the side, so you can see Earth wave while a card is open
    state.show = damp(state.show, state.paused && state.flying ? 1 : 0, reduceMotion ? 50 : 2.4, dt);
    const sh = state.show;
    const ease = sh * sh * (3 - 2 * sh);
    const yaw = THREE.MathUtils.lerp(Math.PI, small ? 0.25 : 0.55, ease);
    const dist = THREE.MathUtils.lerp((small ? 5.4 : 4.6) + state.speed * 0.12, small ? 4.4 : 3.1, ease);
    const height = THREE.MathUtils.lerp(small ? 2.3 : 1.9, small ? 0.9 : 0.6, ease);
    camPos.copy(craftPos)
      .addScaledVector(p, height)
      .addScaledVector(f, Math.cos(yaw) * dist)
      .addScaledVector(right, Math.sin(yaw) * dist);
    // Orbit view (intro): far out, looking at the planet with the plane in view
    tmp.copy(p).applyAxisAngle(f, 0.35).applyAxisAngle(p, state.introSpin).multiplyScalar(R * (small ? 3.6 : 2.6));
    camera.position.lerpVectors(camPos, tmp, k);
    // Look ahead of the plane while chasing; at the plane (offset clear of the card) in showcase
    camLook.copy(craftPos).addScaledVector(f, 2.5).addScaledVector(p, 0.4);
    back.copy(craftPos).addScaledVector(p, small ? -0.75 : 0.25);
    if (!small) back.addScaledVector(right, 1.2);
    camLook.lerp(back, ease);
    tmp2.set(0, 0, 0).lerp(camLook, 1 - k);

    camera.up.copy(p);
    camera.lookAt(tmp2);

    // Light comes from over the camera's shoulder so the visible side is lit
    sun.position.copy(camera.position).addScaledVector(p, 6).add(tmp.copy(right).multiplyScalar(-4));
    sun.target.position.copy(craftPos);

    planet?.update(dt);
    renderer.render(scene, camera);
  }
  frame();

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = isSmall() ? 62 : 52;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall() ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener('resize', onResize);

  return {
    takeOff() { state.flying = true; },
    setPaused(v) { state.paused = v; },
    flyTo(id) {
      if (!state.flying) state.flying = true;
      state.paused = false;
      const s = stopObjs.find((o) => o.id === id);
      if (!s) return;
      s.inside = false; // let it trigger again on arrival
      state.autopilot = id;
      opts.onAutopilot?.(id);
    },
    dispose() {
      state.disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      stopObjs.forEach((s) => s.tag?.remove());
      planet?.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material && !o.material.isMeshToonMaterial) [].concat(o.material).forEach((m) => m.dispose());
      });
      disposeAll();
      renderer.dispose();
    },
  };
}

