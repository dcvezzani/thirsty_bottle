import { describe, it, expect } from 'vitest';
import { ActionError, handZoneId, locate, type TableState } from '@vct/shared';
import { ALEX, SAM, KIM, LEE, setup, run, hand, zoneByName, ctx, goblinDeck, seqRng } from './helpers.js';

const top = (s: TableState, zid: string, n = 1) => s.zones[zid].cards.slice(0, n);

describe('move, flip, reorder, pass, gather, counters, zones (2.2)', () => {
  it('moves cards to a zone preserving face state by default', () => {
    const { eng, deckZone } = setup();
    const s = eng.state;
    const table = zoneByName(s, 'Table');
    const ids = top(s, deckZone, 2);
    const r = run(s, { type: 'move', cards: ids, to: table.id }, ALEX.playerId);
    expect(r.state.zones[table.id].cards).toEqual(ids);
    expect(ids.every((i) => r.state.cards[i].faceUp === false)).toBe(true);
    expect(r.state.zones[deckZone].cards).not.toContain(ids[0]);
  });
  it('flips during move when requested', () => {
    const { eng, deckZone } = setup();
    const table = zoneByName(eng.state, 'Table');
    const [id] = top(eng.state, deckZone);
    const r = run(eng.state, { type: 'move', cards: [id], to: table.id, face: 'up' }, ALEX.playerId);
    expect(r.state.cards[id].faceUp).toBe(true);
    expect(r.state.log.at(-1)!.text).toBe('Alex moved A of Spades from Standard to Table');
  });
  it('plays face down without revealing identity in the log', () => {
    const { eng, deckZone } = setup();
    let s = run(eng.state, { type: 'draw', zone: deckZone, count: 1, from: 'top' }, ALEX.playerId).state;
    const [id] = hand(s, ALEX.playerId).cards;
    s = run(s, { type: 'move', cards: [id], to: zoneByName(s, 'Table').id, face: 'down' }, ALEX.playerId).state;
    expect(s.log.at(-1)!.text).toBe('Alex played 1 card to Table');
    expect(s.log.at(-1)!.text).not.toContain('Spades');
  });
  it('allows unconventional moves (discard straight into hand)', () => {
    const { eng, deckZone } = setup();
    const discard = zoneByName(eng.state, 'Discard');
    let s = run(eng.state, { type: 'move', cards: top(eng.state, deckZone), to: discard.id, face: 'up' }, ALEX.playerId).state;
    const myHand = hand(s, ALEX.playerId);
    s = run(s, { type: 'move', cards: [discard.cards[0] ?? s.zones[discard.id].cards[0]], to: myHand.id }, ALEX.playerId).state;
    expect(hand(s, ALEX.playerId).cards).toHaveLength(1);
  });
  it('reorders within a zone', () => {
    const { eng, deckZone } = setup();
    const ids = top(eng.state, deckZone, 3);
    const r = run(eng.state, { type: 'move', cards: [ids[0]], to: deckZone, index: 2 }, ALEX.playerId);
    expect(top(r.state, deckZone, 3)).toEqual([ids[1], ids[2], ids[0]]);
  });
  it('passes cards to another player (log reveals names only to the two of them)', () => {
    const { eng, deckZone } = setup();
    let s = run(eng.state, { type: 'draw', zone: deckZone, count: 3, from: 'top' }, ALEX.playerId).state;
    const ids = hand(s, ALEX.playerId).cards;
    s = run(s, { type: 'move', cards: ids, to: hand(s, SAM.playerId).id }, ALEX.playerId).state;
    expect(hand(s, SAM.playerId).cards).toEqual(ids);
    const e = s.log.at(-1)!;
    expect(e.text).toBe('Alex passed 3 cards to Sam');
    expect(e.privateText?.[SAM.playerId]).toMatch(/^Alex passed you A of Spades/);
    expect(e.privateText?.[ALEX.playerId]).toMatch(/^You passed A of Spades/);
  });
  it('flips one card and a whole zone', () => {
    const { eng, deckZone } = setup();
    const [id] = top(eng.state, deckZone);
    let s = run(eng.state, { type: 'flip', cards: [id] }, ALEX.playerId).state;
    expect(s.cards[id].faceUp).toBe(true);
    s = run(s, { type: 'flipZone', zone: deckZone, face: 'up' }, ALEX.playerId).state;
    expect(s.zones[deckZone].cards.every((c) => s.cards[c].faceUp)).toBe(true);
  });
  it('gathers every zone into one face-down pile', () => {
    const { eng, deckZone } = setup();
    let s = run(eng.state, { type: 'deal', zone: deckZone, count: 5, seats: eng.state.seats.map((x) => x.id) }, ALEX.playerId).state;
    s = run(s, { type: 'move', cards: top(s, deckZone, 2), to: zoneByName(s, 'Table').id, face: 'up' }, ALEX.playerId).state;
    s = run(s, { type: 'gather', zones: 'all', to: deckZone }, ALEX.playerId).state;
    expect(s.zones[deckZone].cards).toHaveLength(52);
    expect(s.zones[deckZone].cards.every((c) => !s.cards[c].faceUp)).toBe(true);
  });
  it('manages counters and notes', () => {
    const { eng } = setup();
    let s = run(eng.state, { type: 'counterAdd', label: 'Alex score', value: 0 }, ALEX.playerId).state;
    const c = s.counters[0];
    s = run(s, { type: 'counterChange', counter: c.id, delta: 26 }, SAM.playerId).state;
    expect(s.counters[0].value).toBe(26);
    s = run(s, { type: 'setNotes', notes: 'Round 2' }, SAM.playerId).state;
    expect(s.notes).toBe('Round 2');
    s = run(s, { type: 'counterRemove', counter: c.id }, ALEX.playerId).state;
    expect(s.counters).toHaveLength(0);
  });
  it('adds, updates and removes zones (host only); non-empty removal needs a destination', () => {
    const { eng, deckZone } = setup();
    let s = run(eng.state, { type: 'zoneAdd', name: 'Discard 2', layout: 'pile' }, ALEX.playerId).state;
    const z = zoneByName(s, 'Discard 2');
    expect(() => run(s, { type: 'zoneAdd', name: 'X', layout: 'pile' }, SAM.playerId)).toThrow(/host/);
    s = run(s, { type: 'zoneUpdate', zone: z.id, name: 'Graveyard', color: '#123456' }, ALEX.playerId).state;
    expect(s.zones[z.id].name).toBe('Graveyard');
    s = run(s, { type: 'move', cards: top(s, deckZone), to: z.id }, ALEX.playerId).state;
    expect(() => run(s, { type: 'zoneRemove', zone: z.id }, ALEX.playerId)).toThrow(/choose where/);
    s = run(s, { type: 'zoneRemove', zone: z.id, moveTo: deckZone }, ALEX.playerId).state;
    expect(s.zones[z.id]).toBeUndefined();
    expect(s.zones[deckZone].cards).toHaveLength(52);
  });
});

