import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import JSZip from 'jszip';
import fs from 'node:fs';
import { startServer, api, newPlayer, Client, until, type TestServer } from './harness.js';

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

async function deckWithCards(name = 'Space Fleet', vis?: 'public' | 'link') {
  const d = (await A('POST', '/api/decks', { name })).data;
  await A('POST', `/api/decks/${d.id}/draft/ops`, {
    ops: [
      { op: 'add', card: { name: 'Cruiser', count: 2, metadata: { cost: 3 } } },
      { op: 'add', card: { name: 'Fighter', count: 4, metadata: {} } },
      { op: 'add', card: { name: 'Carrier', count: 1, metadata: {} } },
    ],
  });
  const saved = (await A('POST', `/api/decks/${d.id}/save`)).data;
  if (vis) await A('PUT', `/api/decks/${d.id}/visibility`, { visibility: vis });
  return saved;
}

async function uploadPng(token: string, w: number, h: number) {
  const png = await sharp({ create: { width: w, height: h, channels: 3, background: '#cc3366' } }).png().toBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
  return api(srv, 'POST', '/api/images', fd, token);
}

describe('deck and card CRUD (4.1)', () => {
  it('creates a deck and manages cards: add, duplicate, reorder, remove, bulk count', async () => {
    const d = (await A('POST', '/api/decks', { name: 'Standard 52' })).data;
    expect(d).toMatchObject({ name: 'Standard 52', status: 'active', visibility: 'private', cardCount: 0 });
    let r = await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'add', card: { name: 'Knight', count: 1, metadata: { suit: 'Hearts', rank: 12 } } }] });
    const knight = r.data.draft.cards[0];
    r = await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'duplicate', cardId: knight.id }] });
    expect(r.data.draft.cards.map((c: any) => c.name)).toEqual(['Knight', 'Knight (copy)']);
    expect(r.data.draft.cards[1].metadata).toEqual({ suit: 'Hearts', rank: 12 });
    const copy = r.data.draft.cards[1];
    r = await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'reorder', cardId: copy.id, toIndex: 0 }] });
    expect(r.data.draft.cards[0].id).toBe(copy.id);
    r = await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'bulkCount', cardIds: [copy.id, knight.id], count: 2 }] });
    expect(r.data.draft.cards.map((c: any) => c.count)).toEqual([2, 2]);
    r = await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'remove', cardIds: [copy.id] }] });
    expect(r.data.draft.cards).toHaveLength(1);
  });
  it('rejects a count of 0 and keeps the previous count', async () => {
    const d = await deckWithCards();
    const card = d.content.cards[0];
    const r = await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'update', cardId: card.id, card: { count: 0 } }] });
    expect(r.status).toBe(400);
    const r2 = await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'bulkCount', cardIds: [card.id], count: 0 }] });
    expect(r2.status).toBe(400);
    const det = (await A('GET', `/api/decks/${d.id}`)).data;
    expect(det.content.cards[0].count).toBe(2);
    expect(det.draft).toBeNull();
  });
  it('only the owner can edit', async () => {
    const d = await deckWithCards('Mine', 'public');
    expect((await S('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'meta', name: 'X' }] })).status).toBe(404);
  });
  it('copies cards from a public deck owned by someone else into my deck', async () => {
    const src = await deckWithCards('Public Fleet', 'public');
    const mine = (await S('POST', '/api/decks', { name: 'Sam deck' })).data;
    const r = await S('POST', `/api/decks/${mine.id}/draft/ops`, { ops: [{ op: 'copyFrom', deckId: src.id, cardIds: src.content.cards.slice(0, 2).map((c: any) => c.id) }] });
    expect(r.status).toBe(200);
    expect(r.data.draft.cards.map((c: any) => c.name)).toEqual(['Cruiser', 'Fighter']);
    expect(r.data.draft.cards[0].id).not.toBe(src.content.cards[0].id);
    const srcAfter = (await A('GET', `/api/decks/${src.id}`)).data;
    expect(srcAfter.content.cards).toHaveLength(3);
  });
});

describe('drafts and versions (4.2)', () => {
  it('non-owners see only the saved version; drafts survive a reload; discard restores', async () => {
    const d = await deckWithCards('Draft test', 'public');
    await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'meta', name: 'Draft test v2' }, { op: 'add', card: { name: 'Scout', count: 1 } }] });
    const seenBySam = (await S('GET', `/api/decks/${d.id}`)).data;
    expect(seenBySam.content.name).toBe('Draft test');
    expect(seenBySam.content.cards).toHaveLength(3);
    expect(seenBySam.draft).toBeUndefined();
    // "reload": a fresh GET returns the draft for the owner
    const mine = (await A('GET', `/api/decks/${d.id}`)).data;
    expect(mine.hasDraft).toBe(true);
    expect(mine.draft.cards).toHaveLength(4);
    await A('DELETE', `/api/decks/${d.id}/draft`);
    expect((await A('GET', `/api/decks/${d.id}`)).data.draft).toBeNull();
    await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'meta', name: 'Draft test v3' }] });
    const saved = (await A('POST', `/api/decks/${d.id}/save`)).data;
    expect(saved.currentVersionId).not.toBe(d.currentVersionId);
    expect((await S('GET', `/api/decks/${d.id}`)).data.content.name).toBe('Draft test v3');
  });
});

