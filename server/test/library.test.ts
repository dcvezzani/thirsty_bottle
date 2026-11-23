import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import Database from 'better-sqlite3';
import { startServer, api, newPlayer, type TestServer } from './harness.js';
import { migrate } from '../src/db.js';

let srv: TestServer;
let alex: { token: string; player: { id: string } };
let sam: { token: string; player: { id: string } };
let kim: { token: string; player: { id: string } };
beforeAll(async () => {
  srv = await startServer();
  alex = await newPlayer(srv, 'Alex');
  sam = await newPlayer(srv, 'Sam');
  kim = await newPlayer(srv, 'Kim');
});
afterAll(async () => srv.stop());

const A = (m: string, u: string, b?: unknown) => api(srv, m, u, b, alex.token);
const S = (m: string, u: string, b?: unknown) => api(srv, m, u, b, sam.token);

async function upload(token: string, color: string, file = 'art.png', name?: string) {
  const png = await sharp({ create: { width: 200, height: 280, channels: 3, background: color } }).png().toBuffer();
  const fd = new FormData();
  if (name) fd.append('name', name);
  fd.append('file', new Blob([png], { type: 'image/png' }), file);
  return api(srv, 'POST', '/api/images', fd, token);
}
const lib = async (call = A) => (await call('GET', '/api/library/images')).data as { id: string; name: string; uses: { cards: number; deckBacks: number; decks: number } }[];

describe('image library (1.2, 1.3)', () => {
  it('uploads join the uploader library named after the file; re-import does not duplicate; rename', async () => {
    const r = await upload(alex.token, '#112233', 'goblin-archer.png');
    expect(r.status).toBe(200);
    expect((await lib()).map((x) => x.name)).toEqual(['goblin-archer']);
    await upload(alex.token, '#112233', 'again.png');
    expect(await lib()).toHaveLength(1);
    expect((await lib())[0].name).toBe('goblin-archer');
    const named = await upload(alex.token, '#445566', 'IMG_0001.jpg', 'Orc Chief');
    expect((await lib()).find((x) => x.id === named.data.id)?.name).toBe('Orc Chief');
    expect((await A('PATCH', `/api/library/images/${r.data.id}`, { name: 'Goblin Archer' })).status).toBe(200);
    expect((await lib()).find((x) => x.id === r.data.id)?.name).toBe('Goblin Archer');
    expect((await A('PATCH', `/api/library/images/${r.data.id}`, { name: '  ' })).status).toBe(400);
    expect((await S('PATCH', `/api/library/images/${r.data.id}`, { name: 'Mine' })).status).toBe(404);
  });

  it('libraries are private; a second importer of the same picture can fetch it; strangers cannot', async () => {
    const img = (await upload(alex.token, '#778899', 'shared.png')).data.id;
    expect((await lib(S)).some((x) => x.id === img)).toBe(false);
    expect((await api(srv, 'GET', `/api/images/${img}.webp`, undefined, kim.token)).status).toBe(404);
    await upload(sam.token, '#778899', 'mine-too.png'); // first uploader keeps owner_id; Sam holds it via the library
    expect((await lib(S)).find((x) => x.id === img)?.name).toBe('mine-too');
    expect((await api(srv, 'GET', `/api/images/${img}.webp`, undefined, sam.token)).status).toBe(200);
    expect((await api(srv, 'GET', `/api/images/${img}.webp`, undefined, kim.token)).status).toBe(404);
  });

  it('library images survive cleanup; use counts; deleting a used image is refused, an unused one removed', async () => {
    const front = (await upload(alex.token, '#aa0000', 'front.png')).data.id;
    const back = (await upload(alex.token, '#00aa00', 'back.png')).data.id;
    const spare = (await upload(alex.token, '#0000aa', 'spare.png')).data.id;
    srv.app.images.gc(0);
    expect(srv.app.images.exists(spare)).toBe(true);
    const d = (await A('POST', '/api/decks', { name: 'Arty' })).data;
    await A('POST', `/api/decks/${d.id}/draft/ops`, {
      ops: [
        { op: 'add', card: { name: 'One', count: 1, frontImageId: front } },
        { op: 'add', card: { name: 'Two', count: 1, frontImageId: front, backImageId: front } },
      ],
    });
    await A('POST', `/api/decks/${d.id}/save`);
    const d2 = (await A('POST', '/api/decks', { name: 'Other' })).data;
    await A('PUT', `/api/decks/${d2.id}/draft`, { content: { name: 'Other', propertyTemplate: [], cards: [{ id: 'x', name: 'X', count: 1, metadata: {}, frontImageId: front }], backImageId: back } });
    const l = await lib();
    expect(l.find((x) => x.id === front)?.uses).toEqual({ cards: 3, deckBacks: 0, decks: 2 });
    expect(l.find((x) => x.id === back)?.uses).toEqual({ cards: 0, deckBacks: 1, decks: 1 });
    const except = (await A('GET', `/api/library/images?exceptDeck=${d2.id}`)).data as typeof l;
    expect(except.find((x) => x.id === front)?.uses).toEqual({ cards: 2, deckBacks: 0, decks: 1 });
    const r = await A('DELETE', `/api/library/images/${front}`);
    expect(r.status).toBe(409);
    expect(r.data).toMatchObject({ code: 'IN_USE', error: 'Used by 3 cards in 2 decks' });
    expect((await A('DELETE', `/api/library/images/${back}`)).data.error).toBe('Used by 1 deck back in 1 deck');
    expect((await A('DELETE', `/api/library/images/${spare}`)).status).toBe(200);
    expect((await lib()).some((x) => x.id === spare)).toBe(false);
    expect(srv.app.images.exists(spare)).toBe(false);
    expect((await A('DELETE', `/api/library/images/${spare}`)).status).toBe(404);
  });

  it('deleting keeps the file while another library or deck still uses it', async () => {
    const img = (await upload(alex.token, '#123123', 'both.png')).data.id;
    await upload(sam.token, '#123123', 'both.png');
    expect((await A('DELETE', `/api/library/images/${img}`)).status).toBe(200);
    expect(srv.app.images.exists(img)).toBe(true);
    expect((await api(srv, 'GET', `/api/images/${img}.webp`, undefined, sam.token)).status).toBe(200);
  });
});