describe('copy numbering (2.3)', () => {
  it('numbers each definition #1..#N in deck order', () => {
    const { eng } = setup([SAM], goblinDeck());
    const gob = Object.values(eng.state.cards).filter((c) => c.defId === 'gob');
    expect(gob.map((c) => [c.copyNo, c.copyOf])).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    const orc = Object.values(eng.state.cards).find((c) => c.defId === 'orc')!;
    expect([orc.copyNo, orc.copyOf]).toEqual([1, 1]);
  });
  it('keeps numbers through shuffle, move, gather and reset; renumbers on reload', () => {
    const { eng, deckZone } = setup([SAM], goblinDeck());
    const snap = () => Object.fromEntries(Object.values(eng.state.cards).map((c) => [c.id, c.copyNo]));
    const before = snap();
    eng.dispatch({ type: 'shuffle', zone: deckZone }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'move', cards: top(eng.state, deckZone, 2), to: zoneByName(eng.state, 'Table').id }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'gather', zones: 'all', to: deckZone }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'reset' }, ALEX.playerId, ctx());
    expect(snap()).toEqual(before);
    const d = goblinDeck();
    d.defs[0].count = 2;
    eng.dispatch({ type: 'reloadDeck', deckId: 'd1', deck: d }, null, ctx());
    const gob = Object.values(eng.state.cards).filter((c) => c.defId === 'gob');
    expect(gob.map((c) => `${c.copyNo}/${c.copyOf}`)).toEqual(['1/2', '2/2']);
  });
  it('numbers a second deck with same-named cards separately', () => {
    const { eng } = setup([SAM], goblinDeck('d1'));
    eng.dispatch({ type: 'loadDeck', deck: goblinDeck('d2') }, null, ctx());
    const d2 = Object.values(eng.state.cards).filter((c) => c.deckId === 'd2' && c.defId === 'gob');
    expect(d2.map((c) => c.copyNo)).toEqual([1, 2, 3]);
  });
  it('names copies in the log when the card is public', () => {
    const { eng, deckZone } = setup([SAM], goblinDeck());
    const id = eng.state.zones[deckZone].cards[1]; // Goblin #2
    const r = run(eng.state, { type: 'move', cards: [id], to: zoneByName(eng.state, 'Table').id, face: 'up' }, ALEX.playerId);
    expect(r.state.log.at(-1)!.text).toContain('Goblin #2');
  });
});

