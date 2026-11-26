import { describe, expect, it } from 'vitest';
import { fitInBox, rotationPad, rotationTransform, turnedRoom, zonePad } from './rotation';

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
  it('a pile counts only its top card, a free zone nothing, a spread every card', () => {
    const cards = [{ rot: 0 }, { rot: 1 }];
    expect(zonePad({ layout: 'pile', cards })).toEqual({ x: 0, y: 0 });
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
