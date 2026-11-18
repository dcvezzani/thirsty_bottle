import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startServer, Client, api, sleep, until, type TestServer } from './harness.js';
import { tableWith, dupDeck } from './fixtures.js';

let srv: TestServer;
beforeEach(async () => (srv = await startServer()));
afterEach(async () => srv.stop());

describe('server, validation and rate limits (3.1)', () => {
  it('serves health and rejects malformed messages without closing the connection', async () => {
    expect((await api(srv, 'GET', '/api/health')).data).toEqual({ ok: true, version: process.env.GIT_SHA || 'dev' });
    const a = await Client.connect(srv, 'Alex');
    a.send('not json');
    expect((await a.next((m) => m.t === 'error')) as any).toMatchObject({ code: 'BAD_JSON' });
    a.send({ t: 'table.intent', rid: 77, tableId: 'x' });
    expect((await a.next((m) => m.t === 'reply' && (m as any).rid === 77)) as any).toMatchObject({ ok: false, code: 'BAD_MESSAGE' });
    a.send({ t: 'chat.send', channel: 'lobby', text: 'x'.repeat(70 * 1024) });
    expect((await a.next((m) => m.t === 'error')) as any).toMatchObject({ code: 'TOO_LARGE' });
    // still open and working
    expect(a.closed).toBe(false);
    await a.req({ t: 'ping' });
    a.close();
  });
  it('rate limits a flood of actions', async () => {
    const a = await Client.connect(srv, 'Alex');
    const replies: any[] = [];
    const n = 80;
    const done = new Promise<void>((res) => {
      a.ws.on('message', (d) => {
        const m = JSON.parse(d.toString());
        if (m.t === 'reply' && m.rid >= 1000) {
          replies.push(m);
          if (replies.length === n) res();
        }
      });
    });
    for (let i = 0; i < n; i++) a.send({ t: 'ping', rid: 1000 + i });
    await done;
    expect(replies.filter((r) => r.code === 'RATE_LIMIT').length).toBeGreaterThan(0);
    expect(a.closed).toBe(false);
    a.close();
  });
  it('requires hello before anything else', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    await new Promise((r) => ws.once('open', r));
    const reply = new Promise<any>((r) => ws.once('message', (d) => r(JSON.parse(d.toString()))));
    ws.send(JSON.stringify({ t: 'chat.send', rid: 1, channel: 'lobby', text: 'hi' }));
    expect(await reply).toMatchObject({ ok: false, code: 'NO_HELLO' });
    ws.close();
  });
});

describe('identity (3.2)', () => {
  it('issues a token, resumes identity, and suffixes duplicate names', async () => {
    const a = await Client.connect(srv, 'Alex');
    const me = await api(srv, 'GET', '/api/me', undefined, a.token);
    expect(me.data.player).toMatchObject({ id: a.id, name: 'Alex' });
    expect((await api(srv, 'GET', '/api/me', undefined, 'bogus-token-bogus-token')).status).toBe(401);
    const b = await Client.connect(srv, 'Alex');
    const lobby = (await b.wait((m) => m.t === 'lobby' && m.players.length === 2)) as any;
    const names = lobby.players.map((p: any) => p.name + (p.suffix ? ' ' + p.suffix : ''));
    expect(names.sort()).toEqual(['Alex', 'Alex #2']);
    // reconnecting with the same token restores the identity
    a.close();
    await sleep(50);
    const a2 = new Client(srv, a.token, a.id, 'Alex');
    await a2.open();
    const w = (await a2.wait((m) => m.t === 'welcome')) as any;
    expect(w.player.id).toBe(a.id);
    a2.close();
    b.close();
  });
  it('a second socket for the same player replaces the first', async () => {
    const a = await Client.connect(srv, 'Alex');
    const a2 = new Client(srv, a.token, a.id, 'Alex');
    await a2.open();
    await a.wait((m) => m.t === 'session.replaced');
    await until(() => a.closed);
    await a2.req({ t: 'ping' });
    expect(srv.app.hub.isConnected(a.id)).toBe(true);
    a2.close();
  });
  it('rejects invalid display names', async () => {
    expect((await api(srv, 'POST', '/api/players', { name: '   ', color: '#123456' })).status).toBe(400);
    expect((await api(srv, 'POST', '/api/players', { name: 'x'.repeat(25), color: '#123456' })).status).toBe(400);
  });
});