describe('shuffle, cut, draw (2.4)', () => {
  it('shuffle is uniform (chi-square over first position)', () => {
    const { eng, deckZone } = setup([SAM], {
      ...goblinDeck(),
      defs: [0, 1, 2, 3, 4].map((i) => ({ id: `c${i}`, name: `C${i}`, count: 1, metadata: {} })),
    });
    const counts: Record<string, number> = {};
    const N = 5000;
    const rng = { int: (m: number) => Math.floor(Math.random() * m) };
    for (let i = 0; i < N; i++) {
      const s = run(eng.state, { type: 'shuffle', zone: deckZone }, ALEX.playerId, { rng }).state;
      const first = s.zones[deckZone].cards[0];
      counts[first] = (counts[first] ?? 0) + 1;
    }
    const exp = N / 5;
    const chi = Object.values(counts).reduce((a, o) => a + (o - exp) ** 2 / exp, 0);
    expect(Object.keys(counts)).toHaveLength(5);
    expect(chi).toBeLessThan(18.47); // df=4, p=0.001
  });
  it('cut complete places top portion under the rest', () => {
    const { eng, deckZone } = setup();
    const before = [...eng.state.zones[deckZone].cards];
    const s = run(eng.state, { type: 'cut', zone: deckZone, depth: 20, mode: 'complete' }, ALEX.playerId).state;
    expect(s.zones[deckZone].cards).toEqual(before.slice(20).concat(before.slice(0, 20)));
  });
  it('cut split creates a new pile; random depth uses rng', () => {
    const { eng, deckZone } = setup();
    const s = run(eng.state, { type: 'cut', zone: deckZone, mode: 'split' }, ALEX.playerId, { rng: seqRng([9]) }).state;
    const cutPile = zoneByName(s, 'Standard (cut)');
    expect(cutPile.cards).toHaveLength(10);
    expect(s.zones[deckZone].cards).toHaveLength(42);
  });
  it('draws from top, bottom and random', () => {
    const { eng, deckZone } = setup();
    const cards = [...eng.state.zones[deckZone].cards];
    let s = run(eng.state, { type: 'draw', zone: deckZone, count: 1, from: 'bottom' }, ALEX.playerId).state;
    expect(hand(s, ALEX.playerId).cards).toEqual([cards[51]]);
    s = run(s, { type: 'draw', zone: deckZone, count: 1, from: 'top' }, ALEX.playerId).state;
    expect(hand(s, ALEX.playerId).cards).toContain(cards[0]);
    s = run(s, { type: 'draw', zone: deckZone, count: 2, from: 'random' }, ALEX.playerId, { rng: seqRng([5, 7]) }).state;
    expect(hand(s, ALEX.playerId).cards).toHaveLength(4);
    expect(s.log.at(-1)!.text).toBe('Alex drew 2 cards from random from Standard');
  });
  it('drawing more than available draws what is there and notifies', () => {
    const { eng, deckZone } = setup([SAM], goblinDeck());
    const r = run(eng.state, { type: 'draw', zone: deckZone, count: 5, from: 'top' }, ALEX.playerId);
    expect(hand(r.state, ALEX.playerId).cards).toHaveLength(4);
    expect(r.notice).toMatch(/empty: drew 4 of 5/);
    expect(() => run(r.state, { type: 'draw', zone: deckZone, count: 1, from: 'top' }, ALEX.playerId)).toThrow(/empty/);
  });
});

