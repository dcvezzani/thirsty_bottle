import { describe, expect, it } from 'vitest';
import { fitInBox, outline, pileCorner, pileShown, rotationPad, rotationTransform, turnedRoom, zonePad } from './rotation';

describe('room for turned cards (1.1)', () => {
  it('an upright or upside-down card needs no room; 90 degrees needs sideways room only; the diagonals need both', () => {
    expect(turnedRoom(0)).toEqual({ x: 0, y: 0 });
    expect(turnedRoom(4).x).toBeCloseTo(0, 6);
    expect(turnedRoom(4).y).toBeCloseTo(0, 6);
    expect(turnedRoom(2).x).toBeCloseTo(0.2, 3);
    expect(turnedRoom(2).y).toBe(0);
    expect(turnedRoom(6).x).toBeCloseTo(0.2, 3);
    for (const r of [1, 3, 5, 7]) {
      expect(turnedRoom(r).x).toBeCloseTo(0.348, 2);
      expect(turnedRoom(r).y).toBeCloseTo(0.148, 2);
    }
  });
  it('a zone reserves the largest room any of its cards needs', () => {
    expect(rotationPad([])).toEqual({ x: 0, y: 0 });
    expect(rotationPad([0, 4])).toEqual({ x: 0, y: 0 });
    expect(rotationPad([2, 0]).x).toBeCloseTo(0.2, 3);
    const both = rotationPad([2, 1]);
    expect(both.x).toBeCloseTo(0.348, 2);
    expect(both.y).toBeCloseTo(0.148, 2);
  });
  it('the room contains the turned card: the box of a card of width 1 turned by r fits inside the room around its slot', () => {
    for (let r = 0; r < 8; r++) {
      const t = (r * Math.PI) / 4;
      const w = Math.abs(Math.cos(t)) + 1.4 * Math.abs(Math.sin(t));
      const h = Math.abs(Math.sin(t)) + 1.4 * Math.abs(Math.cos(t));
      const p = rotationPad([r]);
      expect(w).toBeLessThanOrEqual(1 + 2 * p.x + 1e-6);
      expect(h).toBeLessThanOrEqual(1.4 + 2 * p.y + 1e-6);
    }
  });
  it('a pile counts the cards it draws, a free zone nothing, a spread every card', () => {
    const cards = [{ rot: 0 }, { rot: 1 }];
    expect(zonePad({ layout: 'pile', cards }).x).toBeCloseTo(0.348, 2); // the 45° card beneath is drawn, so the pile makes room
    expect(zonePad({ layout: 'pile', cards: [{ rot: 0 }, { rot: 4 }, { rot: 0 }] })).toEqual({ x: 0, y: 0 }); // same outlines: nothing sticks out
    expect(zonePad({ layout: 'pile', cards: [{ rot: 1 }, { rot: 0 }] }).x).toBeCloseTo(0.348, 2);
    expect(zonePad({ layout: 'free', cards })).toEqual({ x: 0, y: 0 });
    expect(zonePad({ layout: 'spread', cards }).x).toBeCloseTo(0.348, 2);
    expect(zonePad({ layout: 'column', cards }).y).toBeCloseTo(0.148, 2);
    expect(zonePad({ layout: 'spread', cards: [] })).toEqual({ x: 0, y: 0 });
  });
  it('the table transform is a plain rotation, and an explicit fit still applies for the loupe', () => {
    expect(rotationTransform(undefined)).toBeUndefined();
    expect(rotationTransform(0)).toBeUndefined();
    expect(rotationTransform(2)).toBe('rotate(90deg)');
    expect(rotationTransform(9)).toBe(rotationTransform(1)); // wraps
    expect(rotationTransform(1, 0.8)).toBe('rotate(45deg) scale(0.8000)');
  });
});

describe('fit in a box (3.1)', () => {
  it('a card in a square box is shown larger at 45 degrees than in its portrait slot', () => {
    const inSquare = fitInBox(1, 100, 140, 140, 140);
    expect(inSquare).toBeCloseTo(0.825, 2);
    expect(inSquare).toBeGreaterThan(fitInBox(1, 100, 140, 100, 140));
  });
  it('upright it fits the square exactly, and never exceeds 1', () => {
    expect(fitInBox(0, 100, 140, 140, 140)).toBe(1);
    for (let r = 0; r < 8; r++) expect(fitInBox(r, 100, 140, 140, 140)).toBeLessThanOrEqual(1);
  });
});

