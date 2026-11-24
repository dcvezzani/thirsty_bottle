import { describe, expect, it } from 'vitest';
import type { TableView } from '@vct/shared';
import { boardZones, rotateSeat, shownSeat, viewRotation, zoneLabel } from './ui';

const z = (id: string, kind: string, seatId: string | null = null, group?: string) => ({ id, name: id, kind, seatId, group, layout: 'spread', cards: [] }) as any;
const view = (me: string | null) =>
  ({
    me: { playerId: 'p', seatId: me, isHost: false, spectator: !me },
    seats: [
      { id: 's1', playerId: 'a', name: 'Alex', index: 0 },
      { id: 's2', playerId: null, name: '', index: 1 },
      { id: 's3', playerId: 'b', name: 'Sam', index: 2 },
      { id: 's4', playerId: 'c', name: 'Kim', index: 3 },
    ],
    zones: [z('stock', 'shared'), z('g:s1', 'player', 's1', 'g'), z('g:s2', 'player', 's2', 'g'), z('g:s3', 'player', 's3', 'g'), z('g:s4', 'player', 's4', 'g'), z('hand:s1', 'hand', 's1'), z('table', 'shared')],
  }) as unknown as TableView;

describe('player views (2.2)', () => {
  it('rotation goes through occupied seats in table order and wraps', () => {
    const v = view('s1');
    expect(viewRotation(v)).toEqual(['s1', 's3', 's4']);
    expect(rotateSeat(v, 's1', 1)).toBe('s3');
    expect(rotateSeat(v, 's4', 1)).toBe('s1');
    expect(rotateSeat(v, 's1', -1)).toBe('s4');
  });

  it('the board shows the shown seat\'s copy in the group slot', () => {
    const v = view('s1');
    expect(boardZones(v).map((x) => x.id)).toEqual(['stock', 'g:s1', 'table']);
    expect(boardZones(v, false, 's3').map((x) => x.id)).toEqual(['stock', 'g:s3', 'table']);
  });

  it('spectators start at the first seat; a stale view falls back to my own', () => {
    expect(shownSeat(view(null), null)).toBe('s1');
    expect(shownSeat(view('s3'), 's2')).toBe('s3'); // s2 is empty
    expect(shownSeat(view('s3'), 's4')).toBe('s4');
  });
});

describe('per-player labels (compact-seat-chips 1.3)', () => {
  it('my own copy is just the zone name; others carry the owner; empty seats their number', () => {
    const v = view('s1');
    const byId = (id: string) => v.zones.find((x) => x.id === id)!;
    expect(zoneLabel(v, byId('g:s1'))).toBe('g:s1');
    expect(zoneLabel(v, byId('g:s3'))).toBe("Sam's g:s3");
    expect(zoneLabel(v, byId('g:s2'))).toBe('Seat 2 g:s2');
  });
});