describe('deal (2.5)', () => {
  it('deals 13 to each of 4 seats round-robin and empties the pile', () => {
    const { eng, deckZone } = setup([SAM, KIM, LEE]);
    const order = [...eng.state.zones[deckZone].cards];
    const seats = eng.state.seats.map((x) => x.id);
    const s = run(eng.state, { type: 'deal', zone: deckZone, count: 13, seats }, ALEX.playerId).state;
    expect(s.zones[deckZone].cards).toHaveLength(0);
    seats.forEach((sid, i) => {
      const h = s.zones[handZoneId(sid)].cards;
      expect(h).toHaveLength(13);
      expect(h[0]).toBe(order[i]);
      expect(h[1]).toBe(order[i + 4]);
    });
  });
  it('starts at the chosen seat and can deal face up', () => {
    const { eng, deckZone } = setup([SAM, KIM]);
    const order = [...eng.state.zones[deckZone].cards];
    const seats = eng.state.seats.map((x) => x.id);
    const s = run(eng.state, { type: 'deal', zone: deckZone, count: 1, seats, startSeat: seats[1], face: 'up' }, ALEX.playerId).state;
    expect(s.zones[handZoneId(seats[1])].cards[0]).toBe(order[0]);
    expect(s.zones[handZoneId(seats[0])].cards[0]).toBe(order[2]);
    expect(s.cards[order[0]].faceUp).toBe(true);
  });
});

