import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createShapes, loadLandMask, latLngToVec3, MARKERS } from '../three/shapes';
import { vertexShader, fragmentShader } from '../three/shaders';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

const CONFIG = {
  color: '#d4d4d4',
  accent: '#e8a35a', // Thai-tea orange
  air: '#5ea7e8',    // Air Force sky blue
  landMask: '/textures/earth-mask.jpg',
  morphSpeed: 0.035,
  layoutSpeed: 0.04,
  globeSpin: 0.0018,
  globeTilt: 0.35,        // tips the North Pole toward you so the arc is visible
  globeStartSpin: 2.95,   // Thailand faces the viewer on load
};

// Labels for the globe markers, in the same order as MARKERS
const MARKER_LABELS = [
  { place: 'Saraburi, TH', line: 'Where I’m from, and where I work', color: 'text-tea', dot: 'bg-tea' },
  { place: 'Chicago, US', line: 'Where I broadened my knowledge and perspective', color: 'text-air', dot: 'bg-air' },
];
const MARKER_HIT_PX = 44;  // how close the pointer must be to a marker to reveal its label
const MARKER_KEEP_PX = 90; // ...and how far it can drift before the label hides again
const MARKER_SLOW_PX = 160; // within this, the globe stops turning so the marker doesn't run from the pointer
const GLOBE_RADIUS = 2.4 * 1.02;

// Scene → position (x, y), scale (s), opacity (o)
// 0 Hero globe · 1 Approach plane · 2 Work </> · 3 Contact lens · 4 About cap
const LAYOUT = {
  desktop: [
    { x: 0, y: -0.2, s: 1, o: 0.75 },
    { x: 5.6, y: 1.2, s: 0.55, o: 0.35 },
    { x: -5.6, y: -0.5, s: 0.5, o: 0.35 },
    { x: 0, y: 0, s: 1.65, o: 0.4 },
    { x: 5.6, y: 0.8, s: 0.5, o: 0.3 },
  ],
  mobile: [
    { x: 0, y: 0, s: 0.85, o: 0.6 },
    { x: 1, y: 3.8, s: 0.45, o: 0.22 },
    { x: -1, y: 3.8, s: 0.45, o: 0.22 },
    { x: 0, y: 0, s: 1, o: 0.28 },
    { x: 0, y: 3.8, s: 0.45, o: 0.18 },
  ],
};

