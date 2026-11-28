import { describe, expect, it } from 'vitest';
import { LENS_CARDS, LENS_SLOT, MIN_SLOT, createLens, uniformIndex } from './scrubLens';

const L0 = 6;
const W = 363; // a phone board's content width

const slots = (lens: ReturnType<typeof createLens>) => Array.from({ length: lens.n }, (_, i) => lens.slot(i));

describe('scrub lens (1.1)', () => {
  it('a press lands on the card a plain layout puts there', () => {
    expect(uniformIndex(52, L0, W, L0)).toBe(0);
    expect(uniformIndex(52, L0, W, L0 + W - 1)).toBe(51);
    expect(uniformIndex(52, L0, W, L0 + W / 2)).toBe(26);
  });

  it('spans the board: the first card at the left end, the last at the right end, in order', () => {
    for (const x of [L0 + 4, L0 + 100, L0 + 180, L0 + 300, L0 + W - 5]) {
      const lens = createLens(52, L0, W, { x, card: uniformIndex(52, L0, W, x) });
      expect(lens.indexAt(L0)).toBe(0);
      expect(lens.indexAt(L0 + W - 0.5)).toBe(51);
      let prev = -1;
      for (let px = L0; px < L0 + W; px += 1) {
        const i = lens.indexAt(px);
        expect(i).toBeGreaterThanOrEqual(prev);
        prev = i;
      }
      expect(prev).toBe(51);
    }
  });

  it('every card can be reached: each has a slot of at least the minimum', () => {
    for (const n of [7, 30, 52, 104, 150]) {
      const lens = createLens(n, L0, W, { x: L0 + W * 0.6, card: uniformIndex(n, L0, W, L0 + W * 0.6) });
      for (const s of slots(lens)) expect(s.w).toBeGreaterThanOrEqual(MIN_SLOT - 1e-6);
      const reached = new Set<number>();
      for (let px = L0; px < L0 + W; px += 0.25) reached.add(lens.indexAt(px));
      expect(reached.size, `n=${n}`).toBe(n);
    }
  });

  it('inside the lens a card is about 15 px, and about six cards are in it', () => {
    const x = L0 + W * 0.5;
    const lens = createLens(52, L0, W, { x, card: uniformIndex(52, L0, W, x) });
    const wide = slots(lens).filter((s) => Math.abs(s.w - LENS_SLOT) < 0.01);
    expect(wide.length).toBe(LENS_CARDS);
    // stepping 15 px inside the lens moves one card
    const c = lens.indexAt(x);
    expect(lens.indexAt(x + LENS_SLOT)).toBe(c + 1);
    expect(lens.indexAt(x - LENS_SLOT)).toBe(c - 1);
    // outside it the cards are narrower than a plain layout's would be at the far ends (but never under the minimum)
    const outside = slots(lens).filter((s) => Math.abs(s.w - LENS_SLOT) >= 0.01);
    for (const s of outside) {
      expect(s.w).toBeLessThan(LENS_SLOT);
      expect(s.w).toBeGreaterThanOrEqual(MIN_SLOT);
    }
  });

  it('pinning keeps the finger on the same card: a rest anywhere changes only the surroundings', () => {
    let lens = createLens(52, L0, W, { x: L0 + 40, card: uniformIndex(52, L0, W, L0 + 40) });
    for (const x of [L0 + 120, L0 + 200, L0 + 260, L0 + 330, L0 + 90]) {
      const card = lens.indexAt(x);
      lens = createLens(52, L0, W, { x, card });
      expect(lens.indexAt(x), `at ${x}`).toBe(card);
    }
  });

  it('a pin near an end shifts the lens inward but still reaches the end card', () => {
    const left = createLens(52, L0, W, { x: L0 + 3, card: 0 });
    expect(left.indexAt(L0)).toBe(0);
    expect(left.slot(0).x).toBeCloseTo(L0, 5);
    const right = createLens(52, L0, W, { x: L0 + W - 3, card: 51 });
    expect(right.indexAt(L0 + W - 0.5)).toBe(51);
    expect(right.slot(51).x + right.slot(51).w).toBeCloseTo(L0 + W, 5);
  });

  it('a very large pile gets equal slots when nothing else fits, and a small pile has no lens', () => {
    const huge = createLens(400, L0, W, { x: L0 + 100, card: 40 });
    expect(huge.indexAt(L0)).toBe(0);
    expect(huge.indexAt(L0 + W - 0.5)).toBe(399);
    const few = createLens(4, L0, W, { x: L0 + 100, card: 1 });
    expect(few.slot(0).w).toBeCloseTo(W / 4, 5);
  });

  it('a pile that fits only a smaller lens shrinks the lens, never a card below the minimum', () => {
    const lens = createLens(150, L0, W, { x: L0 + 200, card: uniformIndex(150, L0, W, L0 + 200) });
    for (const s of slots(lens)) expect(s.w).toBeGreaterThanOrEqual(MIN_SLOT - 1e-6);
    const wide = slots(lens).filter((s) => s.w > MIN_SLOT + 1);
    expect(wide.length).toBeGreaterThan(0);
  });
});