describe('show and peek (2.6)', () => {
  const withHand = () => {
    const { eng, deckZone } = setup([SAM, KIM]);
    const s = run(eng.state, { type: 'draw', zone: deckZone, count: 2, from: 'top' }, ALEX.playerId).state;
    return { s, deckZone, ids: hand(s, ALEX.playerId).cards };
  };
  it('shows a card to exactly one player', () => {
    const { s, ids } = withHand();
    const r = run(s, { type: 'show', cards: [ids[0]], to: [SAM.playerId] }, ALEX.playerId).state;
    expect(r.cards[ids[0]].shownTo).toEqual([SAM.playerId]);
    const e = r.log.at(-1)!;
    expect(e.text).toBe('Alex showed 1 card to Sam');
    expect(e.privateText?.[SAM.playerId]).toBe('Alex showed you A of Spades');
    expect(e.privateText?.[KIM.playerId]).toBeUndefined();
  });
  it('shows to everyone', () => {
    const { s, ids } = withHand();
    const r = run(s, { type: 'show', cards: ids, to: 'all' }, ALEX.playerId).state;
    expect(r.cards[ids[0]].shownTo).toEqual(['*']);
    expect(r.log.at(-1)!.text).toBe('Alex showed A of Spades, 2 of Spades to everyone');
  });
  it('a show ends when the card moves', () => {
    const { s, ids } = withHand();
    let r = run(s, { type: 'show', cards: [ids[0]], to: [SAM.playerId] }, ALEX.playerId).state;
    r = run(r, { type: 'move', cards: [ids[0]], to: zoneByName(r, 'Table').id, face: 'down' }, ALEX.playerId).state;
    expect(r.cards[ids[0]].shownTo).toEqual([]);
  });
  it('cannot show cards you cannot see', () => {
    const { s, deckZone } = withHand();
    expect(() => run(s, { type: 'show', cards: [s.zones[deckZone].cards[0]], to: 'all' }, ALEX.playerId)).toThrow(/can see/);
  });
  it('peeks at the top N without flipping; ends on move/gather', () => {
    const { s, deckZone } = withHand();
    const t2 = s.zones[deckZone].cards.slice(0, 2);
    let r = run(s, { type: 'peek', zone: deckZone, count: 2 }, SAM.playerId).state;
    expect(t2.every((c) => r.cards[c].peekedBy.includes(SAM.playerId) && !r.cards[c].faceUp)).toBe(true);
    expect(r.log.at(-1)!.text).toBe('Sam peeked at 2 cards in Standard');
    expect(r.log.at(-1)!.privateText?.[SAM.playerId]).toMatch(/^You peeked at 3 of Spades/);
    r = run(r, { type: 'gather', zones: 'all', to: deckZone }, ALEX.playerId).state;
    expect(t2.every((c) => r.cards[c].peekedBy.length === 0)).toBe(true);
  });
});

describe('authorize (2.7)', () => {
  it('spectators are read-only', () => {
    const { eng, deckZone } = setup();
    eng.dispatch({ type: 'spectate', player: KIM }, null, ctx());
    expect(() => run(eng.state, { type: 'shuffle', zone: deckZone }, KIM.playerId)).toThrow(/Spectators/);
  });
  it('taking from another hand creates a consent request; approval moves the card', () => {
    const { eng, deckZone } = setup();
    eng.dispatch({ type: 'draw', zone: deckZone, count: 2, from: 'top' }, SAM.playerId, ctx());
    const samCards = hand(eng.state, SAM.playerId).cards;
    const r = eng.dispatch({ type: 'move', cards: [samCards[0]], to: hand(eng.state, ALEX.playerId).id }, ALEX.playerId, ctx());
    expect(r.request).toBeDefined();
    expect(hand(eng.state, SAM.playerId).cards).toHaveLength(2);
    expect(() =>
      eng.dispatch({ type: 'respondTake', requestId: r.request!.id, approve: true }, ALEX.playerId, ctx()),
    ).toThrow(/hand owner/);
    eng.dispatch({ type: 'respondTake', requestId: r.request!.id, approve: true }, SAM.playerId, ctx());
    expect(hand(eng.state, ALEX.playerId).cards).toEqual([samCards[0]]);
    expect(eng.state.log.at(-1)!.text).toBe("Alex took 1 card from Sam's hand");
  });
  it('declined requests move nothing', () => {
    const { eng, deckZone } = setup();
    eng.dispatch({ type: 'draw', zone: deckZone, count: 1, from: 'top' }, SAM.playerId, ctx());
    const [c] = hand(eng.state, SAM.playerId).cards;
    const r = eng.dispatch({ type: 'move', cards: [c], to: hand(eng.state, ALEX.playerId).id }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'respondTake', requestId: r.request!.id, approve: false }, SAM.playerId, ctx());
    expect(hand(eng.state, SAM.playerId).cards).toEqual([c]);
  });
  it('open hands skips consent', () => {
    const { eng, deckZone } = setup();
    eng.dispatch({ type: 'settings', openHands: true }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'draw', zone: deckZone, count: 1, from: 'top' }, SAM.playerId, ctx());
    const [c] = hand(eng.state, SAM.playerId).cards;
    const r = eng.dispatch({ type: 'move', cards: [c], to: hand(eng.state, ALEX.playerId).id }, ALEX.playerId, ctx());
    expect(r.request).toBeUndefined();
    expect(hand(eng.state, ALEX.playerId).cards).toEqual([c]);
  });
  it('turn-based: out-of-turn shared actions are refused, own-hand reorder allowed', () => {
    const { eng, deckZone } = setup();
    eng.dispatch({ type: 'draw', zone: deckZone, count: 3, from: 'top' }, SAM.playerId, ctx());
    eng.dispatch({ type: 'setMode', mode: 'turn' }, ALEX.playerId, ctx());
    expect(() => run(eng.state, { type: 'draw', zone: deckZone, count: 1, from: 'top' }, SAM.playerId)).toThrow("It's Alex's turn");
    const h = hand(eng.state, SAM.playerId);
    const r = run(eng.state, { type: 'move', cards: [h.cards[0]], to: h.id, index: 2 }, SAM.playerId);
    expect(hand(r.state, SAM.playerId).cards[2]).toBe(h.cards[0]);
    // still allowed out of turn: counters, show, peek
    expect(() => run(eng.state, { type: 'counterAdd', label: 'x', value: 1 }, SAM.playerId)).not.toThrow();
    expect(() => run(eng.state, { type: 'show', cards: [h.cards[0]], to: 'all' }, SAM.playerId)).not.toThrow();
    // active player can act
    expect(() => run(eng.state, { type: 'draw', zone: deckZone, count: 1, from: 'top' }, ALEX.playerId)).not.toThrow();
  });
  it('only the host switches mode unless players are allowed to', () => {
    const { eng } = setup();
    expect(() => run(eng.state, { type: 'setMode', mode: 'turn' }, SAM.playerId)).toThrow(/host/);
    eng.dispatch({ type: 'settings', playersMaySwitchMode: true }, ALEX.playerId, ctx());
    expect(run(eng.state, { type: 'setMode', mode: 'turn' }, SAM.playerId).state.mode).toBe('turn');
  });
});

