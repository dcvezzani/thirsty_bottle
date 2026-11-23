import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { startServer, api, newPlayer, Client, until, sleep, type TestServer } from './harness.js';

let srv: TestServer;
let alex: Awaited<ReturnType<typeof newPlayer>>;
let sam: Awaited<ReturnType<typeof newPlayer>>;
beforeAll(async () => {
  srv = await startServer({ rate: { perSecond: 500, burst: 500 } });
  alex = await newPlayer(srv, 'Alex');
  sam = await newPlayer(srv, 'Sam');
});
afterAll(async () => srv.stop());

const A = (m: string, u: string, b?: unknown) => api(srv, m, u, b, alex.token);
const S = (m: string, u: string, b?: unknown) => api(srv, m, u, b, sam.token);

async function upload(token: string, color: string) {
  const png = await sharp({ create: { width: 200, height: 280, channels: 3, background: color } }).png().toBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
  return (await api(srv, 'POST', '/api/images', fd, token)).data.id as string;
}

async function deck(name: string, cards: any[], vis?: 'public' | 'link') {
  const d = (await A('POST', '/api/decks', { name })).data;
  await A('POST', `/api/decks/${d.id}/save`, { content: { name, propertyTemplate: [], cards } });
  if (vis) await A('PUT', `/api/decks/${d.id}/visibility`, { visibility: vis });
  return (await A('GET', `/api/decks/${d.id}`)).data;
}

const backdate = (deckId: string, days: number) =>
  srv.app.db.prepare('UPDATE deck_versions SET created_at = ? WHERE deck_id = ?').run(Date.now() - days * 86400_000, deckId);
const versions = (deckId: string) => (srv.app.db.prepare('SELECT id FROM deck_versions WHERE deck_id = ?').all(deckId) as { id: string }[]).map((r) => r.id);

describe('deck-version-pruning 1.2', () => {
  it('prunes old superseded versions only; keeps current, table-referenced, recent versions and drafts; then GCs images', async () => {
    const onlyOld = await upload(alex.token, '#112233');
    const a = await deck('Prune A', [{ id: 'c1', name: 'Old art', count: 1, metadata: {}, frontImageId: onlyOld }]);
    const aV1 = a.currentVersionId;
    await A('POST', `/api/decks/${a.id}/save`, { content: { name: 'Prune A', propertyTemplate: [], cards: [{ id: 'c1', name: 'No art', count: 1, metadata: {} }] } });
    await A('POST', `/api/decks/${a.id}/save`, { content: { name: 'Prune A', propertyTemplate: [], cards: [{ id: 'c1', name: 'No art 2', count: 1, metadata: {} }] } });
    await A('PUT', `/api/decks/${a.id}/draft`, { content: { name: 'Prune A draft', propertyTemplate: [], cards: [] } });
    const aCur = (await A('GET', `/api/decks/${a.id}`)).data.currentVersionId;

    // B: an old version still loaded on a table
    const b = await deck('Prune B', [{ id: 'b1', name: 'B', count: 1, metadata: {} }]);
    const c = new Client(srv, alex.token, alex.player.id, 'Alex');
    await c.open();
    const { tableId } = await c.req({ t: 'table.create', name: 'Prune table', deckId: b.id });
    await A('POST', `/api/decks/${b.id}/save`, { content: { name: 'Prune B', propertyTemplate: [], cards: [{ id: 'b1', name: 'B2', count: 1, metadata: {} }] } });

    // C: superseded but recent
    const cdeck = await deck('Prune C', [{ id: 'x', name: 'X', count: 1, metadata: {} }]);
    await A('POST', `/api/decks/${cdeck.id}/save`, { content: { name: 'Prune C', propertyTemplate: [], cards: [{ id: 'x', name: 'X2', count: 1, metadata: {} }] } });

    backdate(a.id, 40);
    backdate(b.id, 40);
    const removed = srv.app.decks.pruneVersions();
    expect(removed).toBe(4); // A: empty initial, v1, v2; B: empty initial
    expect(versions(a.id)).toEqual([aCur]);
    expect(versions(a.id)).not.toContain(aV1);
    expect(versions(b.id)).toHaveLength(2); // initial pruned; the old one loaded on the table is kept
    expect(versions(cdeck.id)).toHaveLength(3); // all recent: nothing pruned
    expect((await A('GET', `/api/decks/${a.id}`)).data.draft.name).toBe('Prune A draft');
    // table still plays from its snapshot
    await c.req({ t: 'table.join', tableId });
    await until(() => !!c.table && c.zone('Prune B')?.cards.length === 1);
    // the image used only by pruned versions is collected once it leaves the uploader's library
    srv.app.images.gc(0);
    expect(srv.app.images.exists(onlyOld)).toBe(true);
    expect((await A('DELETE', `/api/library/images/${onlyOld}`)).status).toBe(200);
    srv.app.images.gc(0);
    expect(srv.app.images.exists(onlyOld)).toBe(false);
    await c.req({ t: 'table.leave', tableId });
    c.close();
  });
});

