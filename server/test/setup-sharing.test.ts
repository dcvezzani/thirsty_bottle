import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startServer, api, newPlayer, Client, until, type TestServer } from './harness.js';
import { tableWith, miniContent } from './fixtures.js';

const ADMIN = path.resolve('server/dist/admin.js');
const admin = (dataDir: string, ...args: string[]) => execFileSync(process.execPath, [ADMIN, ...args], { env: { ...process.env, DATA_DIR: dataDir }, encoding: 'utf8' });

async function saved(srv: TestServer, token: string, content: any) {
  const s = (await api(srv, 'POST', '/api/setups', { name: content.name }, token)).data;
  const r = await api(srv, 'POST', `/api/setups/${s.id}/save`, { content }, token);
  if (r.status !== 200) throw new Error(JSON.stringify(r.data));
  return s.id as string;
}

describe('setup access (setup-sharing 1.1)', () => {
  it('private 404s for others; public and link (with token) are viewable and clonable; never editable by others', async () => {
    const srv = await startServer();
    const alex = await newPlayer(srv, 'Alex');
    const sam = await newPlayer(srv, 'Sam');
    const A = (m: string, u: string, b?: unknown) => api(srv, m, u, b, alex.token);
    const S = (m: string, u: string, b?: unknown) => api(srv, m, u, b, sam.token);
    const id = await saved(srv, alex.token, miniContent('Rummy'));
    expect((await S('GET', `/api/setups/${id}`)).status).toBe(404);
    expect((await S('POST', `/api/setups/${id}/clone`)).status).toBe(404);
    // link: only with the token
    const linked = (await A('PUT', `/api/setups/${id}/visibility`, { visibility: 'link' })).data;
    expect(linked.shareToken).toBeTruthy();
    expect((await S('GET', `/api/setups/${id}`)).status).toBe(404);
    const viaLink = (await S('GET', `/api/setup-share/${linked.shareToken}`)).data;
    expect(viaLink).toMatchObject({ id, name: 'Rummy', mine: false, ownerName: 'Alex', draft: null });
    expect(viaLink.shareToken).toBeUndefined();
    expect((await S('GET', `/api/setups/${id}?share=${linked.shareToken}`)).status).toBe(200);
    // public: viewable without a token
    await A('PUT', `/api/setups/${id}/visibility`, { visibility: 'public' });
    expect((await S('GET', `/api/setups/${id}`)).status).toBe(200);
    // never editable by others
    expect((await S('PUT', `/api/setups/${id}/draft`, { content: miniContent('Mine now') })).status).toBe(404);
    expect((await S('POST', `/api/setups/${id}/save`, { content: miniContent('Mine now') })).status).toBe(404);
    expect((await S('POST', `/api/setups/${id}/archive`)).status).toBe(404);
    expect((await S('PUT', `/api/setups/${id}/visibility`, { visibility: 'private' })).status).toBe(404);
    // archived: links stop working
    await A('POST', `/api/setups/${id}/archive`);
    expect((await S('GET', `/api/setup-share/${linked.shareToken}`)).status).toBe(404);
    await srv.stop();
  });

  it("a private setup applied at Sam's table becomes viewable to Sam there; Play again needs no token", async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b], null);
    const id = await saved(srv, a.token, miniContent('House'));
    expect((await api(srv, 'GET', `/api/setups/${id}`, undefined, b.token)).status).toBe(404);
    await a.req({ t: 'table.applySetup', tableId: tid, setupId: id });
    await until(() => b.table!.lastSetup?.id === id);
    expect((await api(srv, 'GET', `/api/setups/${id}`, undefined, b.token)).status).toBe(200);
    // Alex hands host to Sam; Sam can Play again
    await a.act({ type: 'setHost', playerId: b.id });
    await until(() => b.table!.me.isHost);
    await b.req({ t: 'table.applySetup', tableId: tid, setupId: b.table!.lastSetup!.id });
    await srv.stop();
  });
});