describe('turns (2.8)', () => {
  it('defaults to real-time; switching to turn-based picks host seat by default', () => {
    const { eng } = setup([SAM, KIM, LEE]);
    expect(eng.state.mode).toBe('realtime');
    eng.dispatch({ type: 'setMode', mode: 'turn' }, ALEX.playerId, ctx());
    expect(eng.state.turn.active).toBe(eng.state.seats[0].id);
    expect(eng.state.log.at(-1)!.text).toBe("Alex switched to turn-based play: Alex's turn");
  });
  it('end turn passes clockwise; reverse, skip and setActive work; skips disconnected and empty seats', () => {
    const { eng } = setup([SAM, KIM, LEE], undefined, 6);
    const seats = eng.state.seats; // 6 seats: Alex, Sam, Kim, Lee, empty, empty
    eng.dispatch({ type: 'setMode', mode: 'turn', active: seats[1].id }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'endTurn' }, SAM.playerId, ctx());
    expect(eng.state.turn.active).toBe(seats[2].id);
    // Lee disconnected: Kim ending passes to Alex (skipping Lee and empty seats)
    eng.dispatch({ type: 'endTurn' }, KIM.playerId, ctx({ connected: new Set([ALEX.playerId, SAM.playerId, KIM.playerId]) }));
    expect(eng.state.turn.active).toBe(seats[0].id);
    eng.dispatch({ type: 'reverse' }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'endTurn' }, ALEX.playerId, ctx());
    expect(eng.state.turn.active).toBe(seats[3].id);
    eng.dispatch({ type: 'skip' }, ALEX.playerId, ctx());
    expect(eng.state.turn.active).toBe(seats[1].id);
    eng.dispatch({ type: 'setActive', seat: seats[2].id }, ALEX.playerId, ctx());
    expect(eng.state.turn.active).toBe(seats[2].id);
    expect(() => eng.dispatch({ type: 'endTurn' }, SAM.playerId, ctx())).toThrow("It's Kim's turn");
  });
  it('switching back to real-time lets everyone act', () => {
    const { eng, deckZone } = setup();
    eng.dispatch({ type: 'setMode', mode: 'turn' }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'setMode', mode: 'realtime' }, ALEX.playerId, ctx());
    expect(() => run(eng.state, { type: 'draw', zone: deckZone, count: 1, from: 'top' }, SAM.playerId)).not.toThrow();
  });
});

