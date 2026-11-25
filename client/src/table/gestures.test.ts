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

describe('rotated fan hit-testing', () => {
  it('matches the rotated card under the point', async () => {
    const { fanLayout: fl, cardPos, hitIndexXY } = await import('./layout');
    const l = fl(12, 375, 64, { arc: true });
    for (let i = 0; i < 12; i++) {
      // a point near the bottom centre of card i's visible strip, rotated with the card
      const p = cardPos(l, i);
      const right = i < 11 ? cardPos(l, i + 1).x : p.x + 64;
      const cx = (p.x + Math.min(right, p.x + 64)) / 2;
      const y = 19 + p.y + l.cardH * 0.9;
      const a = (p.rot * Math.PI) / 180;
      const px = p.x + 32;
      const py = 19 + p.y + l.cardH;
      const x2 = px + (cx - px) * Math.cos(a) - (y - py) * Math.sin(a);
      const y2 = py + (cx - px) * Math.sin(a) + (y - py) * Math.cos(a);
      expect(hitIndexXY(l, x2, y2, 19.2)).toBe(i);
    }
  });
});

describe('actor label ink', () => {
  it('picks dark text on light player colours and white on dark ones', async () => {
    const { inkOn } = await import('./anim');
    expect(inkOn('#b8860b')).toBe('#111');
    expect(inkOn('#f4c542')).toBe('#111');
    expect(inkOn('#1f6fd1')).toBe('#fff');
    expect(inkOn('#455a64')).toBe('#fff');
  });
});

describe('column gestures: y axis (zone-arrangement 3.2)', () => {
  // 5 cards, 20px apart vertically, column 60px wide
  const yOf = (i: number) => i * 20 + 5;
  const hitY = (_x: number, y: number) => (y < 0 || y > 4 * 20 + 84 ? null : Math.min(4, Math.floor(y / 20)));
  function recY() {
    const ev: string[] = [];
    const g = new ZoneGesture(
      {
        hit: hitY,
        onTap: (i) => ev.push(`tap:${i}`),
        onScrubStart: (i) => ev.push(`scrubStart:${i}`),
        onScrub: (i) => ev.push(`scrub:${i}`),
        onScrubEnd: () => ev.push('scrubEnd'),
        onDragStart: (i) => ev.push(`dragStart:${i}`),
        onDragMove: () => ev.push('dragMove'),
        onDragEnd: () => ev.push('dragEnd'),
      },
      { axis: 'y', crossSize: () => 60 },
    );
    return { g, ev };
  }
  it('sliding down the column scrubs card by card and picks nothing up', () => {
    const { g, ev } = recY();
    g.down({ x: 30, y: yOf(0), t: 0 });
    for (const y of [yOf(1), yOf(2), yOf(3)]) g.move({ x: 32, y, t: 50 });
    g.up({ x: 32, y: yOf(3), t: 200 });
    expect(ev).toEqual(['scrubStart:0', 'scrub:1', 'scrub:2', 'scrub:3', 'scrubEnd']);
  });
  it('sideways movement picks up the pressed card', () => {
    const { g, ev } = recY();
    g.down({ x: 30, y: yOf(2), t: 0 });
    g.move({ x: 60, y: yOf(2) + 2, t: 40 });
    expect(ev[0]).toBe('dragStart:2');
  });
  it('a scrub that leaves the column sideways becomes a drag of the scrubbed card', () => {
    const { g, ev } = recY();
    g.down({ x: 30, y: yOf(0), t: 0 });
    g.move({ x: 30, y: yOf(3), t: 50 });
    g.move({ x: 60 + 30, y: yOf(3), t: 90 });
    expect(ev).toContain('scrubEnd');
    expect(ev).toContain('dragStart:3');
  });
});

describe('double tap (quick-flip 1.1)', () => {
  function recD() {
    const ev: string[] = [];
    const g = new ZoneGesture({
      hit: (x) => hit(x),
      onTap: (i) => ev.push(`tap:${i}`),
      onDoubleTap: (i) => ev.push(`double:${i}`),
      onLongPress: (i) => ev.push(`long:${i}`),
      onScrubStart: (i) => ev.push(`scrubStart:${i}`),
      onScrubEnd: () => ev.push('scrubEnd'),
    });
    return { g, ev };
  }
  const tapAt = (g: ZoneGesture, x: number, t: number) => {
    g.down({ x, y: 10, t });
    g.up({ x, y: 10, t: t + 60 });
  };
  it('two quick taps on the same card: one tap, then a double tap (no second tap)', () => {
    const { g, ev } = recD();
    tapAt(g, xOf(3), 0);
    tapAt(g, xOf(3) + 3, 200);
    expect(ev).toEqual(['tap:3', 'double:3']);
  });
  it('slow, distant or different-card taps stay single taps', () => {
    const slow = recD();
    tapAt(slow.g, xOf(3), 0);
    tapAt(slow.g, xOf(3), 500);
    expect(slow.ev).toEqual(['tap:3', 'tap:3']);
    const other = recD();
    tapAt(other.g, xOf(3), 0);
    tapAt(other.g, xOf(6), 150);
    expect(other.ev).toEqual(['tap:3', 'tap:6']);
  });
  it('a third tap starts fresh', () => {
    const { g, ev } = recD();
    tapAt(g, xOf(2), 0);
    tapAt(g, xOf(2), 150);
    tapAt(g, xOf(2), 300);
    expect(ev).toEqual(['tap:2', 'double:2', 'tap:2']);
  });
  it('a scrub or a long press in between resets it', () => {
    const { g, ev } = recD();
    tapAt(g, xOf(2), 0);
    g.down({ x: xOf(2), y: 10, t: 80 });
    g.move({ x: xOf(5), y: 10, t: 120 });
    g.up({ x: xOf(5), y: 10, t: 160 });
    tapAt(g, xOf(2), 200);
    expect(ev).toEqual(['tap:2', 'scrubStart:2', 'scrubEnd', 'tap:2']);
  });
  it('without an onDoubleTap handler, taps stay taps', () => {
    const { g, ev } = rec();
    tapAt(g, xOf(1), 0);
    tapAt(g, xOf(1), 100);
    expect(ev).toEqual(['tap:1', 'tap:1']);
  });
});

