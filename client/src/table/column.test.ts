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

  it('the fisheye opens the cards from the focused card downwards, and springs back', () => {
    const l = columnLayout(faces(6, 6), H);
    const m = columnMagnify(l, 7);
    expect(m.step[7]).toBeCloseTo(0.75 * H); // the focused card is readable
    expect(m.step[8]).toBeGreaterThanOrEqual(0.35 * H - 0.01); // the card below opens partway
    expect(m.step[6]).toBe(l.step[6]); // the card above does not open
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

describe('the card under the finger is the card shown (1.1)', () => {
  const mixed = [false, false, true, false, false, false, true, true, false, false, true, false];
  const l = columnLayout(mixed, H);

  it('the focused card and every card above it are where they are in the compressed column', () => {
    for (let f = 0; f < mixed.length; f++) {
      const m = columnMagnify(l, f);
      for (let i = 0; i <= f; i++) expect(m.y[i]).toBeCloseTo(l.y[i], 6);
      expect(columnHit(m, l.y[f] + 1)).toBe(f);
    }
  });

  // a finger path over the column, the focus fed back after every move (what a scrub does)
  function run(path: number[], start: number) {
    let focus: number | null = start;
    const seen: number[] = [];
    for (const y of path) {
      const hit = columnHit(columnMagnify(l, focus), y);
      if (hit === null) continue;
      focus = hit;
      seen.push(hit);
      // after the layout redraws around the new focus the card at the finger is still the focus
      expect(columnHit(columnMagnify(l, focus), y)).toBe(focus);
    }
    return seen;
  }
  it('scrubbing down never skips a card and never runs ahead of the finger', () => {
    const path = Array.from({ length: 120 }, (_, k) => 2 + k * 1.5);
    const seen = run(path, columnHit(l, 2)!);
    for (let k = 1; k < seen.length; k++) expect(seen[k] - seen[k - 1]).toBeLessThanOrEqual(1);
    expect(seen.at(-1)).toBeGreaterThan(5);
  });
  it('scrubbing back up does not skip a card either, and ends on the card it passes', () => {
    const down = Array.from({ length: 140 }, (_, k) => 2 + k * 1.5);
    const up = [...down].reverse();
    const seen = run([...down, ...up], columnHit(l, 2)!);
    for (let k = 1; k < seen.length; k++) expect(Math.abs(seen[k] - seen[k - 1])).toBeLessThanOrEqual(1);
    expect(seen.at(-1)).toBe(0);
  });
  it('a still finger does not drift: refocusing on the card it shows leaves the same card under it', () => {
    for (let f = 1; f < mixed.length; f++) {
      const y = l.y[f] + 1;
      let focus: number | null = columnHit(l, y);
      for (let k = 0; k < 4; k++) focus = columnHit(columnMagnify(l, focus), y);
      expect(focus).toBe(f);
    }
  });
});
