import { useState, useCallback, useEffect, useRef } from 'react';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, CORE_IDS, levelFor } from './achievements';

const SAVE_KEY = 'earth.save.v1';
const TOAST_MS = 2600;

const load = () => {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    return data && typeof data.unlocked === 'object' ? data : null;
  } catch {
    return null;
  }
};

const save = (data) => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode etc. */ }
};

const xpOf = (unlocked) => Object.keys(unlocked).reduce((sum, id) => sum + (ACHIEVEMENT_MAP[id]?.xp ?? 0), 0);

// Save state: { unlocked: { [id]: timestamp }, inspected: [projectId] }
export default function useGame({ onLevelUp } = {}) {
  const [state, setState] = useState(() => load() ?? { unlocked: {}, inspected: [] });
  const [toasts, setToasts] = useState([]); // queue: { key, kind: 'achievement' | 'level', ... }
  const stateRef = useRef(state);
  const onLevelUpRef = useRef(onLevelUp);

  useEffect(() => { onLevelUpRef.current = onLevelUp; });
  useEffect(() => { stateRef.current = state; save(state); }, [state]);

  // Pure state update; toasts are queued by the caller from the same diff
  const unlock = useCallback((...ids) => {
    const prev = stateRef.current;
    const fresh = ids.filter((id) => ACHIEVEMENT_MAP[id] && !prev.unlocked[id]);
    if (!fresh.length) return;

    const unlocked = { ...prev.unlocked };
    const now = Date.now();
    fresh.forEach((id) => { unlocked[id] = now; });
    if (!unlocked.complete && CORE_IDS.every((id) => unlocked[id])) {
      unlocked.complete = now;
      fresh.push('complete');
    }

    const before = levelFor(xpOf(prev.unlocked));
    const after = levelFor(xpOf(unlocked));
    const next = { ...prev, unlocked };
    stateRef.current = next;
    setState(next);

    const queued = fresh.map((id) => ({ key: `${id}-${now}`, kind: 'achievement', ...ACHIEVEMENT_MAP[id] }));
    if (after.level > before.level) {
      queued.push({ key: `lv-${after.level}-${now}`, kind: 'level', level: after.level, title: after.title });
      onLevelUpRef.current?.(after);
    }
    setToasts((t) => [...t, ...queued]);
  }, []);

  const inspect = useCallback((projectId, total) => {
    const prev = stateRef.current;
    if (prev.inspected.includes(projectId)) return;
    const inspected = [...prev.inspected, projectId];
    const next = { ...prev, inspected };
    stateRef.current = next;
    setState(next);
    if (inspected.length >= total) unlock('inspect');
  }, [unlock]);

  const reset = useCallback(() => {
    const next = { unlocked: {}, inspected: [] };
    stateRef.current = next;
    setState(next);
    setToasts([]);
  }, []);

  // Show one toast at a time
  useEffect(() => {
    if (!toasts.length) return undefined;
    const timer = setTimeout(() => setToasts((t) => t.slice(1)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  const xp = xpOf(state.unlocked);
  return {
    unlocked: state.unlocked,
    inspected: state.inspected,
    xp,
    totalXp: ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0),
    level: levelFor(xp),
    toast: toasts[0] ?? null,
    unlock,
    inspect,
    reset,
  };
}
