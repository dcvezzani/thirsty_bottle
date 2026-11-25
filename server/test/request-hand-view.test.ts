import { describe, expect, it } from 'vitest';
import { startServer, Client, until } from './harness.js';
import { tableWith } from './fixtures.js';

describe('request-hand-view over the wire (2.1)', () => {
  it('ask -> prompt for the owner, waiting for the asker -> allow makes the hand known to the asker only; viewing elsewhere drops a pending ask', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const k = await Client.connect(srv, 'Kim');
    const tid = await tableWith(srv, a, [b, k]);
    const seatOf = (c: Client, of: Client) => c.table!.seats.find((s: any) => s.playerId === of.id)!.id;
    const handOf = (viewer: Client, of: Client) => viewer.table!.zones.find((z: any) => z.kind === 'hand' && z.seatId === seatOf(viewer, of))!;

    await a.act({ type: 'draw', zone: a.zone('Standard').id, count: 4, from: 'top' });
    await until(() => handOf(b, a).cards.length === 4);
    expect(handOf(b, a).cards.every((c: any) => !c.known)).toBe(true);

    // Sam asks: Alex gets an incoming see-request, Sam an outgoing one, Kim neither
    await b.act({ type: 'seeAsk', seat: seatOf(b, a) });
    await until(() => a.table!.requests.some((r: any) => r.kind === 'see' && r.dir === 'incoming') && b.table!.requests.some((r: any) => r.kind === 'see' && r.dir === 'outgoing'));
    expect(k.table!.requests.filter((r: any) => r.kind === 'see')).toEqual([]);
    const req = a.table!.requests.find((r: any) => r.kind === 'see')!;
    expect(req).toMatchObject({ fromName: 'Sam', dir: 'incoming' });

    // Alex allows: all four become known to Sam, still hidden from Kim
    await a.act({ type: 'seeRespond', requestId: req.id, approve: true });
    await until(() => handOf(b, a).cards.every((c: any) => c.known));
    expect(handOf(k, a).cards.every((c: any) => !c.known)).toBe(true);
    expect(a.table!.requests.filter((r: any) => r.kind === 'see')).toEqual([]);

    // a pending ask ends when the asker views a different table (here: Kim's), and survives viewing the asked seat
    await k.act({ type: 'seeAsk', seat: seatOf(k, b) }); // Kim asks Sam
    await until(() => b.table!.requests.some((r: any) => r.kind === 'see' && r.dir === 'incoming'));
    k.send({ t: 'table.view', tableId: tid, seat: seatOf(k, b) }); // Kim views Sam's table: the ask stays
    await new Promise((r) => setTimeout(r, 150));
    expect(b.table!.requests.some((r: any) => r.kind === 'see')).toBe(true);
    k.send({ t: 'table.view', tableId: tid, seat: seatOf(k, a) }); // Kim moves on to Alex's table: it ends
    await until(() => !b.table!.requests.some((r: any) => r.kind === 'see'));
    expect(srv.app.db.prepare('SELECT state FROM game_tables WHERE id = ?').get(tid)).toBeTruthy();
    a.close();
    b.close();
    k.close();
    await srv.stop();
  });
});