describe('deck-reporting 1.1', () => {
  it('reporting is idempotent per player and built-in decks cannot be hidden', async () => {
    const d = await deck('Reportable', [{ id: 'r', name: 'R', count: 1, metadata: {} }], 'public');
    await S('POST', `/api/decks/${d.id}/report`, { reason: 'spam' });
    await S('POST', `/api/decks/${d.id}/report`, { reason: 'again' });
    const n = (srv.app.db.prepare('SELECT COUNT(*) n FROM deck_reports WHERE deck_id = ?').get(d.id) as any).n;
    expect(n).toBe(1);
    expect((await S('GET', '/api/gallery?q=Reportable')).data.decks).toHaveLength(0);
    expect((await A('GET', '/api/decks')).data.decks.map((x: any) => x.id)).toContain(d.id); // owner still sees it
    await S('POST', '/api/decks/builtin-standard-52/report', {});
    expect((await S('GET', '/api/decks/builtin-standard-52')).status).toBe(200);
  });
});

describe('image-access-control 1.1', () => {
  it('link decks need the token; table participants can load artwork while seated', async () => {
    const img = await upload(alex.token, '#445566');
    const d = await deck('Linked art', [{ id: 'l', name: 'L', count: 1, metadata: {}, frontImageId: img }], 'link');
    const token = (await A('GET', `/api/decks/${d.id}`)).data.shareToken;
    const get = (q = '', t = sam.token) => api(srv, 'GET', `/api/images/${img}.thumb.webp${q}`, undefined, t);
    expect((await get()).status).toBe(404);
    expect((await get(`?share=${token}`)).status).toBe(200);
    // private deck loaded on a table
    const img2 = await upload(alex.token, '#778899');
    const p = await deck('Private art', [{ id: 'p', name: 'P', count: 1, metadata: {}, frontImageId: img2 }]);
    const a = new Client(srv, alex.token, alex.player.id, 'Alex');
    const s = new Client(srv, sam.token, sam.player.id, 'Sam');
    await a.open();
    await s.open();
    const { tableId } = await a.req({ t: 'table.create', name: 'Art table', deckId: p.id });
    await a.req({ t: 'table.join', tableId });
    const url = `/api/images/${img2}.webp`;
    expect((await api(srv, 'GET', url, undefined, sam.token)).status).toBe(404);
    await s.req({ t: 'table.join', tableId });
    expect((await api(srv, 'GET', url, undefined, sam.token)).status).toBe(200);
    expect((await api(srv, 'GET', `${url}?k=${srv.app.imageKey(sam.player.id)}`)).status).toBe(200);
    await s.req({ t: 'table.leave', tableId });
    expect((await api(srv, 'GET', url, undefined, sam.token)).status).toBe(404);
    expect((await api(srv, 'GET', `${url}?k=${sam.player.id}.forgedkeyforgedkeyfo`)).status).toBe(404);
    await a.req({ t: 'table.leave', tableId });
    a.close();
    s.close();
  });
});

describe('profile-rename 1.1', () => {
  it('rename updates presence, the seat name and later chat messages; invalid names are refused', async () => {
    const a = await Client.connect(srv, 'Ren');
    const b = await Client.connect(srv, 'Watcher');
    const { tableId } = await a.req({ t: 'table.create', name: 'Rename table' });
    await a.req({ t: 'table.join', tableId });
    await b.req({ t: 'table.join', tableId });
    await a.req({ t: 'chat.send', channel: `table:${tableId}`, text: 'before' });
    await a.req({ t: 'profile', name: 'Renata', color: '#123456' });
    await until(() => !!b.table?.seats.find((x) => x.playerId === a.id && x.name === 'Renata'));
    await b.wait((m) => m.t === 'lobby' && !!m.players.find((p) => p.id === a.id && p.name === 'Renata' && p.color === '#123456'));
    await a.req({ t: 'chat.send', channel: `table:${tableId}`, text: 'after' });
    await sleep(50);
    const hist = srv.app.chat.history(`table:${tableId}`, b.id);
    expect(hist.find((m) => m.text === 'before')!.name).toBe('Ren');
    expect(hist.find((m) => m.text === 'after')!.name).toBe('Renata');
    expect((await a.reqErr({ t: 'profile', name: '   ', color: '#123456' })).code).toBe('BAD_MESSAGE');
    expect((await a.reqErr({ t: 'profile', name: 'x'.repeat(25), color: '#123456' })).code).toBe('BAD_MESSAGE');
    expect(srv.app.players.get(a.id)!.name).toBe('Renata');
    a.close();
    b.close();
  });
});
