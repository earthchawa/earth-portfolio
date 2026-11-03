import { useRef } from 'react';

export default function TiltCard({ src, w, h, title, caption }) {
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 12}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
  };

  const onLeave = () => {
    ref.current.style.setProperty('--rx', '0deg');
    ref.current.style.setProperty('--ry', '0deg');
  };

  return (
    <div className="reveal">
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="tilt-card interactive group relative overflow-hidden bg-[#111]"
      >
        <img
          src={src}
          alt={title}
          width={w}
          height={h}
          loading="lazy"
          decoding="async"
          className="archive-img w-full h-auto object-cover grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
        />
        <div className="tilt-overlay absolute inset-0 hidden md:flex flex-col justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <span className="font-serif text-2xl text-white translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            {title}
          </span>
          <span className="mt-2 text-[10px] tracking-widest uppercase text-[#888] translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-75">
            {caption}
          </span>
        </div>
      </div>

      {/* Mobile caption (no hover on touch screens) */}
      <div className="md:hidden mt-2">
        <p className="font-serif text-sm text-white/90 leading-tight">{title}</p>
        <p className="mt-1 text-[8px] tracking-widest uppercase text-[#666]">{caption}</p>
      </div>
    </div>
  );
}