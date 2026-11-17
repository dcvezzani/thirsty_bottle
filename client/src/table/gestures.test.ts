import { describe, expect, it, vi } from 'vitest';
import { ZoneGesture, paintMode, applyPaint } from './gestures';
import { fanLayout, hitIndex, insertionIndex, magnify } from './layout';

// 10 cards, width 400, card 60px → spacing computed from layout
const L = fanLayout(10, 400, 60);
const hit = (x: number) => hitIndex(L, x);
const xOf = (i: number) => L.left + i * L.spacing + 2;

function rec() {
  const ev: string[] = [];
  const g = new ZoneGesture({
    hit: (x) => hit(x),
    onTap: (i) => ev.push(`tap:${i}`),
    onLongPress: (i) => ev.push(`long:${i}`),
    onScrubStart: (i) => ev.push(`scrubStart:${i}`),
    onScrub: (i) => ev.push(`scrub:${i}`),
    onScrubEnd: () => ev.push('scrubEnd'),
    onDragStart: (i) => ev.push(`dragStart:${i}`),
    onDragMove: () => ev.push('dragMove'),
    onDragEnd: () => ev.push('dragEnd'),
  });
  return { g, ev };
}

describe('layout math', () => {
  it('hit-tests overlapping cards by visible strip', () => {
    expect(hit(L.left - 5)).toBeNull();
    expect(hit(xOf(0))).toBe(0);
    expect(hit(xOf(7))).toBe(7);
    expect(hit(L.left + L.spacing * 9 + 50)).toBe(9); // last card is fully visible
  });
  it('insertion index between cards', () => {
    expect(insertionIndex(L, L.left)).toBe(0);
    expect(insertionIndex(L, L.left + L.spacing * 2 + L.cardW / 2)).toBe(3);
    expect(insertionIndex(L, 10_000)).toBe(10);
  });
  it('magnifies the focused card and pushes neighbours apart', () => {
    expect(magnify(L, 4, 4).scale).toBeGreaterThan(1.5);
    expect(magnify(L, 5, 4).dx).toBeGreaterThan(0);
    expect(magnify(L, 3, 4).dx).toBeLessThan(0);
    expect(magnify(L, 4, null)).toEqual({ dx: 0, dy: 0, scale: 1, z: 0 });
  });
  it('20 cards fit in a 375px-wide hand', () => {
    const h = fanLayout(20, 375, 64, { arc: true });
    expect(h.left + h.spacing * 19 + 64).toBeLessThanOrEqual(375);
    expect(h.spacing).toBeGreaterThan(10); // each card keeps a tappable strip
  });
});

describe('gesture recognizer', () => {
  it('tap', () => {
    const { g, ev } = rec();
    g.down({ x: xOf(3), y: 10, t: 0 });
    g.up({ x: xOf(3), y: 10, t: 100 });
    expect(ev).toEqual(['tap:3']);
  });
  it('still hold → long press (via tick), no tap on release', () => {
    const { g, ev } = rec();
    g.down({ x: xOf(2), y: 10, t: 0 });
    g.tick(300);
    expect(ev).toEqual([]);
    g.tick(460);
    g.up({ x: xOf(2), y: 10, t: 600 });
    expect(ev).toEqual(['long:2']);
  });
  it('small jitter under the slop still counts as a still hold', () => {
    const { g, ev } = rec();
    g.down({ x: xOf(2), y: 10, t: 0 });
    g.move({ x: xOf(2) + 4, y: 12, t: 200 });
    g.move({ x: xOf(2) + 3, y: 11, t: 470 });
    expect(ev).toEqual(['long:2']);
  });
  it('sideways movement scrubs across cards and release changes nothing else', () => {
    const { g, ev } = rec();
    g.down({ x: xOf(1), y: 10, t: 0 });
    g.move({ x: xOf(1) + 10, y: 11, t: 20 });
    g.move({ x: xOf(2), y: 12, t: 40 });
    g.move({ x: xOf(3), y: 9, t: 60 });
    g.move({ x: xOf(3) + 1, y: 9, t: 80 });
    g.up({ x: xOf(3), y: 9, t: 100 });
    expect(ev).toEqual(['scrubStart:1', 'scrub:2', 'scrub:3', 'scrubEnd']);
  });
  it('vertical movement drags', () => {
    const { g, ev } = rec();
    g.down({ x: xOf(4), y: 50, t: 0 });
    g.move({ x: xOf(4) + 2, y: 30, t: 20 });
    g.move({ x: xOf(4) + 2, y: 0, t: 40 });
    g.up({ x: xOf(4), y: -100, t: 60 });
    expect(ev).toEqual(['dragStart:4', 'dragMove', 'dragMove', 'dragEnd']);
  });
  it('scrub then pull out upward converts to a drag of the scrubbed card', () => {
    const { g, ev } = rec();
    g.down({ x: xOf(1), y: 10, t: 0 });
    g.move({ x: xOf(2), y: 10, t: 20 });
    g.move({ x: xOf(5), y: 10, t: 40 });
    g.move({ x: xOf(5), y: -40, t: 60 });
    g.move({ x: xOf(5), y: -80, t: 80 });
    g.up({ x: xOf(5), y: -80, t: 100 });
    expect(ev).toEqual(['scrubStart:1', 'scrub:2', 'scrub:5', 'scrubEnd', 'dragStart:5', 'dragMove', 'dragMove', 'dragEnd']);
  });
  it('non-scrub zones (piles) drag on any movement', () => {
    const ev: string[] = [];
    const g = new ZoneGesture({ hit: () => 0, onDragStart: (i) => ev.push(`dragStart:${i}`), onScrubStart: () => ev.push('scrub') }, { scrub: false });
    g.down({ x: 10, y: 10, t: 0 });
    g.move({ x: 30, y: 12, t: 20 });
    expect(ev).toEqual(['dragStart:0']);
  });
  it('cancel ends a scrub', () => {
    const onCancel = vi.fn();
    const ev: string[] = [];
    const g = new ZoneGesture({ hit, onScrubStart: () => ev.push('s'), onScrubEnd: () => ev.push('e'), onCancel });
    g.down({ x: xOf(1), y: 10, t: 0 });
    g.move({ x: xOf(3), y: 10, t: 20 });
    g.cancel();
    expect(ev).toEqual(['s', 'e']);
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('paint selection', () => {
  it('preview only when nothing selected; select/deselect decided by first card', () => {
    expect(paintMode(new Set(), 'a')).toBe('preview');
    expect(paintMode(new Set(['x']), 'a')).toBe('select');
    expect(paintMode(new Set(['a']), 'a')).toBe('deselect');
    let s = new Set(['x']);
    for (const h of ['a', 'b', 'c', 'd']) s = applyPaint(s, 'select', h);
    expect(s.size).toBe(5);
    for (const h of ['x', 'a', 'b']) s = applyPaint(s, 'deselect', h);
    expect([...s].sort()).toEqual(['c', 'd']);
    expect(applyPaint(s, 'preview', 'z')).toEqual(s);
  });
});
