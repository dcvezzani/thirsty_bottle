import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { slotCount, slotToIndex } from './pileDrop';
import { openable } from './drag';
import { RelativeScrub } from './scrubGain';

const cards = (...hs: string[]) => hs.map((h) => ({ h }));

describe('pile drop slots (2.1)', () => {
  it('slot 0 is the top and the last slot is the bottom', () => {
    const c = cards('a', 'b', 'c');
    expect(slotCount(c, new Set())).toBe(4);
    expect([0, 1, 2, 3].map((s) => slotToIndex(c, new Set(), s))).toEqual([0, 1, 2, 3]);
    expect(slotToIndex(c, new Set(), 9)).toBe(3); // never past the bottom
    expect(slotToIndex(c, new Set(), -2)).toBe(0);
  });

  it('carried cards are not slots: a slot counts only the cards that stay', () => {
    const c = cards('a', 'b', 'c', 'd');
    const carried = new Set(['b']);
    expect(slotCount(c, carried)).toBe(4); // a, c, d stay: four gaps
    // the full-list index leaves the carried card where it is, so endDrag's subtraction lines up
    expect([0, 1, 2, 3].map((s) => slotToIndex(c, carried, s))).toEqual([0, 1, 3, 4]);
  });

  it('putting a card back where it was is the same slot', () => {
    const c = cards('a', 'b', 'c');
    const carried = new Set(['b']);
    const index = slotToIndex(c, carried, 1); // between a and c
    const before = c.slice(0, index).filter((x) => carried.has(x.h)).length;
    expect(index - before).toBe(1);
    expect(c.findIndex((x) => x.h === 'b')).toBe(index - before);
  });

  it('the slot follows travel, starts on top and stays within the pile', () => {
    const c = cards(...Array.from({ length: 30 }, (_, i) => `c${i}`));
    const n = slotCount(c, new Set());
    const rs = new RelativeScrub(n, 0, { x: 100, t: 0 }, 375);
    expect(slotToIndex(c, new Set(), rs.update({ x: 100, t: 20 }))).toBe(0); // no movement: on top
    let x = 100;
    let t = 20;
    let slot = 0;
    for (let i = 0; i < 6; i++) {
      x += 4; // slow: 24 px at 0.05 px/ms
      t += 80;
      slot = rs.update({ x, t });
    }
    expect(slot).toBeGreaterThanOrEqual(1);
    expect(slot).toBeLessThanOrEqual(3);
    for (let i = 0; i < 40; i++) {
      x += 30; // a fast sweep far past the end
      t += 12;
      slot = rs.update({ x, t });
    }
    expect(slotToIndex(c, new Set(), slot)).toBe(30);
  });
});

describe('which zones open under a held drag (1.1)', () => {
  beforeAll(() => {
    // jsdom has no CSS.escape
    (globalThis as any).CSS ??= { escape: (v: string) => v.replace(/[^\w-]/g, '\\$&') };
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });
  const zone = (id: string, cls: string, count: number) => {
    const el = document.createElement('section');
    el.className = `zone ${cls}`;
    el.setAttribute('data-drop-zone', id);
    el.setAttribute('data-count', String(count));
    document.body.appendChild(el);
  };

  it('a fit-width spread opens, as before', () => {
    zone('s1', 'zone-spread w-fit', 3);
    expect(openable('s1')).toBe(true);
  });

  it('a pile with cards opens, an empty pile does not', () => {
    zone('p1', 'zone-pile w-fit', 20);
    zone('p2', 'zone-pile w-fit', 0);
    expect(openable('p1')).toBe(true);
    expect(openable('p2')).toBe(false);
  });

  it('other zones still do not open', () => {
    zone('c1', 'zone-column w-fit', 5);
    zone('f1', 'zone-free w-full', 5);
    zone('s2', 'zone-spread w-full', 5);
    expect(openable('c1')).toBe(false);
    expect(openable('f1')).toBe(false);
    expect(openable('s2')).toBe(false);
  });
});