describe('tap, then drag (pile-move 1.1)', () => {
  function recS(withDrag = true) {
    const ev: string[] = [];
    const g = new ZoneGesture(
      {
        hit: () => 0,
        onTap: (i) => ev.push(`tap:${i}`),
        onDoubleTap: (i) => ev.push(`double:${i}`),
        onSecondPress: (i) => ev.push(`second:${i}`),
        ...(withDrag ? { onSecondPressDrag: (i: number) => ev.push(`secondDrag:${i}`) } : {}),
        onScrubStart: (i) => ev.push(`scrubStart:${i}`),
        onDragStart: (i) => ev.push(`dragStart:${i}`),
        onDragMove: () => ev.push('dragMove'),
        onDragEnd: () => ev.push('dragEnd'),
      },
      { scrub: false },
    );
    return { g, ev };
  }
  const tap = (g: ZoneGesture, t: number) => {
    g.down({ x: 20, y: 20, t });
    g.up({ x: 20, y: 20, t: t + 50 });
  };
  it('tap, then a second press that moves: second press, then a whole-pile drag (no flip, no plain drag)', () => {
    const { g, ev } = recS();
    tap(g, 0);
    g.down({ x: 21, y: 20, t: 150 });
    g.move({ x: 21, y: 60, t: 200 });
    g.move({ x: 21, y: 90, t: 230 });
    g.up({ x: 21, y: 90, t: 260 });
    expect(ev).toEqual(['tap:0', 'second:0', 'secondDrag:0', 'dragMove', 'dragMove', 'dragEnd']);
  });
  it('tap, then a still second press is still a double tap', () => {
    const { g, ev } = recS();
    tap(g, 0);
    tap(g, 150);
    expect(ev).toEqual(['tap:0', 'second:0', 'double:0']);
  });
  it('without onSecondPressDrag, a moving second press is an ordinary drag', () => {
    const { g, ev } = recS(false);
    tap(g, 0);
    g.down({ x: 20, y: 20, t: 150 });
    g.move({ x: 20, y: 60, t: 200 });
    expect(ev).toEqual(['tap:0', 'second:0', 'dragStart:0', 'dragMove']);
  });
  it('a slow or distant second press is a normal press', () => {
    const slow = recS();
    tap(slow.g, 0);
    slow.g.down({ x: 20, y: 20, t: 600 });
    slow.g.move({ x: 20, y: 60, t: 650 });
    expect(slow.ev).toEqual(['tap:0', 'dragStart:0', 'dragMove']);
    const far = recS();
    tap(far.g, 0);
    far.g.down({ x: 60, y: 20, t: 150 });
    far.g.move({ x: 60, y: 60, t: 200 });
    expect(far.ev).toEqual(['tap:0', 'dragStart:0', 'dragMove']);
  });
});

describe('dwell (1.1)', () => {
  function dwellRec() {
    const ev: string[] = [];
    const g = new ZoneGesture({
      hit: (x) => hit(x),
      onScrubStart: (i) => ev.push(`scrubStart:${i}`),
      onScrub: (i) => ev.push(`scrub:${i}`),
      onDwell: (i) => ev.push(`dwell:${i}`),
      onDragStart: () => ev.push('dragStart'),
    });
    return { g, ev };
  }
  const at = (x: number, t: number) => ({ x, y: 20, t });
  it('fires once after 300 ms of stillness during a scrub, and again after moving on', () => {
    const { g, ev } = dwellRec();
    g.down(at(xOf(2), 0));
    g.move(at(xOf(3), 20));
    g.move(at(xOf(4), 40));
    g.tick(200);
    expect(ev.filter((e) => e.startsWith('dwell'))).toEqual([]);
    g.tick(400);
    g.tick(500);
    expect(ev.filter((e) => e.startsWith('dwell'))).toEqual(['dwell:4']);
    g.move(at(xOf(6), 600));
    g.tick(950);
    expect(ev.filter((e) => e.startsWith('dwell'))).toEqual(['dwell:4', 'dwell:6']);
  });
  it('small jitter does not count as moving', () => {
    const { g, ev } = dwellRec();
    g.down(at(xOf(2), 0));
    g.move(at(xOf(4), 20));
    g.move(at(xOf(4) + 3, 150));
    g.move(at(xOf(4) - 2, 250));
    g.tick(340);
    expect(ev).toContain('dwell:4');
  });
  it('fires with no card index while dragging', () => {
    const { g, ev } = dwellRec();
    g.down(at(xOf(2), 0));
    g.move({ x: xOf(2), y: -40, t: 20 });
    g.tick(400);
    expect(ev).toContain('dwell:null');
  });
  it('does not fire for a press that never moved (that is the long press)', () => {
    const { g, ev } = dwellRec();
    g.down(at(xOf(2), 0));
    g.tick(600);
    expect(ev.some((e) => e.startsWith('dwell'))).toBe(false);
  });
});
