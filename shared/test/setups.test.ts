import { describe, it, expect } from 'vitest';
import { expandSetup, SetupContentSchema, type SetupContent, type Plan } from '@vct/shared';

const klondike = (): SetupContent =>
  SetupContentSchema.parse({
    name: 'Klondike',
    players: { min: 1, max: 1 },
    slots: [{ id: 's1', label: 'Deck', defaultDeckId: 'builtin-standard-52' }],
    homes: { s1: 'stock' },
    zones: [
      { key: 'stock', name: 'Stock', layout: 'pile' },
      { key: 'waste', name: 'Waste', layout: 'pile' },
      ...[1, 2, 3, 4].map((i) => ({ key: `f${i}`, name: `F${i}`, layout: 'pile' })),
      ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({ key: `p${i}`, name: `P${i}`, layout: 'column', newRow: i === 1, down: i - 1, up: 1 })),
    ],
    counters: [{ label: 'Score', value: 0 }],
  });
const seats = (...names: string[]) => names.map((name) => ({ name }));
const ok = (r: ReturnType<typeof expandSetup>): Plan => {
  if (!r.ok) throw new Error(r.message);
  return r.plan;
};
const toZone = (p: Plan, k: string) => p.deals.filter((d) => 'zone' in d.to && d.to.zone === k);
const handTotal = (p: Plan, i: number) => p.deals.filter((d) => 'hand' in d.to && d.to.hand === i).reduce((t, d) => t + d.count, 0);

