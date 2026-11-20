import { describe, it, expect } from 'vitest';
import { ALEX, setup, run, zoneByName, ctx } from './helpers.js';

const faces = (s: any, zid: string) => s.zones[zid].cards.map((c: string) => (s.cards[c].faceUp ? 'up' : 'down'));

describe('turning a pile over (pile-flip 1.1)', () => {
  it('a face-down pile A,B,C,D becomes D,C,B,A, all face up', () => {
    const { eng, deckZone } = setup();
    const before = [...eng.state.zones[deckZone].cards];
    const r = run(eng.state, { type: 'flipZone', zone: deckZone }, ALEX.playerId);
    expect(r.state.zones[deckZone].cards).toEqual([...before].reverse());
    expect(faces(r.state, deckZone).every((f: string) => f === 'up')).toBe(true);
    expect(r.state.log.at(-1)!.text).toBe('Alex turned Standard over');
  });

  it('a mixed pile inverts: A(down),B(down),C(up) becomes C(down),B(up),A(up)', () => {
    const { eng } = setup();
    let s = run(eng.state, { type: 'zoneAdd', name: 'P', layout: 'pile' }, ALEX.playerId).state;
    const pid = zoneByName(s, 'P').id;
    const deck = zoneByName(s, 'Standard').id;
    const [a, b, c] = s.zones[deck].cards.slice(0, 3);
    s = run(s, { type: 'move', cards: [a, b, c], to: pid, index: 0 }, ALEX.playerId).state;
    expect(s.zones[pid].cards).toEqual([a, b, c]);
    s = run(s, { type: 'flip', cards: [c] }, ALEX.playerId).state;
    expect(faces(s, pid)).toEqual(['down', 'down', 'up']);
    s = run(s, { type: 'flipZone', zone: pid }, ALEX.playerId).state;
    expect(s.zones[pid].cards).toEqual([c, b, a]);
    expect(faces(s, pid)).toEqual(['down', 'up', 'up']);
  });

  it('a spread keeps its order and turns every card the same way', () => {
    const { eng, deckZone } = setup();
    const table = zoneByName(eng.state, 'Table').id;
    const ids = eng.state.zones[deckZone].cards.slice(0, 3);
    let s = run(eng.state, { type: 'move', cards: ids, to: table }, ALEX.playerId).state;
    s = run(s, { type: 'flipZone', zone: table }, ALEX.playerId).state;
    expect(s.zones[table].cards).toEqual(ids);
    expect(faces(s, table)).toEqual(['up', 'up', 'up']);
  });

  it('an explicit face sets every card in place, even on a pile', () => {
    const { eng, deckZone } = setup();
    const before = [...eng.state.zones[deckZone].cards];
    let s = run(eng.state, { type: 'flip', cards: [before[1]] }, ALEX.playerId).state;
    s = run(s, { type: 'flipZone', zone: deckZone, face: 'up' }, ALEX.playerId).state;
    expect(s.zones[deckZone].cards).toEqual(before);
    expect(faces(s, deckZone).every((f: string) => f === 'up')).toBe(true);
    s = run(s, { type: 'flipZone', zone: deckZone, face: 'down' }, ALEX.playerId).state;
    expect(s.zones[deckZone].cards).toEqual(before);
    expect(faces(s, deckZone).every((f: string) => f === 'down')).toBe(true);
  });

  it('undo restores order and faces', () => {
    const { eng, deckZone } = setup();
    const before = [...eng.state.zones[deckZone].cards];
    eng.dispatch({ type: 'flipZone', zone: deckZone }, ALEX.playerId, ctx({ now: 1000 }));
    expect(eng.state.zones[deckZone].cards[0]).toBe(before.at(-1));
    eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx({ now: 2000 }));
    expect(eng.state.zones[deckZone].cards).toEqual(before);
    expect(eng.state.zones[deckZone].cards.every((c) => !eng.state.cards[c].faceUp)).toBe(true);
  });
});
