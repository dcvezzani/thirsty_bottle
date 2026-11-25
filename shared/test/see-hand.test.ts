import { describe, it, expect } from 'vitest';
import { ActionError, canSee, handZoneId, type TableState } from '@vct/shared';
import { ALEX, SAM, KIM, setup, run, ctx, hand } from './helpers.js';

// Alex (host) holds 3 cards, Sam asks to see Alex's hand
function table() {
  const { eng, deckZone } = setup([SAM]);
  const cards = eng.state.zones[deckZone].cards.slice(0, 3);
  eng.dispatch({ type: 'move', cards, to: handZoneId(eng.state.seats.find((x) => x.playerId === ALEX.playerId)!.id) }, ALEX.playerId, ctx());
  const alexSeat = eng.state.seats.find((x) => x.playerId === ALEX.playerId)!.id;
  const samSeat = eng.state.seats.find((x) => x.playerId === SAM.playerId)!.id;
  return { eng, deckZone, cards, alexSeat, samSeat };
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
const reqId = (s: TableState) => s.seeRequests[0].id;

describe('ask to see a hand: rules (1.1)', () => {
  it('asking creates one request and logs it; a duplicate, a self-ask and a spectator are refused', () => {
    const { eng, alexSeat, samSeat } = table();
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    expect(eng.state.seeRequests).toMatchObject([{ from: SAM.playerId, seatId: alexSeat }]);
    expect(eng.state.log.at(-1)!.text).toBe("Sam asked to see Alex's hand");
    expectFail(() => run(eng.state, { type: 'seeAsk', seat: alexSeat }, SAM.playerId), 'ALREADY_ASKED');
    expectFail(() => run(eng.state, { type: 'seeAsk', seat: samSeat }, SAM.playerId), 'BAD_TARGET');
    // a spectator (not seated) cannot ask
    expectFail(() => run(eng.state, { type: 'seeAsk', seat: alexSeat }, KIM.playerId), 'SPECTATOR');
  });

  it('allowing shows every hand card to the asker only; the log is public without names, private with them', () => {
    const { eng, cards, alexSeat } = table();
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    eng.dispatch({ type: 'seeRespond', requestId: reqId(eng.state), approve: true }, ALEX.playerId, ctx());
    const s = eng.state;
    expect(s.seeRequests).toEqual([]);
    for (const id of cards) {
      expect(s.cards[id].shownTo).toEqual([SAM.playerId]);
      expect(s.cards[id].shownBy).toBe(ALEX.playerId);
      expect(canSee(s, SAM.playerId, s.cards[id], s.zones[handZoneId(alexSeat)])).toBe(true);
      expect(canSee(s, KIM.playerId, s.cards[id], s.zones[handZoneId(alexSeat)])).toBe(false);
    }
    const entry = s.log.at(-1)!;
    expect(entry.text).toBe('Alex showed Sam their hand');
    expect(entry.privateText![SAM.playerId]).toMatch(/^Alex showed you their hand: .+/);
    expect(entry.privateText![ALEX.playerId]).toBe('You showed your hand to Sam');
  });

  it('a card added later stays hidden; a card that leaves the hand leaves the reveal', () => {
    const { eng, deckZone, cards, alexSeat } = table();
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    eng.dispatch({ type: 'seeRespond', requestId: reqId(eng.state), approve: true }, ALEX.playerId, ctx());
    const later = eng.state.zones[deckZone].cards[0];
    eng.dispatch({ type: 'move', cards: [later], to: handZoneId(alexSeat) }, ALEX.playerId, ctx());
    expect(eng.state.cards[later].shownTo).toEqual([]);
    expect(canSee(eng.state, SAM.playerId, eng.state.cards[later], eng.state.zones[handZoneId(alexSeat)])).toBe(false);
    const table1 = Object.values(eng.state.zones).find((z) => z.name === 'Table')!.id;
    eng.dispatch({ type: 'move', cards: [cards[0]], to: table1, face: 'down' }, ALEX.playerId, ctx());
    expect(eng.state.cards[cards[0]].shownTo).toEqual([]); // cleared by the move
    expect(eng.state.cards[cards[1]].shownTo).toEqual([SAM.playerId]);
  });

  it('declining logs and changes nothing; only the owner answers; the asker can cancel; stopping uses unshow', () => {
    const { eng, cards, alexSeat } = table();
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    const id = reqId(eng.state);
    expectFail(() => run(eng.state, { type: 'seeRespond', requestId: id, approve: true }, SAM.playerId), 'NOT_YOURS');
    expectFail(() => run(eng.state, { type: 'seeCancel', requestId: id }, ALEX.playerId), 'NOT_YOURS');
    eng.dispatch({ type: 'seeRespond', requestId: id, approve: false }, ALEX.playerId, ctx());
    expect(eng.state.log.at(-1)!.text).toBe("Alex declined Sam's request");
    expect(eng.state.seeRequests).toEqual([]);
    expect(cards.every((c) => eng.state.cards[c].shownTo.length === 0)).toBe(true);
    // ask again, then cancel
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    eng.dispatch({ type: 'seeCancel', requestId: reqId(eng.state) }, SAM.playerId, ctx());
    expect(eng.state.seeRequests).toEqual([]);
    expectFail(() => run(eng.state, { type: 'seeRespond', requestId: id, approve: true }, ALEX.playerId), 'NO_REQUEST');
    // allow, then the owner stops showing the whole hand in one action
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    eng.dispatch({ type: 'seeRespond', requestId: reqId(eng.state), approve: true }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'unshow', cards: cards }, ALEX.playerId, ctx());
    expect(cards.every((c) => eng.state.cards[c].shownTo.length === 0)).toBe(true);
  });

  it('works out of turn in turn-based mode', () => {
    const { eng, alexSeat, samSeat } = table();
    eng.dispatch({ type: 'setMode', mode: 'turn' }, ALEX.playerId, ctx()); // Alex is active, Sam is not
    expect(eng.state.turn.active).toBe(alexSeat);
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    eng.dispatch({ type: 'seeRespond', requestId: reqId(eng.state), approve: true }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'setActive', seat: samSeat }, ALEX.playerId, ctx()); // now Alex is out of turn
    eng.dispatch({ type: 'seeAsk', seat: samSeat }, ALEX.playerId, ctx());
    expect(eng.state.seeRequests).toHaveLength(1);
  });

  it('a seat leaving drops requests both ways; the system drop clears an asker\'s requests; reset clears all', () => {
    const { eng, alexSeat, samSeat } = table();
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    eng.dispatch({ type: 'seeAsk', seat: samSeat }, ALEX.playerId, ctx());
    expect(eng.state.seeRequests).toHaveLength(2);
    eng.dispatch({ type: 'seeDrop', from: SAM.playerId, except: alexSeat }, null, ctx()); // Sam is now viewing Alex's table
    expect(eng.state.seeRequests.map((r) => r.from).sort()).toEqual([ALEX.playerId, SAM.playerId].sort());
    eng.dispatch({ type: 'seeDrop', from: SAM.playerId }, null, ctx());
    expect(eng.state.seeRequests.map((r) => r.from)).toEqual([ALEX.playerId]);
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    eng.dispatch({ type: 'seatLeave', playerId: SAM.playerId, reason: 'left' }, null, ctx());
    expect(eng.state.seeRequests).toEqual([]);
    eng.dispatch({ type: 'seatJoin', player: SAM }, null, ctx());
    eng.dispatch({ type: 'seeAsk', seat: alexSeat }, SAM.playerId, ctx());
    eng.dispatch({ type: 'reset' }, ALEX.playerId, ctx());
    expect(eng.state.seeRequests).toEqual([]);
    expect(hand(eng.state, ALEX.playerId).cards).toEqual([]);
  });
});
