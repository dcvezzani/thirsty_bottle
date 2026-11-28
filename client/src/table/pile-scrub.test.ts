import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZoneGesture } from './gestures';
import { canSeeFaceDown, endFaceDown, toggleFaceDown } from './pileFaceDown';
import { useUI } from './ui';
import { useTable } from '../store/table';

/** A pile as the gesture sees it: the card under any x is the one the fan puts there (here a fixed map), or the top card. */
function pile(opts: { scrub: boolean }) {
  const ev: string[] = [];
  const g = new ZoneGesture(
    {
      hit: (x) => (x < 0 ? 0 : Math.min(9, Math.floor(x / 20))),
      onTap: (i) => ev.push(`tap:${i}`),
      onDoubleTap: (i) => ev.push(`double:${i}`),
      onLongPress: (i) => ev.push(`long:${i}`),
      onScrubStart: (i) => ev.push(`scrubStart:${i}`),
      onScrub: (i) => ev.push(`scrub:${i}`),
      onScrubEnd: () => ev.push('scrubEnd'),
      onDragStart: (i) => ev.push(`dragStart:${i}`),
      onDragEnd: () => ev.push('dragEnd'),
    },
    { scrub: true },
  );
  g.allowScrub(opts.scrub);
  return { g, ev };
}
const at = (x: number, y: number, t = 0) => ({ x, y, t });

describe('pile gestures (1.1)', () => {
  it('a sideways slide scrubs the pile from the top card across the others', () => {
    const { g, ev } = pile({ scrub: true });
    g.down(at(5, 30));
    g.move(at(30, 31, 20));
    g.move(at(90, 31, 40));
    g.up(at(90, 31, 60));
    expect(ev).toEqual(['scrubStart:0', 'scrub:1', 'scrub:4', 'scrubEnd']);
  });

  it('a pull (mostly vertical) still takes the top card', () => {
    const { g, ev } = pile({ scrub: true });
    g.down(at(5, 30));
    g.move(at(7, 0, 20));
    g.up(at(7, -30, 60));
    expect(ev).toEqual(['dragStart:0', 'dragEnd']);
  });

  it('pulling out of a scrub picks up the card that was scrubbed', () => {
    const { g, ev } = pile({ scrub: true });
    g.down(at(5, 30));
    g.move(at(30, 31, 20));
    g.move(at(70, 31, 40));
    g.move(at(70, -40, 60));
    expect(ev).toEqual(['scrubStart:0', 'scrub:1', 'scrub:3', 'scrubEnd', 'dragStart:3']);
  });

  it('the mouse keeps its drag: a sideways move takes the top card', () => {
    const { g, ev } = pile({ scrub: false });
    g.down(at(5, 30));
    g.move(at(60, 31, 20));
    expect(ev).toEqual(['dragStart:0']);
  });

  it('tap, double tap and hold are unchanged', () => {
    const { g, ev } = pile({ scrub: true });
    g.down(at(5, 30, 0));
    g.up(at(5, 30, 80));
    g.down(at(5, 30, 150));
    g.up(at(5, 30, 220));
    expect(ev).toEqual(['tap:0', 'double:0']);
    const h = pile({ scrub: true });
    h.g.down(at(5, 30, 0));
    h.g.tick(500);
    expect(h.ev).toEqual(['long:0']);
  });
});

describe('scrubbing by finger travel (1.2)', () => {
  it('the zone can supply the scrubbed card from the sample, replacing the position hit', () => {
    const ev: string[] = [];
    let n = 0;
    const g = new ZoneGesture(
      {
        hit: () => 0,
        scrubAt: () => ++n, // one card further on every sample
        onScrubStart: (i) => ev.push(`start:${i}`),
        onScrub: (i) => ev.push(`scrub:${i}`),
        onScrubEnd: () => ev.push('end'),
      },
      { scrub: true },
    );
    g.down(at(5, 30));
    g.move(at(30, 30, 20));
    g.move(at(31, 30, 40));
    g.up(at(31, 30, 60));
    expect(ev).toEqual(['start:0', 'scrub:1', 'scrub:2', 'end']);
  });
});

const card = (h: string, known: boolean) => ({ h, faceUp: known, known }) as any;
const view = (cards: any[], over: Record<string, unknown> = {}) =>
  ({
    me: { playerId: 'alex', seatId: 's1', spectator: false },
    zones: [{ id: 'Deck', kind: 'shared', layout: 'pile', seatId: null, cards }, ...((over.zones as any[]) ?? [])],
    ...over,
  }) as any;

describe('See face-down (2.1)', () => {
  it('is offered on a pile with cards I cannot see, for a seated player, and not elsewhere', () => {
    const v = view([card('a', true), card('b', false)]);
    expect(canSeeFaceDown(v, v.zones[0], false)).toBe(true);
    const allKnown = view([card('a', true)]);
    expect(canSeeFaceDown(allKnown, allKnown.zones[0], false)).toBe(false);
    expect(canSeeFaceDown(allKnown, allKnown.zones[0], true)).toBe(true); // already on: it can be turned off
    const spec = view([card('b', false)], { me: { playerId: 'x', seatId: null, spectator: true } });
    expect(canSeeFaceDown(spec, spec.zones[0], false)).toBe(false);
    const spread = { ...v.zones[0], layout: 'spread' };
    expect(canSeeFaceDown(v, spread, false)).toBe(false);
    const others = { ...v.zones[0], kind: 'player', seatId: 's2' };
    expect(canSeeFaceDown(v, others, false)).toBe(false);
    const mine = { ...v.zones[0], kind: 'player', seatId: 's1' };
    expect(canSeeFaceDown(v, mine, false)).toBe(true);
  });
});

describe('See face-down peek and clean-up (2.1)', () => {
  afterEach(() => {
    useUI.setState({ seeFaceDown: null });
    useTable.setState({ view: null });
  });

  it('turning it on peeks at the hidden cards only; turning it off clears exactly those', async () => {
    const send = vi.fn(async () => ({ ok: true }));
    const v = view([card('a', true), card('b', false), card('c', false)]);
    useTable.setState({ view: v, send } as any);
    await toggleFaceDown(v, 'Deck');
    expect(send).toHaveBeenCalledWith({ type: 'peek', cards: ['b', 'c'] });
    expect(useUI.getState().seeFaceDown).toEqual({ zone: 'Deck', peeked: ['b', 'c'] });
    // the peek patch arrives: b and c are known now
    const after = view([card('a', true), card('b', true), card('c', true)]);
    useTable.setState({ view: after } as any);
    await toggleFaceDown(after, 'Deck'); // off
    expect(send).toHaveBeenLastCalledWith({ type: 'unpeek', cards: ['b', 'c'] });
    expect(useUI.getState().seeFaceDown).toBeNull();
  });

  it('ending the scrub clears it, and cards that have gone are left out', () => {
    const send = vi.fn(async () => ({ ok: true }));
    useTable.setState({ view: view([card('b', true)]), send } as any);
    useUI.setState({ seeFaceDown: { zone: 'Deck', peeked: ['b', 'gone'] } });
    endFaceDown();
    expect(send).toHaveBeenCalledWith({ type: 'unpeek', cards: ['b'] });
    expect(useUI.getState().seeFaceDown).toBeNull();
    endFaceDown(); // nothing left to clear
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a refused peek turns the chip back off', async () => {
    const send = vi.fn(async () => ({ ok: false, error: 'nope' }));
    const v = view([card('b', false)]);
    useTable.setState({ view: v, send } as any);
    await toggleFaceDown(v, 'Deck');
    expect(useUI.getState().seeFaceDown).toBeNull();
  });
});