describe('per-viewer projection (3.3)', () => {
  it("never sends another player's hand identities; hidden copy numbers withheld", async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    await tableWith(srv, a, [b], dupDeck());
    const deck = a.zone('Monsters');
    const framesBefore = b.rawFrames.length;
    await a.act({ type: 'draw', zone: deck.id, count: 2, from: 'top' });
    await until(() => b.handOf(a)?.cards.length === 2);
    const newFrames = b.rawFrames.slice(framesBefore).join('\n');
    expect(newFrames).not.toContain('"def"');
    expect(newFrames).not.toContain('copyNo');
    expect(newFrames).not.toContain('Goblin #');
    // Alex sees his own cards with copy numbers
    expect(a.myHand().cards.map((c) => [c.def, c.copyNo])).toEqual([
      ['gob', 1],
      ['gob', 2],
    ]);
    // Sam's view of Alex's hand: backs only
    expect(b.handOf(a).cards.every((c) => !c.known && c.def === undefined && c.copyNo === undefined)).toBe(true);
  });
  it('regenerates handles of hidden cards on shuffle so they cannot be tracked', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    await tableWith(srv, a, [b]);
    const deckId = b.zone('Standard').id;
    const seen = new Set<string>();
    for (const c of b.zone('Standard').cards) seen.add(c.h);
    for (let i = 0; i < 3; i++) {
      const v = b.table!.version;
      await a.act({ type: 'shuffle', zone: deckId });
      await until(() => b.table!.version > v);
      const hs = b.zone('Standard').cards.map((c) => c.h);
      for (const h of hs) expect(seen.has(h)).toBe(false);
      hs.forEach((h) => seen.add(h));
    }
  });
});

describe('table session (3.4)', () => {
  it('simultaneous grabs of the last card: first wins, second is told the pile is empty', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b], dupDeck());
    const deck = a.zone('Monsters').id;
    await a.act({ type: 'draw', zone: deck, count: 3, from: 'top' });
    await until(() => b.zone('Monsters').cards.length === 1);
    const [ra, rb] = await Promise.all([
      a.act({ type: 'draw', zone: deck, count: 1, from: 'top' }),
      b.act({ type: 'draw', zone: deck, count: 1, from: 'top' }),
    ]);
    const oks = [ra.ok, rb.ok].filter(Boolean);
    expect(oks).toHaveLength(1);
    const loser = ra.ok ? rb : ra;
    expect(loser.error).toMatch(/empty/);
    const s = srv.app.tables.get(tid)!;
    expect(s.state.zones[deck].cards).toHaveLength(0);
  });
  it('acks, versions increase by one per action, and gap → snapshot', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b]);
    const v0 = b.table!.version;
    const deck = a.zone('Standard').id;
    await a.act({ type: 'flip', cards: [a.zone('Standard').cards[0].h] });
    await a.act({ type: 'shuffle', zone: deck });
    await until(() => b.table!.version === v0 + 2);
    // stale handle is refused
    const stale = b.zone('Standard').cards.find((c) => !c.known)!.h;
    await a.act({ type: 'shuffle', zone: deck });
    await until(() => b.table!.version === v0 + 3);
    const r = await b.act({ type: 'flip', cards: [stale] });
    expect(r).toMatchObject({ ok: false, code: 'STALE' });
    // snapshot request returns full state
    const snap = b.next((m) => m.t === 'table.snapshot');
    await b.req({ t: 'table.snapshot', tableId: tid });
    expect(((await snap) as any).table.version).toBe(v0 + 3);
  });
});