describe('expandSetup (table-setups 1.1)', () => {
  it('Klondike for 1 player: zones in order, columns get k-1 down then 1 up, the stock keeps the rest', () => {
    const p = ok(expandSetup(klondike(), { seats: seats('Alex'), deckSizes: { s1: 52 } }));
    expect(p.zones.map((z) => z.name)).toEqual(['Stock', 'Waste', 'F1', 'F2', 'F3', 'F4', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
    expect(p.zones.find((z) => z.key === 'p1')!.newRow).toBe(true);
    expect(toZone(p, 'p3')).toEqual([
      { slot: 's1', to: { zone: 'p3' }, faceUp: false, count: 2 },
      { slot: 's1', to: { zone: 'p3' }, faceUp: true, count: 1 },
    ]);
    expect(toZone(p, 'p1')).toEqual([{ slot: 's1', to: { zone: 'p1' }, faceUp: true, count: 1 }]);
    expect(p.deals.reduce((t, d) => t + d.count, 0)).toBe(28);
    expect(p.homes).toEqual({ s1: 'stock' });
    expect(p.counters).toEqual([{ label: 'Score', value: 0 }]);
  });

  it('a pile gets its face-up cards first, so they end up on top', () => {
    const c = klondike();
    c.zones[1] = { ...c.zones[1], down: 2, up: 1 };
    const p = ok(expandSetup(c, { seats: seats('Alex'), deckSizes: { s1: 52 } }));
    expect(toZone(p, 'waste').map((d) => d.faceUp)).toEqual([true, false]);
  });

  it('per-seat hands, zones and counters for 3 players, with names substituted', () => {
    const c = SetupContentSchema.parse({
      name: 'Rummy',
      players: { min: 2, max: 6 },
      slots: [{ id: 's1', label: 'Deck', defaultDeckId: null }],
      homes: { s1: 'stock' },
      zones: [
        { key: 'stock', name: 'Stock', layout: 'pile' },
        { key: 'melds', name: "{name}'s melds", layout: 'spread', perSeat: true },
      ],
      hands: { count: 7 },
      counters: [{ label: '{name} score', value: 0, perSeat: true }, { label: 'Round', value: 1 }],
    });
    const p = ok(expandSetup(c, { seats: seats('Alex', 'Sam', 'Kim'), deckSizes: { s1: 52 } }));
    expect(p.zones.map((z) => z.name)).toEqual(['Stock', "Alex's melds", "Sam's melds", "Kim's melds"]);
    expect([0, 1, 2].map((i) => handTotal(p, i))).toEqual([7, 7, 7]);
    // round-robin: first three deals go to seats 0, 1, 2
    expect(p.deals.slice(0, 3).map((d) => (d.to as { hand: number }).hand)).toEqual([0, 1, 2]);
    expect(p.counters).toEqual([
      { label: 'Alex score', value: 0 },
      { label: 'Sam score', value: 0 },
      { label: 'Kim score', value: 0 },
      { label: 'Round', value: 1 },
    ]);
  });

  it('counts by player count', () => {
    const c = SetupContentSchema.parse({
      name: 'Gin',
      players: { min: 2, max: 4 },
      slots: [{ id: 's1', label: 'Deck', defaultDeckId: null }],
      homes: { s1: 'stock' },
      zones: [{ key: 'stock', name: 'Stock', layout: 'pile' }],
      hands: { count: { byPlayers: [{ min: 2, max: 2, n: 10 }, { min: 3, max: 4, n: 7 }] } },
      counters: [],
    });
    const p2 = ok(expandSetup(c, { seats: seats('A', 'B'), deckSizes: { s1: 52 } }));
    expect(handTotal(p2, 0)).toBe(10);
    const p3 = ok(expandSetup(c, { seats: seats('A', 'B', 'C'), deckSizes: { s1: 52 } }));
    expect([0, 1, 2].map((i) => handTotal(p3, i))).toEqual([7, 7, 7]);
  });

  it("'rest' to 3 hands: 18, 17, 17, extras to the first seats", () => {
    const c = SetupContentSchema.parse({
      name: 'Hearts',
      players: { min: 3, max: 6 },
      slots: [{ id: 's1', label: 'Deck', defaultDeckId: null }],
      homes: { s1: 'stock' },
      zones: [{ key: 'stock', name: 'Stock', layout: 'pile' }],
      hands: { count: 'rest' },
      counters: [],
    });
    const p = ok(expandSetup(c, { seats: seats('A', 'B', 'C'), deckSizes: { s1: 52 } }));
    expect([0, 1, 2].map((i) => handTotal(p, i))).toEqual([18, 17, 17]);
  });

  it('refusals: player range, too few cards, two rest deals, a missing deck choice', () => {
    const outside = expandSetup(klondike(), { seats: seats('A', 'B'), deckSizes: { s1: 52 } });
    expect(outside).toMatchObject({ ok: false, code: 'PLAYER_RANGE' });
    expect((outside as { message: string }).message).toBe('Klondike is for 1 player; 2 are seated');
    const small = expandSetup(klondike(), { seats: seats('A'), deckSizes: { s1: 20 } });
    expect(small).toMatchObject({ ok: false, code: 'TOO_FEW_CARDS', message: 'The deck for "Deck" has 20 cards; this deal needs 28' });
    const twoRest = klondike();
    twoRest.zones[1] = { ...twoRest.zones[1], down: 'rest' };
    twoRest.zones[2] = { ...twoRest.zones[2], up: 'rest' };
    expect(expandSetup(twoRest, { seats: seats('A'), deckSizes: { s1: 52 } })).toMatchObject({ ok: false, code: 'BAD_SETUP' });
    expect(expandSetup(klondike(), { seats: seats('A'), deckSizes: {} })).toMatchObject({ ok: false, code: 'NO_DECK' });
  });

  it('a fixed deal: exact cards for the recorded player count and deck version', () => {
    const c = klondike();
    c.fixed = {
      players: 1,
      deckVersions: { s1: 'v7' },
      zones: { p1: [{ slot: 's1', defId: 'AS', copyNo: 1, faceUp: true }], waste: [] },
      hands: [[{ slot: 's1', defId: 'KH', copyNo: 1, faceUp: false }]],
    };
    const p = ok(expandSetup(c, { seats: seats('A'), deckSizes: { s1: 52 }, deckVersions: { s1: 'v7' } }));
    expect(p.deals).toEqual([]);
    expect(p.fixed).toEqual([
      { slot: 's1', defId: 'AS', copyNo: 1, faceUp: true, to: { zone: 'p1' } },
      { slot: 's1', defId: 'KH', copyNo: 1, faceUp: false, to: { hand: 0 } },
    ]);
    expect(expandSetup({ ...c, players: { min: 1, max: 2 } }, { seats: seats('A', 'B'), deckSizes: { s1: 52 } })).toMatchObject({ ok: false, code: 'FIXED_PLAYERS' });
    expect(expandSetup(c, { seats: seats('A'), deckSizes: { s1: 52 }, deckVersions: { s1: 'v8' } })).toMatchObject({ ok: false, code: 'FIXED_DECK' });
  });
});
