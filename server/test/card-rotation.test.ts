import { describe, expect, it } from 'vitest';
import { startServer, Client, until } from './harness.js';
import { tableWith } from './fixtures.js';

describe('card rotation over the wire (2.1)', () => {
  it('a rotation is public (hidden cards too), survives a move, and a gather clears it', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    await tableWith(srv, a, [b]);
    const seatA = b.table!.seats.find((s: any) => s.playerId === a.id)!.id;
    const handOf = (c: Client) => c.table!.zones.find((z: any) => z.kind === 'hand' && z.seatId === seatA)!;

    await a.act({ type: 'draw', zone: a.zone('Standard').id, count: 3, from: 'top' });
    await until(() => handOf(b).cards.length === 3 && handOf(a).cards.length === 3);
    expect(handOf(b).cards.every((c: any) => c.rot === undefined)).toBe(true); // upright: omitted

    // Alex rotates his first card; Sam sees it rotated though its face is hidden from him
    const first = handOf(a).cards[0];
    await a.act({ type: 'rotate', cards: [first.h], by: 3 });
    await until(() => handOf(b).cards.some((c: any) => c.rot === 3));
    const seen = handOf(b).cards.find((c: any) => c.rot === 3)!;
    expect(seen.known).toBe(false);
    expect(handOf(b).cards.filter((c: any) => c.rot !== undefined)).toHaveLength(1);
    expect(handOf(a).cards.find((c: any) => c.h === first.h)!.rot).toBe(3);

    // a move keeps it
    const table = a.zone('Table');
    await a.act({ type: 'move', cards: [first.h], to: table.id });
    await until(() => b.zone('Table').cards.length === 1);
    expect(b.zone('Table').cards[0].rot).toBe(3);
    expect(a.zone('Table').cards[0].rot).toBe(3);

    // Sam may not rotate Alex's hand cards
    const ack = await b.act({ type: 'rotate', cards: [handOf(b).cards[0].h], by: 1 });
    expect(ack).toMatchObject({ ok: false });

    // rotating a whole zone, then upright
    await a.act({ type: 'rotateZone', zone: table.id, by: 1 });
    await until(() => b.zone('Table').cards[0].rot === 4);
    await a.act({ type: 'rotateZone', zone: table.id, to: 0 });
    await until(() => b.zone('Table').cards[0].rot === undefined);

    // a gather returns gathered cards upright
    await a.act({ type: 'rotate', cards: [a.zone('Table').cards[0].h], to: 5 });
    await until(() => b.zone('Table').cards[0].rot === 5);
    await a.act({ type: 'gather', zones: 'all', to: a.zone('Standard').id });
    await until(() => b.zone('Table').cards.length === 0);
    expect(b.zone('Standard').cards.every((c: any) => c.rot === undefined)).toBe(true);

    a.close();
    b.close();
    await srv.stop();
  });
});
