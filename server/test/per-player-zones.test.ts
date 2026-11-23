import { describe, expect, it } from 'vitest';
import { startServer, api, Client, until } from './harness.js';
import { tableWith, miniContent } from './fixtures.js';

describe('per-player zones over the wire (per-player-zones 2.1, 4.2)', () => {
  it('each player sees every copy with ordinary face rules, and per-seat counts; a late joiner gets a copy from a setup', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b]);
    await a.act({ type: 'zoneAdd', name: 'Tableau', layout: 'spread', perPlayer: true });
    await until(() => (b.table?.zones.filter((z: any) => z.kind === 'player').length ?? 0) === 2);
    const copyOf = (c: Client, of: Client) => {
      const seat = c.table!.seats.find((s: any) => s.playerId === of.id)!;
      return c.table!.zones.find((z: any) => z.kind === 'player' && z.seatId === seat.id)!;
    };
    expect(new Set(a.table!.zones.filter((z: any) => z.kind === 'player').map((z: any) => z.group)).size).toBe(1);

    const std = () => a.zone('Standard');
    await a.act({ type: 'draw', zone: std().id, count: 1, from: 'top', to: copyOf(a, a).id, face: 'up' });
    await a.act({ type: 'draw', zone: std().id, count: 1, from: 'top', to: copyOf(a, a).id, face: 'down' });
    await until(() => copyOf(b, a).cards.length === 2);
    // Sam sees the face-up card's face and only the back of the face-down one; so does Alex
    for (const c of [a, b]) expect(copyOf(c, a).cards.map((x: any) => x.known)).toEqual([true, false]);
    // per-seat counts
    const seatA = b.table!.seats.find((s: any) => s.playerId === a.id)!;
    expect(seatA.zoneCounts).toEqual([{ zone: copyOf(b, a).id, name: 'Tableau', count: 2 }]);

    // a setup with a per-seat zone; a third player joins afterwards
    const content = { ...miniContent('Reserve'), zones: [{ key: 'stock', name: 'Stock', layout: 'pile' }, { key: 'res', name: "{name}'s Reserve", layout: 'spread', perSeat: true, down: 2 }] };
    const s = (await api(srv, 'POST', '/api/setups', { name: 'Reserve' }, a.token)).data;
    expect((await api(srv, 'POST', `/api/setups/${s.id}/save`, { content }, a.token)).status).toBe(200);
    await a.req({ t: 'table.applySetup', tableId: tid, setupId: s.id });
    await until(() => b.table!.lastSetup?.id === s.id);
    const reserves = (c: Client) => c.table!.zones.filter((z: any) => z.kind === 'player' && z.name === 'Reserve');
    expect(reserves(b).map((z: any) => z.cards.length)).toEqual([2, 2]);
    const k = await Client.connect(srv, 'Kim');
    await k.req({ t: 'table.join', tableId: tid });
    await until(() => reserves(k).length === 3);
    expect(copyOf(k, k).cards).toHaveLength(0);
    a.close();
    b.close();
    k.close();
    await srv.stop();
  });
});