describe('gallery, share and clone (setup-sharing 1.2)', () => {
  it('lists only active public unhidden non-built-in setups; prefix search by name and owner; both sorts; clone labels and counts', async () => {
    const srv = await startServer();
    const alex = await newPlayer(srv, 'Alex');
    const sam = await newPlayer(srv, 'Sam');
    const pub = await saved(srv, alex.token, miniContent('Rummy night'));
    const priv = await saved(srv, alex.token, miniContent('Secret rummy'));
    const other = await saved(srv, alex.token, miniContent('Poker'));
    for (const id of [pub, other]) await api(srv, 'PUT', `/api/setups/${id}/visibility`, { visibility: 'public' }, alex.token);
    void priv;
    const G = async (q: string, sort = 'newest') => (await api(srv, 'GET', `/api/setup-gallery?q=${encodeURIComponent(q)}&sort=${sort}`, undefined, sam.token)).data;
    expect((await G('rum')).setups.map((s: any) => s.name)).toEqual(['Rummy night']);
    expect((await G('ale')).setups.map((s: any) => s.name).sort()).toEqual(['Poker', 'Rummy night']);
    expect((await G('')).setups.some((s: any) => s.builtIn)).toBe(false);
    // clone by Sam: labelled, counted
    const c = (await api(srv, 'POST', `/api/setups/${pub}/clone`, undefined, sam.token)).data;
    expect(c).toMatchObject({ name: 'Rummy night', mine: true, clonedFromLabel: 'Cloned from Rummy night by Alex', visibility: 'private' });
    expect((await G('', 'cloned')).setups[0]).toMatchObject({ name: 'Rummy night', cloneCount: 1 });
    // own clone keeps the (copy) suffix and no label
    const own = (await api(srv, 'POST', `/api/setups/${pub}/clone`, undefined, alex.token)).data;
    expect(own).toMatchObject({ name: 'Rummy night (copy)', clonedFromLabel: null });
    await srv.stop();
  });
});

describe('reports and admin (setup-sharing 1.3)', () => {
  it('a report hides from the gallery (owner still lists it); repeats are no-ops; built-ins stay; admin lists, unhides, hides', async () => {
    let srv = await startServer();
    const alex = await newPlayer(srv, 'Alex');
    const sam = await newPlayer(srv, 'Sam');
    const id = await saved(srv, alex.token, miniContent('Spammy'));
    await api(srv, 'PUT', `/api/setups/${id}/visibility`, { visibility: 'public' }, alex.token);
    const G = async () => (await api(srv, 'GET', '/api/setup-gallery?q=Spammy', undefined, sam.token)).data.setups.map((s: any) => s.id);
    expect(await G()).toEqual([id]);
    await api(srv, 'POST', `/api/setups/${id}/report`, { reason: 'spam' }, sam.token);
    await api(srv, 'POST', `/api/setups/${id}/report`, { reason: 'again' }, sam.token);
    expect(await G()).toEqual([]);
    expect((await api(srv, 'GET', '/api/setups', undefined, alex.token)).data.setups.map((s: any) => s.id)).toContain(id);
    await api(srv, 'POST', '/api/setups/builtin-setup-klondike/report', { reason: 'x' }, sam.token);
    expect((await api(srv, 'GET', '/api/setups', undefined, sam.token)).data.builtIn.map((s: any) => s.id)).toContain('builtin-setup-klondike');
    const dir = srv.dataDir;
    await srv.stop(true);
    const listed = admin(dir, 'reports');
    expect(listed).toContain(id);
    expect(listed).toContain('spam');
    expect(listed).not.toContain('again');
    expect(admin(dir, 'unhide', id)).toContain(`unhide ${id}: done`);
    srv = await startServer({}, dir);
    expect(await G()).toEqual([id]);
    await srv.stop(true);
    admin(dir, 'hide', id);
    srv = await startServer({}, dir);
    expect(await G()).toEqual([]);
    await srv.stop();
  });
});

