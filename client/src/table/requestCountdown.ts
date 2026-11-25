import { useEffect, useState } from 'react';

/** request-expiry: when each request lapses on this device's clock, fixed on first sight so the server's and this device's clocks need not agree. */
const deadlines = new Map<string, { at: number; total: number }>();

export function requestDeadline(id: string, msLeft: number, now = performance.now()) {
  let d = deadlines.get(id);
  if (!d) {
    d = { at: now + msLeft, total: Math.max(msLeft, 1) };
    deadlines.set(id, d);
    if (deadlines.size > 50) deadlines.delete(deadlines.keys().next().value!);
  }
  return d;
}

/** Whole seconds left (rounded up) and the fraction of the wait remaining; re-renders a few times a second. */
export function useCountdown(id: string, msLeft: number): { seconds: number; fraction: number; over: boolean } {
  const d = requestDeadline(id, msLeft);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(t);
  }, [id]);
  const left = Math.max(0, d.at - now);
  return { seconds: Math.ceil(left / 1000), fraction: Math.min(1, left / d.total), over: left <= 0 };
}
