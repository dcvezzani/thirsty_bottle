import { describe, expect, it } from 'vitest';
import { formatCount, parseCount } from './setupCount';

describe('setup count text (table-setups 4.1)', () => {
  it('numbers, rest and per-player rules round-trip', () => {
    for (const t of ['7', 'rest', '2:10, 3-4:7', '3-6:rest']) expect(formatCount(parseCount(t)!)).toBe(t);
    expect(parseCount('')).toBe(0);
    expect(parseCount(' 2p : 10 , 3-4p:7 ')).toEqual({ byPlayers: [{ min: 2, max: 2, n: 10 }, { min: 3, max: 4, n: 7 }] });
  });
  it('unreadable text is null', () => {
    for (const t of ['seven', '2:', '5-3:4', '13:2', '-1']) expect(parseCount(t)).toBeNull();
  });
});