describe('archive, restore, delete (4.3)', () => {
  it('refuses deleting an active deck; archive → delete works; restore keeps version and visibility', async () => {
    const d = await deckWithCards('Old Prototype', 'public');
    let r = await A('DELETE', `/api/decks/${d.id}`, { confirm: true });
    expect(r.status).toBe(409);
    expect(r.data.error).toMatch(/Archive/);
    await A('POST', `/api/decks/${d.id}/archive`);
    expect((await A('GET', '/api/decks?status=archived')).data.decks.map((x: any) => x.id)).toContain(d.id);
    expect((await A('GET', '/api/decks')).data.decks.map((x: any) => x.id)).not.toContain(d.id);
    const restored = (await A('POST', `/api/decks/${d.id}/restore`)).data;
    expect(restored).toMatchObject({ status: 'active', visibility: 'public', currentVersionId: d.currentVersionId });
    await A('POST', `/api/decks/${d.id}/archive`);
    expect((await A('DELETE', `/api/decks/${d.id}`, {})).status).toBe(400); // needs confirmation
    r = await A('DELETE', `/api/decks/${d.id}`, { confirm: true });
    expect(r.status).toBe(200);
    expect((await A('GET', `/api/decks/${d.id}`)).status).toBe(404);
  });
  it('a clone survives deletion of its source; unreferenced images are garbage collected', async () => {
    const img = (await uploadPng(alex.token, 300, 420)).data;
    const d = (await A('POST', '/api/decks', { name: 'With art' })).data;
    await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'add', card: { name: 'Painted', count: 1, frontImageId: img.id } }] });
    await A('POST', `/api/decks/${d.id}/save`);
    await A('PUT', `/api/decks/${d.id}/visibility`, { visibility: 'public' });
    const clone = (await S('POST', `/api/decks/${d.id}/clone`)).data;
    await A('POST', `/api/decks/${d.id}/archive`);
    await A('DELETE', `/api/decks/${d.id}`, { confirm: true });
    const c = (await S('GET', `/api/decks/${clone.id}`)).data;
    expect(c.content.cards[0].frontImageId).toBe(img.id);
    expect(srv.app.images.exists(img.id)).toBe(true); // still referenced by the clone
    await S('POST', `/api/decks/${clone.id}/archive`);
    await S('DELETE', `/api/decks/${clone.id}`, { confirm: true });
    expect(srv.app.images.exists(img.id)).toBe(true); // still in Alex's image library (image-library)
    expect((await A('DELETE', `/api/library/images/${img.id}`)).status).toBe(200);
    expect(srv.app.images.exists(img.id)).toBe(false);
  });
});

describe('visibility and access (4.4)', () => {
  it('private refuses as not found; link needs the token; public is open; archived link refused', async () => {
    const d = await deckWithCards('Secret');
    expect((await S('GET', `/api/decks/${d.id}`)).status).toBe(404);
    const linked = (await A('PUT', `/api/decks/${d.id}/visibility`, { visibility: 'link' })).data;
    expect(linked.shareToken).toBeTruthy();
    expect((await S('GET', `/api/decks/${d.id}`)).status).toBe(404);
    expect((await S('GET', `/api/share/${linked.shareToken}`)).status).toBe(200);
    expect((await S('GET', `/api/decks/${d.id}?share=${linked.shareToken}`)).status).toBe(200);
    // link decks are not in the gallery
    expect((await S('GET', '/api/gallery?q=Secret')).data.decks).toHaveLength(0);
    await A('PUT', `/api/decks/${d.id}/visibility`, { visibility: 'public' });
    expect((await S('GET', `/api/decks/${d.id}`)).status).toBe(200);
    await A('POST', `/api/decks/${d.id}/archive`);
    const r = await S('GET', `/api/share/${linked.shareToken}`);
    expect(r.status).toBe(404);
    expect(r.data.error).toBe('This deck is unavailable');
    expect((await S('GET', `/api/decks/${d.id}`)).status).toBe(404);
  });
  it('built-in decks are visible to everyone; table participants can view a private deck loaded on their table', async () => {
    expect((await S('GET', '/api/decks/builtin-standard-52')).status).toBe(200);
    const d = await deckWithCards('Private but loaded');
    const a = new Client(srv, alex.token, alex.player.id, 'Alex');
    const b = new Client(srv, sam.token, sam.player.id, 'Sam');
    await a.open();
    await b.open();
    const { tableId } = await a.req({ t: 'table.create', name: 'T', deckId: d.id });
    await a.req({ t: 'table.join', tableId });
    await b.req({ t: 'table.join', tableId });
    const r = await S('GET', `/api/decks/${d.id}`);
    expect(r.status).toBe(200);
    expect(r.data.content.cards).toHaveLength(3);
    await b.req({ t: 'table.leave', tableId });
    expect((await S('GET', `/api/decks/${d.id}`)).status).toBe(404);
    await a.req({ t: 'table.leave', tableId });
    a.close();
    b.close();
  });
});

