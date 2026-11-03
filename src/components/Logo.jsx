// Globe mark: two meridians + equator, with the site's two markers
// (Saraburi in Thai-tea orange, Chicago in Air Force blue)
export function LogoMark({ className = '' }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="16" cy="16" rx="5" ry="12" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <path d="M4 16h24" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <circle cx="21.5" cy="20.5" r="2.6" fill="var(--color-tea)" />
      <circle cx="10" cy="10.5" r="2.6" fill="var(--color-air)" />
    </svg>
  );
}

export default function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="w-[1.1em] h-[1.1em]" />
      <span className="font-serif italic tracking-wide">
        earth<span className="text-air">.</span>
      </span>
    </span>
  );
}
