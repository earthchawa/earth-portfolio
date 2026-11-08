import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home, GraduationCap, Warehouse, BookOpen, Ship, Castle, Camera, Mail,
  X, List, ArrowUpRight, Download, Check, Plane, Loader2,
} from 'lucide-react';
import { LogoMark } from './components/Logo';
import LocalTime from './components/LocalTime';
import { STOPS, START, CONTACT, RESUME_URL, SKILL_GROUPS } from './world/data';

const ICONS = { home: Home, depaul: GraduationCap, veha: Warehouse, nidnoi: BookOpen, namu: Ship, l9: Castle, camera: Camera, contact: Mail };
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

// ============ CONTENT (shared by the flight card, quick view and screen readers) ============
function StopContent({ stop, headingLevel = 2 }) {
  const H = `h${headingLevel}`;
  return (
    <div className="stop">
      <p className="stop__kicker" style={{ '--c': stop.color }}>{stop.kicker}</p>
      <H className="stop__title">{stop.title}</H>
      <p className="stop__place">{stop.place}</p>

      {stop.image && (
        <figure className={`stop__figure ${stop.contain ? 'is-contain' : ''}`}>
          <img src={stop.image} alt={stop.imageAlt ?? ''} loading="lazy" />
        </figure>
      )}

      {stop.body.map((para) => <p key={para} className="stop__body">{para}</p>)}

      {stop.tags && (
        <ul className="stop__tags">{stop.tags.map((t) => <li key={t}>{t}</li>)}</ul>
      )}

      {stop.skills && (
        <div className="stop__skills">
          {SKILL_GROUPS.map((g) => (
            <div key={g.label}>
              <span>{g.label}</span>
              <p>{g.items.join(' · ')}</p>
            </div>
          ))}
          <p className="stop__time">Local time in Saraburi · <LocalTime /></p>
        </div>
      )}

      {stop.gallery && (
        <div className="stop__gallery">
          {stop.gallery.map((g) => (
            <figure key={g.src}>
              <img src={g.src} alt={g.caption} loading="lazy" />
              <figcaption>{g.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {stop.contact && (
        <div className="stop__contact">
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          <a href={`tel:${CONTACT.phoneHref}`}>TH {CONTACT.phoneDisplay}</a>
          <div className="stop__links">
            <a className="btn btn--ghost" href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">Instagram <ArrowUpRight size={14} /></a>
            <a className="btn btn--ghost" href={CONTACT.github} target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={14} /></a>
            <a className="btn btn--ghost" href={RESUME_URL} download>Resume <Download size={14} /></a>
          </div>
        </div>
      )}

      {stop.links && (
        <div className="stop__links">
          {stop.links.map((l) => (
            <a key={l.url} className="btn btn--ghost" href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label} <ArrowUpRight size={14} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ APP ============
export default function App() {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const worldRef = useRef(null);

  const [phase, setPhase] = useState('intro'); // intro | flying
  const [ready, setReady] = useState(false);
  const [noWebGL, setNoWebGL] = useState(false);
  const [openStop, setOpenStop] = useState(null);
  const [found, setFound] = useState([]);
  const [autopilot, setAutopilot] = useState(null);
  const [quickView, setQuickView] = useState(false);
  const [stick, setStick] = useState({ active: false });
  const [thanksDone, setThanksDone] = useState(false);
  const [touch] = useState(isTouch);

  // --- Boot the 3D world ---
  useEffect(() => {
    let world;
    let cancelled = false;
    import('./world/world').then(({ createWorld }) => {
      if (cancelled || !canvasRef.current) return;
      try {
        world = createWorld({
          canvas: canvasRef.current,
          labelsEl: labelsRef.current,
          stops: STOPS,
          start: START,
          maskUrl: '/textures/earth-mask.jpg',
          onReady: () => setReady(true),
          onArrive: (id) => {
            setOpenStop(id);
            setFound((f) => (f.includes(id) ? f : [...f, id]));
          },
          onAutopilot: setAutopilot,
          onStick: setStick,
        });
        worldRef.current = world;
      } catch (err) {
        console.warn('[world] 3D unavailable', err);
        setNoWebGL(true);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      world?.dispose();
      worldRef.current = null;
    };
  }, []);

  // Freeze the plane while a card is open
  useEffect(() => { worldRef.current?.setPaused(Boolean(openStop) || quickView); }, [openStop, quickView]);

  // All stops found → one little thank-you, shown for a few seconds
  const showThanks = found.length === STOPS.length && !thanksDone;
  useEffect(() => {
    if (!showThanks) return undefined;
    const id = setTimeout(() => setThanksDone(true), 4500);
    return () => clearTimeout(id);
  }, [showThanks]);

  const takeOff = useCallback(() => {
    if (noWebGL) { setQuickView(true); return; }
    setPhase('flying');
    worldRef.current?.takeOff();
  }, [noWebGL]);

  const closeCard = useCallback(() => setOpenStop(null), []);

  const flyTo = (id) => {
    setOpenStop(null);
    setPhase('flying');
    worldRef.current?.flyTo(id);
  };

  // Esc closes whatever is open; Enter takes off from the intro; steering closes a card
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setQuickView(false); closeCard(); }
      if (e.key === 'Enter' && phase === 'intro' && ready && !quickView) takeOff();
      if (openStop && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(e.key)) closeCard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, ready, quickView, openStop, takeOff, closeCard]);

  const stop = STOPS.find((s) => s.id === openStop);
  const target = STOPS.find((s) => s.id === autopilot);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="world-canvas" aria-hidden="true" />
      <div ref={labelsRef} className="world-tags" aria-hidden="true" />

      {/* Drag stick indicator */}
      {stick.active && (
        <div className="stick" style={{ left: stick.x, top: stick.y }} aria-hidden="true">
          <span style={{ transform: `translate(${Math.max(-70, Math.min(70, stick.dx))}px, ${Math.max(-70, Math.min(70, stick.dy))}px)` }} />
        </div>
      )}

      {/* ---------- TOP BAR ---------- */}
      <header className="topbar">
        <a href="/" className="brand" aria-label="earth. — home">
          <LogoMark className="brand__mark" />
          <span>earth<span className="brand__dot">.</span></span>
        </a>

        {phase === 'flying' && (
          <nav className="chips" aria-label="Fly to a stop">
            {STOPS.map((s) => {
              const Icon = ICONS[s.id];
              const got = found.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => flyTo(s.id)}
                  className={`chip ${got ? 'is-found' : ''} ${autopilot === s.id ? 'is-target' : ''}`}
                  style={{ '--c': s.color }}
                  aria-label={`Fly to ${s.title}${got ? ' (found)' : ''}`}
                  title={`Fly to ${s.title}`}
                >
                  <Icon size={16} strokeWidth={2.4} />
                  {got && <Check className="chip__check" size={10} strokeWidth={4} />}
                </button>
              );
            })}
            <span className="chips__count">{found.length}/{STOPS.length}</span>
          </nav>
        )}

        <button className="btn btn--small btn--paper" onClick={() => setQuickView(true)}>
          <List size={16} /> <span className="hide-sm">Quick view</span>
        </button>
      </header>

      {/* ---------- INTRO ---------- */}
      {phase === 'intro' && (
        <section className="intro" aria-labelledby="intro-title">
          <div className="intro__card">
            <p className="intro__kicker">Chawaphong Khunsoongnoen · Developer &amp; Lecturer</p>
            <h1 id="intro-title" className="intro__title">
              Fly around the world <span>and find Earth.</span>
            </h1>
            <p className="intro__lead">
              Hop on my paper plane and steer toward the glowing beacons. Each stop tells you a bit about me: where I studied, what I build, and how to say hello.
            </p>

            <div className="controls">
              {touch ? (
                <p><b>Drag</b> anywhere to steer and climb, or tap an icon up top to fly straight there.</p>
              ) : (
                <>
                  <p><kbd>←</kbd><kbd>→</kbd> steer</p>
                  <p><kbd>↑</kbd><kbd>↓</kbd> climb</p>
                  <p><kbd>Space</kbd> boost</p>
                  <p className="controls__or">or drag with the mouse</p>
                </>
              )}
            </div>

            <div className="intro__actions">
              <button className="btn btn--primary" onClick={takeOff} disabled={!ready}>
                {ready ? <><Plane size={18} /> Take off</> : <><Loader2 size={18} className="spin" /> Loading the world…</>}
              </button>
              <button className="btn btn--ghost" onClick={() => setQuickView(true)}>Skip the flight</button>
            </div>
          </div>
        </section>
      )}

      {/* ---------- HINTS ---------- */}
      {phase === 'flying' && !openStop && !quickView && (
        target ? (
          <p className="hint">Autopilot to {target.title}… steer to take over</p>
        ) : found.length === 0 ? (
          <p className="hint">{touch ? 'Drag to steer — head for the orange beacon' : 'Arrow keys to steer — head for the orange beacon'}</p>
        ) : null
      )}

      {/* ---------- STOP CARD ---------- */}
      {stop && !quickView && (
        <aside key={stop.id} className="card" role="dialog" aria-labelledby={`card-${stop.id}`} style={{ '--c': stop.color }}>
          <button className="card__close" onClick={closeCard} aria-label="Close and keep flying"><X size={18} /></button>
          <div className="card__scroll" id={`card-${stop.id}`}>
            <StopContent stop={stop} headingLevel={2} />
          </div>
          <div className="card__foot">
            <span>{found.length} of {STOPS.length} found</span>
            <button className="btn btn--primary btn--small" onClick={closeCard}>
              <Plane size={16} /> Keep flying
            </button>
          </div>
        </aside>
      )}

      {showThanks && <p className="toast" role="status">You found every stop. Thanks for flying with me!</p>}

      {/* ---------- QUICK VIEW ---------- */}
      {quickView && (
        <div className="quick" role="dialog" aria-modal="true" aria-labelledby="quick-title" onClick={() => setQuickView(false)}>
          <div className="quick__panel" onClick={(e) => e.stopPropagation()}>
            <header className="quick__head">
              <div>
                <p className="intro__kicker">The no-flying version</p>
                <h2 id="quick-title">Chawaphong “Earth” Khunsoongnoen</h2>
              </div>
              <button className="card__close" onClick={() => setQuickView(false)} aria-label="Close quick view"><X size={18} /></button>
            </header>
            <div className="quick__body">
              {STOPS.map((s) => (
                <section key={s.id} className="quick__stop" style={{ '--c': s.color }}>
                  <StopContent stop={s} headingLevel={3} />
                  {!noWebGL && (
                    <button className="btn btn--ghost btn--small" onClick={() => { setQuickView(false); flyTo(s.id); }}>
                      <Plane size={14} /> Fly here
                    </button>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Same content for search engines and screen readers */}
      <div className="sr-only">
        {STOPS.map((s) => <StopContent key={s.id} stop={s} headingLevel={2} />)}
      </div>
    </div>
  );
}
