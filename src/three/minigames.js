import * as THREE from 'three';
import { MARKERS, latLngToVec3 } from './shapes';

// Small hidden games played with the particle shapes — no HUD, no score.
//   0 Globe   drag to spin · tap a marker → flight arc Saraburi ⇄ Chicago
//   1 Plane   the paper plane follows the pointer · fly through 3 hoops
//   3 Lens    focus follows the pointer · click to "take a photo"
//   4 Cap     click the cap to toss it

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const GLOBE_R = 2.4;
const ARC_POINTS = 140;
const HOOPS = 3;
const ROLL_FRAMES = 36;

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const r = THREE.MathUtils.degToRad;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2
    + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

const FLIGHT_KM = Math.round(haversineKm(MARKERS[0], MARKERS[1]) / 100) * 100;
const CITY = ['Saraburi', 'Chicago'];

const isInteractive = (el) => Boolean(el?.closest?.('a, button, input, textarea, .interactive, [role="dialog"]'));

export function createMinigames({ scene, camera, rig, material, colors, reduceMotion, onPlay }) {
  const ndc = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const tmp = new THREE.Vector3();
  const pointer = { x: 0, y: 0, lastMove: -1e9, fine: window.matchMedia('(pointer: fine)').matches };

  let points = null; // set once the particles are built
  let ctx = { target: 0, isHome: true };

  // ---------- 0 · Globe ----------
  const drag = { active: false, moved: 0, startX: 0, startY: 0, lastX: 0, startT: 0 };
  let spinVel = 0;

  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_POINTS * 3), 3));
  arcGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ARC_POINTS * 3), 3));
  const arcMat = new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const arc = new THREE.Points(arcGeo, arcMat);
  arc.frustumCulled = false;
  arc.visible = false;
  let flight = null; // { t }

  function buildArc(fromIdx) {
    const a = latLngToVec3(MARKERS[fromIdx][0], MARKERS[fromIdx][1]);
    const b = latLngToVec3(MARKERS[1 - fromIdx][0], MARKERS[1 - fromIdx][1]);
    const pos = arcGeo.attributes.position.array;
    const col = arcGeo.attributes.color.array;
    const cA = new THREE.Color(fromIdx === 0 ? colors.accent : colors.air);
    const cB = new THREE.Color(fromIdx === 0 ? colors.air : colors.accent);
    const c = new THREE.Color();
    for (let i = 0; i < ARC_POINTS; i++) {
      const t = i / (ARC_POINTS - 1);
      // Great-circle slerp, lifted off the surface in the middle
      tmp.copy(a).lerp(b, t).normalize().multiplyScalar(GLOBE_R * (1.03 + Math.sin(Math.PI * t) * 0.35));
      pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      c.copy(cA).lerp(cB, t);
      col.set([c.r, c.g, c.b], i * 3);
    }
    arcGeo.attributes.position.needsUpdate = true;
    arcGeo.attributes.color.needsUpdate = true;
  }

  function markerHit(clientX, clientY) {
    if (!points) return -1;
    let best = -1;
    let bestD = pointer.fine ? 34 : 46;
    MARKERS.forEach(([lat, lng], i) => {
      latLngToVec3(lat, lng, tmp).multiplyScalar(GLOBE_R * 1.02);
      points.localToWorld(tmp);
      // Skip the marker if it's on the far side of the globe
      const center = points.getWorldPosition(new THREE.Vector3());
      const toCam = camera.position.clone().sub(center);
      if (tmp.clone().sub(center).dot(toCam) < 0) return;
      tmp.project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function launchFlight(fromIdx) {
    buildArc(fromIdx);
    flight = { t: 0 };
    arc.visible = true;
    onPlay?.({ text: `${CITY[fromIdx]} → ${CITY[1 - fromIdx]} · ${FLIGHT_KM.toLocaleString('en-US')} km` });
  }

  // ---------- 1 · Paper plane ----------
  const hoopGroup = new THREE.Group();
  scene.add(hoopGroup);
  const hoopRingGeo = (() => {
    const n = 56;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      p.set([Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  })();
  const hoops = Array.from({ length: HOOPS }, () => {
    const mat = new THREE.PointsMaterial({
      color: colors.accent, size: 0.07, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Points(hoopRingGeo, mat);
    hoopGroup.add(mesh);
    return { mesh, mat, alive: true, pop: 0 };
  });
  const plane = { x: 0, y: 0, vx: 0, vy: 0, yaw: 0, bank: 0, roll: -1, following: 0 };
  let hoopsVisible = 0;
  let respawnAt = 0;

  const viewHalf = () => {
    const h = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return { w: h * camera.aspect, h };
  };

  function spawnHoops() {
    const { w, h } = viewHalf();
    const placed = [];
    hoops.forEach((hoop) => {
      let x;
      let y;
      let tries = 0;
      do {
        x = (Math.random() * 2 - 1) * (w - 1.4);
        y = (Math.random() * 2 - 1) * (h - 1.4);
        tries++;
      } while (tries < 30 && [...placed, [plane.x, plane.y]].some(([px, py]) => Math.hypot(px - x, py - y) < 2.2));
      placed.push([x, y]);
      hoop.mesh.position.set(x, y, 0);
      hoop.mesh.scale.setScalar(1);
      hoop.alive = true;
      hoop.pop = 0;
    });
  }
  spawnHoops();

  // ---------- 3 · Lens ----------
  let defocus = 0.4;
  let shutter = -1;
  let frame = 0;

  // ---------- 4 · Cap ----------
  const cap = { y: 0, vy: 0, flip: 0, flying: false, tossed: false };

  function screenOf(obj) {
    obj.getWorldPosition(tmp).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight };
  }

  // ---------- Input ----------
  const inHero = () => ctx.isHome && ctx.target === 0 && window.scrollY < window.innerHeight * 0.6;

  const onDown = (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    pointer.lastMove = performance.now();
    if (isInteractive(e.target) || e.button > 0) return;
    if (inHero()) {
      Object.assign(drag, { active: true, moved: 0, startX: e.clientX, startY: e.clientY, lastX: e.clientX, startT: performance.now() });
    }
  };

  const onMove = (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.lastMove = performance.now();
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    if (drag.active) {
      const dx = e.clientX - drag.lastX;
      drag.lastX = e.clientX;
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY));
      spinVel = dx * 0.006;
    }
  };

  const onUp = (e) => {
    const wasDrag = drag.active;
    drag.active = false;
    if (isInteractive(e.target) || e.button > 0) return;

    const isTap = !wasDrag || drag.moved < 8;
    if (!isTap) return;

    if (inHero()) {
      const hit = markerHit(e.clientX, e.clientY);
      if (hit >= 0 && !flight) launchFlight(hit);
      return;
    }

    if (ctx.isHome && ctx.target === 3 && shutter < 0) {
      shutter = 0;
      frame++;
      const done = frame >= ROLL_FRAMES;
      onPlay?.({ flash: !reduceMotion, text: done ? 'Roll finished. Time to develop.' : `Click. Frame ${frame} of ${ROLL_FRAMES}.` });
      if (done) frame = 0;
      return;
    }

    if (!ctx.isHome && points && !cap.flying) {
      const s = screenOf(points);
      const r = (pointer.fine ? 190 : 150) * points.scale.x * 2;
      if (Math.hypot(s.x - e.clientX, s.y - (e.clientY)) < r) {
        cap.flying = true;
        cap.vy = 8;
        if (!cap.tossed) onPlay?.({ text: 'Class of ’24 — caps off.' });
        cap.tossed = true;
      }
    }
  };

  const onCancel = () => { drag.active = false; };

  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onCancel, { passive: true });

  // ---------- Per-frame hooks (called from ParticleScene's render loop) ----------
  return {
    setPoints(p) {
      points = p;
      p.add(arc);
    },

    // Globe spin: drag + inertia replace the auto-spin while active
    spin(spin, target, autoSpeed) {
      if (target !== 0) { spinVel = 0; return null; } // let the scene settle it
      if (drag.active) return spin + spinVel * (drag.moved > 2 ? 1 : 0);
      spinVel *= 0.95;
      const idle = Math.abs(spinVel) < 0.0005;
      return spin + spinVel + (idle && !flight && !reduceMotion ? autoSpeed : 0);
    },

    // May replace the layout target (plane following the pointer)
    layout(L, nextCtx, dt) {
      ctx = nextCtx;
      const now = performance.now();
      const following = ctx.isHome && ctx.target === 1 && now - pointer.lastMove < 2500;
      plane.following = lerp(plane.following, following ? 1 : 0, 0.08);
      if (!following) return L;

      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(zPlane, tmp)) return L;
      const { w, h } = viewHalf();
      return {
        ...L,
        x: clamp(tmp.x, -w + 1, w - 1),
        y: clamp(tmp.y, -h + 0.8, h - 0.8),
        o: Math.max(L.o, 0.6),
        speed: Math.min(1, dt * 3.2),
      };
    },

    // Runs after ParticleScene has placed and rotated the points
    afterTransform(dt) {
      if (!points) return;
      const now = performance.now();

      // Flight arc: draw in, hold, fade
      if (flight) {
        flight.t += dt;
        const drawn = clamp(flight.t / 2.2, 0, 1);
        arcGeo.setDrawRange(0, Math.max(1, Math.floor(easeInOut(drawn) * ARC_POINTS)));
        const fade = flight.t < 2.2 ? 1 : clamp(1 - (flight.t - 3.4) / 1.2, 0, 1);
        arcMat.opacity = fade * (ctx.target === 0 && ctx.isHome ? 1 : 0);
        if (flight.t > 4.6) { flight = null; arc.visible = false; }
      }

      // Plane: heading follows its velocity, banking into turns
      const vx = (points.position.x - plane.x) / Math.max(dt, 1e-3);
      const vy = (points.position.y - plane.y) / Math.max(dt, 1e-3);
      plane.x = points.position.x;
      plane.y = points.position.y;
      plane.vx = lerp(plane.vx, vx, 0.15);
      plane.vy = lerp(plane.vy, vy, 0.15);
      const f = plane.following;
      if (f > 0.01) {
        const goingLeft = plane.vx < -0.3;
        plane.yaw = lerp(plane.yaw, goingLeft ? Math.PI : 0, 0.08);
        plane.bank = lerp(plane.bank, clamp(plane.vy * 0.08, -0.6, 0.6) * (goingLeft ? -1 : 1), 0.1);
        points.rotation.y += plane.yaw * f;
        points.rotation.z = plane.bank * f;
      } else {
        points.rotation.z = lerp(points.rotation.z, 0, 0.1);
      }

      // Barrel roll after clearing every hoop
      if (plane.roll >= 0) {
        plane.roll += dt / 1.1;
        points.rotation.x += easeInOut(Math.min(plane.roll, 1)) * TAU;
        if (plane.roll >= 1) plane.roll = -1;
      }

      // Hoops
      const showHoops = ctx.isHome && ctx.target === 1 && f > 0.3;
      hoopsVisible = lerp(hoopsVisible, showHoops ? 1 : 0, 0.06);
      if (respawnAt && now > respawnAt) { respawnAt = 0; spawnHoops(); }
      hoops.forEach((hoop, i) => {
        if (hoop.alive) {
          hoop.mesh.rotation.z += dt * 0.4;
          hoop.mesh.scale.setScalar(1 + Math.sin(now / 400 + i) * 0.05);
          hoop.mat.opacity = hoopsVisible * 0.85;
          if (showHoops && Math.hypot(plane.x - hoop.mesh.position.x, plane.y - hoop.mesh.position.y) < 0.75) {
            hoop.alive = false;
            hoop.pop = 0.0001;
            if (hoops.every((o) => !o.alive)) {
              plane.roll = 0;
              respawnAt = now + 3500;
              onPlay?.({ text: 'Three for three. Wheels up.' });
            }
          }
        } else if (hoop.pop > 0) {
          hoop.pop += dt * 2.2;
          hoop.mesh.scale.setScalar(1 + hoop.pop * 1.8);
          hoop.mat.opacity = Math.max(0, 1 - hoop.pop) * hoopsVisible;
          if (hoop.pop >= 1) hoop.pop = 0;
        } else {
          hoop.mat.opacity = 0;
        }
      });

      // Lens: sharp near the middle of the screen, blurry toward the edges
      if (ctx.isHome && ctx.target === 3) {
        const recent = now - pointer.lastMove < 4000;
        let want = 0.15;
        if (pointer.fine && recent) {
          const d = Math.hypot(pointer.x - window.innerWidth / 2, pointer.y - window.innerHeight / 2)
            / Math.min(window.innerWidth, window.innerHeight);
          want = clamp((d - 0.1) / 0.4, 0, 1);
        } else if (pointer.fine) {
          want = 0.45;
        }
        defocus = lerp(defocus, want, 0.05);
      } else {
        defocus = lerp(defocus, 0, 0.1);
      }
      material.uniforms.uDefocus.value = reduceMotion ? 0 : defocus;

      // Shutter: the aperture snaps shut and reopens
      let shutterScale = 1;
      if (shutter >= 0) {
        shutter += dt / 0.4;
        shutterScale = 1 - Math.sin(Math.PI * Math.min(shutter, 1)) * 0.28;
        if (shutter >= 1) shutter = -1;
      }

      // Cap toss (simple ballistic hop with a flip)
      if (cap.flying) {
        cap.vy -= 18 * dt;
        cap.y += cap.vy * dt;
        cap.flip += dt * 7;
        if (cap.y <= 0 && cap.vy < 0) {
          cap.y = 0;
          cap.flying = false;
          cap.flip = Math.round(cap.flip / TAU) * TAU;
        }
      } else {
        cap.flip = lerp(cap.flip, Math.round(cap.flip / TAU) * TAU, 0.2);
      }
      points.rotation.x += cap.flip;

      rig.position.y = cap.y * points.scale.x * 2;
      rig.scale.setScalar(shutterScale);
    },

    dispose() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      arcGeo.dispose();
      arcMat.dispose();
      hoopRingGeo.dispose();
      hoops.forEach((h) => h.mat.dispose());
      scene.remove(hoopGroup);
    },
  };
}