describe('cloning (4.5)', () => {
  it('creates an independent private deck with a frozen "Cloned from" label', async () => {
    const d = await deckWithCards('Space Fleet', 'public');
    const c = (await S('POST', `/api/decks/${d.id}/clone`)).data;
    expect(c).toMatchObject({ ownerId: sam.player.id, visibility: 'private', status: 'active', name: 'Space Fleet', clonedFromLabel: 'Cloned from Space Fleet by Alex' });
    expect(c.content.cards).toEqual(d.content.cards);
    expect((await A('GET', `/api/decks/${d.id}`)).data.cloneCount).toBe(1);
    // Sam can edit the clone; Alex's later edits don't affect it
    await S('POST', `/api/decks/${c.id}/draft/ops`, { ops: [{ op: 'meta', name: 'Sam Fleet' }] });
    await S('POST', `/api/decks/${c.id}/save`);
    await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'remove', cardIds: [d.content.cards[0].id] }] });
    await A('POST', `/api/decks/${d.id}/save`);
    const c2 = (await S('GET', `/api/decks/${c.id}`)).data;
    expect(c2.content.cards).toHaveLength(3);
    expect(c2.name).toBe('Sam Fleet');
  });
  it("can't clone another player's archived or private deck", async () => {
    const d = await deckWithCards('Gone', 'public');
    await A('POST', `/api/decks/${d.id}/archive`);
    expect((await S('POST', `/api/decks/${d.id}/clone`)).status).toBe(404);
    const p = await deckWithCards('Private');
    expect((await S('POST', `/api/decks/${p.id}/clone`)).status).toBe(404);
  });
});

describe('table snapshots (4.6)', () => {
  it('editing and deleting the source deck leaves table play and card info intact; newer version flag + reload', async () => {
    const d = await deckWithCards('Snap');
    const a = new Client(srv, alex.token, alex.player.id, 'Alex');
    await a.open();
    const { tableId } = await a.req({ t: 'table.create', name: 'Snap table', deckId: d.id });
    await a.req({ t: 'table.join', tableId });
    await until(() => !!a.table);
    expect(a.zone('Snap').cards).toHaveLength(7);
    await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'add', card: { name: 'Dreadnought', count: 1 } }] });
    await A('POST', `/api/decks/${d.id}/save`);
    // host sees a newer version is available (after any table update)
    await a.act({ type: 'setNotes', notes: 'x' });
    await until(() => a.table!.decks[0].newerVersion === true);
    expect(a.zone('Snap').cards).toHaveLength(7);
    // reload picks up the new version
    await a.req({ t: 'table.reloadDeck', tableId, tableDeckId: a.table!.decks[0].id });
    await until(() => a.zone('Snap').cards.length === 8);
    // archive + delete the source: table still fully playable
    await A('POST', `/api/decks/${d.id}/archive`);
    await A('DELETE', `/api/decks/${d.id}`, { confirm: true });
    await a.act({ type: 'move', cards: [a.zone('Snap').cards[0].h], to: a.zone('Table').id, face: 'up' });
    await until(() => a.zone('Table').cards.length === 1);
    const played = a.zone('Table').cards[0];
    const def = a.table!.decks[0].defs.find((x) => x.id === played.def);
    expect(def?.name).toBeTruthy();
    await a.req({ t: 'table.leave', tableId });
    a.close();
  });
});

