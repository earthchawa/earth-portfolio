import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createShapes, loadLandMask } from '../three/shapes';
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
    const tilt = { x: 0, y: 0 };
    const onMove = (e) => {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

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

        if (target === 0 && !reduceMotion) spin += CONFIG.globeSpin;
        else spin = lerp(spin, Math.round(spin / TAU) * TAU, 0.05);

        tilt.x = lerp(tilt.x, mouse.x, 0.05);
        tilt.y = lerp(tilt.y, mouse.y, 0.05);
        points.rotation.y = spin + tilt.x * 0.6;
        points.rotation.x = tilt.y * 0.4 + CONFIG.globeTilt * globeW;

        points.position.x = lerp(points.position.x, L.x, CONFIG.layoutSpeed);
        points.position.y = lerp(points.position.y, L.y, CONFIG.layoutSpeed);
        points.scale.setScalar(lerp(points.scale.x, L.s, CONFIG.layoutSpeed));
      }

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
      window.removeEventListener('resize', onResize);
      geometry?.dispose();
      material.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [sceneRef, viewRef, transitionRef, onReady]);

  return <div ref={mountRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />;
}