describe('library backfill (1.1)', () => {
  it('migration 4 fills libraries from owned images and deck content, named after cards; idempotent', () => {
    const db = new Database(':memory:');
    migrate(db, 3);
    const now = Date.now();
    const f = 'f'.repeat(64);
    const b = 'b'.repeat(64);
    const loose = 'e'.repeat(64);
    for (const id of [f, b, loose]) db.prepare('INSERT INTO images (id, owner_id, width, height, bytes, created_at) VALUES (?, ?, 750, 1050, 1, ?)').run(id, id === loose ? 'p1' : null, now);
    const content = { name: 'Fleet', propertyTemplate: [], cards: [{ id: 'c', name: 'Cruiser', count: 1, metadata: {}, frontImageId: f }], backImageId: b };
    db.prepare('INSERT INTO deck_versions (id, deck_id, content, created_at) VALUES (?, ?, ?, ?)').run('v1', 'd1', JSON.stringify(content), now);
    db.prepare("INSERT INTO decks (id, owner_id, name, current_version_id, created_at, updated_at) VALUES ('d1', 'p1', 'Fleet', 'v1', ?, ?)").run(now, now);
    migrate(db);
    const rows = () => db.prepare('SELECT player_id, image_id, name FROM library_images ORDER BY name').all();
    expect(rows()).toEqual([
      { player_id: 'p1', image_id: f, name: 'Cruiser (front)' },
      { player_id: 'p1', image_id: b, name: 'Deck back' },
      { player_id: 'p1', image_id: loose, name: 'Image' },
    ]);
    migrate(db);
    expect(rows()).toHaveLength(3);
  });

  it('a fresh database has the library table', () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(db.prepare('SELECT COUNT(*) AS n FROM library_images').get()).toEqual({ n: 0 });
  });
});
