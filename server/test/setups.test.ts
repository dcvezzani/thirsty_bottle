import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, api, newPlayer, type TestServer } from './harness.js';
import { miniContent } from './fixtures.js';

let srv: TestServer;
let alex: { token: string; player: { id: string } };
let sam: { token: string; player: { id: string } };
beforeAll(async () => {
  srv = await startServer();
  alex = await newPlayer(srv, 'Alex');
  sam = await newPlayer(srv, 'Sam');
});
afterAll(async () => srv.stop());

const A = (m: string, u: string, b?: unknown) => api(srv, m, u, b, alex.token);
const S = (m: string, u: string, b?: unknown) => api(srv, m, u, b, sam.token);

describe('setup library (table-setups 3.1)', () => {
  it('create, draft, save (versions), discard', async () => {
    const created = (await A('POST', '/api/setups', { name: 'Mini' })).data;
    expect(created).toMatchObject({ name: 'Mini', status: 'active', hasDraft: false, zoneCount: 0 });
    const v0 = created.currentVersionId;
    expect((await A('PUT', `/api/setups/${created.id}/draft`, { content: miniContent() })).status).toBe(200);
    const withDraft = (await A('GET', `/api/setups/${created.id}`)).data;
    expect(withDraft.hasDraft).toBe(true);
    expect(withDraft.content.zones).toHaveLength(0); // saved version unchanged until save
    expect(withDraft.draft.zones).toHaveLength(2);
    const saved = (await A('POST', `/api/setups/${created.id}/save`)).data;
    expect(saved.currentVersionId).not.toBe(v0);
    expect(saved).toMatchObject({ hasDraft: false, zoneCount: 2, players: { min: 1, max: 4 } });
    expect(saved.slots[0]).toMatchObject({ id: 's1', defaultDeckName: 'Standard 52' });
    await A('PUT', `/api/setups/${created.id}/draft`, { content: { ...miniContent(), name: 'Changed' } });
    const discarded = (await A('DELETE', `/api/setups/${created.id}/draft`)).data;
    expect(discarded).toMatchObject({ name: 'Mini', hasDraft: false });
  });

  it('save refuses a structurally broken setup with a readable message', async () => {
    const s = (await A('POST', '/api/setups', { name: 'Broken' })).data;
    const r = await A('POST', `/api/setups/${s.id}/save`, { content: { ...miniContent('Broken'), homes: {} } });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('Deck slot "Deck" needs a home zone');
  });

  it('clone, archive, delete only when archived; archived setups are listed separately', async () => {
    const s = (await A('POST', '/api/setups', { name: 'Klondike' })).data;
    await A('POST', `/api/setups/${s.id}/save`, { content: miniContent('Klondike') });
    const copy = (await A('POST', `/api/setups/${s.id}/clone`)).data;
    expect(copy.name).toBe('Klondike (copy)');
    expect(copy.id).not.toBe(s.id);
    expect((await A('DELETE', `/api/setups/${s.id}`, { confirm: true })).status).toBe(409);
    await A('POST', `/api/setups/${s.id}/archive`);
    expect((await A('GET', '/api/setups')).data.setups.map((x: any) => x.id)).not.toContain(s.id);
    expect((await A('GET', '/api/setups?status=archived')).data.setups.map((x: any) => x.id)).toContain(s.id);
    expect((await A('PUT', `/api/setups/${s.id}/draft`, { content: miniContent() })).status).toBe(409);
    expect((await A('DELETE', `/api/setups/${s.id}`, { confirm: true })).status).toBe(200);
    expect((await A('GET', `/api/setups/${s.id}`)).status).toBe(404);
  });

  it('setups are private to their owner', async () => {
    const s = (await A('POST', '/api/setups', { name: 'Mine' })).data;
    expect((await S('GET', `/api/setups/${s.id}`)).status).toBe(404);
    expect((await S('POST', `/api/setups/${s.id}/clone`)).status).toBe(404);
    expect((await S('GET', '/api/setups')).data.setups).toEqual([]);
  });
});
