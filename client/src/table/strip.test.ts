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

import { edgePush, edgeStep, zoneAtX, EDGE_MS } from './strip';

describe('header strip helpers (2.1)', () => {
  const row = [
    { id: 'a', left: 10, right: 90 },
    { id: 'b', left: 94, right: 200 },
    { id: 'c', left: 204, right: 360 },
  ];
  it('picks the zone under the finger, and the nearest over a gap or beside the row', () => {
    expect(zoneAtX(row, 50)).toBe('a');
    expect(zoneAtX(row, 150)).toBe('b');
    expect(zoneAtX(row, 92)).toBe('a');
    expect(zoneAtX(row, 202)).toBe('b');
    expect(zoneAtX(row, 2)).toBe('a');
    expect(zoneAtX(row, 374)).toBe('c');
    expect(zoneAtX([], 10)).toBeNull();
  });
  it('knows which edge of the screen the finger pushes against', () => {
    expect(edgePush(372, 375)).toBe(1);
    expect(edgePush(5, 375)).toBe(-1);
    expect(edgePush(180, 375)).toBe(0);
  });
  it('steps a row after a push of EDGE_MS, and again every period, but not when the finger moves away', () => {
    let st = { dir: 0 as -1 | 0 | 1, since: 0 };
    let r = edgeStep(st, 1, 100);
    expect(r.step).toBe(0);
    st = r.state;
    r = edgeStep(st, 1, 100 + EDGE_MS - 10);
    expect(r.step).toBe(0);
    r = edgeStep(r.state, 1, 100 + EDGE_MS + 5);
    expect(r.step).toBe(1);
    st = r.state;
    r = edgeStep(st, 1, 100 + EDGE_MS + 5 + EDGE_MS + 1);
    expect(r.step).toBe(1);
    r = edgeStep(r.state, 0, 2000);
    expect(r.step).toBe(0);
    r = edgeStep(r.state, -1, 2100);
    r = edgeStep(r.state, -1, 2100 + EDGE_MS);
    expect(r.step).toBe(-1);
  });
});