describe('built-ins and default decks (setup-sharing 1.4)', () => {
  it('built-ins exist, are listed and apply with their deals', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const a = await Client.connect(srv, 'Alex');
    const list = (await api(srv, 'GET', '/api/setups', undefined, a.token)).data.builtIn;
    expect(list.map((s: any) => s.name)).toEqual(['Crazy Eights', 'Hearts', 'Klondike']);
    expect(list[0]).toMatchObject({ builtIn: true, ownerName: 'Card Table', mine: false });
    const tid = await tableWith(srv, a, [], null);
    await a.req({ t: 'table.applySetup', tableId: tid, setupId: 'builtin-setup-klondike' });
    await until(() => a.table!.lastSetup?.name === 'Klondike');
    for (let k = 1; k <= 7; k++) {
      const z = a.zone(`P${k}`);
      expect(z.cards).toHaveLength(k);
      expect(z.cards.map((c: any) => c.faceUp)).toEqual([...Array(k - 1).fill(false), true]);
    }
    expect(a.zone('Stock').cards).toHaveLength(24);
    await srv.stop();
  });

  it('Crazy Eights for 3 and Hearts for 3 deal as specified', async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const [a, b, c] = await Promise.all(['Alex', 'Sam', 'Kim'].map((n) => Client.connect(srv, n)));
    const tid = await tableWith(srv, a, [b, c], null);
    await a.req({ t: 'table.applySetup', tableId: tid, setupId: 'builtin-setup-crazy-eights' });
    await until(() => a.table!.lastSetup?.name === 'Crazy Eights' && c.myHand()?.cards.length === 5);
    expect([a, b, c].map((x) => x.myHand().cards.length)).toEqual([5, 5, 5]);
    expect(a.zone('Discard').cards.map((x: any) => x.faceUp)).toEqual([true]);
    expect(a.zone('Stock').cards).toHaveLength(52 - 15 - 1);
    await a.req({ t: 'table.applySetup', tableId: tid, setupId: 'builtin-setup-hearts' });
    await until(() => a.table!.lastSetup?.name === 'Hearts' && c.myHand()?.cards.length === 17);
    expect([a, b, c].map((x) => x.myHand().cards.length)).toEqual([18, 17, 17]);
    expect(a.table!.counters.map((x: any) => x.label)).toEqual(['Alex points', 'Sam points', 'Kim points']);
    await srv.stop();
  });

  it('a changed built-in writes a new version on restart', async () => {
    let srv = await startServer();
    const v1 = srv.app.setups.row('builtin-setup-hearts')!.current_version_id;
    // simulate an older stored version
    srv.app.db.prepare('UPDATE setup_versions SET content = ? WHERE id = ?').run(JSON.stringify({ ...srv.app.setups.versionContent(v1), counters: [] }), v1);
    const dir = srv.dataDir;
    await srv.stop(true);
    srv = await startServer({}, dir);
    const r = srv.app.setups.row('builtin-setup-hearts')!;
    expect(r.current_version_id).not.toBe(v1);
    expect(srv.app.setups.versionContent(r.current_version_id).counters).toHaveLength(1);
    await srv.stop();
  });

  it("another player's private default deck asks for a deck; a fixed deal on it is refused with the owner message", async () => {
    const srv = await startServer({ rate: { perSecond: 1000, burst: 1000 } });
    const alex = await Client.connect(srv, 'Alex');
    const sam = await Client.connect(srv, 'Sam');
    const d = (await api(srv, 'POST', '/api/decks', { name: 'Alex private' }, alex.token)).data;
    await api(srv, 'POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'add', card: { name: 'Blank', count: 60, metadata: {} } }] }, alex.token);
    const deckSaved = (await api(srv, 'POST', `/api/decks/${d.id}/save`, {}, alex.token)).data;
    const content = { ...miniContent('Shared'), slots: [{ id: 's1', label: 'Deck', defaultDeckId: d.id }] };
    const id = await saved(srv, alex.token, content);
    await api(srv, 'PUT', `/api/setups/${id}/visibility`, { visibility: 'public' }, alex.token);
    const forSam = (await api(srv, 'GET', `/api/setups/${id}`, undefined, sam.token)).data;
    expect(forSam.slots[0]).toMatchObject({ defaultDeckShareable: false, defaultDeckUsable: false });
    const tid = await tableWith(srv, sam, [], null);
    expect((await sam.reqErr({ t: 'table.applySetup', tableId: tid, setupId: id })).error).toBe('The deck for "Deck" is not available; choose another');
    await sam.req({ t: 'table.applySetup', tableId: tid, setupId: id, slots: { s1: 'builtin-standard-52' } });
    await until(() => sam.table!.lastSetup?.id === id);
    // fixed deal on Alex's private deck
    const fixed = { ...content, name: 'Fixed', players: { min: 1, max: 1 }, hands: undefined, counters: [], fixed: { players: 1, deckVersions: { s1: deckSaved.currentVersionId }, zones: {}, hands: [[]] } };
    const fid = await saved(srv, alex.token, fixed);
    await api(srv, 'PUT', `/api/setups/${fid}/visibility`, { visibility: 'public' }, alex.token);
    expect((await sam.reqErr({ t: 'table.applySetup', tableId: tid, setupId: fid })).error).toBe("This setup's fixed deal needs Alex's deck");
    await srv.stop();
  });
});
