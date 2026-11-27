import { afterEach, describe, expect, it, vi } from 'vitest';
import { startServer, Client, until, type TestServer } from './harness.js';
import { tableWith } from './fixtures.js';

let srv: TestServer;
afterEach(async () => {
  vi.useRealTimers();
  await srv?.stop();
});

async function fakeSetup() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'], shouldAdvanceTime: true });
  srv = await startServer();
  const a = await Client.connect(srv, 'Alex');
  const b = await Client.connect(srv, 'Sam');
  const c = await Client.connect(srv, 'Kim');
  const tid = await tableWith(srv, a, [b, c]);
  return { a, b, c, tid };
}

describe('presence, grace period and auto-transfer (3.6)', () => {
  it('marks a seat disconnected after 5 s and restores it on reconnect within the grace period', async () => {
    const { a, b, tid } = await fakeSetup();
    await b.act({ type: 'draw', zone: b.zone('Standard').id, count: 3, from: 'top' });
    const seatB = b.table!.me.seatId;
    b.close();
    await until(() => a.table!.seats.find((s) => s.id === seatB)!.connected === false);
    expect(a.table!.seats.find((s) => s.id === seatB)!.disconnected).toBe(false);
    await vi.advanceTimersByTimeAsync(5_100);
    await until(() => a.table!.seats.find((s) => s.id === seatB)!.disconnected === true);
    await vi.advanceTimersByTimeAsync(55_000); // 60 s offline total
    const b2 = new Client(srv, b.token, b.id, 'Sam');
    await b2.open();
    await b2.req({ t: 'table.join', tableId: tid });
    await until(() => !!b2.table);
    expect(b2.table!.me.seatId).toBe(seatB);
    expect(b2.myHand().cards).toHaveLength(3);
    await until(() => a.table!.seats.find((s) => s.id === seatB)!.connected === true);
    expect(a.table!.seats.find((s) => s.id === seatB)!.disconnected).toBe(false);
    // timers were cleared: passing the original expiry does not remove Sam
    await vi.advanceTimersByTimeAsync(120_000);
    expect(srv.app.tables.get(tid)!.isSeated(b.id)).toBe(true);
    b2.close();
  });

  it('after the grace period in a real-time table the seat is released and the host role transfers', async () => {
    const { a, b, c, tid } = await fakeSetup();
    await a.act({ type: 'draw', zone: a.zone('Standard').id, count: 2, from: 'top' });
    a.close();
    await vi.advanceTimersByTimeAsync(121_000);
    const s = srv.app.tables.get(tid)!;
    await until(() => s.state.hostId === b.id);
    // Sam sat before Kim → Sam becomes host
    expect(s.state.hostId).toBe(b.id);
    // Alex's hand stays at the vacated seat for the host to resolve
    await until(() => b.table!.vacated.length === 1);
    expect(b.table!.vacated[0]).toMatchObject({ playerName: 'Alex' });
    expect(c.table!.vacated).toEqual([]); // only the host sees it
    // Alex comes back: rejoins his old seat with his hand
    const a2 = new Client(srv, a.token, a.id, 'Alex');
    await a2.open();
    await a2.req({ t: 'table.join', tableId: tid });
    await until(() => !!a2.table);
    expect(a2.myHand().cards).toHaveLength(2);
    a2.close();
  });

  it('lobby presence shows players at tables and updates when they join', async () => {
    const { a, b, tid } = await fakeSetup();
    const lobby = (await a.wait(
      (m) => m.t === 'lobby' && m.players.find((p) => p.id === b.id)?.status === 'table',
    )) as any;
    expect(lobby.players.find((p: any) => p.id === b.id)).toMatchObject({ tableId: tid, tableName: 'Test table' });
  });

  it('an empty table is closed after 30 minutes', async () => {
    const { a, b, c, tid } = await fakeSetup();
    a.close();
    b.close();
    c.close();
    await vi.advanceTimersByTimeAsync(29 * 60_000);
    expect(srv.app.tables.get(tid)).toBeDefined();
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(srv.app.tables.get(tid)).toBeUndefined();
  });
});
