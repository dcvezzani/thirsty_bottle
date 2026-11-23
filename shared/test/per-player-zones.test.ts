import { describe, it, expect } from 'vitest';
import { boardSlots, canSee, expandSetup, recordSetup, SetupContentSchema, ActionError, type TableState, type Zone } from '@vct/shared';
import { ALEX, SAM, KIM, setup, run, ctx, standardDeck } from './helpers.js';

const copies = (s: TableState, name = 'Tableau') => s.zoneOrder.map((id) => s.zones[id]).filter((z) => z.kind === 'player' && z.name === name);
const copyOf = (s: TableState, playerId: string, name = 'Tableau') => copies(s, name).find((z) => s.seats.find((x) => x.id === z.seatId)?.playerId === playerId)!;
const adjacent = (s: TableState) => {
  const groups = new Map<string, number[]>();
  s.zoneOrder.forEach((id, i) => {
    const z = s.zones[id];
    if (z.kind === 'player') groups.set(z.group!, [...(groups.get(z.group!) ?? []), i]);
  });
  return [...groups.values()].every((ix) => ix.every((v, k) => k === 0 || v === ix[k - 1] + 1));
};

function table() {
  const { eng, deckZone } = setup([SAM]);
  eng.dispatch({ type: 'zoneAdd', name: 'Tableau', layout: 'spread', perPlayer: true }, ALEX.playerId, ctx());
  return { eng, deckZone };
}
const expectFail = (f: () => unknown, code: string) => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ActionError);
    expect((e as ActionError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
};

describe('per-player zones: copies and seats (1.1)', () => {
  it('one definition gives a copy per seat; later seats get one; copies stay adjacent', () => {
    const { eng } = table();
    let s = eng.state;
    expect(copies(s).map((z) => z.seatId)).toEqual(s.seats.map((x) => x.id));
    expect(new Set(copies(s).map((z) => z.group)).size).toBe(1);
    expect(boardSlots(s.zoneOrder.map((id) => s.zones[id])).filter((z) => z.kind === 'player')).toHaveLength(1);
    eng.dispatch({ type: 'zoneAdd', name: 'Discard 2', layout: 'pile' }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'seatJoin', player: KIM }, null, ctx());
    s = eng.state;
    expect(copies(s)).toHaveLength(3);
    expect(copyOf(s, KIM.playerId).cards).toEqual([]);
    expect(adjacent(s)).toBe(true);
  });

  it('a seat whose copy holds cards is kept as vacated when its player leaves, and its cards can be returned', () => {
    const { eng, deckZone } = table();
    const card = eng.state.zones[deckZone].cards[0];
    eng.dispatch({ type: 'move', cards: [card], to: copyOf(eng.state, SAM.playerId).id }, SAM.playerId, ctx());
    eng.dispatch({ type: 'seatLeave', playerId: SAM.playerId, reason: 'left' }, null, ctx());
    expect(eng.state.vacated.map((v) => v.playerName)).toEqual(['Sam']);
    const seat = eng.state.vacated[0].seatId;
    eng.dispatch({ type: 'resolveVacated', seat, returnTo: deckZone }, ALEX.playerId, ctx());
    expect(eng.state.zones[deckZone].cards).toContain(card);
    expect(eng.state.seats.find((x) => x.id === seat)).toBeUndefined();
    expect(copies(eng.state)).toHaveLength(1);
  });
});

describe('per-player zones: group edits (1.2)', () => {
  it('rename, relayout, width and new row apply to every copy; moving moves the group', () => {
    const { eng } = table();
    const any = copies(eng.state)[1].id;
    eng.dispatch({ type: 'zoneUpdate', zone: any, name: 'Reserve', layout: 'column', width: 'half', newRow: true }, ALEX.playerId, ctx());
    for (const z of copies(eng.state, 'Reserve')) expect([z.layout, z.width, z.newRow]).toEqual(['column', 'half', true]);
    const slots = () => boardSlots(eng.state.zoneOrder.map((id) => eng.state.zones[id])).map((z) => z.name);
    expect(slots().at(-1)).toBe('Reserve');
    eng.dispatch({ type: 'zoneMove', zone: any, index: 0 }, ALEX.playerId, ctx());
    expect(slots()[0]).toBe('Reserve');
    expect(adjacent(eng.state)).toBe(true);
  });

  it('removing removes every copy, moving their cards first', () => {
    const { eng, deckZone } = table();
    const [a, b] = eng.state.zones[deckZone].cards;
    eng.dispatch({ type: 'move', cards: [a], to: copyOf(eng.state, ALEX.playerId).id }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'move', cards: [b], to: copyOf(eng.state, SAM.playerId).id }, SAM.playerId, ctx());
    expectFail(() => run(eng.state, { type: 'zoneRemove', zone: copies(eng.state)[0].id }, ALEX.playerId), 'ZONE_NOT_EMPTY');
    eng.dispatch({ type: 'zoneRemove', zone: copies(eng.state)[0].id, moveTo: deckZone }, ALEX.playerId, ctx());
    expect(copies(eng.state)).toHaveLength(0);
    expect(eng.state.zones[deckZone].cards).toEqual(expect.arrayContaining([a, b]));
  });
});