describe('log privacy and undo (2.9)', () => {
  it('never names hidden cards in public log text', () => {
    const { eng, deckZone } = setup([SAM, KIM]);
    const seats = eng.state.seats.map((x) => x.id);
    eng.dispatch({ type: 'deal', zone: deckZone, count: 5, seats }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'draw', zone: deckZone, count: 2, from: 'top' }, SAM.playerId, ctx());
    const h = hand(eng.state, SAM.playerId).cards;
    eng.dispatch({ type: 'move', cards: h.slice(0, 2), to: hand(eng.state, KIM.playerId).id }, SAM.playerId, ctx());
    eng.dispatch({ type: 'show', cards: [h[2]], to: [KIM.playerId] }, SAM.playerId, ctx());
    eng.dispatch({ type: 'peek', zone: deckZone, count: 3 }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'move', cards: [h[3]], to: zoneByName(eng.state, 'Table').id, face: 'down' }, SAM.playerId, ctx());
    const names = Object.values(eng.state.decks)[0].defs.map((d) => d.name);
    for (const e of eng.state.log) for (const n of names) expect(e.text, e.text).not.toContain(n);
  });
  it('undoes the last action within 10 seconds', () => {
    const { eng, deckZone } = setup();
    const table = zoneByName(eng.state, 'Table');
    const [c] = eng.state.zones[deckZone].cards;
    eng.dispatch({ type: 'move', cards: [c], to: table.id, face: 'up' }, ALEX.playerId, ctx({ now: 1000 }));
    eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx({ now: 9000 }));
    expect(eng.state.zones[deckZone].cards[0]).toBe(c);
    expect(eng.state.cards[c].faceUp).toBe(false);
    expect(eng.state.log.at(-1)!.text).toBe('Alex undid their last action');
    expect(() => eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx({ now: 9500 }))).toThrow(ActionError);
  });
  it('a group move is undone as one action', () => {
    const { eng, deckZone } = setup();
    eng.dispatch({ type: 'draw', zone: deckZone, count: 5, from: 'top' }, ALEX.playerId, ctx());
    const five = [...hand(eng.state, ALEX.playerId).cards];
    eng.dispatch({ type: 'move', cards: five, to: hand(eng.state, SAM.playerId).id }, ALEX.playerId, ctx());
    eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx());
    expect(hand(eng.state, ALEX.playerId).cards).toEqual(five);
    expect(hand(eng.state, SAM.playerId).cards).toEqual([]);
  });
  it('refuses undo after 10 seconds, by another player, or after an intervening action', () => {
    const { eng, deckZone } = setup();
    const table = zoneByName(eng.state, 'Table').id;
    eng.dispatch({ type: 'move', cards: eng.state.zones[deckZone].cards.slice(0, 1), to: table }, ALEX.playerId, ctx({ now: 0 }));
    expect(() => eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx({ now: 10_001 }))).toThrow(/Too late/);
    expect(() => eng.dispatch({ type: 'undo' }, SAM.playerId, ctx({ now: 100 }))).toThrow(/Nothing/);
    eng.dispatch({ type: 'flip', cards: eng.state.zones[deckZone].cards.slice(0, 1) }, SAM.playerId, ctx({ now: 200 }));
    expect(() => eng.dispatch({ type: 'undo' }, ALEX.playerId, ctx({ now: 300 }))).toThrow(/Nothing/);
    expect(locate(eng.state).size).toBe(52);
  });
});
