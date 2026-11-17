import { createTableState, reduce, TableEngine, type Ctx, type Rng, type TableDeck, type TableState, type AnyAction, handZoneId } from '@vct/shared';

export const seqRng = (values: number[] = []): Rng => {
  let i = 0;
  return { int: (max) => (values.length ? values[i++ % values.length] % max : Math.floor(Math.random() * max)) };
};

export const ALEX = { playerId: 'p-alex', name: 'Alex', color: '#ff0000' };
export const SAM = { playerId: 'p-sam', name: 'Sam', color: '#00ff00' };
export const KIM = { playerId: 'p-kim', name: 'Kim', color: '#0000ff' };
export const LEE = { playerId: 'p-lee', name: 'Lee', color: '#ffff00' };

export function ctx(over: Partial<Ctx> = {}): Ctx {
  return {
    now: 1000,
    rng: seqRng(),
    connected: new Set([ALEX.playerId, SAM.playerId, KIM.playerId, LEE.playerId]),
    ...over,
  };
}

export function standardDeck(id = 'd1'): TableDeck {
  const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return {
    id,
    sourceDeckId: 'src',
    versionId: 'v1',
    name: 'Standard',
    homeZoneId: '',
    defs: suits.flatMap((s) =>
      ranks.map((r, i) => ({ id: `${r}${s[0]}`, name: `${r} of ${s}`, count: 1, metadata: { suit: s, rank: i + 1 } })),
    ),
  };
}

export function goblinDeck(id = 'd1'): TableDeck {
  return {
    id,
    sourceDeckId: 'src',
    versionId: 'v1',
    name: 'Monsters',
    homeZoneId: '',
    defs: [
      { id: 'gob', name: 'Goblin', count: 3, metadata: {} },
      { id: 'orc', name: 'Orc', count: 1, metadata: {} },
    ],
  };
}

/** A table with Alex (host) and the given players seated, and a deck loaded. */
export function setup(players = [SAM], deck: TableDeck = standardDeck(), seatLimit: number | null = null) {
  let s: TableState = createTableState({
    id: 't1',
    name: 'Test',
    host: ALEX,
    seatLimit,
    visibility: 'public',
    spectatorsAllowed: true,
    hasPassword: false,
    now: 0,
  });
  const eng = new TableEngine(s);
  for (const p of players) eng.dispatch({ type: 'seatJoin', player: p }, null, ctx());
  eng.dispatch({ type: 'loadDeck', deck }, null, ctx());
  s = eng.state;
  const deckZone = s.decks[deck.id].homeZoneId;
  eng.undo = null;
  return { eng, deckZone };
}

export const run = (s: TableState, a: AnyAction, actor: string | null, c: Partial<Ctx> = {}) => reduce(s, a, actor, ctx(c));
export const hand = (s: TableState, playerId: string) => {
  const seat = s.seats.find((x) => x.playerId === playerId)!;
  return s.zones[handZoneId(seat.id)];
};
export const zoneByName = (s: TableState, name: string) => Object.values(s.zones).find((z) => z.name === name)!;
