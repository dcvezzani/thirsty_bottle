import { describe, expect, it } from 'vitest';
import { BAND_PX, DWELL_MS, EdgeScroller, bandSpeed } from './edgeScroll';

describe('edge auto-scroll while dragging (table-scrolling 3.1)', () => {
  const top = 100;
  const bottom = 700;
  it('scrolls only inside the bands, faster closer to the edge', () => {
    expect(bandSpeed(400, top, bottom)).toBe(0);
    expect(bandSpeed(bottom + 10, top, bottom)).toBe(0); // below the board (hand area)
    expect(bandSpeed(top - 10, top, bottom)).toBe(0);
    const inner = bandSpeed(bottom - BAND_PX + 1, top, bottom);
    const outer = bandSpeed(bottom - 1, top, bottom);
    expect(inner).toBeGreaterThan(0);
    expect(outer).toBeGreaterThan(inner);
    expect(bandSpeed(top + 1, top, bottom)).toBeLessThan(bandSpeed(top + BAND_PX - 1, top, bottom));
    expect(bandSpeed(top + 1, top, bottom)).toBeLessThan(0);
  });

  it('waits for the dwell; passing through or switching bands restarts it', () => {
    const e = new EdgeScroller();
    const y = bottom - 10;
    expect(e.speed(y, 0, top, bottom)).toBe(0);
    expect(e.speed(y, DWELL_MS - 1, top, bottom)).toBe(0);
    expect(e.speed(y, DWELL_MS, top, bottom)).toBeGreaterThan(0);
    // leave the band: reset
    expect(e.speed(400, DWELL_MS + 10, top, bottom)).toBe(0);
    expect(e.speed(y, DWELL_MS + 20, top, bottom)).toBe(0);
    // a quick pass through (in band for 100 ms) never scrolls
    const f = new EdgeScroller();
    for (let t = 0; t <= 100; t += 16) expect(f.speed(bottom - 20, t, top, bottom)).toBe(0);
    expect(f.speed(400, 120, top, bottom)).toBe(0);
  });

  it('short boards: the bands never overlap', () => {
    expect(bandSpeed(150, 100, 200)).toBe(0); // middle of a 100px board
  });
});
