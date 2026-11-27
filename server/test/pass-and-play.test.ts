import { afterEach, describe, expect, it, vi } from 'vitest';
import { startServer, Client, until, type TestServer } from './harness.js';
import { tableWith } from './fixtures.js';

let srv: TestServer;
afterEach(async () => {
  vi.useRealTimers();
  await srv?.stop();
});

async function addGuest(tid: string, host: Client, name: string, color = '#aa3355') {
  const r = await fetch(`${srv.url}/api/tables/${tid}/guests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${host.token}` },
    body: JSON.stringify({ name, color }),
  });
  return { status: r.status, body: (await r.json()) as any };
}

async function setup() {
  srv = await startServer();
  const a = await Client.connect(srv, 'Alex');
  const b = await Client.connect(srv, 'Remy');
  const tid = await tableWith(srv, a, [b]);
  return { a, b, tid, table: () => srv.app.tables.get(tid)! };
}

describe('pass-and-play: guest players', () => {
  it('the host adds a guest who takes a normal seat that everyone sees, marked as a guest', async () => {
    const { a, b, tid, table } = await setup();
    const g = await addGuest(tid, a, 'Sam');
    expect(g.status).toBe(200);
    expect(g.body.token).toBeTruthy();
    await until(() => !!b.table!.seats.find((s) => s.name === 'Sam'));
    const seat = b.table!.seats.find((s) => s.name === 'Sam')!;
    expect(seat).toMatchObject({ playerId: g.body.player.id, guest: true });
    expect(b.table!.seats.find((s) => s.name === 'Remy')!.guest).toBe(false);
    expect(table().state.guests).toEqual([g.body.player.id]);
  });

  it('only the host may add or remove guests, and a full table refuses', async () => {
    const { a, b, tid } = await setup();
    expect((await addGuest(tid, b, 'Sam')).status).toBe(403);
    const full = await Client.connect(srv, 'Fran');
    const tid2 = (await full.req({ t: 'table.create', name: 'Tiny', seatLimit: 2 })).tableId as string;
    await full.req({ t: 'table.join', tableId: tid2 });
    const other = await Client.connect(srv, 'Olly');
    await other.req({ t: 'table.join', tableId: tid2 });
    const r = await addGuest(tid2, full, 'Sam');
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('TABLE_FULL');
    const g = await addGuest(tid, a, 'Kim');
    const del = await fetch(`${srv.url}/api/tables/${tid}/guests/${g.body.player.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${b.token}` } });
    expect(del.status).toBe(403);
  });

  it('a guest connects with its token, sees only its own hand, and is not in the lobby', async () => {
    const { a, tid, table } = await setup();
    await a.act({ type: 'draw', zone: a.zone('Standard').id, count: 3, from: 'top' });
    const g = await addGuest(tid, a, 'Sam');
    const gc = new Client(srv, g.body.token, g.body.player.id, 'Sam');
    await gc.open();
    await gc.req({ t: 'table.join', tableId: tid });
    await until(() => !!gc.table);
    expect(gc.table!.me.seatId).toBe(g.body.seatId);
    expect(gc.myHand().cards).toHaveLength(0);
    expect(gc.table!.zones.find((z) => z.id === `hand:${table().state.seats[0].id}`)?.cards.every((c) => !c.known)).toBe(true);
    expect(srv.app.hub.presence().some((p) => p.id === g.body.player.id)).toBe(false);
    gc.close();
  });

  it('a guest cannot create a table or join another one', async () => {
    const { a, tid } = await setup();
    const g = await addGuest(tid, a, 'Sam');
    const gc = new Client(srv, g.body.token, g.body.player.id, 'Sam');
    await gc.open();
    await expect(gc.req({ t: 'table.create', name: 'Mine' })).rejects.toThrow(/guest/i);
    const other = await Client.connect(srv, 'Zed');
    const t2 = (await other.req({ t: 'table.create', name: 'Else' })).tableId as string;
    await expect(gc.req({ t: 'table.join', tableId: t2 })).rejects.toThrow(/own table/i);
    gc.close();
  });

  it('a guest never becomes the host when the host leaves', async () => {
    const { a, b, tid, table } = await setup();
    const g = await addGuest(tid, a, 'Sam');
    await a.req({ t: 'table.leave', tableId: tid });
    expect(table().state.hostId).toBe(b.id);
    expect(table().state.guests).toEqual([]); // the host's guests went with the host
    expect(srv.app.players.get(g.body.player.id)).toBeNull();
  });

  it('removing a guest frees its seat, deletes the guest and ends its token', async () => {
    const { a, tid, table } = await setup();
    const g = await addGuest(tid, a, 'Sam');
    const del = await fetch(`${srv.url}/api/tables/${tid}/guests/${g.body.player.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${a.token}` } });
    expect(del.status).toBe(200);
    expect(table().isSeated(g.body.player.id)).toBe(false);
    expect(table().state.guests).toEqual([]);
    const me = await fetch(`${srv.url}/api/me`, { headers: { authorization: `Bearer ${g.body.token}` } });
    expect(me.status).toBe(401);
  });

  it('closing the table deletes its guests', async () => {
    const { a, tid } = await setup();
    const g = await addGuest(tid, a, 'Sam');
    srv.app.tables.close(tid, 'closed');
    expect(srv.app.players.get(g.body.player.id)).toBeNull();
  });

  it('after a restart, guests of closed tables are purged and guests of open tables stay', async () => {
    const { a, tid } = await setup();
    const keep = await addGuest(tid, a, 'Sam');
    const h2 = await Client.connect(srv, 'Hana');
    const t2 = (await h2.req({ t: 'table.create', name: 'Other' })).tableId as string;
    await h2.req({ t: 'table.join', tableId: t2 });
    const drop = await addGuest(t2, h2, 'Kim');
    // simulate a crash after the table was marked closed but before its guests were deleted
    srv.app.db.prepare('UPDATE game_tables SET closed_at = ? WHERE id = ?').run(Date.now(), t2);
    a.close();
    const dir = srv.dataDir;
    await srv.stop(true);
    srv = await startServer({}, dir);
    expect(srv.app.players.get(drop.body.player.id)).toBeNull();
    expect(srv.app.players.get(keep.body.player.id)).toBeTruthy();
    expect(srv.app.tables.get(tid)!.state.guests).toEqual([keep.body.player.id]);
  });

  it('a guest keeps its seat past the real-time grace period', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'], shouldAdvanceTime: true });
    const { a, tid, table } = await setup();
    const g = await addGuest(tid, a, 'Sam');
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(table().isSeated(g.body.player.id)).toBe(true);
    await until(() => a.table!.seats.find((s) => s.name === 'Sam')?.disconnected === true);
    expect(a.table!.seats.find((s) => s.name === 'Sam')!.guest).toBe(true);
  });
});
