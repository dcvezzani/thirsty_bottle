import { describe, it, expect } from 'vitest';
import { ActionError } from '@vct/shared';
import { ALEX, SAM, setup, run, ctx, goblinDeck, hand, zoneByName } from './helpers.js';

function twoDecks() {
  const { eng, deckZone } = setup([SAM]);
  eng.dispatch({ type: 'loadDeck', deck: goblinDeck('d2') }, ALEX.playerId, ctx());
  const monsters = eng.state.decks.d2.homeZoneId;
  const table = zoneByName(eng.state, 'Table').id;
  const std = eng.state.zones[deckZone].cards;
  const gob = eng.state.zones[monsters].cards;
  // spread both decks: 2 standard face up on the table, 1 standard in Sam's hand, 2 monsters face up on the table, 1 monster in Alex's hand
  eng.dispatch({ type: 'move', cards: std.slice(0, 2), to: table, face: 'up' }, ALEX.playerId, ctx());
  eng.dispatch({ type: 'move', cards: [std[2]], to: hand(eng.state, SAM.playerId).id }, SAM.playerId, ctx());
  eng.dispatch({ type: 'move', cards: gob.slice(0, 2), to: table, face: 'up' }, ALEX.playerId, ctx());
  eng.dispatch({ type: 'move', cards: [gob[2]], to: hand(eng.state, ALEX.playerId).id }, ALEX.playerId, ctx());
  return { eng, deckZone, monsters, table, std: std.slice(0, 3), gob: gob.slice(0, 3) };
}

describe('gather-by-deck (1.1)', () => {
  it('gathers only that deck, face down; other decks keep place, face and reveals', () => {
    const { eng, deckZone, table, std, gob } = twoDecks();
    eng.dispatch({ type: 'show', cards: [std[0]], to: [SAM.playerId] }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'gather', zones: 'all', to: deckZone, deck: 'd2' }, ALEX.playerId, ctx());
    const s = eng.state;
    for (const id of gob) expect(s.zones[deckZone].cards).toContain(id);
    expect(s.zones[deckZone].cards.filter((id) => s.cards[id].deckId === 'd2').every((id) => !s.cards[id].faceUp)).toBe(true);
    expect(s.zones[deckZone].cards.filter((id) => s.cards[id].deckId === 'd2')).toHaveLength(4); // all monsters
    // standard cards stayed: two face up on the table (one still shown to Sam), one in Sam's hand
    expect(s.zones[table].cards).toEqual(std.slice(0, 2));
    expect(std.slice(0, 2).every((id) => s.cards[id].faceUp)).toBe(true);
    expect(s.cards[std[0]].shownTo).toEqual([SAM.playerId]);
    expect(hand(s, SAM.playerId).cards).toEqual([std[2]]);
    expect(s.log.at(-1)!.text).toBe('Alex gathered 4 Monsters cards into Standard');
  });

  it('gather all is unchanged; an unknown deck is refused', () => {
    const { eng, deckZone } = twoDecks();
    expect(() => run(eng.state, { type: 'gather', zones: 'all', to: deckZone, deck: 'nope' }, ALEX.playerId)).toThrow(ActionError);
    eng.dispatch({ type: 'gather', zones: 'all', to: deckZone }, ALEX.playerId, ctx());
    const s = eng.state;
    expect(s.zones[deckZone].cards).toHaveLength(52 + 4);
    expect(s.zones[deckZone].cards.every((id) => !s.cards[id].faceUp)).toBe(true);
  });
});
