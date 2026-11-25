import { describe, expect, it } from 'vitest';
import { buildStrip, neighbour, stripLabel } from './strip';

const zones = [
  { id: 'draw', row: 0, count: 5 },
  { id: 'disc', row: 0, count: 0 },
  { id: 'play', row: 0, count: 3 },
  { id: 'x', row: 1, count: 2 },
  { id: 'y', row: 2, count: 0 },
  { id: 'z', row: 3, count: 4 },
];

describe('scrub strip (1.1)', () => {
  it('lists the zones in reading order, passing over empty ones', () => {
    const s = buildStrip(zones);
    expect(s.map((e) => e.id)).toEqual(['draw', 'play', 'x', 'z']);
    expect(s.map((e) => e.row)).toEqual([1, 1, 2, 3]);
    expect(s[0].rows).toBe(3);
  });
  it('steps forwards across a row end into the next row, and backwards', () => {
    const s = buildStrip(zones);
    expect(neighbour(s, 'play', 1)?.id).toBe('x');
    expect(neighbour(s, 'x', -1)?.id).toBe('play');
    expect(neighbour(s, 'draw', 1)?.id).toBe('play'); // the empty zone between is skipped
  });
  it('ends at either end of the strip', () => {
    const s = buildStrip(zones);
    expect(neighbour(s, 'z', 1)).toBeNull();
    expect(neighbour(s, 'draw', -1)).toBeNull();
    expect(neighbour(s, 'nope', 1)).toBeNull();
  });
  it('a board with one zone has nowhere to go', () => {
    const s = buildStrip([{ id: 'a', row: 0, count: 2 }]);
    expect(neighbour(s, 'a', 1)).toBeNull();
    expect(stripLabel(s[0], 'Spread')).toBe('Spread');
  });
  it('labels the row when there are several', () => {
    expect(stripLabel(buildStrip(zones)[2], 'Discard')).toBe('Row 2 of 3 · Discard');
  });
});
