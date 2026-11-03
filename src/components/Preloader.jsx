import { useEffect, useRef } from 'react';
import { LogoMark } from './Logo';

const MIN_VISIBLE_MS = 900; // avoid a flash on fast/cached loads
const HOLD_MS = 400;        // pause on 100% before revealing the site

// The counter eases toward the real progress, written straight to the DOM
// so the rest of the app doesn't re-render every frame
export default function Preloader({ progress, visible, onDone }) {
  const numRef = useRef(null);
  const barRef = useRef(null);
  const targetRef = useRef(progress);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    targetRef.current = progress;
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const start = performance.now();
    let shown = 0;
    let raf;
    let timer;

    const loop = () => {
      const target = targetRef.current * 100;
      shown = Math.min(target, shown + Math.max((target - shown) * 0.08, 0.5));
      numRef.current.textContent = `${Math.floor(shown)}%`;
      barRef.current.style.transform = `scaleX(${shown / 100})`;

      if (shown >= 100) {
        const wait = Math.max(HOLD_MS, MIN_VISIBLE_MS - (performance.now() - start));
        timer = setTimeout(() => onDoneRef.current(), wait);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-[100] bg-[#030303] flex items-center justify-center transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="w-12 h-12 mb-2 text-white" />
        <div ref={numRef} className="text-[10px] tracking-widest text-[#555] uppercase tabular-nums">0%</div>
        <div className="w-32 h-px bg-[#222] relative overflow-hidden">
          <div ref={barRef} className="absolute inset-0 bg-air origin-left" style={{ transform: 'scaleX(0)' }} />
        </div>
      </div>
    </div>
  );
}
