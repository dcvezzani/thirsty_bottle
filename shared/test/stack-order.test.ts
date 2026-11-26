import { describe, it, expect } from 'vitest';
import { handZoneId } from '@vct/shared';
import { ALEX, SAM, setup, ctx, zoneByName } from './helpers.js';

function table(layout: 'spread' | 'column' | 'free' = 'spread') {
  const { eng, deckZone } = setup([SAM]);
  const discard = zoneByName(eng.state, 'Discard').id;
  const alexHand = handZoneId(eng.state.seats.find((s) => s.playerId === ALEX.playerId)!.id);
  let src = zoneByName(eng.state, 'Table').id;
  if (layout !== 'spread') {
    eng.dispatch({ type: 'zoneAdd', name: 'Src', layout } as any, ALEX.playerId, ctx());
    src = zoneByName(eng.state, 'Src').id;
  }
  const cards = eng.state.zones[deckZone].cards.slice(0, 5);
  return { eng, deckZone, discard, alexHand, src, cards };
}
const pile = (eng: ReturnType<typeof table>['eng'], id: string) => eng.state.zones[id].cards;

describe('stacking cards onto a pile (1.1)', () => {
  it('a fanned hand moved onto a pile lands with its last card on top', () => {
    const { eng, discard, alexHand, cards } = table();
    const [a, b, c, d] = cards;
    eng.dispatch({ type: 'move', cards: [a, b, c, d], to: alexHand }, ALEX.playerId, ctx());
    const inHand = [...eng.state.zones[alexHand].cards]; // the order in the hand, left to right
    eng.dispatch({ type: 'move', cards: inHand, to: discard }, ALEX.playerId, ctx());
    expect(pile(eng, discard)).toEqual([...inHand].reverse()); // the uncovered (last) card is the pile's top
  });

  it('cards from a spread: the last is on top', () => {
    const { eng, discard, src, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 4), to: src, face: 'up' }, ALEX.playerId, ctx());
    const list = [...eng.state.zones[src].cards];
    eng.dispatch({ type: 'move', cards: [list[1], list[2], list[3]], to: discard }, ALEX.playerId, ctx());
    expect(pile(eng, discard)).toEqual([list[3], list[2], list[1]]);
  });

  it('a run from a column: the last card, the fully visible one, is on top', () => {
    const { eng, discard, src, cards } = table('column');
    eng.dispatch({ type: 'move', cards: cards.slice(0, 5), to: src, face: 'up' }, ALEX.playerId, ctx());
    const list = [...eng.state.zones[src].cards];
    eng.dispatch({ type: 'move', cards: list.slice(2), to: discard }, ALEX.playerId, ctx());
    expect(pile(eng, discard)).toEqual([...list.slice(2)].reverse());
  });

  it('cards from a free zone follow the same rule', () => {
    const { eng, discard, src, cards } = table('free');
    eng.dispatch({ type: 'move', cards: cards.slice(0, 3), to: src, face: 'up' }, ALEX.playerId, ctx());
    const list = [...eng.state.zones[src].cards];
    eng.dispatch({ type: 'move', cards: list, to: discard }, ALEX.playerId, ctx());
    expect(pile(eng, discard)).toEqual([...list].reverse());
  });

  it('the order does not depend on the order the cards were chosen in', () => {
    const { eng, discard, src, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 3), to: src, face: 'up' }, ALEX.playerId, ctx());
    const list = [...eng.state.zones[src].cards];
    eng.dispatch({ type: 'move', cards: [list[0], list[2], list[1]], to: discard }, ALEX.playerId, ctx()); // chosen out of order
    expect(pile(eng, discard)).toEqual([list[2], list[1], list[0]]);
  });

  it('one card, and a move from a pile, are unchanged', () => {
    const { eng, deckZone, discard, cards } = table();
    eng.dispatch({ type: 'move', cards: [cards[0]], to: discard }, ALEX.playerId, ctx());
    expect(pile(eng, discard)).toEqual([cards[0]]);
    // a whole pile moved onto another keeps its order and lands on top
    const before = [...eng.state.zones[deckZone].cards];
    eng.dispatch({ type: 'move', cards: before.slice(0, 3), to: discard }, ALEX.playerId, ctx());
    expect(pile(eng, discard).slice(0, 3)).toEqual(before.slice(0, 3));
    expect(pile(eng, discard)[3]).toBe(cards[0]);
  });

  it('drops onto a spread, a hand and a column are unchanged (list order, at the end)', () => {
    const { eng, deckZone, alexHand, src } = table();
    const some = eng.state.zones[deckZone].cards.slice(0, 3);
    eng.dispatch({ type: 'move', cards: some, to: src, face: 'up' }, ALEX.playerId, ctx());
    expect(eng.state.zones[src].cards).toEqual(some);
    eng.dispatch({ type: 'move', cards: some, to: alexHand }, ALEX.playerId, ctx());
    expect(eng.state.zones[alexHand].cards).toEqual(some);
    const c = table('column');
    const five = c.eng.state.zones[c.deckZone].cards.slice(0, 3);
    c.eng.dispatch({ type: 'move', cards: five, to: c.src, face: 'up' }, ALEX.playerId, ctx());
    expect(c.eng.state.zones[c.src].cards).toEqual(five);
  });

  it('cards from two zones keep the order they were given', () => {
    const { eng, discard, alexHand, src, cards } = table();
    eng.dispatch({ type: 'move', cards: [cards[0]], to: alexHand }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'move', cards: [cards[1]], to: src, face: 'up' }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'move', cards: [cards[0], cards[1]], to: discard }, ALEX.playerId, ctx());
    expect(pile(eng, discard)).toEqual([cards[0], cards[1]]);
  });

  it('the move is one action and one undo restores the source order', () => {
    const { eng, discard, src, cards } = table();
    eng.dispatch({ type: 'move', cards: cards.slice(0, 3), to: src, face: 'up' }, ALEX.playerId, ctx());
    const list = [...eng.state.zones[src].cards];
    const logs = eng.state.log.length;
    eng.dispatch({ type: 'move', cards: list, to: discard }, ALEX.playerId, ctx());
    expect(eng.state.log.length).toBe(logs + 1);
    eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx());
    expect(eng.state.zones[src].cards).toEqual(list);
  });
});
