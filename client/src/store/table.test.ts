import { describe, expect, it } from 'vitest';
import type { TableView } from '@vct/shared';
import { applyPatch, classifyPatch } from './table';
import { predictMove, predictFlip } from './predict';

const view = (): TableView =>
  ({
    id: 't',
    version: 5,
    zones: [
      { id: 'hand:s1', name: 'Hand', kind: 'hand', seatId: 's1', layout: 'spread', color: '#000', x: 0, y: 0, cards: [{ h: 'a', faceUp: false, known: true, deck: 'd', def: 'x', copyNo: 1, copyOf: 1 }, { h: 'b', faceUp: false, known: true, deck: 'd', def: 'y', copyNo: 1, copyOf: 1 }] },
      { id: 'hand:s2', name: 'Hand', kind: 'hand', seatId: 's2', layout: 'spread', color: '#000', x: 0, y: 0, cards: [] },
      { id: 'z1', name: 'Table', kind: 'shared', seatId: null, layout: 'spread', color: '#000', x: 0, y: 0, cards: [] },
    ],
    me: { playerId: 'p1', seatId: 's1', isHost: true, spectator: false },
    log: [],
  }) as any;

describe('table store (6.1)', () => {
  it('classifies patches: next/same version apply, gaps request a snapshot, old ones are ignored', () => {
    expect(classifyPatch(5, 6)).toBe('apply');
    expect(classifyPatch(5, 5)).toBe('apply');
    expect(classifyPatch(5, 7)).toBe('gap');
    expect(classifyPatch(5, 4)).toBe('stale');
  });
  it('applies zone, meta and log patches', () => {
    const v = applyPatch(view(), { version: 6, zones: [{ ...view().zones[2], cards: [{ h: 'c', faceUp: true, known: false }] }], meta: { mode: 'turn' } as any, log: [{ id: 1, at: 0, actor: null, text: 'x', kind: 'system' }] });
    expect(v.version).toBe(6);
    expect(v.zones[2].cards).toHaveLength(1);
    expect(v.mode).toBe('turn');
    expect(v.log).toHaveLength(1);
  });
  it('predicts a move from my hand to a shared spread face up, and a pass that hides identities', () => {
    const v1 = predictMove(view(), ['a'], 'z1', undefined, 'up');
    expect(v1.zones[0].cards.map((c) => c.h)).toEqual(['b']);
    expect(v1.zones[2].cards[0]).toMatchObject({ h: 'a', faceUp: true, known: true });
    const v2 = predictMove(view(), ['a', 'b'], 'hand:s2');
    expect(v2.zones[1].cards.every((c) => !c.known && c.def === undefined)).toBe(true);
    const v3 = predictMove(view(), ['b'], 'hand:s1', 0);
    expect(v3.zones[0].cards.map((c) => c.h)).toEqual(['b', 'a']);
  });
  it('predicts flips', () => {
    expect(predictFlip(view(), ['a']).zones[0].cards[0].faceUp).toBe(true);
  });
});
