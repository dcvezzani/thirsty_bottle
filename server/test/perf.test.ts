import { describe, expect, it } from 'vitest';
import type { TableDeck } from '@vct/shared';
import { startServer, Client, until } from './harness.js';

const pct = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

describe('performance (10.3)', () => {
  it('12 seats, 500 cards: p95 action-to-broadcast < 50 ms on the server, < 300 ms to other clients', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const clients: Client[] = [];
    for (let i = 0; i < 12; i++) clients.push(await Client.connect(srv, `P${i}`));
    const [host, ...rest] = clients;
    const { tableId } = await host.req({ t: 'table.create', name: 'Perf', seatLimit: 12 });
    await host.req({ t: 'table.join', tableId });
    for (const c of rest) await c.req({ t: 'table.join', tableId });
    const deck: TableDeck = {
      id: 'big',
      sourceDeckId: null,
      versionId: null,
      name: 'Big',
      homeZoneId: '',
      defs: Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, name: `Card ${i}`, count: 5, metadata: { n: i } })),
    };
    srv.app.tables.get(tableId)!.apply({ type: 'loadDeck', deck }, null);
    await until(() => clients.every((c) => c.zone('Big')?.cards.length === 500));
    const seats = host.table!.seats.map((s) => s.id);
    await host.act({ type: 'deal', zone: host.zone('Big').id, count: 20, seats });
    await until(() => clients.every((c) => c.myHand()?.cards.length === 20));
    srv.app.metrics.actionMs.length = 0;

    // scripted burst: every player acts concurrently, 25 rounds
    const otherLatency: number[] = [];
    const ackLatency: number[] = [];
    for (let round = 0; round < 25; round++) {
      await Promise.all(
        clients.map(async (c, i) => {
          const table = c.zone('Table');
          const big = c.zone('Big');
          const kind = (round + i) % 4;
          let action: any;
          if (kind === 0 && c.myHand().cards.length) action = { type: 'move', cards: [c.myHand().cards[0].h], to: table.id, face: 'up' };
          else if (kind === 1 && big.cards.length) action = { type: 'draw', zone: big.id, count: 1, from: 'random' };
          else if (kind === 2) action = { type: 'shuffle', zone: big.id };
          else action = { type: 'counterAdd', label: `c${round}-${i}`, value: 1 };
          const t0 = performance.now();
          const seenByOther = clients[(i + 1) % 12].next((m) => m.t === 'table.patch', 5000).then(() => otherLatency.push(performance.now() - t0));
          const ack = await c.act(action);
          ackLatency.push(performance.now() - t0);
          await seenByOther;
          return ack;
        }),
      );
    }
    const server = srv.app.metrics.actionMs;
    const result = {
      actions: server.length,
      serverP50: pct(server, 0.5),
      serverP95: pct(server, 0.95),
      ackP95: pct(ackLatency, 0.95),
      otherClientP95: pct(otherLatency, 0.95),
    };
    console.log('perf', JSON.stringify(result));
    expect(server.length).toBeGreaterThanOrEqual(250);
    expect(result.serverP95).toBeLessThan(50);
    expect(result.otherClientP95).toBeLessThan(300);
    clients.forEach((c) => c.close());
    await srv.stop();
  }, 120_000);
});
