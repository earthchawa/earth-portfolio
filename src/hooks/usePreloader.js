import { useCallback, useEffect, useState } from 'react';

// Tracks real loading steps → progress 0–1.
// After `timeout` ms every step counts as done, so a slow asset never blocks the site.
export default function usePreloader(steps, timeout = 8000) {
  const [done, setDone] = useState(() => new Set());

  const complete = useCallback((step) => {
    setDone((prev) => (prev.has(step) ? prev : new Set(prev).add(step)));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => steps.forEach(complete), timeout);
    return () => clearTimeout(id);
  }, [steps, complete, timeout]);

  return [done.size / steps.length, complete];
}
