import { afterEach, describe, expect, it, vi } from 'vitest';
import { startServer, Client, until, type TestServer } from './harness.js';
import { tableWith } from './fixtures.js';
import { MAX_TIMER_MS } from '../src/tables.js';

let srv: TestServer;
afterEach(async () => {
  vi.useRealTimers();
  await srv?.stop();
});

const DAY = 86_400_000;

async function setup() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'], shouldAdvanceTime: true });
  srv = await startServer();
  const a = await Client.connect(srv, 'Alex');
  const b = await Client.connect(srv, 'Sam');
  const tid = await tableWith(srv, a, [b]);
  return { a, b, tid, table: () => srv.app.tables.get(tid) };
}

describe('async-turns: seats and passing', () => {
  it('End turn passes to a disconnected player, who keeps their seat and hand past the real-time grace period', async () => {
    const { a, b, tid, table } = await setup();
    await b.act({ type: 'draw', zone: b.zone('Standard').id, count: 2, from: 'top' });
    await a.act({ type: 'setMode', mode: 'turn' });
    const seatB = b.table!.me.seatId;
    b.close();
    await until(() => a.table!.seats.find((s) => s.id === seatB)!.connected === false);
    await a.act({ type: 'endTurn' });
    expect(table()!.state.turn.active).toBe(seatB);
    await vi.advanceTimersByTimeAsync(10 * 60_000); // far beyond the 2 minute grace
    expect(table()!.isSeated(b.id)).toBe(true);
    expect(table()!.state.hostId).toBe(a.id);
    const b2 = new Client(srv, b.token, b.id, 'Sam');
    await b2.open();
    await b2.req({ t: 'table.join', tableId: tid });
    await until(() => !!b2.table);
    expect(b2.table!.me.seatId).toBe(seatB);
    expect(b2.myHand().cards).toHaveLength(2);
    b2.close();
  });

  it('switching to real-time starts the grace period for players who are away', async () => {
    const { a, b, table } = await setup();
    await a.act({ type: 'setMode', mode: 'turn' });
    b.close();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(table()!.isSeated(b.id)).toBe(true);
    await a.act({ type: 'setMode', mode: 'realtime' });
    await vi.advanceTimersByTimeAsync(121_000);
    await until(() => !table()!.isSeated(b.id));
  });
});

describe('async-turns: idle lifetime', () => {
  it('a turn-based table with nobody connected stays open past 30 minutes and closes after its lifetime without action', async () => {
    const { a, b, tid, table } = await setup();
    await a.act({ type: 'setMode', mode: 'turn' });
    a.close();
    b.close();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(table()).toBeTruthy();
    await vi.advanceTimersByTimeAsync(DAY - 60 * 60_000 + 60_000);
    await until(() => !srv.app.tables.get(tid));
  });

  it('an action restarts the lifetime, and the host can change it', async () => {
    const { a, tid, table } = await setup();
    await a.act({ type: 'setMode', mode: 'turn' });
    await vi.advanceTimersByTimeAsync(DAY - 60_000);
    await a.act({ type: 'draw', zone: a.zone('Standard').id, count: 1, from: 'top' });
    await vi.advanceTimersByTimeAsync(DAY - 60_000); // 2 days since start, but under 1 day since the draw
    expect(table()).toBeTruthy();
    await a.act({ type: 'settings', idleDays: 7 });
    await vi.advanceTimersByTimeAsync(3 * DAY);
    expect(table()).toBeTruthy();
    await vi.advanceTimersByTimeAsync(5 * DAY);
    await until(() => !srv.app.tables.get(tid));
  });

  it('a 30 day lifetime waits in chunks and does not fire early', async () => {
    const { a, tid, table } = await setup();
    await a.act({ type: 'setMode', mode: 'turn' });
    await a.act({ type: 'settings', idleDays: 30 });
    expect(30 * DAY).toBeGreaterThan(2 ** 31 - 1);
    expect(MAX_TIMER_MS).toBeLessThan(2 ** 31 - 1);
    await vi.advanceTimersByTimeAsync(29 * DAY);
    expect(table()).toBeTruthy();
    await vi.advanceTimersByTimeAsync(DAY + 60_000);
    await until(() => !srv.app.tables.get(tid));
  });

  it('a real-time table is not closed by the idle lifetime', async () => {
    const { a, table } = await setup();
    await vi.advanceTimersByTimeAsync(3 * DAY);
    expect(table()).toBeTruthy();
    a.close();
  });

  it('only a host may change the lifetime and out-of-range values are refused', async () => {
    const { a, b, table } = await setup();
    expect(await b.act({ type: 'settings', idleDays: 3 })).toMatchObject({ ok: false, code: 'NOT_HOST' });
    await expect(a.act({ type: 'settings', idleDays: 31 })).rejects.toThrow(/idleDays/);
    expect(table()!.state.settings.idleDays).toBe(1);
  });
});

describe('async-turns: spin-down and restart', () => {
  it('after a restart a table past its lifetime closes and one with time left keeps the remainder', async () => {
    let s = await startServer();
    const a = await Client.connect(s, 'Alex');
    const b = await Client.connect(s, 'Sam');
    const old = await tableWith(s, a, [b]);
    await a.act({ type: 'setMode', mode: 'turn' });
    const c = await Client.connect(s, 'Kim');
    const d = await Client.connect(s, 'Lee');
    const fresh = await tableWith(s, c, [d]);
    await c.act({ type: 'setMode', mode: 'turn' });
    const now = Date.now();
    s.app.db.prepare('UPDATE game_tables SET last_action_at = ? WHERE id = ?').run(now - DAY - 1000, old);
    s.app.db.prepare('UPDATE game_tables SET last_action_at = ? WHERE id = ?').run(now - DAY + 1500, fresh);
    for (const x of [a, b, c, d]) x.close();
    const dir = s.dataDir;
    await s.stop(true);

    s = await startServer({}, dir);
    srv = s;
    await until(() => !s.app.tables.get(old), 3000);
    expect(s.app.tables.get(fresh)).toBeTruthy(); // about 1.5 s left
    await until(() => !s.app.tables.get(fresh), 5000);
  });
});
