import type { SetupCount } from '@vct/shared';

/**
 * Card counts in the setup editor as short text: "7", "rest", or per player count
 * "2:10, 3-4:7" (10 cards for 2 players, 7 for 3 or 4; "rest" allowed as a value).
 */
export function formatCount(c: SetupCount | undefined): string {
  if (c === undefined) return '';
  if (typeof c === 'number' || c === 'rest') return String(c);
  return c.byPlayers.map((r) => `${r.min === r.max ? r.min : `${r.min}-${r.max}`}:${r.n}`).join(', ');
}

/** Parses editor text; returns null when it can't be read (the field shows an error). Empty = 0. */
export function parseCount(text: string): SetupCount | null {
  const t = text.trim().toLowerCase();
  if (!t) return 0;
  const one = (v: string): number | 'rest' | null => (v === 'rest' ? 'rest' : /^\d{1,4}$/.test(v) ? Number(v) : null);
  if (!t.includes(':')) return one(t);
  const rules = [];
  for (const part of t.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*p?\s*:\s*(\w+)$/.exec(part);
    if (!m) return null;
    const min = Number(m[1]);
    const max = m[2] ? Number(m[2]) : min;
    const n = one(m[3]);
    if (n === null || min < 1 || max > 12 || min > max) return null;
    rules.push({ min, max, n });
  }
  return rules.length ? { byPlayers: rules } : null;
}