describe('gallery (4.7)', () => {
  it('lists active public decks with search and sort; archiving or reporting withdraws', async () => {
    const t1 = await deckWithCards('Tarot Major', 'public');
    const t2 = await deckWithCards('Tarot Minor', 'public');
    await S('POST', `/api/decks/${t2.id}/clone`);
    let g = (await S('GET', '/api/gallery?q=tarot&sort=cloned')).data;
    expect(g.decks.map((x: any) => x.name)).toEqual(['Tarot Minor', 'Tarot Major']);
    expect(g.decks[0]).toMatchObject({ ownerName: 'Alex', cloneCount: 1, cardCount: 7 });
    g = (await S('GET', '/api/gallery?q=alex')).data; // search by owner
    expect(g.decks.length).toBeGreaterThanOrEqual(2);
    await A('POST', `/api/decks/${t1.id}/archive`);
    g = (await S('GET', '/api/gallery?q=tarot')).data;
    expect(g.decks.map((x: any) => x.id)).toEqual([t2.id]);
    await S('POST', `/api/decks/${t2.id}/report`, { reason: 'spam' });
    expect((await S('GET', '/api/gallery?q=tarot')).data.decks).toHaveLength(0);
  });
});

describe('images (4.8)', () => {
  it('normalizes an off-ratio image into a 750×1050 frame with a thumbnail, deduplicated', async () => {
    const r = await uploadPng(alex.token, 1000, 1000);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ width: 750, height: 1050 });
    const meta = await sharp(fs.readFileSync(srv.app.images.file(r.data.id))).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([750, 1050, 'webp']);
    const tmeta = await sharp(fs.readFileSync(srv.app.images.file(r.data.id, true))).metadata();
    expect([tmeta.width, tmeta.height]).toEqual([250, 350]);
    // square content is letterboxed (no distortion): top rows are transparent
    const { data } = await sharp(fs.readFileSync(srv.app.images.file(r.data.id))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    const again = await uploadPng(alex.token, 1000, 1000);
    expect(again.data.id).toBe(r.data.id);
  });
  it('rejects a 30 MB TIFF naming allowed formats and size', async () => {
    const tiff = await sharp({ create: { width: 3200, height: 3200, channels: 3, background: '#123456' } }).tiff({ compression: 'none' }).toBuffer();
    expect(tiff.byteLength).toBeGreaterThan(29 * 1024 * 1024);
    const fd = new FormData();
    fd.append('file', new Blob([tiff], { type: 'image/tiff' }), 'big.tiff');
    const r = await api(srv, 'POST', '/api/images', fd, alex.token);
    expect(r.status).toBe(413);
    expect(r.data.error).toMatch(/PNG, JPEG or WebP images up to 10 MB/);
    const small = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).tiff().toBuffer();
    const fd2 = new FormData();
    fd2.append('file', new Blob([small]), 'small.tiff');
    const r2 = await api(srv, 'POST', '/api/images', fd2, alex.token);
    expect(r2.status).toBe(415);
  });
  it('serves images only to players who can access them', async () => {
    const img = (await uploadPng(alex.token, 200, 280)).data;
    expect((await api(srv, 'GET', `/api/images/${img.id}.webp`, undefined, alex.token)).status).toBe(200);
    expect((await api(srv, 'GET', `/api/images/${img.id}.webp`, undefined, sam.token)).status).toBe(404);
    const d = (await A('POST', '/api/decks', { name: 'Art' })).data;
    await A('POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'add', card: { name: 'P', count: 1, frontImageId: img.id } }] });
    await A('POST', `/api/decks/${d.id}/save`);
    expect((await api(srv, 'GET', `/api/images/${img.id}.thumb.webp`, undefined, sam.token)).status).toBe(404);
    await A('PUT', `/api/decks/${d.id}/visibility`, { visibility: 'public' });
    expect((await api(srv, 'GET', `/api/images/${img.id}.thumb.webp`, undefined, sam.token)).status).toBe(200);
    // signed per-player image keys work without headers; forged keys do not
    const key = srv.app.imageKey(alex.player.id);
    const priv = (await uploadPng(alex.token, 210, 290)).data;
    expect((await api(srv, 'GET', `/api/images/${priv.id}.webp?k=${key}`)).status).toBe(200);
    expect((await api(srv, 'GET', `/api/images/${priv.id}.webp?k=${alex.player.id}.forged`)).status).toBe(404);
  });
});

