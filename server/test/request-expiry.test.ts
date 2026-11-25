import { describe, expect, it } from 'vitest';
import { startServer, Client, until } from './harness.js';
import { tableWith } from './fixtures.js';

describe('request-expiry over the wire (2.1)', () => {
  it('an unanswered see request and take request lapse, the asker is told, the log records it, and a late answer is refused', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 }, requestTtlMs: 400 });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b]);
    const seatA = b.table!.seats.find((s: any) => s.playerId === a.id)!.id;
    await a.act({ type: 'draw', zone: a.zone('Standard').id, count: 3, from: 'top' });
    await until(() => b.table!.zones.some((z: any) => z.kind === 'hand' && z.seatId === seatA && z.cards.length === 3));

    await b.act({ type: 'seeAsk', seat: seatA });
    await until(() => a.table!.requests.some((r: any) => r.kind === 'see'));
    const req = a.table!.requests.find((r: any) => r.kind === 'see')!;
    expect(req.msLeft).toBeGreaterThan(0);
    expect(req.msLeft).toBeLessThanOrEqual(400);

    await until(() => !a.table!.requests.length && !b.table!.requests.length, 3000);
    expect(b.msgs.some((m: any) => m.t === 'table.notice' && /Alex didn't answer in time/.test(m.text))).toBe(true);
    expect(a.msgs.some((m: any) => m.t === 'table.notice')).toBe(false);
    expect(a.table!.log.some((l: any) => /Sam's request to see Alex's hand expired/.test(l.text))).toBe(true);
    // nothing was shown
    expect(b.table!.zones.find((z: any) => z.kind === 'hand' && z.seatId === seatA)!.cards.every((c: any) => !c.known)).toBe(true);

    // a late answer is refused
    expect(await a.act({ type: 'seeRespond', requestId: req.id, approve: true })).toMatchObject({ ok: false, error: 'That request has expired' });

    // ask again works, and answering in time cancels the timer (no expiry log afterwards)
    await b.act({ type: 'seeAsk', seat: seatA });
    await until(() => a.table!.requests.some((r: any) => r.kind === 'see'));
    const again = a.table!.requests.find((r: any) => r.kind === 'see')!;
    await a.act({ type: 'seeRespond', requestId: again.id, approve: false });
    await new Promise((r) => setTimeout(r, 600));
    expect(a.table!.log.filter((l: any) => /expired/.test(l.text)).length).toBe(1);
    expect(srv.app.db.prepare('SELECT id FROM game_tables WHERE id = ?').get(tid)).toBeTruthy();
    a.close();
    b.close();
    await srv.stop();
  });
});
