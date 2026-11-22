import { describe, expect, it } from 'vitest';
import { startServer, api, Client, until, type TestServer } from './harness.js';
import { tableWith, miniContent } from './fixtures.js';

async function makeSetup(srv: TestServer, c: Client, content: any) {
  const s = (await api(srv, 'POST', '/api/setups', { name: content.name }, c.token)).data;
  const saved = await api(srv, 'POST', `/api/setups/${s.id}/save`, { content }, c.token);
  if (saved.status !== 200) throw new Error(JSON.stringify(saved.data));
  return s.id as string;
}
async function makeDeck(srv: TestServer, c: Client, count: number) {
  const d = (await api(srv, 'POST', '/api/decks', { name: `Deck of ${count}` }, c.token)).data;
  await api(srv, 'POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'add', card: { name: 'Blank', count, metadata: {} } }] }, c.token);
  await api(srv, 'POST', `/api/decks/${d.id}/save`, {}, c.token);
  return d.id as string;
}
const sharedNames = (c: Client) => c.table!.zones.filter((z: any) => z.kind === 'shared').map((z: any) => z.name);

describe('applying setups to tables (table-setups 3.2)', () => {
  it('applies with defaults, then with a swapped deck; refusals change nothing; Play again deals afresh; survives a restart', async () => {
    let srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b], null);
    const setupId = await makeSetup(srv, a, miniContent());

    await a.req({ t: 'table.applySetup', tableId: tid, setupId });
    await until(() => a.table!.lastSetup?.id === setupId && b.table!.lastSetup?.id === setupId);
    expect(sharedNames(a)).toEqual(['Stock', 'P1']);
    expect(a.myHand().cards).toHaveLength(5);
    expect(b.myHand().cards).toHaveLength(5);
    expect(a.zone('P1').cards).toHaveLength(3);
    expect(a.zone('Stock').cards).toHaveLength(52 - 3 - 10);
    expect(a.table!.counters.map((c: any) => c.label)).toEqual(['Alex score', 'Sam score']);
    expect(a.table!.log.at(-1).text).toBe('Alex applied Mini');
    // only the host
    expect((await b.reqErr({ t: 'table.applySetup', tableId: tid, setupId })).code).toBe('NOT_HOST');

    // swap the deck for a 60-card one
    const big = await makeDeck(srv, a, 60);
    await a.req({ t: 'table.applySetup', tableId: tid, setupId, slots: { s1: big } });
    await until(() => a.zone('Stock')?.cards.length === 60 - 13);

    // refused: too few cards; the table is unchanged
    const small = await makeDeck(srv, a, 10);
    const before = JSON.stringify(srv.app.tables.get(tid)!.state.zones);
    const err = await a.reqErr({ t: 'table.applySetup', tableId: tid, setupId, slots: { s1: small } });
    expect(err).toMatchObject({ code: 'TOO_FEW_CARDS', error: 'The deck for "Deck" has 10 cards; this deal needs 13' });
    expect(JSON.stringify(srv.app.tables.get(tid)!.state.zones)).toBe(before);

    // refused: outside the player range
    const solo = await makeSetup(srv, a, { ...miniContent('Solo'), players: { min: 1, max: 1 } });
    expect((await a.reqErr({ t: 'table.applySetup', tableId: tid, setupId: solo })).error).toBe('Solo is for 1 player; 2 are seated');

    // Play again: same setup, a fresh deal with the same counts
    const p1Before = srv.app.tables.get(tid)!.state.zones[a.zone('P1').id].cards.slice();
    await a.req({ t: 'table.applySetup', tableId: tid, setupId: a.table!.lastSetup!.id });
    await until(() => a.zone('Stock')?.cards.length === 52 - 13);
    const st = srv.app.tables.get(tid)!.state;
    const p1 = Object.values(st.zones).find((z) => z.name === 'P1')!;
    expect(p1.cards).toHaveLength(3);
    expect(p1.cards).not.toEqual(p1Before);

    // survives a restart
    const snapshot = structuredClone(srv.app.tables.get(tid)!.state);
    const dir = srv.dataDir;
    a.close();
    b.close();
    await srv.stop(true);
    srv = await startServer({}, dir);
    const after = srv.app.tables.get(tid)!.state;
    expect(after.zones).toEqual(snapshot.zones);
    expect(after.lastSetup).toEqual(snapshot.lastSetup);
    await srv.stop();
  });

  it('table.create with a setup opens set up; a refused setup still creates the table and reports why', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const setupId = await makeSetup(srv, a, miniContent());
    const r = await a.req({ t: 'table.create', name: 'From setup', setupId });
    expect(r.setupError).toBeUndefined();
    const st = srv.app.tables.get(r.tableId)!.state;
    expect(Object.values(st.zones).filter((z) => z.kind === 'shared').map((z) => z.name)).toEqual(['Stock', 'P1']);
    const duo = await makeSetup(srv, a, { ...miniContent('Duo'), players: { min: 2, max: 4 } });
    const r2 = await a.req({ t: 'table.create', name: 'Too few', setupId: duo });
    expect(r2.tableId).toBeTruthy();
    expect(r2.setupError).toBe('Duo is for 2 to 4 players; 1 is seated');
    await srv.stop();
  });
});

describe('save table as setup (table-setups 3.3)', () => {
  it('the host records the live table into a draft; non-hosts cannot', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b]);
    await a.act({ type: 'zoneAdd', name: 'P1', layout: 'column' });
    const deck = a.zone('Standard').id;
    await a.act({ type: 'move', cards: a.zone('Standard').cards.slice(0, 2).map((c: any) => c.h), to: a.zone('P1').id });
    await a.act({ type: 'deal', zone: deck, count: 4, seats: a.table!.seats.filter((x: any) => x.playerId).map((x: any) => x.id) });
    await a.act({ type: 'counterAdd', label: 'Alex score', value: 0 });
    await a.act({ type: 'counterAdd', label: 'Sam score', value: 0 });
    expect((await api(srv, 'POST', `/api/tables/${tid}/record-setup`, {}, b.token)).status).toBe(403);
    const r = await api(srv, 'POST', `/api/tables/${tid}/record-setup`, { name: 'House rules' }, a.token);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ name: 'House rules', hasDraft: true });
    const d = r.data.draft;
    expect(d.zones.map((z: any) => z.name)).toEqual(['Discard', 'Standard', 'Table', 'P1']);
    expect(d.zones.find((z: any) => z.name === 'P1')).toMatchObject({ down: 2, up: 0 });
    expect(d.hands).toEqual({ count: 4, face: 'down' });
    expect(d.counters).toEqual([{ label: '{name} score', value: 0, perSeat: true }]);
    expect(d.players).toEqual({ min: 2, max: 2 });
    // saving the draft makes it usable
    const saved = await api(srv, 'POST', `/api/setups/${r.data.id}/save`, {}, a.token);
    expect(saved.status).toBe(200);
    await srv.stop();
  });
});