describe('import / export (4.9)', () => {
  it('round-trips a deck through a zip archive', async () => {
    const img = (await uploadPng(alex.token, 500, 700)).data;
    const d = (await A('POST', '/api/decks', { name: 'Round trip' })).data;
    await A('POST', `/api/decks/${d.id}/draft/ops`, {
      ops: [
        { op: 'meta', propertyTemplate: [{ key: 'suit', type: 'text' }], backImageId: img.id },
        { op: 'add', card: { name: 'Goblin', count: 3, frontImageId: img.id, metadata: { suit: 'Green', power: 2, tags: ['a'] }, abilities: [{ trigger: 'On Play', effect: 'Draw Card', value: 2, target: 'Self' }] } },
        { op: 'add', card: { name: 'Orc', count: 1, description: 'Big', metadata: {} } },
      ],
    });
    const orig = (await A('POST', `/api/decks/${d.id}/save`)).data;
    const exp = await A('GET', `/api/decks/${d.id}/export?format=zip`);
    expect(exp.status).toBe(200);
    const zip = await JSZip.loadAsync(exp.data);
    expect(Object.keys(zip.files)).toContain(`images/${img.id}.webp`);
    const fd = new FormData();
    fd.append('file', new Blob([exp.data]), 'deck.zip');
    const imp = await api(srv, 'POST', '/api/decks/import', fd, sam.token);
    expect(imp.status).toBe(200);
    expect(imp.data).toMatchObject({ ownerId: sam.player.id, visibility: 'private', name: 'Round trip' });
    expect(imp.data.content).toEqual(orig.content);
  });
  it('JSON export and import of the manifest alone', async () => {
    const d = await deckWithCards('JSON deck', 'public');
    const exp = await A('GET', `/api/decks/${d.id}/export?format=json`);
    const manifest = exp.data;
    expect(manifest.format).toBe('card-table-deck');
    const imp = await S('POST', '/api/decks/import', manifest);
    expect(imp.status).toBe(200);
    expect(imp.data.content.cards.map((c: any) => [c.name, c.count])).toEqual(d.content.cards.map((c: any) => [c.name, c.count]));
  });
  it('reports per-card errors and creates no deck for an invalid count', async () => {
    const before = (await S('GET', '/api/decks')).data.decks.length;
    const r = await S('POST', '/api/decks/import', {
      format: 'card-table-deck',
      version: 1,
      name: 'Broken',
      cards: [
        { name: 'Fine', count: 1 },
        { name: 'Negative', count: -2 },
      ],
    });
    expect(r.status).toBe(400);
    expect(r.data.errors).toEqual([expect.objectContaining({ card: 1, name: 'Negative' })]);
    expect((await S('GET', '/api/decks')).data.decks.length).toBe(before);
  });
});

describe('built-in deck (4.10)', () => {
  it('loading the standard deck creates 52 face-down instances in one pile with suit/rank metadata', async () => {
    const det = (await S('GET', '/api/decks/builtin-standard-52')).data;
    expect(det.builtIn).toBe(true);
    expect(det.content.cards[0].metadata).toMatchObject({ suit: 'Spades', rank: 1 });
    expect((await S('POST', '/api/decks/builtin-standard-52/draft/ops', { ops: [{ op: 'meta', name: 'x' }] })).status).toBe(404);
    const b = new Client(srv, sam.token, sam.player.id, 'Sam');
    await b.open();
    const { tableId } = await b.req({ t: 'table.create', name: 'Std', deckId: 'builtin-standard-52' });
    await b.req({ t: 'table.join', tableId });
    await until(() => !!b.table);
    const pile = b.zone('Standard 52');
    expect(pile.layout).toBe('pile');
    expect(pile.cards).toHaveLength(52);
    expect(pile.cards.every((c) => !c.faceUp && !c.known)).toBe(true);
    const jokers = (await S('GET', '/api/decks/builtin-standard-54')).data;
    expect(jokers.cardCount).toBe(54);
    // cloning a built-in gives an editable copy
    const c = (await S('POST', '/api/decks/builtin-standard-52/clone')).data;
    expect(c).toMatchObject({ ownerId: sam.player.id, clonedFromLabel: 'Cloned from Standard 52 by Card Table' });
    await b.req({ t: 'table.leave', tableId });
    b.close();
  });
});

describe('deck format docs (4.11)', () => {
  it('the sample manifest in docs/deck-format.md imports successfully', async () => {
    const md = fs.readFileSync(new URL('../../docs/deck-format.md', import.meta.url), 'utf8');
    const m = /```json sample\n([\s\S]*?)```/.exec(md);
    expect(m).toBeTruthy();
    const r = await S('POST', '/api/decks/import', JSON.parse(m![1]));
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data.content.cards.length).toBeGreaterThan(0);
  });
});
