import { describe, it, expect } from 'vitest';
import { expandSetup, handZoneId, SetupContentSchema, ActionError, type AnyAction, type TableState } from '@vct/shared';
import { ALEX, SAM, setup, run, ctx, standardDeck, seqRng } from './helpers.js';

const content = (extra: Record<string, unknown> = {}) =>
  SetupContentSchema.parse({
    name: 'Mini',
    players: { min: 1, max: 4 },
    slots: [{ id: 's1', label: 'Deck', defaultDeckId: 'x' }],
    homes: { s1: 'stock' },
    zones: [
      { key: 'stock', name: 'Stock', layout: 'pile' },
      { key: 'p1', name: 'P1', layout: 'column', down: 2, up: 1 },
      { key: 'mine', name: '{name} pile', layout: 'pile', perSeat: true, up: 1 },
    ],
    hands: { count: 5 },
    counters: [{ label: '{name} score', value: 0, perSeat: true }, { label: 'Round', value: 1 }],
    ...extra,
  });

function applyAction(s: TableState, c = content()): AnyAction {
  const seated = s.seats.filter((x) => x.playerId);
  const r = expandSetup(c, { seats: seated.map((x) => ({ name: x.name })), deckSizes: { s1: 52 } });
  if (!r.ok) throw new Error(r.message);
  return { type: 'applySetup', setup: { id: 'set1', versionId: 'v1', name: c.name }, decks: [{ slot: 's1', deck: { ...standardDeck('tdS'), homeZoneId: '' } }], plan: r.plan };
}
const shared = (s: TableState) => s.zoneOrder.filter((id) => s.zones[id].kind === 'shared').map((id) => s.zones[id]);
const byName = (s: TableState, n: string) => shared(s).find((z) => z.name === n)!;
const faces = (s: TableState, zid: string) => s.zones[zid].cards.map((c) => (s.cards[c].faceUp ? 'up' : 'down'));

describe('applySetup (table-setups 2.1)', () => {
  it('replaces zones, cards and counters; keeps seats, players and the log', () => {
    const { eng } = setup([SAM]);
    let s = run(eng.state, { type: 'counterAdd', label: 'Old', value: 3 }, ALEX.playerId).state;
    const logBefore = s.log.length;
    const seatsBefore = structuredClone(s.seats);
    s = run(s, applyAction(s), ALEX.playerId).state;
    expect(shared(s).map((z) => z.name)).toEqual(['Stock', 'P1']);
    // per-player-zones: the per-seat "{name} pile" is one per-player zone with a copy per seat
    const piles = s.zoneOrder.map((id) => s.zones[id]).filter((z) => z.kind === 'player');
    expect(piles.map((z) => [z.name, z.seatId])).toEqual(s.seats.filter((x) => x.playerId).map((x) => ['pile', x.id]));
    for (const z of piles) expect(faces(s, z.id)).toEqual(['up']);
    expect(s.seats).toEqual(seatsBefore);
    expect(s.log.length).toBe(logBefore + 1);
    expect(s.log.at(-1)!.text).toBe('Alex applied Mini');
    expect(s.counters.map((c) => [c.label, c.value])).toEqual([['Alex score', 0], ['Sam score', 0], ['Round', 1]]);
    expect(Object.keys(s.decks)).toEqual(['tdS']);
    expect(s.lastSetup).toEqual({ id: 'set1', versionId: 'v1', name: 'Mini' });
    // counts and faces as planned
    expect(faces(s, byName(s, 'P1').id)).toEqual(['down', 'down', 'up']);
    for (const seat of s.seats.filter((x) => x.playerId)) expect(s.zones[handZoneId(seat.id)].cards).toHaveLength(5);
    const total = Object.values(s.zones).reduce((t, z) => t + z.cards.length, 0);
    expect(total).toBe(52);
    expect(s.zones[byName(s, 'Stock').id].cards).toHaveLength(52 - 3 - 2 - 10);
    expect(Object.keys(s.cards)).toHaveLength(52);
  });

  it('two applies give the same counts with a different deal', () => {
    const { eng } = setup([SAM]);
    const a = run(eng.state, applyAction(eng.state), ALEX.playerId, { rng: seqRng([5, 17, 3, 41, 8]) }).state;
    const b = run(eng.state, applyAction(eng.state), ALEX.playerId, { rng: seqRng([9, 2, 33, 1, 27]) }).state;
    expect(a.zones[byName(a, 'P1').id].cards).toHaveLength(3);
    expect(b.zones[byName(b, 'P1').id].cards).toHaveLength(3);
    expect(a.zones[byName(a, 'P1').id].cards).not.toEqual(b.zones[byName(b, 'P1').id].cards);
  });

  it('a fixed deal places exactly the recorded cards', () => {
    const { eng } = setup([]);
    const c = content({
      players: { min: 1, max: 1 },
      zones: [
        { key: 'stock', name: 'Stock', layout: 'pile' },
        { key: 'p1', name: 'P1', layout: 'column' },
      ],
      hands: undefined,
      counters: [],
      fixed: {
        players: 1,
        deckVersions: {},
        zones: { p1: [{ slot: 's1', defId: 'KH', copyNo: 1, faceUp: false }, { slot: 's1', defId: 'AS', copyNo: 1, faceUp: true }] },
        hands: [[{ slot: 's1', defId: '2C', copyNo: 1, faceUp: false }]],
      },
    });
    const s = run(eng.state, applyAction(eng.state, c), ALEX.playerId).state;
    expect(s.zones[byName(s, 'P1').id].cards).toEqual(['tdS:KH:1', 'tdS:AS:1']);
    expect(faces(s, byName(s, 'P1').id)).toEqual(['down', 'up']);
    expect(s.zones[handZoneId(s.seats[0].id)].cards).toEqual(['tdS:2C:1']);
    expect(s.zones[byName(s, 'Stock').id].cards).toHaveLength(49);
  });

  it('only the host can apply; undo restores the previous table', () => {
    const { eng } = setup([SAM]);
    expect(() => run(eng.state, applyAction(eng.state), SAM.playerId)).toThrow(ActionError);
    const before = structuredClone(eng.state);
    eng.dispatch(applyAction(eng.state), ALEX.playerId, ctx({ now: 1000 }));
    expect(eng.state.lastSetup?.name).toBe('Mini');
    eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx({ now: 2000 }));
    expect(eng.state.zones).toEqual(before.zones);
    expect(eng.state.cards).toEqual(before.cards);
    expect(eng.state.counters).toEqual(before.counters);
    expect(eng.state.lastSetup).toBeUndefined();
  });

  it('replaying the same action with the same randomness gives the same state', () => {
    const { eng } = setup([SAM]);
    const act = applyAction(eng.state);
    const a = run(eng.state, act, ALEX.playerId, { rng: seqRng([4, 11, 29]) }).state;
    const b = run(eng.state, act, ALEX.playerId, { rng: seqRng([4, 11, 29]) }).state;
    expect(b.zones).toEqual(a.zones);
    expect(b.cards).toEqual(a.cards);
  });
});
