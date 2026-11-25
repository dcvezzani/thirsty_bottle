import { describe, expect, it } from 'vitest';
import { HeaderGesture, HEADER_DEFAULTS } from './headerGesture';
import { zoneFocusCard } from './focusCard';
import { ZoneGesture } from './gestures';

describe('zone focus card (1.1)', () => {
  it('a pile shows its top card, a column its last, other zones their first', () => {
    expect(zoneFocusCard({ layout: 'pile', cards: ['a', 'b', 'c'] })).toBe('a');
    expect(zoneFocusCard({ layout: 'column', cards: ['a', 'b', 'c'] })).toBe('c');
    expect(zoneFocusCard({ layout: 'spread', cards: ['a', 'b', 'c'] })).toBe('a');
    expect(zoneFocusCard({ layout: 'free', cards: ['a', 'b'] })).toBe('a');
  });
  it('an empty zone has none', () => {
    expect(zoneFocusCard({ layout: 'pile', cards: [] })).toBeUndefined();
  });
});

function rec(hold = true, belowY = 40) {
  const ev: string[] = [];
  const g = new HeaderGesture(
    {
      onTap: () => ev.push('tap'),
      onHold: () => ev.push('hold'),
      onSlideStart: () => ev.push('slideStart'),
      onSlide: (s) => ev.push(`slide:${Math.round(s.x)}`),
      onExit: () => ev.push('exit'),
      onDwell: () => ev.push('dwell'),
      onEnd: () => ev.push('end'),
    },
    { ...HEADER_DEFAULTS, hold, isBelow: (s) => s.y >= belowY },
  );
  return { g, ev };
}
const at = (x: number, t: number, y = 10) => ({ x, y, t });

describe('header press recognizer (1.1)', () => {
  it('a press and release without moving is a tap', () => {
    const { g, ev } = rec();
    g.down(at(10, 0));
    g.up(at(10, 90));
    expect(ev).toEqual(['tap']);
  });
  it('a still hold by the host is a hold, and its release is not a tap', () => {
    const { g, ev } = rec(true);
    g.down(at(10, 0));
    g.tick(300);
    g.tick(600);
    g.up(at(10, 700));
    expect(ev).toEqual(['hold']);
  });
  it('a still hold does nothing when the hold is not enabled', () => {
    const { g, ev } = rec(false);
    g.down(at(10, 0));
    g.tick(800);
    g.up(at(10, 900));
    expect(ev).toEqual(['tap']);
  });
  it('a slide cancels the hold and the tap and reports each move, then the end', () => {
    const { g, ev } = rec(true);
    g.down(at(10, 0));
    g.move(at(14, 50));
    g.move(at(30, 90));
    g.move(at(60, 130));
    g.tick(900);
    g.up(at(60, 950));
    expect(ev.filter((e) => e !== 'dwell')).toEqual(['slideStart', 'slide:30', 'slide:60', 'end']);
    expect(ev).not.toContain('hold');
    expect(ev).not.toContain('tap');
  });
  it('a pause during a slide reports a dwell once, and again after moving on', () => {
    const { g, ev } = rec(false);
    g.down(at(10, 0));
    g.move(at(40, 40));
    g.tick(200);
    expect(ev).not.toContain('dwell');
    g.tick(400);
    g.tick(500);
    expect(ev.filter((e) => e === 'dwell')).toHaveLength(1);
    g.move(at(80, 600));
    g.tick(950);
    expect(ev.filter((e) => e === 'dwell')).toHaveLength(2);
  });
  it('sliding down out of the header exits to the zone and ends the header gesture', () => {
    const { g, ev } = rec();
    g.down(at(10, 0));
    g.move(at(30, 40));
    g.move({ x: 30, y: 60, t: 80 });
    g.up(at(30, 120));
    expect(ev).toEqual(['slideStart', 'slide:30', 'exit']);
    expect(g.state).toBe('idle');
  });
  it('a press that drifts less than the slop is still a tap', () => {
    const { g, ev } = rec();
    g.down(at(10, 0));
    g.move(at(14, 30));
    g.up(at(14, 60));
    expect(ev).toEqual(['tap']);
  });
});

describe('vertical moves belong to the board scroll (1.1)', () => {
  it('a mostly vertical first move is neither a tap nor a header scrub', () => {
    const { g, ev } = rec();
    g.down(at(10, 0));
    g.move({ x: 12, y: 40, t: 40 });
    g.move({ x: 30, y: 80, t: 80 });
    g.tick(900);
    g.up(at(30, 950));
    expect(ev).toEqual([]);
  });
  it('a sideways first move still starts the header scrub, and sliding down afterwards exits to the cards', () => {
    const { g, ev } = rec(true, 30);
    g.down(at(10, 0));
    g.move(at(40, 40));
    g.move({ x: 40, y: 60, t: 80 });
    expect(ev).toEqual(['slideStart', 'slide:40', 'exit']);
  });
});

describe('starting a scrub from a header (1.1)', () => {
  const hit = (x: number) => Math.max(0, Math.min(9, Math.floor(x / 30)));
  it('beginScrub starts already scrubbing on the given card and follows the finger on both axes', () => {
    const ev: string[] = [];
    const g = new ZoneGesture({ hit: (x) => hit(x), onScrubStart: (i) => ev.push(`start:${i}`), onScrub: (i) => ev.push(`scrub:${i}`), onScrubEnd: () => ev.push('end') });
    g.beginScrub({ x: 65, y: 20, t: 0 }, 2);
    expect(g.state).toBe('scrub');
    g.move({ x: 100, y: 20, t: 40 });
    g.up({ x: 100, y: 20, t: 80 });
    expect(ev).toEqual(['start:2', 'scrub:3', 'end']);
  });
  it('a column scrubs vertically from a header handoff', () => {
    const ev: string[] = [];
    const g = new ZoneGesture(
      { hit: (_x, y) => Math.max(0, Math.min(4, Math.floor(y / 20))), onScrubStart: (i) => ev.push(`start:${i}`), onScrub: (i) => ev.push(`scrub:${i}`) },
      { axis: 'y', crossSize: () => 60 },
    );
    g.beginScrub({ x: 30, y: 5, t: 0 }, 0);
    g.move({ x: 30, y: 50, t: 40 });
    expect(ev).toEqual(['start:0', 'scrub:2']);
  });
});
