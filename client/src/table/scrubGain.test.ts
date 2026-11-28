import { describe, expect, it } from 'vitest';
import { RelativeScrub, SLOW_PX_PER_CARD, scrubGain } from './scrubGain';

/** Moves a finger from x0 by `dist` px at `speed` px/ms in steps of `step` px, returning the final index. */
function drag(rs: RelativeScrub, x0: number, t0: number, dist: number, speed: number, step = 4) {
  let x = x0;
  let t = t0;
  let idx = 0;
  const dir = Math.sign(dist);
  for (let moved = 0; moved < Math.abs(dist); moved += step) {
    x += dir * step;
    t += step / speed;
    idx = rs.update({ x, t });
  }
  return { idx, x, t };
}

describe('pile scrub gain (1.2)', () => {
  it('is one card per ~12 px when slow, and a screen-wide sweep covers the pile when fast', () => {
    expect(scrubGain(0.02, 52, 375)).toBeCloseTo(1 / SLOW_PX_PER_CARD, 5);
    expect(scrubGain(0.3, 52, 375)).toBeCloseTo(1 / SLOW_PX_PER_CARD, 5); // 300 px/s is still slow
    expect(scrubGain(2, 52, 375)).toBeCloseTo(52 / 375, 5);
    // in between it grows smoothly and never decreases with speed
    let prev = 0;
    for (let v = 0; v <= 2; v += 0.05) {
      const g = scrubGain(v, 52, 375);
      expect(g).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = g;
    }
  });

  it('ordinary finger speeds stay fine: at 800 px/s a card is still more than 8 px, even for a sweep sized for a short distance', () => {
    expect(1 / scrubGain(0.5, 52, 375)).toBeGreaterThan(11);
    expect(1 / scrubGain(0.8, 52, 375)).toBeGreaterThan(10);
    expect(1 / scrubGain(0.5, 52, 150)).toBeGreaterThan(11); // the drop's span
    expect(1 / scrubGain(0.8, 52, 150)).toBeGreaterThan(8);
    expect(1 / scrubGain(3, 52, 150)).toBeLessThan(3.5); // a flick covers the pile within 150 px
  });

  it('a short pile never scrubs coarser than card by card', () => {
    expect(scrubGain(2, 5, 375)).toBeCloseTo(1 / SLOW_PX_PER_CARD, 5);
  });

  it('slow movement steps card by card: 36 px is about three cards', () => {
    const rs = new RelativeScrub(52, 0, { x: 100, t: 0 }, 375);
    const { idx } = drag(rs, 100, 0, 36, 0.05);
    expect(idx).toBe(3);
  });

  it('a fast sweep across the screen reaches the end of the pile', () => {
    const rs = new RelativeScrub(52, 0, { x: 10, t: 0 }, 375);
    const { idx } = drag(rs, 10, 0, 360, 3, 12);
    expect(idx).toBeGreaterThan(45);
  });

  it('a fast sweep then slow steps lands exactly: fine control near the target', () => {
    const rs = new RelativeScrub(52, 0, { x: 10, t: 0 }, 375);
    const fast = drag(rs, 10, 0, 180, 3, 10);
    const slow = drag(rs, fast.x, fast.t + 60, 24, 0.05, 2); // 2 more cards to the right
    expect(slow.idx - fast.idx).toBeGreaterThanOrEqual(1);
    expect(slow.idx - fast.idx).toBeLessThanOrEqual(3);
    const back = drag(rs, slow.x, slow.t + 60, -12, 0.05, 2); // one card back
    expect(slow.idx - back.idx).toBe(1);
  });

  it('stays within the pile and the first press starts on the top card', () => {
    const rs = new RelativeScrub(10, 0, { x: 50, t: 0 }, 375);
    expect(rs.update({ x: 40, t: 20 })).toBe(0); // moving left of the start does nothing
    const { idx } = drag(rs, 40, 20, 600, 3, 12);
    expect(idx).toBe(9);
  });
});
