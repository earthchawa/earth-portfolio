import { useEffect, useRef, useState } from 'react';

const clamp = (v, max = 15) => Math.max(-max, Math.min(max, v));
const GAP = 24;    // distance between cursor and card
const MARGIN = 16; // keep the card this far inside the viewport

export default function Cursor({ preview }) {
  const dotRef = useRef(null);
  const previewRef = useRef(null);
  const [last, setLast] = useState(null);
  if (preview && preview !== last) setLast(preview); // เก็บการ์ดล่าสุดไว้ ให้ตอน fade-out ไม่กระพริบ

  useEffect(() => {
    const target = { x: -100, y: -100 };
    const dot = { x: -100, y: -100 };
    const card = { x: -100, y: -100 };
    const offset = { x: GAP, y: GAP };
    let raf;

    const onMove = (e) => { target.x = e.clientX; target.y = e.clientY; };
    window.addEventListener('pointermove', onMove, { passive: true });

    const loop = () => {
      dot.x += (target.x - dot.x) * 0.35;
      dot.y += (target.y - dot.y) * 0.35;

      const vx = target.x - card.x;
      const vy = target.y - card.y;
      card.x += vx * 0.12;
      card.y += vy * 0.12;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) translate(-50%, -50%)`;
      }
      const el = previewRef.current;
      if (el) {
        // Flip the card to the other side of the cursor near the right/bottom edge
        const { offsetWidth: w, offsetHeight: h } = el;
        const toX = target.x + GAP + w > window.innerWidth - MARGIN ? -GAP - w : GAP;
        const toY = target.y + GAP + h > window.innerHeight - MARGIN ? -GAP - h : GAP;
        offset.x += (toX - offset.x) * 0.15;
        offset.y += (toY - offset.y) * 0.15;
        el.style.transform =
          `translate3d(${card.x + offset.x}px, ${card.y + offset.y}px, 0) perspective(800px) ` +
          `rotateY(${clamp(vx * 0.15)}deg) rotateX(${clamp(-vy * 0.15)}deg) rotateZ(${clamp(vx * 0.05, 8)}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={previewRef} className="project-preview">
        <div className={`w-80 overflow-hidden bg-[#0a0a0a] border border-white/10 shadow-2xl shadow-black/60 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${preview ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          {last?.image && (
            // object-contain: show the whole screenshot, whatever its shape
            <div className="h-52 p-3 flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#1a1a1a,#0d0d0d)]">
              <img src={last.image} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          {last && (
            <div className={`p-4 ${last.image ? 'border-t border-white/5' : ''}`}>
              <span className="text-[9px] tracking-[0.2em] uppercase text-air">{last.category}</span>
              <p className="mt-2 text-xs font-light leading-relaxed text-[#bbb]">{last.description}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
