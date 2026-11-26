import { describe, expect, it } from 'vitest';
import { fitInBox, rotationFit, rotationTransform } from './rotation';

describe('rotation fit (1.1)', () => {
  it('is 100% upright and upside down, about 71% sideways, about 59% on the diagonals', () => {
    expect(rotationFit(0)).toBe(1);
    expect(rotationFit(4)).toBeCloseTo(1, 6);
    expect(rotationFit(2)).toBeCloseTo(1 / 1.4, 3);
    expect(rotationFit(6)).toBeCloseTo(1 / 1.4, 3);
    for (const r of [1, 3, 5, 7]) expect(rotationFit(r)).toBeCloseTo(0.589, 2);
  });
  it('a card never grows, and its rotated box fits the slot', () => {
    for (let r = 0; r < 8; r++) {
      const f = rotationFit(r);
      expect(f).toBeLessThanOrEqual(1);
      const t = (r * Math.PI) / 4;
      const w = (Math.abs(Math.cos(t)) + 1.4 * Math.abs(Math.sin(t))) * f;
      const h = (Math.abs(Math.sin(t)) + 1.4 * Math.abs(Math.cos(t))) * f;
      expect(w).toBeLessThanOrEqual(1 + 1e-9);
      expect(h).toBeLessThanOrEqual(1.4 + 1e-9);
    }
  });
  it('the transform is empty upright and rotates then scales otherwise', () => {
    expect(rotationTransform(undefined)).toBeUndefined();
    expect(rotationTransform(0)).toBeUndefined();
    expect(rotationTransform(2)).toMatch(/^rotate\(90deg\) scale\(0\.71/);
    expect(rotationTransform(9)).toBe(rotationTransform(1)); // wraps
  });
});

describe('fit in a box (3.1)', () => {
  it('a card in a square box is shown larger at 45 degrees than in its portrait slot', () => {
    const inSquare = fitInBox(1, 100, 140, 140, 140);
    expect(inSquare).toBeCloseTo(0.825, 2);
    expect(inSquare).toBeGreaterThan(rotationFit(1));
  });
  it('upright it fits the square exactly, and never exceeds 1', () => {
    expect(fitInBox(0, 100, 140, 140, 140)).toBe(1);
    for (let r = 0; r < 8; r++) expect(fitInBox(r, 100, 140, 140, 140)).toBeLessThanOrEqual(1);
  });
  it('an explicit fit overrides the slot fit in the transform', () => {
    expect(rotationTransform(1, undefined, 0.8)).toBe('rotate(45deg) scale(0.8000)');
  });
});