describe('which cards a pile draws (1.1)', () => {
  it('the outline is the rotation modulo 180 degrees', () => {
    expect([0, 4, 1, 5, 2, 6, 3, 7, 8, -1].map(outline)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 0, 3]);
  });
  it('an empty pile draws nothing and a one-card pile only its top', () => {
    expect(pileShown([])).toEqual([]);
    expect(pileShown([3])).toEqual([0]);
  });
  it('three alike cards then a differently turned one draws the different one', () => {
    expect(pileShown([0, 0, 0, 2, 2])).toEqual([0, 3]);
  });
  it('a card turned 180 degrees under an upright top is skipped, and so is a card alike in outline further down', () => {
    expect(pileShown([0, 4, 0, 4])).toEqual([0]);
    expect(pileShown([0, 4, 1, 5, 1])).toEqual([0, 2]);
  });
  it('45 and 135 degrees are different outlines', () => {
    expect(pileShown([1, 3, 1, 3])).toEqual([0, 1]);
  });
  it('draws at most three beneath the top, however many cards are in the pile', () => {
    expect(pileShown([0, 1, 2, 3, 0, 1, 2, 3, 5, 6])).toEqual([0, 1, 2, 3]);
    expect(pileShown(Array.from({ length: 60 }, (_, i) => i % 8))).toHaveLength(4);
  });
  it('the order follows the pile from the top', () => {
    expect(pileShown([2, 0, 3, 0, 1])).toEqual([0, 1, 2, 4]);
  });
  it('the room follows the drawn cards and goes when they are upright', () => {
    expect(zonePad({ layout: 'pile', cards: [{ rot: 0 }, { rot: 0 }, { rot: 2 }] }).x).toBeCloseTo(0.2, 3);
    expect(zonePad({ layout: 'pile', cards: [{ rot: 0 }, { rot: 0 }, { rot: 0 }] })).toEqual({ x: 0, y: 0 });
  });
});

describe('the corner arrangement of a mixed pile (1.1)', () => {
  it('one outline is not a corner pile: it stays centred with no one-sided room', () => {
    for (const rots of [[0], [0, 4], [2, 6], [1, 5, 1], []]) {
      const c = pileCorner(rots);
      expect(c.corner).toBe(false);
      expect(c.right).toBe(0);
      expect(c.top).toBe(0);
    }
  });
  it('an upright card over a 90 degree card: room 0.4 on the right and none above', () => {
    const c = pileCorner([0, 2]);
    expect(c.corner).toBe(true);
    expect(c.right).toBeCloseTo(0.4, 6);
    expect(c.top).toBe(0);
  });
  it('an upright card over a 45 degree card: room to the right and above (an L)', () => {
    const c = pileCorner([0, 1]);
    expect(c.corner).toBe(true);
    expect(c.right).toBeCloseTo(0.697, 2);
    expect(c.top).toBeCloseTo(0.297, 2);
  });
  it('a 90 degree top card over an upright card: room on the right (the landscape card is wider than the slot), none above', () => {
    const c = pileCorner([2, 0]);
    expect(c.corner).toBe(true);
    expect(c.right).toBeCloseTo(0.4, 6);
    expect(c.top).toBe(0);
  });
  it('the offsets put every box at the bottom-left corner of the slot', () => {
    const c = pileCorner([0, 1, 2]);
    expect(c.place(0)).toEqual({ dx: 0, dy: 0 });
    expect(c.place(4)).toEqual({ dx: 0, dy: 0 });
    // 90 degrees: a landscape box 1.4 wide and 1 high, its centre moves right by 0.2 and down by 0.2
    expect(c.place(2).dx).toBeCloseTo(0.2, 6);
    expect(c.place(2).dy).toBeCloseTo(0.2, 6);
    // 45 degrees: a 1.697 square box, its centre moves right by 0.348 and up by 0.148
    expect(c.place(1).dx).toBeCloseTo(0.348, 2);
    expect(c.place(1).dy).toBeCloseTo(-0.148, 2);
    // after the shift each box's left and bottom edges are the slot's: centre - half the box
    for (const r of [0, 1, 2, 3]) {
      const t = (r * Math.PI) / 4;
      const w = Math.abs(Math.cos(t)) + 1.4 * Math.abs(Math.sin(t));
      const h = Math.abs(Math.sin(t)) + 1.4 * Math.abs(Math.cos(t));
      const p = c.place(r);
      expect(0.5 + p.dx - w / 2).toBeCloseTo(0, 6); // left edge at 0
      expect(0.7 + p.dy + h / 2).toBeCloseTo(1.4, 6); // bottom edge at the slot's bottom (CSS y = 1.4)
    }
  });
  it('a corner pile reserves room only on the right and above, in the form the board flow doubles', () => {
    const pad = zonePad({ layout: 'pile', cards: [{ rot: 0 }, { rot: 1 }] });
    expect(pad.x * 2).toBeCloseTo(0.697, 2);
    expect(pad.y * 2).toBeCloseTo(0.297, 2);
  });
  it('a pile with one outline keeps the symmetric room, and none when upright', () => {
    expect(zonePad({ layout: 'pile', cards: [{ rot: 1 }, { rot: 5 }] }).x).toBeCloseTo(0.348, 2);
    expect(zonePad({ layout: 'pile', cards: [{ rot: 0 }, { rot: 4 }] })).toEqual({ x: 0, y: 0 });
  });
  it('the room goes when the differently turned card is upright again', () => {
    expect(zonePad({ layout: 'pile', cards: [{ rot: 0 }, { rot: 2 }] }).x).toBeGreaterThan(0);
    expect(zonePad({ layout: 'pile', cards: [{ rot: 0 }, { rot: 0 }] })).toEqual({ x: 0, y: 0 });
  });
  it('the turn transform can carry a shift in card widths', () => {
    expect(rotationTransform(1, undefined, { dx: 0.2, dy: -0.1 })).toBe('translate(calc(var(--card-w) * 0.2000), calc(var(--card-w) * -0.1000)) rotate(45deg)');
    expect(rotationTransform(1, undefined, { dx: 0, dy: 0 })).toBe('rotate(45deg)');
  });
});
