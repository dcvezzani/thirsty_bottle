import { describe, it, expect } from 'vitest';
import { ActionError, ActionSchema, handZoneId, rotNorm } from '@vct/shared';
import { ALEX, SAM, setup, ctx, goblinDeck, hand, zoneByName } from './helpers.js';

function table() {
  const { eng, deckZone } = setup([SAM]);
  const tableZone = zoneByName(eng.state, 'Table').id;
  const cards = eng.state.zones[deckZone].cards.slice(0, 4);
  eng.dispatch({ type: 'move', cards, to: tableZone, face: 'up' }, ALEX.playerId, ctx());
  eng.undo = null;
  return { eng, deckZone, tableZone, cards };
}
const rot = (eng: ReturnType<typeof table>['eng'], id: string) => eng.state.cards[id].rot ?? 0;
function expectFail(f: () => unknown, code: string) {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ActionError);
    expect((e as ActionError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe('card rotation: rules (1.1)', () => {
  it('rotNorm wraps any integer into 0..7', () => {
    expect([rotNorm(0), rotNorm(7), rotNorm(8), rotNorm(-1), rotNorm(-9), rotNorm(15)]).toEqual([0, 7, 0, 7, 7, 7]);
  });

  it('rotates by steps, wraps both ways, and logs a card action', () => {
    const { eng, cards } = table();
    eng.dispatch({ type: 'rotate', cards: [cards[0], cards[1]], by: 1 }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(1);
    eng.dispatch({ type: 'rotate', cards: [cards[0]], by: -2 }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(7);
    eng.dispatch({ type: 'rotate', cards: [cards[0]], by: 1 }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(0);
    expect('rot' in eng.state.cards[cards[0]]).toBe(false); // upright is stored as nothing
    const e = eng.state.log.find((l) => /rotated/.test(l.text))!;
    expect(e.cardAction).toBe(true);
  });

  it('sets an absolute rotation, and upright with to 0', () => {
    const { eng, cards } = table();
    eng.dispatch({ type: 'rotate', cards: [cards[2]], to: 3 }, ALEX.playerId, ctx());
    expect(rot(eng, cards[2])).toBe(3);
    eng.dispatch({ type: 'rotate', cards: [cards[2]], to: 0 }, ALEX.playerId, ctx());
    expect(rot(eng, cards[2])).toBe(0);
    expect(eng.state.log.at(-1)!.text).toMatch(/upright/);
  });

  it('refuses a rotation that says neither or both of by and to, or by 0', () => {
    const { eng, cards } = table();
    for (const bad of [{}, { by: 1, to: 2 }, { by: 0 }]) {
      expectFail(() => eng.dispatch({ type: 'rotate', cards: [cards[0]], ...bad } as any, ALEX.playerId, ctx()), 'BAD_ACTION');
    }
    expect(ActionSchema.safeParse({ type: 'rotate', cards: ['a'], by: 9 }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: 'rotate', cards: ['a'], to: 8 }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: 'rotateZone', zone: 'z', by: -1 }).success).toBe(true);
  });

  it('rotates every card in a zone, and an empty zone does nothing', () => {
    const { eng, tableZone, deckZone, cards } = table();
    eng.dispatch({ type: 'rotateZone', zone: tableZone, by: 2 }, ALEX.playerId, ctx());
    for (const id of cards) expect(rot(eng, id)).toBe(2);
    eng.dispatch({ type: 'rotateZone', zone: tableZone, to: 0 }, ALEX.playerId, ctx());
    for (const id of cards) expect(rot(eng, id)).toBe(0);
    const before = eng.state.log.length;
    const empty = zoneByName(eng.state, 'Discard').id;
    eng.dispatch({ type: 'rotateZone', zone: empty, by: 1 }, ALEX.playerId, ctx());
    expect(eng.state.log.length).toBe(before);
    expect(deckZone).toBeTruthy();
  });

  it("refuses cards in another player's hand and zone, like flipping", () => {
    const { eng, deckZone } = table();
    const c = eng.state.zones[deckZone].cards[0];
    eng.dispatch({ type: 'move', cards: [c], to: handZoneId(eng.state.seats.find((s) => s.playerId === ALEX.playerId)!.id) }, ALEX.playerId, ctx());
    expectFail(() => eng.dispatch({ type: 'rotate', cards: [c], by: 1 }, SAM.playerId, ctx()), 'OTHERS_HAND');
    expectFail(() => eng.dispatch({ type: 'rotateZone', zone: hand(eng.state, ALEX.playerId).id, by: 1 }, SAM.playerId, ctx()), 'OTHERS_HAND');
  });

  it('is undoable', () => {
    const { eng, cards } = table();
    eng.dispatch({ type: 'rotate', cards: [cards[0]], by: 3 }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(3);
    eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(0);
  });

  it('moves, shuffles, draws, cuts and turning a pile over keep the rotation', () => {
    const { eng, deckZone, tableZone, cards } = table();
    eng.dispatch({ type: 'rotate', cards: [cards[0]], to: 5 }, ALEX.playerId, ctx());
    const alexHand = hand(eng.state, ALEX.playerId).id;
    eng.dispatch({ type: 'move', cards: [cards[0]], to: alexHand }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(5);
    eng.dispatch({ type: 'move', cards: [cards[0]], to: deckZone, index: 0 }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(5);
    eng.dispatch({ type: 'shuffle', zone: deckZone }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(5);
    eng.dispatch({ type: 'cut', zone: deckZone, mode: 'complete' }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(5);
    eng.dispatch({ type: 'flipZone', zone: deckZone }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(5);
    eng.dispatch({ type: 'draw', zone: deckZone, count: 52, from: 'top' }, ALEX.playerId, ctx());
    expect(rot(eng, cards[0])).toBe(5);
    expect(tableZone).toBeTruthy();
  });

  it('gather returns every gathered card upright', () => {
    const { eng, deckZone, tableZone, cards } = table();
    eng.dispatch({ type: 'rotateZone', zone: tableZone, by: 3 }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'gather', zones: 'all', to: deckZone }, ALEX.playerId, ctx());
    for (const id of cards) expect(rot(eng, id)).toBe(0);
  });

  it('gathering one deck leaves the other deck rotated', () => {
    const { eng, deckZone } = setup([SAM]);
    eng.dispatch({ type: 'loadDeck', deck: goblinDeck('d2') }, ALEX.playerId, ctx());
    const table = zoneByName(eng.state, 'Table').id;
    const std = eng.state.zones[deckZone].cards.slice(0, 2);
    const gob = eng.state.zones[eng.state.decks.d2.homeZoneId].cards.slice(0, 2);
    eng.dispatch({ type: 'move', cards: [...std, ...gob], to: table, face: 'up' }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'rotateZone', zone: table, by: 2 }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'gather', zones: 'all', to: deckZone, deck: 'd2' }, ALEX.playerId, ctx());
    for (const id of gob) expect(eng.state.cards[id].rot ?? 0).toBe(0);
    for (const id of std) expect(eng.state.cards[id].rot).toBe(2);
  });

  it('a saved state without a rotation field reads as upright', () => {
    const { eng, cards } = table();
    expect(eng.state.cards[cards[0]].rot).toBeUndefined();
    eng.dispatch({ type: 'rotate', cards: [cards[0]], by: 1 }, ALEX.playerId, ctx());
    expect(rot(eng, cards[1])).toBe(0);
  });
});
