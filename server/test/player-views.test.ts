import { describe, expect, it } from 'vitest';
import { startServer, Client, until } from './harness.js';
import { tableWith } from './fixtures.js';

describe('viewing presence (player-views 1.1)', () => {
  it('relays who views whom, includes it in snapshots, clears on return and disconnect, never saves it', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const k = await Client.connect(srv, 'Kim');
    const tid = await tableWith(srv, a, [b, k]);
    const samSeat = a.table!.seats.find((s: any) => s.playerId === b.id)!.id;

    const toSam = b.next((m: any) => m.t === 'table.viewers' && m.viewers.length === 1);
    const toKim = k.next((m: any) => m.t === 'table.viewers' && m.viewers.length === 1);
    a.send({ t: 'table.view', tableId: tid, seat: samSeat });
    expect(((await toSam) as any).viewers).toEqual([{ playerId: a.id, seat: samSeat }]);
    await toKim;

    // a fresh snapshot carries it; the saved state does not
    await b.req({ t: 'table.snapshot', tableId: tid });
    await until(() => (b.table as any)?.viewers?.length === 1);
    const row = srv.app.db.prepare('SELECT state FROM game_tables WHERE id = ?').get(tid) as { state: string };
    expect(row.state).not.toContain('looking');
    expect(row.state).not.toContain('"viewers"');

    // an unknown seat changes nothing; viewing my own seat means "mine"
    a.send({ t: 'table.view', tableId: tid, seat: 'nope' });
    const cleared = b.next((m: any) => m.t === 'table.viewers' && m.viewers.length === 0);
    const mine = a.table!.seats.find((s: any) => s.playerId === a.id)!.id;
    a.send({ t: 'table.view', tableId: tid, seat: mine });
    await cleared;

    // disconnecting clears
    a.send({ t: 'table.view', tableId: tid, seat: samSeat });
    await b.next((m: any) => m.t === 'table.viewers' && m.viewers.length === 1);
    const gone = b.next((m: any) => m.t === 'table.viewers' && m.viewers.length === 0);
    a.close();
    await gone;
    b.close();
    k.close();
    await srv.stop();
  });
});
