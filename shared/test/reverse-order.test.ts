import { describe, it, expect } from 'vitest';
import { ActionError, ActionSchema, handZoneId } from '@vct/shared';
import { ALEX, SAM, setup, ctx, zoneByName, hand } from './helpers.js';

function table() {
  const { eng, deckZone } = setup([SAM]);
  const spread = zoneByName(eng.state, 'Table').id;
  const discard = zoneByName(eng.state, 'Discard').id;
  const alexHand = handZoneId(eng.state.seats.find((s) => s.playerId === ALEX.playerId)!.id);
  const cards = eng.state.zones[deckZone].cards.slice(0, 6);
  eng.undo = null;
  return { eng, deckZone, spread, discard, alexHand, cards };
}
const list = (eng: ReturnType<typeof table>['eng'], id: string) => [...eng.state.zones[id].cards];
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

describe('reversing card order (1.1)', () => {
  it('reverses scattered selected cards in place and leaves the others where they are', () => {
    const { eng, spread, cards } = table();
    const five = cards.slice(0, 5);
    eng.dispatch({ type: 'move', cards: five, to: spread, face: 'up' }, ALEX.playerId, ctx());
    const [a, b, c, d, e] = list(eng, spread);
    eng.dispatch({ type: 'reverseCards', cards: [b, d] }, ALEX.playerId, ctx());
    expect(list(eng, spread)).toEqual([a, d, c, b, e]);
  });

  it('reverses a whole hand when every card is selected', () => {
    const { eng, alexHand, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 4), to: alexHand }, ALEX.playerId, ctx());
    const before = list(eng, alexHand);
    eng.dispatch({ type: 'reverseCards', cards: before }, ALEX.playerId, ctx());
    expect(list(eng, alexHand)).toEqual([...before].reverse());
  });

  it('does not depend on the order the cards were chosen in', () => {
    const { eng, spread, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 4), to: spread, face: 'up' }, ALEX.playerId, ctx());
    const [a, b, c, d] = list(eng, spread);
    eng.dispatch({ type: 'reverseCards', cards: [d, a, c, b] }, ALEX.playerId, ctx());
    expect(list(eng, spread)).toEqual([d, c, b, a]);
  });

  it('reverses a pile or any zone without changing faces or rotations', () => {
    const { eng, deckZone, spread, cards } = table();
    const before = list(eng, deckZone).slice(0, 5);
    eng.dispatch({ type: 'reverseZone', zone: deckZone }, ALEX.playerId, ctx());
    const after = list(eng, deckZone);
    expect(after.slice(-5)).toEqual([...before].reverse().slice(0)); // the old top five are now the bottom five, reversed
    expect(after.every((id) => !eng.state.cards[id].faceUp)).toBe(true); // every card is still face down
    // rotations are kept too
    eng.dispatch({ type: 'move', cards: cards.slice(0, 3), to: spread, face: 'up' }, ALEX.playerId, ctx());
    const [x, y, z] = list(eng, spread);
    eng.dispatch({ type: 'rotate', cards: [y], to: 3 }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'reverseZone', zone: spread }, ALEX.playerId, ctx());
    expect(list(eng, spread)).toEqual([z, y, x]);
    expect(eng.state.cards[y].rot).toBe(3);
    expect(eng.state.cards[y].faceUp).toBe(true);
  });

  it('logs a card action, and fewer than two cards does nothing and logs nothing', () => {
    const { eng, spread, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 3), to: spread, face: 'up' }, ALEX.playerId, ctx());
    const [a, b] = list(eng, spread);
    const logs = eng.state.log.length;
    eng.dispatch({ type: 'reverseCards', cards: [a] }, ALEX.playerId, ctx());
    expect(eng.state.log.length).toBe(logs);
    expect(list(eng, spread)[0]).toBe(a);
    const empty = zoneByName(eng.state, 'Discard').id;
    eng.dispatch({ type: 'reverseZone', zone: empty }, ALEX.playerId, ctx());
    expect(eng.state.log.length).toBe(logs);
    eng.dispatch({ type: 'reverseCards', cards: [a, b] }, ALEX.playerId, ctx());
    const e = eng.state.log.at(-1)!;
    expect(e.text).toMatch(/^Alex reversed /);
    expect(e.cardAction).toBe(true);
    eng.dispatch({ type: 'reverseZone', zone: spread }, ALEX.playerId, ctx());
    expect(eng.state.log.at(-1)!.text).toBe('Alex reversed Table');
  });

  it("is refused in another player's hand and zone, and allowed in one's own hand out of turn", () => {
    const { eng, alexHand, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 3), to: alexHand }, ALEX.playerId, ctx());
    const mine = list(eng, alexHand);
    expectFail(() => eng.dispatch({ type: 'reverseCards', cards: mine }, SAM.playerId, ctx()), 'OTHERS_HAND');
    expectFail(() => eng.dispatch({ type: 'reverseZone', zone: alexHand }, SAM.playerId, ctx()), 'OTHERS_HAND');
    // turn mode: Sam is not the active player, but may reverse his own hand
    eng.dispatch({ type: 'setMode', mode: 'turn' }, ALEX.playerId, ctx());
    const sam = hand(eng.state, SAM.playerId).id;
    const samCards = eng.state.zones[eng.state.decks[Object.keys(eng.state.decks)[0]].homeZoneId].cards.slice(10, 13);
    eng.dispatch({ type: 'move', cards: samCards, to: sam }, ALEX.playerId, ctx());
    expect(() => eng.dispatch({ type: 'reverseZone', zone: sam }, SAM.playerId, ctx())).not.toThrow();
  });

  it('is undoable, and its schema takes cards or a zone', () => {
    const { eng, spread, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 4), to: spread, face: 'up' }, ALEX.playerId, ctx());
    const before = list(eng, spread);
    eng.dispatch({ type: 'reverseCards', cards: before }, ALEX.playerId, ctx());
    expect(list(eng, spread)).toEqual([...before].reverse());
    eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx());
    expect(list(eng, spread)).toEqual(before);
    expect(ActionSchema.safeParse({ type: 'reverseCards', cards: ['a', 'b'] }).success).toBe(true);
    expect(ActionSchema.safeParse({ type: 'reverseZone', zone: 'z' }).success).toBe(true);
    expect(ActionSchema.safeParse({ type: 'reverse' }).success).toBe(true); // the turn-direction action is untouched
  });
});

