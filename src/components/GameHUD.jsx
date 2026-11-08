import { useEffect, useRef, useCallback } from 'react';
import { Trophy, Lock, X, Sparkles, ChevronUp } from 'lucide-react';
import { ACHIEVEMENTS, LEVELS } from '../game/achievements';

function XpBar({ progress, className = '' }) {
  return (
    <div className={`h-[3px] bg-white/10 overflow-hidden ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-air to-tea origin-left transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `scaleX(${Math.max(0.02, progress)})` }}
      />
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const isLevel = toast.kind === 'level';
  return (
    <div
      key={toast.key}
      role="status"
      className="game-toast fixed z-[85] left-4 right-4 top-20 md:top-auto md:left-auto md:right-8 md:bottom-8 md:w-80 flex items-center gap-4 p-4 bg-[#0a0a0a]/95 backdrop-blur border border-white/10 shadow-2xl shadow-black/60"
    >
      <div className={`shrink-0 w-10 h-10 flex items-center justify-center border ${isLevel ? 'border-tea/60 text-tea' : 'border-air/60 text-air'}`}>
        {isLevel ? <ChevronUp className="w-5 h-5" /> : <Trophy className="w-4 h-4" />}
      </div>
      <div className="min-w-0">
        <p className={`text-[9px] tracking-[0.25em] uppercase ${isLevel ? 'text-tea' : 'text-air'}`}>
          {isLevel ? `Rank up · Level ${toast.level}` : `Achievement unlocked · +${toast.xp} XP`}
        </p>
        <p className="mt-1 font-serif text-lg text-white leading-tight truncate">{toast.title}</p>
      </div>
    </div>
  );
}

function QuestLog({ game, onClose }) {
  const closeRef = useRef(null);
  const { unlocked, xp, totalXp, level } = game;
  const done = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="questlog-title"
        onClick={(e) => e.stopPropagation()}
        className="quest-log w-full md:max-w-xl max-h-[85svh] flex flex-col bg-[#070707] border border-white/10 shadow-2xl"
      >
        <header className="p-6 md:p-8 border-b border-white/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[9px] tracking-[0.3em] uppercase text-[#555]">Quest Log</span>
              <h2 id="questlog-title" className="mt-2 font-serif text-3xl text-white font-light">
                Lv {level.level} · <span className="italic text-air">{level.title}</span>
              </h2>
            </div>
            <button ref={closeRef} onClick={onClose} aria-label="Close quest log" className="interactive p-2 -m-2 text-[#777] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <XpBar progress={level.progress} className="mt-6" />
          <div className="mt-2 flex justify-between text-[9px] tracking-[0.2em] uppercase text-[#555] tabular-nums">
            <span>{xp} XP{level.nextXp ? ` / ${level.nextXp} to Lv ${level.level + 1}` : ' · Max rank'}</span>
            <span>{done}/{ACHIEVEMENTS.length} · {Math.round((xp / totalXp) * 100)}%</span>
          </div>
        </header>

        <ul className="flex-1 overflow-y-auto overscroll-contain p-3 md:p-4">
          {ACHIEVEMENTS.map((a) => {
            const got = Boolean(unlocked[a.id]);
            const hidden = a.secret && !got;
            return (
              <li key={a.id} className={`flex items-center gap-4 px-3 py-3 ${got ? '' : 'opacity-50'}`}>
                <div className={`shrink-0 w-8 h-8 flex items-center justify-center border ${got ? (a.secret ? 'border-tea/60 text-tea' : 'border-air/60 text-air') : 'border-white/10 text-[#444]'}`}>
                  {got ? (a.secret ? <Sparkles className="w-3.5 h-3.5" /> : <Trophy className="w-3.5 h-3.5" />) : <Lock className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${got ? 'text-white' : 'text-[#888]'}`}>{hidden ? '???' : a.title}</p>
                  <p className="mt-0.5 text-[11px] font-light text-[#666]">{hidden ? 'Secret achievement' : a.hint}</p>
                </div>
                <span className={`shrink-0 text-[9px] tracking-[0.2em] uppercase tabular-nums ${got ? 'text-tea' : 'text-[#444]'}`}>+{a.xp}</span>
              </li>
            );
          })}
        </ul>

        <footer className="px-6 md:px-8 py-4 border-t border-white/5 flex items-center justify-between gap-4 text-[9px] tracking-[0.2em] uppercase text-[#444]">
          <span className="hidden sm:inline">Ranks: {LEVELS.map((l) => l.title).join(' → ')}</span>
          <button
            onClick={() => { if (window.confirm('Reset all progress?')) game.reset(); }}
            className="interactive ml-auto shrink-0 whitespace-nowrap hover:text-white transition-colors"
          >
            Reset save
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function GameHUD({ game, open, setOpen, visible }) {
  const { level, xp } = game;
  const close = useCallback(() => setOpen(false), [setOpen]);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Quest log — level ${level.level} ${level.title}, ${xp} XP`}
        className={`interactive game-hud fixed z-[80] left-4 bottom-4 md:left-12 md:bottom-10 w-28 md:w-44 p-2.5 md:p-3 text-left bg-[#030303]/85 backdrop-blur border border-white/10 hover:border-air/50 transition-[opacity,border-color] duration-1000 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-baseline justify-between gap-2 text-[9px] tracking-[0.2em] uppercase">
          <span className="text-white">Lv {level.level}</span>
          <span className="text-[#666] tabular-nums">{xp} XP</span>
        </div>
        <p className="hidden md:block mt-1 text-[10px] tracking-[0.15em] uppercase text-air truncate">{level.title}</p>
        <XpBar progress={level.progress} className="mt-2" />
        <p className="hidden md:block mt-2 text-[8px] tracking-[0.2em] uppercase text-[#444]">Press Q · Quest log</p>
      </button>

      {visible && <Toast toast={game.toast} />}
      {open && <QuestLog game={game} onClose={close} />}
    </>
  );
}
