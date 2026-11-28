import { describe, expect, it } from 'vitest';
import { overviewSections, publicView } from './overview';

const card = (h: string, extra: Record<string, unknown> = {}) => ({ h, faceUp: false, known: false, ...extra }) as any;
const zone = (id: string, kind: string, layout: string, cards: any[], extra: Record<string, unknown> = {}) =>
  ({ id, name: id, kind, seatId: null, layout, color: '#000', x: 0, y: 0, width: 'full', newRow: false, cards, ...extra }) as any;

function view(over: Record<string, unknown> = {}) {
  return {
    mode: 'turn',
    turn: { active: 's2', direction: 1 },
    hostId: 'alex',
    me: { playerId: 'alex', seatId: 's1', isHost: true, spectator: false },
    seats: [
      { id: 's1', playerId: 'alex', name: 'Alex', color: '#111111', handCount: 3 },
      { id: 's2', playerId: 'sam', name: 'Sam', color: '#222222', handCount: 5 },
      { id: 's3', playerId: null, name: '', color: '#333333', handCount: 0 },
    ],
    zones: [
      zone('Deck', 'shared', 'pile', [card('d1', { faceUp: true, known: true, public: true, def: 'x' }), card('d2'), card('d3')]),
      zone('Table', 'shared', 'spread', [card('t1', { faceUp: true, known: true, public: true }), card('t2'), card('t3', { known: true, peeked: true })]),
      zone('hand:s1', 'hand', 'spread', [card('a1', { known: true }), card('a2', { known: true, public: true, faceUp: false })], { seatId: 's1' }),
      zone('hand:s2', 'hand', 'spread', [card('b1'), card('b2'), card('b3', { known: true, public: true })], { seatId: 's2' }),
      zone('Tricks:s1', 'player', 'spread', [card('p1', { faceUp: true, known: true, public: true })], { seatId: 's1', group: 'Tricks' }),
      zone('Tricks:s2', 'player', 'spread', [card('q1'), card('q2', { faceUp: true, known: true, public: true })], { seatId: 's2', group: 'Tricks' }),
    ],
    counters: [{ id: 'c1', label: 'Score', value: 7 }],
    notes: 'house rules',
    ...over,
  } as any;
}

describe('overviewSections', () => {
  it('lists the shared zones in board order, then the players with their per-player zones, counters and notes', () => {
    const o = overviewSections(view());
    expect(o.shared.map((z) => z.id)).toEqual(['Deck', 'Table']);
    expect(o.players.map((p) => p.name)).toEqual(['Alex', 'Sam']); // the empty seat is not listed
    expect(o.players[0].zones.map((z) => z.id)).toEqual(['Tricks:s1']);
    expect(o.players[1].zones.map((z) => z.id)).toEqual(['Tricks:s2']);
    expect(o.counters).toEqual([{ id: 'c1', label: 'Score', value: 7 }]);
    expect(o.notes).toBe('house rules');
  });

  it('marks the turn and the host', () => {
    const o = overviewSections(view());
    expect(o.turn).toEqual({ seatId: 's2', name: 'Sam' });
    expect(o.players.find((p) => p.name === 'Sam')).toMatchObject({ active: true, host: false, me: false });
    expect(o.players.find((p) => p.name === 'Alex')).toMatchObject({ active: false, host: true, me: true });
    expect(overviewSections(view({ mode: 'realtime' })).turn).toBeNull();
    expect(overviewSections(view({ mode: 'realtime' })).players.some((p) => p.active)).toBe(false);
  });

  it('shows hands as counts, plus only the cards shown to everyone', () => {
    const o = overviewSections(view());
    const sam = o.players.find((p) => p.name === 'Sam')!;
    expect(sam.handCount).toBe(5);
    expect(sam.shown.map((c) => c.h)).toEqual(['b3']);
    expect(sam.shown[0].known).toBe(true);
    const alex = o.players.find((p) => p.name === 'Alex')!;
    expect(alex.handCount).toBe(3);
    expect(alex.shown.map((c) => c.h)).toEqual(['a2']); // my own hand: the count, and what I showed to everyone
  });

  it('shows a card only the viewer can see (peeked) as a back', () => {
    const t = overviewSections(view()).shared.find((z) => z.id === 'Table')!;
    const peeked = t.cards.find((c) => c.h === 't3')!;
    expect(peeked.known).toBe(false);
    expect(peeked.faceUp).toBe(false);
    expect('peeked' in peeked).toBe(false);
    expect(t.cards.find((c) => c.h === 't1')!.known).toBe(true);
  });

  it('a pile shows its top card and the count', () => {
    const deck = overviewSections(view()).shared.find((z) => z.id === 'Deck')!;
    expect(deck.count).toBe(3);
    expect(deck.top?.h).toBe('d1');
    expect(deck.top?.known).toBe(true);
    expect(overviewSections(view()).shared.find((z) => z.id === 'Table')!.top).toBeNull();
  });

  it('keeps the rotation of a hidden card and drops private flags from public ones', () => {
    expect(publicView(card('x', { rot: 2, back: 'img' }))).toEqual({ h: 'x', faceUp: false, known: false, back: 'img', rot: 2 });
    const p = publicView(card('y', { known: true, public: true, faceUp: true, shownBy: 'sam', peeked: true }));
    expect(p).toMatchObject({ h: 'y', known: true });
    expect('shownBy' in p).toBe(false);
    expect('peeked' in p).toBe(false);
  });

  it('works for a spectator with no seat', () => {
    const o = overviewSections(view({ me: { playerId: 'spec', seatId: null, isHost: false, spectator: true } }));
    expect(o.players.every((p) => !p.me)).toBe(true);
    expect(o.shared).toHaveLength(2);
  });
});