export default function ParticleScene({ sceneRef, viewRef, transitionRef, onReady }) {
  const mountRef = useRef(null);
  const labelRefs = useRef([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const isMobile = () => window.innerWidth < 768;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const COUNT = isMobile() ? 3000 : 6000;

    // --- Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = isMobile() ? 10 : 7;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    } catch {
      console.warn('[scene] WebGL unavailable — skipping 3D background');
      onReady?.();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWeights: { value: [1, 0, 0, 0, 0] },
        uTransit: { value: 0 },
        uWarp: { value: 0 },
        uOpacity: { value: 0 },
        uSize: { value: isMobile() ? 18 : 22 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uColor: { value: new THREE.Color(CONFIG.color) },
        uAccent: { value: new THREE.Color(CONFIG.accent) },
        uAir: { value: new THREE.Color(CONFIG.air) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // --- Build particles after the world map loads ---
    let geometry = null;
    let points = null;
    let disposed = false;

    loadLandMask(CONFIG.landMask).then((isLand) => {
      if (disposed) return;
      const s = createShapes(COUNT, isLand);
      const randoms = Float32Array.from({ length: COUNT }, () => Math.random());

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(s.globe, 3));
      geometry.setAttribute('aShape1', new THREE.BufferAttribute(s.plane, 3));
      geometry.setAttribute('aShape2', new THREE.BufferAttribute(s.code, 3));
      geometry.setAttribute('aShape3', new THREE.BufferAttribute(s.lens, 3));
      geometry.setAttribute('aShape4', new THREE.BufferAttribute(s.cap, 3));
      geometry.setAttribute('aKind', new THREE.BufferAttribute(s.kind, 1));
      geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

      points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      scene.add(points);
      onReady?.();
    });

    // --- Background stars ---
    const STAR_COUNT = isMobile() ? 150 : 300;
    const starPos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 40;
      starPos[i + 1] = (Math.random() - 0.5) * 40;
      starPos[i + 2] = -10 - Math.random() * 20;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0, depthWrite: false });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // --- Mouse ---
    const mouse = { x: 0, y: 0 };
    const pointer = { x: -1e4, y: -1e4 }; // pixels, for marker hover/tap
    const tilt = { x: 0, y: 0 };
    let touchInput = false;
    const onMove = (e) => {
      touchInput = e.pointerType === 'touch';
      // Only a mouse tilts the globe; a finger tapping a marker shouldn't spin it away
      if (!touchInput) {
        mouse.x = e.clientX / window.innerWidth - 0.5;
        mouse.y = e.clientY / window.innerHeight - 0.5;
      }
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true }); // taps on touch screens

    // --- Marker labels: project each marker to the screen every frame ---
    const markerBase = MARKERS.map(([lat, lng]) => latLngToVec3(lat, lng).multiplyScalar(GLOBE_RADIUS));
    const mp = new THREE.Vector3();
    const shown = markerBase.map(() => false);
    let nearMarker = false;
    let holdGlobe = false;

    const updateLabels = (globeReady) => {
      let anyNear = false;
      let anyApproach = false;
      markerBase.forEach((base, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        let show = false;
        if (globeReady) {
          // The globe is see-through, so markers on the far side are visible too: no facing check
          mp.copy(base).applyMatrix4(points.matrixWorld).project(camera);
          const x = (mp.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-mp.y * 0.5 + 0.5) * window.innerHeight;
          const dist = Math.hypot(pointer.x - x, pointer.y - y);
          const hit = touchInput ? MARKER_HIT_PX * 1.5 : MARKER_HIT_PX; // fingers are less precise
          show = dist < (shown[i] ? MARKER_KEEP_PX : hit);
          anyNear ||= show;
          anyApproach ||= dist < MARKER_SLOW_PX;
          // Beside the marker (right, else left); on narrow screens above it. Always kept on screen.
          const w = el.offsetWidth;
          const vw = window.innerWidth;
          const fitsRight = x + 18 + w <= vw - 12;
          const fitsLeft = x - 18 - w >= 12;
          if (fitsRight || fitsLeft) {
            el.style.transform = `translate3d(${fitsRight ? x + 18 : x - 18 - w}px, ${y}px, 0) translateY(-50%)`;
          } else {
            const left = Math.min(Math.max(x - w / 2, 12), vw - w - 12);
            el.style.transform = `translate3d(${left}px, ${y - 22}px, 0) translateY(-100%)`;
          }
        }
        shown[i] = show;
        el.style.opacity = show ? '1' : '0';
      });
      holdGlobe = anyApproach;
      if (anyNear !== nearMarker) {
        nearMarker = anyNear;
        document.body.classList.toggle('near-marker', anyNear); // grows the custom cursor
      }
    };

    // --- Render loop ---
    const start = performance.now();
    let spin = CONFIG.globeStartSpin;
    let rafId;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const t = (performance.now() - start) / 1000;
      const u = material.uniforms;
      const isHome = viewRef.current === 'home';
      const target = isHome ? sceneRef.current : 4;
      const L = LAYOUT[isMobile() ? 'mobile' : 'desktop'][target];

      u.uTime.value = reduceMotion ? 0 : t;
      const weights = u.uWeights.value;
      for (let i = 0; i < weights.length; i++) {
        weights[i] = lerp(weights[i], i === target ? 1 : 0, reduceMotion ? 1 : CONFIG.morphSpeed);
      }
      u.uTransit.value = Math.min(1, (1 - Math.max(...weights)) * 2);
      u.uOpacity.value = lerp(u.uOpacity.value, L.o, CONFIG.layoutSpeed);
      u.uWarp.value = lerp(u.uWarp.value, transitionRef.current === 'exiting' && !reduceMotion ? 1 : 0, 0.08);

      if (points) {
        const globeW = weights[0];

        // Hold the globe still while a marker label is open, so it doesn't slide away from the pointer
        if (target === 0 && !reduceMotion) { if (!holdGlobe) spin += CONFIG.globeSpin; }
        else spin = lerp(spin, Math.round(spin / TAU) * TAU, 0.05);

        if (!holdGlobe) {
          tilt.x = lerp(tilt.x, mouse.x, 0.05);
          tilt.y = lerp(tilt.y, mouse.y, 0.05);
        }
        points.rotation.y = spin + tilt.x * 0.6;
        points.rotation.x = tilt.y * 0.4 + CONFIG.globeTilt * globeW;

        points.position.x = lerp(points.position.x, L.x, CONFIG.layoutSpeed);
        points.position.y = lerp(points.position.y, L.y, CONFIG.layoutSpeed);
        points.scale.setScalar(lerp(points.scale.x, L.s, CONFIG.layoutSpeed));
        points.updateMatrixWorld();
      }

      const globeReady = points && isHome && target === 0 && weights[0] > 0.9
        && transitionRef.current === 'idle' && window.scrollY < window.innerHeight * 0.5;
      updateLabels(globeReady);

      starMat.opacity = lerp(starMat.opacity, isHome ? 0.35 + Math.sin(t * 1.5) * 0.15 : 0.1, 0.05);
      stars.rotation.y = t * 0.01;

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.position.z = isMobile() ? 10 : 7;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.body.classList.remove('near-marker');
      window.removeEventListener('resize', onResize);
      geometry?.dispose();
      material.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [sceneRef, viewRef, transitionRef, onReady]);

  return (
    <>
      <div ref={mountRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />
      <div className="fixed inset-0 z-20 pointer-events-none" aria-hidden="true">
        {MARKER_LABELS.map((m, i) => (
          <div
            key={m.place}
            ref={(el) => { labelRefs.current[i] = el; }}
            className="marker-label absolute top-0 left-0 opacity-0 px-4 py-3 bg-[#030303]/85 backdrop-blur-sm border border-white/10"
          >
            <span className={`block text-[9px] tracking-[0.25em] uppercase ${m.color}`}>
              <span className={`inline-block w-1.5 h-1.5 mr-2 rounded-full align-middle ${m.dot}`} />
              {m.place}
            </span>
            <span className="block mt-1 max-w-[15rem] font-serif italic text-base md:text-lg leading-snug text-white">{m.line}</span>
          </div>
        ))}
      </div>
    </>
  );
}