describe('moved cards keep their order (1.1)', () => {
  it('a hand onto a pile: the first card is on top', () => {
    const { eng, discard, alexHand, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 4), to: alexHand }, ALEX.playerId, ctx());
    const inHand = list(eng, alexHand);
    eng.dispatch({ type: 'move', cards: inHand, to: discard }, ALEX.playerId, ctx());
    expect(list(eng, discard)).toEqual(inHand);
  });

  it('a pile onto a spread keeps left-to-right order', () => {
    const { eng, deckZone, spread } = table();
    const top3 = list(eng, deckZone).slice(0, 3);
    eng.dispatch({ type: 'move', cards: top3, to: spread, face: 'up' }, ALEX.playerId, ctx());
    expect(list(eng, spread)).toEqual(top3);
  });

  it('reversing first gives the other stacking: the card that was uncovered ends on top', () => {
    const { eng, discard, alexHand, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 4), to: alexHand }, ALEX.playerId, ctx());
    const inHand = list(eng, alexHand);
    eng.dispatch({ type: 'reverseCards', cards: inHand }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'move', cards: list(eng, alexHand), to: discard }, ALEX.playerId, ctx());
    expect(list(eng, discard)).toEqual([...inHand].reverse());
    expect(list(eng, discard)[0]).toBe(inHand[3]); // D, which nothing covered in the hand, is on top
  });

  it('a column run keeps its order onto a pile', () => {
    const { eng, discard, cards } = table();
    eng.dispatch({ type: 'zoneAdd', name: 'Col', layout: 'column' } as any, ALEX.playerId, ctx());
    const col = zoneByName(eng.state, 'Col').id;
    eng.dispatch({ type: 'move', cards: cards.slice(0, 4), to: col, face: 'up' }, ALEX.playerId, ctx());
    const run = list(eng, col).slice(1);
    eng.dispatch({ type: 'move', cards: run, to: discard }, ALEX.playerId, ctx());
    expect(list(eng, discard)).toEqual(run);
  });
});
