import { describe, expect, it } from 'vitest';
import type { TableView } from '@vct/shared';
import { predictMove } from './predict';

const card = (h: string) => ({ h, faceUp: true, known: true, deck: 'd', def: h, copyNo: 1, copyOf: 1 });
const zone = (id: string, layout: string, kind: string, cards: string[]) => ({ id, name: id, kind, seatId: kind === 'hand' ? 's1' : null, layout, color: '#000', x: 0, y: 0, cards: cards.map(card) });
const view = (): TableView =>
  ({
    id: 't',
    version: 1,
    zones: [
      zone('hand:s1', 'spread', 'hand', ['a', 'b', 'c', 'd']),
      zone('spread', 'spread', 'shared', ['e', 'f', 'g']),
      zone('col', 'column', 'shared', ['h', 'i', 'j']),
      zone('src', 'pile', 'shared', ['p', 'q', 'r']),
      zone('dis', 'pile', 'shared', ['x']),
    ],
    me: { playerId: 'p1', seatId: 's1', isHost: true, spectator: false },
    log: [],
  }) as any;
const ids = (v: TableView, z: string) => v.zones.find((x) => x.id === z)!.cards.map((c) => c.h);

describe('the preview of a group moved onto a pile keeps the cards\' order (2.1)', () => {
  it('a hand lands on a pile with its first card on top, as the server decides', () => {
    expect(ids(predictMove(view(), ['a', 'b', 'c', 'd'], 'dis'), 'dis')).toEqual(['a', 'b', 'c', 'd', 'x']);
  });
  it('a spread and a column keep their order too', () => {
    expect(ids(predictMove(view(), ['f', 'g'], 'dis'), 'dis')).toEqual(['f', 'g', 'x']);
    expect(ids(predictMove(view(), ['h', 'i', 'j'], 'dis'), 'dis')).toEqual(['h', 'i', 'j', 'x']);
  });
  it('the cards go in the order they were given', () => {
    expect(ids(predictMove(view(), ['d', 'a', 'c'], 'dis'), 'dis')).toEqual(['d', 'a', 'c', 'x']);
  });
  it('one card, a move from a pile, cards from two zones, and other destinations are the same', () => {
    expect(ids(predictMove(view(), ['b'], 'dis'), 'dis')).toEqual(['b', 'x']);
    expect(ids(predictMove(view(), ['p', 'q'], 'dis'), 'dis')).toEqual(['p', 'q', 'x']);
    expect(ids(predictMove(view(), ['a', 'e'], 'dis'), 'dis')).toEqual(['a', 'e', 'x']);
    expect(ids(predictMove(view(), ['a', 'b'], 'spread'), 'spread')).toEqual(['e', 'f', 'g', 'a', 'b']);
    expect(ids(predictMove(view(), ['a', 'b'], 'col'), 'col')).toEqual(['h', 'i', 'j', 'a', 'b']);
  });
});
