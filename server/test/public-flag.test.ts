import { afterEach, describe, expect, it } from 'vitest';
import { startServer, Client, until, type TestServer } from './harness.js';
import { tableWith } from './fixtures.js';

let srv: TestServer;
afterEach(async () => {
  await srv?.stop();
});

/** The cards of a zone as one client sees them. */
const cardsOf = (c: Client, zoneId: string) => c.table!.zones.find((z) => z.id === zoneId)!.cards;
const handOf = (c: Client, seatId: string) => cardsOf(c, `hand:${seatId}`);

async function setup() {
  srv = await startServer();
  const a = await Client.connect(srv, 'Alex');
  const b = await Client.connect(srv, 'Remy');
  const k = await Client.connect(srv, 'Kim');
  const tid = await tableWith(srv, a, [b, k]);
  await a.act({ type: 'draw', zone: a.zone('Standard').id, count: 4, from: 'top' });
  await until(() => handOf(b, a.table!.me.seatId!).length === 4);
  return { a, b, k, tid, aSeat: a.table!.me.seatId! };
}

describe('table-overview: the public flag on card views', () => {
  it('is never set on hand cards, for the owner or anyone else', async () => {
    const { a, b, aSeat } = await setup();
    expect(handOf(a, aSeat).some((c) => c.public)).toBe(false);
    expect(handOf(b, aSeat).some((c) => c.public)).toBe(false);
  });

  it('is set for every participant on a face-up card outside a hand, and not on a face-down one', async () => {
    const { a, b, k, aSeat } = await setup();
    const table = a.zone('Table').id;
    const [first, second] = handOf(a, aSeat);
    await a.act({ type: 'move', cards: [first.h], to: table, face: 'up' });
    await a.act({ type: 'move', cards: [second.h], to: table, face: 'down' });
    await until(() => cardsOf(b, table).length === 2 && cardsOf(k, table).length === 2);
    for (const c of [a, b, k]) {
      const cs = cardsOf(c, table);
      expect(cs.filter((x) => x.public)).toHaveLength(1);
      expect(cs.find((x) => x.public)!.faceUp).toBe(true);
      expect(cs.find((x) => !x.faceUp)!.public).toBeUndefined();
    }
  });

  it('is set on a hand card shown to everyone, and not on one shown only to a single player', async () => {
    const { a, b, k, aSeat } = await setup();
    const [first, second] = handOf(a, aSeat);
    await a.act({ type: 'show', cards: [first.h], to: 'all' });
    await a.act({ type: 'show', cards: [second.h], to: [b.id] });
    await until(() => handOf(b, aSeat).filter((c) => c.known).length === 2);
    // Remy sees both faces, but only the one shown to everyone is public
    expect(handOf(b, aSeat).filter((c) => c.known)).toHaveLength(2);
    expect(handOf(b, aSeat).filter((c) => c.public)).toHaveLength(1);
    // Kim sees only the public one, and it is flagged
    await until(() => handOf(k, aSeat).some((c) => c.known));
    expect(handOf(k, aSeat).filter((c) => c.known)).toHaveLength(1);
    expect(handOf(k, aSeat).filter((c) => c.public)).toHaveLength(1);
    // the owner sees both as theirs: only the shown-to-all one is public
    expect(handOf(a, aSeat).filter((c) => c.public)).toHaveLength(1);
  });

  it('is not set on a card the viewer privately peeked at, and nobody else sees a flag on it', async () => {
    const { a, b } = await setup();
    const pile = a.zone('Standard').id;
    await a.act({ type: 'peek', zone: pile, count: 1 });
    await until(() => cardsOf(a, pile).some((c) => c.peeked));
    expect(cardsOf(a, pile).find((c) => c.peeked)!.known).toBe(true);
    expect(cardsOf(a, pile).some((c) => c.public)).toBe(false);
    expect(cardsOf(b, pile).some((c) => c.public)).toBe(false);
  });

  it('follows a card when it is flipped: the flag is added and removed in a patch', async () => {
    const { a, b, aSeat } = await setup();
    const table = a.zone('Table').id;
    const [first] = handOf(a, aSeat);
    await a.act({ type: 'move', cards: [first.h], to: table, face: 'down' });
    await until(() => cardsOf(b, table).length === 1);
    expect(cardsOf(b, table)[0].public).toBeUndefined();
    await a.act({ type: 'flip', cards: [cardsOf(a, table)[0].h] });
    await until(() => cardsOf(b, table)[0].public === true);
    await a.act({ type: 'flip', cards: [cardsOf(a, table)[0].h] });
    await until(() => cardsOf(b, table)[0].public === undefined);
  });
});