describe('per-player zones: visibility and control (1.3)', () => {
  it('face-up cards are visible to everyone and named; face-down hidden from the owner too', () => {
    const { eng, deckZone } = table();
    const [up, down] = eng.state.zones[deckZone].cards;
    const mine = copyOf(eng.state, ALEX.playerId).id;
    eng.dispatch({ type: 'move', cards: [up], to: mine, face: 'up' }, ALEX.playerId, ctx());
    expect(eng.state.log.at(-1)!.text).toMatch(/Alex moved .+ of .+ from Standard to Alex's Tableau/);
    eng.dispatch({ type: 'move', cards: [down], to: mine, face: 'down' }, ALEX.playerId, ctx());
    expect(eng.state.log.at(-1)!.text).toBe("Alex moved 1 card from Standard to Alex's Tableau");
    const s = eng.state;
    const z: Zone = s.zones[mine];
    expect(canSee(s, SAM.playerId, s.cards[up], z)).toBe(true);
    expect(canSee(s, null, s.cards[up], z)).toBe(true);
    expect(canSee(s, ALEX.playerId, s.cards[down], z)).toBe(false);
    expect(canSee(s, SAM.playerId, s.cards[down], z)).toBe(false);
  });

  it("another player's take asks first; with open hands it moves; passing in works; flipping is refused", () => {
    const { eng, deckZone } = table();
    const [a, b] = eng.state.zones[deckZone].cards;
    const alexT = copyOf(eng.state, ALEX.playerId).id;
    eng.dispatch({ type: 'move', cards: [a], to: alexT, face: 'up' }, ALEX.playerId, ctx());
    // Sam passes a card in
    eng.dispatch({ type: 'move', cards: [b], to: alexT }, SAM.playerId, ctx());
    expect(eng.state.zones[alexT].cards).toContain(b);
    // Sam's take becomes a request; Alex approves
    const r = eng.dispatch({ type: 'move', cards: [a], to: copyOf(eng.state, SAM.playerId).id }, SAM.playerId, ctx());
    expect(r.request).toMatchObject({ zone: alexT });
    expect(eng.state.log.at(-1)!.text).toBe("Sam asked to take 1 card from Alex's Tableau");
    eng.dispatch({ type: 'respondTake', requestId: eng.state.requests[0].id, approve: true }, ALEX.playerId, ctx());
    expect(copyOf(eng.state, SAM.playerId).cards).toContain(a);
    // flipping in someone else's copy is refused
    expectFail(() => run(eng.state, { type: 'flip', cards: [b] }, SAM.playerId), 'OTHERS_HAND');
    expectFail(() => run(eng.state, { type: 'shuffle', zone: alexT }, SAM.playerId), 'OTHERS_HAND');
    // open hands: take directly
    eng.dispatch({ type: 'settings', openHands: true }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'move', cards: [b], to: deckZone }, SAM.playerId, ctx());
    expect(eng.state.zones[deckZone].cards).toContain(b);
  });
});

describe('per-player zones in setups (4.2)', () => {
  const content = SetupContentSchema.parse({
    name: 'Reserve game',
    players: { min: 1, max: 4 },
    slots: [{ id: 's1', label: 'Deck', defaultDeckId: 'x' }],
    homes: { s1: 'stock' },
    zones: [
      { key: 'stock', name: 'Stock', layout: 'pile' },
      { key: 'res', name: "{name}'s Reserve", layout: 'spread', perSeat: true, down: 3 },
    ],
    counters: [],
  });

  it('applies as one per-player zone dealt into each copy; a late joiner gets an empty copy; recording maps it back', () => {
    const { eng } = setup([SAM]);
    const seated = eng.state.seats.filter((x) => x.playerId);
    const r = expandSetup(content, { seats: seated.map((x) => ({ name: x.name })), deckSizes: { s1: 52 } });
    if (!r.ok) throw new Error(r.message);
    eng.dispatch({ type: 'applySetup', setup: { id: 'set', versionId: 'v', name: 'Reserve game' }, decks: [{ slot: 's1', deck: { ...standardDeck('tdR'), homeZoneId: '' } }], plan: r.plan }, ALEX.playerId, ctx());
    expect(copies(eng.state, 'Reserve').map((z) => z.cards.length)).toEqual([3, 3]);
    expect(copies(eng.state, 'Reserve').every((z) => z.cards.every((c) => !eng.state.cards[c].faceUp))).toBe(true);
    eng.dispatch({ type: 'seatJoin', player: KIM }, null, ctx());
    expect(copyOf(eng.state, KIM.playerId, 'Reserve').cards).toEqual([]);
    // Kim's empty copy is ignored by recording: the deal is taken from the copies of the seated players
    eng.dispatch({ type: 'seatLeave', playerId: KIM.playerId, reason: 'left' }, null, ctx());
    const rec = recordSetup(eng.state, { name: 'Again' });
    expect(rec.zones.find((z) => z.name === 'Reserve')).toMatchObject({ perSeat: true, down: 3, up: 0 });
    const fixed = recordSetup(eng.state, { name: 'Fixed', fixed: true });
    const keys = Object.keys(fixed.fixed!.zones).filter((k) => k.includes('#'));
    expect(keys).toHaveLength(2);
    const re = expandSetup(SetupContentSchema.parse(fixed), { seats: seated.map((x) => ({ name: x.name })), deckSizes: { s1: 52 }, deckVersions: { s1: 'v1' } });
    expect(re.ok && re.plan.fixed!.some((f) => 'seat' in f.to && f.to.seat === 1)).toBe(true);
  });
});
