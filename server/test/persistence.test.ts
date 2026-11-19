import { describe, expect, it } from 'vitest';
import { startServer, Client, until } from './harness.js';
import { tableWith } from './fixtures.js';

describe('persistence and replay (3.5)', () => {
  it('restarting the server mid-game keeps zones, order, hands, log and chat', async () => {
    let srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b]);
    const deck = a.zone('Standard').id;
    await a.act({ type: 'shuffle', zone: deck });
    await a.act({ type: 'deal', zone: deck, count: 5, seats: a.table!.seats.map((s) => s.id) });
    // enough actions to cross a snapshot boundary (every 50) and leave a tail of logged actions
    for (let i = 0; i < 57; i++) {
      await a.act({ type: i % 3 === 0 ? 'shuffle' : 'cut', zone: deck, ...(i % 3 ? { mode: 'complete' } : {}) });
    }
    await a.act({ type: 'move', cards: [a.myHand().cards[0].h], to: a.zone('Table').id, face: 'up' });
    await a.req({ t: 'chat.send', channel: `table:${tid}`, text: 'before restart' });
    await until(() => b.table!.version === srv.app.tables.get(tid)!.version);
    const before = structuredClone(srv.app.tables.get(tid)!.state);
    const version = srv.app.tables.get(tid)!.version;
    const dir = srv.dataDir;
    a.close();
    b.close();
    await srv.stop(true);

    srv = await startServer({}, dir);
    const s = srv.app.tables.get(tid)!;
    expect(s.version).toBe(version);
    expect(s.state.zones).toEqual(before.zones);
    expect(s.state.cards).toEqual(before.cards);
    expect(s.state.log.length).toBeGreaterThanOrEqual(before.log.length);

    const a2 = new Client(srv, a.token, a.id, 'Alex');
    await a2.open();
    await a2.req({ t: 'table.join', tableId: tid });
    await until(() => !!a2.table);
    const handBefore = before.zones[`hand:${before.seats[0].id}`].cards.length;
    expect(a2.myHand().cards).toHaveLength(handBefore);
    expect(a2.table!.me.seatId).toBe(before.seats[0].id);
    const hist = (await a2.wait((m) => m.t === 'chat.history' && m.channel === `table:${tid}`)) as any;
    expect(hist.messages.map((m: any) => m.text)).toContain('before restart');
    a2.close();
    await srv.stop();
  });
});

describe('zone-arrangement 1.2: old tables are migrated on load', () => {
  it('a table stored without zoneLayoutVersion comes back in its old visual order', async () => {
    let srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const tid = await tableWith(srv, a, []);
    await a.act({ type: 'zoneAdd', name: 'Low', layout: 'spread', x: 0.1, y: 0.9 });
    await a.act({ type: 'zoneAdd', name: 'High', layout: 'spread', x: 0.1, y: 0.2 });
    // turn the live table into the pre-change format; shutdown snapshots it as-is
    const st = srv.app.tables.get(tid)!.state;
    delete st.zoneLayoutVersion;
    const dir = srv.dataDir;
    a.close();
    await srv.stop(true);

    srv = await startServer({}, dir);
    const s = srv.app.tables.get(tid)!.state;
    const names = s.zoneOrder.filter((id) => s.zones[id].kind === 'shared').map((id) => s.zones[id].name);
    expect(names.indexOf('High')).toBeLessThan(names.indexOf('Low'));
    expect(s.zoneLayoutVersion).toBe(1);
    // piles first, as the old board showed them
    const firstNonPile = names.findIndex((n) => s.zones[s.zoneOrder.find((id) => s.zones[id].name === n)!].layout !== 'pile');
    expect(names.slice(firstNonPile).every((n) => s.zones[s.zoneOrder.find((id) => s.zones[id].name === n)!].layout !== 'pile')).toBe(true);
    await srv.stop();
  });
});
