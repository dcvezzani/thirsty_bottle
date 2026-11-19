import { describe, expect, it } from 'vitest';
import { CAP, UP_MIN, columnHit, columnLayout, columnMagnify } from './column';

const H = 89.6; // card height at a 64px card width
const faces = (down: number, up: number) => [...Array(down).fill(false), ...Array(up).fill(true)];

describe('column layout (zone-arrangement 3.1)', () => {
  it('6 face-down + 6 face-up stays within about 2.5 card heights; ranks visible; last card full', () => {
    const l = columnLayout(faces(6, 6), H);
    expect(l.height).toBeLessThanOrEqual(CAP * H + 0.5);
    for (let i = 6; i < 11; i++) expect(l.step[i]).toBeGreaterThanOrEqual(4 + UP_MIN * H - 0.01);
    expect(l.height - l.y.at(-1)!).toBeCloseTo(H);
  });

  it('6 face-down + 13 face-up keeps every rank visible and grows instead of hiding them', () => {
    const l = columnLayout(faces(6, 13), H);
    for (let i = 6; i < 18; i++) expect(l.step[i]).toBeGreaterThanOrEqual(4 + UP_MIN * H - 0.01);
    expect(l.height).toBeGreaterThan(CAP * H);
    expect(l.height).toBeLessThan(3.3 * H);
  });

  it('short columns use the natural steps (face-down slivers, face-up corners)', () => {
    const l = columnLayout(faces(2, 2), H);
    expect(l.step[0]).toBeCloseTo(0.07 * H);
    expect(l.step[2]).toBeCloseTo(0.22 * H);
  });

  it('the fisheye opens the focused card and its neighbours, and springs back', () => {
    const l = columnLayout(faces(6, 6), H);
    const m = columnMagnify(l, 7);
    expect(m.step[7]).toBeCloseTo(0.75 * H); // the focused card is readable
    expect(m.step[6]).toBeGreaterThanOrEqual(0.35 * H - 0.01); // the card above opens partway
    expect(m.step[8]).toBeGreaterThanOrEqual(0.35 * H - 0.01);
    expect(m.step[0]).toBe(l.step[0]); // far cards stay compressed
    expect(columnMagnify(l, null)).toBe(l);
    // compressed layout itself is unchanged (the opened view is drawn as an overlay)
    expect(l.height).toBeLessThanOrEqual(CAP * H + 0.5);
  });

  it('hit test finds the visible card at a y position', () => {
    const l = columnLayout(faces(2, 3), H);
    expect(columnHit(l, l.y[3] + 2)).toBe(3);
    expect(columnHit(l, l.y[4] + H - 1)).toBe(4);
    expect(columnHit(l, l.height + 5)).toBeNull();
  });
});
